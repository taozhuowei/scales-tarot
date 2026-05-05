/**
 * PR Size Gate — blocks oversized PRs.
 *
 * Thresholds:
 *   - warn: 500 lines added
 *   - error: 1500 lines added
 *
 * Why 1500 (not 1000): occasional architecture refactors that span many
 * files (e.g. unifying two view trees into one shared component) legitimately
 * land 1000-1500 human-authored lines in a single PR. The 500 WARN still
 * nudges contributors toward small PRs as the default; 1500 ERROR is the
 * "you really need to think about whether this should be split" line.
 *
 * Excluded from the count:
 *   - Lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml,
 *     npm-shrinkwrap.json). These files are machine-generated; a single
 *     transitive dep update or a CVE override regen can churn ~1000 lines
 *     without any human-authored change. Counting them as PR size noise
 *     blocks legitimate small PRs that happen to ride alongside a lock
 *     refresh. Industry standard: lock files are tracked in git for
 *     reproducibility but do NOT count toward review burden.
 *
 * Usage:
 *   node scripts/pr_size_gate.js
 *   BASE_BRANCH=main node scripts/pr_size_gate.js
 */

const { execSync } = require('child_process')

const BASE_BRANCH = process.env.BASE_BRANCH || 'main'
const WARN_THRESHOLD = 500
const ERROR_THRESHOLD = 1500

/** Path basenames excluded from the PR size accounting. Match against
 *  the FULL path returned by `git diff --numstat` so a lockfile inside
 *  any sub-directory (e.g. nested workspace, vendored fixture) is also
 *  excluded — yarn/npm regen is noise wherever it lives. */
const EXCLUDED_BASENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
])

function isExcluded(filePath) {
  // numstat path is forward-slash on every platform; basename is the
  // segment after the final slash (or the whole path if there's no slash).
  const idx = filePath.lastIndexOf('/')
  const base = idx >= 0 ? filePath.slice(idx + 1) : filePath
  return EXCLUDED_BASENAMES.has(base)
}

function getDiffStats() {
  try {
    const output = execSync(`git diff --numstat ${BASE_BRANCH}...HEAD`, { encoding: 'utf-8' })
    const lines = output.trim().split('\n').filter(Boolean)
    let added = 0
    let removed = 0
    let excludedAdded = 0
    let excludedRemoved = 0
    for (const line of lines) {
      // numstat format: "<added>\t<removed>\t<path>"
      // For binary files added/removed are "-"; parseInt yields NaN → 0.
      const parts = line.split('\t')
      const a = parseInt(parts[0], 10) || 0
      const r = parseInt(parts[1], 10) || 0
      const path = parts.slice(2).join('\t')
      if (isExcluded(path)) {
        excludedAdded += a
        excludedRemoved += r
        continue
      }
      added += a
      removed += r
    }
    return {
      added,
      removed,
      total: added + removed,
      excludedAdded,
      excludedRemoved,
    }
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
if (stats.excludedAdded || stats.excludedRemoved) {
  console.log(
    `[pr-size]   (excluded lockfiles: +${stats.excludedAdded} -${stats.excludedRemoved})`,
  )
}

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
