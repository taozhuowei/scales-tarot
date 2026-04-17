# TODO

## 状态说明

| 标记 | 含义 |
|------|------|
| `[ ]` | 待处理 |
| `[~]` | 进行中 |
| `[x]` | 已完成 |
| `[-]` | 已取消 / 不做 |

---

> **当前发布范围**：仅 H5 网站。小程序（mp-weixin）构建配置保留但不发布，待后续单独立项推进。

---

## 当前状态

已完成的系统能力（不再单独列条目）：

- 前后端分离：后端提供 `/api/v1/cards`、`/api/v1/readings`，前端通过 API 客户端调用
- 主题系统：`/api/v1/themes`，CSS 变量注入，`golden_dawn` 资源已迁移
- 占卜动画流程：洗牌 → 切牌 → 抽牌 → 揭示，全套 GSAP 动画，Dev Tools 调试面板
- 打字机解读展示，进度 icon，结果着色
- 构建脚本：`npm start` / `npm run build` / `npm run start:prod`
- 测试：255 用例全绿

---

## 扩展点（有基础设施，待 UI 接入）

### 牌阵切换

当前固定为 `single_card`。布局引擎已支持 `three_card`、`cross_spread`，扩展时：

- `app/src/stores/tarot.ts`：将 `ACTIVE_SPREAD_KIND` 改回 `ref<SpreadKind>`，恢复 `setSpreadKind()`
- 重新添加首页选择 UI（settings 按钮 + 面板）
- `app/src/config.json`：恢复 `spreadKind` 字段作为默认值

### 主题贡献指南

- [ ] 新建 `server/themes/THEME_SPEC.md`：主题目录结构、文件命名规则、theme.json 字段说明

### 动态主题路径

- [ ] 将 `constants.ts` 中剩余硬编码图片/图标路径改为从 theme store 动态获取

---

## Phase 4 · AI 解读

**目标**：在现有离线规则解读基础上，新增 AI 解读模式。每位用户每天可使用 3 次 AI 解读，无限次离线解读。

**注意**：prompt 设计、provider 选择（Claude / OpenAI）、结果格式需单独详细设计后再实现。

### 待专项设计

- [ ] **AI 解读详细设计**：确定 prompt 模板、AI provider、解读结果字段格式、用户展示方式（流式输出 or 一次性返回）

### 后端

- [ ] `POST /api/v1/readings` 新增 `mode` 字段（`offline` | `ai`），`offline` 走现有逻辑，`ai` 走 AI 流程
- [ ] 实现每日配额系统：基于用户标识 + 日期，记录当日 AI 解读次数；超出 3 次返回 `429 Quota Exceeded`
- [ ] 实现 `GET /api/v1/quota`：返回当前用户今日剩余 AI 解读次数
- [ ] AI 解读服务实现（待详细设计确认后实现）

### 前端

- [ ] 结果揭示前提供解读模式选择（离线解读 / AI 解读）
- [ ] 展示今日剩余 AI 解读次数
- [ ] AI 解读结果展示区域（字段格式待详细设计确认后实现）
- [ ] 配额耗尽时的友好提示 + 引导使用离线解读

### 文档

- [ ] 完成 AI 解读详细设计文档后更新 `PRD.md`
