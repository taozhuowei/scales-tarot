# Scales Tarot

Scales Tarot 是一个以 H5 为主要交付形态的单页塔罗体验项目。它强调短路径、仪式感和稳定反馈，让用户在一个页面内完成抽牌、揭示与解读。

当前仓库的目标不只是维护一个可运行页面，还要建立一套清晰、可持续、不过度依赖特定 AI 工具的演进方式。任何新协作者都应该能只依赖仓库内文档理解项目、执行任务和验证结果。

---

## 当前范围

- 当前正式范围：H5 网站
- 当前主线：文档基线、工程质量基线、架构收敛、发布治理
- 当前不在主线：小程序发布、账号体系、支付、社交分享、AI 解读扩展

---

## 文档索引

- 产品需求：[PRD.md](PRD.md)
- 执行计划：[TODO.md](TODO.md)
- 塔罗术语：[docs/tarot_glossary.md](docs/tarot_glossary.md)
- 测试入口：[test/README.md](test/README.md)
- AI 协作约束：[AGENTS.md](AGENTS.md)

---

## 快速开始

安装依赖：

```bash
npm install
```

启动本地开发环境：

```bash
npm run dev
```

打开浏览器访问 [http://localhost:4123/](http://localhost:4123/) 即可看到 H5 端实时预览，改代码会通过 vite HMR 立即热更新。

---

## 公开命令

仓库只暴露 3 个 npm script：`prepare`、`dev`、`prod`。其它工具（quality gate、tests、knip、playwright 等）由 `scripts/`、`.git/hooks/` 与 CI 直接调用，不再通过 npm script 中转。

### `npm run dev`

本地开发一键启动。等价于 `node scripts/build/index.js --dev --target h5,mp,server`，依次执行：

1. 写入 `.env.development.local`（注入本机 LAN IP，方便小程序真机调试）。
2. 强制释放 `:4123` 与 `:4124`：如有占用进程立即 SIGKILL，避免 EADDRINUSE。
3. 跑一次全量 quality gate（`scripts/quality_gate.js full`）。如需跳过：`node scripts/build/index.js --dev --target h5,server --skip-quality`。
4. 通过 `concurrently` 并行启动三个 watcher：
   - **h5**：vite 真·dev server 监听 `:4123`，支持模块级 HMR + vite-plugin-checker overlay。
   - **mp**：`vite-plugin-uni build --watch -p mp-weixin`（小程序运行时只能消费磁盘产物，不能跑 dev server）。
   - **server**：`tsx server/src/server.ts` 监听 `:4124`，TS 改动自动重启。

打开 `:4123` 预览 H5；vite 把 `/api` 与 `/static` 反代到 `:4124`，所以前端发请求像在生产同源环境下一样。直接打开 `:4124/` 在 dev 模式下会返回 404（这是正确信号——express 在 dev 模式下不再 fallback 到陈旧的 `dist/build/h5/index.html`，避免静默掩盖未热更的代码）。

### `npm run prod`

生产构建一键完成。等价于 `node scripts/build/index.js --prod --target h5,mp,server`，依次执行：

1. 跑一次全量 quality gate（同上）。
2. h5 vite production build → `dist/build/h5/`。
3. mp-weixin vite production build → `dist/build/mp-weixin/`。
4. server `tsc` 输出 → `server/dist/`。
5. 包大小回归（`scripts/perf_baseline_gate.js`）+ SPA boot smoke：用 `node server/dist/server.js` 真启动一次，curl `/`、`/api/healthz` 验证 200。

部署时把 `dist/build/h5/` 拷到生产前端服务器（或交给 nginx 直接 serve）；后端 `server/dist/` + `node_modules` 拷到 server 主机，用 `NODE_ENV=production node server/dist/server.js` 启动（默认监听 `127.0.0.1:4124`，由 nginx 反代）。

---

## 环境变量配置

项目用 `.env.*.local` 文件存配置，**永远不进 git**（每台机器自己一份）。

### 前端变量（vite 编译时烤进 bundle）

| 变量名 | 用途 |
|--------|------|
| `VITE_API_BASE_URL` | 前端代码访问后端的完整 URL |

### 后端变量（Node.js 启动时读）

| 变量名 | 默认值 | 用途 |
|--------|------|------|
| `NODE_ENV` | development | 运行模式 development / production |
| `HOST` | dev `0.0.0.0` / prod `127.0.0.1` | 后端监听地址（dev 用 0.0.0.0 让局域网设备访问，prod 默认绑回环交由 nginx 反代） |
| `PORT` | 4124 | 后端端口 |
| `CORS_ORIGIN` | (空) | 允许跨域的来源列表，逗号分隔。空 = prod 同源、dev 全放行；`*` = 任意来源（仅 dev 用） |
| `LOG_LEVEL` | dev `debug` / prod `info` / test `silent` | pino 日志级别：trace / debug / info / warn / error / fatal / silent |

### dev 环境

`.env.development.local` 由 `npm run dev` **自动生成**，无需手动编辑。它探测你机器局域网 IP 写入 `VITE_API_BASE_URL=http://<你的 IP>:4124`。

如果手机连同一 WiFi 调试小程序时连不上，检查这个文件里的 IP 是不是你电脑当前的真实 IP（IP 换了 WiFi 会变，重跑 `npm run dev` 会自动更新）。

### prod 环境

部署生产服务器前需手动创建 `.env.production.local`：

```bash
# .env.production.local（不进 git）
VITE_API_BASE_URL=https://your-domain.com
```

后端运行时变量（`NODE_ENV` / `HOST` / `PORT` / `CORS_ORIGIN` / `LOG_LEVEL`）通常**不写文件**，由生产服务器的系统环境变量直接注入（systemd EnvironmentFile / Docker `-e` 等）。

---

## Git 工作流

`scripts/ship.js` 已删除，统一改回手动 6 步流程，每一步都有明确意图，不再用一键脚本掩盖中间状态。

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

提交信息遵循 commitlint conventional 规范（`feat: …` / `fix: …` / `chore: …` / `docs: …` …），由 commit-msg hook 自动校验。

---

## 质量保证

完整 quality gate（约 30s 纯代码检查）：

```bash
node scripts/quality_gate.js full
```

按顺序执行：`quality-scan`、`pr-size`、`lint`、`type-check:app`、`type-check:server`、`test`（vitest 26 套件 / 236 用例）、`audit`、`arch:check`、`dead-code` (knip)、`duplicate-code` (jscpd)。CI 的 `verify` job 调用同一条命令；`e2e` job 在 `--skip-quality` 模式下跑构建 + playwright。

### Git 钩子

`npm install` 会自动通过 `npm run prepare` 安装 `simple-git-hooks`：

| 钩子 | 命令 | 速度 | 用途 |
|---|---|---|---|
| `pre-commit` | `node scripts/quality_gate.js staged` | < 5 s | 增量 lint 修复 + 静态扫描，自动写回暂存区 |
| `commit-msg` | `npx commitlint --edit $1` | < 1 s | 强制 conventional commit 格式 |
| `pre-push` | `node scripts/quality_gate.js full` | 1–3 min | 全量门禁兜底 |

#### 紧急绕过

正常流程下钩子不应被绕过；以下两种情况是允许的逃生口：

```bash
# 1) simple-git-hooks 官方环境变量
SKIP_SIMPLE_GIT_HOOKS=1 git commit ...
SKIP_SIMPLE_GIT_HOOKS=1 git push ...

# 2) Git 原生跳过
git commit --no-verify ...
git push --no-verify ...
```

CI 与 pre-push 跑同一套 `quality_gate.js full`，**绕过本地钩子的提交在 CI 阶段仍会被拦下**。建议仅在已知本地工具链短暂故障且修复成本高于风险时使用，且事后必须补跑一次完整 quality 验证。

---

## 协作原则

1. 开始任何任务前，先读 `TODO.md`、`PRD.md`，需要塔罗领域知识时查阅 `docs/tarot_glossary.md`。
2. 产品范围变化，先更新 `PRD.md`；执行节奏变化，先更新 `TODO.md`。
3. 所有代码改动都必须附带对应验证证据，至少覆盖类型检查、测试或构建中的必要项。
4. 项目文档必须能被人类开发者直接理解，AI 只能是辅助工具，不能成为唯一知识入口。

---

## 使用与授权说明

本仓库**不是开源项目**，默认采用“保留所有权利（All Rights Reserved）”方式管理。

未经项目所有者书面授权，禁止以下行为：

- 将本项目或其衍生版本用于商业用途
- 对外提供托管、售卖、转授权或二次分发
- 公开镜像、公开转载或以开源项目名义再次发布
- 将项目中的设计、文案、素材或实现整体挪作其他商业产品

允许的范围仅限于经授权的内部协作、评审、学习和受控开发活动。

---

## 项目结构

```text
app/      前端应用
server/   后端服务
test/     测试工作区
docs/     塔罗术语
```
