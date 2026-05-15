/**
 * Performance Baseline Gate — bundle-size regression check.
 *
 * Runs after the prod h5 build. Measures total `dist/build/h5/` size plus the
 * top 10 largest individual files, and compares each entry against the
 * committed baseline at `scripts/perf_baseline.json`. Single-file or total
 * size growth > thresholds.regressPercent (default 10%) fails the gate.
 *
 * Decreases and additions are allowed silently — they only print warnings.
 *
 * Usage:
 *   node scripts/perf_baseline_gate.js                  # compare (default)
 *   node scripts/perf_baseline_gate.js --update-baseline   # rewrite baseline
 *
 * The baseline file LIVES IN GIT (committed, not gitignored). Without that,
 * each CI run starts from a blank slate and there is no contract to compare
 * against — the previous design wrote to reports/perf_baseline.json, which
 * was gitignored, so the "compare" path could never trigger meaningfully.
 *
 * If the baseline file is missing, it is auto-created from the current build
 * and the gate passes with a warning telling the operator to commit it.
 */

'use strict'

const { existsSync, readFileSync, writeFileSync, statSync, readdirSync } = require('fs')
const { join, relative } = require('path')

const REPO_ROOT = join(__dirname, '..')
const BUILD_DIR = join(REPO_ROOT, 'dist', 'build', 'h5')
const BUILD_DIR_REL = 'dist/build/h5'
const BASELINE_PATH = join(__dirname, 'perf_baseline.json')
const TOTAL_KEY = `${BUILD_DIR_REL}/total`
const TOP_N = 10
const DEFAULT_THRESHOLD_PERCENT = 10
const BASELINE_SCHEMA_VERSION = 1

// ── filesystem helpers ────────────────────────────────────────────────────

/**
 * Recursively walk a directory and return [{ path, bytes }] for every file.
 * Symlinks are skipped — we only care about real bundle bytes.
 */
function walk(dir) {
  const out = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile()) {
        try {
          const { size } = statSync(full)
          out.push({ path: full, bytes: size })
        } catch {
          // race / permission — skip
        }
      }
    }
  }
  return out
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return `${bytes}B`
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

// ── measurement ───────────────────────────────────────────────────────────

/**
 * Returns { entries, totalBytes } where entries is a flat object keyed by
 * relative path:
 *   {
 *     "dist/build/h5/total":            { bytes },
 *     "dist/build/h5/static/js/x.js":   { bytes },
 *     ... up to TOP_N largest files
 *   }
 *
 * Returns null if the build directory is missing — that signals "build did
 * not run" and the caller should hard-fail.
 */
function measure() {
  if (!existsSync(BUILD_DIR)) return null
  const files = walk(BUILD_DIR)
  if (files.length === 0) return null

  const totalBytes = files.reduce((acc, f) => acc + f.bytes, 0)
  files.sort((a, b) => b.bytes - a.bytes)
  const top = files.slice(0, TOP_N)

  const entries = { [TOTAL_KEY]: { bytes: totalBytes } }
  for (const f of top) {
    const rel = `${BUILD_DIR_REL}/${relative(BUILD_DIR, f.path).split(require('path').sep).join('/')}`
    entries[rel] = { bytes: f.bytes }
  }
  return { entries, totalBytes }
}

// ── baseline I/O ──────────────────────────────────────────────────────────

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    if (raw && typeof raw === 'object' && raw.entries && typeof raw.entries === 'object') {
      return raw
    }
    console.error('[perf] scripts/perf_baseline.json is malformed (missing entries map). Run with --update-baseline to rewrite.')
    return null
  } catch (err) {
    console.error(`[perf] Failed to parse scripts/perf_baseline.json: ${err.message}`)
    return null
  }
}

function writeBaseline(measurement) {
  const data = {
    version: BASELINE_SCHEMA_VERSION,
    lastUpdated: new Date().toISOString().slice(0, 10),
    thresholds: { regressPercent: DEFAULT_THRESHOLD_PERCENT },
    entries: measurement.entries,
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

// ── modes ─────────────────────────────────────────────────────────────────

function modeUpdateBaseline() {
  const measurement = measure()
  if (!measurement) {
    console.error(`[perf] Build directory ${BUILD_DIR_REL} is empty or missing. 请先跑 npm run prod 再更新基线。`)
    process.exit(1)
  }
  writeBaseline(measurement)
  const total = measurement.entries[TOTAL_KEY].bytes
  console.log(`[perf] 已写入新基线 ${BASELINE_PATH}`)
  console.log(`[perf]   总大小 ${formatBytes(total)}，记录了 top ${TOP_N} 大文件`)
  console.log('[perf] 请记得 git add scripts/perf_baseline.json 并 commit。')
}

function modeCompare() {
  const measurement = measure()
  if (!measurement) {
    console.error(`[perf] Build directory ${BUILD_DIR_REL} 不存在或为空 — perf 检查必须在 build 之后运行。`)
    process.exit(1)
  }

  const baseline = loadBaseline()
  if (!baseline) {
    // First run — seed and pass with a warning.
    writeBaseline(measurement)
    const total = measurement.entries[TOTAL_KEY].bytes
    console.warn(`[perf] WARN: 未找到 scripts/perf_baseline.json，已基于当前构建生成首次基线（总大小 ${formatBytes(total)}）。`)
    console.warn('[perf] 请 git add scripts/perf_baseline.json 并 commit，否则下次构建仍会重新生成。')
    return
  }

  const thresholdPercent =
    (baseline.thresholds && Number(baseline.thresholds.regressPercent)) || DEFAULT_THRESHOLD_PERCENT
  const thresholdRatio = 1 + thresholdPercent / 100

  const failures = []
  const warnings = []

  for (const [key, baseEntry] of Object.entries(baseline.entries)) {
    const baseBytes = Number(baseEntry.bytes) || 0
    const current = measurement.entries[key]
    if (!current) {
      warnings.push(`${key}: 基线存在但当前构建未产出（可能是文件改名或被 chunk 拆分）。`)
      continue
    }
    const curBytes = current.bytes
    if (baseBytes > 0 && curBytes > baseBytes * thresholdRatio) {
      const deltaPercent = ((curBytes - baseBytes) / baseBytes) * 100
      failures.push(
        `${key} 从 ${formatBytes(baseBytes)} 涨到 ${formatBytes(curBytes)} (+${deltaPercent.toFixed(1)}%) 超过 ${thresholdPercent}% 阈值`,
      )
    }
  }

  // Inform about new top entries that weren't in the baseline (not a failure).
  for (const key of Object.keys(measurement.entries)) {
    if (!baseline.entries[key]) {
      warnings.push(`${key}: 新进入 top ${TOP_N} (${formatBytes(measurement.entries[key].bytes)})。`)
    }
  }

  if (warnings.length) {
    for (const w of warnings) console.warn(`[perf] WARN ${w}`)
  }

  if (failures.length) {
    console.error('[perf] FAIL: 包体积回归超过阈值')
    for (const f of failures) console.error(`[perf]   - ${f}`)
    console.error('')
    console.error('[perf] 如果这是预期变化，跑 `node scripts/perf_baseline_gate.js --update-baseline` 更新基线，然后 commit scripts/perf_baseline.json。')
    process.exit(1)
  }

  const total = measurement.entries[TOTAL_KEY].bytes
  const baseTotal = (baseline.entries[TOTAL_KEY] && baseline.entries[TOTAL_KEY].bytes) || 0
  const delta = baseTotal ? (((total - baseTotal) / baseTotal) * 100).toFixed(1) : '0.0'
  console.log(`[perf] PASS  总大小 ${formatBytes(total)} (基线 ${formatBytes(baseTotal)}, Δ ${delta}%)`)
}

// ── entry ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
if (argv.includes('--update-baseline')) {
  modeUpdateBaseline()
} else {
  modeCompare()
}
