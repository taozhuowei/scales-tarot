# 执行计划与进度跟踪

> 唯一执行跟踪文档。仅记录当前进行中的计划与进度，不留历史归档与未来设想。每个任务为独立单步：读「本任务描述 + 其超链接引用的文档与代码」即可获得全部上下文，知道怎么做、怎么测。

## 目标

把 [`app/src/composables/`](../app/src/composables) 根目录 25 个 `.ts` 按职责归位：底层 store 适配下沉 [`core/composables/`](../app/src/core)（新建）；解读流程聚为 `composables/flows/reading/`（新建，与 idle/fallback 对称）；占卜管线编排迁 [`composables/flows/divination/`](../app/src/composables/flows/divination)；Deck 舞台状态机簇按单一职责拆解后按消费者归 `flows/idle`/`flows/divination`，跨 flow 编排器残留根；删除无单一 flow 的类型伞文件 `play_deck_runtime_types.ts`。命名直观化：看名知意。

## 禁止项（决策冻结）

1. 仅文件移动 / 改名 / 删伞文件 / 改 import 路径 / 按归属拆分搬移类型声明（声明本身逐字不改）/ 按职责把函数体逐字抽到独立文件。**禁改任何运行时逻辑、功能、界面**：GSAP 关键帧/时序、watch 条件、状态机分支、computed 体、锁与定时器语义——逐字保留。
2. 遇必须改逻辑的点 → 停，讲清原因+操作，交决策。遇目录/函数名不达意 → 直接改对。遇明显 bug 或坏味道且修法无异议、不影响功能界面 → 直接改；否则停并交决策。
3. 不改 e2e 锚定类名与任何运行时行为；重构零行为变更。
4. 每阶段独立可编译、测试绿后方可 commit；禁跳阶段；禁 `--no-verify`/`--force`/任何门禁绕过。当前工作区干净、单任务无他人改动，逐阶段全量 commit。

## 最终落点（25 文件，标注 迁入 / 新建 / 删除 / 留根）

```
app/src/core/composables/                         （新建目录）
  use_app_phase.ts            迁自 composables/（tarotStore.phase 薄 seam）
  use_cards_load_error.ts     迁自 composables/（卡资源加载错误+retry 薄透传）

app/src/composables/flows/reading/                （新建目录）
  use_reading_controller.ts        迁自 composables/
  use_reading_panel_controller.ts  迁自 composables/
  use_result_card_shrink.ts        迁自 composables/
  result_card_lift_margin.ts       迁自 composables/（纯常量）

app/src/composables/flows/divination/             （迁入 10）
  use_phases.ts use_presentation.ts start.ts pipeline_builder.ts
  skip_to_reading.ts replay_from_phase.ts use_lifecycle.ts
  use_lifecycle_types.ts use_animation_controller.ts   迁自 composables/（P3）
  divination_rig.ts            迁自 composables/，内联 DivinationRig 接口（P4）

app/src/composables/flows/idle/                   （迁入 2 + 新建 3）
  fan_controller.ts            迁自 composables/，内联 FanController 接口（P4）
  click_handler.ts             迁自 composables/（P4）
  deck_runtime.ts              新建：DECK_SIZE + PlayDeckRuntime 接口 + createPlayDeckRuntime()
  deck_card_size.ts            新建：resolveDeckCardSize()
  entrance_hint.ts             新建：runEntranceHint()

留根 composables/（6）：use_main_stage use_main_handlers use_dev_tools
  use_active_view use_header_presentation use_play_deck_animation（拆出 3 helper 后的跨 flow 编排器残留；唯一消费者 components/Deck.vue）

删除：composables/play_deck_runtime_types.ts
  （DivinationRig→divination_rig 内联；FanController→fan_controller 内联；
   PlayDeckRuntime+DECK_SIZE→flows/idle/deck_runtime.ts；createPlayDeckRuntime
   /resolveDeckCardSize/runEntranceHint→flows/idle 三新建文件）
```

判定依据（仅据当前代码）：`use_app_phase`/`use_cards_load_error` 仅 `storeToRefs`+透传无 flow 无动画→core；解读 4 文件构成独立 reading flow；占卜 10 文件 import 链全指 `flows/divination/*` 且只服务占卜管线；`play_deck_runtime_types` 字段全为 idle-deck 态、`divination_rig` 全程不引用 `rt`，故类型按归属拆解、`fan_controller`/`click_handler` 归 idle、`divination_rig` 归 divination、跨 flow 编排器残留根。

## 任务清单

> 每步：按操作改 → 验收（命令逐条 exit 0）→ 勾「进度」→ commit（[pre-commit 门禁](../README.md) 真实跑通）→ 下一步。禁跳步。相对 import 深度按文件新位置实算。

- [x] P0 清空并重写本 TODO（本步）
  - 操作：覆盖 [docs/TODO.md](TODO.md) 为本计划。
  - 验收：本文件为新计划；`node scripts/quality_gate.js full` = exit 0。
  - 影响：仅文档。回滚：`git checkout -- docs/TODO.md`。

- [x] P1 建 core/composables，迁 use_app_phase + use_cards_load_error
  - 上下文：[use_app_phase.ts](../app/src/composables/use_app_phase.ts)（import `../core/store/tarot`、`../core/store/flow`，含 `export type { DivinationPhase }` re-export）、[use_cards_load_error.ts](../app/src/composables/use_cards_load_error.ts)（import `../core/store/tarot`）。消费者：`use_app_phase`←[use_main_stage.ts:14](../app/src/composables/use_main_stage.ts)；`use_cards_load_error`←[CardsLoadError.vue](../app/src/components/CardsLoadError.vue)、[pages/main/index.vue](../app/src/pages/main/index.vue)。
  - 操作：
    1. `mkdir -p app/src/core/composables`。
    2. `git mv app/src/composables/use_app_phase.ts app/src/composables/use_cards_load_error.ts app/src/core/composables/`。
    3. 改两文件内部 import：`../core/store/tarot`→`../store/tarot`、`../core/store/flow`→`../store/flow`（含 re-export 那行）。
    4. 改消费者 import 路径：`use_main_stage.ts` 的 `./use_app_phase`→`../core/composables/use_app_phase`；`CardsLoadError.vue` 的 `../composables/use_cards_load_error`→`../core/composables/use_cards_load_error`；`pages/main/index.vue` 的 `../../composables/use_cards_load_error`→`../../core/composables/use_cards_load_error`。
  - 验收：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test`；`grep -rn "composables/use_app_phase\|composables/use_cards_load_error" app --include=*.ts --include=*.vue`（仅 core/composables 新路径，无旧根路径）；`node scripts/quality_gate.js full` = exit 0。
  - 影响：新建目录 + 2 迁移 + 各文件 import。回滚：反向 `git mv` + 还原 import + 删空目录。

- [x] P2 建 flows/reading，迁解读流程 4 文件
  - 上下文：[use_reading_controller.ts](../app/src/composables/use_reading_controller.ts)、[use_reading_panel_controller.ts](../app/src/composables/use_reading_panel_controller.ts)、[use_result_card_shrink.ts](../app/src/composables/use_result_card_shrink.ts)、[result_card_lift_margin.ts](../app/src/composables/result_card_lift_margin.ts)（纯常量无 import）。消费者：`use_reading_controller`←[use_main_handlers.ts](../app/src/composables/use_main_handlers.ts)、[use_main_stage.ts](../app/src/composables/use_main_stage.ts)；`use_reading_panel_controller`←[ConclusionContainer.vue](../app/src/components/ConclusionContainer.vue)、[CardMeaningContainer.vue](../app/src/components/CardMeaningContainer.vue)、[ReadingTextContainer.vue](../app/src/components/ReadingTextContainer.vue)；`use_result_card_shrink`←`use_main_stage`；`result_card_lift_margin`←[Deck.vue](../app/src/components/Deck.vue)。
  - 操作：
    1. `mkdir -p app/src/composables/flows/reading`。
    2. `git mv` 上 4 文件 → `composables/flows/reading/`。
    3. 改各文件内部 import 相对深度（根→flows/reading 深 2 级）：`../core/X`→`../../../core/X`；`./shared/animations/X`→`../../shared/animations/X`；`./flows/divination/X`→`../divination/X`（逐文件 Read 实算）。
    4. 改消费者 import：`use_main_handlers`/`use_main_stage` 的 `./use_reading_controller`→`./flows/reading/use_reading_controller`、`./use_result_card_shrink`→`./flows/reading/use_result_card_shrink`；3 解读组件 `../composables/use_reading_panel_controller`→`../composables/flows/reading/use_reading_panel_controller`；`Deck.vue` 的 `../composables/result_card_lift_margin`→`../composables/flows/reading/result_card_lift_margin`。
  - 验收：vue-tsc；`vitest --dir app/test` 全量；`grep -rn "composables/use_reading_controller\|use_reading_panel_controller\|use_result_card_shrink\|composables/result_card_lift_margin" app --include=*.ts --include=*.vue`（仅新路径）；full gate = exit 0。
  - 影响：新建目录 + 4 迁移 + 内外 import。回滚：反向 `git mv` + 还原 import + 删空目录。

- [x] P3 迁 flows/divination 9 文件 + quality_baseline 联动
  - 上下文：9 文件 [use_phases](../app/src/composables/use_phases.ts) [use_presentation](../app/src/composables/use_presentation.ts) [start](../app/src/composables/start.ts) [pipeline_builder](../app/src/composables/pipeline_builder.ts) [skip_to_reading](../app/src/composables/skip_to_reading.ts) [replay_from_phase](../app/src/composables/replay_from_phase.ts) [use_lifecycle](../app/src/composables/use_lifecycle.ts) [use_lifecycle_types](../app/src/composables/use_lifecycle_types.ts) [use_animation_controller](../app/src/composables/use_animation_controller.ts)；互引（迁后同在 flows/divination，`./xxx` 不变）。`use_animation_controller` import `../config.json`。硬编码：[scripts/quality_baseline.json:4-5](../scripts/quality_baseline.json)（`use_animation_controller`、`use_lifecycle` 路径）。`use_animation_state.ts` 按文件名豁免与本步无关。消费者：`use_animation_controller`←`use_main_handlers`、`use_main_stage`、`divination_rig`、`use_play_deck_animation`、`use_header_presentation`、[ProgressContent.vue](../app/src/components/ProgressContent.vue)、[DeckRig.vue](../app/src/components/DeckRig.vue)、`Deck.vue`（8 处）；其余 8 文件均单一消费者（见 grep）。
  - 操作：
    1. `git mv` 9 文件 → `composables/flows/divination/`。
    2. 改各文件内部 import 相对深度：`../core/X`→`../../../core/X`；`../config.json`→`../../../config.json`；`./shared/animations/X`→`../../shared/animations/X`；`./flows/divination/X`→同目录 `./X`；9 文件互引 `./xxx` 保持。
    3. 改消费者 import：留根的 `use_main_handlers`/`use_main_stage`/`use_header_presentation` 中 `./use_animation_controller`→`./flows/divination/use_animation_controller`、`./use_reading_controller` 已于 P2 处理勿重复；`divination_rig`/`use_play_deck_animation` 中 `./use_animation_controller`→`./flows/divination/use_animation_controller`（P4 还会动，此处先正确）；`ProgressContent.vue`/`DeckRig.vue`/`Deck.vue` 的 `../composables/use_animation_controller`→`../composables/flows/divination/use_animation_controller`。
    4. 改 [scripts/quality_baseline.json:4-5](../scripts/quality_baseline.json)：`app/src/composables/use_animation_controller.ts::useAnimationController`→`app/src/composables/flows/divination/use_animation_controller.ts::useAnimationController`；`use_lifecycle.ts` 同理。
    5. 测试 consumer 同步（grep `app/test` 实排）：[replay_from_phase.test.ts:18](../app/test/replay_from_phase.test.ts) `../src/composables/replay_from_phase`→`../src/composables/flows/divination/replay_from_phase`（其余 8 文件 app/test 无直接旧路径引用，已 grep 证）。
  - 验收：vue-tsc；`vitest --dir app/test` 全量；`grep -rn "composables/use_animation_controller\|composables/use_lifecycle\b\|composables/use_phases\|composables/use_presentation\|composables/start'\|composables/pipeline_builder\|composables/skip_to_reading\|composables/replay_from_phase\|composables/use_lifecycle_types" app --include=*.ts --include=*.vue`（仅 flows/divination 新路径）；`node scripts/quality_gate.js full`（函数大小豁免须命中新路径，exit 0）。
  - 影响：9 迁移 + 内外 import + quality_baseline 2 行。回滚：反向 `git mv` + 还原 import + 还原 baseline。

- [x] P4 状态机簇单一职责拆解 + 按消费者归位
  - 上下文：[play_deck_runtime_types.ts](../app/src/composables/play_deck_runtime_types.ts)（`PlayDeckRuntime`/`FanController`/`DivinationRig` 三接口）；[fan_controller.ts](../app/src/composables/fan_controller.ts)（import gsap、`../core/utils/accessibility`、`./flows/idle/fan`、`./play_deck_runtime_types`）；[click_handler.ts](../app/src/composables/click_handler.ts)（import `../core/store/tarot`、`../core/store/flow`、`./play_deck_runtime_types`）；[divination_rig.ts](../app/src/composables/divination_rig.ts)（import `./use_animation_controller`、`./play_deck_runtime_types`；全程不引用 `rt`）；[use_play_deck_animation.ts](../app/src/composables/use_play_deck_animation.ts)（`DECK_SIZE=12`:34；`createPlayDeckRuntime`:61-74；`resolveDeckCardSize`:81-91；`runEntranceHint`:97-109；`watchPhaseStateMachine`:128-152；`usePlayDeckAnimation`:155-218；唯一消费者 [Deck.vue:73](../app/src/components/Deck.vue)）。`DECK_SIZE` 被 `createPlayDeckRuntime`(:65,:68) 与残留 `:212 deckSize:DECK_SIZE` 共用 → 随 `deck_runtime.ts`，残留反向 import（合理拆分，无逻辑变更）。
  - 操作：
    1. 新建 `flows/idle/deck_runtime.ts`：逐字搬入 `const DECK_SIZE=12`、`PlayDeckRuntime` 接口（from play_deck_runtime_types，含 `Ref`/`gsap` type import 按新位置算）、`createPlayDeckRuntime()` 函数体（from use_play_deck_animation:61-74，逐字）；导出三者。
    2. 新建 `flows/idle/deck_card_size.ts`：逐字搬入 `resolveDeckCardSize()`（:81-91）+ 其依赖 import `solveLayoutFromWindow`（`../../../core/sizing/solve_from_window`）；导出。
    3. 新建 `flows/idle/entrance_hint.ts`：逐字搬入 `runEntranceHint()`（:97-109）+ import `gsap`、`prefersReducedMotion`（`../../../core/utils/accessibility`）；导出。
    4. `git mv fan_controller.ts → flows/idle/`：把 `FanController` 接口声明从 play_deck_runtime_types 逐字内联进本文件（紧邻 `createFanController`）；import 改：`./play_deck_runtime_types`(PlayDeckRuntime)→`./deck_runtime`；`./flows/idle/fan`→`./fan`；`../core/utils/accessibility`→`../../../core/utils/accessibility`。
    5. `git mv click_handler.ts → flows/idle/`：import 改：`./play_deck_runtime_types`(PlayDeckRuntime)→`./deck_runtime`；`../core/store/tarot`→`../../../core/store/tarot`；`../core/store/flow`→`../../../core/store/flow`。
    6. `git mv divination_rig.ts → flows/divination/`：把 `DivinationRig` 接口从 play_deck_runtime_types 逐字内联进本文件（紧邻 `createDivinationRig`）；import 改：`./use_animation_controller`→同目录 `./use_animation_controller`（P3 后已在此目录，路径不变）；删 `./play_deck_runtime_types` 行。
    7. 删除 `composables/play_deck_runtime_types.ts`（三接口已全部归位）。
    8. 改 `use_play_deck_animation.ts`（留根，编排器残留）：删除被抽出的 `DECK_SIZE`/`createPlayDeckRuntime`/`resolveDeckCardSize`/`runEntranceHint` 定义；新增 import：`./flows/idle/deck_runtime`(DECK_SIZE, PlayDeckRuntime, createPlayDeckRuntime)、`./flows/idle/deck_card_size`(resolveDeckCardSize)、`./flows/idle/entrance_hint`(runEntranceHint)、`./flows/idle/fan_controller`(createFanController, FanController)、`./flows/idle/click_handler`(buildClickHandler)、`./flows/divination/divination_rig`(createDivinationRig, DivinationRig)、`./flows/divination/use_animation_controller`(UseAnimationControllerReturn)；删 `./play_deck_runtime_types` 行；`watchPhaseStateMachine`/`usePlayDeckAnimation`/`deckContainerStyle`/lifecycle 主体逐字不动。`Deck.vue:73` import 路径不变（仍 `../composables/use_play_deck_animation`）。
  - 验收：vue-tsc；`vitest --dir app/test` 全量（含 fan/click/rig/play 相关用例）；`grep -rn "play_deck_runtime_types" app --include=*.ts --include=*.vue`（空）；`grep -rn "composables/fan_controller\|composables/click_handler\|composables/divination_rig" app --include=*.ts --include=*.vue`（仅 flows 新路径）；full gate = exit 0。
  - 影响：3 新建 + 3 迁移 + 类型内联 + 删 1 伞文件 + 残留改写。回滚：反向 `git mv` + 恢复 play_deck_runtime_types + 还原 use_play_deck_animation + 删新建。

- [x] P5 文件头注释对齐 + 全局回归
  - 上下文：迁移/拆分文件头 `Name:` 与文中提及旧路径需对齐新位置；新建文件需写规范头注释（[文档/注释约定](../CLAUDE.md)，`.ts` 注释符勿紧贴 `#ifdef`）。命名复核：`deck_runtime`/`deck_card_size`/`entrance_hint`、`createPlayDeckRuntime`/`resolveDeckCardSize`/`runEntranceHint` 是否看名知意（不达意直接改对并连带改引用）。
  - 操作：
    1. 同步所有本次迁移/拆分文件头 `Name:` 与正文旧路径注释为新路径（仅注释，零代码改动）。
    2. 命名直观性逐一复核；如改名，连带改全部引用并重跑该范围验收。
    3. 全局回归：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test`；`npx vitest run --config server/vitest.config.ts --dir server/test`；`npx eslint app/src/ app/test/ server/src/ server/test/`；`node scripts/quality_gate.js full`；H5 构建 `node scripts/build/index.js --prod --target h5 --skip-quality`。
  - 验收：上述命令全 exit 0；全仓 `grep -rn "composables/play_deck_runtime_types"` 等旧路径零残留；H5 构建 DONE；更新「进度」。
  - 影响：注释 + 可能改名 + 全量回归。回滚：按失败项定位对应 P 步反向处置。

## 执行约束

每步先改 → 验收（类型检查用 [vue-tsc 不用 tsc](../CLAUDE.md)；vitest 必带 `--dir app/test`/`--dir server/test` 匹配 config）→ 更新「进度」→ commit（pre-commit 真实跑通，禁绕过）→ 下一步。禁跳步。遇验收失败即停并报告，按「回滚」处置，不绕过门禁。遇必须改逻辑/名不达意/疑似 bug → 按「禁止项 2」停或直改。

## 回滚

未提交：`git checkout -- <file>` + 删新建 + 反向 `git mv`。已提交：按步粒度 `git revert` 对应提交，不跨步混合。

## 进度

P0–P5 全部完成。composables 根 25 文件归类结束：core/composables 2（use_app_phase/use_cards_load_error）；flows/reading 4（解读流程）；flows/divination 10（占卜管线 9 + divination_rig，内联 DivinationRig）；flows/idle 5（fan_controller 内联 FanController、click_handler 迁入 + 新建 deck_runtime/deck_card_size/entrance_hint）；留根 6（use_main_stage/use_main_handlers/use_dev_tools/use_active_view/use_header_presentation/use_play_deck_animation 跨 flow 编排器残留）；play_deck_runtime_types 伞文件已删。全程纯移动/拆解，零逻辑/功能/界面变更。回归：vue-tsc + app/server 全量单测 + eslint + full gate（arch/dead-code/dup/audit）+ H5 prod 构建 perf Δ0.0% 全绿。文件头 Name 统一为 composables/... 全路径惯例。

## 搁置问题

1. 上一轮迁移遗留的过期注释（非本次 25 文件范围，按最小变更未动）：[phases/shuffle.ts:4](../app/src/composables/flows/divination/phases/shuffle.ts) [phases/cut.ts:4](../app/src/composables/flows/divination/phases/cut.ts) 的 `migrated from utils/overlay_animation/phases/...` 渊源、[phases/draw_timeline.ts:329](../app/src/composables/flows/divination/phases/draw_timeline.ts) 的 `animation/phases/reveal/builder.ts` 引用——指向已不存在的旧路径，待后续注释清理批次统一对齐。
