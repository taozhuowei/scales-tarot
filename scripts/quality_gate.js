const { spawn, spawnSync } = require('child_process')

const mode = process.argv[2] || 'full'

// All step commands are inlined here (not delegated to `npm run …`) because
// the public npm script surface was collapsed to 3 entries (prepare / dev /
// prod). The previous fan-out scripts (lint, quality:lint, quality:type-check,
// quality:audit, arch:check, quality:lint:fix, build, build:dev, test,
// quality, ship) were removed; their commands now live in this file (or
// scripts/build/) as the single source of truth.
const stepsByMode = {
  // The full gate is now pure code-checks (~30s):
  //   lint, type-check, unit tests, audit, arch + dead/duplicate code.
  // build (h5/mp/server) and the SPA-boot smoke run live in
  // scripts/build/prod.js — they are part of the build pipeline, not
  // the quality contract. CI runs both: `verify` job calls
  // `node scripts/quality_gate.js full` and `e2e` job calls the build
  // orchestrator with --skip-quality.
  full: [
    { label: 'quality-scan', command: 'node', args: ['scripts/quality_scan.js'] },
    { label: 'pr-size', command: 'node', args: ['scripts/pr_size_gate.js'] },
    { label: 'lint', command: 'npx', args: ['eslint', '--config', 'config/eslint.config.mjs', 'app/src/', 'app/test/', 'server/src/', 'server/test/'] },
    // type-check is two compilers: vue-tsc for the Vue app, tsc for the
    // server. Run sequentially as separate steps so failures point at the
    // right tsconfig.
    { label: 'type-check:app', command: 'npx', args: ['vue-tsc', '--noEmit', '-p', 'app/tsconfig.json'] },
    { label: 'type-check:server', command: 'npx', args: ['tsc', '--noEmit', '-p', 'server/tsconfig.json'] },
    // Direct vitest invocation — Phase 10 split the single root `test/`
    // workspace into per-package `app/test/` + `server/test/`. The two
    // configs use `include: ['test/**/*.test.ts']` (cwd-relative), so we
    // pass `--dir <pkg>/test` to scope each run to its own tree. Two
    // separate steps make a failure point at the right workspace.
    { label: 'test:app', command: 'npx', args: ['vitest', 'run', '--config', 'app/vitest.config.ts', '--dir', 'app/test'] },
    { label: 'test:server', command: 'npx', args: ['vitest', 'run', '--config', 'server/vitest.config.ts', '--dir', 'server/test'] },
    // perf-baseline lives in the build pipeline (scripts/build/prod.js), not
    // here — it needs `dist/build/h5/` populated to produce a real measurement.
    // Running it from quality_gate / pre-push always saw 0 bytes because the
    // build had not yet executed at that point.
    {
      label: 'audit',
      command: 'npm',
      args: ['audit', '--omit=dev', '--audit-level=high'],
      // Audit prints known moderate vulnerabilities even on success,
      // polluting CI logs. Swallow stdout on success; print everything on failure.
      quietOnSuccess: true,
    },
    {
      label: 'arch:check',
      command: 'npx',
      args: ['depcruise', 'app/src', 'app/test', 'server/src', 'server/test', '--config', 'config/dependency-cruiser.cjs'],
    },
    // Project-wide dead-code detection (knip): unused files, exports,
    // dependencies, class members. Quiet-on-success because the warning
    // output is verbose; on failure (any new dead code) it prints fully.
    {
      label: 'dead-code',
      command: 'npx',
      args: ['knip', '--config', 'config/knip.json', '--no-progress'],
      quietOnSuccess: true,
    },
    // Cross-file copy-paste detection (jscpd): finds duplicate code blocks
    // ≥ 5 lines / 50 tokens. Threshold 0.13% — fails the gate if more than
    // 0.13% of the codebase is duplicated. Paired with sonarjs ESLint rules
    // (no-identical-functions, no-duplicate-string) which catch
    // structurally-similar but variable-renamed copies that jscpd's
    // token-level scan would miss.
    {
      label: 'duplicate-code',
      command: 'npx',
      args: ['jscpd', 'app/src', 'server/src', '--config', 'config/jscpd.json', '--silent'],
      quietOnSuccess: true,
    },
  ],
  staged: [
    // pre-commit: must stay fast (target < 5s).
    // type-check moved to pre-push only — full vue-tsc + tsc on staged
    // commits added 8-20s and slowed the dev loop. The pre-push hook still
    // runs the full check, and CI (.github/workflows/ci.yml) mirrors it,
    // so type errors can't reach origin/main even if a developer commits
    // them locally.
    //
    // gitleaks runs first so a credential leak fails before any other
    // expensive step touches the disk. `git --staged` only diffs files
    // already in the index, finishing in ~0.3s on this repo. The full
    // history scan (`gitleaks git`) lives in CI to catch sneak-ins via
    // amend or rebase that bypass pre-commit. Using v8.30+ subcommand
    // surface (`git`/`dir`); the older `protect`/`detect` aliases are
    // deprecated upstream.
    {
      label: 'gitleaks',
      command: 'node',
      args: ['scripts/gitleaks_run.js', 'git', '--staged', '--no-banner', '--redact', '--config=config/gitleaks.toml'],
    },
    { label: 'quality-scan', command: 'node', args: ['scripts/quality_scan.js'] },
    {
      label: 'lint:fix',
      command: 'npx',
      args: ['eslint', '--fix', '--cache', '--cache-location', 'node_modules/.cache/eslint/', '--config', 'config/eslint.config.mjs', 'app/src/', 'app/test/', 'server/src/', 'server/test/'],
    },
    { label: 'git add', command: 'git', args: ['add', '-u'] },
  ],
}

const steps = stepsByMode[mode]

if (!steps) {
  console.error(`[quality] Unsupported mode: ${mode}`)
  process.exit(1)
}

function resolveExecutable(command) {
  return process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command
}

// `staged` (pre-commit) MUST stay sequential: gitleaks runs first by design
// so a credential leak fails before anything else touches disk, and
// lint:fix -> `git add -u` is order-dependent. stdio is inherited so
// lint:fix output / git add are visible live, exactly as before.
function runSequential() {
  for (const step of steps) {
    console.log(`[quality] Running ${step.label}`)

    const result = spawnSync(resolveExecutable(step.command), step.args, {
      stdio: step.quietOnSuccess ? 'pipe' : 'inherit',
      env: process.env,
      encoding: 'utf-8',
    })

    if (result.error) {
      console.error(`[quality] Failed to start ${step.label}: ${result.error.message}`)
      process.exit(1)
    }

    if (typeof result.status === 'number' && result.status !== 0) {
      if (step.quietOnSuccess && result.stdout) process.stdout.write(result.stdout)
      if (step.quietOnSuccess && result.stderr) process.stderr.write(result.stderr)
      process.exit(result.status)
    }

    if (step.quietOnSuccess) console.log(`[quality] ${step.label} passed`)
  }
}

// `full` is 11 mutually-independent read-only checks (no --fix, no git
// writes), so they parallelise without correctness risk. The limiter is
// memory, not CPU: vue-tsc / tsc / vitest x2 / eslint / knip each peak at
// 0.4-1GB and the WSL2 box has ~4GB free, so an unbounded fan-out OOMs.
// Hence a bounded worker pool (default 4, override via
// QUALITY_GATE_CONCURRENCY — an env var, not a new npm script, so the
// 3-script surface is preserved).
//
// Failure semantics (per project decision): the first non-zero step kills
// every still-running sibling and exits immediately — fastest feedback for
// the dev loop. Each child is its own POSIX process group (detached) so the
// kill reaches the npx -> node grandchild, not just the npx shim.
function runParallel() {
  const concurrency = Math.max(
    1,
    parseInt(process.env.QUALITY_GATE_CONCURRENCY || '4', 10) || 4,
  )

  let nextIndex = 0
  let aborted = false
  const running = new Set()

  function killAll() {
    for (const child of running) {
      try {
        if (process.platform === 'win32') child.kill('SIGKILL')
        else process.kill(-child.pid, 'SIGKILL')
      } catch {
        /* already exited */
      }
    }
  }

  function fail(message, status) {
    if (aborted) return
    aborted = true
    console.error(`[quality] ${message}`)
    killAll()
    process.exit(typeof status === 'number' && status !== 0 ? status : 1)
  }

  function launchNext() {
    if (aborted || nextIndex >= steps.length) return
    const step = steps[nextIndex++]
    const startedAt = Date.now()
    console.log(`[quality] start ${step.label}`)

    const child = spawn(resolveExecutable(step.command), step.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      detached: process.platform !== 'win32',
    })

    const chunks = { out: [], err: [] }
    child.stdout.on('data', d => chunks.out.push(d))
    child.stderr.on('data', d => chunks.err.push(d))

    running.add(child)

    child.on('error', err => {
      running.delete(child)
      fail(`Failed to start ${step.label}: ${err.message}`, 1)
    })

    child.on('exit', code => {
      running.delete(child)
      if (aborted) return

      if (code !== 0) {
        process.stdout.write(Buffer.concat(chunks.out))
        process.stderr.write(Buffer.concat(chunks.err))
        fail(`${step.label} failed (exit ${code})`, code)
        return
      }

      console.log(`[quality] ${step.label} passed (${Date.now() - startedAt}ms)`)
      launchNext()
      if (running.size === 0 && nextIndex >= steps.length) {
        console.log('[quality] all steps passed')
        process.exit(0)
      }
    })
  }

  for (let i = 0; i < concurrency && i < steps.length; i += 1) launchNext()
}

if (mode === 'full') runParallel()
else runSequential()
