# 迁移执行计划

> 本文件是唯一计划文档:先「规则与背景」(所有任务共享),后「Phase A 任务」(逐个详写)。
> 目录目标结构见 [docs/app_structure.md](app_structure.md);架构总则见 [CLAUDE.md](../CLAUDE.md) "State-phase 迁移" 节。

---

## 规则与背景

### 工程总则(源自 CLAUDE.md,执行摘要)

- 每个原子任务 = 一个 Conventional Commits 提交;无 AI 署名;不 push 远端;提交前必须过验收。
- executor 单一域代理执行 + 并行异构 audit 代理复核;连续两次失败则停并报告用户。
- 不扩 npm 脚本面;质量门用 `node scripts/quality_gate.js full`;前端类型检查用 `vue-tsc` 不用 `tsc`。

### Phase A 硬边界(违反即返工)

本阶段唯一目标:消灭 6 个横切顶层目录,内容**整体搬迁**到新根目录,让 `app/src/` 顶层只剩 `app_structure.md` 定义的根目录。

- **整体搬,不拆**:旧目录连同内部子目录/文件结构整体 `git mv`,文件内部结构、逻辑、函数粒度、**文件名**一律不动。
- **不按 state 重分配**:不把文件按 idle/divination/reading 拆开;`states/` 本阶段不产生内容(state 垂直化属 Phase A2)。
- **不删任何业务文件**:含旧计划标记"待删"的 `stores/flow.ts`、`stores/reading.ts`,本阶段一并保留搬迁。
- **不建新机制**:不建 state_controller/phase_controller/`*_flow`/task 层,不引入新抽象,不改运行时行为,视觉与交互零回归。
- **不动的目录**:`composables/`、`core/{config,deck,flow,sizing}`、`pages/`、`styles/`、`App.vue`、`main.ts`、`pages.json`、`env.d.ts`、`shime-uni.d.ts` —— 仅因上游搬迁被动更新其 import,本身不挪、不改名。
- **R9 零兼容**:每任务三步 —— 新位置就位 → 全仓改 import → 立即删旧、禁止留 re-export;一任务一 commit,不得有半搬迁状态跨 commit。

### 归属总表(本阶段最终落点,无例外、无决策点)

- `app/src/api/` → `app/src/core/api/`(整目录,内部不拆)
- `app/src/utils/` → `app/src/core/utils/`(整目录;`reading/`、`tarot_reading.ts`、`typing/`、`dev/`、`overlay_progress/` 等子项原样保留)
- `app/src/animation/` → `app/src/core/animation/`(整目录;`phases/`、`atoms/`、`adapters/`、`reconciler.ts` **不改名**,原样保留)
- `app/src/stores/` → `app/src/shared/store/`(整目录 6 文件,含 `flow.ts`、`reading.ts`)
- `app/src/components/` → `app/src/shared/components/`(整目录;`containers/`、`overlay/`、`stage-content/`、`TypewriterText.vue` 原样保留)
- `app/src/views/` → `app/src/shared/views/`(整目录 4 个 `.vue`)

### import 改写规范(权威,全任务统一)

项目**运行时无 `@` 别名**(`app/vite.config.ts` 仅 `gsap` 别名、`app/vitest.config.ts` 无别名;`@/*` 仅 `tsconfig.json` 类型解析用)。代码惯例全程相对路径。铁律:

- **保持相对路径风格,严禁改用 `@/` 别名**(vite/vitest 无法解析会整批 import 失败——A1 已验证)。
- 旧引用解析到 `app/src/<old>/X`,目标 `app/src/<newroot>/X`;引用文件到 `app/src` 的层级不变,故**仅把路径段 `<old>` 替换为 `<newroot>`,相对前缀 `../`/`./` 数量不变**(`../stores/x`→`../shared/store/x`、`../../api/x`→`../../core/api/x`、`./api/x`→`./core/api/x`)。
- 动态 `import('...')` 同规则;旧目录内部文件间相对 import 不变(随目录整体迁移仍有效)。
- 改写后旧相对路径各形式与 `@/<old>` 均 `rg` 零命中方可提交。逐文件用 `path.relative(dirname(file),'app/src/<newroot>')` 精确生成前缀最稳。

### 通用验收(每个搬迁任务必须全绿)

1. 旧目录已消失 + 新目录就位(各任务给具体 `test` 断言)。
2. 旧路径零命中:`rg "@/<old>/|['\"][^'\"]*\.\./<old>/" app/src app/test/`。
3. `node scripts/quality_gate.js full`。
4. `npx vitest run --config app/vitest.config.ts --dir app/test`。
5. 涉 `.vue` 的任务(A5/A6)视图回归在 A7 终检统一跑 playwright(h5)。

### Agent 协作模式

- executor:`Frontend Developer`(纯前端目录)/ `Backend Architect`(`api/`)/ `Software Architect`(`stores/`)。
- 审计:`Code Reviewer` + `Minimal Change Engineer`;`stores/` 加 `Reality Checker`;终检审计 `Reality Checker` + `Evidence Collector`(截图佐证零回归)。

---

## Phase A 任务(h5 only,顺序执行:被依赖多者先行)

> ✅ **已完成(2026-05-16)**:commit `0e37236`→`204c27c`(7 搬迁+1 连带修复)。根目录收敛至 `core/composables/shared/pages/styles`,6 横切目录消灭;`gate full` 全绿(质量门/类型/单测 app182+server54/arch:check 无依赖违规/dead-code/dup);prod 构建 perf Δ0.0% + SPA smoke 通过;全流程截图与基线对照,静态/动画帧逐字节一致、reading 仅业务随机差异——视觉/功能零回归。内部细分见 Phase A2。

### A1 — api/ → core/api/

- executor `Backend Architect`;审计 `Code Reviewer` + `Minimal Change Engineer`。前置:无(首个;`core/` 已存在)。
- 步骤:① `git mv app/src/api app/src/core/api` ② `rg -l "@/api/|(\.\./)+api/|['\"]\./api/" app/src app/test/` 找引用 ③ 按〔import 改写规范〕改引用:相对路径保 `../`/`./` 前缀,段 `api`→`core/api`;`api/` 内部相对 import 不变。
- 验收:`test ! -d app/src/api` + `rg "@/api/|['\"][^'\"]*\.\./api/" app/src app/test/` 零命中 + gate full + app vitest 全绿。
- commit:`refactor(app): move api into core/api`

### A2 — utils/ → core/utils/

- executor `Frontend Developer`;审计 `Code Reviewer` + `Minimal Change Engineer`(重点校验 `reading/`、`tarot_reading.ts` 未被误拆/重分类)。前置:A1 已 commit。
- 步骤:① `git mv app/src/utils app/src/core/utils`(含全部子目录)② 找引用 `rg -l "@/utils/|(\.\./)+utils/|['\"]\./utils/" app/src app/test/` ③ 按〔import 改写规范〕改引用:相对路径保前缀,段 `utils`→`core/utils`;`utils/` 内部相对 import 不变。
- 验收:`test ! -d app/src/utils` + `rg "@/utils/|['\"][^'\"]*\.\./utils/" app/src app/test/` 零命中 + gate full + app vitest 全绿。
- commit:`refactor(app): move utils into core/utils`

### A3 — stores/ → shared/store/

- executor `Software Architect`;审计 `Code Reviewer` + `Reality Checker`(Pinia 注册/`main.ts` SSR 入口/`flow.ts`+`reading.ts` 未删)。前置:A2 已 commit;`shared/` 需先建。
- 步骤:① `mkdir -p app/src/shared` ② `git mv app/src/stores app/src/shared/store` ③ 找引用 `rg -l "@/stores/|(\.\./)+stores/|['\"]\./stores/" app/src app/test/` ④ 按〔import 改写规范〕改引用:相对路径保前缀,段 `stores`→`shared/store`;`store/` 内部相对 import 不变。
- 验收:`test ! -d app/src/stores && test -f app/src/shared/store/flow.ts && test -f app/src/shared/store/reading.ts` + `rg "@/stores/|['\"][^'\"]*\.\./stores/" app/src app/test/` 零命中 + gate full + app vitest 全绿。
- commit:`refactor(app): move stores into shared/store`

### A4 — animation/ → core/animation/

- executor `Frontend Developer`;审计 `Code Reviewer` + `Minimal Change Engineer`(重点校验 `reconciler.ts` 未改名、phases 未按 state 拆)。前置:A3 已 commit。
- 步骤:① `git mv app/src/animation app/src/core/animation`(含 `phases/`、`atoms/`、`adapters/`、`reconciler.ts` 等全部)② 找引用 `rg -l "@/animation/|(\.\./)+animation/|['\"]\./animation/" app/src app/test/` ③ 按〔import 改写规范〕改引用:相对路径保前缀,段 `animation`→`core/animation`;`animation/` 内部相对 import 不变。
- 验收:`test ! -d app/src/animation && test -f app/src/core/animation/reconciler.ts` + `rg "@/animation/|['\"][^'\"]*\.\./animation/" app/src app/test/` 零命中 + gate full + app vitest 全绿。
- commit:`refactor(app): move animation into core/animation`

### A5 — components/ → shared/components/

- executor `Frontend Developer`;审计 `Code Reviewer` + `Minimal Change Engineer`(校验 `.vue` 引用含动态 import/模板注册全改)。前置:A4 已 commit;`shared/` 已存在。
- 步骤:① `git mv app/src/components app/src/shared/components`(含 `containers/`、`overlay/`、`stage-content/`、`TypewriterText.vue`)② 找引用 `rg -l "@/components/|(\.\./)+components/|['\"]\./components/" app/src app/test/` ③ 按〔import 改写规范〕改引用:相对路径保前缀,段 `components`→`shared/components`;`components/` 内部相对 import 不变。
- 验收:`test ! -d app/src/components` + `rg "@/components/|['\"][^'\"]*\.\./components/" app/src app/test/` 零命中 + gate full + app vitest 全绿(视图回归归 A7)。
- commit:`refactor(app): move components into shared/components`

### A6 — views/ → shared/views/

- executor `Frontend Developer`;审计 `Code Reviewer` + `Minimal Change Engineer`(校验 `pages/main`+`pages/fallback` 入口引用已改、`PlayView.vue` 未拆)。前置:A5 已 commit。
- 步骤:① `git mv app/src/views app/src/shared/views`(`PlayView`/`ReadingSplitView`/`ReadingDrawerView`/`FallbackView` 4 文件)② 找引用 `rg -l "@/views/|(\.\./)+views/|['\"]\./views/" app/src app/test/` ③ 按〔import 改写规范〕改引用:相对路径保前缀,段 `views`→`shared/views`;`views/` 内部相对 import 不变。
- 验收:`test ! -d app/src/views && test -f app/src/shared/views/PlayView.vue` + `rg "@/views/|['\"][^'\"]*\.\./views/" app/src app/test/` 零命中 + gate full + app vitest 全绿。
- commit:`refactor(app): move views into shared/views`

### A7 — Phase A 终检验收(非搬迁,有回归才 fix:,否则不提交)

- executor `Frontend Developer`;审计 `Reality Checker` + `Evidence Collector`(截图佐证零回归,无证据即驳回)。前置:A1~A6 全 commit。
- 清单:① `find app/src -maxdepth 1 -type d` 仅含 `core composables shared pages styles` ② `rg "@/(animation|api|utils|stores|views|components)/|['\"][^'\"]*\.\./(animation|api|utils|stores|views|components)/" app/src app/test/` 零命中 ③ gate full ④ app vitest ⑤ `npx vue-tsc --noEmit -p app/tsconfig.json` ⑥ `npx playwright test --config=app/playwright.config.ts`(h5) ⑦ 人工走查:待机→占卜(洗/切/抽/揭)→解读(宽屏/窄屏)→重试→再占一次→回首页,视觉与交互与迁移前一致。
- 结果:全绿零回归则 Phase A 完成、不提交;有回归则逐项 `fix:` 原子 commit,无法即时修复者经用户确认登记 Phase B。

---

## 后续阶段(备忘,Phase A 100% 完成后逐个展开)

- **Phase A2 — 内部细分(h5)**:按 `app_structure.md` 完整结构细分(state 垂直化、`states/<state>/{view,phases,shared}`、`composables/` 分层、`core/{config→constants,deck/types→deck_geometry,flow 删}`、拆 `PlayView`、`reconciler→reconcile` 改名、建 controller/flow/task、删 `stores/{flow,reading}`);内部细分待决策点届时逐个与用户确认。
- **Phase B — Bug 修复(h5)**:draw 末尾 `stage.y=0` 复位;reveal 合并 grow+flip 为单 tween;Phase A/A2 暴露的其他 bug。
- **Phase D — 文档收口**:拆 `PRD.md`,`README.md` 重写为入口索引。
- **Phase C — 小程序验证**:mp-weixin 跑通,差异报告,逐项修复。
