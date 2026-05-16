# Scales Tarot

Scales Tarot 是一个以 H5 为主要交付形态的单页塔罗体验项目。它强调短路径、仪式感与稳定反馈，让用户在一个页面内完成抽牌、揭示与解读。

仓库目标不只是维护一个可运行页面，还要建立一套清晰、可持续、不过度依赖特定 AI 工具的演进方式：任何新协作者只依赖仓库内文档即可理解项目、执行任务并验证结果。

## 当前范围

- 正式范围：H5 网站。
- 主线：文档基线、工程质量基线、架构收敛、发布治理。
- 不在主线：小程序发布、账号体系、支付、社交分享、AI 解读扩展。

## 目录架构

npm workspaces 单体仓库，顶层只列一级；各目录职责与内部结构见其自身 README。

```
scales-tarot/
├── app/                  # uni-app + Vue 3 前端(h5 + mp-weixin 双产物)        → app/README.md
├── server/               # Express 4 + zod 后端(:4124)                       → server/README.md
├── scripts/              # 构建编排 + 质量门禁(不暴露为 npm script)            → scripts/README.md
├── config/               # 根级工具配置                                       → config/README.md
├── docs/                 # 权威文档(索引见 docs/README.md)
├── .github/              # CI(verify + e2e) / dependabot / PR 模板
├── dist/                 # 构建产物(gitignored)
├── CLAUDE.md             # Claude Code 工程导航与硬约束
├── README.md             # 本文件
├── package.json          # workspaces 根(仅 prepare/dev/prod 3 个脚本)
└── package-lock.json
```

- 前端 [app/README.md](app/README.md) · 后端 [server/README.md](server/README.md) · 构建 [scripts/README.md](scripts/README.md) · 配置 [config/README.md](config/README.md)
- 架构索引导航页：[docs/app_structure.md](docs/app_structure.md)

## 技术栈

- **单体仓库**：npm workspaces（`app` + `server`），Node 22。
- **前端**：uni-app + Vue 3.4 + Pinia + GSAP，vite 构建，vitest / playwright 测试。
- **后端**：Express 4 + zod，pino 日志，vitest + supertest 测试。
- **工程**：单一构建入口 + 代码门禁（lint / 类型 / 测试 / 架构 / 死代码 / 重复），simple-git-hooks + CI 双重兜底。

细节见 [docs/development.md](docs/development.md)（命令 / 环境变量 / 部署）与 [docs/git_workflow.md](docs/git_workflow.md)（Git 流程 / 质量门禁 / 钩子）。

## 快速开始

```bash
npm install
npm run dev
```

打开 [http://localhost:4123/](http://localhost:4123/) 看 H5 实时预览。完整命令与环境变量见 [docs/development.md](docs/development.md)。

## 协作指导

1. 开始任何任务前，先读 [docs/README.md](docs/README.md) 索引与 [docs/TODO.md](docs/TODO.md)；需要塔罗领域知识时查 [docs/tarot_glossary.md](docs/tarot_glossary.md)。
2. 产品范围变化先更新 [docs/prd/product.md](docs/prd/product.md)；执行节奏变化先更新 [docs/TODO.md](docs/TODO.md)。
3. 所有代码改动必须附带验证证据，至少覆盖类型检查、测试或构建中的必要项。
4. 文档必须能被人类开发者直接理解，AI 仅为辅助工具，不得成为唯一知识入口。
5. Git 流程、提交规范与质量门禁见 [docs/git_workflow.md](docs/git_workflow.md)；工程硬约束见 [CLAUDE.md](CLAUDE.md)。

## 使用与授权说明

本仓库**不是开源项目**，默认采用「保留所有权利（All Rights Reserved）」方式管理。

未经项目所有者书面授权，禁止：

- 将本项目或其衍生版本用于商业用途；
- 对外提供托管、售卖、转授权或二次分发；
- 公开镜像、公开转载或以开源项目名义再次发布；
- 将项目中的设计、文案、素材或实现整体挪作其他商业产品。

允许范围仅限经授权的内部协作、评审、学习与受控开发活动。
