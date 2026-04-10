# 单元测试

运行全部测试：

```bash
npm test -w test
```

当前共 **120 个测试用例，7 个测试文件**。

---

## 文件结构

```
test/
├── result_panel.test.ts       # 前端 result_panel 工具函数
├── spread_layout.test.ts      # 前端 spread layout 求解器单元测试
├── tarot_store.test.ts        # 前端 tarot store 抽牌/读牌时序与失效请求保护
├── tarotReading.test.ts       # 前端 drawCards 逻辑
├── index_page.test.ts         # 前端首页设置面板与 runtime spread 状态测试
└── testcases/
    ├── backend.test.ts        # 后端服务层单元测试（card_loader + tarot_reading）
    └── api.test.ts            # 前后端接口联调测试（supertest HTTP）
```

---

## 前端单元测试

### `spread_layout.test.ts`

测试对象：`app/src/utils/spread_layout.ts`

| 函数 | 用例 | 覆盖路径 |
|------|------|----------|
| `getSpreadCardCount` | single_card → 1 | 单卡展开 |
| `getSpreadCardCount` | three_card → 3 | 三张展开 |
| `getSpreadCardCount` | cross_spread → 5 | 十字展开 |
| `resolveSpreadLayout` | single_card 居中 | 单卡位置计算 |
| `resolveSpreadLayout` | three_card 宽屏水平/窄屏垂直 | 响应式布局 |
| `resolveSpreadLayout` | cross_spread 5 张卡位 | 十字形布局 |
| `resolveSpreadLayout` | draw_stage vs result_stage | 场景切换 |
| `resolveSpreadLayout` | 宽屏 vs 窄屏布局选择 | 响应式适配 |
| `resolveSpreadLayout` | 小程序手机/H5 移动/iPad/桌面各设备尺寸 | 跨设备尺寸回归（防止 CSS 变量与求解器不同步） |

### `result_panel.test.ts`

测试对象：`app/src/utils/result_panel.ts`

| 函数 | 用例 | 覆盖路径 |
|------|------|----------|
| `getResultStatement` | `'yes'` → 积极指示文案 | 积极分支 |
| `getResultStatement` | `'no'` → 消极指示文案 | 消极分支 |
| `getSummaryText` | 3 张牌含义 → 取前 2 句拼接、第 3 句截断 | 2 片段主流程；含标点的首句提取 |
| `getSummaryText` | 1 张牌含义 → 单片段无分隔符 | 1 片段路径 |
| `getSummaryText` | 0 张牌 → 只返回引导语 | 空 cardDetails fallback |

### `tarotReading.test.ts`

测试对象：`app/src/utils/tarotReading.ts`

| 函数 | 用例 | 覆盖路径 |
|------|------|----------|
| `drawCards` | 精确抽出 N 张 | spreadKind 驱动数量 |
| `drawCards` | 每张牌 position 为合法值 | `'upright' \| 'reversed'` 随机分支 |
| `drawCards` | 抽到的牌均来自原始牌组 | 牌数据引用完整性 |
| `drawCards` | 无重复牌（id 唯一） | Fisher-Yates shuffle 无碰撞 |

### `tarot_store.test.ts`

测试对象：`app/src/stores/tarot.ts`

| 函数 | 用例 | 覆盖路径 |
|------|------|----------|
| `drawCards` | 同步完成本地抽牌 | 动画首帧不等待网络 |
| `startReadingRequest` | 单独启动异步读牌并可被等待 | 抽牌/读牌解耦路径 |
| `waitForReadingResult` | 复用当前进行中的 Promise | 结果展示等待路径 |
| `reset` + `startReadingRequest` | 旧请求完成后不会覆盖新结果 | 失效请求保护 |
| `setSpreadKind` | 运行时切换 spread 类型 | `single_card`/`three_card`/`cross_spread` |
| `spreadKind` + `drawCards` | 切换后 drawCards 长度变化 | runtime spread 驱动抽牌数量 |
| `spreadKind` + `reset` | 重置后 spread 选择保持可用 | 下回占卜使用当前选择 |

### `index_page.test.ts`

测试对象：`app/src/pages/index/index.vue` + stores

| 功能 | 用例 | 覆盖路径 |
|------|------|----------|
| spread 选项标签 | 单牌阵/三牌阵/十字牌阵 | 中文标签正确性 |
| `spreadKind` 状态 | 可从 store 读写 | 设置面板绑定 |
| `cardCount` 计算 | 1/3/5 张对应正确 | spread 到数量映射 |
| `isIdle` 条件 | 仅在 idle 状态显示设置入口 | 首页空闲态判断 |
| `getUiAsset` | 读取主题设置图标 | 主题资源访问 |

---

## 后端单元测试（`testcases/backend.test.ts`）

测试对象：`server/src/services/card_loader.ts` + `server/src/services/tarot_reading.ts`

### card_loader

| 用例 | 说明 |
|------|------|
| 加载恰好 78 张牌 | 覆盖全量 JSON 合并 |
| 重复调用返回同一引用 | 单例缓存行为 |
| `getCardById` 找到已有牌 | 正常查询路径 |
| `getCardById` 返回 undefined（未知 id） | 查询不命中 |
| 大阿卡纳图片 URL 正确 | major arcana URL 构造 |
| 小阿卡纳图片 URL 正确 | minor arcana URL 构造 |
| 大阿卡纳无 suit 字段 | 字段缺省逻辑 |
| 小阿卡纳有 suit 字段 | 字段存在逻辑 |

### generateReading — 评分路径

评分规则：`minor ±5`，`major Math.round(±5 × 1.3)` = `+7 / -6`（JS 舍入非对称）

| 用例 | 预期分值 | 覆盖路径 |
|------|---------|----------|
| minor positive upright | +5 | 正向分支 |
| minor negative upright | -5 | 负向分支 |
| minor positive reversed | -5 | reversed 负向 |
| minor negative reversed (reversed.sentiment=positive) | +5 | 逆位积极含义 |
| major positive upright | +7 | 大阿卡纳乘数 |
| major negative upright | -6 | `Math.round(-6.5)=-6` 舍入特性 |
| major neutral upright | +1 | neutral 分支 |
| major neutral reversed | -1 | neutral reversed 分支 |

### generateReading — 结果与平局决胜

| 用例 | 说明 |
|------|------|
| 3 张正向牌正位 | score=15, result='yes' |
| 3 张负向牌正位 | score=-15, result='no' |
| 混合三牌展开 | 正确累加 |
| cardDetails 含正确牌义 | 正位/逆位 meaning 映射 |
| 未知 cardId → throws | 错误路径 |
| score=0, 正位多 → yes | 平局：正位获胜 |
| score=0, 逆位多 → no | 平局：逆位获胜 |
| score=0, 正逆相等 → yes | 平局：>= 条件 |

---

## 前后端接口联调测试（`testcases/api.test.ts`）

使用 supertest 对 Express app 发送真实 HTTP 请求，验证响应与前端 TypeScript 类型定义的契约一致性。

### `GET /api/health`

| 用例 |
|------|
| 返回 200，body 含 `status:'ok'` 和 ISO timestamp |

### `GET /api/v1/cards` ↔ `fetchAllCards()`

| 用例 | 验证的契约字段 |
|------|--------------|
| 返回 200 | HTTP 状态 |
| 返回恰好 78 张牌 | `{ cards: TarotCardInfo[] }` 结构 |
| 每张牌满足 TarotCardInfo 字段类型 | `id/name/nameEn/number/type/image/upright/reversed` |
| 大阿卡纳无 suit | `suit?` 可选字段 |
| 小阿卡纳 suit 为合法花色 | `'wands'\|'cups'\|'swords'\|'pentacles'` |
| 图片 URL 格式匹配静态路径 | URL 前缀校验 |
| the_fool 图片 URL 完全一致 | 端到端 URL 生成验证 |
| 响应包含 CORS 头 | `Access-Control-Allow-Origin: *` |

### `POST /api/v1/readings` ↔ `fetchReading()`

| 用例 | 验证的契约字段 |
|------|--------------|
| 合法请求返回 200 | HTTP 状态 |
| 响应满足 ReadingResult 字段类型 | `result/score/cardDetails` |
| cardDetails 长度等于提交牌数 | 数组对应关系 |
| 每个 cardDetail 满足 CardDetail 类型 | `position/meaning/card` |
| the_fool 正位端到端分值为 7 | 大阿卡纳乘数 E2E 验证 |
| cards 为空数组 → 400 | 请求校验 |
| 缺少 cards 字段 → 400 | 请求校验 |
| 未知 cardId → 422 | 业务错误响应 |

---

## 未覆盖的边界

以下场景在当前业务逻辑中**不可能发生**，暂不测试：

- `drawCards` 传入不足 N 张的牌组（实际牌组固定 78 张）
- `getSummaryText` 传入全为标点的 meaning（数据来自后端受控 JSON）
