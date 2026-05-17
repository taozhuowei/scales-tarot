# 执行计划与进度跟踪

> 唯一执行跟踪文档。仅记录当前进行中的计划与进度，不留历史归档与未来设想。每个任务为独立单步：读「本任务描述 + 其超链接引用的文档与代码」即可获得全部上下文，知道怎么做、怎么测。

## 目标

[`app/src/components/`](../app/src/components) 24 个组件按 `composables/flows` 同构规则聚类到 `components/{ shared/, flows/{index,idle,divination,fallback,reading} }`，与 [`composables/`](../app/src/composables) 体系完全对称。归类依据：渲染内容 + 依赖的 flow composable + 引用方/引用图（仅据代码）。

## 禁止项（决策冻结）

1. 仅文件移动 / 改 import 路径 / 文件头 `Name:` 与路径注释对齐。**禁改任何运行时逻辑、模板结构、布局/样式**：`<template>`、`<style>`、`<script>` 主体逐字保留。
2. `composables/*`、`core/*`、`pages/*`（除其对 components 的 import 行）一律不动。
3. 不改 e2e 锚定类名与任何运行时行为；重构零行为变更。
4. 每阶段独立可编译、测试绿后方可 commit；禁跳阶段；禁 `--no-verify`/`--force`/任何门禁绕过。工作区干净、单任务无他人改动，逐阶段全量 commit。

## 最终分类（24 组件，全部归类，无留根）

```
app/src/components/
  shared/                    跨 flow 共享 shell + 通用 primitive（4）
    HeaderArea.vue Stage.vue TitleContent.vue TypewriterText.vue
  flows/
    index/                   main 框架/舞台核心（7）
      Deck.vue NotificationHost.vue DevToolsPanel.vue
      DevToolsCollapsedHandle.vue DevToolsControlRow.vue
      DevToolsPhaseRow.vue DevToolsPlaybackRow.vue
    idle/                    待机（2）
      DeckFanStack.vue CardsLoadError.vue
    divination/              占卜（2）
      DeckRig.vue ProgressContent.vue
    fallback/                降级（2）
      FallbackView.vue FallbackOrbits.vue
    reading/                 解读（7）
      ReadingSplitView.vue ReadingDrawerView.vue ReadingPanel.vue
      CardMeaningContainer.vue ConclusionContainer.vue
      ReadingTextContainer.vue ActionArea.vue
```

引用拓扑（已 grep 实证，决定 import 重写面）：
- pages/main/index.vue → HeaderArea, TitleContent, ProgressContent, Stage, Deck, CardsLoadError, ReadingSplitView, ReadingDrawerView, NotificationHost, DevToolsPanel
- pages/fallback/index.vue → FallbackView
- Deck → DeckFanStack, DeckRig；DevToolsPanel → 4 个 DevTools 子；FallbackView → FallbackOrbits, HeaderArea, Stage, TitleContent；ReadingDrawerView/ReadingSplitView → ActionArea, ReadingPanel；ReadingPanel → CardMeaningContainer, ConclusionContainer, ReadingTextContainer；后三者 + ConclusionContainer → TypewriterText
- 组件内仅三类相对 import：`../composables/…`、`../core/…`、`./X.vue`（无 @ 别名、无其它，已 grep 证）

## 任务清单

> 每步：按操作改 → 验收（命令逐条 exit 0）→ 勾「进度」→ commit（[pre-commit 门禁](../README.md) 真实跑通）→ 下一步。禁跳步。相对 import 深度按文件新位置实算。

- [x] C0 清空并重写本 TODO（本步）
  - 操作：覆盖 [docs/TODO.md](TODO.md) 为本计划。
  - 验收：本文件为新计划；`node scripts/quality_gate.js full` = exit 0。
  - 影响：仅文档。回滚：`git checkout -- docs/TODO.md`。

- [ ] C1 建目录 + 全量 git mv + import 重写
  - 操作：
    1. `mkdir -p app/src/components/shared app/src/components/flows/{index,idle,divination,fallback,reading}`。
    2. 按「最终分类」`git mv` 24 组件至对应目录。
    3. 组件自身 `../composables/`、`../core/` 深度规则化重写（基准 components/ 根）：移入 `flows/<flow>/` 者 `../`→`../../../`（深 +2）；移入 `shared/` 者 `../`→`../../`（深 +1）。先 `grep -nE "from '(\.\./|\./)"` 全量列出实算复核。
    4. 组件间 `./X.vue` 互引按双方新目录精确重写（引用图见上，逐条 Edit）。
    5. `pages/main/index.vue`（10 处）、`pages/fallback/index.vue`（1 处）的 `../../components/X.vue` → `../../components/{shared|flows/<flow>}/X.vue`，逐处 Read+Edit。
  - 验收：`grep -rnE "components/[A-Z][A-Za-z]+\.vue'" app --include=*.ts --include=*.vue | grep -vE "components/(shared|flows/(index|idle|divination|fallback|reading))/"`（空，无旧根路径）；`npx vue-tsc --noEmit -p app/tsconfig.json`；`node scripts/quality_gate.js full` = exit 0。
  - 影响：6 新目录 + 24 git mv + 组件内/间 + 2 pages 的 import。回滚：反向 `git mv` + 还原 import + 删空目录。

- [ ] C2 组件头注释路径对齐 + 全局回归
  - 操作：
    1. 24 组件文件头 `Name:`/路径注释对齐新位置（仅注释，零代码/模板/样式）。
    2. 全局回归：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test`；`npx vitest run --config server/vitest.config.ts --dir server/test`；`npx eslint app/src/ app/test/ server/src/ server/test/`；`node scripts/quality_gate.js full`；H5 构建 `node scripts/build/index.js --prod --target h5 --skip-quality`。
  - 验收：上述全 exit 0；H5 DONE 且 perf Δ0.0%；更新「进度」。
  - 影响：24 文件注释 + 全量回归。回滚：还原注释。

## 执行约束

每步先改 → 验收（类型检查用 [vue-tsc 不用 tsc](../CLAUDE.md)；vitest 必带 `--dir app/test`/`--dir server/test`）→ 更新「进度」→ commit（pre-commit 真实跑通，禁绕过）→ 下一步。禁跳步。遇验收失败即停并报告，按「回滚」处置。

## 回滚

未提交：`git checkout -- <file>` + 删新建 + 反向 `git mv`。已提交：按步粒度 `git revert` 对应提交，不跨步混合。

## 进度

C0 完成（TODO 重写，full gate exit 0）。C1 进行中。

## 搁置问题

1. 上一轮迁移遗留的过期注释（非本次范围）：[phases/shuffle.ts:4](../app/src/composables/flows/divination/phases/shuffle.ts) [phases/cut.ts:4](../app/src/composables/flows/divination/phases/cut.ts) 的 `migrated from utils/overlay_animation/phases/...`、[phases/draw_timeline.ts:329](../app/src/composables/flows/divination/phases/draw_timeline.ts) 的 `animation/phases/reveal/builder.ts` 引用——指向已不存在旧路径，待后续注释清理批次统一对齐。
