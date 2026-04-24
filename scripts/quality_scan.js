/**
 * Quality Scan — Compile-time static analysis for recurring bug patterns.
 *
 * Scanners:
 *   1. Timer Leak: setTimeout/setInterval without cleanup tracking
 *   2. Naked Await: await without surrounding try/catch (heuristic)
 *   3. CSS Undefined Vars: var(--xxx) without definition in global.css
 *   4. External Private Access: accessing _prefixed properties from other modules
 *   5. Dangerous Transform: transform (translateZ/perspective) + z-index in same rule
 *   6. Race Timeout: Promise.race with inline timeout but no cleanup
 *   7. Math Random: Math.random() in business code (must use secure_random)
 *   8. Unsafe Cast: as unknown as (use narrower cast or type guard)
 *   9. Eslint Disable: eslint-disable without explanatory comment
 *  10. Todo Fixme: TODO/FIXME comments (warn)
 *  11. File Size: files exceeding line thresholds
 *  12. Function Size: functions exceeding line thresholds
 *  13. Complexity: cyclomatic complexity thresholds
 *
 * Baseline: scripts/quality_baseline.json records known issues.
 * Only NEW violations block the gate.
 *
 * Usage: node scripts/quality_scan.js
 * Exit code: 0 = clean, 1 = violations found
 */

const fs = require('fs')
const path = require('path')
const ts = require('typescript')

// ─── Config ──────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..')
const APP_SRC = path.join(ROOT, 'app/src')
const STYLES_DIR = path.join(APP_SRC, 'styles')

const SEVERITY_ERROR = 2
const SEVERITY_WARN = 1

let errorCount = 0
let warnCount = 0

function report(file, line, severity, scanner, message) {
  const label = severity === SEVERITY_ERROR ? 'ERROR' : 'WARN'
  const rel = path.relative(ROOT, file)
  console.log(`[${label}] ${rel}:${line} [${scanner}] ${message}`)
  if (severity === SEVERITY_ERROR) errorCount++
  else warnCount++
}

// ─── Baseline ────────────────────────────────────────────────────────────

const BASELINE_PATH = path.join(ROOT, 'scripts', 'quality_baseline.json')

function loadBaseline() {
  try {
    const raw = fs.readFileSync(BASELINE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { fileSize: [], functionSize: [], complexity: [] }
  }
}

const baseline = loadBaseline()

function isInBaseline(category, key) {
  return baseline[category]?.includes(key)
}

// ─── File Discovery ──────────────────────────────────────────────────────

function findFiles(dir, exts) {
  const results = []
  function walk(d) {
    for (const entry of fs.readdirSync(d)) {
      const full = path.join(d, entry)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue
        walk(full)
      } else if (stat.isFile() && exts.some(e => full.endsWith(e))) {
        results.push(full)
      }
    }
  }
  walk(dir)
  return results
}

function getLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
}

// ─── 1. Timer Leak Scanner ───────────────────────────────────────────────

/**
 * Flags setTimeout/setInterval calls that are NOT tracked.
 *
 * Whitelist:
 *   - assigned to a variable that is later cleared by clearTimeout in the file
 *   - inside trackTimer() or delay() wrapper
 *   - inside Promise constructor (handled by RaceTimeout scanner)
 *   - in server.ts shutdown handler (intentional force-exit timer)
 */
function scanTimerLeaks(file, content) {
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

  const clearedVars = new Set()
  function collectClears(node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(sourceFile)
      if ((name === 'clearTimeout' || name === 'clearInterval') && node.arguments.length > 0) {
        clearedVars.add(node.arguments[0].getText(sourceFile))
      }
    }
    ts.forEachChild(node, collectClears)
  }
  collectClears(sourceFile)

  function visit(node) {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit)
      return
    }

    const callee = node.expression.getText(sourceFile)
    if (callee !== 'setTimeout' && callee !== 'setInterval') {
      ts.forEachChild(node, visit)
      return
    }

    // Skip if inside Promise constructor
    let parent = node.parent
    while (parent) {
      if (ts.isNewExpression(parent) && parent.expression.getText(sourceFile) === 'Promise') {
        ts.forEachChild(node, visit)
        return
      }
      parent = parent.parent
    }

    // Skip if directly passed to trackTimer / delay
    if (node.parent && ts.isCallExpression(node.parent)) {
      const outer = node.parent.expression.getText(sourceFile)
      if (outer === 'trackTimer' || outer === 'delay') {
        ts.forEachChild(node, visit)
        return
      }
    }

    // Check if assigned to a variable that is later cleared
    let varName = null
    if (node.parent && ts.isVariableDeclaration(node.parent)) {
      varName = node.parent.name.getText(sourceFile)
    } else if (node.parent && ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      varName = node.parent.left.getText(sourceFile)
    }

    if (varName && clearedVars.has(varName)) {
      ts.forEachChild(node, visit)
      return
    }

    // Special case: server.ts shutdown force timer
    if (file.endsWith('server.ts') && node.arguments.length >= 2) {
      const delay = node.arguments[1].getText(sourceFile)
      if (delay.includes('shutdownTimeout') || delay.includes('config.shutdownTimeoutMs')) {
        ts.forEachChild(node, visit)
        return
      }
    }

    report(file, getLine(sourceFile, node), SEVERITY_ERROR, 'TimerLeak',
      `${callee}() without cleanup tracking. ` +
      `Use trackTimer()/delay() wrapper or assign to a var cleared by clearTimeout.`)

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

// ─── 2. Naked Await Scanner ──────────────────────────────────────────────

/**
 * Flags await expressions not inside try/catch.
 * Filters out safe patterns:
 *   - await nextTick(...)  (Vue internal, always resolves)
 *   - await Promise.resolve(...)
 *   - await request(...) in api/ files (API layer convention)
 *   - await delay(...) in orchestrator files
 */
function scanNakedAwait(file, content) {
  // Only scan frontend composables and components where defensive handling matters most.
  // API layer (api/*), stores, and server are excluded by convention.
  if (!file.includes('/composables/') && !file.includes('/components/')) return

  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

  function isInsideTryCatch(node) {
    let n = node
    while (n) {
      if (ts.isTryStatement(n)) {
        const tryBlock = n.tryBlock
        if (tryBlock && node.getStart() >= tryBlock.getStart() && node.getEnd() <= tryBlock.getEnd()) {
          return true
        }
      }
      n = n.parent
    }
    return false
  }

  function isSafePattern(node) {
    const text = node.expression.getText(sourceFile)
    if (text.includes('nextTick')) return true
    if (text.includes('Promise.resolve') || text.includes('Promise.reject')) return true
    return false
  }

  function visit(node) {
    if (node.kind === ts.SyntaxKind.AwaitExpression) {
      if (!isInsideTryCatch(node) && !isSafePattern(node)) {
        report(file, getLine(sourceFile, node), SEVERITY_WARN, 'NakedAwait',
          'await without surrounding try/catch — add defensive error handling.')
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

// ─── 3. CSS Undefined Variable Scanner ───────────────────────────────────

/**
 * Collects CSS custom property definitions from global.css / uni.scss,
 * then scans all .vue / .css / .scss for var(--xxx) without definition.
 *
 * Runtime-whitelist: variables set dynamically via JS (style binding).
 */
function scanCssVariables() {
  const RUNTIME_VARS = new Set([
    '--card-width', '--card-height', '--result-card-lift-y',
    '--card-focus-scale',
  ])

  const definedVars = new Set()

  function extractDefinitions(css) {
    const re = /(--[\w-]+)\s*:/g
    let m
    while ((m = re.exec(css)) !== null) {
      definedVars.add(m[1])
    }
  }

  const globalCssPath = path.join(STYLES_DIR, 'global.css')
  if (fs.existsSync(globalCssPath)) {
    extractDefinitions(fs.readFileSync(globalCssPath, 'utf-8'))
  }
  const uniScssPath = path.join(APP_SRC, 'uni.scss')
  if (fs.existsSync(uniScssPath)) {
    extractDefinitions(fs.readFileSync(uniScssPath, 'utf-8'))
  }

  const cssFiles = findFiles(APP_SRC, ['.vue', '.css', '.scss'])

  for (const file of cssFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    const styleBlocks = []

    if (file.endsWith('.vue')) {
      const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
      let m
      while ((m = styleRe.exec(content)) !== null) {
        styleBlocks.push(m[1])
      }
    } else {
      styleBlocks.push(content)
    }

    for (const block of styleBlocks) {
      const lines = block.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const useRe = /var\((--[\w-]+)(?:\s*,\s*[^)]*)?\)/g
        let m
        while ((m = useRe.exec(line)) !== null) {
          const varName = m[1]
          if (RUNTIME_VARS.has(varName)) continue
          if (!definedVars.has(varName)) {
            const localDefRe = new RegExp(`${varName}\\s*:`)
            const isLocal = styleBlocks.some(b => localDefRe.test(b))
            if (!isLocal) {
              report(file, i + 1, SEVERITY_ERROR, 'CssUndefinedVar',
                `CSS variable ${varName} is used but not defined in global.css or locally.`)
            }
          }
        }
      }
    }
  }
}

// ─── 4. External Private Access Scanner ──────────────────────────────────

/**
 * Flags access to _prefixed properties on IMPORTED objects.
 * Excludes:
 *   - animation/engine/*  (internal engine modules are tightly coupled by design)
 *   - composables/use_animation_state.ts  (defines the state being accessed)
 *   - receiver === 'this'
 */
function scanExternalPrivateAccess(file, content) {
  // Skip animation engine internal files
  if (file.includes('animation/engine')) return
  if (file.includes('use_animation_state.ts')) return

  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

  function visit(node) {
    if (ts.isPropertyAccessExpression(node)) {
      const prop = node.name.getText(sourceFile)
      if (prop.startsWith('_')) {
        const receiver = node.expression.getText(sourceFile)
        if (receiver !== 'this' && /^[a-zA-Z_]\w*$/.test(receiver)) {
          report(file, getLine(sourceFile, node), SEVERITY_WARN, 'ExternalPrivateAccess',
            `Accessing private property "${prop}" on "${receiver}". ` +
            `Use public API or add a getter/setter method.`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

// ─── 5. Dangerous Transform Scanner ──────────────────────────────────────

function scanDangerousTransform() {
  const vueFiles = findFiles(APP_SRC, ['.vue'])

  for (const file of vueFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
    let m
    while ((m = styleRe.exec(content)) !== null) {
      const css = m[1]
      const rules = css.split('}')
      for (const rule of rules) {
        const hasTransform = /transform\s*:\s*[^;]*(?:translateZ|perspective|rotateY|preserve-3d)/i.test(rule)
        const hasZIndex = /z-index\s*:/i.test(rule)
        if (hasTransform && hasZIndex) {
          const beforeRule = css.substring(0, css.indexOf(rule) + 1)
          const line = beforeRule.split('\n').length
          report(file, line, SEVERITY_WARN, 'DangerousTransform',
            'Selector uses both transform (3D) and z-index — may cause compositing layer bugs.')
        }
      }
    }
  }
}

// ─── 6. Promise.race Timeout Scanner ─────────────────────────────────────

function scanRaceTimeout(file, content) {
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'Promise.race') {
      const hasTimeout = node.arguments.some(arg => {
        const text = arg.getText(sourceFile)
        return text.includes('setTimeout')
      })

      if (hasTimeout) {
        const func = (function findFunc(n) {
          while (n) {
            if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return n
            n = n.parent
          }
          return null
        })(node)

        const funcText = func ? func.getText(sourceFile) : content
        const hasClearTimeout = /clearTimeout\s*\(/.test(funcText)
        const hasAbortController = /AbortController|abort/.test(funcText)

        if (!hasClearTimeout && !hasAbortController) {
          report(file, getLine(sourceFile, node), SEVERITY_ERROR, 'RaceTimeoutLeak',
            'Promise.race with inline timeout but no clearTimeout/AbortController cleanup.')
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

// ─── 7. Math Random Scanner ──────────────────────────────────────────────

function scanMathRandom(file, content) {
  if (file.includes('/test/')) return
  const re = /Math\.random\s*\(/g
  let m
  while ((m = re.exec(content)) !== null) {
    const line = content.substring(0, m.index).split('\n').length
    report(file, line, SEVERITY_ERROR, 'MathRandom',
      'Math.random() is forbidden in business code. Use utils/secure_random instead.')
  }
}

// ─── 8. Unsafe Cast Scanner ──────────────────────────────────────────────

function scanUnsafeCast(file, content) {
  if (file.includes('/test/')) return
  if (file.endsWith('.d.ts')) return
  const re = /as\s+unknown\s+as/g
  let m
  while ((m = re.exec(content)) !== null) {
    const line = content.substring(0, m.index).split('\n').length
    report(file, line, SEVERITY_ERROR, 'UnsafeCast',
      '"as unknown as" is forbidden. Use a narrower cast or a type guard.')
  }
}

// ─── 9. Eslint Disable Scanner ───────────────────────────────────────────

function scanEslintDisable(file, content) {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('eslint-disable')) continue
    // Allow eslint-enable (paired blocks)
    if (line.includes('eslint-enable')) continue
    // Must have a reason comment on the same line or previous line
    const prevLine = i > 0 ? lines[i - 1] : ''
    const hasReason = /reason\s*[:：]|because|intentional|safe|H5|mini.?program|standard|pino-http/i.test(line) ||
                      /reason\s*[:：]|because|intentional|safe|H5|mini.?program|standard|pino-http/i.test(prevLine)
    if (!hasReason) {
      report(file, i + 1, SEVERITY_WARN, 'EslintDisable',
        'eslint-disable must include a reason (e.g. "reason: H5-only DOM API").')
    }
  }
}

// ─── 10. Todo/Fixme Scanner ──────────────────────────────────────────────

function scanTodoFixme(file, content) {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const re = /\b(TODO|FIXME|XXX)\b/g
    let m
    while ((m = re.exec(line)) !== null) {
      report(file, i + 1, SEVERITY_WARN, 'TodoFixme',
        `${m[1]} comment found — track in issue tracker or resolve before release.`)
    }
  }
}

// ─── 11. File Size Scanner ───────────────────────────────────────────────

function scanFileSize() {
  const files = findFiles(APP_SRC, ['.ts', '.vue']).concat(findFiles(path.join(ROOT, 'server/src'), ['.ts']))
  for (const file of files) {
    if (file.endsWith('.d.ts')) continue
    const lines = fs.readFileSync(file, 'utf-8').split('\n').length
    const rel = path.relative(ROOT, file)
    const key = `${rel}:${lines}`
    if (lines > 500) {
      if (!isInBaseline('fileSize', key)) {
        report(file, 1, SEVERITY_ERROR, 'FileSize',
          `File has ${lines} lines (max 500). Split into smaller modules.`)
      }
    } else if (lines > 300) {
      if (!isInBaseline('fileSize', key)) {
        report(file, 1, SEVERITY_WARN, 'FileSize',
          `File has ${lines} lines (warn at 300). Consider splitting.`)
      }
    }
  }
}

// ─── 12. Function Size Scanner ───────────────────────────────────────────

function scanFunctionSize(file, content) {
  if (file.endsWith('.d.ts')) return
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

  function countFunctionLines(node) {
    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1
    return endLine - startLine + 1
  }

  function getFuncName(node) {
    if (ts.isFunctionDeclaration(node) && node.name) return node.name.getText(sourceFile)
    if (ts.isMethodDeclaration(node) && node.name) return node.name.getText(sourceFile)
    if (ts.isArrowFunction(node)) {
      const parent = node.parent
      if (ts.isVariableDeclaration(parent) && parent.name) return parent.name.getText(sourceFile)
      if (ts.isPropertyAssignment(parent) && parent.name) return parent.name.getText(sourceFile)
      return '(arrow)'
    }
    if (ts.isFunctionExpression(node)) {
      if (node.name) return node.name.getText(sourceFile)
      const parent = node.parent
      if (ts.isVariableDeclaration(parent) && parent.name) return parent.name.getText(sourceFile)
      return '(function)'
    }
    return '(anonymous)'
  }

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      const funcLines = countFunctionLines(node)
      const funcName = getFuncName(node)
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const rel = path.relative(ROOT, file)
      const key = `${rel}:${line}:${funcName}`

      if (funcLines > 120) {
        if (!isInBaseline('functionSize', key)) {
          report(file, line, SEVERITY_ERROR, 'FunctionSize',
            `Function "${funcName}" has ${funcLines} lines (max 120). Extract sub-functions.`)
        }
      } else if (funcLines > 80) {
        if (!isInBaseline('functionSize', key)) {
          report(file, line, SEVERITY_WARN, 'FunctionSize',
            `Function "${funcName}" has ${funcLines} lines (warn at 80). Consider extracting.`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

// ─── 13. Complexity Scanner ──────────────────────────────────────────────

function scanComplexity(file, content) {
  if (file.endsWith('.d.ts')) return
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

  function countComplexity(node) {
    let score = 1
    function walk(n) {
      if (
        ts.isIfStatement(n) ||
        ts.isConditionalExpression(n) ||
        ts.isSwitchStatement(n) ||
        ts.isCaseClause(n) ||
        ts.isForStatement(n) ||
        ts.isForInStatement(n) ||
        ts.isForOfStatement(n) ||
        ts.isWhileStatement(n) ||
        ts.isDoStatement(n) ||
        ts.isCatchClause(n)
      ) {
        score += 1
      }
      ts.forEachChild(n, walk)
    }
    walk(node)
    return score
  }

  function getFuncName(node) {
    if (ts.isFunctionDeclaration(node) && node.name) return node.name.getText(sourceFile)
    if (ts.isMethodDeclaration(node) && node.name) return node.name.getText(sourceFile)
    if (ts.isArrowFunction(node)) {
      const parent = node.parent
      if (ts.isVariableDeclaration(parent) && parent.name) return parent.name.getText(sourceFile)
      if (ts.isPropertyAssignment(parent) && parent.name) return parent.name.getText(sourceFile)
      return '(arrow)'
    }
    if (ts.isFunctionExpression(node)) {
      if (node.name) return node.name.getText(sourceFile)
      const parent = node.parent
      if (ts.isVariableDeclaration(parent) && parent.name) return parent.name.getText(sourceFile)
      return '(function)'
    }
    return '(anonymous)'
  }

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      const score = countComplexity(node)
      const funcName = getFuncName(node)
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const rel = path.relative(ROOT, file)
      const key = `${rel}:${line}:${funcName}`

      if (score > 15) {
        if (!isInBaseline('complexity', key)) {
          report(file, line, SEVERITY_ERROR, 'Complexity',
            `Function "${funcName}" complexity is ${score} (max 15). Refactor into smaller functions.`)
        }
      } else if (score > 10) {
        if (!isInBaseline('complexity', key)) {
          report(file, line, SEVERITY_WARN, 'Complexity',
            `Function "${funcName}" complexity is ${score} (warn at 10). Consider simplifying.`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

// ─── Main ────────────────────────────────────────────────────────────────

console.log('[quality-scan] Starting static analysis...\n')

const tsFiles = findFiles(APP_SRC, ['.ts']).concat(findFiles(path.join(ROOT, 'server/src'), ['.ts']))
const vueFiles = findFiles(APP_SRC, ['.vue'])

for (const file of tsFiles) {
  const content = fs.readFileSync(file, 'utf-8')
  scanTimerLeaks(file, content)
  scanNakedAwait(file, content)
  scanExternalPrivateAccess(file, content)
  scanRaceTimeout(file, content)
  scanMathRandom(file, content)
  scanUnsafeCast(file, content)
  scanEslintDisable(file, content)
  scanTodoFixme(file, content)
  scanFunctionSize(file, content)
  scanComplexity(file, content)
}

for (const file of vueFiles) {
  const content = fs.readFileSync(file, 'utf-8')
  scanEslintDisable(file, content)
  scanTodoFixme(file, content)
}

scanCssVariables()
scanDangerousTransform()
scanFileSize()

console.log('')
console.log(`[quality-scan] ${errorCount} errors, ${warnCount} warnings`)

if (errorCount > 0) {
  process.exit(1)
}
process.exit(0)
