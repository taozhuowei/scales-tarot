# Test Suite

运行全部测试：

```bash
npm test -w test
```

当前共 `10` 个测试文件，`137` 个测试用例。

## 覆盖范围

### 前端逻辑

- [tarotReading.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/tarotReading.test.ts)
  - `drawCards()` 抽牌数量
  - 抽牌结果唯一性
  - 正逆位合法值

- [result_panel.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/result_panel.test.ts)
  - 结果文案映射
  - 摘要文本拼接

- [spread_layout.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/spread_layout.test.ts)
  - 单牌 / 三牌 / 十字牌阵布局
  - 宽窄屏与结果区布局计算

- [tarot_store.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/tarot_store.test.ts)
  - 抽牌与读牌请求解耦
  - stale request 保护
  - 运行时牌阵切换

- [index_page.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/index_page.test.ts)
  - 首页设置入口
  - 牌阵切换状态

### 新增组件/动画测试

- [typewriter_text.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/typewriter_text.test.ts)
  - 打字机逐字输出
  - `instant` 立即输出
  - 文本更新后重新开打

- [result_panel_component.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/result_panel_component.test.ts)
  - `positive / negative` 结果色调类名

- [overlay_animation.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/overlay_animation.test.ts)
  - 动画慢放 / 快进控制
  - 暂停 / 继续
  - `replayFromPhase()`
  - 抽牌后额外 `800ms` 解读延迟

### 后端与接口

- [backend.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/testcases/backend.test.ts)
  - 牌库加载
  - 解读评分与结果生成

- [api.test.ts](/d:/Taozhuowei/Project/scales-tarot/test/testcases/api.test.ts)
  - `/api/health`
  - `/api/v1/cards`
  - `/api/v1/readings`
