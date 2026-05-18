# src

前端源码。目录结构与每个文件的职责如下。

```
src/
├── main.ts                     应用入口：创建 Vue 应用并装载 Pinia
├── App.vue                     启动组件：加载牌库与主题，记录启动成败；引入全局样式与字体
├── config.json                 运行期常量：牌堆数 12、切牌堆数 3
├── pages.json                  uni-app 路由与全局样式（单页、自定义导航栏）
├── manifest.json               uni-app 应用清单（各端构建配置）
├── uni.scss                    uni-app 内置样式变量（脚手架默认）
├── env.d.ts                    环境与 .vue 模块类型声明、测试注入 API 类型
├── shime-uni.d.ts              为 Vue 组件补充 uni-app 生命周期钩子类型
│
├── pages/
│   └── index.vue               唯一路由根：按启动结果显示主界面或兜底页
│
├── core/                       底层与库领域核心
│   ├── api/                    后端接口客户端
│   │   ├── client.ts           客户端基座：请求封装、资源路径解析、错误提取
│   │   ├── cards.ts            拉取 78 张塔罗牌并解析图片 URL
│   │   ├── divinations.ts      占卜请求入口：抽牌+解读，组装完整结果
│   │   ├── themes.ts           拉取主题（字体/颜色/UI/图片）并解析 URL
│   │   └── types.ts            前后端共享协议类型
│   ├── composables/            视图与 store 之间的解耦封装
│   │   ├── use_app_phase.ts        应用阶段（idle/divination/reading/decision）与转场
│   │   ├── use_boot_status.ts      启动状态读写
│   │   └── use_cards_load_error.ts 牌库加载错误与重试
│   ├── deck/
│   │   └── types.ts            牌堆几何布局类型
│   ├── gsap/                   GSAP 封装
│   │   ├── timeline.ts         时间轴编排器：生命周期与播放控制
│   │   └── tween.ts            取消指定目标上的补间
│   ├── sizing/                 响应式缩放与布局求解
│   │   ├── scale_constants.ts 缩放基线常量与纯函数（画布宽夹取、缩放因子）
│   │   ├── sizes_viewport.ts       由缩放因子派生像素尺寸；视口读取
│   │   ├── scale.ts                  缩放系统门面与响应式组合式
│   │   ├── raf_shim.ts               跨端 requestAnimationFrame 垫片
│   │   ├── layout_solver_types.ts    布局求解输入/输出类型
│   │   ├── layout_solver_computers.ts 舞台/抽屉/运动包络纯计算
│   │   ├── layout_solver_draw.ts     抽牌场景布局求解
│   │   ├── layout_solver_reading.ts  解读场景布局求解
│   │   ├── layout_solver.ts          布局求解门面：按场景分派
│   │   ├── solve_from_window.ts      一步从窗口信息求出场景布局
│   │   ├── use_css_var_bridge.ts     把尺寸写成根元素 CSS 变量
│   │   └── overlay_layout/           占卜浮层场景与运动几何
│   │       ├── wide_breakpoint_and_chrome.ts 宽屏断点与微信胶囊/顶栏避让
│   │       ├── viewport_scene_layout.ts  由窗口构建视口并求场景布局
│   │       ├── motion_metrics.ts         由布局包络算洗/切/抽运动度量
│   │       └── use_overlay_layout.ts     占卜浮层布局组合式门面
│   ├── store/                  Pinia 状态
│   │   ├── tarot.ts            占卜域门面：组合 slices/deck|flow|reading
│   │   ├── slices/deck.ts      牌库数据与加载（状态切片工厂，非 store）
│   │   ├── slices/flow.ts      占卜流程阶段、抽牌、问题（状态切片工厂，非 store）
│   │   ├── slices/reading.ts   解读结果与请求状态（状态切片工厂，非 store）
│   │   ├── boot.ts             启动结果三态（pending/ok/failed）
│   │   ├── notification.ts     跨视图通知队列
│   │   └── theme.ts            主题数据与资产解析
│   ├── styles/
│   │   ├── global.css          全局令牌、重置、工具类、组件与动画样式
│   │   └── overlay/_tokens.css 占卜浮层专属令牌
│   └── utils/
│       ├── math.ts             数值区间钳制 clamp
│       ├── secure_random.ts    安全随机数（视觉抖动用）
│       ├── accessibility.ts    探测“减少动效”偏好
│       ├── tarot_reading_types_shim.ts 类型再导出兼容垫片
│       ├── dev/container_borders.ts 切换调试边框（仅 H5）
│       ├── dev/draggable_panel.ts   调试面板拖拽手柄（仅 H5）
│       ├── reading/reading_provider.ts          解读提供者接口类型
│       ├── reading/rule_based_reading_provider.ts 规则解读提供者：转发后端
│       ├── reading/reading_orchestrator.ts      解读请求生命周期（超时/重试/写入）
│       ├── reading/reading_result_presenter.ts  解读结果转视图模型
│       └── typing/typewriter_model.ts           打字机引擎（域无关）
│
└── flows/                      按业务流分域，每域含视图与编排逻辑
    ├── idle/                   待机扇形牌堆
    │   ├── components/DeckFanStack.vue   待机扇形牌堆展示
    │   ├── components/CardsLoadError.vue 牌库加载失败提示与重试
    │   ├── composables/deck_runtime.ts   待机牌堆运行时状态容器
    │   ├── composables/fan.ts            待机扇形循环时间线
    │   ├── composables/fan_controller.ts 待机扇形循环命令式控制
    │   ├── composables/deck_click_guard.ts  待机点击进入占卜（含双击锁）
    │   ├── composables/deck_card_size.ts 待机卡牌尺寸（与占卜一致）
    │   └── composables/entrance_hint.ts  底部触摸提示淡入
    ├── divination/             占卜四相位动画管道
    │   ├── components/DeckRig.vue          占卜演出台：洗/切/抽/翻四层
    │   ├── components/ProgressContent.vue  头部四相位进度图标
    │   ├── composables/phase_registry.ts   相位顺序与元数据
    │   ├── composables/pipeline_deps.ts    管道共享依赖契约类型
    │   ├── composables/pipeline_builder.ts 按相位顺序构建执行器
    │   ├── composables/phases/shuffle.ts       洗牌相位时间线
    │   ├── composables/phases/cut.ts           切牌相位时间线
    │   ├── composables/phases/draw.ts          抽牌相位（按动效偏好分派）
    │   ├── composables/phases/draw_timeline.ts 抽牌时间线实现
    │   ├── composables/phases/reveal.ts        翻牌相位（先放大后翻面）
    │   ├── composables/run_pipeline_command.ts 运行四相位管道命令
    │   ├── composables/use_phase_state.ts           相位状态与推进
    │   ├── composables/use_lifecycle.ts        遮罩动画生命周期（start/skip/replay）
    │   ├── composables/use_lifecycle_types.ts  生命周期类型
    │   ├── composables/use_animation_controller.ts 占卜动画控制器（组合各 hook）
    │   ├── composables/use_presentation.ts     由相位派生展示数据
    │   ├── composables/progress_model.ts       进度纯状态模型
    │   ├── composables/progress_presenter.ts   进度转视图数据
    │   ├── composables/phase_entry_snap.ts 各相位入场态快照
    │   ├── composables/replay_from_phase.ts    从指定相位重放（开发用）
    │   ├── composables/skip_to_reading.ts      跳过洗切抽直达翻牌
    │   ├── composables/rig_lifecycle.ts       演出台启停与窗口 resize 监听
    │   └── composables/overlay_text.ts         占卜遮罩文案常量
    ├── reading/                解读面板与二段揭示
    │   ├── components/ReadingPanel.vue          解读面板：loading/error/success 三态
    │   ├── components/ReadingSplitView.vue      宽屏解读视图（右半侧栏）
    │   ├── components/ReadingDrawerView.vue     窄屏解读视图（底部抽屉）
    │   ├── components/ConclusionContainer.vue   结论容器（倾向+标题）
    │   ├── components/CardMeaningContainer.vue  卡牌释义容器
    │   ├── components/ReadingTextContainer.vue  解读正文打字机容器
    │   ├── components/ActionArea.vue            重开/回首页/重试按钮区
    │   ├── composables/use_reading_request_controller.ts       解读请求生命周期
    │   ├── composables/use_reading_panel_view_model.ts 解读结果转面板视图模型
    │   ├── composables/reading_panel_timing.ts         解读面板逐字交错计时
    │   ├── composables/use_result_card_shrink.ts       结果卡收缩到抽屉尺寸（窄屏）
    │   └── composables/result_card_lift_margin.ts      结果卡抬升留白常量
    ├── index/                  主界面装配与开发工具
    │   ├── components/MainSurface.vue              主界面装配根
    │   ├── components/StageDeck.vue                 单例舞台牌堆（idle/占卜切换）
    │   ├── components/NotificationHost.vue         通知队列渲染（占位）
    │   ├── components/DevToolsPanel.vue            可拖拽调试面板外壳（开发环境）
    │   ├── components/DevToolsCollapsedIcon.vue    调试面板折叠态闪电图标
    │   ├── components/DevToolsControlRow.vue       暂停/继续/单步控制行
    │   ├── components/DevToolsPhaseRow.vue         按相位重播芯片行
    │   ├── components/DevToolsPlaybackRow.vue      直接解读与速率芯片行
    │   ├── composables/use_main_stage.ts           主舞台编排聚合
    │   ├── composables/use_active_view.ts          解读视图门控与抽屉几何
    │   ├── composables/create_main_transition_handlers.ts        晋升解读与重启处理器
    │   ├── composables/use_header_presentation.ts  页眉 variant 与 ARIA 派生
    │   ├── composables/use_play_deck_animation.ts  按相位驱动单例牌堆
    │   └── composables/use_dev_tools.ts            调试面板开关与回调
    ├── fallback/               启动失败兜底
    │   ├── components/FallbackView.vue   启动失败兜底视图
    │   ├── components/FallbackOrbits.vue 行星轨道动画内容
    │   └── composables/orbits.ts         轨道动画构建
    └── shared/                 跨域复用组件与动画相位引擎
        ├── components/HeaderArea.vue      页眉布局外壳
        ├── components/Stage.vue           居中舞台容器
        ├── components/TitleContent.vue    页眉文案与入场动画
        ├── components/TypewriterText.vue  打字机文字组件
        ├── composables/animations/state_types.ts          动画状态类型与时间轴接口
        ├── composables/animations/phase_contracts.ts     相位编排契约类型
        ├── composables/animations/initial_states.ts      各组初始状态工厂
        ├── composables/animations/animation_targets.ts   GSAP 目标对象管理与重置
        ├── composables/animations/visibility.ts          卡组可见性标志管理
        ├── composables/animations/style_sync.ts          状态同步为样式 ref
        ├── composables/animations/use_animation_state.ts 状态聚合（state+样式+可见性）
        ├── composables/animations/use_playback.ts        时间轴播放控制
        ├── composables/animations/pipeline.ts            相位流水线串行编排
        ├── composables/animations/grow.ts                放大原子
        └── composables/animations/flip.ts                翻牌原子
```
