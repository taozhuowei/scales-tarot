# Scales Tarot — TODO

## 阶段 7 — 门禁工程清理 + 死代码治理

### 总览

- **背景**：本地 `2e89722` 提交因 `pre-push` 钩子执行 `npm run quality` 失败（knip 误报 + 真实死代码）而无法推送至 `origin/main`。CI (`.github/workflows/ci.yml`) 与本地钩子镜像，绕过 `--no-verify` 也会被 CI 拦截。
- **总工时估算**：≈ 4.5 小时（7.0 ≈ 70 分钟，7.1 ≈ 100 分钟，7.2 ≈ 95 分钟）
- **解锁第一次 push 的关键路径**：完成 7.0 全部任务后 `npm run quality` 转绿，即可 `git push origin main`
- **延期事项**：
  - `getDefaultPhaseOrder()`（`app/src/animation/pipeline.ts:70`）需待 phase-replay 重构后再评估，本阶段不动
  - GitHub 分支保护配置（需仓库管理员权限）延至 7.2 之后单独立项
  - sonarjs `warn` 规则 ratchet 计划需用户确认 deadline 后再排期
- **审计来源**：Test Results Analyzer / Software Architect / DevOps Automator 三方报告交叉核验

### 7.0 Push 解锁前必修（P0）

`[x]` **7.0.1 删除两处死 vi.mock 块**
- 文件：`test/overlay_controller_sizing.test.ts:55-82`、`test/use_overlay_controller.test.ts:122-151`
- 做什么：删除引用已重命名路径 `../app/src/utils/overlay_layout/index` 的 `vi.mock()` 块（factory 永不执行，测试通过的是 real solver）
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：15 min
- 依赖：无（首发）

`[x]` **7.0.2 删除未使用类 DefaultReadingProviderFactory**
- 文件：`app/src/utils/reading/reading_provider.ts:36-53`
- 做什么：删除 `DefaultReadingProviderFactory` 类与 `ReadingProviderFactory` 接口（grep 确认 monorepo 零调用方）
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：15 min
- 依赖：无（可与 7.0.1 并行）

`[x]` **7.0.3 删除未使用 themeBase getter**
- 文件：`app/src/stores/theme.ts:38-45`
- 做什么：删除 `themeBase` getter（零消费者 + ReDoS 风险），同步删除相关正则
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：20 min
- 依赖：无（可与 7.0.1/7.0.2 并行）

`[x]` **7.0.4 修复 knip.json 配置消除误报**
- 文件：`knip.json`
- 做什么：在根 workspace 添加 `scripts/*` 入口；`ignoreFiles: ['app/vite.config.ts']`；将 `jscpd`、`@vue/runtime-core`、`@dcloudio/uni-automator/cli-shared/stacktracey` 加入 `ignoreDependencies`；删除真实未用 devDeps `madge`、`webpack-bundle-analyzer`；核实 `@vue/tsconfig` 是否被 `tsconfig` extends 引用后决定保留或删除
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：15 min
- 依赖：7.0.1 / 7.0.2 / 7.0.3 完成（避免修配置后又触发新 knip 报错）

`[x]` **7.0.5 补齐 @vitejs/plugin-vue 缺失声明**
- 文件：根 `package.json`
- 做什么：将 `@vitejs/plugin-vue` 加入 `devDependencies`（`test/vitest.config.ts` 引用但未声明）
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：5 min
- 依赖：无（可与 7.0.4 并行）

`[x]` **7.0.6 验证 npm run quality 转绿并 push**
- 做什么：本地跑 `npm run quality`，全绿后 `git push origin main`，确认远程接受 + CI 转绿
- Agent：`testing/testing-reality-checker.md`
- 工时：10 min
- 依赖：7.0.1 ~ 7.0.5 全部完成（必须串行最后跑）

### 7.1 架构债清理（P1）

`[x]` **7.1.1 提取 parseServerError 辅助函数**
- 文件：`app/src/api/client.ts:64`
- 做什么：将 3 层嵌套三元抽出独立函数 `parseServerError(data)`，提升可读性
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：15 min
- 依赖：7.0.6 完成（push 解锁后再做）

`[x]` **7.1.2 提取 initPilesAtRest 辅助函数**
- 文件：`app/src/animation/phases/cut/builder.ts:47-72`
- 做什么：将 piles 初始化重复段抽出 `initPilesAtRest(piles, pilesVisible, N)`
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：15 min
- 依赖：7.0.6（与 7.1.1 并行）

`[x]` **7.1.3 StyleReconciler 接口去重**
- 文件：`app/src/composables/use_animation_controller.ts`（参考 `app/src/composables/use_overlay_layout.ts:84` 已有 extends 模式）
- 做什么：让 `UseAnimationControllerReturn` 用 `extends StyleReconciler` 消除 13 行字段重复
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：20 min
- 依赖：7.0.6

`[x]` **7.1.4 重新评估 106 处未使用类型导出**
- 做什么：在 7.0.4 修复 knip 配置后重跑 `npm run quality`，对剩余条目逐一核验（架构师抽样命中 100% 误报，仅处理真实未用项）
- Agent：`engineering/engineering-code-reviewer.md`
- 工时：30 min
- 依赖：7.0.4 + 7.1.1 ~ 7.1.3 完成

`[x]` **7.1.5 atom 测试补强（fakeTimers + 边界）**
- 文件：现有 4 个 atom 测试文件（具体路径以 `test/` 目录为准）
- 做什么：将 `setTimeout` 替换为 `vi.useFakeTimers()`，补充边界用例
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：30 min
- 依赖：7.0.6

### 7.2 配置精修 + 文档 + CI 优化（P2）

`[x]` **7.2.1 jscpd 阈值收紧 + 补 server/src 扫描**
- 文件：`.jscpd.json`、`scripts/quality_gate.js`
- 做什么：阈值从 5% 调至 1.5%（适配 6.1k LoC）；`quality_gate.js` 中 jscpd 命令补充扫描 `server/src`
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：5 min
- 依赖：7.0.6

`[x]` **7.2.2 pre-commit 提速：移除 type-check**
- 文件：`.simple-git-hooks` 配置或 `package.json` 中 hook 定义
- 做什么：将 `type-check`（vue-tsc + tsc 全量）从 pre-commit 移至 pre-push 唯一执行
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：10 min
- 依赖：7.0.6

`[x]` **7.2.3 新增 theme_store 测试（如保留 themeBase 简化版）** — 已废弃，7.0.3 选择整体删除 themeBase getter，无需测试

`[x]` **7.2.4 README 补充 hook bypass 文档**
- 文件：`README.md`
- 做什么：新增章节说明 `SKIP_SIMPLE_GIT_HOOKS=1` 用法及使用前提
- Agent：`engineering/engineering-frontend-developer.md`
- 工时：10 min
- 依赖：7.0.6

`[x]` **7.2.5 sonarjs warn 规则 ratchet 计划立项** — `eslint.config.mjs` 已加入 ratchet 注释 + 占位条件（每条规则升 error 的触发条件）；具体 deadline 待用户拍板后回填到下方阶段 8

`[!]` **7.2.6 GitHub 分支保护配置（待用户在 GitHub 后台启用）**
- 拟定 `main` 分支保护策略：
  - Required status checks: `verify` job（运行 `npm run quality`）必须 pass
  - 禁止 force push 到 main
  - 禁止删除 main
  - PR 必须经过至少 1 名审阅者批准
- 落实方式：仓库管理员在 `Settings → Branches → Branch protection rules` 中配置
- 依赖：用户具备仓库管理员权限

---

## 重构总目标

按新 PRD 视觉层术语体系（5 视图 / 9 容器 / 4 阶段 / 4 类动画 / 双路由）对 overlay 模块全面重构。

执行顺序严格串行：状态机先行 → 视图分层 → 动画重建 → 命名 codemod → 架构债清理 → 测试验收。

## 状态符号

- `[ ]` 待开始
- `[~]` 进行中
- `[>]` 待审计
- `[?]` 待验收
- `[x]` 已完成
- `[!]` 待确认

---

## PRD 修订（前置）

`[x]` 状态：已完成（2026-04-30）

### 范围

引入双层流程模型：
- 应用级 4 阶段：idle / divination / reading / decision
- 占卜内 4 动画相位：shuffling / cutting / drawing / revealing

修订 PRD 5 节：
- 第 2.6 节流程阶段
- 第 2.4 节容器（操作区时机）
- 第 7.3 节流程进度区（4 图标对应动画相位）
- 第 7.4 节视图与流程阶段对应
- 第 8.2 节占卜→解读过渡（打字机播完后操作区淡入时序）

### Agent

- 实施：Technical Writer
- 审计：Code Reviewer

### 验收

- PRD 5 节修订到位
- 双层流程定义清晰
- decision 阶段操作区时机明确
- Code Reviewer 给 PASS

---

## 阶段 1 — 状态机改造

`[x]` 状态：已完成（2026-04-30，Code Reviewer PASS）

### 实施摘要

- DivinationPhase 改 4 阶段：idle / divination / reading / decision
- isAnimating / isResultVisible / startDivination / revealResult 全部对齐
- 新增 enterDecision()（阶段 2 接打字机 onComplete 时调用）
- onPhaseChange 统一映射 OverlayPhase → 'divination'（双层解耦）
- PHASE_STEPS 第 4 个 label "解读" → "翻牌"
- vue-tsc PASS / eslint PASS

### 范围

- `OverlayPhase` 类型对齐 PRD 4 阶段（idle / divination / revealing / reading）
- `DivinationPhase` 同步
- `result` 阶段引用全网改为 `reading`
- `PHASE_STEPS` 注册表 4 图标对齐 4 阶段语义

### Agent

- 实施：Frontend Developer
- 审计：Code Reviewer

### 验收

- `npx vue-tsc --noEmit -p app/tsconfig.json` 通过
- `npx eslint app/src/` 通过
- `npm test` 不出现"新增"失败用例（旧坏测试不算）

---

## 阶段 2 — 视图分层与路由拆分

`[x]` 状态：已完成（2.2.a 完成 2026-05-01，2.2.b 完成 2026-05-01）

### 子阶段完成情况

#### 2.1 骨架搭建 `[x]` 已完成
- `app/src/pages/main/index.vue` — 主路由骨架
- `app/src/pages/fallback/index.vue` — 兜底路由
- `app/src/views/` — 5 个视图骨架（IdleView / DivinationView / ReadingSplitView / ReadingDrawerView / FallbackView）
- `app/src/components/containers/` — 9 个容器骨架（TitleArea / ProgressArea / Stage / ReadingPanel / ConclusionContainer / CardMeaningContainer / ReadingTextContainer / ActionArea / NotificationHost）
- `app/src/components/stage-content/` — 3 个骨架（IdleDeck / DivinationDeck / FallbackOrbits）
- `app/src/composables/use_app_phase.ts` / `app/src/stores/notification.ts`
- `app/src/App.vue` 启动检测 + 兜底路由分流
- `app/src/pages.json` 新路由注册

#### 2.2.a idle 视图 + divination 视图业务内容迁移 `[x]` 已完成（2026-05-01）

- `components/stage-content/IdleDeck.vue` `[x]` — 12 张牌 GSAP fan 动画 + click→triggerDivination（从 pages/index/index.vue 迁移）
- `components/containers/TitleArea.vue` `[x]` — GSAP stagger entrance + idle/fallback 两种 variant（从 pages/index/index.vue 迁移）
- `components/containers/ProgressArea.vue` `[x]` — inject animationController，progressHeaderPresentation 渲染 4 个相位图标，headerStyle 接 GSAP 入场动画
- `components/stage-content/DivinationDeck.vue` `[x]` — inject animationController，deck-layer + cut-piles + draw-container（3D 翻牌），onMounted start() + resize handler，onUnmounted 清理
- `pages/main/index.vue` `[x]` — 删除 controllerEmit；实现 onDrawingStart/onPipelineComplete/settlePipeline；handleRestart 完整动画重置
- `views/IdleView.vue` `[x]` — 删除 placeholder 行
- `views/DivinationView.vue` `[x]` — 纯布局壳，无 props，两子组件自驱动

#### 2.2.b 解读视图业务内容迁移 `[x]` 已完成（2026-05-01）
- ReadingSplitView ✅ — 删除 placeholder，加 overflow+container query CSS
- ReadingDrawerView ✅ — 完整 drag rig（touch/keyboard/snap），ARIA slider，emit('drag')，is-dragging CSS 过渡抑制
- ReadingPanel ✅ — loading/error/success 三态 fade-slide 过渡，success 双重守卫（panelState + readingResult）
- ConclusionContainer ✅ — result-hero 迁移（eyebrow+title+question TypewriterText，toneClass，rise-in 动画）
- CardMeaningContainer ✅ — meaning-list 元数据迁移（name/nameEn/meta-row/keywords TypewriterText）
- ReadingTextContainer ✅ — meaning-text 迁移，typewriterComplete via setTimeout（(N-1)*charInterval+50ms），prefersReducedMotion 快路径
- ActionArea ✅ — 真实按钮（decision: backHome+restart；error: retry），350ms fade-in 动画
- 删除旧文件 ✅：pages/index/index.vue / DivinationOverlay.vue / ProgressHeader.vue / ResultPanel.vue / ResultDrawer.vue / ResultSidebar.vue / ActionBar.vue

### 范围

- 新建 `app/src/views/` 五视图组件（IdleView / DivinationView / ReadingSplitView / ReadingDrawerView / FallbackView）
- 新建 `app/src/components/containers/` 九容器组件
- `pages.json` 增兜底路由
- 启动时网络/资源检测 → 路由分流（成功进主路由，失败进兜底路由）

### Agent

- 布局规范：UX Architect
- 实施：Frontend Developer
- 审计：Code Reviewer

### Skill

- `frontend-design` / `adapt`

### 验收

- 5 视图 + 9 容器各自独立组件
- 主路由 / 兜底路由互斥
- 浏览器走查 4 视图切换正确（待机/占卜/解读/兜底）

---

## 阶段 3 — 动画体系按 PRD 重建

`[x]` 状态：已完成（2026-05-01，Code Reviewer PASS）

### 实施摘要

- `animation/easings.ts` — EASE_SPRING_CSS/GSAP + 4 个 duration 常量
- `animation/phases/fan/builder.ts` — `buildFanTimeline()` 5 帧扇形循环动画（抽象自 IdleDeck）
- `animation/phases/fallback/builder.ts` — `startFallbackAnimation()` 参数化椭圆轨道（三角函数，无 MotionPath）
- `animation/transitions/idle_to_divination.ts` + `divination_to_reading.ts` — 过渡时序常量
- `use_animation_controller.ts:start()` — 删除 30 行入口动画，改为 `handleSettleEntryAnimation() + runPipeline(0)`
- `layout_constants.ts` — 删除 5 个 `ENTRY_*` 常量
- `IdleDeck.vue` — 使用 `buildFanTimeline()` 替换内联循环
- `FallbackOrbits.vue` — 完整实现（4 行星 + 中央星 + 椭圆轨道线）
- CSS 视图过渡：ReadingSplitView 右侧滑入 450ms，ReadingDrawerView 底部滑上 350ms，main/index.vue idle↔divination 淡入淡出 450ms

### 范围

- 删除入口动画硬编码（`use_animation_controller.ts:start()` 30 行 gsap timeline）+ 5 个 `ENTRY_*` 常量
- 新建 `phases/fan/builder.ts`（摊牌动画 5 帧）
- 新建 `phases/fallback/builder.ts`（几何兜底动画 3D + GSAP MotionPath）
- 新建 `transitions/`（待机→占卜 + 占卜→解读 两段过渡）
- 统一缓动到 `animation/easings.ts`，主推 `cubic-bezier(0.16, 1, 0.3, 1)`

### Agent

- 动画编排：Software Architect
- 实施：Frontend Developer
- 走查：Reality Checker

### Skill

- `animate` / `overdrive`

### 验收

- 7 个动画 + 2 段过渡按 PRD 第 7.5 / 8.1 / 8.2 节分帧呈现
- 浏览器走查通过
- Reality Checker PASS

---

## 阶段 4 — 命名 codemod 与样式归位

`[x]` 状态：已完成（2026-05-01，Code Reviewer PASS）

### 实施摘要

- `result_stage` → `reading_stage`：layout_solver.ts / use_overlay_layout.ts / use_overlay_controller.ts / pages/main/index.vue
- `openResultPanel` → `openReadingPanel`：phase_pipeline.ts / use_animation_controller.ts / use_overlay_controller.ts
- `useResultPanelController` → `useReadingPanelController`：新建 use_reading_panel_controller.ts，旧文件改为 re-export shim；三个容器导入更新
- 删除所有旧文件名注释（ResultPanel/ResultDrawer/ResultSidebar）
- `global.css` overlay 变量 → `styles/overlay/_tokens.css`，App.vue 增加导入

### 范围

- `Result*.vue` → `Reading*.vue`（含 ResultPanel / ResultDrawer / ResultSidebar）
- `result_zone` / `result_stage` → `reading_zone` / `reading_stage`
- UI 操作函数命名统一：`triggerDivination` / `drawerDrag` / `restart` / `retry` / `backHome`
- `global.css` overlay-only 变量外提到 `styles/overlay/_tokens.css`
- `DivinationOverlay.vue` 400 行样式拆为 `_shell` / `_stage` / `_cards` / `_action-bar` / `_loading` 5 个 partial

### Agent

- 实施：Frontend Developer
- 审计：Code Reviewer

### 验收

- `grep -r "ResultPanel\|ResultDrawer\|ResultSidebar\|result_zone\|result_stage" app/src/` 输出为空
- lint 通过
- CSS 每文件 ≤ 100 行

---

## 阶段 5 — 架构债清理

`[x]` 状态：已完成（2026-05-01，Code Reviewer PASS）

### 实施摘要

- `AnimationState` 接口所有 `_xxx` 字段改为公开名（bg/stage/header/footer/deckCtn/initials/lefts/rights/piles/draws/inners）；consumers（gsap adapter、reconciler）同步更新；ExternalPrivateAccess 警告归零
- `use_animation_controller.ts` 拆分为 5 个职能 hook（use_phases / use_playback / use_presentation / use_animation_state / use_lifecycle），通过 DI 组合，互不直接 import
- `use_lifecycle_types.ts` 提取 LifecycleAnimState / LifecycleDeps 接口，use_lifecycle.ts 保持 134 行
- `phase_pipeline.ts` 删除，逻辑拆入 commands/start.ts（83 行）/ pipeline_builder.ts（107 行）/ skip_to_reading.ts / replay_from_phase.ts
- `overlay_lifecycle.ts` 删除，逻辑迁入 use_lifecycle.ts
- `commands/restart.ts` / `commands/finish.ts` 删除（dead code，use_overlay.ts 内联实现）
- `use_overlay_controller.ts` 改为 re-export shim，实体迁至 `use_overlay.ts`（导出 useOverlay）
- `quality_baseline.json` 更新 buildPhaseRunners 路径至 pipeline_builder.ts

### 范围

- 重写 `useAnimationState` 取消 `_xxx` 暴露 → 命令-查询分离
- 拆 `useAnimationController` 为 5 个职能 hook（use_phases / use_playback / use_presentation / use_styles / use_lifecycle）
- 删除 `phase_pipeline.ts` 拆独立命令文件（commands/start / restart / finish / skip_to_reading / replay_from_phase）
- 删除 `overlay_lifecycle.ts` 逻辑下沉到 state
- `use_overlay_controller` 改名 `use_overlay`

### Agent

- 分层架构：Software Architect
- 实施：Frontend Developer
- 审计：Code Reviewer

### Skill

- `simplify` / `audit`

### 验收

- 单文件行数：Vue ≤ 200 / composable ≤ 150 / TS ≤ 180
- `quality_scan` 中 `ExternalPrivateAccess` 警告归零
- hook 互不直接相互 import

---

## 阶段 6 — 测试修复与验收

`[x]` 状态：已完成（2026-05-01，21/21 文件全绿，质量扫描 0 错误）

### 实施摘要

- 删除 `divination_overlay_a6.test.ts`（DivinationOverlay.vue 已删）
- 删除 `result_panel_component.test.ts`（ResultPanel.vue 已删）
- `overlay_phase_registry.test.ts`：修正 import 路径至 `animation/phases/registry` + `core/flow/types`，revealing label `'解读'`→`'翻牌'`
- `overlay_pipeline.test.ts`：修正 import 路径至 `animation/pipeline` + `animation/adapters/gsap` + `core/flow/types`
- `overlay_timeline.test.ts`：修正 import 路径至 `animation/adapters/gsap`
- `use_animation_state.test.ts`：所有 `state._xxx` → `state.xxx`（对应 Phase 5 公开字段重命名）
- `layout_solver.test.ts`：所有 `result_stage` → `reading_stage`（对应 Phase 4 命名 codemod）
- `tarot_store.test.ts`：对齐 Phase 1 新 4 阶段流程（shuffling→divination，result→reading，补 enterDecision 断言）
- `index_page.test.ts`：`store.phase === 'shuffling'` → `'divination'`
- `overlay_progress_model.test.ts`：revealing label `'解读'`→`'翻牌'`
- 最终结果：21 test files / 193 tests 全部通过，`quality_scan` 0 errors / 6 warnings（均为预存 WARNs）

### 范围

- 修 5 个旧测试文件 import 路径（divination_overlay_a6 / overlay_phase_registry / overlay_pipeline / overlay_timeline / result_panel_component）
- 为新视图 + 新动画补单元测试（关键纯函数 + 状态机迁移）
- E2E 走查（待机→占卜→解读→再占一次→兜底全链路）
- 全量 `npm run quality` 门禁

### Agent

- 实施：Frontend Developer
- 终审：Reality Checker

### Skill

- `playwright` / `agent-browser`

### 验收

- `npm test` 全绿（5 文件失败 → 0 文件失败）
- `npm run quality` 全部 step 绿
- Reality Checker 给 PASS
- 浏览器走查全链路成功

---

## 阶段间约束

1. 严格串行 1 → 2 → 3 → 4 → 5 → 6
2. 每阶段 PASS 才进下一阶段
3. NEEDS WORK 当阶段闭环修复，禁止延期到后续阶段
4. 每阶段一个 git commit，可独立回退
5. 任意阶段中遇到 PRD 模糊或边界冲突立即停下问用户，禁止擅自决策
