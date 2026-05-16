# config

根级工具配置集中目录。所有 lint、架构、重复、死代码、提交规范与密钥扫描的配置在此，由 `scripts/quality_gate.js` 与 git 钩子按路径显式引用，避免散落各包根目录。

## 目录架构

```
config/
├── eslint.config.mjs        # ESLint flat config(app/server/test 统一规则)
├── dependency-cruiser.cjs   # 模块依赖架构约束(arch:check)
├── jscpd.json               # 重复代码检测阈值(duplicate-code)
├── knip.json                # 死代码 / 未用依赖检测(dead-code)
├── commitlint.config.cjs    # Conventional Commits 规范(commit-msg 钩子)
└── gitleaks.toml            # 密钥扫描规则
```

各配置对应的门禁步骤见 [docs/git_workflow.md](../docs/git_workflow.md) “质量门禁”。

## 技术栈

- **ESLint**（flat config，`.mjs`）：代码风格与正确性。
- **dependency-cruiser**：依赖方向 / 分层架构校验。
- **jscpd**：复制粘贴检测。
- **knip**：未使用文件、导出与依赖。
- **commitlint** + `@commitlint/config-conventional`：提交信息格式。
- **gitleaks**：提交/历史密钥泄漏扫描。
