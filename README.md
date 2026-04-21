# Scales Tarot

Scales Tarot 是一个以 H5 为主要交付形态的单页塔罗体验项目。它强调短路径、仪式感和稳定反馈，让用户在一个页面内完成抽牌、揭示与解读。

当前仓库的目标不只是维护一个可运行页面，还要建立一套清晰、可持续、不过度依赖特定 AI 工具的演进方式。任何新协作者都应该能只依赖仓库内文档理解项目、执行任务和验证结果。

---

## 当前范围

- 当前正式范围：H5 网站
- 当前主线：文档基线、工程质量基线、架构收敛、发布治理
- 当前不在主线：小程序发布、账号体系、支付、社交分享、AI 解读扩展

---

## 文档索引

- 产品需求：[PRD.md](PRD.md)
- 执行计划：[TODO.md](TODO.md)
- 技术架构：[docs/technical_architecture.md](docs/technical_architecture.md)
- 测试入口：[test/README.md](test/README.md)
- AI 协作约束：[AGENTS.md](AGENTS.md)

---

## 快速开始

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev:h5
```

基础校验：

```bash
npm run quality
```

运行生产构建产物：

```bash
NODE_ENV=production npm run start:prod
```

## 质量保证

当前本地与 CI 统一使用 `npm run quality` 作为全量门禁入口，pre-commit 使用 `npm run quality:staged` 做快速 lint 修复并回写暂存区。

```bash
# 安装 hooks
npm run prepare

# 运行全量质量门禁
npm run quality
```

`npm run quality` 当前会顺序执行 `lint`、`type-check`、`test`、`build:h5`、`audit`、`arch:check`。

---

## 协作原则

1. 开始任何任务前，先读 `TODO.md`、`PRD.md` 和 `docs/technical_architecture.md`。
2. 产品范围变化，先更新 `PRD.md`；技术边界变化，先更新技术架构文档；执行节奏变化，先更新 `TODO.md`。
3. 所有代码改动都必须附带对应验证证据，至少覆盖类型检查、测试或构建中的必要项。
4. 项目文档必须能被人类开发者直接理解，AI 只能是辅助工具，不能成为唯一知识入口。

---

## 使用与授权说明

本仓库**不是开源项目**，默认采用“保留所有权利（All Rights Reserved）”方式管理。

未经项目所有者书面授权，禁止以下行为：

- 将本项目或其衍生版本用于商业用途
- 对外提供托管、售卖、转授权或二次分发
- 公开镜像、公开转载或以开源项目名义再次发布
- 将项目中的设计、文案、素材或实现整体挪作其他商业产品

允许的范围仅限于经授权的内部协作、评审、学习和受控开发活动。

---

## 项目结构

```text
app/      前端应用
server/   后端服务
test/     测试工作区
docs/     技术文档
```
