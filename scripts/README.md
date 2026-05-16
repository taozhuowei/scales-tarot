# scripts

构建编排与质量门禁的实现层。**不暴露为 npm script**——`scripts/build/index.js` 与 `scripts/quality_gate.js` 是单一真相源，新增工具进此目录或 git 钩子，不新增 npm script（否则门禁内容漂移）。`build/index.js` 是唯一构建入口，按 `--dev|--prod` × `--target h5,mp,server` × `--skip-quality` 分发到 `dev.js` / `prod.js`。

## 目录架构

```
scripts/
├── build/
│   ├── index.js          # 唯一构建入口(解析 flag 并分发)
│   ├── dev.js            # dev 三 watcher 编排
│   └── prod.js           # prod 构建 + perf 门 + SPA smoke
├── lib/
│   └── port_kill.js      # 释放占用端口(SIGKILL)
├── quality_gate.js       # full | staged 代码门禁(无构建)
├── quality_scan.js       # 门禁静态扫描实现
├── quality_baseline.json # 质量基线
├── perf_baseline_gate.js # 包大小回归门禁
├── perf_baseline.json    # 性能基线
├── pr_size_gate.js       # PR 体积门禁
├── gitleaks_run.js       # 密钥扫描
└── dev_env.js            # 写 .env.development.local(注入 LAN IP)
```

命令用法见 [docs/development.md](../docs/development.md)；门禁/钩子见 [docs/git_workflow.md](../docs/git_workflow.md)。

## 技术栈

- **Node.js** 原生脚本（无构建步骤，`node scripts/<x>.js` 直跑）。
- **concurrently**：dev 下并行 h5 / mp / server 三 watcher。
- `vite` / `vite-plugin-uni` / `tsc`：被编排的构建器（由 `build/` 调用，非本目录依赖）。
- 基线文件（`*_baseline.json`）：质量与性能回归对照。
