# 执行计划：架构文档拆分到分目录 README

> 唯一执行跟踪文档。把 [app_structure.md](app_structure.md) 的目录架构按层下沉到各顶层目录 README，长内容拆子文档超链引用。

---

## 决策（已确认，不可变更）

- **A 子文档落点**：各目录建同级 `docs/`（`app/docs/`、根用现有 `docs/`）；`server`/`scripts`/`config` 内容小，无子文档。
- **B `app_structure.md` 去留**：瘦身为架构索引导航页保留；`CLAUDE.md`、本文件对它的引用不动（仍为权威入口，转发到分文档）。
- **C README 粒度**：仅顶层目录各一个（`root`/`app`/`server`/`scripts`/`config`）；`app/src/` 迁移目标深层树作为 `app/docs/` 子文档，标注「目标结构·迁移中」。

## 格式约定

- GitHub 标准 markdown（`#`/`##` 标题、围栏代码块、必要时极简列表），中文。
- 三段式：项目/目录描述 → 目录架构说明 → 技术栈简介；根 README 额外加协作指导 + 开源声明。
- 每个 README 只展开本层目录，深层/长内容超链引用，禁止重复整棵树、禁止思路与赘述。

---

## 任务清单

- [x] **T1 运维内容下沉** — 新建 [development.md](development.md)（快速开始 + `dev`/`prod` 命令详解 + 环境变量 + 部署）、[git_workflow.md](git_workflow.md)（Git 6 步 + 钩子 + 质量门禁 + 紧急绕过）；内容从现根 `README.md` 迁移，不增删语义。
- [x] **T2 app/src 目标树迁移** — 新建 `app/docs/src_structure.md`：`app_structure.md` 的「`app/src/` 子树」整段迁来；首行标注「迁移目标结构（Phase A 已完成），迁移规则见 `CLAUDE.md` “State-phase 迁移” 节」（src_structure.md 内以 `../../CLAUDE.md` 链接），删除原对已清空 TODO 的迁移计划引用。
- [x] **T3 app/README.md** — 三段式：用途（uni-app + Vue 3 前端，h5 + mp-weixin 双产物）→ `app/` 直属树（`src/` `test/e2e/` + 配置文件，一级）→ 技术栈；超链 `app/docs/src_structure.md`。
- [x] **T4 server/README.md** — 三段式：用途（Express 4 + zod 后端 :4124）→ `server/` 直属树 → 技术栈。
- [x] **T5 scripts/README.md** — 三段式：用途（构建编排 + 质量门禁，不暴露为 npm script）→ `scripts/` 树 → 技术栈。
- [x] **T6 config/README.md** — 三段式：用途（根级工具配置）→ 各配置文件清单与职责 → 技术栈。
- [x] **T7 根 README.md 重构** — 项目描述 → 根目录架构说明（顶层一级树，含 `.github/`）→ 技术栈简介 → 协作指导 → 开源声明 → 文档索引；运维细节改为指向 `docs/development.md` / `docs/git_workflow.md`，结构细节指向各 README。
- [x] **T8 app_structure.md 瘦身** — 改为架构索引导航页：一句话定位 + 指向全部分目录 README 与 `app/docs/src_structure.md` 的超链表；不再内联整棵树。
- [x] **T9 docs/README.md 更新** — 全局文档索引补：5 个分目录 README、`development.md`、`git_workflow.md`、`app/docs/src_structure.md` 条目；修正 `TODO.md`、`app_structure.md` 的条目描述。
- [x] **T10 一致性终检** — `rg` 扫描全仓 markdown 死链与对旧 `app_structure.md` 整树的残留依赖；逐文件核对交叉链接可达；根目录树与 `git ls-files` 实际顶层一致；勾选本清单全部完成。

---

## 进度

全部完成（2026-05-16）：

- 新增 `docs/development.md`、`docs/git_workflow.md`，运维内容从根 README 迁出。
- 新增 `app/docs/src_structure.md`（app/src 迁移目标深层树）。
- 新增 `app/README.md`、`server/README.md`、`scripts/README.md`、`config/README.md`（均三段式）。
- 重构根 `README.md`（项目描述 / 根目录架构 / 技术栈 / 协作指导 / 授权声明 / 文档索引）。
- `docs/app_structure.md` 瘦身为架构索引导航页；`docs/README.md` 更新为全局文档索引。
- 终检：全仓 markdown 死链清零（修正本文件一处越界示例链接为行内代码）；根目录树与 `git ls-files` 顶层一致；`CLAUDE.md` 对 `app_structure.md`/`TODO.md` 的引用按决策 B 保持不动且仍可达。
