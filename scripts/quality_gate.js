const { spawnSync } = require('child_process')

const mode = process.argv[2] || 'full'

// All step commands are inlined here (not delegated to `npm run …`) because
// the public npm script surface was collapsed to 6 entries (prepare / build /
// build:dev / test / quality / ship). The previous fan-out scripts (lint,
// quality:lint, quality:type-check, quality:audit, arch:check, quality:lint:fix)
// were removed; their commands now live in this file as the single source of
// truth for what the quality gate runs.
const stepsByMode = {
  // The full gate is now pure code-checks (~30s):
  //   lint, type-check, unit tests, audit, arch + dead/duplicate code.
  // build (h5/mp/server) and the SPA-boot smoke run live in
  // scripts/build/prod.js — they are part of the build pipeline, not
  // the quality contract. CI runs both: `verify` job calls
  // `npm run quality` (this file) and `e2e` job calls the build
  // orchestrator with --skip-quality.
  full: [
    { label: 'quality-scan', command: 'node', args: ['scripts/quality_scan.js'] },
    { label: 'pr-size', command: 'node', args: ['scripts/pr_size_gate.js'] },
    { label: 'test-coupling', command: 'node', args: ['scripts/test_coupling_gate.js'] },
    { label: 'lint', command: 'npx', args: ['eslint', 'app/src/', 'server/src/', 'test/'] },
    // type-check is two compilers: vue-tsc for the Vue app, tsc for the
    // server. Run sequentially as separate steps so failures point at the
    // right tsconfig.
    { label: 'type-check:app', command: 'npx', args: ['vue-tsc', '--noEmit', '-p', 'app/tsconfig.json'] },
    { label: 'type-check:server', command: 'npx', args: ['tsc', '--noEmit', '-p', 'server/tsconfig.json'] },
    { label: 'test', command: 'npm', args: ['run', 'test', '-w', 'test'] },
    { label: 'perf-baseline', command: 'node', args: ['scripts/perf_baseline_gate.js'] },
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
      args: ['depcruise', 'app/src', 'server/src', 'test', '--config', '.dependency-cruiser.js'],
    },
    // Project-wide dead-code detection (knip): unused files, exports,
    // dependencies, class members. Quiet-on-success because the warning
    // output is verbose; on failure (any new dead code) it prints fully.
    {
      label: 'dead-code',
      command: 'npx',
      args: ['knip', '--no-progress'],
      quietOnSuccess: true,
    },
    // Cross-file copy-paste detection (jscpd): finds duplicate code blocks
    // ≥ 8 lines / 60 tokens. Threshold 5% — fails the gate if more than 5%
    // of the codebase is duplicated.
    {
      label: 'duplicate-code',
      command: 'npx',
      args: ['jscpd', 'app/src', 'server/src', '--silent'],
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
    { label: 'quality-scan', command: 'node', args: ['scripts/quality_scan.js'] },
    {
      label: 'lint:fix',
      command: 'npx',
      args: ['eslint', '--fix', '--cache', 'app/src/', 'server/src/', 'test/'],
    },
    { label: 'git add', command: 'git', args: ['add', '-u'] },
  ],
}

const steps = stepsByMode[mode]

if (!steps) {
  console.error(`[quality] Unsupported mode: ${mode}`)
  process.exit(1)
}

for (const step of steps) {
  console.log(`[quality] Running ${step.label}`)

  const executable =
    process.platform === 'win32' && step.command === 'npm'
      ? 'npm.cmd'
      : step.command

  const result = spawnSync(executable, step.args, {
    stdio: step.quietOnSuccess ? 'pipe' : 'inherit',
    env: process.env,
    encoding: 'utf-8',
  })

  if (result.error) {
    console.error(`[quality] Failed to start ${step.label}: ${result.error.message}`)
    process.exit(1)
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    if (step.quietOnSuccess && result.stdout) {
      process.stdout.write(result.stdout)
    }
    if (step.quietOnSuccess && result.stderr) {
      process.stderr.write(result.stderr)
    }
    process.exit(result.status)
  }

  if (step.quietOnSuccess) {
    console.log(`[quality] ${step.label} passed`)
  }
}
