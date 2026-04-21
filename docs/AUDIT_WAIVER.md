# 安全漏洞白名单与复查记录

> 本文档是 `npm audit` 门禁策略的补充说明。
> 权威命令入口见 `package.json` scripts 与 `scripts/quality_gate.js`。

---

## 门禁策略概述

| 场景 | 命令 | 阈值 | 行为 |
|---|---|---|---|
| CI / 本地全量门禁 | `npm run quality:audit` | `--audit-level=high` | **阻断**：发现 high/critical 即失败 |
| 信息查看（不阻断） | `npm run quality:audit:info` | `--audit-level=moderate` | 仅输出，不阻断 CI |

**原则**：`high` 及以上漏洞必须在合并前修复或获得显式豁免；`moderate` 及以下漏洞进入本白名单接受定期复查。

---

## 当前已接受的上游依赖风险（2026-04-21）

### ESBuild 开发服务器漏洞（moderate × 13）

- **漏洞编号**：GHSA-67mh-4wv8-2f99
- **影响包**：`esbuild <= 0.24.2`
- **引入路径**：`@dcloudio/uni-cli-shared` → `@dcloudio/uni-*` 全系列
- **严重级别**：moderate
- **当前数量**：13 条（均指向同一 esbuild 版本）

#### 风险分析

| 维度 | 评估 |
|---|---|
| 影响范围 | **仅开发服务器**。漏洞描述为"esbuild enables any website to send any requests to the development server and read the response" |
| 生产暴露面 | **无**。生产构建 (`npm run build:app:h5` / `npm run build:server`) 不启动 dev server |
| 利用条件 | 需要开发者在本地运行 `npm run dev` 或 `npm run dev:h5` 且机器可被外部网站访问 |
| 缓解措施 | 开发环境仅绑定 `localhost`，不暴露公网；开发者本地防火墙通常已阻断入站 |

#### 修复路径评估

- `npm audit fix --force` 会降级 `@dcloudio/uni-cli-shared` 到 `0.2.994`，属于 **breaking change**，可能导致 uni-app 构建链断裂。
- 上游 `@dcloudio` 生态未发布修复版本，短期无官方补丁。

#### 接受结论

接受该 moderate 风险进入白名单，**不阻断 CI**。

---

## 复查计划

| 漏洞 | 下次复查日期 | 触发条件 |
|---|---|---|
| esbuild GHSA-67mh-4wv8-2f99 | **2026-05-21** | 每月检查一次 `@dcloudio` 更新；若上游发布修复版本立即移除 |

**复查命令**：
```bash
npm audit --omit=dev --audit-level=moderate
npm outdated @dcloudio/uni-cli-shared @dcloudio/uni-app @dcloudio/uni-h5
```

---

## 变更记录

| 日期 | 变更 | 操作人 |
|---|---|---|
| 2026-04-21 | 建立本文档，接受 esbuild moderate × 13 进入白名单 | Kimi（执行者） |
