# 本地开发与部署

> 命令、环境变量与部署细节。公开命令面只有 3 个 npm script：`prepare`、`dev`、`prod`；其它工具由 `scripts/`、`.git/hooks/` 与 CI 直接调用。

## 快速开始

```bash
npm install   # 触发 prepare 安装 simple-git-hooks
npm run dev
```

打开 [http://localhost:4123/](http://localhost:4123/) 看到 H5 端实时预览，改代码经 vite HMR 立即热更。

## `npm run dev`

等价 `node scripts/build/index.js --dev --target h5,mp,server`，依次执行：

1. 写入 `.env.development.local`（注入本机 LAN IP，便于小程序真机调试）。
2. 强制释放 `:4123` 与 `:4124`：占用进程立即 SIGKILL，避免 EADDRINUSE。
3. 跑一次全量 quality gate（`node scripts/quality_gate.js full`）。跳过：追加 `--skip-quality`。
4. `concurrently` 并行启动三个 watcher：
   - **h5**：vite dev server 监听 `:4123`，模块级 HMR + vite-plugin-checker overlay。
   - **mp**：`vite-plugin-uni build --watch -p mp-weixin`（小程序运行时只能消费磁盘产物）。
   - **server**：`tsx server/src/server.ts` 监听 `:4124`，TS 改动自动重启。

vite 把 `/api` 与 `/static` 反代到 `:4124`，前端发请求等同生产同源。直接打开 `:4124/` 在 dev 下返回 404 —— 这是正确信号，express 在 dev 不 fallback 到陈旧 `dist/build/h5/index.html`，避免静默掩盖未热更代码。

## `npm run prod`

等价 `node scripts/build/index.js --prod --target h5,mp,server`，依次执行：

1. 全量 quality gate。
2. h5 vite production build → `dist/build/h5/`。
3. mp-weixin vite production build → `dist/build/mp-weixin/`。
4. server `tsc` 输出 → `server/dist/`。
5. 包大小回归（`scripts/perf_baseline_gate.js`）+ SPA boot smoke：`node server/dist/server.js` 真启动，curl `/`、`/api/healthz` 验证 200。

部署：`dist/build/h5/` 拷到前端服务器（或交 nginx serve）；`server/dist/` + `node_modules` 拷到 server 主机，`NODE_ENV=production node server/dist/server.js` 启动（默认 `127.0.0.1:4124`，由 nginx 反代）。

## 环境变量

配置存 `.env.*.local`，**永不进 git**，每台机器各一份。

### 前端（vite 编译时烤进 bundle）

| 变量 | 用途 |
|---|---|
| `VITE_API_BASE_URL` | 前端访问后端的完整 URL |

### 后端（Node.js 启动时读）

| 变量 | 默认值 | 用途 |
|---|---|---|
| `NODE_ENV` | development | 运行模式 development / production |
| `HOST` | dev `0.0.0.0` / prod `127.0.0.1` | 监听地址（dev 用 0.0.0.0 让局域网访问，prod 绑回环交 nginx 反代） |
| `PORT` | 4124 | 后端端口 |
| `CORS_ORIGIN` | 空 | 允许跨域来源，逗号分隔；空 = prod 同源、dev 全放行；`*` = 任意（仅 dev） |
| `LOG_LEVEL` | dev `debug` / prod `info` / test `silent` | pino 级别：trace/debug/info/warn/error/fatal/silent |

### dev 环境

`.env.development.local` 由 `npm run dev` **自动生成**，无需手编。它探测局域网 IP 写入 `VITE_API_BASE_URL=http://<你的 IP>:4124`。手机连同一 WiFi 调小程序连不上时，检查该文件 IP 是否为电脑当前真实 IP（换 WiFi 会变，重跑 `npm run dev` 自动更新）。

### prod 环境

部署前手动创建 `.env.production.local`：

```bash
# .env.production.local（不进 git）
VITE_API_BASE_URL=https://your-domain.com
```

后端运行时变量（`NODE_ENV`/`HOST`/`PORT`/`CORS_ORIGIN`/`LOG_LEVEL`）通常**不写文件**，由生产服务器系统环境变量注入（systemd EnvironmentFile / Docker `-e` 等）。
