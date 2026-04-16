# TODO

## 状态说明

| 标记 | 含义 |
|------|------|
| `[ ]` | 待处理 |
| `[~]` | 进行中 |
| `[x]` | 已完成 |
| `[-]` | 已取消 / 不做 |

---

## Phase 1 · 前后端分离

**目标**：将牌库数据和解读逻辑迁移至后端，前端只保留抽牌逻辑和 UI，保证功能不受影响。单条 npm 命令同时启动前端编译和后端服务器。

**验收标准**：H5 和小程序均可正常完成完整占卜流程；`npm start` 一条命令可同时启动前端开发服务和后端服务。

### 后端重构

- [x] 新建 `server/package.json`，配置 TypeScript + tsx 运行环境
- [x] 将 `server/server.js` 重写为 TypeScript，拆分为模块化结构（`server/src/`）
- [x] 将 `app/src/data/tarot-*.json` 迁移至 `server/src/data/`（保持 JSON 结构不变）
- [x] 实现 `GET /api/v1/cards`：返回全部 78 张牌数据（含图片 URL，图片 URL 由服务端拼接主题基础路径）
- [x] 实现 `POST /api/v1/readings`：接收 `[{ cardId, position }]`，返回解读结果（`result`、`score`、`cardDetails`）；将 `generateReading` / `getCardScore` 逻辑迁移至 `server/src/services/tarot_reading.ts`

### 前端重构

- [x] 新建 `app/src/api/`，用 `uni.request` 封装 API 客户端（兼容 H5 和小程序；支持 base URL 配置）
- [x] `app/src/utils/tarotReading.ts`：删除 `loadAllCards` / `generateReading` / `getCardScore`，只保留 `drawCards` 和类型定义
- [x] 删除 `app/src/data/` 目录（所有 JSON 文件随后端迁移一并删除）
- [x] 更新 `app/src/stores/tarot.ts`：`allCards` 初始化改为调用 `GET /api/v1/cards`；本地 `drawCards` 后调用 `POST /api/v1/readings` 获取解读
- [x] 更新 `app/src/constants.ts`：统一 API base URL 配置（开发用 `http://localhost:3000`，小程序生产用可配置域名）
- [x] 新建 `app/src/config.json`：集中配置抽牌数量（当前 `cardCount=1`）

### 工程配置

- [x] 根目录 `package.json` 引入 `concurrently`，`npm start` 同时启动后端（`tsx`）和前端（`uni dev:h5`）；`npm install` 从根目录运行
- [x] `npm run build` 同时执行前端 H5 构建和后端 TypeScript 编译

### 文档

- [x] 更新 `PRD.md` §7 技术方案：补充前后端分离架构说明、API 端点列表
- [x] 更新 `README.md`：本地开发启动方式、生产构建与运行脚本说明

---

## Phase 2 · 小程序登录（已搁置）

**当前状态**：H5 优先，小程序编译目标保留但不作为首发端。本 Phase 仅在正式启用 `mp-weixin` 发布时重启。

**范围说明**：本 Phase 使用 `wx.login()` + `jscode2session` + 自建 JWT 的标准 OAuth2 流程，**不使用**微信小程序云开发 / 云函数 / 云存储（全仓库未接入、也不计划接入）。后端始终为自托管 Express。

**目标**：实现微信小程序 OAuth 登录，前端以 openid 为身份标识，后端签发 JWT Token 维持会话。为后续配额和用户数据功能打基础。

**依赖**：Phase 1 完成；启用 `mp-weixin` 正式发布。

**验收标准**：小程序冷启动可静默完成登录（无需用户感知），Token 存入本地缓存，后续 API 请求自动携带 Token。

### 后端

- [ ] 引入 `jsonwebtoken`，封装 Token 签发与验证中间件
- [ ] 实现 `POST /api/v1/auth/wx-login`：接收小程序 `code`，调用微信 `jscode2session` 接口换取 `openid`，签发 JWT 并返回
- [ ] 新建 `server/src/data/users.json`（开发阶段临时存储 openid → user 映射，生产阶段换数据库）
- [ ] 通过环境变量（`.env`）管理微信 AppID / AppSecret，不入库

### 前端

- [ ] 新建 `app/src/stores/user.ts`：管理登录态、Token、openid
- [ ] 小程序启动时（`App.vue onLaunch`）静默执行登录流程：`wx.login()` → `POST /api/v1/auth/wx-login` → 存入 `uni.setStorageSync`
- [ ] API 客户端 `app/src/api/` 支持自动注入 `Authorization: Bearer <token>` 请求头
- [ ] H5 模式下跳过登录（Token 为空时 API 仍可正常调用，仅无法使用需身份的功能）

### 文档

- [ ] 新建 `server/ENV.md`：记录所有环境变量名称、用途、示例值（不记录真实值）
- [ ] 更新 `PRD.md`：补充登录流程说明

---

## Phase 3 · 主题系统

**目标**：实现可多人协作的主题机制。贡献者在 `server/themes/` 下新建一个符合规范的目录即可新增主题；前端可在不改动任何动画和功能代码的情况下切换主题。

**依赖**：Phase 1 完成。

**验收标准**：新增一个测试主题目录并切换后，所有图片、图标、配色均更换，动画和占卜流程不受影响。

### 主题规范与迁移

- [ ] 制定主题目录规范文档（见下方「主题目录结构」）
- [x] 将现有 `golden_dawn` 资源迁移到新规范目录结构（icons 并入主题目录）
- [x] 更新 `golden_dawn/ui/icon-*.png` 为统一塔罗主题图标（active / inactive 方案）
- [x] 优化占卜流程动画时序：延后读牌请求到抽牌动画启动后，并避免洗牌按钮与入场动画竞争造成首帧卡顿

**主题目录结构（规范）**：

```
server/themes/
└── {theme_id}/                       # 目录名即主题 ID（snake_case）
    ├── theme.json                    # 主题元数据 + 配色方案
    ├── tarot/
    │   ├── card_back.jpeg
    │   ├── major/
    │   │   └── major_arcana_{nn}_{id}.jpeg
    │   └── minor/
    │       ├── cups/
    │       ├── swords/
    │       ├── wands/
    │       └── pentacles/
    └── icons/
        ├── icon-cups.png
        ├── icon-pentacles.png
        ├── icon-swords.png
        └── icon-wands.png
```

**theme.json 结构（规范）**：

```json
{
  "id": "golden_dawn",
  "name": "Golden Dawn",
  "author": "",
  "colors": {
    "bg_primary": "#...",
    "bg_secondary": "#...",
    "text_primary": "#...",
    "text_secondary": "#...",
    "accent": "#...",
    "border": "#..."
  }
}
```

### 后端

- [x] 实现 `GET /api/v1/themes`：扫描主题目录，返回所有主题的 `id` + `name` + `description`
- [x] 实现 `GET /api/v1/themes/:id`：返回指定主题的完整 `theme.json` 内容
- [x] 静态资源路径调整：`/static/themes/:id/tarot/...`、`/static/themes/:id/ui/...`

### 前端

- [x] 新建 `app/src/stores/theme.ts`：已支持加载当前主题与读取主题资源；`switchTheme()` 与完整切换能力已补齐
- [ ] 将 `constants.ts` 中的图片/图标路径改为从 `theme store` 动态获取（拼接主题 ID）
- [x] 将 `app/src/styles/global.css` 中的颜色硬编码替换为 CSS 变量（`--color-bg-primary` 等）；主题切换时动态注入 CSS 变量值已补齐
- [x] 新增首页设置 UI 入口：右上角显示 theme 内设置图标，仅首页可切换牌阵（`single_card` / `three_card` / `cross_spread`），运行时立即生效
- [ ] 小程序端：通过 `page.setData` 更新 CSS 变量（适配小程序 CSS 变量注入方式）
- [x] 抽离通用牌阵布局引擎：从 `DivinationOverlay.vue` 提取牌阵位置/尺寸计算，统一支持 `single_card`、`three_card`、`cross_spread`，供抽牌态与结果态复用
- [x] **重构**：将 `DivinationOverlay.vue` 中全部 GSAP 动画逻辑抽离至 `app/src/composables/use_overlay_animation.ts`，stage-container 高度改由 GSAP 控制（删除 CSS height transition）
- [x] **继续重构**：已进一步拆分 `use_overlay_controller.ts`、`use_result_panel_controller.ts`、`overlay_animations/`、`overlay_phase_registry.ts`、`overlay_progress_model.ts`、`overlay_progress_presenter.ts`、`overlay_timeline.ts`、`reading/`、`typing/typewriter_model.ts`；`DivinationOverlay.vue` 已接入结果区显式高度、失败重试与独立进度模型
- [x] **修复**：`spread_layout.ts` 新增 `headerHeight` 参数，修正所有牌阵结果页居中公式，draw_stage 预对齐减少过渡位移（≤60px 均匀）
- [x] **修复**：`single_card` 抽牌终点位置改为以屏幕几何中心为准，移除 `draw_stage` 额外上浮偏移
- [x] **优化**：覆盖层卡牌仅保留统一尺寸图片显示，移除卡牌本体装饰；同步去除洗牌尾部回弹、切牌放大与抽牌前抖动
- [x] **优化**：最终解读区全部文字改为打字机动效，`positive / negative` 结果增加对应着色
- [x] **优化**：四阶段进度 icon 中前两枚做视觉尺寸补偿，并在抽牌结束后延迟约 `800ms` 再进入解读
- [x] **修复**：移除 `DivinationOverlay.vue` 中会触发微信组件 `wxss` 报错的标签选择器，恢复顶部四阶段 icon 与卡牌正面显示；同步重排抽牌阶段镜头跟随、牌堆退出与下坠时序
- [ ] **验收**：微信真机一致性检测待执行，需覆盖安全区、卡牌尺寸、位置、阶段动画、翻牌放大、结果面板弹出与解读可见性
- [x] **开发工具**：仅 `dev` 模式显示悬浮 Dev Tools，支持阶段重放、慢放、快进、暂停、继续（2025-04-11 完成）
- [x] **工程配置**：细化 `dev / build / start:prod` 脚本，补齐生产构建压缩、混淆与服务端产物启动流程
- [x] **测试**：补充打字机组件、结果色调类名、覆盖层动画调试与 `800ms` 解读延迟的自动化测试

### 文档

- [ ] 新建 `server/themes/THEME_SPEC.md`：主题贡献指南（目录结构、文件命名规则、theme.json 字段说明）
- [x] 更新 `PRD.md`：补充主题系统说明与当前动效/构建约束

---

## Phase 4 · 解读功能扩展

**目标**：在现有离线规则解读基础上，新增 AI 解读模式。每位用户每天可使用 3 次 AI 解读，无限次离线解读。

**依赖**：Phase 2（需要用户身份用于配额追踪）。

**注意**：AI 解读的 prompt 设计、provider 选择（Claude / OpenAI）、结果格式需单独详细设计后再实现，本 phase 仅列出已明确的结构性任务。

### 待专项设计

- [ ] **AI 解读详细设计**：确定 prompt 模板、AI provider、解读结果字段格式、用户展示方式（流式输出 or 一次性返回）

### 后端（结构已明确部分）

- [ ] `POST /api/v1/readings` 新增 `mode` 字段（`offline` | `ai`），`offline` 走现有逻辑，`ai` 走 AI 流程
- [ ] 实现每日配额系统：基于 openid + 日期，记录当日 AI 解读次数；超出 3 次返回 `429 Quota Exceeded`
- [ ] 实现 `GET /api/v1/quota`：返回当前用户今日剩余 AI 解读次数
- [ ] AI 解读服务实现（待详细设计确认后实现）

### 前端（结构已明确部分）

- [ ] 结果揭示前提供解读模式选择（离线解读 / AI 解读）
- [ ] 展示今日剩余 AI 解读次数
- [ ] AI 解读结果展示区域（字段格式待详细设计确认后实现）
- [ ] 配额耗尽时的友好提示 + 引导使用离线解读

### 文档

- [ ] 完成 AI 解读详细设计文档后更新 `PRD.md`
