# Scales Tarot — 架构 · 计划 · 待决策

> 本文档分三章。任何代码改动以第一章为准;第二章列具体任务;第三章列尚未闭环的设计决策。

---

## 第一章 · 架构设计

### 1.1 设计目标

把应用层抽象统一到 **state(状态)/ phase(阶段)/ task(任务)** 三层粒度。流程编排穿过 **state_controller + phase_controller** 两个 controller 对象。state_controller 管 state 间跳转,phase_controller 管 state 内 phase 间跳转;phase 与 task 是 async function。**自驱动模式**:每层结束时主动调上层 controller 的 next() 推进。无 task_controller 包装层(task 直接调 GSAP/fetch/DOM)。

### 1.2 四类抽象

`state_controller` / `phase_controller` 是 **controller 对象**(有状态和方法,接口对称:current/next/jumpTo/cancel/run);`phase` / `task` 是 **async function**(纯执行)。task 内部直接调 GSAP/fetch/DOM,无包装。

```
┌──────────────────────────────────────────────────────────┐
│  视图层 view  —  states/<name>/view/*.vue                 │
│  <view @click="state_controller.next()">点牌堆</view>      │
└────────────────────────┬─────────────────────────────────┘
                         │ onclick 直接调
                         ↓
┌──────────────────────────────────────────────────────────┐
│  state_controller (状态控制器, 全局唯一)                  │
│  位置: app/src/core/state_controller.ts                  │
│                                                          │
│  状态机标准顺序: 待机 → 占卜 → 解读 → (用户触发)→ 待机     │
│   (单向状态流, 不自动循环)                                 │
│                                                          │
│  接口:                                                    │
│    current               当前 state 名 (响应式 ref)       │
│    next()                进入下一个 state                 │
│    jumpTo(stateName)     强制跳到指定 state               │
│    cancel()              中断当前 state 全部正在跑的 phase │
│    run()                 启动当前 state                   │
│                                                          │
│  内部:                                                    │
│    切换 state 时: cancel 旧 state → 调新 state.run()       │
│    每次切换写 lifecycle_log                               │
└────────────────────────┬─────────────────────────────────┘
                         │ 调 state 对象的 run hook
                         ↓
┌──────────────────────────────────────────────────────────┐
│  state 对象 (配置 + 钩子)                                  │
│  位置: app/src/states/<name>/<name>_flow.ts              │
│                                                          │
│  待机: { phases: [fan], run() }                          │
│  占卜: { phases: [shuffle, cut, draw, reveal], run() }   │
│  解读: { phases: [enter, typing], run() }                 │
│                                                          │
│  state.run() 内部:                                        │
│    ctx.phase_controller =                                │
│      createPhaseController(this.phases)                  │
│    return ctx.phase_controller.run(ctx)                  │
│    // phase_controller 完成时会调 state_controller.next() │
└────────────────────────┬─────────────────────────────────┘
                         │ 创建并启动
                         ↓
┌──────────────────────────────────────────────────────────┐
│  phase_controller (per state 一实例对象)                   │
│  位置: app/src/core/phase_controller.ts (工厂函数)         │
│                                                          │
│  接口 (与 state_controller 对称):                         │
│    currentPhase           当前 phase 名 (响应式 ref)       │
│    next(ctx)              进入下一个 phase                │
│    jumpTo(phaseName, ctx) 强制跳到指定 phase              │
│    cancel()               中断当前 phase 全部 task         │
│    run(ctx)               启动第一个 phase, 返回 Promise   │
│                                                          │
│  内部:                                                    │
│    run() = 启动第一个 phase (fire-and-forget),           │
│           返回 Promise 等待 next 推进到末尾                │
│    next() = currentIndex++, 启动下一 phase;若末尾则       │
│           调 state_controller.next() 通知上层              │
└────────────────────────┬─────────────────────────────────┘
                         │ 启动 phase async function
                         ↓
┌──────────────────────────────────────────────────────────┐
│  phase 是 async function                                  │
│  位置: app/src/states/<name>/phases/<phase>_flow.ts      │
│                                                          │
│  export async function shuffle(ctx) {                    │
│    await hideInitialDeck(ctx)                            │
│    await Promise.all([                                   │
│      revealLeftStacks(ctx),                              │
│      revealRightStacks(ctx)                              │
│    ])                                                    │
│    await collectLeftStacks(ctx)                          │
│    // ...                                                │
│    ctx.phase_controller.next(ctx)  ← 自驱动进下一 phase  │
│  }                                                       │
│                                                          │
│  phase 内部直接 await/Promise.all 编排 task               │
│  末尾调 phase_controller.next, 与 state 对称              │
└────────────────────────┬─────────────────────────────────┘
                         │ await task async function
                         ↓
┌──────────────────────────────────────────────────────────┐
│  task 是 async function (最小执行单元)                     │
│  位置:                                                    │
│   - 仅一个 phase 用: 该 phase 文件内局部函数               │
│   - 跨 phase 共享: states/<name>/phases/shared/tasks/    │
│   - 跨 state 共享: states/shared/tasks/                  │
│                                                          │
│  export async function liftStage(ctx) {                  │
│    return new Promise(resolve => {                       │
│      gsap.to(ctx.stage, {                                │
│        y: -liftY, duration: 0.92, ease: 'power2.inOut',  │
│        onComplete: resolve                               │
│      })                                                  │
│    })                                                    │
│  }                                                       │
│                                                          │
│  内部直接调 GSAP / fetch / DOM (mp 兼容用 reconcile 工具) │
│  无 atom_controller, 无包装对象                          │
└──────────────────────────────────────────────────────────┘
```

### 1.3 术语表(中英对照)

- **state(状态)**: app 当前在做什么的最大单位。共 **3 个 + 1 路由**:
  - **待机 idle**: 启动 / reset 后,展示主页
  - **占卜 divination**: 用户触发后,洗→切→抽→揭整个过程
  - **解读 reading**: 占卜结果展示 + 用户决定再占或回首页
  - fallback 页是 uni-app 路由级特殊页,不归 state_controller 管(见第三章 Q-G)
- **phase(阶段)**: 一个 state 内的"段落"。本项目:
  - 待机:`fan`(扇形循环动画)
  - 占卜:`shuffle` / `cut` / `draw` / `reveal`
  - 解读:`enter` / `typing`
- **task(任务)**: 一个 phase 内最小可执行单元的 async function。例:
  - `liftStage`(舞台上升) — 单 GSAP tween
  - `revealCards`(放大+翻牌合并) — 单 GSAP tween 同时改 rotationY + scale
  - `expandDrawer`(展开抽屉) — CSS class toggle 触发 @keyframes
- **state_flow / phase_flow(流程文件)**: 文件命名后缀,让"这是流程编排"语义在文件名显式。`*_flow.ts` 内 export 同名 async function。
- **reconcile(响应式对象→GSAP 桥接器)**: 工具函数,让 GSAP 能 tween Vue ref。GSAP 内部 tween 一个临时数字,onUpdate 时把数字写回响应式对象的属性,Vue 自动重渲染。位置 `app/src/core/utils/reconcile.ts`(动词命名,不用 er 结尾)。
- **composable(组合式函数)**: Vue 风格的纯逻辑复用 hook,用 `use*` 前缀。位置按共享层级分布:`states/shared/composables/` / `states/<state>/composables/` / phase 文件内局部。

### 1.4 三个 state 的具体边界

#### 1.4.1 待机 idle

- **入场**: app 启动 / 用户从解读阶段触发"回首页"
- **职责**: 展示主页 + 等待用户触发占卜
- **退场**: 用户点击牌堆触发占卜 → 转占卜
- **phases**: `['fan']`(扇形循环动画,无限 repeat 直到用户触发)
- **fan phase 已在当前代码存在**:`app/src/animation/phases/fan/builder.ts`,迁移即可

#### 1.4.2 占卜 divination

- **入场**: 从待机由用户点击牌堆触发
- **职责**: 洗牌 → 切牌 → 抽牌 → 揭示
- **退场**: reveal phase 完成 + 解读 API 返回 → 转解读
- **phases**: `['shuffle', 'cut', 'draw', 'reveal']`
- **关键已知 bug**(留 Phase B):
  - draw phase 抽牌结束时 `stage.y` 未复位,卡牌位置错乱
  - reveal phase 当前 grow + flip 串行,需合并为单 `revealCards` task(单 GSAP tween 同时改 rotationY + scale,duration + ease 强制一致)

#### 1.4.3 解读 reading

- **入场**: 从占卜携带 ReadingResult 进入
- **职责**: 入场动画 + 打字机文本 + 等待用户决策
- **退场**: 用户点"再占一次" → state_controller.jumpTo('占卜');用户点"回首页" → state_controller.jumpTo('待机')
- **phases**: `['enter', 'typing']`
- **enter phase**: 单 task `expandDrawer` — 展开抽屉(CSS class toggle 触发 @keyframes 动 padding-bottom + 抽屉 transform);卡牌位置由 `calculateCardPosition()` 响应式函数自动跟随(flex 流式布局 + 占卜视图 padding-bottom 增大)。**舞台位置不变**。抽屉是 absolute 定位,可拖拽到全屏(待 Q-A 细化)。
- **typing phase**: 单 task `typewriteText` — 逐字呈现文本,完成时置 `reading.typingComplete = true`
- **ActionArea 行为**: 监听 `reading.typingComplete` ref → 自显现按钮;onclick → 直接调 state_controller.jumpTo()

### 1.5 task 拆分原则(强制)

1. **每个独立的动作**(单个 GSAP tween / CSS @keyframes / 单个 DOM 操作 / 单个 Promise) = 1 个 task async function
2. **必须强制同步**的多个动作(同 duration + 同 ease + 同时刻完成) → 合并为单 GSAP tween(1 个 task 内改多属性)。例:放大+翻牌合并为 `revealCards`
3. **不需要强制同步**的多个动作(即使对同对象顺序执行) → 各自独立 task。例:`pullUp` 0.18s power2.out → `fall` 0.78s power2.in → `rebound` 0.34s power2.out → `settle` 0.82s power3.out,4 个独立 task
4. **N 个对象的同类动作** → N 个 task 函数实例(由 phase 内 Promise.all 或 for-await 调度)
5. **不同对象 / 不同技术栈** → 必然不同 task

### 1.6 task 命名规范

- **task 函数**:纯动词,描述操作本身。无类型前缀(不加 notify/reset/animate)。
  - 动画类:`liftStage` / `dealCards` / `revealCards` / `expandDrawer` / `fanOut`
  - DOM 操作:`hidePiles` / `showLeftRightVisibility`
  - 通知/信号:用 `signal*`(广播信号语义)。例:`signalCardsLanded` / `signalPhaseComplete`
  - 重置:用动词描述,如 `resetDrawsToEntry` / `initializePiles`
- **phase 函数**:与 phase 名一致动词。例:`shuffle` / `cut` / `draw` / `reveal` / `enter` / `typing` / `fan`
- **state 对象**:名词。例:`idle` / `divination` / `reading`
- **工具函数**:动词,无 er 结尾。例:`reconcile` / `calculateCardPosition`
- **类/对象**:可保留名词。例:`state_controller`

### 1.7 跳转规则(三种)

- **同 phase 内 task 协调**: phase 内部 await / Promise.all,不打扰上层
- **同 state 内 phase 推进**: state.run() 内 for/await,不打扰 state_controller
- **跨 state 跳转**: 必须经 view → state_controller.next() 或 jumpTo()

### 1.8 自驱动流程示例(完整占卜)

1. 用户在待机页点击牌堆 → view 调 `state_controller.next()`
2. state_controller: 当前=待机 → 标准顺序下一个=占卜 → 调 `divination.run(ctx)`
3. divination.run(): 创建 phase_controller 实例 + 调 `phase_controller.run(ctx)`(返回 Promise)
4. phase_controller.run(): 启动第一个 phase = `shuffle(ctx)`(fire-and-forget),返回 Promise 等待
5. shuffle 内部 await/Promise.all 调 task,末尾 `ctx.phase_controller.next(ctx)`
6. phase_controller.next(): currentIndex++,启动 `cut(ctx)`,如此推进到 reveal 完成
7. reveal 末尾 `ctx.phase_controller.next(ctx)`:phase_controller 检测到末尾 → 调 `state_controller.next()` → 解读
8. state_controller 调 `reading.run(ctx)`,类似展开 enter / typing
9. typing 末尾 `ctx.phase_controller.next(ctx)`:reading state 内 phase 跑完 → state_controller.next() 但解读后没有"下一个 state"(单向流到此停留),等待用户操作
10. ActionArea 显示按钮(因 reading.typingComplete = true)
11. 用户点"再占一次" → view 调 `state_controller.jumpTo('占卜')` → 内部 cancel + 重启
12. 用户点"回首页" → view 调 `state_controller.jumpTo('待机')`

### 1.9 dev tool 范围(仅 dev 模式)

- 暂停动画(pause) — 由 GSAP timeline 自带 `pause()` 实现
- 调整动画速度(playbackRate) — 由 GSAP timeline 自带 `timeScale()` 实现
- 跳转流程 — 支持两个粒度:
  - state 级 `state_controller.jumpTo(stateName)`:跳到指定 state(如直接跳到解读)
  - phase 级 `ctx.phase_controller.jumpTo(phaseName, ctx)`:在当前 state 内跳到指定 phase(如占卜内跳到揭示)
  - task 级**不支持**(task 粒度太细,无 controller)
- **运行态有效**, 不在生产构建中可用

### 1.10 lifecycle_log(生命周期日志)

所有 state_controller 的 next / jumpTo / cancel 调用必须经过 `lifecycle_log` 记录:
- 时间戳
- 触发源(用户 onclick / 系统自驱动 / dev tool)
- 旧 state → 新 state
- 携带的上下文摘要

dev 模式输出 console;prod 模式保留为内存环形缓冲。位置 `app/src/core/lifecycle_log.ts`。

### 1.11 反模式禁止

- ❌ view 直接修改 store / 直接 import phase / task 实现
- ❌ phase / task 跨层反向调 state_controller(state_controller.next 仅由 phase_controller 末尾调;phase / task 应通过 phase_controller 间接通知)
- ❌ task 反向调 phase_controller.next(任务粒度不应触发 phase 推进;phase 推进由 phase 函数末尾显式调)
- ❌ task 内 import 全局 store(应通过参数 ctx 接收)
- ❌ 在 task 内执行复合动作(违反单一职责;一个 task = 一个独立动画/DOM 操作)
- ❌ 用 GSAP 直接 tween Vue ref(必须 reconcile 桥接);用 GSAP tween DOM ref(mp-weixin 失败)

### 1.12 平台兼容性约束(mp-weixin)

- task 操作响应式对象时**必须**走 reconcile 工具,不能直接 tween 响应式 ref
- task 操作独立 DOM 时**必须**用 CSS @keyframes 或 CSS transition,不能 GSAP tween DOM ref
- 不同 task 之间的"同步性"靠**同时长 + 同 cubic-bezier 缓动**近似实现
- 任何新 task 必须在 h5 与 mp-weixin 双端验证;若需平台分支用 `// #ifdef H5` / `// #ifdef MP-WEIXIN`

### 1.13 目录结构(最终形态)

```
app/src/
│
├── core/                                    # 框架/底层
│   ├── state_controller.ts                  # 全局 state controller
│   ├── phase_controller.ts                  # phase controller 工厂函数
│   ├── lifecycle_log.ts                     # 跳转日志
│   └── utils/
│       └── reconcile.ts                     # GSAP ↔ Vue ref 桥接工具
│
├── states/                                  # 三个 state 模块
│   ├── shared/                              # 跨 state 共享 (4 类: 组件/逻辑/状态/动作)
│   │   ├── components/                      # 跨 state 组件
│   │   ├── composables/                     # 跨 state composable
│   │   ├── store/                           # 跨 state store
│   │   └── tasks/                           # 跨 state 共享 task (如有)
│   │
│   ├── idle/                                # state 1: 待机
│   │   ├── idle_flow.ts                     # state 流程入口
│   │   ├── components/                      # idle 内跨 view/phase 共享组件 (大概率为空)
│   │   ├── view/
│   │   │   ├── IdleView.vue
│   │   │   └── components/                  # IdleView 专属组件
│   │   ├── composables/                     # idle 专属 composable (可选)
│   │   └── phases/
│   │       ├── shared/
│   │       │   ├── components/              # 跨 idle phase 共享组件 (当前 1 phase, 通常空)
│   │       │   └── tasks/                   # 跨 idle phase 共享 task
│   │       └── fan/                         # phase 升级为目录
│   │           ├── fan_flow.ts              # phase 函数
│   │           └── components/              # fan phase 专属组件 (可选)
│   │
│   ├── divination/                          # state 2: 占卜
│   │   ├── divination_flow.ts               # state 流程
│   │   ├── components/                      # divination 内跨 view/phase 共享 (Deck / DeckFanStack 等)
│   │   ├── view/
│   │   │   ├── DivinationView.vue
│   │   │   └── components/                  # DivinationView 专属 (ProgressContent / TitleContent)
│   │   ├── composables/
│   │   └── phases/
│   │       ├── shared/
│   │       │   ├── components/              # 跨 4 phase 共享组件
│   │       │   └── tasks/                   # 跨 4 phase 共享 task
│   │       ├── shuffle/                     # phase 升级为目录
│   │       │   ├── shuffle_flow.ts
│   │       │   └── components/              # shuffle phase 专属
│   │       ├── cut/
│   │       │   ├── cut_flow.ts
│   │       │   └── components/
│   │       ├── draw/
│   │       │   ├── draw_flow.ts
│   │       │   └── components/
│   │       └── reveal/
│   │           ├── reveal_flow.ts
│   │           └── components/
│   │
│   └── reading/                             # state 3: 解读
│       ├── reading_flow.ts                  # state 流程
│       ├── components/                      # reading 内跨 view 共享 (ReadingPanel / ActionArea)
│       ├── view/
│       │   ├── ReadingDrawerView.vue        # 窄屏抽屉
│       │   ├── ReadingSplitView.vue         # 宽屏分栏
│       │   └── components/                  # split / drawer view 专属
│       ├── services/                        # ⚠ 唯一例外: reading 涉及 API
│       ├── composables/
│       └── phases/
│           ├── shared/
│           │   ├── components/
│           │   └── tasks/
│           ├── enter/
│           │   ├── enter_flow.ts            # phase 流程: expandDrawer task
│           │   └── components/              # enter 专属 (大概率空, 入场是 CSS class toggle)
│           └── typing/
│               ├── typing_flow.ts           # phase 流程: typewriteText task
│               └── components/              # typing 专属: ReadingTextContainer
│
├── pages/                                   # uni-app 路由 (不可改名)
│   ├── main/                                # 主路由 → state_controller 接管
│   └── fallback/                            # fallback 路由 (待 Q-G 决策)
│
└── tools/                                   # 工具
```

### 1.14 组件迁移映射表

> 当前代码 `app/src/components/` 与 `app/src/views/` 内每个组件迁到新位置的精确映射。Phase A 的组件迁移任务直接按本表执行,无需再判断"放哪一层"。

#### 1.14.1 跨 state 组件 → `states/shared/components/`

判断标准:被两个或以上 state 引用,且无 state 专属语义。

| 当前路径 | 新路径 |
|---|---|
| `app/src/components/containers/NotificationHost.vue` | `states/shared/components/NotificationHost.vue` |
| `app/src/components/containers/Stage.vue` | `states/shared/components/Stage.vue` |
| `app/src/components/containers/HeaderArea.vue` | `states/shared/components/HeaderArea.vue` |

#### 1.14.2 idle state 内组件

idle 当前几乎无专属组件;`Deck.vue` 同时被 idle 与 divination 用,见 §1.14.3 决策。

| 当前路径 | 新路径 |
|---|---|
| `app/src/views/PlayView.vue` 的 idle 部分 | 拆为 `states/idle/view/IdleView.vue` |

#### 1.14.3 divination state 内组件

| 当前路径 | 新路径 | 备注 |
|---|---|---|
| `app/src/views/PlayView.vue` 的 divination 部分 | 拆为 `states/divination/view/DivinationView.vue` | A4.1 拆分 |
| `app/src/components/containers/TitleContent.vue` | `states/divination/view/components/TitleContent.vue` | DivinationView 头部专属 |
| `app/src/components/containers/ProgressContent.vue` | `states/divination/view/components/ProgressContent.vue` | DivinationView 头部专属 |
| `app/src/components/stage-content/Deck.vue` | `states/divination/components/Deck.vue` | divination 主牌堆;idle 引用同一份 (跨 state 用,但语义偏 divination) |
| `app/src/components/stage-content/DeckFanStack.vue` | `states/divination/components/DeckFanStack.vue` | 同上 |
| `app/src/components/stage-content/*.vue`(其余卡牌渲染组件) | `states/divination/components/`(逐个映射) | 待 A5.x 任务展开时逐一确认 |

**Deck 跨 state 决策**:`Deck.vue` 在 idle 显示 fan-loop,在 divination 显示完整洗切抽揭。两种用法共用同一组件 + injected `appPhase` 切换。新架构下保留 `states/divination/components/Deck.vue` 单文件,idle 通过 `states/shared/components/` 反向引用 — **但这违反"states 自治"原则**。**最终决策待 A5.x 实施时确认**:
- 选项 a:Deck 上提到 `states/shared/components/Deck.vue`(按使用范围)
- 选项 b:Deck 拆为 `IdleDeck` + `DivinationDeck` 两个组件,共享底层卡牌渲染 atom 组件放 `states/shared/components/`
- 选项 c:保留单 Deck,放 `states/divination/components/`,idle 跨 state 引用作为已知妥协

#### 1.14.4 reading state 内组件

| 当前路径 | 新路径 | 备注 |
|---|---|---|
| `app/src/views/ReadingDrawerView.vue` | `states/reading/view/ReadingDrawerView.vue` | 窄屏抽屉 |
| `app/src/views/ReadingSplitView.vue` | `states/reading/view/ReadingSplitView.vue` | 宽屏分栏 |
| `app/src/components/containers/ReadingPanel.vue` | `states/reading/components/ReadingPanel.vue` | 跨 split + drawer 共享 |
| `app/src/components/containers/ActionArea.vue` | `states/reading/components/ActionArea.vue` | 跨 split + drawer 共享 |
| `app/src/components/containers/ReadingTextContainer.vue` | `states/reading/phases/typing/components/ReadingTextContainer.vue` | 仅 typing phase 渲染打字机 |

#### 1.14.5 fallback 路由组件

| 当前路径 | 新路径 | 备注 |
|---|---|---|
| `app/src/views/FallbackView.vue` | 留 `pages/fallback/` 内 (Q-G 决策) | 不归 state_controller 管 |
| `app/src/animation/phases/fallback/builder.ts` 的 `orbitPlanets` 动画 | 同上 | fallback 路由专属 |

#### 1.14.6 dev tool 组件

| 当前路径 | 新路径 |
|---|---|
| `app/src/components/overlay/DevToolsPanel.vue` | `states/shared/components/DevToolsPanel.vue` (跨 state, dev only) |

---

## 第二章 · 计划

> 本章只写"具体怎么改代码",不写架构。所有改动以第一章为准。  
> Phase A 完整展开为可执行原子任务;Phase B / D / C 简短备忘。

### 2.0 总体阶段顺序

按 **Phase A → Phase B → Phase D → Phase C** 推进。前一阶段 100% 完成才启动后一阶段。

- **Phase A 架构(h5 only)**: 自下而上(task → phase → state → view → cleanup)迁移现有代码到第一章架构,**保留所有现有视觉**,不修 bug
- **Phase B Bug 修复(h5 only)**: 修 PRD 已知 bug
- **Phase D 文档收口**: 拆 PRD 与 README 到 docs
- **Phase C 小程序验证 + 修复**: mp-weixin 整体回归

### 2.1 Phase A — 架构迁移(h5 only,保留视觉)

> 自下而上推进:**task 层 → phase 层 → state 层 → view 层 → 清理 → 验收**。每个原子任务在"必读架构"行显式列出引用的第一章章节。

#### A1. task 层

把所有 phase builder 内部的 GSAP timeline 段落拆解为独立 task async function。

##### A1.1.A 迁移 reconcile 到 `core/utils/reconcile.ts`

- **目标**: 把 `app/src/animation/reconciler.ts` 改名 + 迁到 `core/utils/reconcile.ts`(动词命名);**立即删旧文件**
- **必读架构**: [§1.3 术语表](#13-术语表中英对照)(reconcile 定义) · [§1.12 平台兼容性约束](#112-平台兼容性约束mp-weixin)
- **必读规则**: [R1](#r1-调研先行) · [R2](#r2-任务自包含) · [R3](#r3-commit-规范) · [R4](#r4-frontend-类型检查) · [R5](#r5-单元测试调用) · [R6](#r6-质量门禁) · [R7](#r7-agent-分工) · [R8](#r8-清理) · [R9 re-export 零兼容期](#r9-re-export-零兼容期)
- **当前代码现状**: `app/src/animation/reconciler.ts` 已存在
- **执行步骤**:
  1. 新建 `app/src/core/utils/reconcile.ts`,内容从旧文件搬迁;同时把内部 export 重命名为动词(若原是 `Reconciler` 类改为 `reconcile()` 函数,或保持 class 但加默认 export 函数)
  2. `rg "animation/reconciler" app/src app/test/` 找全部引用
  3. 逐文件改 import
  4. 删旧 `app/src/animation/reconciler.ts`
- **agent 分工**: executor `Frontend Developer`;并行审计 `Code Reviewer` + `Minimal Change Engineer`
- **自动验收**: `node scripts/quality_gate.js full` + `npx vitest run --config app/vitest.config.ts --dir app/test`
- **人工验收**: `rg "animation/reconciler" app/src app/test/` 无匹配
- **commit**: `refactor: move reconciler to core/utils/reconcile`

##### A1.2.A 拆 shuffle phase 内部 task

- **目标**: 把 `app/src/animation/phases/shuffle/builder.ts` 内部 GSAP timeline 段落拆为独立 task async function;**立即删旧 builder.ts**
- **必读架构**: [§1.2 三类抽象](#12-三类抽象) · [§1.5 task 拆分原则](#15-task-拆分原则强制) · [§1.6 task 命名规范](#16-task-命名规范) · [§1.12 平台兼容性约束](#112-平台兼容性约束mp-weixin)
- **必读规则**: [R1](#r1-调研先行) · [R2](#r2-任务自包含) · [R3](#r3-commit-规范) · [R4](#r4-frontend-类型检查) · [R5](#r5-单元测试调用) · [R6](#r6-质量门禁) · [R7](#r7-agent-分工) · [R8](#r8-清理) · [R9 re-export 零兼容期](#r9-re-export-零兼容期) · [R10 task 实现技术栈选择](#r10-task-实现技术栈选择) · [R11 reduced-motion 分支](#r11-reduced-motion-分支)
- **当前代码现状**: `shuffle/builder.ts` 内含 6 段 GSAP timeline 逻辑(见调研报告)
- **task 清单**(本任务产出):
  - `hideInitialDeck(ctx)` — 隐藏初始牌堆(瞬时 set opacity = 0)
  - `revealLeftStacks(ctx)` — 左叠扇形发散(单 GSAP tween)
  - `revealRightStacks(ctx)` — 右叠扇形发散(单 GSAP tween,与上一并行)
  - `showLeftRightVisibility(ctx)` — 显示左右叠 DOM(Vue ref 切换)
  - `collectLeftStacks(ctx)` — 左叠收拢(单 GSAP tween with stagger)
  - `collectRightStacks(ctx)` — 右叠收拢(单 GSAP tween with stagger,与上一并行)
  - `hideLeftRightVisibility(ctx)` — 隐藏左右叠 DOM
  - `revealInitialDeckBounce(ctx)` — 初始叠回弹(set + tween 合并为单 task)
- **执行步骤**:
  1. 在 `states/divination/phases/shared/tasks/` 下为每个 task 建文件(或在 shuffle_flow.ts 内局部 — 跨 phase 复用的放 shared,仅 shuffle 用的放局部)
  2. 每个 task 实现为 async function,内部用 reconcile 工具桥接 GSAP
  3. **此任务不创建 shuffle_flow.ts**(留 A2.1.A);先把 task 函数都准备好
  4. 删 `app/src/animation/phases/shuffle/builder.ts`
  5. `rg "animation/phases/shuffle" app/src app/test/` 改所有 import
- **agent 分工**: executor `Frontend Developer`;并行审计 `Code Reviewer` + `Minimal Change Engineer`
- **自动验收**: `npx vitest run --config app/vitest.config.ts --dir app/test -t shuffle` + `node scripts/quality_gate.js full`
- **人工验收**: 旧 shuffle phase 视觉行为完全保留(暂时仍由旧 pipeline 调用,因为 shuffle_flow.ts 还没建)
- **commit**: `refactor: extract shuffle phase tasks`

##### A1.3.A 拆 cut phase 内部 task

- **目标**: 同 A1.2.A 但针对 cut(切牌);**立即删旧 builder.ts**
- **必读架构**: [§1.2 三类抽象](#12-三类抽象) · [§1.5 task 拆分原则](#15-task-拆分原则强制) · [§1.6 task 命名规范](#16-task-命名规范) · [§1.12 平台兼容性约束](#112-平台兼容性约束mp-weixin)
- **必读规则**: 同 A1.2.A
- **task 清单**:
  - `initializePiles(ctx)` — 初始化分牌堆(瞬时 reset)
  - `spreadPiles(ctx)` — 分牌堆展开(单 GSAP tween)
  - `separatePileFirst(ctx)` — 首端 pile 分离(单 GSAP tween,可选,N>=2 时执行)
  - `separatePileLast(ctx)` — 尾端 pile 分离(单 GSAP tween,与上一并行)
  - `realignPiles(ctx)` — 重新对齐(单 GSAP tween)
  - `hidePiles(ctx)` — 隐藏分牌堆(Vue ref 切换)
- **执行步骤**: 同 A1.2.A 模板
- **commit**: `refactor: extract cut phase tasks`

##### A1.4.A 拆 draw phase 内部 task

- **目标**: 同 A1.2.A 但针对 draw(抽牌);**立即删旧 builder.ts**;本任务**不修复 stage.y 复位 bug**(留 B1.1.A)
- **必读架构**: [§1.2 三类抽象](#12-三类抽象) · [§1.4.2 占卜 divination](#142-占卜-divination)(含 bug 描述) · [§1.5 task 拆分原则](#15-task-拆分原则强制) · [§1.6 task 命名规范](#16-task-命名规范) · [§1.12 平台兼容性约束](#112-平台兼容性约束mp-weixin)
- **必读规则**: 同 A1.2.A
- **task 清单**(8 个,dealCardsSequence 拆为 4 平级):
  - `liftStage(ctx)` — 舞台上升初段
  - `liftStageCompletion(ctx)` — 舞台上升完成段
  - `exitDeck(ctx)` — 牌堆渐隐散落
  - `pullUp(ctx, cardIndex)` — 单张卡拉起
  - `fall(ctx, cardIndex)` — 单张卡下落
  - `rebound(ctx, cardIndex)` — 单张卡反弹
  - `settle(ctx, cardIndex)` — 单张卡沉降
  - `alignCards(ctx)` — 对齐所有卡
- **执行步骤**: 同 A1.2.A 模板;phase 编排 `for (i of cardCount) { await pullUp(ctx,i); await fall(ctx,i); await rebound(ctx,i); await settle(ctx,i); }`(本步骤不创建 phase 文件,留 A2.3.A)
- **commit**: `refactor: extract draw phase tasks`

##### A1.5.A 拆 reveal phase 内部 task

- **目标**: 同 A1.2.A 但针对 reveal(揭示);**立即删旧 builder.ts + atoms/grow.ts + atoms/flip.ts**;本任务**不合并 grow + flip**(留 B2.1.A,本任务先保留两个 task)
- **必读架构**: [§1.2 三类抽象](#12-三类抽象) · [§1.4.2 占卜 divination](#142-占卜-divination)(含 bug 描述) · [§1.5 task 拆分原则](#15-task-拆分原则强制) · [§1.12 平台兼容性约束](#112-平台兼容性约束mp-weixin)
- **必读规则**: 同 A1.2.A
- **task 清单**:
  - `resetDrawsToEntry(ctx)` — 重置卡牌到 phase 入场态(瞬时)
  - `growCards(ctx)` — 卡牌放大(单 GSAP tween,B2 阶段会与 flipCards 合并为 revealCards)
  - `flipCards(ctx)` — 卡牌翻转(单 GSAP tween,B2 阶段会被合并)
- **执行步骤**: 同 A1.2.A 模板
- **commit**: `refactor: extract reveal phase tasks`

##### A1.6.A 拆 fan phase(idle 待机循环) 内部 task

- **目标**: 同 A1.2.A 但针对 fan(扇形循环);**立即删旧 builder.ts**
- **必读架构**: [§1.2 三类抽象](#12-三类抽象) · [§1.4.1 待机 idle](#141-待机-idle) · [§1.5 task 拆分原则](#15-task-拆分原则强制)
- **必读规则**: 同 A1.2.A
- **task 清单**(4 个,无限 repeat 由 phase 编排实现):
  - `fanOut(ctx)` — 牌张扇形展开(单 GSAP tween)
  - `holdFan(ctx)` — 暂停在展开态(空 await Promise + setTimeout)
  - `collectFan(ctx)` — 牌张收拢(单 GSAP tween)
  - `holdCollected(ctx)` — 暂停在堆叠态(空 await + setTimeout)
- **执行步骤**: 同 A1.2.A 模板
- **commit**: `refactor: extract fan phase tasks`

##### A1.7.A 拆 reading enter phase 内部 task

- **目标**: 把 `app/src/composables/use_result_card_shrink.ts` + reading view 内 CSS @keyframes 改造为 reading enter phase 的单 task `expandDrawer`;**立即删 use_result_card_shrink.ts**
- **必读架构**: [§1.2 三类抽象](#12-三类抽象) · [§1.4.3 解读 reading](#143-解读-reading) · [§1.5 task 拆分原则](#15-task-拆分原则强制) · [§1.12 平台兼容性约束](#112-平台兼容性约束mp-weixin)
- **必读规则**: 同 A1.2.A
- **task 清单**(1 个 task + 1 个响应式函数):
  - `expandDrawer(ctx)` — 展开抽屉(CSS class toggle 触发占卜视图 padding-bottom + 抽屉 transform 同步)
  - `calculateCardPosition(ctx)` — Vue computed 函数(不是 task),返回卡牌位置;reading 模式由 flex 流式布局自动驱动卡牌位移,该函数提供位置计算给布局求解器
- **依赖**: 第三章 Q-A 完整闭环(抽屉拖拉全屏 / calculateCardPosition 输入参数)— **本任务待 Q-A 闭环后再启动**,可先列出占位
- **执行步骤**: 同 A1.2.A 模板;但需要**改 reading view CSS 与模板**(原抽屉 absolute 定位仍保留;占卜视图根加 padding-bottom 动画;flex 布局让卡牌随 padding 上移)
- **commit**: `refactor: implement reading enter expand drawer task`

##### A1.8.A 拆 reading typing phase 内部 task

- **目标**: 把 `app/src/components/containers/ReadingTextContainer.vue` 内打字机逻辑改造为 typing phase 的单 task `typewriteText`
- **必读架构**: [§1.2 三类抽象](#12-三类抽象) · [§1.4.3 解读 reading](#143-解读-reading) · [§1.5 task 拆分原则](#15-task-拆分原则强制)
- **必读规则**: 同 A1.2.A
- **task 清单**:
  - `typewriteText(ctx)` — 逐字呈现文本(Vue reactivity + setTimeout / setInterval),完成时置 `reading.typingComplete = true`
- **执行步骤**: 把 ReadingTextContainer 内的计时器逻辑迁出到 typewriteText task;ReadingTextContainer 改为只渲染当前进度
- **commit**: `refactor: extract reading typing task`

#### A2. phase 层

每个 phase 是一个 async function,内部 await/Promise.all 调 task。

##### A2.1.A 创建 `shuffle/shuffle_flow.ts`

- **目标**: 新建 `states/divination/phases/shuffle/shuffle_flow.ts`(**phase 升级为目录**,见 [§1.13 目录结构](#113-目录结构最终形态)),export `async function shuffle(ctx)`,内部 await 调用 A1.2 拆出的 task;**phase 末尾必须调 `ctx.phase_controller.next(ctx)` 触发下一 phase**
- **必读架构**: [§1.2 四类抽象](#12-四类抽象)(phase 部分) · [§1.7 跳转规则](#17-跳转规则三种) · [§1.8 自驱动流程示例](#18-自驱动流程示例完整占卜) · [§1.13 目录结构](#113-目录结构最终形态)(phase 目录化)
- **必读规则**: [R1](#r1-调研先行) · [R2](#r2-任务自包含) · [R3](#r3-commit-规范) · [R4](#r4-frontend-类型检查) · [R5](#r5-单元测试调用) · [R6](#r6-质量门禁) · [R7](#r7-agent-分工) · [R8](#r8-清理)
- **执行步骤**:
  1. 新建目录 `states/divination/phases/shuffle/` + 内含 `shuffle_flow.ts` + 空 `components/`(留作 phase 专属组件位置, 当前可能为空)
  2. 在 `shuffle_flow.ts` 内 `export async function shuffle(ctx) { await hideInitialDeck(ctx); await Promise.all([revealLeftStacks(ctx), revealRightStacks(ctx)]); ...; ctx.phase_controller.next(ctx); }`
  3. 旧 pipeline(`app/src/animation/pipeline.ts` `app/src/composables/commands/*.ts`)的 shuffle 入口改调新 phase function
- **commit**: `feat: add shuffle phase flow`

##### A2.2.A 创建 `cut/cut_flow.ts` / A2.3.A `draw/draw_flow.ts` / A2.4.A `reveal/reveal_flow.ts` / A2.5.A `fan/fan_flow.ts` / A2.6.A `enter/enter_flow.ts` / A2.7.A `typing/typing_flow.ts`

- **同模板** A2.1.A,每个 phase 一个原子任务,**每个 phase 都是目录**(含 `<phase>_flow.ts` + `components/`)

#### A3. state 层

state 对象 + state_controller。

##### A3.1.A 新增 `core/state_controller.ts`

- **目标**: state_controller 全局单例 + 单元测试
- **必读架构**: [§1.2 三类抽象](#12-三类抽象)(state_controller 部分) · [§1.7 跳转规则](#17-跳转规则三种) · [§1.10 lifecycle_log](#110-lifecycle_log生命周期日志) · [§1.11 反模式禁止](#111-反模式禁止)
- **必读规则**: [R1](#r1-调研先行) · [R2](#r2-任务自包含) · [R3](#r3-commit-规范) · [R4](#r4-frontend-类型检查) · [R5](#r5-单元测试调用) · [R6](#r6-质量门禁) · [R7](#r7-agent-分工) · [R8](#r8-清理)
- **执行步骤**:
  1. 新建 `app/src/core/state_controller.ts`
  2. 实现 current ref / next() / jumpTo() / cancel() / run()
  3. cancel 实现细节待 Q-B 闭环;先用最简实现(GSAP killTweensOf 全局 + AbortController)
  4. 新建 `app/test/state_controller.test.ts`
- **commit**: `feat: add state_controller`

##### A3.1b.A 新增 `core/phase_controller.ts`

- **目标**: phase_controller 工厂函数 + 单元测试
- **必读架构**: [§1.2 四类抽象](#12-四类抽象)(phase_controller 部分) · [§1.7 跳转规则](#17-跳转规则三种) · [§1.8 自驱动流程示例](#18-自驱动流程示例完整占卜)
- **必读规则**: [R1](#r1-调研先行) · [R2](#r2-任务自包含) · [R3](#r3-commit-规范) · [R4](#r4-frontend-类型检查) · [R5](#r5-单元测试调用) · [R6](#r6-质量门禁) · [R7](#r7-agent-分工) · [R8](#r8-清理)
- **执行步骤**:
  1. 新建 `app/src/core/phase_controller.ts`,实现工厂 `createPhaseController(phases)` 返回 PhaseController 实例
  2. 实现接口: `currentPhase` ref / `next(ctx)` / `jumpTo(phaseName, ctx)` / `cancel()` / `run(ctx)`
  3. `run(ctx)` 返回 Promise:启动第一个 phase(fire-and-forget),Promise 在最后 phase 调 next 时 resolve
  4. `next(ctx)`:currentIndex++,启动下一 phase;若末尾则 resolve run 的 Promise + 调 `state_controller.next()` 通知上层
  5. `jumpTo(phaseName, ctx)`:cancel 当前 phase + 跳到指定 phase 启动
  6. `cancel()`:中断当前 phase 全部 task(具体实现细节待 Q-B 闭环)
  7. 新建 `app/test/phase_controller.test.ts`,覆盖 next 推进 / jumpTo / cancel / Promise resolve 时机
- **agent 分工**: executor `Software Architect`;并行审计 `Code Reviewer` + `Minimal Change Engineer`
- **自动验收**: `npx vitest run --config app/vitest.config.ts --dir app/test -t phase_controller` 全绿
- **人工验收**: phase_controller.ts 不直接 import 任何具体 state / phase
- **commit**: `feat: add phase_controller`

##### A3.2.A 新增 `core/lifecycle_log.ts`

- **目标**: lifecycle_log 实现 + 单元测试
- **必读架构**: [§1.10 lifecycle_log](#110-lifecycle_log生命周期日志)
- **必读规则**: 同 A3.1.A
- **执行步骤**: 实现 dev console + prod 环形缓冲
- **commit**: `feat: add lifecycle_log`

##### A3.3.A 新增 `states/idle/idle_flow.ts`

- **目标**: idle state 对象,phases = [fan],run hook 创建 phase_controller
- **必读架构**: [§1.2 四类抽象](#12-四类抽象)(state 对象部分) · [§1.4.1 待机 idle](#141-待机-idle) · [§1.8 自驱动流程示例](#18-自驱动流程示例完整占卜)
- **必读规则**: 同 A3.1.A
- **执行步骤**:
  1. 新建 `idle_flow.ts`,export `idle = { phases: [fan], run(ctx) { ctx.phase_controller = createPhaseController([fan]); return ctx.phase_controller.run(ctx); } }`
  2. 在 state_controller 注册
- **commit**: `feat: add idle state`

##### A3.4.A 新增 `states/divination/divination_flow.ts`

- **目标**: divination state 对象,run hook 创建 phase_controller
- **必读架构**: [§1.2 四类抽象](#12-四类抽象) · [§1.4.2 占卜 divination](#142-占卜-divination) · [§1.8 自驱动流程示例](#18-自驱动流程示例完整占卜)
- **必读规则**: 同 A3.1.A
- **执行步骤**: 新建 `divination_flow.ts`,phases = [shuffle, cut, draw, reveal],run hook `ctx.phase_controller = createPhaseController([shuffle, cut, draw, reveal]); return ctx.phase_controller.run(ctx);`
- **commit**: `feat: add divination state`

##### A3.5.A 新增 `states/reading/reading_flow.ts`

- **目标**: reading state 对象 + typingComplete ref + run hook 创建 phase_controller
- **必读架构**: [§1.2 四类抽象](#12-四类抽象) · [§1.4.3 解读 reading](#143-解读-reading) · [§1.8 自驱动流程示例](#18-自驱动流程示例完整占卜)
- **必读规则**: 同 A3.1.A
- **执行步骤**: 新建 `reading_flow.ts`,phases = [enter, typing],含 typingComplete ref,run hook 创建 phase_controller
- **commit**: `feat: add reading state`

##### A3.6.A 删 `app/src/stores/flow.ts` 与 `stores/reading.ts`

- **目标**: 旧 flow store 与 reading store 职责由 state_controller 与 reading state 接管
- **必读架构**: [§1.4.3 解读 reading](#143-解读-reading) · [§1.7 跳转规则](#17-跳转规则三种) · [§1.11 反模式禁止](#111-反模式禁止)
- **必读规则**: 含 [R9 re-export 零兼容期](#r9-re-export-零兼容期)
- **前置**: A4 view 改造已完成
- **commit**: `refactor: remove obsolete flow and reading stores`

#### A4. view 层

view 改为直接调 state_controller。

##### A4.1.A 拆 PlayView 为 IdleView + DivinationView

- **目标**: 把 `app/src/views/PlayView.vue` 拆为 `states/idle/view/IdleView.vue` + `states/divination/view/DivinationView.vue`;**立即删旧 PlayView**
- **必读架构**: [§1.4.1 待机 idle](#141-待机-idle) · [§1.4.2 占卜 divination](#142-占卜-divination) · [§1.13 目录结构](#113-目录结构最终形态)
- **必读规则**: 含 [R9 re-export 零兼容期](#r9-re-export-零兼容期)
- **执行步骤**:
  1. 提取 idle 部分到 IdleView.vue;onclick 调 `state_controller.next()`
  2. 提取 divination 部分到 DivinationView.vue
  3. 改 `pages/main/index.vue` 由 `state_controller.current` 决定挂载哪个 view
  4. 删 PlayView.vue
- **commit**: `refactor: split PlayView into IdleView and DivinationView`

##### A4.2.A 迁移 ReadingSplitView / A4.3.A ReadingDrawerView

- **目标**: 同 A4.1.A 模板,把两 view 迁到 `states/reading/view/`;**立即删旧文件**
- **必读架构**: [§1.4.3 解读 reading](#143-解读-reading) · [§1.13 目录结构](#113-目录结构最终形态)
- **commit**: `refactor: move reading views into reading state`

##### A4.4.A 瘦身 main page

- **目标**: 删除 page 层业务跳转,page 只 mount state view + provide ctx
- **必读架构**: [§1.7 跳转规则](#17-跳转规则三种) · [§1.11 反模式禁止](#111-反模式禁止)
- **必读规则**: 含 [R9 re-export 零兼容期](#r9-re-export-零兼容期)
- **执行步骤**:
  1. 把所有业务 handler 改为直接调 `state_controller.next/jumpTo`
  2. view 内部按钮 onclick 也改为直接调 state_controller
  3. 删 `app/src/composables/use_app_phase.ts` `use_main_handlers.ts` `use_animation_controller.ts` `use_reading_controller.ts`(它们的逻辑被 state_controller / state_flow / phase_flow / task 接管)
- **commit**: `refactor: collapse main page into state view shell`

#### A5. shared / components / store / composables 层迁移

> 严格按 [§1.14 组件迁移映射表](#114-组件迁移映射表) 执行。每个原子任务对应映射表的一行或一组同层级组件。

##### A5.1.A 迁移跨 state 组件 → `states/shared/components/`

- **目标**: 把 NotificationHost / Stage / HeaderArea 迁到 `states/shared/components/`;**立即删旧文件**
- **必读架构**: [§1.14.1 跨 state 组件](#1141-跨-state-组件--statessharedcomponents)
- **必读规则**: [R1](#r1-调研先行) · [R2](#r2-任务自包含) · [R3](#r3-commit-规范) · [R4](#r4-frontend-类型检查) · [R5](#r5-单元测试调用) · [R6](#r6-质量门禁) · [R7](#r7-agent-分工) · [R8](#r8-清理) · [R9 re-export 零兼容期](#r9-re-export-零兼容期)
- **当前代码现状**: `app/src/components/containers/{NotificationHost,Stage,HeaderArea}.vue`
- **执行步骤**:
  1. 复制三 vue 文件到 `states/shared/components/`
  2. `rg "components/containers/(NotificationHost|Stage|HeaderArea)" app/src app/test/` 找全部引用
  3. 逐文件改 import 路径
  4. 删旧三 vue 文件
- **agent 分工**: executor `Frontend Developer`;并行审计 `Code Reviewer` + `Minimal Change Engineer`
- **自动验收**: `node scripts/quality_gate.js full` + 组件测试
- **人工验收**: 全局通知仍显示;舞台 / 头部行为一致
- **commit**: `refactor: move cross-state components into states/shared`
- **清理**: 旧三 vue 已删

##### A5.2.A 迁移 DivinationView 头部专属组件 → `states/divination/view/components/`

- **目标**: 把 TitleContent / ProgressContent 迁到 DivinationView 专属目录;**立即删旧文件**
- **必读架构**: [§1.14.3 divination state 内组件](#1143-divination-state-内组件)
- **必读规则**: 同 A5.1.A
- **当前代码现状**: `app/src/components/containers/{TitleContent,ProgressContent}.vue`
- **执行步骤**: 同 A5.1.A 模板,目标 `states/divination/view/components/`
- **commit**: `refactor: move divination header components into divination view`

##### A5.3.A 迁移 divination 主牌堆组件 → `states/divination/components/`

- **目标**: 把 Deck / DeckFanStack 等核心牌堆渲染组件迁到 divination 内 components;**立即删旧文件**
- **必读架构**: [§1.14.3 divination state 内组件](#1143-divination-state-内组件)(含 Deck 跨 state 决策)
- **必读规则**: 同 A5.1.A
- **当前代码现状**: `app/src/components/stage-content/Deck.vue` `DeckFanStack.vue` 及其余卡牌渲染组件(逐个枚举)
- **执行步骤**:
  1. **先决策 Deck 跨 state 归属**:打开 §1.14.3 的"Deck 跨 state 决策"看 a/b/c 三选项,基于当前代码与 idle 引用复杂度选择(默认选 c — 单 Deck 放 divination,idle 跨 state 引用作为已知妥协,改动最小)
  2. 按决策执行迁移:目标 `states/divination/components/` 或拆 `IdleDeck` + `DivinationDeck`
  3. `rg "components/stage-content/" app/src app/test/` 找全部引用,逐文件改 import
  4. 删旧 stage-content 目录
- **agent 分工**: executor `Frontend Developer`;并行审计 `Software Architect` + `UX Architect`
- **自动验收**: `node scripts/quality_gate.js full` + idle 与 divination 视觉测试
- **人工验收**: idle 扇形循环正常 + divination 全 phase 视觉无回归
- **commit**: `refactor: move deck components into divination state`

##### A5.4.A 迁移 reading 跨 view 共享组件 → `states/reading/components/`

- **目标**: 把 ReadingPanel / ActionArea 迁到 reading 内 components(被 ReadingDrawerView + ReadingSplitView 共用);**立即删旧文件**
- **必读架构**: [§1.14.4 reading state 内组件](#1144-reading-state-内组件)
- **必读规则**: 同 A5.1.A
- **当前代码现状**: `app/src/components/containers/{ReadingPanel,ActionArea}.vue`
- **执行步骤**: 同 A5.1.A 模板,目标 `states/reading/components/`
- **commit**: `refactor: move reading shared components into reading state`

##### A5.5.A 迁移 typing phase 专属组件 → `states/reading/phases/typing/components/`

- **目标**: 把 ReadingTextContainer 迁到 typing phase 子目录;**立即删旧文件**
- **必读架构**: [§1.14.4 reading state 内组件](#1144-reading-state-内组件)
- **必读规则**: 同 A5.1.A
- **当前代码现状**: `app/src/components/containers/ReadingTextContainer.vue`
- **执行步骤**: 同 A5.1.A 模板,目标 `states/reading/phases/typing/components/`(注意:此任务依赖 typing phase 目录化已完成,即 A2.7.A 已建立 `phases/typing/typing_flow.ts`)
- **commit**: `refactor: move typewriter component into typing phase`

##### A5.6.A 迁移 DevToolsPanel → `states/shared/components/`

- **目标**: 把 DevToolsPanel 迁到 shared(dev only,跨 state 显示);**立即删旧文件**
- **必读架构**: [§1.14.6 dev tool 组件](#1146-dev-tool-组件)
- **必读规则**: 同 A5.1.A
- **当前代码现状**: `app/src/components/overlay/DevToolsPanel.vue`
- **执行步骤**: 同 A5.1.A 模板,目标 `states/shared/components/`;同步删 `app/src/components/overlay/` 若变空
- **commit**: `refactor: move DevToolsPanel into states/shared`

##### A5.7.A 迁移全局 store → `states/shared/store/`

- **目标**: 把 `notification/theme/tarot/deck` 四 store 迁入 shared;**立即删旧文件**
- **必读架构**: [§1.13 目录结构](#113-目录结构最终形态)
- **必读规则**: 同 A5.1.A
- **当前代码现状**: `app/src/stores/{notification,theme,tarot,deck}.ts`(`flow.ts` 与 `reading.ts` 留 A3.6.A 删除)
- **执行步骤**:
  1. 复制四 store 到 `states/shared/store/`
  2. `rg "stores/(notification|theme|tarot|deck)" app/src app/test/` 找引用,改 import
  3. 删旧四文件
- **agent 分工**: executor `Software Architect`;并行审计 `Code Reviewer` + `Reality Checker`
- **commit**: `refactor: move shared stores into states/shared`

##### A5.8.A 迁移 composables → 分层位置

- **目标**: 跨 state composable 迁到 `states/shared/composables/`;state 专属 composable 迁到 `states/<state>/composables/`
- **必读架构**: [§1.3 术语表](#13-术语表中英对照)(composable 定义) · [§1.13 目录结构](#113-目录结构最终形态)
- **必读规则**: 同 A5.1.A
- **当前代码现状**: `app/src/composables/` 下众多 `use_*.ts` 文件
- **执行步骤**:
  1. 逐个判断 composable 的归属:
     - 跨 state 用(如 `use_overlay_layout` `use_css_var_bridge` `use_dev_tools`)→ `states/shared/composables/`
     - state 专属(如 `use_play_deck_animation` 仅 idle 用)→ `states/<state>/composables/`
     - **被新架构替代的旧 controller composable**(`use_animation_controller` `use_reading_controller` `use_app_phase` `use_main_handlers` `use_lifecycle` `use_active_view` `use_result_card_shrink` `use_play_deck_animation`)→ **删除**(职责由 state_controller / phase_controller / state_flow / phase_flow / task 接管)
  2. 复制保留的 composable 到对应位置
  3. `rg` 改所有 import
  4. 删除所有应删除的 composable 与已迁移的旧文件
- **agent 分工**: executor `Frontend Developer`;并行审计 `Software Architect` + `Code Reviewer`
- **commit**: `refactor: relocate composables to layered locations`

#### A6. 旧代码彻底清理

##### A6.1.A 删除所有旧 animation/ pipeline/ commands/ 文件

- **目标**: A1-A5 完成后,旧 `app/src/animation/` `app/src/composables/commands/` `app/src/animation/pipeline.ts` 应已无引用,统一删除
- **必读架构**: [§1.13 目录结构](#113-目录结构最终形态)
- **必读规则**: 含 [R9 re-export 零兼容期](#r9-re-export-零兼容期)
- **执行步骤**:
  1. `rg "app/src/animation|composables/commands" app/src app/test/` 确认无引用
  2. 删除空目录
- **commit**: `chore: remove obsolete animation directories`

#### A7. Phase A 总验收(h5 only)

##### A7.1.A 跑完整质量门禁 + h5 e2e + 人工走查

- **目标**: 确认 Phase A 整体迁移完成,h5 行为无回归;mp 验证留 Phase C
- **必读架构**: [§1.8 自驱动流程示例](#18-自驱动流程示例完整占卜) · [§1.4](#14-三个-state-的具体边界)
- **必读规则**: [R1](#r1-调研先行) · [R3](#r3-commit-规范) · [R6](#r6-质量门禁) · [R7](#r7-agent-分工) · [R8](#r8-清理)
- **执行步骤**:
  1. 跑 `node scripts/quality_gate.js full`
  2. 跑 `npx playwright test` 仅 h5
  3. 人工走查:待机 / 占卜 / 解读 / 重试 / 再占一次 / 回首页 / 窄屏 / 宽屏
  4. 暴露的 bug 登记到 Phase B
- **commit**: 若有修复用 `fix:`;无修改则不提交

### 2.2 Phase B — Bug 修复(备忘)

- **B1**: draw phase 末尾 `stage.y = 0` 复位,reduced-motion 同步
- **B2**: reveal phase 合并 `growCards` + `flipCards` 为单 `revealCards` task(单 GSAP tween 同时改 rotationY + scale,duration + ease 强制一致)
- **B3**: Phase A 期间发现的其他 bug,逐项展开

### 2.3 Phase D — 文档收口(备忘)

- **D1**: 删 `PRD.md`,拆出 `docs/{product, architecture, commands, testing, deployment}.md`,`README.md` 重写为入口索引
- **D2**: 把 TODO 第一章迁出到 `docs/architecture.md`,TODO 只保留 Phase C 任务追踪 + 待决策点

### 2.4 Phase C — 小程序验证 + 修复(备忘)

- **C1**: 在 mp-weixin 开发者工具跑完整流程,生成差异报告(`docs/mp_diff_report.md`)
- **C2**: 按差异报告逐项修复 mp 暴露的问题(每项一个原子任务)

### 2.99 规则库

> 第二章每个原子任务"必读规则"列出的规则编号都指向本节。AI 执行任务时必须先点链接读完规则,再开始改代码。修改规则只改本节一处。

#### R1 调研先行

每个任务开始前必须做:
- 完整阅读"当前代码现状"段提到的所有 file:line
- `rg <关键词> app/src app/test/` 确认所有引用点
- 阅读相关测试,理解当前期望行为
- **禁止只看 TODO 描述就动手**

#### R2 任务自包含

每个原子任务的"执行步骤"段必须列出**全部**会被修改的文件路径。如果执行中发现需要改其他文件,**先停止**,把新发现的文件加入执行步骤,再继续。**禁止悄悄扩大修改范围**。

#### R3 commit 规范

- Conventional Commits: `feat:` `fix:` `refactor:` `docs:` `chore:` `test:` 等
- **不 push 到 remote**(除非用户明确要求)
- **无 AI authorship marker**
- 一个任务一个 commit

#### R4 frontend 类型检查

- frontend 类型检查**必须**用 `npx vue-tsc --noEmit -p app/tsconfig.json`
- **禁止用 plain tsc** — plain tsc 不识别 Vue SFC 内的类型错误
- backend 用 `npx tsc --noEmit -p server/tsconfig.json`

#### R5 单元测试调用

- 测试已按 workspace 拆分,vitest 调用 **必须**带匹配的 `--dir`:
  - app 测试: `npx vitest run --config app/vitest.config.ts --dir app/test`
  - server 测试: `npx vitest run --config server/vitest.config.ts --dir server/test`
- 不带 `--dir <workspace>/test` 时 vitest 的 `*.test.ts` include glob 匹配 0 个文件,**不报错但跑 0 个用例**

#### R6 质量门禁

- 每个任务 commit 前跑 `node scripts/quality_gate.js full`(全量) 或 `staged`(增量)
- 失败必须修复;**禁止 --no-verify 跳过**

#### R7 agent 分工

- 每个任务有 1 个 executor + 至少 1 个并行 audit agent
- agent 选择参考 `~/.claude/agents-catalog.md`
- audit agent 必须**异于** executor
- 失败则 rework;**连续 2 次失败必须停止**,把问题与自我反思上报给用户

#### R8 清理

- **物理临时文件**: artifacts、log、调试脚本、screenshots — 每个任务结束前清理
- **代码内残留**: scaffold、pre-refactor 旧代码、unreachable code、过期注释 — 同步清理
- **空目录**: 迁移完成后旧目录变空,一并删除

#### R9 re-export 零兼容期

每个迁移任务**必须**包含三步:
1. **建新文件**: 在新路径建立等价实现
2. **grep 全仓改 import**: 用 `rg <旧路径> app/src app/test/` 找所有引用,逐文件改
3. **删旧文件**: 立即删除旧路径文件;**禁止留 re-export**

#### R10 task 实现技术栈选择

按"操作对象的物理特性"选择(对应第一章 §1.12):
- 操作**响应式对象**(Vue ref / Pinia store ref) → **GSAP via reconcile 工具**
- 操作**独立 DOM 视觉** → **CSS @keyframes / CSS transition**(class toggle)
- 操作**异步事件** → **Promise + AbortController**
- 操作**逐帧采样**(打字机进度) → Vue reactivity / setInterval

**禁止**: GSAP 直接 tween Vue ref / GSAP tween DOM ref(mp-weixin 失败)

#### R11 reduced-motion 分支

任何动画 task 必须处理 `prefers-reduced-motion: reduce`:
- 检查方式: `useReducedMotion()` composable 或 `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
- 处理方式: 用 `gsap.set` 直接设最终值,跳过 tween;或用极短 duration(50ms 以内)
- **禁止**: reduced-motion 下完全跳过 task — 仍必须把状态推进到"等价于动画完成"

---

## 第三章 · 待决策点

> 以下问题尚未闭环,**第二章相关任务暂留 TBD 或骨架**。每条带背景与候选方案。

### Q-A. reading 入场 phase 细节

**已部分锁定**:
- 单 task `expandDrawer`:CSS class toggle 触发占卜视图 padding-bottom + 抽屉 transform 同步
- 卡牌位置由 `calculateCardPosition()` 响应式函数自动驱动(flex 流式布局)
- **舞台位置不变**

**待决策**:
1. `calculateCardPosition()` 函数放哪里?(`states/shared/composables/` vs `states/reading/composables/`)
2. 抽屉拖拉到全屏是本次实现还是未来需求?
3. layout solver(`app/src/core/sizing/scale.ts`)的角色是否仅算占卜模式,reading 模式不再算 dock 位置?

### Q-B. cancel 实现细节

**背景**: state_controller.cancel() 与 jumpTo() 内部需中断当前正在跑的所有 task。

**候选方案**:
- A. 每个 task 用 GSAP timeline,cancel 时 `gsap.killTweensOf(ctx.everything)`
- B. 引入 AbortController,task 在 run 内监听 signal,GSAP 监听 abort 时 kill
- C. 全局 cancellation_token,task 主动 check token.cancelled

### Q-C. dev replay 跳转细节(已部分锁定)

**已锁定**: 仅 state 级 jumpTo,不支持 phase / task 级跳转

**待决策**: jumpTo 时跳过的 state 是否执行 enter 副作用(如 divination 不跑动画但要造 drawnCards 数据)?
- A. 跳过的 state 完全不执行,目标 state 自负责"如果数据缺失则现造"
- B. 跳过的 state 执行简化版 fastForward hook

### Q-D. reading API 失败重试机制

**背景**: 解读 API 在 draw phase 启动时并行发起。

**候选方案**:
- A. API 调用是 reading_service 细节,reading state 维护 `apiState` ref,重试触发 reading_service.retry() 不走 state_controller
- B. API 调用是一个 task(等待 API task),失败时 task 失败,phase 失败,捕获后重试

### Q-E. cards-load error 处理

**背景**: 78 张塔罗牌资源加载失败时,idle 阶段展示错误带 + 重试按钮。

**候选方案**:
- A. cards-load error 是 idle state 内 store 的 `error` ref,重试是 idle state 内部 action
- B. 是一个独立的 "error" phase

### Q-F. idle phase 是否还需要 holdFan / holdCollected 空 task

**背景**: fan phase 内 `holdFan` `holdCollected` 是空 tween(只是停顿时间),按 task 拆分原则它们也是 task,但不含动画。

**候选方案**:
- A. 保留为 task(空 await Promise + setTimeout)
- B. 合并到 fanOut / collectFan 内部(用 + 0.5s delay)
- C. phase 内直接 `await new Promise(r => setTimeout(r, 1500))`,不算 task

### Q-G. fallback page 是不是第 4 个 state

**背景**: `pages/fallback/index.vue` 是 uni-app 路由级特殊页(404 / 错误页),含 `orbitPlanets` 动画。

**候选方案**:
- A. 是第 4 个 state(idle / divination / reading / fallback),走 state_controller
- B. 不是 state,作为独立 page 路由,与 state_controller 无关(orbitPlanets 留在 fallback page 内部)

---

## 附录 · 已锁定决策快速回溯

> 任何代码改动必须满足以下条;有冲突以第一章正文为准。

**整体框架**
1. 总体阶段顺序: Phase A 架构(h5) → Phase B bug(h5) → Phase D 文档 → Phase C 小程序
2. re-export 兼容层零兼容期: 每个迁移任务"建新 → grep 改 import → 删旧文件"三步
3. Phase A 自下而上: task → phase → state → view → 清理 → 验收

**架构**
4. 四类抽象: state_controller(全局对象) + state 对象(配置 + run hook) + phase_controller(per state 实例对象) + phase async function + task async function
5. **无 atom_controller** — task 是纯 async function,直接调 GSAP/fetch/DOM
6. flow 是分布式文件命名后缀(state_flow / phase_flow),让"流程"语义在文件名显式
7. 无 action 中转层,无 service 包装层
8. reconcile 是工具函数(`core/utils/reconcile.ts`,动词命名)

**state 层**
9. state_controller 接口: current / next / jumpTo / cancel / run
10. state 对象 = 配置(phases 列表) + run hook
11. 待机 → 占卜 → 解读 →(用户触发)待机 — **单向状态流,不自动循环**
12. 自驱动模式:state.run() 创建 phase_controller 实例并调 phase_controller.run();phase_controller 末尾自动调 state_controller.next()
13. lifecycle_log 由 state_controller 内部写入

**phase_controller 层**
14. phase_controller 是工厂(`core/phase_controller.ts` 的 `createPhaseController(phases)`),per state 一实例
15. 接口与 state_controller 对称: currentPhase / next / jumpTo / cancel / run
16. run() 返回 Promise:启动第一个 phase(fire-and-forget),Promise 在最后 phase 调 next 时 resolve
17. dev tool jumpTo 支持 state 级与 phase 级,**不支持 task 级**

**phase / task 层**
18. phase 是 async function,文件 `<phase>_flow.ts`,内部 await/Promise.all 调 task
19. **phase 末尾必须调 `ctx.phase_controller.next(ctx)`** 触发下一 phase(与 state 自驱动对称)
20. **无 phase_flow 配置对象**(phase_flow 只是文件名后缀,export 同名 async function)

**task 层**
21. task 是 async function,按操作命名(纯动词,无类型前缀)
22. **task 拆分原则**:每个独立动作 = 1 task;必须强制同步的多动作合并为单 GSAP tween;不需同步的串行动作各自独立 task
23. task 文件位置按共享层级:仅一 phase 用 = phase 文件内局部;跨 phase 用 = `states/<state>/phases/shared/tasks/`;跨 state 用 = `states/shared/tasks/`
24. task 内部直接调 GSAP / fetch / DOM(mp 兼容用 reconcile 工具),无包装对象

**已锁定的具体 task 处理**
25. 揭示 phase 的 grow + flip 合并为单 `revealCards` task(B2 阶段做)
26. 解读入场 phase 单 task `expandDrawer`(舞台不变,卡牌位置由 calculateCardPosition 响应式函数 + flex padding 自动驱动)

**命名规范**
27. 函数:动词开头,无 er 结尾。例:`reconcile`(非 reconciler) / `calculateCardPosition`(非 calculator)
28. task 函数:纯动词,操作即名(无 notify/reset/animate 类型前缀;通知用 `signal*`)
29. 类/对象:可名词。例:`state_controller` / `phase_controller`
30. 文件:`*_flow.ts` 后缀让流程语义显式
