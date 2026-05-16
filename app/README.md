# app

uni-app + Vue 3 前端，单产物双端：H5（主交付）与 mp-weixin（小程序，验证中）。承载塔罗体验的全部界面、动画与状态流；后端接口经 `core/http` 访问，路由由 `pages.json` 驱动（非 vue-router）。

## 目录架构

```
app/
├── src/                  # 源码(状态机迁移目标结构,详见下方链接)
├── test/                 # 前端测试(vitest 单元/组件,jsdom)
│   └── e2e/              # playwright 端到端用例
├── index.html
├── vite.config.ts        # vite + vite-plugin-uni(仅 gsap 别名,无 @ 别名)
├── vitest.config.ts
├── playwright.config.ts  # webServer.cwd 解析到仓库根
├── tsconfig.json
├── shims-uni.d.ts
└── package.json
```

`src/` 内部为状态机迁移的**目标结构**（现状与目标部分共存），完整子树见 [docs/src_structure.md](docs/src_structure.md)；迁移规则见 [CLAUDE.md](../CLAUDE.md) “State-phase 迁移” 节。

## 技术栈

- **uni-app**（`@dcloudio/uni-*`）+ **Vue 3.4**：`main.ts` 用 `createSSRApp`（uni-app 约定，非 vanilla `createApp`）；H5 + mp-weixin 双产物。
- **Pinia**：全部状态管理。
- **GSAP**：动画引擎，封装于 `core/animation/adapters/`；自研相位引擎在 `core/animation/`。
- **vite** + `vite-plugin-uni`：H5 dev server / 双端构建。
- **vitest** + `@vue/test-utils`（jsdom）：纯逻辑与组件单测。
- **playwright**：H5 端到端。
- **vue-tsc**：前端类型检查（必须用 `vue-tsc`，普通 `tsc` 漏 SFC 级错误）。
