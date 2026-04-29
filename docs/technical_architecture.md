# Scales Tarot 技术架构文档

## 1. 文档目的

本文档是项目的技术事实入口，用来回答四类问题：

1. 这个项目当前交付什么，不交付什么。
2. 代码按什么边界分层，每层负责什么。
3. 协作者应该如何验证改动是否成立。
4. 在不依赖特定 AI 工具的前提下，怎样持续推进项目。

---

## 2. 规范文档分工

| 文档 | 作用 | 阅读对象 |
|---|---|---|
| `README.md` | 对外介绍、快速开始、协作入口、使用限制 | 所有人 |
| `PRD.md` | 产品目标、功能范围、交互设计 | 产品、设计、研发 |
| `TODO.md` | 当前阶段、任务计划、完成标准 | 执行者、负责人 |
| `docs/technical_architecture.md` | 技术架构、术语、约束、测试规范 | 研发、测试、维护者 |
| `test/README.md` | 测试工作区入口说明 | 研发、测试 |

规则：同一类事实只维护一处，其他文档通过引用或简述指向 canonical 文档。

---

## 3. 当前技术边界

### 3.1 当前交付边界

- 当前正式交付：H5
- 当前保留但不发布：mp-weixin
- 当前解读能力：本地规则解读
- 当前主题范围：单主题 `golden_dawn`

### 3.2 当前主线目标

1. 建立稳定的工程质量门。
2. 收敛前端状态与动画架构。
3. 建立可执行的发布与运行治理。

---

## 4. 系统结构总览

```text
Browser (H5)
  -> app/ 前端页面、状态、动画、布局、接口调用
  -> server/ API、牌库、主题与静态资源
  -> test/ 单元、集成、接口与脚本化 E2E
```

项目是一个前后端同仓库的单体工程：

- 前端负责页面呈现、流程控制、动画和结果展示
- 后端负责卡牌数据、结果计算、静态资源与 API
- 测试工作区负责验证纯逻辑、接口契约和关键用户路径

---

## 5. 目录职责

### 5.1 前端

| 目录 | 职责 |
|---|---|
| `app/src/pages/` | 页面入口与页面级组合 |
| `app/src/components/` | 纯展示组件与局部交互组件 |
| `app/src/composables/` | 页面和组件之间的展示控制层 |
| `app/src/stores/` | 全局状态 |
| `app/src/api/` | 前端 API 调用与错误抽象 |
| `app/src/core/` | 纯计算、布局、动画阶段、尺寸与视口等核心逻辑 |
| `app/src/core/config/` | 集中管理的布局常量与动画时长配置 |
| `app/src/utils/` | 面向业务组织的辅助逻辑、presenter/orchestrator 与安全随机工具 |
| `app/src/styles/` | 全局样式资源 |

### 5.2 后端

| 目录 | 职责 |
|---|---|
| `server/src/server.ts` | 进程启动、端口处理、优雅退出 |
| `server/src/app.ts` | Express 应用装配 |
| `server/src/routes/` | HTTP 路由与输入输出边界 |
| `server/src/services/` | 卡牌读取、主题读取、结果计算等服务逻辑 |
| `server/src/data/` | 塔罗数据源 |
| `server/public/static/` | 主题资源、牌图、字体、图标等静态文件 |

### 5.3 测试

| 目录 / 文件 | 职责 |
|---|---|
| `test/*.test.ts` | 前端纯逻辑、布局、动画、组件测试 |
| `test/testcases/*.test.ts` | 后端服务与 API 契约测试 |
| `test/*.sh` | 脚本化 E2E 或黑盒验证 |
| `test/vitest.config.ts` | 测试配置 |

---

## 6. 核心运行链路

### 6.1 首页进入

1. 前端加载主题资源和卡牌基础数据。
2. 首页提供牌阵选择和开始入口。
3. 用户触发占卜后，进入覆盖层流程。

### 6.2 占卜流程

1. 洗牌（前端动画，纯视觉）
2. 切牌（前端动画，纯视觉）
3. 抽牌阶段开始：前端立即向后端发起 `POST /api/v1/divinations`，后端在一次事务里完成 shuffle + draw + 解读，返回 `{ spreadKind, drawn, reading }`
4. 翻牌（前端动画，使用响应里的 `drawn` 渲染牌面）
5. 揭示阶段：消费响应里的 `reading` 渲染结果与逐张牌义

注：客户端不再持有任何随机源；`secure_random` 的 CSPRNG 实现位于服务端 `server/src/utils/secure_random.ts`，前端同名模块只服务于纯视觉的卡面抖动等装饰性随机。

### 6.3 结果恢复

1. 当解读失败（即 `/divinations` 调用失败或超时）时，前端应提供重试入口。
2. 重试直接重新调用 `/divinations`：协议把抽牌和解读合并成一次原子事务，所以重试必然换一组新牌——这是协议层一致性，不再尝试在客户端"复用已抽到的牌"。
3. 当用户选择再占一次时，界面需要回到可再次开始的初始状态。

---

## 7. 核心术语

| 术语 | 说明 |
|---|---|
| `idle` | 首页待机状态 |
| `shuffling` | 洗牌阶段（纯前端动画） |
| `cutting` | 切牌阶段（纯前端动画） |
| `drawing` | 抽牌阶段；前端发起 `/divinations` 请求 |
| `revealing` | 翻牌与结果揭示阶段 |
| `result` | 结果阅读状态 |
| `divination` | 服务端单次端到端动作：shuffle + draw + 解读，对应 `POST /api/v1/divinations` |
| `deck` | 尚未发出的牌堆 |
| `pile` | 切牌后分出的牌堆 |
| `spreadKind` | 牌阵种类。当前唯一取值 `single_card`；类型别名定义在 `app/src/api/types.ts` 与服务端 `server/src/routes/divinations.ts` 的 zod 枚举共同维护 |
| `viewport` | 物理像素视口（width / height / safe-area / topBar），由 `getViewport()` 从平台 window-info 派生 |
| `reservations` | UI 像素预算（header、动作栏、卡牌间距、抽屉覆盖等），由 `getDefaultReservations()` 提供 |
| `solveLayout` | 纯函数布局求解器，输入 `viewport + reservations + scene`，输出 `SceneLayout`（卡牌、抽屉几何、stage 矩形、动画 envelope） |
| `drawer geometry` | `DrawerGeometry { initialTop, initialHeight, maxHeight, width, rightAligned }`，由 solver 计算后由 `ResultZone` 直接消费 |
| `result zone` | 结果展示区域 |

---

## 8. 工程约束

### 8.1 架构约束

1. 产品需求不写进技术文档，技术实现不写进 PRD。
2. 新增常量必须集中管理，禁止散落魔法数字。布局相关的物理像素预留集中在 `app/src/core/sizing/physical_reservations.ts`；时长 / 阈值 / 计数集中在 `app/src/core/config/layout_constants.ts`。
3. 纯计算优先放在 `core/`，避免和框架状态强耦合。布局求解 (`solveLayout`) 必须保持纯函数：无 DOM、无全局、无窗口读取——所有输入由调用方收集后传入。
4. 兼容层和重复类型定义不能长期保留在主线上。当前仅 `app/src/utils/tarot_reading.ts` 作为类型 re-export shim 存在，新代码不允许向其新增导出，剩余消费者迁移完后即可删除。
5. 协议类型在 `app/src/api/types.ts` 单点定义，前后端共享通过结构匹配（不共享代码）。多牌阵扩展时，`SpreadKind` 联合分支与服务端 `SUPPORTED_SPREADS` zod 枚举必须保持同步。
6. 客户端禁止持有任何业务相关的随机源；shuffle / 卡面正逆位等随机性由服务端 `node:crypto` CSPRNG 完成，前端 `secure_random` 仅服务于纯视觉装饰。

### 8.2 前端约束

1. 当前交付以 H5 为准，但代码仍需注意 uni-app 多端边界。
2. 动画相关实现禁止长期挂载 `will-change`。
3. 关键错误路径必须有明确恢复动作。
4. 组件优先保持展示职责，复杂状态尽量下沉到 composable 或纯逻辑模块。
5. 布局相关比例值禁止使用语义化的 0.x 视口分数（如 `viewport.h * 0.28` 等）；任何"应留多少空间"必须以物理像素表达，新增预留进 `physical_reservations.ts`。
6. 宽屏/窄屏分支的具体宽度由 solver 输出 + JS 注入 CSS 变量（`--stage-width` / `--drawer-width` / `--card-width` 等）驱动；CSS 内只能保留同等语义的回退值，不允许出现脱离 solver 的新百分比硬编码。

### 8.3 后端约束

1. 路由层负责输入输出边界，不把复杂业务散落到 handler。
2. 输入校验必须统一、显式（zod）。
3. 健康检查、静态资源、业务接口职责要清晰分开。
4. 业务级随机必须使用 `server/src/utils/secure_random.ts` 暴露的 helper（`randomBelow` / `randomBool`），底层走 `node:crypto`，禁止直接调用全局 PRNG。
5. helmet 配置中 `upgradeInsecureRequests` 显式置 `null`：HTTPS 强制由反向代理完成，应用层不重写资源 URL；HSTS 仅在生产环境启用，其他环境关闭以避免 localhost 被锁。

### 8.4 文档约束

1. 任何影响产品范围的变更必须同步更新 `PRD.md`。
2. 任何影响技术边界的变更必须同步更新本文档。
3. 任何影响执行顺序和阶段判断的变更必须同步更新 `TODO.md`。
4. 文档必须面向人类协作者可读，不能默认读者拥有某个 AI 工具上下文。

---

## 9. 命名与组织规则

| 对象 | 规则 |
|---|---|
| 文件 / 子目录 | `snake_case` |
| 组件 / 类 | `PascalCase` |
| 函数 | `camelCase` |
| 变量 | `snake_case` 优先，遵循项目既有约定时保持局部一致 |
| 布尔值 | `is_` / `has_` 前缀优先 |

补充规则：

- 文档目录统一放在 `docs/`
- 测试文件统一放在 `test/`
- 不新增无明确职责的“临时 helper”文件

---

## 10. 测试规范

### 10.1 测试层次

1. 单元测试：验证纯逻辑、布局、计算、presenter、orchestrator。
2. 集成测试：验证 store、composable、API 边界协作。
3. 接口测试：验证后端路由、输入校验、错误格式和健康检查。
4. 脚本化 E2E：验证首页到结果页的关键用户路径。
5. Smoke test：验证生产构建产物可以启动、探针正常、站点入口可访问。

### 10.2 常用命令

```bash
npm run quality
```

按测试工作区直接运行：

```bash
cd test && npx vitest run
```

### 10.3 测试要求

1. 功能改动至少覆盖一个正向场景和一个异常或边界场景。
2. 文档变更如果影响测试口径，必须同步更新测试说明。
3. 结果声明必须以实际命令输出、脚本结果或截图为依据。
4. 不能用过时测试数量、历史结论或口头说明替代当前验证。

### 10.4 当前 CI 覆盖

当前 GitHub Actions 已覆盖：

- `npm ci`
- `npm run quality`

安全与构建告警策略（G0.5 已补齐）：

- `npm audit` 阻断门禁：`--omit=dev --audit-level=high`（仅阻断 high/critical）
- 上游 moderate 风险白名单：`docs/AUDIT_WAIVER.md`，按月复查
- 信息查看命令：`npm run quality:audit:info`（`--audit-level=moderate`，不阻断 CI）
- H5 生产构建当前无字体告警，无需额外处置

后续主线需要补齐：

- 回归验收阶段的脚本化 E2E 与人工验证证据沉淀

### 10.5 部署治理边界

1. 当前仓库未维护正式部署文档或部署示例。
2. 部署、回滚、监控和上线清单属于后续阶段任务，由 `TODO.md` 统一规划。
3. 在进入发布与运行治理阶段前，不把部署流程视为当前文档基线的一部分。

---

## 11. 协作流程

### 11.1 开始任务前

1. 阅读 `TODO.md`
2. 阅读 `PRD.md`
3. 阅读本文档
4. 判断任务属于产品、技术还是运行治理变更

### 11.2 执行任务时

1. 小步提交，避免混合多类改动
2. 改代码的同时更新相关文档
3. 保留可以验证完成度的证据

### 11.3 完成任务后

1. 更新 `TODO.md` 状态
2. 记录必要的发布说明或变更说明
3. 说明验证范围、已知风险和未覆盖项

---

## 12. 演进原则

1. 先解决文档失真，再解决工程失真。
2. 先建立质量门，再做功能扩展。
3. 先保证 H5 主线稳定，再考虑平台扩展。
4. AI 可以参与协作，但项目的知识结构必须能脱离 AI 独立运转。
