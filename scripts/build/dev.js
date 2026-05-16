/**
 * Development pipeline.
 *
 * Order:
 *   1. quality gate (full) — same as pre-push. Runs FIRST: if the codebase
 *      is broken (lint/type/test failures), there's no point writing env
 *      files, killing port occupiers, or spinning up watchers — fail fast
 *      before doing anything with side effects.
 *   2. dev_env setup (write .env.development.local with LAN IP)
 *   3. free dev ports — SIGKILL any process holding 4123 (vite) or 4124
 *      (express). Per project decision: dev never silently drifts to a
 *      different port; we own those ports and reclaim them by force.
 *   4. concurrently start watchers per --target:
 *        - h5     : vite dev server on :4123 (HMR)    + vite-plugin-checker
 *        - mp     : vite-plugin-uni build --watch (mp-weixin only — the
 *                   mini-program runtime can't consume an HTTP dev server,
 *                   so it has to be disk-emit watch mode)
 *        - server : tsx (auto-reload TS) on :4124
 *
 * vite-plugin-checker is wired only to the H5 dev pipeline (see
 * app/vite.config.ts) — it watches for vue-tsc / tsc / eslint errors and
 * surfaces them in the browser overlay. Not run for mp/server.
 *
 * --skip-quality is honoured here too (mostly for `npm run dev`-on-CI
 * style invocations, which we don't currently use; kept for symmetry).
 */

'use strict'

const { killOccupierAndStart } = require('../lib/port_kill')
const { REPO_ROOT, VITE_BIN, makeProcessRunner } = require('../lib/run_process')

const VITE_PORT = 4123
const SERVER_PORT = 4124

const run = makeProcessRunner('dev')

function buildConcurrentlyArgs(targets) {
  const names = []
  const commands = []

  if (targets.includes('h5')) {
    names.push('h5')
    // Default uni subcommand (no `build`) starts vite's dev server with HMR
    // — that's what we want during development. The previous `build --watch`
    // pipeline only emitted disk artefacts, leaving :4123 unbound and forcing
    // express to serve the prod bundle for SPA requests, which masked any
    // freshly-edited code. Vite's dev server owns :4123, proxies /api +
    // /static to express on :4124, and gives us module-level HMR.
    commands.push(
      'cross-env NODE_ENV=development UNI_INPUT_DIR=app/src VITE_ROOT_DIR=app ' +
        `node ${VITE_BIN} --mode development --config app/vite.config.ts`,
    )
  }
  if (targets.includes('mp')) {
    names.push('mp')
    commands.push(
      'cross-env NODE_ENV=development UNI_INPUT_DIR=app/src VITE_ROOT_DIR=app ' +
        `node ${VITE_BIN} build -p mp-weixin --watch --mode development --config app/vite.config.ts`,
    )
  }
  if (targets.includes('server')) {
    names.push('server')
    commands.push('cross-env NODE_ENV=development tsx server/src/server.ts')
  }

  if (commands.length === 0) {
    throw new Error('[dev] No watchable targets selected (got empty target set)')
  }

  return [
    '--kill-others-on-fail',
    '-n', names.join(','),
    ...commands,
  ]
}

async function freeDevPorts(targets) {
  // Only free a port if we're about to bind it; running `--target server`
  // alone shouldn't molest a vite watcher the user has open in another tab.
  const ports_to_free = []
  if (targets.includes('h5')) ports_to_free.push(VITE_PORT)
  if (targets.includes('server')) ports_to_free.push(SERVER_PORT)

  for (const port of ports_to_free) {
    const killed = await killOccupierAndStart(port)
    if (killed.length > 0) {
      console.log(`[dev] freed :${port} (killed pid ${killed.join(', ')})`)
    } else {
      console.log(`[dev] :${port} already free`)
    }
  }
}

module.exports = async function devPipeline({ targets, skipQuality }) {
  // Step 1: quality gate FIRST (skippable for symmetry with prod). If the
  // codebase fails lint/type/test, abort before touching env files, killing
  // port occupiers, or spinning up watchers — there's no point doing any of
  // that work if the quality bar isn't met.
  if (!skipQuality) {
    await run('quality gate (full)', 'node', ['scripts/quality_gate.js', 'full'])
  } else {
    console.log('[dev] Skipping quality gate (--skip-quality set)')
  }

  // Step 2: env setup — generates .env.development.local with LAN IP for
  // mini-program real-device debugging. Cheap, always run.
  await run('dev_env: write .env.development.local', 'node', ['scripts/dev_env.js'])

  // Step 3: free vite (:4123) and express (:4124) right before binding,
  // so a hung watcher from a previous session can't survive into this one
  // and silently steal the ports we're about to ask vite/tsx to listen on.
  await freeDevPorts(targets)

  // Step 4: long-running watchers under concurrently.
  const concurrentlyArgs = buildConcurrentlyArgs(targets)
  await run('start watchers', 'npx', ['concurrently', ...concurrentlyArgs])

  return 0
}
