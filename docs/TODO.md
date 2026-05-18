# 执行计划与进度跟踪

> 唯一执行跟踪文档。仅记录当前进行中的计划与进度，不留历史归档与未来设想。每个任务为独立单步：读「本任务描述 + 其超链接引用的文档与代码」即可获得全部上下文，知道怎么做、怎么测。

## 目标

取消按类型先分的 [`app/src/components/`](../app/src/components) 与 [`app/src/composables/`](../app/src/composables) 双树，统一重组为单一特性优先树 [`app/src/flows/`](../app/src/flows)：一级为 `flows/`，下设 6 个子域 `shared idle index divination fallback reading`，每个子域再分 `components/`（.vue）与 `composables/`（.ts）。结构来自用户决策，零运行时变更。

## 源 → 目标映射（确定，无留根）

```
app/src/components/shared/X.vue              → app/src/flows/shared/components/X.vue
app/src/components/flows/<f>/X.vue           → app/src/flows/<f>/components/X.vue
app/src/composables/shared/animations/x.ts   → app/src/flows/shared/composables/animations/x.ts   (保留 animations/ 层)
app/src/composables/flows/<f>/**             → app/src/flows/<f>/composables/**                    (保留 divination/phases/ 子层)
<f> ∈ { index, idle, divination, fallback, reading }
```

迁移后删空旧 `app/src/components/`、`app/src/composables/`。共 25 .vue + 49 .ts（含 divination/phases/ 5、shared/animations/ 11）。

## 禁止项（决策冻结）

1. 仅文件移动 / 改 import 路径 / 文件头 `Name:` 与路径注释对齐。**禁改任何运行时逻辑、模板、样式**：`<template>`、`<style>`、`<script>` 主体逐字保留。
2. `core/*`、`pages/*` 逻辑不动，仅改其对两树的 import 路径行。
3. 不改 e2e 锚定类名与任何运行时行为；重构零行为变更。
4. 跨 flow 强耦合 → 中间态不可编译，无法分 flow 增量。本计划为**一次性全量迁移 + 一次验收 + 单 commit**。禁 `--no-verify`/`--force`/任何门禁绕过。

## 引用面（已 grep 实证）

1. 文件内：同目录 `./` 互引迁移后仍同目录，**零改写**；跨子域 / 跨 shared / 到 `core/` 的 `../` import 需按文件新位置实算重写。
2. 外部 consumer：[`pages/index.vue`](../app/src/pages/index.vue) 2 处（`../components/flows/fallback/FallbackView.vue`、`../components/flows/index/MainSurface.vue`）；`app/test/` 9 个测试文件（`typewriter_text.test.ts` → `src/components/shared/TypewriterText.vue`；`overlay_*`/`replay_from_phase`/`atom_*`/`use_animation_state` → `src/composables/flows/divination/*`、`src/composables/shared/animations/*`）。`App.vue`/`main.ts`/`core/`/e2e 不依赖两树（已证）。
3. 配套：[`scripts/quality_baseline.json`](../scripts/quality_baseline.json) 2 条（`composables/flows/divination/use_animation_controller.ts`、`use_lifecycle.ts`）；[`config/dependency-cruiser.cjs`](../config/dependency-cruiser.cjs) 第 262/273/283 行 layer model 正则等价重写（旧顶层 `composables|components` 并入 `flows/`，不放宽守卫）。`config/knip.json`、`scripts/quality_scan.js` 经核无需改（递归扫描 + `/components/` 子串新结构仍命中）。

## import 重写算法（确定性，对每条相对 import）

以文件新目录为基：解析旧 import 指向的**旧绝对路径** T_old → 若 T_old 命中源→目标映射则取 T_new，否则 T_new=T_old（`core/` 等不动）→ 新 import = `relative(dirname(F_new), T_new)`。`.vue` 的 import 在 `<script setup>` 内、语法同 `.ts`，同规则。文件头 `Name:` 含旧两树路径串者（composables 惯例为路径式）一并对齐为新路径；组件头 `Name:` 为裸名+角色、无路径串，不改（C2 已证）。

## 任务清单

> 每步：按操作改 → 验收（命令逐条 exit 0）→ 勾「进度」。一次性迁移，全部步骤通过后单 commit（[pre-commit 门禁](../README.md) 真实跑通）。遇失败即停报告，按「回滚」处置。

- [ ] M1 建目录 + 整目录 git mv + 删空旧树
  - 操作：
    1. `mkdir -p app/src/flows/{index,idle,divination,fallback,reading,shared}`。
    2. composables：对 `<f>` 各 `git mv app/src/composables/flows/<f> app/src/flows/<f>/composables`；`git mv app/src/composables/shared app/src/flows/shared/composables`（= composables/animations）。
    3. components：对 `<f>` 各 `git mv app/src/components/flows/<f> app/src/flows/<f>/components`；`git mv app/src/components/shared app/src/flows/shared/components`。
    4. `rmdir` 旧 `app/src/components/flows app/src/components app/src/composables/flows app/src/composables`（应已空，非空即停查）。
  - 验收：`find app/src/flows -type f | wc -l` = 74；`test ! -d app/src/components -a ! -d app/src/composables`；`git status --porcelain` 全为 R（rename）。
  - 影响：74 文件 git mv（此时全断链，预期不可编译）。回滚：`git reset --hard c734759` + `rm -rf app/src/flows`。

- [ ] M2 全量 import 重写 + Name 路径注释对齐
  - 操作：按「import 重写算法」对 `app/src/flows/**/*.{ts,vue}` + `app/src/pages/index.vue` + `app/test/*.test.ts` 逐条重写相对 import；composables 文件头 `Name:` 旧路径串对齐新路径。批处理用一次性脚本 [`scripts/_migrate_imports.mjs`](../scripts/_migrate_imports.mjs)（解析→映射→relative，确定性），跑后立即 `git rm`/删除该脚本，不留仓内。
  - 验收：`grep -rnE "from '[^']*(composables|components)/(shared|flows)" app/src app/test`（空，无旧两树 import 串）；`npx vue-tsc --noEmit -p app/tsconfig.json` exit 0；脚本文件已删除。
  - 影响：约 200+ import + 若干 Name 注释。回滚：同 M1（未提交，整体 reset）。

- [ ] M3 配套门禁/配置同步
  - 操作：
    1. [`scripts/quality_baseline.json`](../scripts/quality_baseline.json) 2 条 `app/src/composables/flows/divination/{use_animation_controller,use_lifecycle}.ts` → `app/src/flows/divination/composables/{...}.ts`。
    2. [`config/dependency-cruiser.cjs`](../config/dependency-cruiser.cjs) 262/273/283：把 `^app/src/(composables|components|pages)/`、`^app/src/(core/gsap|composables/shared/animations|composables/flows/(divination|idle|fallback))/`、`^app/src/shared/(components|views)/` 等价改写为新 `app/src/flows/` 结构正则（守卫语义不变，仅路径形态适配）。
  - 验收：`node scripts/quality_gate.js full` exit 0（含 arch:check/dead-code/dup/audit）。
  - 影响：2 配置文件。回滚：同上整体 reset。

- [ ] M4 全局回归 + 单 commit
  - 操作：全量回归后单 commit。message：`refactor(structure): unify components+composables into flows/<domain>/{components,composables}`。
  - 验收：`npx vue-tsc --noEmit -p app/tsconfig.json`；`npx tsc --noEmit -p server/tsconfig.json`；`npx vitest run --config app/vitest.config.ts --dir app/test`；`npx vitest run --config server/vitest.config.ts --dir server/test`；`npx eslint app/src/ app/test/ server/src/ server/test/`；`node scripts/quality_gate.js full`；`node scripts/build/index.js --prod --target h5 --skip-quality`（DONE 且 perf Δ0.0%）—— 全 exit 0；pre-commit 真实跑通。
  - 影响：单 commit。回滚：`git revert` 该 commit。

## 执行约束

类型检查用 [vue-tsc 不用 tsc](../CLAUDE.md)（前端）；vitest 必带 `--dir app/test`/`--dir server/test`。一次性迁移：M1→M4 全绿才 commit，禁中途 commit、禁跳步、禁门禁绕过。遇验收失败即停并报告。

## 回滚

未提交：`git reset --hard c734759`（迁移前 HEAD）+ `rm -rf app/src/flows` + 删一次性脚本。已提交：`git revert` M4 commit。

## 进度

（未开始）

## 搁置问题

（暂无）
