# 执行计划与进度跟踪

> 唯一执行跟踪文档。仅记录当前进行中的计划与进度，不留历史归档与未来设想。

## 目标

在 core 内部按单一职责拆分 5 个混合职责大文件：拆出的新文件**留在原目录**，零逻辑改动；不迁移到 flows、不动 state，靠原文件转 facade / 保留主体 + re-export 使所有 core 外调用方（state/components/test）的 import 路径与符号**完全不变**。

## 范围边界

仅 core 内部拆分。不迁移、不改 core 外任何文件。流程归属（`registry` 的 snap 语义属 divination、`reading_panel_timing` 属 reading）仅在拆出文件头与 TODO 标注，待后续 flows 批次迁移，本批不迁。轻微混合小文件经实读评估为单一职责成立、不值得拆，本批不动：`animation/adapters/gsap.ts`（gsap 隔离单一职责）、`sizing/responsive_sizes.ts`、`sizing/overlay_layout/breakpoints.ts`、`sizing/overlay_layout/viewport_scene_layout.ts`、`api/client.ts`（拆会引入跨端 `#ifdef` 重复，违反 CLAUDE.md）。

## 调研结论

两轮实读调研已定方案，均确认可零逻辑改动达成单一职责。通用兼容惯例：原文件留作 facade 或保留主体并 re-export 拆出符号；barrel/facade 只 re-export 有运行时/测试消费者的符号（无消费者 re-export 会被 knip 判 dead export，门禁 fail）；拆出文件头 `Name/Purpose/Reason` 按新职责重写（项目有文件头遗留旧路径污染教训）。

## 任务清单

- [ ] S1 拆 `typewriter_model.ts`
  - 操作对象：`app/src/core/utils/typing/typewriter_model.ts`；新建同目录 `reading_panel_timing.ts`
  - 操作步骤：将原 `:120-153`（`TypewriterFieldTiming` / `calculateFieldTiming` / `calculateKeywordTiming`）整块迁入 `reading_panel_timing.ts`（文件头注明语义属 reading、加 `TODO(flows-batch)` 待迁注释；不带入 `prefersReducedMotion` import）；`typewriter_model.ts` 保留引擎 `:1-118` 并新增 `export { calculateFieldTiming, calculateKeywordTiming, type TypewriterFieldTiming } from './reading_panel_timing'`
  - 影响范围：新增 1 文件；`typewriter_model.ts` 内部缩减 + 加 re-export；`TypewriterText.vue`/`use_reading_panel_controller.ts`/`typewriter_model.test.ts` import 零变更
  - 验收点：vue-tsc 通过；时序常量逐字未改；相关单测全绿
  - 验收方式：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test typewriter_model.test.ts typewriter_text.test.ts`

- [ ] S2 拆 `scale.ts`
  - 操作对象：`app/src/core/sizing/scale.ts`；新建同目录 `raf_shim.ts`
  - 操作步骤：将原 `:69-112` rAF/cAF 跨端垫片（含 eslint 行禁用注释整块）迁入 `raf_shim.ts`，导出 `raf`/`caf`；`scale.ts` 保留 re-export 段 + 抖动阈值 + 单例 composable，改 `import { raf, caf } from './raf_shim'`；composable 单例三件套不再细拆（共享 `singletonState` 闭包，强拆即逻辑改动）。留意条件编译注释规范（CLAUDE.md `#ifdef` 注释禁则）
  - 影响范围：新增 1 文件；`scale.ts` 改 import；`pages/main`/`scale.test.ts`/`use_css_var_bridge`/`solve_from_window`/`viewport_scene_layout`/`layout_solver` 取符号零变更
  - 验收点：vue-tsc 通过；raf/caf 仍模块顶层一次性特性探测；抖动阈值/单例契约未改
  - 验收方式：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test scale.test.ts layout_solver.test.ts`

- [ ] S3 拆 `layout_solver.ts`
  - 操作对象：`app/src/core/sizing/layout_solver.ts`；新建同目录 `layout_solver_reading.ts`、`layout_solver_draw.ts`
  - 操作步骤：原 `:64-163`（`readingStageReservation`/`fitResultCard`/`solveReadingStageLayout`）迁 `layout_solver_reading.ts`；原 `:171-209`（`solveDrawStageLayout`）迁 `layout_solver_draw.ts`，两文件 import 改从 `./layout_solver_types`/`./layout_solver_computers`/`./scale` 直取；`layout_solver.ts` 保留类型 re-export 段 + `solveLayout` 调度（改 import 两新文件），分支调用顺序与参数逐字保留
  - 影响范围：新增 2 文件；`layout_solver.ts` 内部缩减；11 处外部 import（取 `solveLayout` + 类型）零变更
  - 验收点：vue-tsc 通过；`solveLayout` reading/draw 分支求解顺序与参数不变；`fitResultCard` 浮点等值判断未改
  - 验收方式：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test layout_solver.test.ts`

- [ ] S4 拆 `phase_progress_presenter.ts`
  - 操作对象：`app/src/core/utils/overlay_progress/phase_progress_presenter.ts`；新建同目录 `overlay_text.ts`
  - 操作步骤：原 `:42-56`（`OverlayText` 接口 + `DEFAULT_OVERLAY_TEXT`）迁 `overlay_text.ts`；presenter 保留三个 present* 函数 + 其余类型，新增 `export type { OverlayText } from './overlay_text'` 与 `export { DEFAULT_OVERLAY_TEXT } from './overlay_text'`（测试直连 presenter 取该常量，须 re-export）；`presentFooter` 不单拆（11 行、同关注点）；**barrel `overlay_progress/index.ts` 不得新增 `DEFAULT_OVERLAY_TEXT` re-export**（沿用本仓既有惯例）
  - 影响范围：新增 1 文件；presenter 内部缩减 + 两条 re-export；barrel 与测试路径符号零变更
  - 验收点：vue-tsc 通过；`DEFAULT_OVERLAY_TEXT` 字面量逐字未改；默认参数仍解析同一常量
  - 验收方式：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test overlay_progress_presenter.test.ts`

- [ ] S5 拆 `registry.ts`（最复杂，含隐式契约）
  - 操作对象：`app/src/core/animation/phases/registry.ts`；新建同目录 `phase_types.ts`、`phase_entry_snaps.ts`、`phase_manifest.ts`
  - 操作步骤：类型/常量契约（原 `:15-28`+`:50-75`：`OverlayPhase` 转发、`MAX_CUT_PILES`、`PhaseStep`、`PhaseSnapDeps`、`PhaseManifest`）→ `phase_types.ts`；三个 `snapTo*Entry`（原 `:77-191`，含不变式 JSDoc 原样）→ `phase_entry_snaps.ts`；`PHASE_MANIFEST`+`PHASE_STEPS`+查询/调度（原 `:193-279`）→ `phase_manifest.ts`（`snapToEntryState` 箭头包装原样引用 snap 函数，`PHASE_MANIFEST` 须在 `PHASE_STEPS` 前定义）；`registry.ts` 清空主体转 facade，re-export `phase_types`+`phase_manifest` 全部对外符号（含 `export type { OverlayPhase }`），snap 三函数不 re-export（无外部消费者）
  - 影响范围：新增 3 文件；`registry.ts` 转 facade；8 处外部 import + 3 测试路径符号零变更
  - 验收点：vue-tsc 通过；manifest→snap 引用链完整无环；snap 函数体逐字未改；`PHASE_STEPS` 求值顺序正确
  - 验收方式：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test overlay_phase_registry.test.ts overlay_phase_snap.test.ts replay_from_phase.test.ts overlay_progress_model.test.ts overlay_pipeline.test.ts`

- [ ] S6 全局回归
  - 操作对象：全仓校验，不改源码
  - 操作步骤：跑 full 质量门禁
  - 影响范围：全仓
  - 验收点：full gate 全步骤通过；knip exit 0、无新 dead export/file
  - 验收方式：`node scripts/quality_gate.js full` = exit 0

## 执行约束

每步：先按方案改文件 → 验收（vue-tsc + 针对性单测）→ 更新本文档勾选与进度 → commit（pre-commit 门禁真实跑通，禁绕过）→ 下一步。禁跳步。遇不合适命名必改；明显且无影响问题可改；影响大的搁置并记本文末「搁置问题」。

## 回滚

任一步验收失败即停并报告，不绕过门禁；改动未提交，`git checkout -- <file>` 与删除新建文件即可复原。

## 进度

未开始。

## 搁置问题

> 影响中等且非本批次职责，留待后续专项，勿在本批扩张范围。

1. `usePlayback`（`app/src/core/animation/use_playback.ts`，34 行）无独立单元测试（上一 use_overlay 批次遗留）。纯转发 `TimelineOrchestrator`，时间线编排已由 `overlay_timeline`/`overlay_pipeline` 覆盖，回归风险低。补测试属新增逻辑，超出"仅拆解"范围，搁置。
2. core 内 knip 既有基线噪音（`Unused exported types`、`scripts/lib` 的 `findOccupiers`）不触发失败退出码、不阻断门禁，非本批职责。
