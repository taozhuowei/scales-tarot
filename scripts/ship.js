/**
 * ship.js — One-command PR workflow for scales-tarot.
 *
 * Two modes:
 *
 *   npm run ship "feat: did the thing"   # Mode A: branch from main, 1 commit, push, PR, auto-merge
 *   npm run ship                         # Mode B: take current branch's existing commits, push, PR, auto-merge
 *
 * Mode A flow (message argument provided):
 *   1. Must be on main, with staged changes (git diff --cached non-empty)
 *   2. git pull --ff-only origin main
 *   3. Generate branch name from message: <type>/<kebab-cased-rest>, max 40 chars
 *   4. git switch -c <branch>
 *   5. git commit -m <message>            (commit-msg hook validates conventional format)
 *   6. git push -u origin <branch>        (pre-push hook runs `npm run quality`)
 *   7. gh pr create --fill
 *   8. gh pr merge --auto --rebase --delete-branch
 *   9. git switch main
 *
 * Mode B flow (no argument):
 *   1. Must NOT be on main; current branch must have >= 1 commit ahead of origin/main
 *   2. Working tree must be clean
 *   3. git push (or push -u on first push)
 *   4. gh pr create --fill
 *   5. gh pr merge --auto --rebase --delete-branch
 *   6. git switch main
 *
 * All errors are reported in Chinese with concrete remediation commands.
 *
 * Constraints:
 *   - Cross-platform (uses spawnSync, no shell pipes)
 *   - Never passes --no-verify or other hook-bypass flags
 *   - Owner/repo are auto-detected by gh
 *   - Non-zero exit on any failure
 */

const { spawnSync } = require('child_process')

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

// Conventional commit types accepted by @commitlint/config-conventional.
// Kept in sync with commitlint.config.js (extends config-conventional).
const VALID_COMMIT_TYPES = [
  'feat',
  'fix',
  'refactor',
  'chore',
  'docs',
  'style',
  'test',
  'perf',
  'build',
  'ci',
  'revert',
]

const MAIN_BRANCH = 'main'
const BRANCH_NAME_MAX_LEN = 40

// ────────────────────────────────────────────────────────────────────────────
// Output helpers — keep emoji noise to ❌ ✅ 💡 ⚠️ only
// ────────────────────────────────────────────────────────────────────────────

function fail(message, hint) {
  process.stderr.write(`\n❌ ${message}\n`)
  if (hint) {
    process.stderr.write(`💡 ${hint}\n`)
  }
  process.stderr.write('\n')
  process.exit(1)
}

function info(message) {
  process.stdout.write(`\n${message}\n`)
}

function ok(message) {
  process.stdout.write(`\n✅ ${message}\n`)
}

function warn(message) {
  process.stdout.write(`\n⚠️  ${message}\n`)
}

// ────────────────────────────────────────────────────────────────────────────
// Subprocess helpers — stdio inherited so users see raw tool output;
// our Chinese diagnosis is appended afterwards for clarity.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run a command and return the captured result (no inherit).
 * Use for inspection/state queries where we need stdout as a string.
 */
function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' })
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error,
  }
}

/**
 * Run a command with inherited stdio so the user sees real-time tool output.
 * Returns the exit status. Used for git push, gh pr create, etc.
 */
function runInherit(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' })
  return result.status
}

// ────────────────────────────────────────────────────────────────────────────
// Pre-flight environment checks
// ────────────────────────────────────────────────────────────────────────────

function ensureGitRepo() {
  const r = runCapture('git', ['rev-parse', '--is-inside-work-tree'])
  if (r.status !== 0 || r.stdout !== 'true') {
    fail('当前目录不是 git 仓库。', 'cd 到项目根目录（含 .git/ 的目录）后重试。')
  }
}

function ensureGhAvailable() {
  const r = runCapture('gh', ['--version'])
  if (r.status !== 0 || r.error) {
    fail(
      'GitHub CLI (gh) 未安装或未在 PATH 中。',
      '安装地址：https://cli.github.com\n   安装后运行：gh auth login',
    )
  }
  const auth = runCapture('gh', ['auth', 'status'])
  if (auth.status !== 0) {
    fail('GitHub CLI 未登录。', '运行：gh auth login')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Git state probes
// ────────────────────────────────────────────────────────────────────────────

function getCurrentBranch() {
  const r = runCapture('git', ['branch', '--show-current'])
  if (r.status !== 0) {
    fail('无法读取当前分支。', '检查仓库是否处于 detached HEAD 或 rebase 中。')
  }
  return r.stdout
}

function hasStagedChanges() {
  // --quiet exits 1 if there are differences, 0 if none
  const r = runCapture('git', ['diff', '--cached', '--quiet'])
  return r.status === 1
}

function isWorktreeClean() {
  const r = runCapture('git', ['status', '--porcelain'])
  return r.status === 0 && r.stdout === ''
}

function branchExists(name) {
  const r = runCapture('git', ['show-ref', '--verify', '--quiet', `refs/heads/${name}`])
  return r.status === 0
}

function fetchOrigin() {
  // Quiet fetch — we only need refs to compare. Failure is non-fatal here
  // because pull/push later will produce the actionable error.
  runCapture('git', ['fetch', 'origin', MAIN_BRANCH, '--quiet'])
}

function commitsAheadOf(base, head) {
  // Returns count of commits in `head` not in `base`.
  // Returns -1 on any failure or unparseable output, so callers can give a
  // precise diagnostic instead of conflating "command failed" with "0 commits".
  const r = runCapture('git', ['rev-list', '--count', `${base}..${head}`])
  if (r.status !== 0) return -1
  if (!r.stdout) return -1
  const parsed = Number.parseInt(r.stdout, 10)
  if (Number.isNaN(parsed)) return -1
  return parsed
}

function remoteBranchExists(name) {
  const r = runCapture('git', ['ls-remote', '--exit-code', '--heads', 'origin', name])
  return r.status === 0
}

// ────────────────────────────────────────────────────────────────────────────
// Branch name generation (Mode A)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert "feat(scope): subject text" → { type: 'feat', subject: 'subject text' }.
 * Throws via fail() if the message doesn't start with `<type>:` or `<type>(scope):`.
 */
function parseCommitMessage(message) {
  // Match: type, optional (scope), required colon, required space, subject
  const match = message.match(/^([a-zA-Z]+)(?:\([^)]*\))?:\s+(.+)$/)
  if (!match) {
    fail(
      'commit message 格式不合规，必须形如 "type: subject" 或 "type(scope): subject"。',
      `当前 message: "${message}"\n   合法 type 列表：${VALID_COMMIT_TYPES.join(' / ')}\n   示例：feat: add ship script`,
    )
  }
  const type = match[1].toLowerCase()
  const subject = match[2].trim()
  if (!VALID_COMMIT_TYPES.includes(type)) {
    fail(
      `commit type "${type}" 不被识别。`,
      `合法 type 列表：${VALID_COMMIT_TYPES.join(' / ')}`,
    )
  }
  if (!subject) {
    fail('commit message 缺少 subject。', '示例：feat: add ship script')
  }
  return { type, subject }
}

/**
 * Build a kebab-case branch slug from a commit message.
 *   "feat(devtools): compact handle to 40px" → "feat/devtools-compact-handle-to-40px"
 * Note: scope is intentionally dropped per spec (no `feat(scope)/...` prefix);
 *       subject alone drives the slug after the `<type>/` prefix.
 *
 * The slug is built by: lowercase → replace non [a-z0-9-] with `-` →
 *   collapse runs of `-` → trim leading/trailing `-` → cut to 40 chars.
 */
function generateBranchName(type, subject) {
  let slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) {
    fail(
      '无法从 commit subject 生成有效的分支名（subject 中无可用字符）。',
      '换一个含字母或数字的 subject。',
    )
  }

  // Total length cap includes "<type>/" prefix
  const prefix = `${type}/`
  const maxSlug = BRANCH_NAME_MAX_LEN - prefix.length
  if (maxSlug <= 0) {
    fail('分支前缀过长，无法生成分支名。', '检查 BRANCH_NAME_MAX_LEN 配置。')
  }
  if (slug.length > maxSlug) {
    slug = slug.slice(0, maxSlug).replace(/-+$/, '')
  }
  return prefix + slug
}

// ────────────────────────────────────────────────────────────────────────────
// Mode A: branch + commit + push + PR + auto-merge
// ────────────────────────────────────────────────────────────────────────────

function modeA(message) {
  const current = getCurrentBranch()
  if (current !== MAIN_BRANCH) {
    fail(
      `Mode A 要求从 ${MAIN_BRANCH} 拉新分支，你当前在 ${current}。`,
      `先切回 main：git switch ${MAIN_BRANCH} && git pull\n   或不传 message 参数，用 Mode B 直接推当前分支：npm run ship`,
    )
  }

  if (!hasStagedChanges()) {
    fail(
      '工作树没有 staged 改动，Mode A 至少需要一个 staged 文件来产生 commit。',
      '先 git add <files>，再运行 npm run ship "<message>"。\n   想看哪些改了：git status',
    )
  }

  const { type, subject } = parseCommitMessage(message)
  const branch = generateBranchName(type, subject)

  if (branchExists(branch)) {
    fail(
      `本地分支 ${branch} 已存在。`,
      `删除旧分支：git branch -D ${branch}\n   或换一个 commit subject 让分支名不同。`,
    )
  }

  // Step 1: pull main fast-forward
  info(`[1/7] 同步 ${MAIN_BRANCH}：git pull --ff-only origin ${MAIN_BRANCH}`)
  const pullStatus = runInherit('git', ['pull', '--ff-only', 'origin', MAIN_BRANCH])
  if (pullStatus !== 0) {
    fail(
      `git pull --ff-only 失败：本地 ${MAIN_BRANCH} 与远端分叉，无法 fast-forward。`,
      `查看本地多了什么：git log --oneline origin/${MAIN_BRANCH}..${MAIN_BRANCH}\n   要么 git push 推上去，要么 git reset --hard origin/${MAIN_BRANCH} 丢弃本地差异。\n   若是 rebase 冲突：解冲突 → git add → git rebase --continue（放弃用 git rebase --abort）。`,
    )
  }

  // Step 2: switch to new branch
  info(`[2/7] 创建分支：git switch -c ${branch}`)
  const switchStatus = runInherit('git', ['switch', '-c', branch])
  if (switchStatus !== 0) {
    fail(`无法创建分支 ${branch}。`, '查看上方 git 错误输出。')
  }

  // Step 3: commit (commit-msg hook will validate via commitlint)
  info(`[3/7] 提交：git commit -m "${message}"`)
  const commitStatus = runInherit('git', ['commit', '-m', message])
  if (commitStatus !== 0) {
    // Most likely cause: commitlint rejected the message format
    fail(
      'git commit 失败，可能 commit-msg hook (commitlint) 拒绝了 message。',
      `用规范前缀：${VALID_COMMIT_TYPES.join(' / ')}\n   subject 须 ≤ 100 字符且不以句号结尾。\n   分支已切换至 ${branch}，可重新 commit 后再运行 npm run ship。`,
    )
  }

  // Step 4: push (pre-push hook runs `npm run quality`)
  info(`[4/7] 推送（含 pre-push 质量门禁，会比较慢）：git push -u origin ${branch}`)
  const pushStatus = runInherit('git', ['push', '-u', 'origin', branch])
  if (pushStatus !== 0) {
    fail(
      'git push 失败，pre-push hook (npm run quality) 可能未通过。',
      '看上面 quality 输出，定位失败步骤后修复。\n   修完重跑：npm run ship（已在工作分支，会走 Mode B）。\n   不推荐的绕过方式：SKIP_SIMPLE_GIT_HOOKS=1 npm run ship',
    )
  }

  // Step 5 + 6: PR + auto-merge (steps 5 and 6 of 7)
  createAndAutoMergePR(branch, 5, 7)

  // Step 7: back to main
  info(`[7/7] 切回 ${MAIN_BRANCH}：git switch ${MAIN_BRANCH}`)
  const backStatus = runInherit('git', ['switch', MAIN_BRANCH])
  if (backStatus !== 0) {
    warn(`切回 ${MAIN_BRANCH} 失败，但 PR 已创建并启用 auto-merge。手动：git switch ${MAIN_BRANCH}`)
  }

  ok('Mode A 完成。GitHub 会在 CI 全绿后自动 rebase-merge 并删除远端分支。')
}

// ────────────────────────────────────────────────────────────────────────────
// Mode B: push current branch + PR + auto-merge
// ────────────────────────────────────────────────────────────────────────────

function modeB() {
  const current = getCurrentBranch()
  if (current === MAIN_BRANCH) {
    fail(
      `Mode B 要求在工作分支，你当前在 ${MAIN_BRANCH}。`,
      `先切到工作分支：git switch -c feat/xxx\n   或用 Mode A 一步到位：npm run ship "feat: 你的改动描述"`,
    )
  }
  if (!current) {
    fail('当前处于 detached HEAD 状态，无法推送。', '先 git switch <branch> 或 git switch -c <new-branch>。')
  }

  if (!isWorktreeClean()) {
    fail(
      '工作树有未提交的改动，Mode B 不知道要带上还是忽略。',
      '想带上：git add . && git commit -m "..."\n   想暂存：git stash\n   想丢弃：git restore .（注意：会丢失改动）\n   然后重跑：npm run ship',
    )
  }

  fetchOrigin()
  const ahead = commitsAheadOf(`origin/${MAIN_BRANCH}`, 'HEAD')
  if (ahead < 0) {
    fail(
      `无法获取当前分支与 origin/${MAIN_BRANCH} 的 diff（git rev-list 失败或返回空）。`,
      `常见原因：本地缺少 origin/${MAIN_BRANCH} 引用，或 remote 配置异常。\n   先确认 remote：git remote -v\n   再拉一次 ref：git fetch origin ${MAIN_BRANCH}\n   修好后重跑：npm run ship`,
    )
  }
  if (ahead === 0) {
    fail(
      `当前分支 ${current} 没有领先 origin/${MAIN_BRANCH} 的 commit，PR 会是空的。`,
      `先做改动 → git commit → 再跑 npm run ship。\n   想直接走 Mode A：git switch ${MAIN_BRANCH} && npm run ship "<message>"`,
    )
  }

  // Push: -u on first push, plain push otherwise
  const remoteExists = remoteBranchExists(current)
  const pushArgs = remoteExists ? ['push'] : ['push', '-u', 'origin', current]
  info(`[1/4] 推送（含 pre-push 质量门禁，会比较慢）：git ${pushArgs.join(' ')}`)
  const pushStatus = runInherit('git', pushArgs)
  if (pushStatus !== 0) {
    fail(
      'git push 失败，pre-push hook (npm run quality) 可能未通过。',
      '看上面 quality 输出，定位失败步骤后修复，再重跑 npm run ship。\n   不推荐的绕过方式：SKIP_SIMPLE_GIT_HOOKS=1 npm run ship',
    )
  }

  // PR + auto-merge (steps 2 and 3 of 4 — push was [1/4], switch back is [4/4])
  createAndAutoMergePR(current, 2, 4)

  info(`[4/4] 切回 ${MAIN_BRANCH}：git switch ${MAIN_BRANCH}`)
  const backStatus = runInherit('git', ['switch', MAIN_BRANCH])
  if (backStatus !== 0) {
    warn(`切回 ${MAIN_BRANCH} 失败，但 PR 已创建并启用 auto-merge。手动：git switch ${MAIN_BRANCH}`)
  }

  ok('Mode B 完成。GitHub 会在 CI 全绿后自动 rebase-merge 并删除远端分支。')
}

// ────────────────────────────────────────────────────────────────────────────
// Shared: PR creation + auto-merge enablement
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a PR for `branch` (or reuse existing open one) and enable auto-merge.
 *
 * Step numbering is parameterized so the caller controls the [n/total] echo —
 * Mode A passes (5, 7) → "[5/7] PR" + "[6/7] auto-merge".
 * Mode B passes (2, 4) → "[2/4] PR" + "[3/4] auto-merge".
 * This keeps the user-visible step counter monotonic across modes.
 */
function createAndAutoMergePR(branch, prStep, total) {
  const mergeStep = prStep + 1

  // Detect existing PR for this branch first to give a clean diagnostic.
  const existing = runCapture('gh', [
    'pr',
    'list',
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'number,url',
  ])
  let prUrl = null
  if (existing.status === 0 && existing.stdout && existing.stdout !== '[]') {
    let list = null
    try {
      list = JSON.parse(existing.stdout)
    } catch {
      // JSON parse failed — fall through to attempt creation
    }
    if (Array.isArray(list) && list.length > 1) {
      // Multiple open PRs share this head — should not happen in normal flow
      // (GitHub only allows one open PR per head→base pair), but defensive
      // handling for residue from manual operations.
      const refs = list.map((p) => `#${p.number}`).join(', ')
      fail(
        `分支 ${branch} 关联了多个开放 PR（${refs}），无法判断该对哪一个启用 auto-merge。`,
        `GitHub 通常不允许同 head→base 出现多个开放 PR，可能是手动操作残留。\n   逐个检查：${list.map((p) => `gh pr view ${p.number} --web`).join(' ; ')}\n   关掉多余的：gh pr close <number>\n   只保留 1 个开放 PR 后重跑：npm run ship`,
      )
    }
    if (Array.isArray(list) && list.length === 1) {
      prUrl = list[0].url
      warn(`分支 ${branch} 已有 open PR：${prUrl}，跳过创建，直接尝试启用 auto-merge。`)
    }
  }

  if (!prUrl) {
    info(`[${prStep}/${total}] 创建 PR：gh pr create --fill`)
    const createStatus = runInherit('gh', ['pr', 'create', '--fill'])
    if (createStatus !== 0) {
      fail(
        'gh pr create 失败。',
        '常见原因：\n   - 该分支已有 PR：gh pr view --web 查看，或 gh pr close 关闭后重试\n   - 远端缺少 base 分支：gh repo view 检查仓库默认分支\n   - 网络/权限问题：gh auth status 检查',
      )
    }
    // Read URL of the just-created PR
    const view = runCapture('gh', ['pr', 'view', branch, '--json', 'url'])
    if (view.status === 0) {
      try {
        prUrl = JSON.parse(view.stdout).url
      } catch {
        // Non-fatal; URL just won't be echoed at the end
      }
    }
  }

  info(`[${mergeStep}/${total}] 启用 auto-merge：gh pr merge --auto --rebase --delete-branch`)
  const mergeStatus = runInherit('gh', ['pr', 'merge', '--auto', '--rebase', '--delete-branch'])
  if (mergeStatus !== 0) {
    fail(
      'gh pr merge --auto 失败，仓库可能未启用 auto-merge。',
      '启用：gh repo edit --enable-auto-merge\n   或手动：等 CI 绿后运行 gh pr merge --rebase --delete-branch',
    )
  }

  if (prUrl) {
    info(`PR URL: ${prUrl}`)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Help
// ────────────────────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(`
ship.js — One-command PR workflow

用法：
  npm run ship "<commit message>"   Mode A：从 main 拉新分支，提交 staged 改动，
                                    推送，建 PR，启用 auto-merge
  npm run ship                      Mode B：当前工作分支已有 commit，推送，
                                    建 PR，启用 auto-merge

示例：
  git add app/src/foo.vue
  npm run ship "feat: add foo card"            # Mode A

  git switch -c fix/replay-bug
  # ... 多次 commit ...
  npm run ship                                  # Mode B

合法 commit type:
  ${VALID_COMMIT_TYPES.join(' / ')}

环境要求：
  - git 仓库根目录
  - GitHub CLI (gh) 已安装并登录（gh auth login）
  - 仓库已启用 auto-merge（gh repo edit --enable-auto-merge）

注意：
  - pre-push hook 会自动运行 npm run quality（耗时数分钟）
  - 不要使用 --no-verify 绕过 hook
`)
}

// ────────────────────────────────────────────────────────────────────────────
// Entry
// ────────────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  if (args.length > 1) {
    fail(
      `参数过多（收到 ${args.length} 个）。`,
      'Mode A 期望单个参数（commit message），整体用引号包起来：\n   npm run ship "feat: your message"',
    )
  }

  ensureGitRepo()
  ensureGhAvailable()

  if (args.length === 1) {
    modeA(args[0])
  } else {
    modeB()
  }
}

main()
