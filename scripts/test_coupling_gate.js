/**
 * Test Coupling Gate — ensures core logic changes are accompanied by test changes.
 *
 * Risk directories:
 *   - app/src/composables
 *   - app/src/animation
 *   - app/src/reading
 *   - server/src/routes
 *
 * Rule: if any risk directory is modified, at least one test file must also be modified.
 *
 * Usage:
 *   node scripts/test_coupling_gate.js
 *   BASE_BRANCH=main node scripts/test_coupling_gate.js
 */

const { execSync } = require('child_process')

const BASE_BRANCH = process.env.BASE_BRANCH || 'main'

const RISK_PATHS = [
  'app/src/composables',
  'app/src/animation',
  'app/src/reading',
  'server/src/routes',
]

function getChangedFiles() {
  try {
    const output = execSync(`git diff --name-only ${BASE_BRANCH}...HEAD`, { encoding: 'utf-8' })
    return output.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

const files = getChangedFiles()
if (files.length === 0) {
  console.log('[test-coupling] No changed files, skipping')
  process.exit(0)
}

const riskChanged = RISK_PATHS.some(rp => files.some(f => f.startsWith(rp)))
const testChanged = files.some(f => f.startsWith('test/'))

if (riskChanged && !testChanged) {
  console.error(
    '[test-coupling] ERROR: Core logic changed but no tests modified. ' +
    'Add or update tests for the changed modules.'
  )
  process.exit(1)
}

console.log('[test-coupling] OK')
