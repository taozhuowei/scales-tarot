# Scales Tarot

Scales Tarot 是一个基于 `Vue 3 + uni-app + TypeScript + Express` 的单页塔罗占卜应用。前端负责仪式化抽牌动画和结果展示，后端负责牌库与解读计算，并同时服务 H5 静态产物与 API。

> **当前发布范围**：仅 H5 网站。小程序（mp-weixin）编译目标已保留但不发布，待后续单独立项推进。

## 项目结构

```text
app/       # uni-app frontend
server/    # Express + TypeScript backend
test/      # Vitest test workspace
dist/      # frontend build output
```

## 开发命令

先安装依赖：

```bash
npm install
```

本地开发：

```bash
npm start
```

或：

```bash
npm run dev
```

`dev:h5` 会执行这些步骤：

1. 生成 `.env.development.local`，写入当前局域网 API 地址。
2. 执行前后端 TypeScript 类型检查。
3. 以开发模式并行启动：
   - H5 watch 构建（`uni build --watch`）
   - `tsx server/src/server.ts` 开发服务（同时服务 API 与 H5 静态文件）

## 测试与校验

类型检查：

```bash
npm run type-check
```

单元测试：

```bash
npm test -w test
```

## 生产构建

H5 + 服务端（推荐，本项目当前只做 H5 发布）：

```bash
npm run build:h5
```

H5 + 微信小程序 + 服务端：

```bash
npm run build
```

`build:h5` 会执行：

1. 前后端类型检查
2. H5 Vite 生产构建
3. `server/src` 编译到 `server/dist`

当前生产构建策略：

- 前端使用 Vite `production` mode
- JS 使用 `terser` 压缩
- 开启 `mangle`
- 删除 `console` 与 `debugger`
- 关闭生产 sourcemap
- 输出可直接运行的 `server/dist/server.js`

运行生产构建产物（开发机 smoke-test）：

```bash
NODE_ENV=production npm run start:prod
```

默认访问：

- H5: `http://localhost:3000`
- Liveness: `http://localhost:3000/api/healthz`
- Readiness: `http://localhost:3000/api/readyz`

## 部署到服务器

单机部署采用 **host nginx + systemd 托管 Node** 的标准组合，nginx 端外服务 TLS 与静态资源，Node 只监听 `127.0.0.1:3000` 处理 `/api/*`。完整步骤见 [deploy/README.md](deploy/README.md)，示例配置见：

- [deploy/nginx.conf.example](deploy/nginx.conf.example)
- [deploy/systemd/scales-tarot.service.example](deploy/systemd/scales-tarot.service.example)

## 运行时配置

所有服务端行为由环境变量驱动，集中在 [server/src/config.ts](server/src/config.ts)。本地使用复制 `.env.example` 为 `.env`；生产使用放入 `/etc/scales-tarot.env` 并由 systemd `EnvironmentFile` 加载。

关键变量：

| 变量 | 默认（prod / dev） | 说明 |
|---|---|---|
| `NODE_ENV` | `production` / `development` | 运行模式 |
| `HOST` | `127.0.0.1` / `0.0.0.0` | 绑定地址；prod 默认仅本机，反代后安全 |
| `PORT` | `3000` | 监听端口 |
| `CORS_ORIGIN` | 空 → 同源 | 逗号分隔白名单；`*` 表示宽松（仅 dev） |
| `LOG_LEVEL` | `info` / `debug` | pino 日志级别 |
| `STATIC_BASE_URL` | `http://localhost:3000` | 后端拼接图片 URL 的基准；prod 设为 HTTPS 域 |

## 当前交互特性

- 覆盖层动画流程：洗牌 → 切牌 → 抽牌 → 解读
- 抽牌完成后自动进入解读，无需额外点击
- 结果区全量文本打字机动效
- `positive / negative` 结果着色
- 仅开发模式显示悬浮 Dev Tools：
  - 快速回到指定阶段重放
  - `0.5x / 1x / 2x`
  - 暂停 / 继续

## 注意事项

- 服务启动前会检测端口占用，优先尝试 `3000`
- `server/dist/`、`dist/` 已在 `.gitignore`
- 生产模式不会渲染 Dev Tools
