# TODO — Scales Tarot

> 更新日期：2026-04-20
> 当前交付范围：H5 + `single_card`
> 执行顺序：质量门禁 -> 问题修复 -> 回归验收

## 规则与状态

| 标记 | 含义 |
|---|---|
| `[ ]` | 待开始 |
| `[~]` | 进行中 |
| `[?]` | 待验收 |
| `[x]` | 已完成 |
| `[!]` | 阻塞 / 待确认 |

- 状态严格流转：`[ ] -> [~] -> [?] -> [x]`；任一阶段如被阻塞，立即转为 `[!]` 并写明原因。
- 开始即更新：任务一旦开工，立即改为 `[~]`，禁止事后补标。
- 完成即闭环：只有存在可复核证据时才能标记 `[x]`，证据必须是命令输出、构建结果、测试结果或人工验证记录。
- 单一事实源：当前执行状态只以本文件为准；已完成事项不保留在主清单中。
- 新增固定数值必须集中到常量或配置；禁止把魔法数字散回业务代码。

## 已确认的门禁缺口与异常

- [!] CI 未覆盖 `lint`、`audit`、架构检查：`.github/workflows/ci.yml` 当前只跑 `type-check`、`test`、`build:h5`。
- [!] `lint` 口径不一致：`package.json` 的 `lint` 只检查 `app/src/`，`.simple-git-hooks.json` 试图检查 `server/src/`，但当前 ESLint 配置又忽略了 `server/`。
- [!] 架构门禁不可用：仓库没有稳定的 `arch:check` 脚本；`depcruise` 直接运行时对 workspace / test 依赖产生大量误报，当前结果不可作为硬门禁。
- [!] 测试门禁不干净：`npm test` 虽然通过，但 `test/divination_overlay_a6.test.ts` 仍出现 `Failed to resolve component: scroll-view` 的 Vue warning。
- [!] 安全门禁阈值与现状不匹配：`npm audit --omit=dev --audit-level=high` 未拦截当前 `esbuild` 链路漏洞，现状仍有上游 `@dcloudio` 依赖带来的风险。
- [!] 构建告警未治理：`npm run build:h5` 成功，但字体资源在构建时未解析，当前缺少“允许 / 阻塞”的明确标准。
- [!] 产品口径与实现不一致：`PRD.md` 仍声明支持 `single_card`、`three_card`、`cross_spread`，但 `app/src/stores/tarot.ts` 仍将 `spreadKind` 固定为 `single_card`，对应测试也在固化该行为。
- [!] 发布配置与主线不一致：`app/src/manifest.json` 仍硬编码 `mp-weixin.appid`，并保留相机权限；与当前 H5 主线不对齐。
- [!] 可访问性逻辑未真正接线：`DivinationOverlay.vue` 中已有 `overlayRef` / `handleOverlayKeydown` / `trapFocus`，但模板未绑定根节点 `ref` 与对应键盘事件。

## G0 质量门禁补齐

### [~] G0.1 统一本地与 CI 质量命令入口

- 目标：把 `type-check`、`lint`、`test`、`build:h5`、`build:server`、`audit`、`arch:check` 收敛为一套统一命令，避免本地、hook、CI 三套口径。
- 处理：新增统一质量脚本；CI、README、技术文档、hook 全部引用同一入口。
- 验收点：同一套命令可以在本地和 GitHub Actions 中执行；不再存在“本地过 / CI 不跑”或“hook 跑的和 CI 不同”的情况。
- 验收策略：执行统一质量命令；在 `.github/workflows/ci.yml` 中接入并验证 Node 20 / 22 两个矩阵都使用同一入口。

### [ ] G0.2 修正 lint 覆盖范围与配置边界

- 目标：让前端、后端、测试代码的 lint 策略明确且可执行，消除“脚本声称覆盖，配置实际忽略”的假门禁。
- 处理：决定是扩展现有 ESLint 到 `server/src`，还是拆分前后端配置；同步修正 `lint` 脚本与 pre-commit。
- 验收点：`lint` 覆盖范围与配置一致；执行结果可解释；不会再出现 `server/src` 被声称检查但实际未检查。
- 验收策略：运行 `npm run lint`，并单独验证 hook 调用路径与 CI 路径一致。

### [ ] G0.3 建立可用的架构门禁

- 目标：让依赖结构检查从“不可用误报”变成“可执行门禁”。
- 处理：新增 `npm run arch:check`；修正 `.dependency-cruiser.js` 对 workspace、test、类型依赖和允许例外的规则；明确哪些 warning 允许保留、哪些 error 必须阻断。
- 验收点：`arch:check` 使用仓库本地依赖可稳定执行；结果以真实结构问题为主，不再被 workspace 误报淹没。
- 验收策略：运行 `./node_modules/.bin/depcruise ...` 对比修复前后输出；保留例外说明和规则注释。

### [ ] G0.4 收紧测试告警门禁

- 目标：测试通过不再等于“带 warning 的假绿”。
- 处理：为 uni-app 组件测试补齐 `scroll-view` 等运行环境处理；阻断未处理的 Vue warn / console error 静默通过。
- 验收点：组件测试通过且无未处理 warning；`DivinationOverlay` 相关测试结果干净。
- 验收策略：运行 `npm test`，检查 `divination_overlay_a6.test.ts` 与相关组件测试输出为无 warning 通过。

### [ ] G0.5 明确安全与构建告警策略

- 目标：把安全漏洞和构建告警从“知道有问题”变成“有结论、有处理路径”。
- 处理：决定 `npm audit` 阈值、上游依赖风险白名单、复查日期；定义 H5 构建字体告警是必须修复还是允许带说明发布。
- 验收点：安全风险和构建告警都有明确门禁标准；没有默认忽略项。
- 验收策略：运行 `npm audit --omit=dev` 与 `npm run build:h5`，将当前输出和处置结论写回文档 / 配置。

## G1 问题修复

### [ ] G1.1 收敛牌阵口径到当前主线

- 目标：文档、store、测试对“当前只正式交付 `single_card`，但架构保留扩展点”达成一致。
- 处理：修正 `PRD.md` 的牌阵表述；重构 `app/src/stores/tarot.ts` 中 `ACTIVE_SPREAD_KIND` 的硬编码策略；同步调整 `test/tarot_store.test.ts` 的断言口径。
- 验收点：`PRD.md`、运行时实现、测试断言三者一致；新增牌阵时不需要再改核心流程主干。
- 验收策略：运行相关单测并复核 `PRD.md` / `spread_registry.ts` / `tarot.ts` 的表达一致性。

### [ ] G1.2 修复 overlay 焦点管理接线

- 目标：让 `DivinationOverlay` 中已有的焦点陷阱逻辑真正生效，而不是停留在未绑定代码。
- 处理：为 overlay 根节点绑定 `ref`、键盘事件和必要语义；补真实组件级测试覆盖打开、循环、关闭后的焦点恢复。
- 验收点：`Tab` / `Shift+Tab` 不会逃出 overlay；关闭 overlay 后焦点恢复；相关组件测试无 warning。
- 验收策略：运行组件测试，并在 H5 页面手动验证键盘导航。

### [ ] G1.3 清理发布配置与权限声明

- 目标：让 `manifest.json` 与当前 H5 主线一致，消除无效小程序发布信息和不必要权限。
- 处理：移除或环境化 `mp-weixin.appid`；清理与当前产品无关的权限声明；同步文档中的发布范围说明。
- 验收点：发布配置不再携带当前主线无关的硬编码和权限；文档与配置保持一致。
- 验收策略：复核 `app/src/manifest.json`、执行 `npm run build:h5`，并确认 README / 技术文档的发布口径同步。

## G2 回归验收

### [ ] G2.1 自动化回归

- 目标：确认门禁补齐和问题修复后，主线质量能被自动化稳定拦截。
- 处理：集中执行类型检查、lint、测试、架构检查、H5 构建、服务端构建。
- 验收点：所有质量命令一次性通过；无未处理 warning；无新增门禁例外。
- 验收策略：按统一质量命令执行；保留命令输出作为验收证据。

### [ ] G2.2 关键路径与错误路径验证

- 目标：确认首页 -> 占卜 -> 结果，以及错误恢复路径都与新门禁要求一致。
- 处理：启动开发服务器，执行正常路径与网络错误路径脚本；必要时补充人工键盘和响应式验证。
- 验收点：`test/e2e_divination_flow.sh` 与 `test/e2e_network_error.sh` 均通过；H5 手动验证无焦点和布局回归。
- 验收策略：运行脚本化 E2E；补充手动验证记录，重点检查焦点管理、错误恢复、窄屏 / 宽屏布局。
