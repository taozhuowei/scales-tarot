const { spawnSync } = require('child_process')

const mode = process.argv[2] || 'full'

const stepsByMode = {
  full: [
    { label: 'lint', command: 'npm', args: ['run', 'quality:lint'] },
    { label: 'type-check', command: 'npm', args: ['run', 'quality:type-check'] },
    { label: 'test', command: 'npm', args: ['run', 'quality:test'] },
    { label: 'build:h5', command: 'npm', args: ['run', 'quality:build:h5'] },
    { label: 'audit', command: 'npm', args: ['run', 'quality:audit'] },
    { label: 'arch:check', command: 'npm', args: ['run', 'arch:check'] },
  ],
  staged: [
    { label: 'lint:fix', command: 'npm', args: ['run', 'quality:lint:fix'] },
    { label: 'type-check', command: 'npm', args: ['run', 'quality:type-check'] },
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
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    console.error(`[quality] Failed to start ${step.label}: ${result.error.message}`)
    process.exit(1)
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}
