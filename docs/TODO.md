# 执行计划与进度跟踪

> 唯一执行跟踪文档。仅记录当前进行中的计划与进度，不留历史归档与未来设想。每个任务为独立单步：读「本任务描述 + 其超链接引用的文档与代码」即可获得全部上下文，知道怎么做、怎么测。

## 目标

把 `app/src/flows/` 重构为「持久 Shell + 每 flow 自管 + 共享归 shared + flow 视觉逻辑从 state 下沉」架构。先建好全部目标目录，再把架构写进 [flows/README.md](../app/src/flows/README.md)，再按零行为变更优先、reading 4:6 flex 末批的顺序分单步重构。

## 最终架构

### 目标目录树（标注 新建 / 迁自X / 保留）

```
app/src/flows/
  README.md                                改写（去 views/ 与 registry 旧述）
  shared/
    components/
      Shell.vue                            新建  持久骨架 HeaderArea(单一可换页眉)+Stage>Deck；page 无 key 渲染、永不 remount；逐字平移 PlayView.vue:32-59
      Stage.vue                            迁自 flows/shared/Stage.vue
      Deck.vue                             迁自 flows/shared/Deck.vue（移除 :115-126 resultCardLiftY 内联）
      Card.vue                             新建  单一卡牌，props 形态=纯牌背 | 完整双面(牌面+牌背)；牌堆仅中央结果卡完整双面、抽牌落下翻开
      HeaderArea.vue                       迁自 flows/shared/HeaderArea.vue
      TitleContent.vue                     迁自 flows/shared/TitleContent.vue（idle+fallback 双 variant，多处用→shared）
      NotificationHost.vue                 迁自 flows/shared/
      DevToolsPanel.vue + 5 子行 SFC       迁自 flows/shared/（不另设 dev/ 子层）
    composables/
      use_header_metrics.ts                新建  页眉尺寸/位置基线，Title/Progress 共用（集中 CSS 常量，视觉零风险）
      use_play_deck.ts                     迁自 state/use_play_deck_animation.ts（Deck 装配 fan/rig/click）
      play/click_handler.ts                迁自 state/play/click_handler.ts
      play/play_deck_runtime_types.ts      迁自 state/play/play_deck_runtime_types.ts
      use_card_motion.ts                   新建  Card 翻牌/落下控制，派生注入 animationController、不重复其状态
  idle/
    index.vue                              新建  idle 壳：page 以 v-show by phase 控显隐；持本 flow 非舞台 UI 接线
    components/DeckFanStack.vue            迁自 flows/idle/views/DeckFanStack.vue（v-for→<Card 纯牌背>）
    composables/use_fan_loop.ts            迁自 state/play/fan_controller.ts（保留导出名）
  divination/
    index.vue                              新建  divination 壳：v-show by phase
    components/
      ProgressContent.vue                  迁自 flows/divination/views/ProgressContent.vue
      ProgressIcon.vue                     新建  单阶段图标(双 image 堆叠)，ProgressContent v-for ×4
      DeckRig.vue                          迁自 flows/divination/views/DeckRig.vue（堆叠 v-for→<Card 纯牌背>，中央→<Card 完整双面>）
    composables/use_divination_rig.ts      迁自 state/play/divination_rig.ts（保留导出名）
  reading/
    index.vue                              新建  按注入 isWide 选 Split/Drawer（上移 pages/main/index.vue:30-54）；不含常驻物，v-if 可挂卸
    components/                            迁自 flows/reading/views/ 8 个 SFC：
      ReadingSplitView ReadingDrawerView ReadingPanel ConclusionContainer
      CardMeaningContainer ReadingTextContainer TypewriterText ActionArea
    composables/
      use_reading_panel_view_model.ts      迁自 state/shared/use_reading_panel_controller.ts
      use_result_card_geometry.ts          新建  合并 state/use_result_card_shrink.ts + Deck:115-126 + result_card_lift_margin
  fallback/
    index.vue                              新建  HeaderArea>TitleContent(fallback)+Stage>FallbackOrbits；并入消灭游离 app/src/fallback/
    components/FallbackOrbits.vue           迁自 app/src/fallback/FallbackOrbits.vue
```

边界：`core/**`、`store/**`、应用级 `state/*`（[use_app_phase](../app/src/state/use_app_phase.ts) / [use_active_view](../app/src/state/use_active_view.ts) / use_animation_controller / use_reading_controller / use_main_handlers / use_phases / use_presentation / use_lifecycle / commands/**）原地不动；`core→flows` 零反向依赖（实读已验）。`pages/main/index.vue` 保留为编排者+唯一 provider；`pages/fallback/index.vue` 仅改 import。迁空后删 `state/play/`、`state/shared/`、`app/src/fallback/`。

### 组合机制（核心不变量解法，业内持久 layout 模式，已验证）

1. `pages/main/index.vue` 无条件、不加 key 渲染 `<Shell/>` → Shell 内 Stage/Deck 整个 app 生命周期单实例、零 remount（task 8.2.3 不变量构造性保证）。
2. idle↔divination 唯一 DOM 变更：Shell 内 HeaderArea 的单个 `<component :is="phaseHeader">`（注入 appPhase 决定，外裹 `<Transition>`）；Stage/Deck 为该 swap 之外稳定兄弟 vnode，零 re-render、零 remount。
3. `flows/{idle,divination}/index.vue` 与 Shell 同级兄弟、始终挂载，page 用 `v-show` 按 phase 控显隐；`flows/reading/index.vue` 不含常驻物，`v-if="showReadingView"` 真实挂卸。
4. 不用 Teleport（uni-app mp-weixin 不支持 Teleport/Suspense，已验证）；页眉结构上在 Shell 内，flow 只贡献组件不贡献 DOM 位置。
5. provide/inject 链不变：page 仍唯一 provider，Shell 与各 flow 全走 inject。
6. e2e 全程锚定类名 `.idle-deck-content` / `.progress-content__step-icon` / `.reading-split-view` / `.reading-drawer-view__sheet`，重构全程不得改这些类名，确保零 e2e 回归。

## 决策冻结

1. reading 解读空间：以 4:6 flex 为准，废 `MAX_CANVAS_WIDTH=440` 居中模型（宽屏横向 4:6、窄屏纵向 4:6，占卜 pane 等比缩小）。
2. Card：单一组件，props 控形态（纯牌背 | 完整双面 牌面+牌背）；仅中央结果卡完整双面、抽牌落下翻开；翻/落控制下沉 `shared/composables/use_card_motion.ts`。
3. 归属：多处用→`flows/shared/`；TitleContent→shared/components（idle+fallback），ProgressContent→divination/components（divination 专属）；组件→`components/`，逻辑→`composables/`。
4. Shell 为独立共享组件置 `shared/components/`，不内联进 page（实读：`scripts/quality_scan.js:505` >300 行 WARN，内联会破 baseline 棘轮、违单一职责；`config/dependency-cruiser.cjs` 无分层禁则故合法）。
5. fallback 并入 `flows/fallback/`，消灭游离 `app/src/fallback/`。
6. idle 卡资源错误带：留 Deck 内 `isIdle&&cardsLoadError`，随骨架 byte-identical 平移进 Shell（零行为变更）。
7. flow 逻辑迁移仅改文件名、保留原导出函数名（最小 diff）；`result_card_lift_margin` 并入 `use_result_card_geometry`。
8. 组件命名保留 `TitleContent`/`ProgressContent`（最小 churn）；DevTools 6 件入 `shared/components/` 不另设子层；idle/divination 的 index.vue 初期为薄壳（满足每 flow 各有 index.vue 意图、为演进留位）。

## 任务清单

> 每步：按操作改 → 验收（命令逐条跑通）→ 更新本文档勾选与「进度」→ commit（[pre-commit 门禁](../README.md) 真实跑通，禁 `--no-verify`/`--force`/任何绕过）→ 下一步。禁跳步。分提交前 `git stash push --staged` 隔离他人改动。每步须保持 vue-tsc + `vitest --dir app/test` + `node scripts/quality_gate.js full` 全绿后方可提交。

- [ ] T1 建全部目标目录骨架
  - 上下文：本文件「最终架构 → 目标目录树」。仅建目录，不动任何现有文件内容。
  - 操作：按目标树建空目录并各放 `.gitkeep`：`app/src/flows/shared/{components,composables}`、`app/src/flows/shared/composables/play`、`app/src/flows/idle/{components,composables}`、`app/src/flows/divination/{components,composables}`、`app/src/flows/reading/{components,composables}`、`app/src/flows/fallback/{components}`。保留现有 `views/`、`composables/.gitkeep` 不动（后续步骤迁移后再清理）。
  - 验收：`find app/src/flows -type d` 与目标树一致；`node scripts/quality_gate.js full` = exit 0（新增空目录+gitkeep 不影响门禁）。
  - 影响：仅新增空目录。回滚：删新建目录。

- [ ] T2 写 flows/README 新架构
  - 上下文：本文件「最终架构」「决策冻结」；现 [flows/README.md](../app/src/flows/README.md)（旧 views/registry 描述将被覆盖）；文档约定见 [CLAUDE.md](../CLAUDE.md) 与 docs 编写硬约束（无废话、索引必超链接、无表格）。
  - 操作：覆盖重写 `app/src/flows/README.md`：写清最终目录结构（每 flow `index.vue`+`components/`+`composables/`、`shared/{components,composables}`、fallback 并入）、组合机制 6 条、目录即语义约定、Shell 持久不加 key 与 e2e 类名不变约束。所有引用用相对超链接，禁表格。
  - 验收：README 覆盖目录树+组合机制+约定且与本文件「最终架构」一致；无 markdown 表格；`node scripts/quality_gate.js full` = exit 0。
  - 影响：仅文档。回滚：`git checkout -- app/src/flows/README.md`。

- [ ] T3 迁 shared 原子组件 → shared/components
  - 上下文：源 [Stage.vue](../app/src/flows/shared/Stage.vue) [HeaderArea.vue](../app/src/flows/shared/HeaderArea.vue) [TitleContent.vue](../app/src/flows/shared/TitleContent.vue) [NotificationHost.vue](../app/src/flows/shared/NotificationHost.vue) [DevToolsPanel.vue](../app/src/flows/shared/DevToolsPanel.vue) 及其 5 个 DevTools 子行 SFC；现 importer：[PlayView.vue](../app/src/flows/shared/PlayView.vue)、[app/src/fallback/FallbackView.vue](../app/src/fallback/FallbackView.vue)、[pages/main/index.vue](../app/src/pages/main/index.vue:96)。
  - 操作：`git mv` 上述 SFC 到 `app/src/flows/shared/components/` 同名；全量修正所有 importer 相对路径；DevToolsPanel 对 5 子行同目录 import 保持。文件内容零改动（仅位置）。
  - 验收：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test`；`node scripts/quality_gate.js full` = exit 0。
  - 影响：import 路径。回滚：反向 `git mv` + 还原 import。

- [ ] T4 迁 reading 8 SFC → reading/components
  - 上下文：源 [flows/reading/views/](../app/src/flows/reading/views/) 8 个 SFC；唯一按路径强引用的测试 [app/test/typewriter_text.test.ts](../app/test/typewriter_text.test.ts:6)；importer [pages/main/index.vue](../app/src/pages/main/index.vue:94)。
  - 操作：`git mv` 8 SFC 到 `app/src/flows/reading/components/`；修组件间相对 import（同目录互引不变）、对 `../../../core/*`/`../../../store/*` 升级层级、`pages/main` import、`typewriter_text.test.ts:6` 路径。内容零改动。
  - 验收：vue-tsc；`npx vitest run --config app/vitest.config.ts --dir app/test typewriter_text.test.ts`；全量 `vitest --dir app/test`；`npx playwright test --config=app/playwright.config.ts`（reading 相关）；full gate = exit 0。
  - 影响：import + 1 测试路径。回滚：反向 `git mv` + 还原。

- [ ] T5 迁 idle/divination 视图 → 各 flow components
  - 上下文：源 [DeckFanStack.vue](../app/src/flows/idle/views/DeckFanStack.vue) [DeckRig.vue](../app/src/flows/divination/views/DeckRig.vue) [ProgressContent.vue](../app/src/flows/divination/views/ProgressContent.vue)；importer [Deck.vue](../app/src/flows/shared/Deck.vue:92) [PlayView.vue](../app/src/flows/shared/PlayView.vue:87)。
  - 操作：`git mv` DeckFanStack→`idle/components/`，DeckRig+ProgressContent→`divination/components/`；修 Deck/PlayView import 与三者对 `state/*` 的相对层级。内容零改动。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright`（占卜全流程动画用例）；full gate = exit 0。
  - 影响：import 路径。回滚：反向 `git mv` + 还原。

- [ ] T6 迁 Deck → shared/components
  - 上下文：源 [Deck.vue](../app/src/flows/shared/Deck.vue)；依赖 idle/divination components(T5 后)、`state/use_play_deck_animation`、`flows/reading/composables/result_card_lift_margin`。
  - 操作：`git mv` Deck.vue→`app/src/flows/shared/components/Deck.vue`；修其对 `../../idle/components/DeckFanStack`、`../../divination/components/DeckRig`、`../../../state/*`、reading composable 的相对路径；importer（PlayView）同步。内容零改动（resultCardLiftY 内联保留至 T14 再迁）。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright`；full gate = exit 0。
  - 影响：import 路径。回滚：反向 `git mv` + 还原。

- [ ] T7 新建 Shell.vue 并删 PlayView
  - 上下文：源骨架 [PlayView.vue:32-59](../app/src/flows/shared/PlayView.vue)（含其 `<style scoped>` 全部 `.play-view*` 规则）；importer [pages/main/index.vue:93](../app/src/pages/main/index.vue)；组合机制见本文件「最终架构 → 组合机制」第 1/2 条；类名不变约束见第 6 条。
  - 操作：新建 `app/src/flows/shared/components/Shell.vue`，把 PlayView 模板 `:32-59` 与对应 scoped CSS **逐字平移**（DOM 结构、class、inline-style、`isIdle` 三元页眉、Stage>Deck、idle 错误带、ARIA、retry emit 全部 byte-identical）；删 `PlayView.vue`；`pages/main/index.vue` 改 `import Shell` 渲 `<Shell/>`（替换 `<PlayView>`，props/emit 不变）。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright`（divination_flow + viewport_smoke 全绿，类名未变即应绿）+ idle/divination 截图与重构前 byte-identical 比对；full gate = exit 0。
  - 影响：删 1 文件、新增 1 文件、page import。回滚：恢复 PlayView、删 Shell、还原 page。

- [ ] T8 建 flow index.vue 并改 page 组合
  - 上下文：现 reading 覆盖块 [pages/main/index.vue:30-54](../app/src/pages/main/index.vue)（split/drawer 二选一）；组合机制第 3 条；薄壳决策见「决策冻结」#8。
  - 操作：新建 `flows/idle/index.vue`、`flows/divination/index.vue`（初期薄壳，预留各 flow 非舞台 UI 挂载点）、`flows/reading/index.vue`（把 `:30-54` 的 `v-if isWide` Split / `v-else` Drawer 整体上移进来，props/emit 转发不变，注入 isWide/readingController）；`pages/main/index.vue` 模板改为：`<Shell/>` + `<IdleFlow v-show="phase==='idle'"/>` + `<DivinationFlow v-show="phase!=='idle'"/>` + `<ReadingFlow v-if="showReadingView"/>` + Notification + DevTools。provide 不变。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright` 全流程（idle→divination→reading→decision，宽/窄）与 T7 行为等价 + 截图无回归；full gate = exit 0。
  - 影响：新增 3 文件、page 模板与 import。回滚：还原 page、删 3 文件。

- [ ] T9 fallback 并入 flows
  - 上下文：源 [app/src/fallback/FallbackView.vue](../app/src/fallback/FallbackView.vue)（import shared HeaderArea/TitleContent/Stage）、[FallbackOrbits.vue](../app/src/fallback/FallbackOrbits.vue)；importer [pages/fallback/index.vue:24](../app/src/pages/fallback/index.vue)；路由证据 [pages.json](../app/src/pages.json)。
  - 操作：`git mv` FallbackOrbits→`flows/fallback/components/FallbackOrbits.vue`；新建 `flows/fallback/index.vue`（迁自 FallbackView，import 改 `../shared/components/{HeaderArea,TitleContent,Stage}` + `./components/FallbackOrbits`）；删 `app/src/fallback/FallbackView.vue` 与空目录 `app/src/fallback/`；`pages/fallback/index.vue` import 改指 `../../flows/fallback/index.vue`。
  - 验收：vue-tsc；`vitest --dir app/test`；fallback 路由 playwright/手测渲染正常；full gate = exit 0（depcruise no-orphans 不报）。
  - 影响：迁/删 fallback、pages/fallback import。回滚：恢复 app/src/fallback、还原 import。

- [ ] T10 下沉 idle 扇形逻辑 → flows/idle/composables
  - 上下文：源 [state/play/fan_controller.ts](../app/src/state/play/fan_controller.ts)；唯一消费 [state/use_play_deck_animation.ts](../app/src/state/use_play_deck_animation.ts)。
  - 操作：`git mv`→`flows/idle/composables/use_fan_loop.ts`，**保留原导出名**；修消费方 import。内容零改动。
  - 验收：vue-tsc；`vitest --dir app/test`（fan/deck 相关）；`playwright`（idle 扇形 + idle→divination）；full gate + knip 无新增 unused = exit 0。
  - 影响：1 文件路径 + 1 importer。回滚：反向 `git mv` + 还原。

- [ ] T11 下沉 divination rig 逻辑 → flows/divination/composables
  - 上下文：源 [state/play/divination_rig.ts](../app/src/state/play/divination_rig.ts)；消费 [state/use_play_deck_animation.ts](../app/src/state/use_play_deck_animation.ts)。
  - 操作：`git mv`→`flows/divination/composables/use_divination_rig.ts`，保留导出名；修 importer。内容零改动。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright`（占卜 rig 全流程）；full gate + knip = exit 0。
  - 影响：1 文件 + importer。回滚：反向 `git mv` + 还原。

- [ ] T12 下沉 Deck 装配逻辑 → flows/shared/composables
  - 上下文：源 [state/use_play_deck_animation.ts](../app/src/state/use_play_deck_animation.ts)、[state/play/click_handler.ts](../app/src/state/play/click_handler.ts)、[state/play/play_deck_runtime_types.ts](../app/src/state/play/play_deck_runtime_types.ts)；消费 [Deck.vue:89](../app/src/flows/shared/components/Deck.vue)。
  - 操作：`git mv` use_play_deck_animation→`flows/shared/composables/use_play_deck.ts`，click_handler/play_deck_runtime_types→`flows/shared/composables/play/`；保留导出名；修 Deck 与内部相互 import（对 `state/*`/`core/*` 层级重算）；删空 `state/play/`。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright`（点击触发占卜 + 全流程）；full gate + knip = exit 0。
  - 影响：3 文件路径 + import 链。回滚：反向 `git mv` + 还原 + 恢复 state/play。

- [ ] T13 下沉 reading panel 视图模型 → flows/reading/composables
  - 上下文：源 [state/shared/use_reading_panel_controller.ts](../app/src/state/shared/use_reading_panel_controller.ts)；消费 reading 三容器 [CardMeaningContainer](../app/src/flows/reading/components/CardMeaningContainer.vue) [ReadingTextContainer](../app/src/flows/reading/components/ReadingTextContainer.vue) [ConclusionContainer](../app/src/flows/reading/components/ConclusionContainer.vue)。
  - 操作：`git mv`→`flows/reading/composables/use_reading_panel_view_model.ts`，保留导出名；修三容器 import 为 `../composables/use_reading_panel_view_model`、其内部对 `core/utils/*` 层级重算；删空 `state/shared/`。
  - 验收：vue-tsc；`vitest --dir app/test`（reading/typewriter 相关）；`playwright`（解读打字机全流程）；full gate + knip = exit 0。
  - 影响：1 文件 + 3 importer。回滚：反向 `git mv` + 还原 + 恢复 state/shared。

- [ ] T14 合并 reading 结果卡几何 → use_result_card_geometry
  - 上下文：源 [state/use_result_card_shrink.ts](../app/src/state/use_result_card_shrink.ts)、[Deck.vue:115-126](../app/src/flows/shared/components/Deck.vue) 的 resultCardLiftY、[reading/composables/result_card_lift_margin.ts](../app/src/flows/reading/composables/result_card_lift_margin.ts)；page 调用 [pages/main/index.vue:107,171-177](../app/src/pages/main/index.vue)。
  - 操作：新建 `flows/reading/composables/use_result_card_geometry.ts`，把三处逻辑**逐字搬运合并**（不改算法/数值/浮点判定），`result_card_lift_margin` 常量并入；Deck 改 inject/调用该 composable 取 liftY；`pages/main` 的 `useResultCardShrink` 调用改指新 composable；删 `state/use_result_card_shrink.ts` 与原 `result_card_lift_margin.ts`。
  - 验收：vue-tsc；`vitest --dir app/test`（layout/shrink/lift 相关全绿）；`playwright`（窄屏抽屉首次 reveal 卡尺寸/上移与重构前截图 byte-identical）；full gate + knip = exit 0。
  - 影响：3 处合 1、Deck 与 page 调用。回滚：还原三源文件、删新文件、还原调用。

- [ ] T15 抽 use_header_metrics（Title/Progress 共享）
  - 上下文：源页眉基线 [TitleContent.vue:167](../app/src/flows/shared/components/TitleContent.vue)、[ProgressContent.vue:94](../app/src/flows/divination/components/ProgressContent.vue)（均用 `calc((var(--header-height)-44px)/2)` + 44px 图标常量）；决策冻结 #3。
  - 操作：新建 `flows/shared/composables/use_header_metrics.ts`，集中页眉基线常量/计算（保持仍由 CSS 变量驱动，组件 CSS 表达式不改语义，视觉零风险）；Title/Progress 改为引用同一来源消除重复常量。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright` + 页眉 idle/divination 基线截图与重构前 byte-identical；full gate = exit 0。
  - 影响：新增 1 文件、2 组件引用。回滚：删文件、还原 2 组件。

- [ ] T16 抽 ProgressIcon（×4 子组件）
  - 上下文：源 [ProgressContent.vue](../app/src/flows/divination/components/ProgressContent.vue) 的单阶段双 image 堆叠块；e2e 锚定类名 `.progress-content__step-icon` 不得改（组合机制第 6 条）。
  - 操作：新建 `flows/divination/components/ProgressIcon.vue`，把单阶段 inactive/active 双 image 堆叠整体抽出（class/inline 行为 byte-identical，保留 e2e 类名）；`ProgressContent` 改 `v-for` 渲 `ProgressIcon` ×4。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright`（progress e2e 选择器仍命中 + 4 阶段高亮推进截图无回归）；full gate = exit 0。
  - 影响：新增 1 文件、ProgressContent 改写。回滚：删文件、还原 ProgressContent。

- [ ] T17 抽 Card + use_card_motion
  - 上下文：源卡牌渲染 [DeckFanStack.vue](../app/src/flows/idle/components/DeckFanStack.vue)（卡背 v-for）、[DeckRig.vue](../app/src/flows/divination/components/DeckRig.vue)（堆叠 v-for + 中央翻牌 3D 双面 + animationController 驱动）；决策冻结 #2；类名不变约束第 6 条。
  - 操作：新建 `flows/shared/components/Card.vue`，props 控形态（纯牌背 | 完整双面 牌面+牌背背靠背），class/inline-style 透传，核心渲染外的翻/落控制下沉新建 `flows/shared/composables/use_card_motion.ts`（派生注入 animationController 面、不重复其状态、按单一职责拆文件，逻辑少则保留 Card 内）；DeckFanStack 全 v-for 改渲 `<Card 纯牌背>`；DeckRig 堆叠 v-for 改渲 `<Card 纯牌背>`、中央抽牌位改渲 `<Card 完整双面>`；DOM/class/inline-style/动画 target key byte-identical。
  - 验收：vue-tsc；`vitest --dir app/test`；`playwright`（摊牌/洗牌/切牌/抽牌/翻牌全流程与重构前截图 byte-identical，时序与 animationController 一致）；full gate = exit 0。
  - 影响：新增 2 文件、2 Deck 子件改写。回滚：删 2 文件、还原 2 子件。

- [ ] T18 glossary 去行为化（纯术语）
  - 上下文：[docs/prd/glossary.md](prd/glossary.md)（含行为/布局描述如「从屏幕右外侧滑入到右半屏，与占卜视图左右分栏」「高度上限不超过结果卡牌底部，可手动拖动调整」「不越过结果卡牌底部」）；文档约定见 [CLAUDE.md](../CLAUDE.md)（glossary 仅术语→中文释义）。
  - 操作：审计 `docs/prd/glossary.md`，把行为/布局/过渡描述删改为纯术语指代（不写 4:6、不写分栏/拖动行为），相应行为描述确认已由 `view.md`/`animation.md` 承载（T19 同步）。仅文档，安全先做（与现实现无关）。
  - 验收：glossary 仅含术语释义、无行为/布局；无表格；`node scripts/quality_gate.js full` = exit 0。
  - 影响：仅文档。回滚：`git checkout -- docs/prd/glossary.md`。

- [ ] T19 reading 4:6 flex 重构（唯一行为变更，重点回归）
  - 上下文：现模型 [pages/main/index.vue:243-259](../app/src/pages/main/index.vue)（.canvas 440 定宽+translateX 居中）、[ReadingSplitView.vue:68-93](../app/src/flows/reading/components/ReadingSplitView.vue)（left:440 absolute）、[ReadingDrawerView.vue](../app/src/flows/reading/components/ReadingDrawerView.vue)；几何 [use_result_card_geometry](../app/src/flows/reading/composables/use_result_card_geometry.ts)、[use_active_view.ts](../app/src/state/use_active_view.ts)；PRD [view.md](prd/view.md) [animation.md](prd/animation.md)；决策冻结 #1。
  - 操作：`pages/main/index.vue` `.canvas`/`.is-reading-wide` 与 reading flow 根 CSS：absolute/translateX/440cap → flex；常驻层与 ReadingFlow 为 flex 兄弟，宽屏横向 `flex 4:6`、窄屏纵向 `flex 4:6`，占卜 pane 随 reading 出现等比缩小；适配 `use_result_card_geometry`（lift/shrink 改为适配 flex 缩放而非覆盖补偿）；核对 `use_active_view`；同一步同步改 `docs/prd/view.md`、`docs/prd/animation.md` 为 4:6 flex 模型、废 440cap 居中描述（文档随代码）。
  - 验收：vue-tsc；`vitest --dir app/test`（layout_solver/use_active_view 相关全绿）；`playwright`（宽屏分栏 + 窄屏抽屉 + 拖动 + 多视口 viewport_smoke 全绿 + 截图无错位/跳变）；PRD 与实现一致；full gate = exit 0。
  - 影响：主页面布局模型、reading 几何、2 PRD 文档。回滚：`git revert` 本步提交（独立批，不与他步混合）。

- [ ] T20 全局回归
  - 上下文：全仓。
  - 操作：`node scripts/quality_gate.js full` + 全量 `npx playwright test --config=app/playwright.config.ts` + 视觉比对汇总；核对 knip 无新增 unused file/export、`state/play`+`state/shared`+`app/src/fallback` 已删尽、`flows/*/views/` 残留与空 `.gitkeep` 清理。
  - 验收：full gate = exit 0；e2e 全绿；knip 无新增；视觉无回归。
  - 影响：不改源码（仅清理残留）。回滚：按失败项定位对应 T 步 `git revert`。

## 执行约束

每步先改 → 验收（vue-tsc 用 [vue-tsc 不用 tsc](../CLAUDE.md)；vitest 必带 `--dir app/test` 匹配 config；T7/T8/T14/T16/T17/T19 加 playwright + 截图比对）→ 更新本文档勾选与「进度」→ commit（pre-commit 真实跑通，禁绕过；分提交前 `git stash push --staged` 隔离他人改动）→ 下一步。禁跳步。重构全程不得改 e2e 锚定类名（组合机制第 6 条）。遇不合适命名必改；明显且无影响问题可改；影响大的搁置并记本文末。

## 回滚

任一步验收失败即停并报告，不绕过门禁。改动未提交：`git checkout -- <file>` + 删新建文件 + 反向 `git mv` 复原。已提交：按步粒度 `git revert` 对应提交，不跨步混合（T19 尤须独立）。

## 进度

待 T1 开始。

## 搁置问题

> 影响中等且非本批职责，留待后续专项，勿在本批扩张范围。

（暂无）
