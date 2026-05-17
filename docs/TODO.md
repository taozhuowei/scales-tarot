# 执行计划与进度跟踪

> 唯一执行跟踪文档。仅记录当前进行中的计划与进度，不留历史归档与未来设想。每个任务为独立单步：读「本任务描述 + 其超链接引用的文档与代码」即可获得全部上下文，知道怎么做、怎么测。

## 目标

[`app/src/composables/`](../app/src/composables) 根目录仅剩的 6 个 main 编排/视图文件归入新建 `composables/flows/index/`（扁平，不再分子目录）；`flows/` 下 `index`、`idle`、`divination`、`fallback`、`reading` 平级。归类依据：6 文件全部且仅服务 main 路由（[pages/main/index.vue](../app/src/pages/main/index.vue) 及仅 main 用的 [components/Deck.vue](../app/src/components/Deck.vue)），是主入口编排/视图层，与各动画流程同为 `flows/` 平级一员。

## 禁止项（决策冻结）

1. 仅文件移动 / 改 import 路径 / 文件头 `Name:` 注释对齐。**禁改任何运行时逻辑、功能、界面**：computed/watch/state-machine/GSAP 体逐字保留。
2. `idle`/`divination`/`fallback`/`reading` 及 `shared/animations`、`core/composables` 一律不动（不在本次范围）。
3. 不改 e2e 锚定类名与任何运行时行为；重构零行为变更。
4. 每阶段独立可编译、测试绿后方可 commit；禁跳阶段；禁 `--no-verify`/`--force`/任何门禁绕过。工作区干净、单任务无他人改动，逐阶段全量 commit。

## 最终结构

```
app/src/composables/flows/
  index/        新建（扁平）：
    use_main_stage.ts use_main_handlers.ts use_dev_tools.ts
    use_active_view.ts use_header_presentation.ts use_play_deck_animation.ts
  idle/         不动      divination/  不动
  fallback/     不动      reading/     不动
```
边界：`composables/shared/animations`、`core/composables`、`core/*` 不在 `flows/` 下，不动；本次无测试、无 `scripts/quality_baseline.json` 联动（已 grep 证）。

## 任务清单

> 每步：按操作改 → 验收（命令逐条 exit 0）→ 勾「进度」→ commit（[pre-commit 门禁](../README.md) 真实跑通）→ 下一步。禁跳步。相对 import 深度按文件新位置实算。

- [x] R0 清空并重写本 TODO（本步）
  - 操作：覆盖 [docs/TODO.md](TODO.md) 为本计划。
  - 验收：本文件为新计划；`node scripts/quality_gate.js full` = exit 0。
  - 影响：仅文档。回滚：`git checkout -- docs/TODO.md`。

- [x] R1 建 flows/index，迁 6 文件 + import 重写 + consumer
  - 上下文：根 6 文件 [use_main_stage](../app/src/composables/use_main_stage.ts) [use_main_handlers](../app/src/composables/use_main_handlers.ts) [use_dev_tools](../app/src/composables/use_dev_tools.ts) [use_active_view](../app/src/composables/use_active_view.ts) [use_header_presentation](../app/src/composables/use_header_presentation.ts) [use_play_deck_animation](../app/src/composables/use_play_deck_animation.ts)；消费者：`pages/main/index.vue:108-109`（use_main_stage、use_header_presentation）、`Deck.vue`（use_play_deck_animation，行执行时 grep）、`use_main_stage` 聚合 use_main_handlers/use_dev_tools/use_active_view（互引）。app/test 无引用、quality_baseline 无关联（已 grep 证）。
  - 操作：
    1. `mkdir -p app/src/composables/flows/index`。
    2. `git mv` 6 文件 → `composables/flows/index/`。
    3. 各文件内部 import 深度规则化重写（基准 composables/ 根 → flows/index/，深 +2）：`from '../core/`→`from '../../../core/`；`from './flows/divination/`→`from '../divination/`；`from './flows/reading/`→`from '../reading/`；`from './flows/idle/`→`from '../idle/`；`from './shared/animations/`→`from '../../shared/animations/`；6 文件互引 `from './use_*'` 保持不变。逐文件先 grep 实际 import 再改，确保无遗漏。
    4. 改 consumer：`pages/main/index.vue` 的 `../../composables/use_main_stage`、`../../composables/use_header_presentation` → `../../composables/flows/index/...`；`Deck.vue` 的 `../composables/use_play_deck_animation` → `../composables/flows/index/use_play_deck_animation`。
  - 验收：`grep -rnE "composables/(use_main_stage|use_main_handlers|use_dev_tools|use_active_view|use_header_presentation|use_play_deck_animation)'" app --include=*.ts --include=*.vue | grep -v "flows/index/"`（空）；`npx vue-tsc --noEmit -p app/tsconfig.json`；`node scripts/quality_gate.js full` = exit 0。
  - 影响：1 新目录 + 6 git mv + 6 文件 import + 3 consumer 行。回滚：反向 `git mv` + 还原 import + 删空目录。

- [ ] R2 文件头 Name 对齐 + 全局回归
  - 上下文：6 文件头 `Name:` 现为 `use_xxx` 或 `composables/use_play_deck_animation`，惯例为 `composables/flows/<dir>/<name>`（参见同级 flows 文件）。
  - 操作：
    1. 6 文件头 `Name:` 统一为 `composables/flows/index/<文件名去 .ts>`（仅注释，零代码）。
    2. 全局回归：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test`；`npx vitest run --config server/vitest.config.ts --dir server/test`；`npx eslint app/src/ app/test/ server/src/ server/test/`；`node scripts/quality_gate.js full`；H5 构建 `node scripts/build/index.js --prod --target h5 --skip-quality`。
  - 验收：上述命令全 exit 0；H5 构建 DONE 且 perf Δ0.0%；更新「进度」。
  - 影响：6 文件注释 + 全量回归。回滚：还原注释。

## 执行约束

每步先改 → 验收（类型检查用 [vue-tsc 不用 tsc](../CLAUDE.md)；vitest 必带 `--dir app/test`/`--dir server/test`）→ 更新「进度」→ commit（pre-commit 真实跑通，禁绕过）→ 下一步。禁跳步。遇验收失败即停并报告，按「回滚」处置。

## 回滚

未提交：`git checkout -- <file>` + 删新建 + 反向 `git mv`。已提交：按步粒度 `git revert` 对应提交，不跨步混合。

## 进度

R0–R1 完成。R1：建 flows/index，6 文件 git mv + 内部 import 规则化重写 + 3 consumer（pages/main 2 行、Deck.vue 1 行），grep 旧路径空、vue-tsc、full gate exit 0。R2 进行中。

## 搁置问题

1. 上一轮迁移遗留的过期注释（非本次范围）：[phases/shuffle.ts:4](../app/src/composables/flows/divination/phases/shuffle.ts) [phases/cut.ts:4](../app/src/composables/flows/divination/phases/cut.ts) 的 `migrated from utils/overlay_animation/phases/...` 渊源、[phases/draw_timeline.ts:329](../app/src/composables/flows/divination/phases/draw_timeline.ts) 的 `animation/phases/reveal/builder.ts` 引用——指向已不存在旧路径，待后续注释清理批次统一对齐。
