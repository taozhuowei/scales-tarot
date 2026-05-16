# components

可复用 UI 组件目录。当前为**平铺结构**（原 `shared/components/{containers,overlay,stage-content}` 三层分类语义不清，已暂时取消，待按职责重新归类）。

组件命名与内部逻辑保持迁移前不变，本次仅移动位置并同步依赖路径。下文按功能分组说明每个组件的职责，分组仅为阅读便利，不代表目录结构。

## 基础呈现

- [`TypewriterText.vue`](./TypewriterText.vue) — 文本逐字打字机呈现；封装打字机模型生命周期，`prefers-reduced-motion` 时直出全文。被结论 / 卡牌 / 解读三容器复用的底层呈现件。

## 页眉（header 槽）

- [`HeaderArea.vue`](./HeaderArea.vue) — 顶部页眉的纯几何外壳，集中 margin / height / safe-area / z-index，内容经 slot 注入；自身不渲染文案。
- [`TitleContent.vue`](./TitleContent.vue) — 页眉文案载荷：idle 主 / 副 / 引导（自带 GSAP 错落入场动画）、fallback 单行中性文案，含 idle 错误副行。
- [`ProgressContent.vue`](./ProgressContent.vue) — 占卜视图的 4 阶段进度图标行，数据来自注入的 animationController。

## 舞台（stage 槽 / 动画内容）

- [`Stage.vue`](./Stage.vue) — idle / divination / fallback 三场景的纯居中 slot 外壳，仅附加 `stage--{scene}` 类，不持有动画状态。
- [`Deck.vue`](./Deck.vue) — 统一牌堆装配件：组装 `DeckFanStack` 与 `DeckRig`，承担点击 / 键盘入口、结果牌上移计算与根样式注入。
- [`DeckFanStack.vue`](./DeckFanStack.vue) — idle 态扇形 12 牌堆与底部触摸提示，全部由 props 驱动、无内部状态。
- [`DeckRig.vue`](./DeckRig.vue) — 占卜 GSAP 牌阵（初始堆 / 洗牌两半 / 切牌堆 / 3D 翻牌），绑定传入的 animationController 渲染。
- [`FallbackOrbits.vue`](./FallbackOrbits.vue) — 兜底视图的中心星与四行星 3D 轨道循环动画，无业务状态，GSAP ticker 驱动。

## 解读结果面板

- [`ReadingPanel.vue`](./ReadingPanel.vue) — 组合结论 / 卡牌 / 解读三子容器，处理 loading / error / success 三态与过渡。
- [`ConclusionContainer.vue`](./ConclusionContainer.vue) — 结论倾向文案（正 / 负 / 中）与 tone 配色，打字机时序本地化。
- [`CardMeaningContainer.vue`](./CardMeaningContainer.vue) — 每张牌的名 / 英文名 / 正逆位 / 阿卡纳 / 关键词（无牌面图），逐字段打字机时序。
- [`ReadingTextContainer.vue`](./ReadingTextContainer.vue) — 逐卡解读文字打字机渲染，并在全部文字呈现完成后发出完成事件以推进应用相位。

## 操作与通知

- [`ActionArea.vue`](./ActionArea.vue) — decision 阶段的「回到首页 / 再占一次」按钮，以及读取失败时的「重试」按钮，内置可见性规则，emit 语义动作。
- [`NotificationHost.vue`](./NotificationHost.vue) — 订阅通知 store，渲染跨视图通知队列并提供关闭。

## 开发工具浮层（dev-only）

- [`DevToolsPanel.vue`](./DevToolsPanel.vue) — 可拖拽 / 折叠的开发浮层外壳，承担拖拽手势、折叠态、点击与拖拽仲裁，转发各控制行事件。
- [`DevToolsCollapsedHandle.vue`](./DevToolsCollapsedHandle.vue) — 折叠态 40px 圆形手柄内的闪电图标，纯视觉。
- [`DevToolsPhaseRow.vue`](./DevToolsPhaseRow.vue) — 阶段重播 chips 行。
- [`DevToolsPlaybackRow.vue`](./DevToolsPlaybackRow.vue) — 「跳到解读」与播放倍率 chips 行。
- [`DevToolsControlRow.vue`](./DevToolsControlRow.vue) — 暂停 / 继续 / 单步控制与容器边框开关两行。
