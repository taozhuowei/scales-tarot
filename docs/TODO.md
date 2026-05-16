# 执行计划与进度跟踪

> 唯一执行跟踪文档。仅记录当前进行中的计划与进度，不留历史归档与未来设想。

## 目标

删除生产死代码 `app/src/state/use_overlay.ts`（`useOverlay` 在 `app/src` 零运行时调用），迁出其唯一存活导出常量，使测试对齐生产真实编排路径。

## 范围边界

本计划仅含 use_overlay 死代码删除批次。`flows/{idle,divination,reading}` 其余文件迁移与拆分报告中各未决项不在本计划，待逐项确认后另行追加登记。

## 调研结论

S1 已判定，S4 走**分支A（删除）**。依据：

- 死代码确认：`useOverlay` 在 `app/src` 零运行时调用；其 facade 独有派生（`cardsFocused`/`cardsDocked`/`resultCardLiftY`/`stageWidthPx`/`drawerWidthPx`/`overlayVarsStyle` 覆盖/`finish`/`skipToReading`/`replayFromPhase` 包装/`restart`）全仓无生产消费者，仅两测试经此入口断言。
- 生产等价实现已在别处：playback/进度/phase/start 能力存活于 `useAnimationController`（`pages/main` 直接实例化），底层由 `overlay_progress_model` / `overlay_progress_presenter` / `use_animation_state` / `overlay_pipeline` / `overlay_timeline` 独立测试覆盖；`resultCardLiftY` 生产真相在 `Deck.vue:115,130`（自有 computed + `--result-card-lift-y`，`DeckRig.vue:178` 消费）；`restart` 生产真相在 `use_main_handlers.ts:75 handleRestart`。`use_overlay` 内同名实现均为死副本；`--stage-width`/`--drawer-width` 仅死代码产出、无消费者。
- 测试处置：删 `use_overlay.test.ts`、`overlay_sizing.test.ts`（整体经死入口测试，独有断言覆盖死逻辑，转发能力底层已有独立覆盖）；**保留** `_helpers/overlay_card.ts`（`makeCard` 仍被 `tarot_store` / `reading_orchestrator` / `reading_orchestrator_retry` / `reading_result_presenter` 共用——修正原计划"可能一并删"判断）；更新 `replay_from_phase.test.ts:82` 注释移除对已删 `state/use_overlay.ts` 的提及。

## 任务清单

- [x] S1 判定死代码边界与测试覆盖性质
  - 操作对象：`app/src/state/use_overlay.ts`、`app/test/use_overlay.test.ts`、`app/test/overlay_sizing.test.ts`、`app/test/replay_from_phase.test.ts`、`app/test/_helpers/overlay_card.ts`、生产编排 `app/src/pages/main/index.vue` + `app/src/state/use_animation_controller.ts`
  - 操作步骤：复核 `useOverlay` 在 `app/src`（含 `#ifdef` 平台条件块）零运行时调用；判定两测试所测 `resultCardLiftY` / `cardsFocused` / `resultCardScale` 等派生在生产编排路径是否有等价实现；确认 `replay_from_phase.test.ts:82` 仅注释提及、`_helpers/overlay_card.ts` 是否仅服务这两测试
  - 影响范围：仅判定，无源码改动
  - 验收点：得出每个测试文件的处置结论（删除 / 重定向到生产实现 / 仅改注释保留）
  - 验收方式：`grep -rn` 全仓 + 阅读生产编排确认等价物有无；结论写入本文「调研结论」小节

- [x] S2 迁出存活常量 `RESULT_LIFT_MARGIN_PX`
  - 操作对象：新建 `app/src/flows/reading/composables/result_card_lift_margin.ts`、`app/src/components/Deck.vue:90`、`app/src/state/use_overlay.ts:17`
  - 归属修正：原计划落点 `divination/composables`，调研后改为 **reading/composables**——`Deck.vue:108-126` 该常量语义为"结果卡相对解读底部抽屉的上浮呼吸边距"（drawer = reading 窄屏抽屉），按代码语义属 reading 流程
  - 操作步骤：新建仅含 `RESULT_LIFT_MARGIN_PX` 的常量文件（带文件头职责注释 + 原行内语义注释）；`Deck.vue:90` import 改指向新文件；`use_overlay.ts` 删除本地 `export const` 定义、改为 import 新文件常量（其 `:78` 死逻辑仍引用，随 S3 整文件删除时 import 行一并消失）
  - 方案调整：原计划"保留 `use_overlay.ts:20` 本地定义至 S3"被质量门禁 `DuplicateExport` 否决（同一符号不可两处导出）；改为单一真相源 = 新文件，`use_overlay.ts` 仅 import 引用——零逻辑变化，符合门禁 "consolidate to a single canonical location"
  - 影响范围：新增 1 文件；`Deck.vue` 与 `use_overlay.ts` 各 1 处 import 路径变更，运行行为不变（常量值 16 不变）
  - 验收点：vue-tsc 通过；`state/use_overlay` 无任何外部 import
  - 验收方式：`npx vue-tsc --noEmit -p app/tsconfig.json` 无错误；`grep` 确认 `from '.../state/use_overlay'` 在 `app/src`/`app/test` 零命中 — 均已通过

- [x] S3 删除 `use_overlay.ts`
  - 操作对象：`app/src/state/use_overlay.ts`
  - 操作步骤：删除该文件（移除 `useOverlay` / `UseOverlayDeps` / 内部全部 computed，均死代码）
  - 影响范围：`app/src` 不再存在该模块；不影响生产编排（`pages/main` 直接编排 `useAnimationController` + `useReadingController`）
  - 验收点：`app/src` 内对 `../state/use_overlay` 的 import 数为 0；类型检查通过
  - 验收方式：`grep -rn "state/use_overlay'" app/src` 无输出；`npx vue-tsc --noEmit -p app/tsconfig.json`

- [ ] S4 按 S1 结论处置测试
  - 操作对象：`app/test/use_overlay.test.ts`、`app/test/overlay_sizing.test.ts`、`app/test/_helpers/overlay_card.ts`、`app/test/replay_from_phase.test.ts:82`
  - 操作步骤（S1 已定分支A）：删除 `use_overlay.test.ts`、`overlay_sizing.test.ts`；**保留** `_helpers/overlay_card.ts`（`makeCard` 被其它 4 测试共用）；更新 `replay_from_phase.test.ts:82` 注释移除对已删 `state/use_overlay.ts` 的提及
  - 影响范围：`app/test` 下 2 文件删除 + 1 文件注释更新；`_helpers/overlay_card.ts` 不动
  - 验收点：app 单测全绿，无跳过、无空断言；保留的测试覆盖真实生产逻辑，或已确认该逻辑随死代码消失
  - 验收方式：`npx vitest run --config app/vitest.config.ts --dir app/test`

- [ ] S5 全局回归
  - 操作对象：前端全量
  - 操作步骤：依次跑质量门禁、类型检查、app 单测、lint
  - 影响范围：全仓校验，不改源码
  - 验收点：四项全通过，无新增告警
  - 验收方式：`node scripts/quality_gate.js full`；`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test`；`npx eslint app/src/ app/test/`

## 回滚

任一步验收失败即停并报告，不绕过门禁；改动未提交，`git checkout -- <file>` 与删除新建文件即可复原。

## 进度

S1 完成（调研判定）。S2 完成（常量迁入 reading/composables，归属修正）。S3 完成（use_overlay.ts 已删，src vue-tsc exit 0、零引用）。进行中：S4。

## 搁置问题

> 影响中等且非本批次引入，留待后续专项处理，勿在本批次扩张范围。

1. `usePlayback`（`app/src/core/animation/use_playback.ts`，34 行）playback 控制无独立单元测试。删除 `use_overlay.test.ts` 后，经 facade 间接覆盖的 playback spy 测试消失；该能力为纯转发 `TimelineOrchestrator`，时间线编排已由 `overlay_timeline` / `overlay_pipeline` 覆盖，回归风险低。补测试属新增逻辑，超出本批"仅拆解/重命名/调路径/移动"范围，搁置。
