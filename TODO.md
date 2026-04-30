# Scales Tarot — TODO

> 本文档根据 `2026-04-30` 深度 review 结果制定修复计划。
> 优先级定义：P0 = 必须修复 / P1 = 中高优先级 / P2 = 中等 / P3 = 低优先级建议。

---

## 阶段 A — 紧急清理（P0）

### A-1 决断双重模块结构

处理 `phases/`、`scene/`、`layout/`、`sizing/`、`viewport/`、`reading/`、`orchestrator/` 七个目录的骨架桩。**三选一，不可含混**：

- 选项一：在 2 周内完成迁移，删除所有旧版对应文件
- 选项二：删除所有骨架文件，将架构意图集中在 `docs/technical_architecture.md` 中
- 选项三：锁定骨架 API 并逐步迁移，旧版骨架并存期内删除所有 `throw new Error` 桩，改为将旧版模块 re-export 通过骨架接口

**验收标准**：
- 全量 `npm run quality` 通过
- 不再有任何 `'skeleton: not yet implemented'` 错误
- `dependency-cruiser` 边界规则检查全部通过

### A-2 巨型文件分解

三个基线豁免文件必须制定分解计划：

| 文件 | 当前行数 | 分解目标 |
|------|---------|---------|
| `DivinationOverlay.vue` | 935 | CSS 外移到独立文件，组件拆分为子组件 |
| `use_animation_controller.ts` | 622 | 按骨架规划拆到 `orchestrator/` 三个文件 |
| `pages/index/index.vue` | 610 | CSS 外移 + 逻辑提取到 composable |

**方法**：设置止增基线不变的前提下，每轮迭代减少至少 15% 行数，直至各文件 ≤ 300 行。

---

## 阶段 B — 架构加固（P1）

### B-1 统一重复类型定义

当前同一类型定义在三处以上重复的文件：

| 类型 | 重复位置 |
|------|---------|
| `CardLayout` | `core/layout/types.ts` / `core/sizing/layout_solver.ts` / `layout/types.ts` |
| `PhysicalViewport` | `core/sizing/physical_reservations.ts` / `viewport/types.ts` |
| `DrawerGeometry` | `core/sizing/layout_solver.ts` / `layout/types.ts` |
| `WindowInfoShape` | `core/sizing/physical_reservations.ts` / `viewport/types.ts` |
| `LayoutEnvelope` | `core/layout/types.ts` / `core/sizing/layout_solver.ts` / `layout/types.ts` |

**解决**：在阶段 A（决断双重模块）基础上，确定单一 true source：
- 若保留旧版：删除所有骨架类型，旧版为 true source
- 若保留骨架：删除旧版类型，骨架为 true source
- 添加 `dependency-cruiser` 规则 `no-duplicate-type-def` 阻止重复

### B-2 拆分 `use_animation_controller`

当前单文件 622 行、27+ 直接导入。按骨架规划拆分为：

| 目标文件 | 职责 | 来源行 |
|---------|------|-------|
| `orchestrator/use_phase_pipeline.ts` | 流水线控制（run / skipTo / replayFrom） | ~200 行 |
| `orchestrator/use_overlay_lifecycle.ts` | 生命周期（restart / retry / finish） | ~80 行 |
| `orchestrator/use_overlay_css_vars.ts` | CSS 变量计算 | ~60 行 |
| 剩余留在 `use_animation_controller` | 入口动画 + 场景创建 + 公共 API | ~280 行 |

**验收**：拆完后每个文件 ≤ 300 行，`npm run quality` 全部通过。

### B-3 消除 `use_overlay_controller` 的 40+ 逐字段透传

将当前逐字段拆包改为对象透传 + 模板侧解引用。模板中访问 `controller.bgStyle` 与访问 `animController.bgStyle` 在 uni-app 的 Vue 运行时中行为相同（ref 响应式不变）。

### B-4 CSS 变量集中治理

- 将 `DivinationOverlay.vue` scoped style 中的 `--color-*` 变量移至 `styles/global.css` 的 `:root` 中
- `#ifdef H5` / `#ifdef MP-WEIXIN` 的 marginTop 差值添加注释说明来源

---

## 阶段 C — 质量门禁强化（P2）

### C-1 扩充测试耦合门风险目录

向 `scripts/test_coupling_gate.js` 的 `RISK_PATHS` 添加：

```
app/src/scene
app/src/phases
app/src/layout
app/src/sizing
app/src/orchestrator
```

### C-2 激活或清理 `core/animation/types.ts` 抽象层

二选一：
- **激活**：让 `gsap_adapter.ts` 实现 `AnimationEngine` 接口，所有消费者通过该接口调用
- **清理**：删除该文件，在 `technical_architecture.md` 中记录"当前无引擎抽象层"

### C-3 修复 CI 问题

- CI 中 E2E 不再依赖 `verify` job（改为并发）
- Playwright config 启用 `trace: 'retain-on-failure'`，artifact 包含 `test-results/`
- Commitlint 加入 CI 步骤
- CI 添加 `timeout-minutes` 防止 job 悬空

### C-4 性能基线建立

- 添加 `scripts/perf_baseline_gate.js`（WIP），记录 3 项关键指标：
  1. `DivinationOverlay` 首次渲染 DOM 节点数（当前 ~100+ images）
  2. 入口动画帧率（目标 60fps）
  3. 构建产物大小

---

## 阶段 D — 自动化运维（P3）

### D-1 添加 Dependabot 配置

创建 `.github/dependabot.yml`，至少包含安全更新（`security-updates-only: true` 或 `package-ecosystem: npm`）。

### D-2 添加 PR 模板

创建 `.github/pull_request_template.md`，包含：
- 变更摘要
- 测试方法（改了什么、怎么测）
- Quality gate 检查清单

### D-3 清理空 CSS 及其他

- 删除 `DivinationOverlay.vue` 中的空 `.tarot-card {}` 规则
- 确认 `TooSmallBanner.vue` 激活路径，要么挂载要么删除

---

## 阶段状态

```
[ ] 阶段 A — 紧急清理
  [ ] A-1 决断双重模块结构
  [ ] A-2 巨型文件分解
[ ] 阶段 B — 架构加固
  [ ] B-1 统一重复类型定义
  [ ] B-2 拆分 use_animation_controller
  [ ] B-3 消除 overlay controller 透传
  [ ] B-4 CSS 变量集中治理
[ ] 阶段 C — 质量门禁强化
  [ ] C-1 扩充测试耦合门
  [ ] C-2 激活/清理 animation/types 抽象层
  [ ] C-3 CI 修复
  [ ] C-4 性能基线
[ ] 阶段 D — 自动化运维
  [ ] D-1 Dependabot
  [ ] D-2 PR template
  [ ] D-3 清理
```
