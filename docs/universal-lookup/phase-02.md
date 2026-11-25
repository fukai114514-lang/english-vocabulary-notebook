# Phase 02 验收 · Unified Dictionary & Shared Lookup Core

2026-11-25 · **PASS**。网站仓库独立候选分支 `feature/unified-lookup-core`。数据契约、构建和测试集中在 [packages/lookup-core](../../packages/lookup-core/README.md)。

## 基线与范围

| 角色 | 完整 SHA |
|---|---|
| 网站 main / 内容恢复点 | `17795450973b124b22558f0c7d8bca520b4911ef` |
| Phase 01 网站审计 / 本分支父基线 | `503055f8c223b397f7b45bfc06bf08add0167d43` |
| Phase 01 扩展审计 | `4582bf46693c55f62bf05478d75858a8ddcf79c8` |
| Safari 候选 / 后续扩展接入基线 | `9ed3c453f7c5e9d7249c0f3b36a501f87138dae5`，本次复跑工作树 `cfdf28b42023eb04b9b9cd060901d5f32eaf4fc8` |
| Collocations 测试修正来源 | `b175b3311c58f4f99ae992a083c6c120290dabcc`，仅移植独立栏目的断言 |

本阶段交付纯核心、网站字典适配、可验证离线快照和交接记录。使用 core `0.1.0`、schema `1`。生成的词典含 2,556 个条目及 2,982 个义项。数据版本为 `b36bfe4d76a1aace263887fcbf7fef1c80f3e6af54f142018f0feeb4c7fad364`，完整词典字节的 SHA-256 为 `e75c61ff9de42fac006fd992cd4a909871865fb7a7e9169db7fcb356415a9335`。网站现有阅读器、Spotlight 和扩展中的查词路径仍由各自的现有入口运行。后续阶段按宿主接入此核心。

## 验证

| 检查 | 实测结果 |
|---|---|
| 核心单元与集成夹具 | `npm --prefix packages/lookup-core test`，12/12 |
| 重点词形 | incurred → incur；running → run；went → go；better → good / well；phenomena → phenomenon；assumptions → assumption。went、better 的站内精确结果仍列入 `lookupWord` |
| 原始站点保护 | `python3 scripts/audit_baseline.py`，22 项命令、3 项产物与冻结检查通过。`content/` 和 `dist/` 与父基线字节一致。逐项核对了辨析 ID、链接、组关系及全部现有多义词 Sense ID 和释义顺序 |
| 网站页面交互 | `python3 scripts/test_integration_browser.py`，Chromium 10/10。旧测试已改为核对 Collocations 的 22 条现有数据及首条文章链接。一次误与网站重建并行的运行出现页面资源加载错误，重建结束后独立复跑 10/10 |
| 平台无关性 | Chromium Headless Shell 151.0.7922.34 和 Linux WebKit 26.5 各用页面 ES module 和普通 module Worker 加载同一源码及数据，验证了重点词形与语境范围。运行 `node packages/lookup-core/test/browser-smoke.mjs`，先生成词库并安装 Playwright 浏览器，可用 `PLAYWRIGHT_MODULE`、`CHROMIUM_PATH`、`WEBKIT_PATH` 指定现有安装 |
| 扩展回归基线 | 现有扩展 `npm test` 32/32。浏览器模块验证覆盖通用 JS 运行时，扩展权限、原生包和实际 Safari 安装转交适配阶段 |

连续查询固定字典、结构异常、完整字节及内容版本完整性、无效更新回退和并发更新顺序均有测试。跨句、多个同形词、重叠表达、NBSP 与 UTF-16 范围有正反例。

## 性能基准

Linux x86-64、Node v24.22.3。以固定候选词典和小型上下文窗口测量。包大小为 1,983,719 字节，gzip 后为 243,528 字节。冷启动已含完整性检查、解析与索引构建，样本为内存中已取得字典字节；热查询使用固定词和短句循环。

| 方法 | 样本数 | 中位数 | p95 |
|---|---:|---:|---:|
| 冷启动 | 30 | 50.42 ms | 112.70 ms |
| 热单词查找 | 10,000 | 0.87 µs | 1.08 µs |
| 上下文匹配 | 10,000 | 31.11 µs | 56.57 µs |

在仓库根目录运行 `npm --prefix packages/lookup-core run benchmark` 复测。数据仅代表该 Linux 样本。设备侧首查、资源读取以及对 iPhone 阅读滚动的影响由接入阶段测量。

## Phase 03 入口

从本候选锁定源码 SHA、词典版本、字节与许可哈希。继续用网站 reader 的受控候选将段落上下文映射到 UTF-16 范围并复核原有释义、锚点、滚动和卡片复用。段落专属义、可分短语及普通连字符变化的覆盖受现有数据与已约定边界限制，未命中使用显式状态或单词回退。若接入失败，回退宿主适配和快照锁到前一版本。用户数据及线上发布遵循 [跨阶段约定](handoff.md)。
