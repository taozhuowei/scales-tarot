/**
 * Production build pipeline.
 *
 * Order:
 *   1. quality gate (unless --skip-quality) — pure code checks now (~30s)
 *   2. h5 build      (if target includes h5)
 *   3. mp build      (if target includes mp)
 *   4. server build  (if target includes server)
 *   5. smoke         (only if BOTH h5 + server were built — needs the prod
 *                     bundle on disk + start:prod to boot the static SPA)
 *
 * Steps run sequentially: vite build is CPU-bound and uniapp's two targets
 * fight over the same temp dirs when run in parallel. tsc is fast enough
 * that serialising it adds < 2s.
 */

'use strict'

const { spawn } = require('child_process')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..', '..')

function run(label, command, args, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n[build] ${label}`)
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
    })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${label} exited with code ${code}`))
    })
  })
}

const VITE_BIN = 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'

async function build_h5() {
  return run(
    'h5: vite build (production)',
    'node',
    [VITE_BIN, 'build', '--mode', 'production', '--config', 'app/vite.config.ts'],
    {
      NODE_ENV: 'production',
      UNI_INPUT_DIR: 'app/src',
      VITE_ROOT_DIR: 'app',
    },
  )
}

async function build_mp() {
  return run(
    'mp: vite build (production, mp-weixin)',
    'node',
    [VITE_BIN, 'build', '-p', 'mp-weixin', '--mode', 'production', '--config', 'app/vite.config.ts'],
    {
      NODE_ENV: 'production',
      UNI_INPUT_DIR: 'app/src',
      VITE_ROOT_DIR: 'app',
    },
  )
}

async function build_server() {
  return run('server: tsc compile', 'npx', ['tsc', '-p', 'server/tsconfig.json'])
}

async function run_smoke() {
  // The webServer block in app/playwright.config.ts boots `start:prod` and
  // reuses an existing server locally. quietly relies on `server/dist` and
  // `server/public/static` being populated, hence the order above.
  return run(
    'smoke: Playwright SPA boot',
    'npx',
    ['playwright', 'test', '--config=app/playwright.config.ts', 'app/test/e2e/spa_boot_smoke.spec.ts'],
  )
}

async function run_quality() {
  return run('quality gate (full)', 'node', ['scripts/quality_gate.js', 'full'])
}

async function run_perf_baseline() {
  // Bundle-size regression check. Compares dist/build/h5/ against the
  // committed perf_baseline.json. Lives here (not in quality_gate.js) because
  // it needs the freshly-built h5 artifacts on disk.
  return run('perf: baseline (bundle size)', 'node', ['scripts/perf_baseline_gate.js'])
}

module.exports = async function prodPipeline({ targets, skipQuality }) {
  if (!skipQuality) {
    await run_quality()
  } else {
    console.log('[build] Skipping quality gate (--skip-quality set)')
  }

  if (targets.includes('h5')) await build_h5()
  if (targets.includes('mp')) await build_mp()
  if (targets.includes('server')) await build_server()

  // perf gate only meaningful once h5 produced output. Run it before smoke so
  // a regression fails the pipeline before we burn time spinning up Playwright.
  if (targets.includes('h5')) {
    await run_perf_baseline()
  }

  // Smoke needs both bundles. If the caller picked just `--target h5`, they're
  // doing a partial build (e.g. for asset inspection) and don't want smoke.
  const can_smoke = targets.includes('h5') && targets.includes('server')
  if (can_smoke) {
    await run_smoke()
  } else {
    console.log(`[build] Skipping smoke (requires both h5 + server; got ${targets.join(',')})`)
  }

  console.log('\n[build] Production pipeline complete')
  return 0
}
