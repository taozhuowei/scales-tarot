/**
 * PR Size Gate — blocks oversized PRs.
 *
 * Thresholds:
 *   - warn: 500 lines added
 *   - error: 1000 lines added
 *
 * Usage:
 *   node scripts/pr_size_gate.js
 *   BASE_BRANCH=main node scripts/pr_size_gate.js
 */

const { execSync } = require('child_process')

const BASE_BRANCH = process.env.BASE_BRANCH || 'main'
const WARN_THRESHOLD = 500
const ERROR_THRESHOLD = 1000

function getDiffStats() {
  try {
    const output = execSync(`git diff --numstat ${BASE_BRANCH}...HEAD`, { encoding: 'utf-8' })
    const lines = output.trim().split('\n').filter(Boolean)
    let added = 0
    let removed = 0
    for (const line of lines) {
      const [a, r] = line.split('\t')
      added += parseInt(a, 10) || 0
      removed += parseInt(r, 10) || 0
    }
    return { added, removed, total: added + removed }
  } catch {
    return null
  }
}

const stats = getDiffStats()
if (!stats) {
  console.log(`[pr-size] Base branch "${BASE_BRANCH}" not found, skipping`)
  process.exit(0)
}

console.log(`[pr-size] Diff against ${BASE_BRANCH}: +${stats.added} -${stats.removed}`)

if (stats.added > ERROR_THRESHOLD) {
  console.error(
    `[pr-size] ERROR: Added ${stats.added} lines exceeds limit of ${ERROR_THRESHOLD}. Split the PR into smaller chunks.`
  )
  process.exit(1)
}
if (stats.added > WARN_THRESHOLD) {
  console.warn(
    `[pr-size] WARN: Added ${stats.added} lines exceeds warning threshold of ${WARN_THRESHOLD}. Consider splitting.`
  )
}
console.log('[pr-size] OK')
