# Scales Tarot — TODO

## 状态符号

- `[ ]` 待开始
- `[~]` 进行中
- `[>]` 待审计
- `[?]` 待验收
- `[x]` 已完成
- `[!]` 待确认

---

## 阶段 8 — 门禁残留 + 架构债 + 容器统一

### 8.1 门禁扫描已发现但未处理的问题

#### 8.1.A — quality-scan FunctionSize 警告（3 项）

`[x]` **8.1.A.1** `app/src/animation/phases/reveal/builder.ts:32` `buildRevealPhaseRunner` 87 行（cap 80）→ 提取子函数

`[x]` **8.1.A.2** `app/src/animation/phases/reveal/builder.ts:35` `run` 82 行 → 同上

`[x]` **8.1.A.3** `app/src/core/sizing/scale.ts:378` `useResponsiveScale` 95 行 → 同上

#### 8.1.B — quality-scan EslintDisable reason 格式不规范（4 项）

`[x]` **8.1.B.1** `server/src/app.ts:73` 的 `-- dev-only loopback` 改 `-- reason: dev-only loopback`

`[x]` **8.1.B.2** `app/src/pages/main/index.vue:352` 加 reason

`[x]` **8.1.B.3** `app/src/pages/main/index.vue:355` 加 reason

`[x]` **8.1.B.4** `app/src/pages/main/index.vue:358` 加 reason

> 备注：8.1.B.2-4 的 `document.documentElement.classList` 调用通过 `utils/dev/container_borders.ts` 抽离重构，详见 8.3.3

#### 8.1.C — quality-scan FileSize 警告（5 项）

`[x]` **8.1.C.1** `app/src/components/stage-content/IdleDeck.vue` 346 行 — 按职责拆分子文件

`[x]` **8.1.C.2** `app/src/composables/use_overlay_layout.ts` 361 行 — 按职责拆分子文件

`[x]` **8.1.C.3** `app/src/core/sizing/layout_solver.ts` 345 行 — 按职责拆分子文件

`[x]` **8.1.C.4** `app/src/core/sizing/scale.ts` 473 行（超 173）— 按职责拆分子文件

`[x]` **8.1.C.5** `app/src/pages/main/index.vue` 443 行（超 143）— 按职责拆分子文件

#### 8.1.D — knip unused exports（6 项 真死代码）

`[x]` **8.1.D.1** `app/src/api/themes.ts:73` `fetchThemes` 函数 — grep 二次确认零调用方后删除

`[x]` **8.1.D.2** `app/src/core/config/layout_constants.ts:18` `WIDE_BREAKPOINT` 常量 — 同上

`[x]` **8.1.D.3** `app/src/utils/accessibility.ts:32` `trapFocus` 函数 — 同上

`[x]` **8.1.D.4** `server/src/services/theme_loader.ts:259` `getDefaultTheme` 函数 — 同上

`[x]` **8.1.D.5** `server/src/services/theme_loader.ts:313` `clearThemeCache` 函数 — 同上

`[x]` **8.1.D.6** `server/src/services/theme_loader.ts:322` `getCachedTheme` 函数 — 同上

#### 8.1.E — knip 配置 hints（4 项）

`[x]` **8.1.E.1** `knip.json` ignore 中 `app/vite.config.ts` 冗余 — 移除

`[x]` **8.1.E.2** `knip.json` ignore 中 `src/env.d.ts` 冗余 — 移除

`[x]` **8.1.E.3** `knip.json` ignore 中 `src/shime-uni.d.ts` 冗余 — 移除

`[x]` **8.1.E.4** `knip.json` server entry `src/server.ts` 冗余 — 移除

#### 8.1.F — sonarjs 5 条规则降为 warn（待 ratchet 升 error）

`[x]` **8.1.F.1** `sonarjs/void-use` 升 error（当前 0 命中，可立即升）

`[x]` **8.1.F.2** `sonarjs/no-small-switch` 升 error（当前 0 命中）

`[x]` **8.1.F.3** `sonarjs/no-nested-conditional` 升 error（当前 0 命中）

`[x]` **8.1.F.4** `sonarjs/no-all-duplicated-branches` 升 error（当前 0 命中）

`[x]` **8.1.F.5** `sonarjs/slow-regex` 升 error（当前 0 命中）

#### 8.1.G — sonarjs/todo-tag 整条永久关闭（1 项）

`[x]` **8.1.G.1** 永久 mute（已在 ESLint 用 `no-warning-comments` 单源覆盖；mute 理由已写入 eslint.config.mjs）

#### 8.1.H — depcruise 4 条规则升级 warn → error（4 项）

`[x]` **8.1.H.1** `no-orphans` severity warn → error

`[x]` **8.1.H.2** `no-circular` severity warn → error

`[x]` **8.1.H.3** `no-deprecated-core` severity warn → error

`[x]` **8.1.H.4** `not-to-deprecated` severity warn → error

#### 8.1.I — 配置宽容化的代价（3 项）

`[x]` **8.1.I.1** jscpd 阈值收紧到 1.0%

`[x]` **8.1.I.2** knip `ignoreExportsUsedInFile: true` 关闭，恢复严格跨文件检测

`[x]` **8.1.I.4** knip `vite: false` → 打开 vite 解析

#### 8.1.J — 浏览器层门禁盲区（1 项 真盲点）

`[x]` **8.1.J.1** Playwright SPA boot smoke 已接入 `quality_gate.full`

#### 8.1.K — eslint-disable 直接 ignore（5 处）

`[x]` **8.1.K.1** `server/src/app.ts:71-77` `sonarjs/no-clear-text-protocols` — 永久保留 + reason 合规

`[x]` **8.1.K.2** `pages/main/index.vue:352` `no-restricted-globals, no-undef` — 重构完成（抽出至 `utils/dev/container_borders.ts`）

`[x]` **8.1.K.3** `pages/main/index.vue:355` 同 8.1.K.2

`[x]` **8.1.K.4** `pages/main/index.vue:358` 同 8.1.K.2

`[x]` **8.1.K.5** 8.1.K.2-4 的 reason 格式见 8.1.B.2-4，统一处理

### 8.2 架构债

`[x]` **8.2.1 phase replay 架构修复 — 裂缝 1：phase 顺序在 3 处定义**
- `animation/phases/registry.ts` PHASE_STEPS 数组
- `animation/pipeline.ts:70` `getDefaultPhaseOrder()` 死代码
- `composables/commands/pipeline_builder.ts:buildPhaseRunners` 隐式顺序
- 已升级 registry 为单一 manifest（含 buildRunner），消除其他两处

`[x]` **8.2.2 phase replay 架构修复 — 裂缝 2：phase 不自带"入场状态快照"**
- 每个 PhaseRunner 已加 `snapToEntryState(animState, layout)` 方法
- replayFromPhase 改为：reset → 前置阶段全部 snap → 跑目标阶段
- skipToReading 用同一机制简化

`[!]` **8.2.3 IdleDeck `_scene.scale 1→1.5` scale 滥用** — agent 评估"容器尺寸过渡方案技术不可行，需重新评估方向"，待重新立项后再推进
- 文件：`app/src/components/stage-content/IdleDeck.vue`

`[!]` **8.2.5 mp-weixin 菜单按钮避让 TODO**
- 位置：`app/src/pages/main/index.vue` cssVarStyle 注释里挂着
- H5 主线不阻塞，仅当决定继续支持 mp-weixin 才需要做

### 8.3 容器统一 + 视觉对齐

`[x]` **8.3.1 HeaderArea 容器统一**
- 新建 `app/src/components/containers/HeaderArea.vue` 作为壳子层（高度/padding/对齐/overflow）
- 把 TitleArea / ProgressArea 拆成壳子（HeaderArea） + 内容（TitleContent / ProgressContent）
- IdleView / DivinationView 改为 `<HeaderArea><TitleContent /></HeaderArea>` 形式

`[x]` **8.3.2 标题 + 进度图标整体下移** — `TitleArea.vue` + `ProgressArea.vue` 各加 `margin-top: 32px`

`[x]` **8.3.3 devtool 容器边框 H5-only 重构** — `toggleContainerBorders` 抽至 `utils/dev/container_borders.ts`，eslint-disable 已消除

### 8.4 用户拍板才能动的事

`[x]` **8.4.1 GitHub 分支保护** — 用 gh api 配齐：required_status_checks (verify×2 + lint + e2e, strict)、enforce_admins、required_linear_history、禁 force push、禁删除、required_conversation_resolution；仓库级 allow_merge_commit=false、allow_rebase_merge=true、delete_branch_on_merge=true。
- 注：solo 仓库 reviewer count = 0 是 GitHub 硬限制（不能 approve 自己 PR），用 4 个 strict CI check 等价替代人工 review

`[x]` **8.4.2 sonarjs ratchet 升 error 的 deadline** — 用户决定方案 A：5 条立即升 error。已在 `eslint.config.mjs` 落实，gate 通过。

---

## 阶段 8.5 — 新增需求（本轮已实施）

`[x]` **8.5.1** DevToolsPanel 收起态极小圆按钮（40px）+ 自由拖拽（不持久化）
- 文件：`app/src/components/overlay/DevToolsPanel.vue`、`app/src/utils/dev/draggable_panel.ts`
- 拖拽 H5-only（mouse + touch），mp-weixin 编译为 no-op；位置不持久化（刷新回默认右下角）

`[x]` **8.5.2** 翻牌时序提速：删 1.0s pre-flip breath + AUTO_REVEAL_DELAY 800→0
- 文件：`app/src/animation/phases/draw/builder.ts`、`app/src/core/config/layout_constants.ts`
- 总等待时长从 ~3.83s（alignTime + 1.0 + 0.8）降到 ~2.03s（alignTime + 0 + 0），蹭掉 1.8s

`[x]` **8.5.3** 解读抽屉 initialHeight = 40vh，允许遮挡牌面
- 文件：`app/src/core/sizing/layout_solver_computers.ts`、`app/src/core/config/layout_constants.ts`、`test/layout_solver.test.ts`
- 新公式：`initialHeight = round(viewport.height * INITIAL_DRAWER_HEIGHT_RATIO)`，`INITIAL_DRAWER_HEIGHT_RATIO = 0.40`
- maxHeight 不变；initialTop 不变（仍基于卡牌底边锚点）；允许 drawer 遮挡牌面，用户可拖动查看

---

## 阶段间约束

1. 8.1 / 8.2 / 8.3 / 8.4 已基本闭环
2. 8.2.3 / 8.2.5 标 `[!]` 待用户重新立项；不进入当前迭代
3. 每个子任务独立 commit，可独立回退
4. 任意子任务遇到边界冲突立即停下问用户，禁止擅自决策
