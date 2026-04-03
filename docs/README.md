# AI Tarot Yes or No

## 项目简介
AI Tarot Yes or No 是一款聚焦 Yes / No 决策场景的塔罗占卜工具。当前版本保留最核心的体验：打开应用后直接进入首页，通过洗牌、切牌、抽牌和结果揭示完成一次完整占卜。

当前实现特征：
- 即开即用，无登录、无主题切换、无多余分支
- 本地解读，基于 78 张塔罗牌情感极性计算结果
- 单页流程，整个占卜过程都在同一个页面中通过状态与动画切换完成
- 保留现有复古羊皮纸、黄铜金色与 GSAP 仪式感动效语言

## 目录结构

```text
/
├── app/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DivinationOverlay.vue
│   │   │   └── ResultPanel.vue
│   │   ├── data/
│   │   ├── pages/
│   │   │   └── index/
│   │   ├── stores/
│   │   ├── styles/
│   │   └── utils/
│   ├── test/
│   └── package.json
├── docs/
│   ├── PRD.md
│   └── README.md
```

## 启动方式

### 安装依赖
```bash
cd app
npm install
```

### H5 开发
```bash
npm run dev:h5
```

### 类型检查
```bash
npm run type-check
```

### 单元测试
```bash
npm run test:unit
```



## 使用流程
1. 打开首页，看到标题和中心神秘圆环。
2. 点击圆环，进入洗牌、切牌、抽牌动画流程。
3. 抽牌结束后无需额外点击，结果在同一页自动揭示。
4. 首屏查看“塔罗牌根据您的问题呈现出积极/消极/尚不明朗的指示”结果文案和三张牌阵。
5. 向下继续阅读每张牌的详细启示。
6. 点击“再占一次”后同页重置，重新回到起始状态。

## 解读逻辑
- 正位 positive 计为 `+1`
- 正位 negative 计为 `-1`
- 逆位会使用逆位含义对应的情感极性
- 总分大于 0 倾向 Yes，小于 0 倾向 No，等于 0 为 Uncertain

## 验证说明
- `npm run type-check` 用于校验 Vue + TypeScript 代码结构
- `npm run test:unit` 会编译核心逻辑文件并运行单元测试
