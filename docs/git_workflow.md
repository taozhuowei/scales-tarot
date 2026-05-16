# Git 工作流与质量保证

> 手动 6 步流程，每步意图明确，不用一键脚本掩盖中间状态（`scripts/ship.js` 已删）。

## 6 步流程

```bash
# 1. 同步 main
git switch main && git pull

# 2. 拉新分支
git switch -c feat/xxx

# 3. 改代码 + 原子提交
git add <files>
git commit -m "feat: ..."

# 4. 推送（pre-push 自动跑全套 quality_gate.js full）
git push -u origin feat/xxx

# 5. 开 PR + 等 CI
gh pr create --fill
gh pr checks --watch

# 6. 合并 + 同步本地
gh pr merge --rebase --delete-branch
git switch main && git pull
git branch -d feat/xxx
```

提交信息遵循 commitlint conventional 规范（`feat:` / `fix:` / `chore:` / `docs:` …），由 commit-msg 钩子自动校验。

## 质量门禁

完整 quality gate（约 30s 纯代码检查，无构建）：

```bash
node scripts/quality_gate.js full
```

按序执行：`quality-scan`、`pr-size`、`lint`、`type-check:app`、`type-check:server`、`test`（vitest 单元/组件 + supertest）、`audit`、`arch:check`、`dead-code`（knip）、`duplicate-code`（jscpd）。CI `verify` job 调同一命令；`e2e` job 在 `--skip-quality` 下跑构建 + playwright。

前端类型检查必须用 `vue-tsc`，普通 `tsc` 漏 Vue SFC 级错误。

## Git 钩子

`npm install` 经 `npm run prepare` 自动安装 `simple-git-hooks`：

| 钩子 | 命令 | 速度 | 用途 |
|---|---|---|---|
| `pre-commit` | `node scripts/quality_gate.js staged` | < 5 s | 增量 lint 修复 + 静态扫描，自动写回暂存区 |
| `commit-msg` | `npx commitlint --edit $1` | < 1 s | 强制 conventional commit 格式 |
| `pre-push` | `node scripts/quality_gate.js full` | 1–3 min | 全量门禁兜底 |

## 紧急绕过

正常流程不应绕过钩子；以下两种是允许的逃生口：

```bash
# 1) simple-git-hooks 官方环境变量
SKIP_SIMPLE_GIT_HOOKS=1 git commit ...
SKIP_SIMPLE_GIT_HOOKS=1 git push ...

# 2) Git 原生跳过
git commit --no-verify ...
git push --no-verify ...
```

CI 与 pre-push 跑同一套 `quality_gate.js full`，**绕过本地钩子的提交在 CI 仍被拦下**。仅在已知本地工具链短暂故障且修复成本高于风险时使用，事后必须补跑完整 quality 验证。
