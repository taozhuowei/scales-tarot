# app/src 目录结构

> 本文档是 `app/src/` 源码目录结构的**权威说明**。CLAUDE.md / README.md 的目录结构相关内容以本文档为准;迁移计划见 `docs/TODO.md`。

## 设计原则

按 **state(状态)→ phase(阶段)→ task(任务)** 三层粒度垂直组织。三个 state(`idle` 待机 / `divination` 占卜 / `reading` 解读)各自自治;框架底层、IO、逻辑域沉到 `core/`;共享代码按"覆盖全部消费者的最窄层"就近放置。

## 目录树

```
app/src/
│
├── core/                              # 框架底层 + IO 基础设施 + 逻辑域
│   ├── utils/                         # 工程类纯函数
│   │   ├── reconcile.ts               # GSAP ↔ Vue ref 桥接
│   │   ├── math.ts                    # 数学工具
│   │   ├── accessibility.ts           # 无障碍工具
│   │   ├── secure_random.ts           # 安全随机数
│   │   ├── typing/                    # 打字机文本工具
│   │   ├── dev/                       # dev 辅助工具
│   │   └── overlay_progress/          # 进度计算工具
│   ├── http/
│   │   └── client.ts                  # uni.request 封装(h5/mp 兼容底层请求)
│   ├── data/                          # 卡牌数据 + 解读领域
│   │   ├── cards.ts                   # 78 张牌数据接口
│   │   ├── divinations.ts             # 解读 API 接口
│   │   ├── tarot_reading.ts           # 解读领域纯函数
│   │   └── dto.ts                     # 接口 DTO 类型
│   ├── theme/
│   │   └── themes.ts                  # 主题接口
│   ├── deck_geometry.ts               # 牌堆几何坐标类型
│   ├── constants/                     # 调优常量,按职责分文件
│   │   ├── typewriter_timing.ts       # Hero 打字机节奏
│   │   ├── animation_limits.ts        # 卡数上限 / 切堆上限 / 揭示延迟
│   │   ├── drawer_geometry.ts         # 抽屉初高比 / 抬升边距
│   │   ├── shuffle_motion.ts          # 洗牌散布 / 边距
│   │   └── interaction_safety.ts      # 牌堆防双击间隔
│   └── sizing/                        # 布局求解
│       ├── responsive_breakpoints.ts  # 断点常量 + deriveScale / pickCanvasWidth
│       ├── responsive_sizes.ts        # deriveSizes + readViewport + ResponsiveSizes
│       ├── scale.ts                   # 纯 facade 再导出
│       ├── solve_from_window.ts       # window → SceneLayout 适配器
│       ├── layout_solver.ts           # solveLayout 编排器
│       ├── layout_solver_types.ts     # SceneLayout / CardLayout 等类型
│       └── layout_solver_computers.ts # per-scene 纯计算
│
├── composables/                       # 项目工程类 composable(与 state 无关)
│   └── use_responsive_scale.ts        # 响应式 viewport/sizes 单例
│
├── shared/                            # L1 跨 state 共享
│   ├── components/                    # NotificationHost / Stage / HeaderArea / DevToolsPanel
│   ├── composables/                   # 跨 state(state 语义相关)的 use_*
│   ├── store/                         # 跨 state Pinia store
│   └── tasks/                         # 跨 state 共享 task(通常空)
│
├── states/                            # 三个 state 模块 + 全局 state 控制
│   ├── state_controller.ts            # 全局 state 控制器(管 state 间跳转)
│   │
│   ├── idle/                          # state 1: 待机(1 view / 1 phase)
│   │   ├── idle_flow.ts               # state 流程入口
│   │   ├── phase_controller.ts        # 本 state 的 phase 控制器
│   │   ├── shared/                    # L2 跨 view+phase 共享
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   └── tasks/
│   │   ├── view/
│   │   │   ├── IdleView.vue           # 待机视图
│   │   │   ├── containers/            # 含逻辑大块组件
│   │   │   ├── components/            # 展示细粒度组件
│   │   │   └── composables/           # 单 view 专属 composable
│   │   └── phases/
│   │       └── fan/
│   │           ├── fan_flow.ts        # 扇形循环 phase 函数
│   │           └── components/        # phase 专属组件
│   │
│   ├── divination/                    # state 2: 占卜(1 view / 4 phase)
│   │   ├── divination_flow.ts
│   │   ├── phase_controller.ts
│   │   ├── shared/                    # L2 跨 view+phase: Deck / DeckFanStack
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   └── tasks/
│   │   ├── view/
│   │   │   ├── DivinationView.vue
│   │   │   ├── containers/            # TitleContent / ProgressContent
│   │   │   ├── components/
│   │   │   └── composables/
│   │   └── phases/
│   │       ├── shared/                # L3 跨 phase 共享(4 phase 间)
│   │       │   ├── components/
│   │       │   └── tasks/
│   │       ├── shuffle/  { shuffle_flow.ts  components/ }   # 洗牌
│   │       ├── cut/      { cut_flow.ts      components/ }   # 切牌
│   │       ├── draw/     { draw_flow.ts     components/ }   # 抽牌
│   │       └── reveal/   { reveal_flow.ts   components/ }   # 揭示
│   │
│   └── reading/                       # state 3: 解读(2 view / 2 phase)
│       ├── reading_flow.ts
│       ├── phase_controller.ts
│       ├── shared/                    # L2 跨 view+phase
│       │   ├── components/
│       │   ├── composables/
│       │   └── tasks/
│       ├── view/
│       │   ├── ReadingDrawerView.vue  # 窄屏抽屉视图
│       │   ├── ReadingSplitView.vue   # 宽屏分栏视图
│       │   ├── shared/                # L2.5 跨 view 共享
│       │   │   ├── components/        # ReadingPanel / ActionArea
│       │   │   └── composables/
│       │   ├── containers/
│       │   ├── components/
│       │   └── composables/
│       └── phases/
│           ├── shared/                # L3 跨 phase 共享(enter/typing 间)
│           │   ├── components/
│           │   └── tasks/
│           ├── enter/   { enter_flow.ts   components/ }    # 入场(展开抽屉)
│           └── typing/  { typing_flow.ts  components/ }    # 打字机(ReadingTextContainer)
│
├── pages/                             # uni-app 路由(不可改名)
│   ├── main/                          # 主路由 → state_controller 接管
│   └── fallback/                      # FallbackView + orbitPlanets 动画
│
├── styles/                            # 全局样式
├── App.vue                            # uni-app 根组件
├── main.ts                            # 入口(createSSRApp + Pinia)
├── pages.json                         # uni-app 路由表
├── manifest.json                      # uni-app 应用配置
├── env.d.ts                           # 环境类型声明
├── shime-uni.d.ts                     # uni-app 类型补丁
├── uni.scss                           # uni-app 全局 scss 变量
└── config.json                        # 应用配置
```
