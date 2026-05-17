# 执行计划与进度跟踪

> 唯一执行跟踪文档。仅记录当前进行中的计划与进度，不留历史归档与未来设想。每个任务为独立单步：读「本任务描述 + 其超链接引用的文档与代码」即可获得全部上下文，知道怎么做、怎么测。

## 目标

把动画相关代码按分层重构：`core/gsap/` 仅留对 GSAP 库本身的封装；动画基建（状态/原子/管道/契约）下沉 `composables/shared/animations/`；占卜/待机/降级三类流程编排迁入 `composables/flows/{divination,idle,fallback}/`。删除纯转发壳（`registry`、`phase_types` 伞文件、`overlay_progress/index`），解散定位模糊的 `core/flow/`，消除 `core→composables` 反向依赖。命名直观化：看名知意。

## 禁止项（决策冻结）

1. 禁止修改任何内部动画/布局/编排核心逻辑：各 builder 的 GSAP 关键帧/时序/缓动、[computeDrawTimings/appendCardDealTween](../app/src/core/animation/phases/draw/draw_timeline.ts)、snap 赋值、style-sync 同步算法、pipeline 执行算法——逐字保留。允许的仅：文件移动、改名、删纯转发壳、改 import 路径、按归属合并/拆分类型声明（声明本身不改）。
2. `core/gsap` 是 GSAP 封装集合（编排器 + 批量 kill），非"全项目唯一 import gsap"——builder/原子/fan/orbits 内部仍各自 `import gsap` 写关键帧（属核心逻辑，不重写）。
3. 不改 e2e 锚定类名与任何运行时行为；重构零行为变更。
4. 每阶段独立可编译、测试绿后方可 commit；禁跳阶段；禁 `--no-verify`/`--force`/任何门禁绕过；分提交前 `git stash push --staged` 隔离他人改动。

## 最终架构（目标目录树，标注 新建 / 迁自X / 删除）

```
app/src/core/gsap/
  timeline.ts                  迁自 core/animation/adapters/gsap.ts（TimelineOrchestrator + createTimelineOrchestrator，逐字）
  tween.ts                     迁自 core/animation/adapters/gsap.ts（killAnimationTargets，逐字）

app/src/composables/shared/animations/
  contracts.ts                 新建：合并 core/flow/types.ts(OverlayPhase/PhaseContext/PhaseRunner) + core/animation/atoms/types.ts(AtomFn/AtomContext)
  card_state.ts                迁自 core/animation/types.ts（CardState/CenterCardState/DrawCardState/InnerState/AnimationTimeline）
  state.ts                     迁自 core/animation/state.ts（含从 adapters 内联的 getAllTargets）
  style_sync.ts                迁自 core/animation/reconciler.ts（改名；导出名不改）
  visibility.ts                迁自 core/animation/visibility.ts
  initial_states.ts            迁自 core/animation/initial_states.ts
  use_animation_state.ts       迁自 core/animation/use_animation_state.ts（组合根）
  use_playback.ts              迁自 core/animation/use_playback.ts
  pipeline.ts                  迁自 core/animation/pipeline.ts
  flip.ts                      迁自 core/animation/atoms/flip.ts
  grow.ts                      迁自 core/animation/atoms/grow.ts

app/src/composables/flows/divination/
  phases/shuffle.ts            迁自 core/animation/phases/shuffle/builder.ts
  phases/cut.ts                迁自 core/animation/phases/cut/builder.ts
  phases/draw.ts               迁自 core/animation/phases/draw/builder.ts
  phases/draw_timeline.ts      迁自 core/animation/phases/draw/draw_timeline.ts
  phases/reveal.ts             迁自 core/animation/phases/reveal/builder.ts
  phase_manifest.ts            迁自 core/animation/phases/phase_manifest.ts（吸收 phase_types 的 PhaseStep/PhaseManifest/MAX_CUT_PILES）
  phase_entry_snapshots.ts     迁自 core/animation/phases/phase_entry_snaps.ts（吸收 phase_types 的 PhaseSnapDeps）
  pipeline_deps.ts             迁自 core/flow/pipeline_shared_deps.ts
  progress_model.ts            迁自 core/utils/overlay_progress/phase_progress_model.ts
  progress_presenter.ts        迁自 core/utils/overlay_progress/phase_progress_presenter.ts
  overlay_text.ts              迁自 core/utils/overlay_progress/overlay_text.ts

app/src/composables/flows/idle/
  fan.ts                       迁自 core/animation/phases/fan/builder.ts

app/src/composables/flows/fallback/
  orbits.ts                    迁自 core/animation/phases/fallback/builder.ts

删除：core/animation/adapters/gsap.ts、core/animation/types.ts、core/animation/atoms/types.ts、
      core/flow/types.ts、core/animation/phases/registry.ts、core/animation/phases/phase_types.ts、
      core/utils/overlay_progress/index.ts、空目录 core/animation/、core/flow/、core/utils/overlay_progress/
不动（仅改 import）：composables 顶层调用方、components/DevToolsPanel.vue、DevToolsPhaseRow.vue、
      components/FallbackOrbits.vue、app/test/ 相关测试用例（逻辑不动，仅 import 路径）
```

边界：`core/deck/*`、`core/sizing/*`、`core/utils/*`（除 overlay_progress）、`core/store/*` 不动；`core→composables` 重构后零反向依赖（P4 后 overlay_progress 上移即根除）。

## 任务清单

> 每步：按操作改 → 验收（命令逐条 exit 0）→ 更新「进度」勾选 → commit（[pre-commit 门禁](../README.md) 真实跑通）→ 下一步。禁跳步。

- [x] P0 清空并重写本 TODO（本步）
  - 操作：覆盖 `docs/TODO.md` 为本计划。
  - 验收：本文件为新计划；`node scripts/quality_gate.js full` = exit 0。
  - 影响：仅文档。回滚：`git checkout -- docs/TODO.md`。

- [x] P1 建 core/gsap，拆 adapters/gsap.ts
  - 上下文：源 [core/animation/adapters/gsap.ts](../app/src/core/animation/adapters/gsap.ts)（getAllTargets / TimelineOrchestrator / createTimelineOrchestrator / killAnimationTargets）；getAllTargets 唯一消费者 [use_animation_state.ts:11,93](../app/src/core/animation/use_animation_state.ts)。
  - 操作：
    1. 新建 `app/src/core/gsap/timeline.ts`：逐字搬入 `TimelineOrchestrator` 接口 + `createTimelineOrchestrator`（含 `import gsap`、tree-shaking 注释）。
    2. 新建 `app/src/core/gsap/tween.ts`：逐字搬入 `killAnimationTargets`（含 `import gsap`）。
    3. `getAllTargets(state)` 函数体逐字内联进 [use_animation_state.ts](../app/src/core/animation/use_animation_state.ts) 第 93 行调用点（删 `import { getAllTargets } from './adapters/gsap'`，改为本文件内 `function getAllTargets(state){…}` 原样拼接，不改逻辑）。
    4. 删除 `app/src/core/animation/adapters/`（整目录）。
    5. 改 import（路径按各文件位置实算）：[use_playback.ts:9-10](../app/src/core/animation/use_playback.ts) `./adapters/gsap`→`../gsap/timeline`；[pipeline.ts:15](../app/src/core/animation/pipeline.ts) `./adapters/gsap`→`../gsap/timeline`；[use_lifecycle.ts:12](../app/src/composables/use_lifecycle.ts) `../core/animation/adapters/gsap`→`../core/gsap/tween`；[use_animation_controller.ts:24](../app/src/composables/use_animation_controller.ts) `../core/animation/adapters/gsap`→`../core/gsap/tween`；[pipeline_shared_deps.ts:17](../app/src/core/flow/pipeline_shared_deps.ts) `../animation/adapters/gsap`→`../gsap/timeline`；[overlay_timeline.test.ts:4](../app/test/overlay_timeline.test.ts)→ 拆 `../src/core/gsap/timeline`+`../src/core/gsap/tween`；[overlay_pipeline.test.ts:6](../app/test/overlay_pipeline.test.ts)→`../src/core/gsap/timeline`。
  - 验收：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test overlay_timeline.test.ts overlay_pipeline.test.ts use_animation_state.test.ts`；`grep -rn "animation/adapters" app --include=*.ts --include=*.vue`（空）；`node scripts/quality_gate.js full` = exit 0。
  - 影响：新增 2 文件、删 adapters、7 处 import、1 处内联。回滚：反向恢复 adapters + 还原 import/内联。

- [x] P2 契约归位（解散 core/flow/types、合并类型）
  - 上下文：[core/flow/types.ts](../app/src/core/flow/types.ts)（OverlayPhase/PhaseContext/PhaseRunner）、[core/animation/atoms/types.ts](../app/src/core/animation/atoms/types.ts)（AtomFn/AtomContext）、[core/animation/types.ts](../app/src/core/animation/types.ts)（CardState/CenterCardState/DrawCardState/InnerState/AnimationTimeline）。
  - 操作：
    1. 新建 `composables/shared/animations/card_state.ts`：逐字搬入 `core/animation/types.ts` 全部声明（无外部依赖）。
    2. 新建 `composables/shared/animations/contracts.ts`：逐字搬入 `core/flow/types.ts` + `core/animation/atoms/types.ts` 的声明合并；内部 import 调整为 `./card_state`（DrawCardState）、`../../../core/deck/types`（DeckGeometry）、`../../../core/sizing/layout_solver`（CardLayout）、`gsap`（AtomFn 用）。
    3. 删除 `core/flow/types.ts`、`core/animation/types.ts`、`core/animation/atoms/types.ts`。
    4. 改 `core/flow/types` 全部 importer → `composables/shared/animations/contracts`（按各文件相对深度算路径）：[skip_to_reading.ts:14](../app/src/composables/skip_to_reading.ts) [use_animation_controller.ts:30](../app/src/composables/use_animation_controller.ts) [use_presentation.ts:15](../app/src/composables/use_presentation.ts) [start.ts:12](../app/src/composables/start.ts) [use_main_stage.ts:25](../app/src/composables/use_main_stage.ts) [use_lifecycle.ts:14](../app/src/composables/use_lifecycle.ts) [use_phases.ts:10](../app/src/composables/use_phases.ts) [use_lifecycle_types.ts:9](../app/src/composables/use_lifecycle_types.ts) [use_dev_tools.ts:20](../app/src/composables/use_dev_tools.ts) [pipeline_builder.ts:16](../app/src/composables/pipeline_builder.ts) [replay_from_phase.ts:20](../app/src/composables/replay_from_phase.ts) [DevToolsPanel.vue:78](../app/src/components/DevToolsPanel.vue) [DevToolsPhaseRow.vue:37](../app/src/components/DevToolsPhaseRow.vue) [overlay_pipeline.test.ts:7](../app/test/overlay_pipeline.test.ts) [replay_from_phase.test.ts:19](../app/test/replay_from_phase.test.ts) [overlay_phase_registry.test.ts:11](../app/test/overlay_phase_registry.test.ts)；以及仍在原位的 `core/animation/phases/*`、`core/animation/pipeline.ts`、`core/animation/phases/phase_types.ts`、`core/flow/pipeline_shared_deps.ts` 中对 `flow/types` 与 `atoms/types` 的 import 一并改向 contracts。
    5. 改 `core/animation/types` 全部 importer → `card_state`：[use_result_card_shrink.ts:40](../app/src/composables/use_result_card_shrink.ts) [use_lifecycle_types.ts:8](../app/src/composables/use_lifecycle_types.ts) [use_animation_controller.ts:13](../app/src/composables/use_animation_controller.ts) [initial_states.ts:7](../app/src/core/animation/initial_states.ts) [state.ts:13](../app/src/core/animation/state.ts) [phase_types.ts:12](../app/src/core/animation/phases/phase_types.ts) `core/animation/phases/*`（AnimationTimeline）。
  - 验收：`npx vue-tsc --noEmit -p app/tsconfig.json`（纯类型移动，tsc 全覆盖）；`npx vitest run --config app/vitest.config.ts --dir app/test`；`grep -rn "core/flow/types\|animation/types'\|animation/atoms/types" app --include=*.ts --include=*.vue`（空）；full gate = exit 0。
  - 影响：新增 2 文件、删 3 文件、~25 处 import。回滚：恢复 3 文件 + 反向 import。

- [x] P3 迁 shared/animations 运行时
  - 上下文：[state.ts](../app/src/core/animation/state.ts) [reconciler.ts](../app/src/core/animation/reconciler.ts) [visibility.ts](../app/src/core/animation/visibility.ts) [initial_states.ts](../app/src/core/animation/initial_states.ts) [use_animation_state.ts](../app/src/core/animation/use_animation_state.ts) [use_playback.ts](../app/src/core/animation/use_playback.ts) [pipeline.ts](../app/src/core/animation/pipeline.ts) [atoms/flip.ts](../app/src/core/animation/atoms/flip.ts) [atoms/grow.ts](../app/src/core/animation/atoms/grow.ts)。
  - 操作：
    1. `git mv` 上 9 文件 → `composables/shared/animations/`，`reconciler.ts`→`style_sync.ts`（仅文件名；导出名 `createStyleReconciler` 不改），`atoms/flip.ts`→`flip.ts`、`atoms/grow.ts`→`grow.ts`。
    2. 改各文件内部 import 相对深度：`../utils/accessibility`/`../utils/secure_random`→`../../../core/utils/...`；`./adapters/gsap`(P1 后已是 `../gsap/...`)→`../../../core/gsap/...`；`./state`/`./reconciler`/`./visibility`/`./initial_states`→同目录 `./state`/`./style_sync`/`./visibility`/`./initial_states`；`../types`/`./types`→`./card_state`；`../../flow/types`/`./contracts`→`./contracts`。
    3. 改外部 importer：[use_animation_controller.ts:14,18,21,31](../app/src/composables/use_animation_controller.ts)（reconciler→`shared/animations/style_sync`、use_animation_state、use_playback、state MAX_CARD_COUNT）；[start.ts:11](../app/src/composables/start.ts)（pipeline，PipelinePhase）；测试 [use_animation_state.test.ts:6](../app/test/use_animation_state.test.ts) [atom_grow.test.ts:10-11](../app/test/atom_grow.test.ts) [atom_flip.test.ts:10-11](../app/test/atom_flip.test.ts) [overlay_pipeline.test.ts:4-5](../app/test/overlay_pipeline.test.ts) [replay_from_phase.test.ts:21](../app/test/replay_from_phase.test.ts) [overlay_phase_snap.test.ts:12](../app/test/overlay_phase_snap.test.ts)（MAX_CARD_COUNT from state）。
    4. `core/animation/phases/*`（仍在原位）对 `../state`/`../pipeline`/`../atoms/*`/`../reconciler` 的 import 改向 `composables/shared/animations/*`。
  - 验收：vue-tsc；`vitest --dir app/test` 全量；`grep -rn "core/animation/\(state\|reconciler\|visibility\|initial_states\|use_animation_state\|use_playback\|pipeline\|atoms\)" app`（空）；full gate = exit 0。
  - 影响：9 文件迁移 + 内外 import 链。回滚：反向 `git mv` + 还原 import。

- [x] P4 迁 flows/divination（删 registry/phase_types/index 壳，解散 core/flow）
  - 上下文：[phases/{shuffle,cut,draw,reveal}/builder.ts](../app/src/core/animation/phases/) [draw/draw_timeline.ts](../app/src/core/animation/phases/draw/draw_timeline.ts) [phase_manifest.ts](../app/src/core/animation/phases/phase_manifest.ts) [phase_entry_snaps.ts](../app/src/core/animation/phases/phase_entry_snaps.ts) [phase_types.ts](../app/src/core/animation/phases/phase_types.ts) [registry.ts](../app/src/core/animation/phases/registry.ts) [pipeline_shared_deps.ts](../app/src/core/flow/pipeline_shared_deps.ts) [overlay_progress/](../app/src/core/utils/overlay_progress/)。执行前先 `grep -rn "overlay_progress\|createProgressModel\|phase_progress" app/src --include=*.ts --include=*.vue` 确认 progress 真实消费者并补入本步 importer 清单。
  - 操作：
    1. `git mv`：`phases/shuffle/builder.ts`→`flows/divination/phases/shuffle.ts`；`cut/builder.ts`→`phases/cut.ts`；`draw/builder.ts`→`phases/draw.ts`；`draw/draw_timeline.ts`→`phases/draw_timeline.ts`；`reveal/builder.ts`→`phases/reveal.ts`；`phase_manifest.ts`→`flows/divination/phase_manifest.ts`；`phase_entry_snaps.ts`→`flows/divination/phase_entry_snapshots.ts`；`core/flow/pipeline_shared_deps.ts`→`flows/divination/pipeline_deps.ts`；`overlay_progress/phase_progress_model.ts`→`flows/divination/progress_model.ts`；`phase_progress_presenter.ts`→`progress_presenter.ts`；`overlay_text.ts`→`flows/divination/overlay_text.ts`。
    2. 拆解 `phase_types.ts`：`PhaseStep`/`PhaseManifest`/`MAX_CUT_PILES` 声明搬入 `phase_manifest.ts`；`PhaseSnapDeps` 搬入 `phase_entry_snapshots.ts`；`OverlayPhase` 已在 contracts（P2）；删 `phase_types.ts`。
    3. 删 `registry.ts`、`overlay_progress/index.ts`。
    4. 改各迁移文件内部 import 相对深度（contracts/card_state→`../../shared/animations/*`；gsap→`../../../core/gsap/*`；core/utils accessibility/secure_random→`../../../core/utils/*`；sizing/deck→`../../../core/*`；phases 内互引同目录）。
    5. 改 registry 消费者为直接 import：[pipeline_builder.ts:11-15](../app/src/composables/pipeline_builder.ts)（buildXxxPhaseRunner→`flows/divination/phases/*`、PHASE_MANIFEST→`phase_manifest`）；[replay_from_phase.ts:15-19](../app/src/composables/replay_from_phase.ts)、[skip_to_reading.ts:12-13](../app/src/composables/skip_to_reading.ts)（getPhaseSnap→`phase_manifest`、PhaseSnapDeps→`phase_entry_snapshots`）；[use_lifecycle.ts:13](../app/src/composables/use_lifecycle.ts)（PhaseSnapDeps→`phase_entry_snapshots`）；[use_animation_controller.ts:32](../app/src/composables/use_animation_controller.ts)（MAX_CUT_PILES→`phase_manifest`）；`shared/animations/pipeline.ts`（P3 后）对 OverlayPhase→`./contracts`；progress_model/presenter 内 `../../animation/phases/registry`→ 同目录 `./phase_manifest`、`./overlay_text`。
    6. 测试改 import（用例逻辑不动）：[overlay_phase_registry.test.ts:10-11](../app/test/overlay_phase_registry.test.ts)→`phase_manifest`；[overlay_phase_snap.test.ts:11](../app/test/overlay_phase_snap.test.ts)→`phase_manifest`/`phase_entry_snapshots`；[replay_from_phase.test.ts:20](../app/test/replay_from_phase.test.ts)→`phase_manifest`；[overlay_progress_model.test.ts](../app/test/overlay_progress_model.test.ts) [overlay_progress_presenter.test.ts](../app/test/overlay_progress_presenter.test.ts)→`flows/divination/*`；[overlay_pipeline.test.ts](../app/test/overlay_pipeline.test.ts) 中 phase 相关 import 同步。
    7. 删空目录 `core/flow/`、`core/utils/overlay_progress/`、`core/animation/phases/{shuffle,cut,draw,reveal}/`（fan/fallback 仍在，P5 处理）。
  - 验收：vue-tsc；`vitest --dir app/test` 全量（含 overlay_phase_registry/snap、replay、progress）；`grep -rn "phases/registry\|phase_types\|core/flow\|overlay_progress" app --include=*.ts --include=*.vue`（空）；full gate = exit 0。
  - 影响：12 文件迁移、删 3 壳、phase_types 拆解、~15 处 import + 6 测试。回滚：反向 `git mv` + 恢复壳 + 还原 import。

- [x] P5 迁 flows/idle + flows/fallback，清空 core/animation
  - 上下文：[phases/fan/builder.ts](../app/src/core/animation/phases/fan/builder.ts)（buildFanTimeline）；[phases/fallback/builder.ts](../app/src/core/animation/phases/fallback/builder.ts)（createDefaultPlanets/startFallbackAnimation，ticker 驱动）；importer [fan_controller.ts:23](../app/src/composables/fan_controller.ts) [FallbackOrbits.vue:50](../app/src/components/FallbackOrbits.vue)。
  - 操作：
    1. `git mv` `phases/fan/builder.ts`→`composables/flows/idle/fan.ts`；`phases/fallback/builder.ts`→`composables/flows/fallback/orbits.ts`。
    2. 改两文件内部 import：`../../../utils/accessibility`→`../../../core/utils/accessibility`；`gsap` 不变。
    3. 改 importer：`fan_controller.ts:23`→`./flows/idle/fan`（按其位置算相对路径）；`FallbackOrbits.vue:50`→`../composables/flows/fallback/orbits`。
    4. 删空目录 `core/animation/phases/`、`core/animation/`（应已全空）。
  - 验收：vue-tsc；`vitest --dir app/test` 全量；`grep -rn "core/animation" app --include=*.ts --include=*.vue`（空）；`test ! -d app/src/core/animation && test ! -d app/src/core/flow`；full gate = exit 0。
  - 影响：2 文件迁移 + 2 importer + 删空目录。回滚：反向 `git mv` + 还原 import。

- [ ] P6 收尾：守卫规则 / 文件头注释 / 文档对齐 / 全局回归
  - 上下文：全仓。各迁移文件头 `Name:` 注释多为旧路径（如 `Name: animation/...`、`core/flow/...`）；[docs/README.md](README.md)、[README.md](../README.md)、`app/src/**/README.md`；架构守卫 [config/dependency-cruiser.cjs:252-273](../config/dependency-cruiser.cjs)（`core-is-leaf` 的 `to` 未含 composables；`animation-not-to-reading` 的 `from` 仍为 `^app/src/core/animation/`）、[scripts/quality_scan.js:341](../scripts/quality_scan.js)（`animation/engine` 失效死豁免；`use_animation_state.ts` 按文件名豁免，迁移后仍有效不动）。说明：P1–P5 期间不动这两文件——`core-is-leaf` 的 `to` 不含 composables，故中间态 `core/animation/*→composables/shared/animations` 不被拦；`animation-not-to-reading` 的 `from=core/animation` 在其存在期间继续有效守卫；P5 后 core 内已无指向 composables 的依赖，此时收紧规则不会误拦。
  - 操作：
    1. 更新 [dependency-cruiser.cjs](../config/dependency-cruiser.cjs)：`core-is-leaf` 的 `to` path 增加 `composables`（收紧为 core 不得依赖 composables，守护本次建立的分层）；`animation-not-to-reading` 的 `from` 由 `^app/src/core/animation/` 改为新动画位置正则（`^app/src/core/gsap/`、`^app/src/composables/shared/animations/`、`^app/src/composables/flows/divination/`），`to` 按 reading 业务实际位置核定，注释同步。规则语义不弱化、不删除。
    2. 清理 [quality_scan.js:341](../scripts/quality_scan.js) 失效的 `animation/engine` 死豁免分支（`engine` 目录早已合并删除，重构前后均匹配不到）；先验证移除后 `ExternalPrivateAccess` 不新增误报再删，否则保留并记「搁置问题」。
    3. 同步所有迁移文件头 `Name:` 与文件内提及的旧路径注释为新路径（不改代码逻辑）。
    4. `grep -rn "core/animation\|core/flow\|overlay_progress\|phases/registry" docs README.md app/src --include=*.md` 核查文档/README 旧目录路径描述，按实际结构对齐（仅路径，不改语义）。
    5. 全局回归：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test`；`npx vitest run --config server/vitest.config.ts --dir server/test`；`npx eslint app/src/ app/test/`；`node scripts/quality_gate.js full`；H5 构建 `node scripts/build/index.js --prod --target h5 --skip-quality`。
  - 验收：上述命令全 exit 0；`core-is-leaf`/`animation-not-to-reading` 规则路径与最终结构一致且 depcruise 0 error；全仓 grep 旧路径零残留；H5 构建 DONE。
  - 影响：守卫规则 + 注释/文档 + 回归。回滚：按失败项定位对应 P 步 `git revert`。

## 执行约束

每步先改 → 验收（vue-tsc 用 [vue-tsc 不用 tsc](../CLAUDE.md)；vitest 必带 `--dir app/test` 匹配 config）→ 更新「进度」→ commit（pre-commit 真实跑通，禁绕过；分提交前 `git stash push --staged` 隔离他人改动）→ 下一步。禁跳步。遇验收失败即停并报告，按「回滚」处置，不绕过门禁。

## 回滚

未提交：`git checkout -- <file>` + 删新建 + 反向 `git mv`。已提交：按步粒度 `git revert` 对应提交，不跨步混合。

## 进度

P0–P5 完成。P6 待开始。

## 搁置问题

（暂无）
