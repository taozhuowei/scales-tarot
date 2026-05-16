# server

Express 4 + zod 后端，监听 `:4124`。提供塔罗卡牌、占卜、主题三组 API 与主题静态资源；加载 78 张塔罗牌 JSON（`/api/readyz` 校验全量加载）。dev 端口冲突自动转发（`:4124→:4125→…`），prod fail-fast；`SIGTERM`/`SIGINT` 优雅关停。

## 目录架构

```
server/
├── src/
│   ├── app.ts            # 中间件链:security→CORS→logger→/static(30d)→/api(prod 限流)→SPA fallback(prod)→error
│   ├── server.ts         # 端口转发(dev) / fail-fast(prod) / 优雅关停
│   ├── config.ts         # 环境配置(isProd 等)
│   ├── logger.ts         # 请求日志
│   ├── routes/           # cards / divinations / themes
│   ├── services/         # card_loader / theme_loader / tarot_reading
│   ├── data/             # 78 张塔罗牌 JSON(major/cups/pentacles/swords/wands)
│   └── utils/            # secure_random
├── public/
│   └── static/themes/    # 主题静态资源(golden_dawn …)
├── test/                 # vitest + supertest(api / backend / middleware)
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

`:4124/` 在 dev 下返回 404 是有意为之（`app.ts` 的 `if (config.isProd)` 守卫），避免陈旧 `dist/build/h5/index.html` 静默掩盖 vite 当前编译产物。

## 技术栈

- **Express 4**：HTTP 框架与中间件链。
- **zod 4**：请求/数据 schema 校验。
- **pino** + **pino-http**：结构化日志（级别由 `LOG_LEVEL` 控制）。
- **helmet** / **compression** / **express-rate-limit**：安全头 / 压缩 / 限流（prod-only）。
- **vitest** + **supertest**：HTTP / service 集成测试（node env）。
- **tsc**：类型检查与 prod 构建（`server/dist/`）；dev 用 `tsx` 直跑并热重启。
