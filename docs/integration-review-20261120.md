# TAsLEXICON 三分支整合审查

2026-11-20 · 候选分支 `candidate/integrated-upgrades` · **CONDITIONAL PASS**

三项功能均已进入候选版。当前版本通过项目离线门禁和 Chromium 回归，可以交付验收。发布前仍需在 iPhone Safari、VoiceOver 和实际音频设备上验收。生产发布须经站点所有者确认。

## 审查输入

| 分支 | 完整 SHA | 相对 main 的修改范围 | 单独重跑离线审计 |
|---|---|---|---|
| main | `a4a597bc09f4a9e621d1a063e4a7fddb5896f065` | 整合基点 | — |
| feature/example-speech-practice | `da5e917a204412a075198d1d89e266b52b1fa8db` | 25 个文件，语音控制器、MediaRecorder 及页面适配、生成文件、语音测试 | 23 项命令、3 项完整性检查通过 |
| feature/smart-search | `2c23c926fb5680d763aeb2dae5a8ca8006fa6858` | 19 个文件，匹配、分类、分批显示、生成文件、搜索回归和基准测试 | 19 项命令、3 项完整性检查通过 |
| feature/mobile-sidebar | `4a40b1dfa9b2585654c27550491769fe68823d4c` | 21 个文件，响应式侧栏、词典定位、生成文件和三套浏览器 QA | 19 项命令、3 项完整性检查通过 |

三个提交的父提交均为表中的 main。审查核对了 AGENTS.md、分支差异、提交说明与已有测试记录，并在每个输入分支上重新执行了当前适用的审计。此次结论采用整合后生成的测试结果。

## 整合修复

- 三个分支共同修改了 `content/search.css`、生成样式和全部 12 个 HTML 文件。先合并源码，再用项目构建器生成 dist。每个 HTML 相对 main 的字节差异都只在 CSS/JS 的版本查询参数中。
- 朗读与侧栏还共同修改了 `content/interface.js` 和 `content/reader.js`。词典关闭时由共享控制器停止该面板的任务，保留侧栏、安全区和可视视口定位。连续查词、切换 Part、收起正在练习的条目都会清理相应任务。
- 打开 Spotlight 时同步中止活动朗读、录音或回放，关闭查词面板，然后锁定滚动。使用快捷键从词典打开搜索后，Escape 会回到原词并恢复原滚动位置。已完成的本次跟读可以继续回放。
- 阅读器与 Spotlight 共用一个索引请求。即使首个请求仍在等待，两者也只发送一次请求。失败后再次打开搜索可以重试。
- 删除了搜索对可视视口高度的重复监听和重叠的紧凑布局声明。搜索面板避开左右安全区，结果区域可随可视高度收缩。练习下拉框具有明确的英文无障碍名称。
- 搜索沿用 schemaVersion 1 和原有 1,253 条记录。排序依次为精确词条、有效词形、词条前缀、标题、释义、搭配与例句、正文与译文。纠错只提示，首批最多显示 24 项。

## 验证结果

| 层面 | 实际结果 |
|---|---|
| 离线门禁 | Python 3.12.14、Node v24.22.3。`python3 scripts/audit_baseline.py` 的 23 项命令与 3 项完整性检查全部通过。包括原有完整构建和干净目录重建 |
| 搜索与语音 | 门禁内的搜索匹配及弹窗测试通过，含中英文、规则与不规则词形、拼写、分类、排序、快速输入、IME 组合、字面量输入、分页和跨页导航。语音及录音控制器 11/11 通过 |
| 移动浏览器 QA | Chrome for Testing 151.0.7922.34 Headless Shell，84 个布局组合、1,104 项检查通过 |
| 阅读器浏览器 QA | 同一引擎，90 个布局组合、332 项检查通过 |
| 全站浏览器 QA | 同一引擎，90 个布局组合、11,451 项检查通过。包含 534 次条目展开与折叠、11 篇文章的 132 次布局与主题组合、2,448 次查词和 46 次资源哈希检查，记录到的页面错误和全页横向溢出均为 0 |
| 新增交叉交互 QA | `scripts/test_integration_browser.py` 8/8 通过。覆盖搜索中止录音、原生录音与回放完成、音轨停止和 Blob URL 释放、拒绝权限后朗读、词典与搜索焦点及滚动、并发索引与失败重试、旧网址与前进后退、三类资料的练习控件、多义词互斥及横屏安全区 |
| Pages 子目录 | 本地 HTTP 挂载在 `/english-vocabulary-notebook/`。`scripts/check_deployment.py` 读取的 23/23 项资源与 dist 字节相同。另验证了旧 `index.html#nap-A`、段落跳转和历史恢复 |

浏览器尺寸覆盖 320×568、375×667、390×844、430×932、844×390、900×800、1024×768、1363×936、1728×1117。测试包含浅色、深色、跟随系统、Reduced Motion、44px 导航触控区域和键盘操作。跨功能录音使用 Web Audio 合成输入流，通过浏览器原生 MediaRecorder 编码，并用原生 HTML Audio 回放至 ended。语音队列使用可控 Web Speech 测试替身，拒绝权限使用 NotAllowedError 测试替身。

同机交错测量 main 与整合版，12 种查询、每版 240 个预热后样本。匹配耗时中位数从 1.78 ms 降到 0.45 ms，P95 从 4.52 ms 降到 0.84 ms。候选版一次性准备索引耗时 18.67 ms。输入 a 时首批从 1,069 项降到 24 项。以上为本机匹配耗时，未计入键盘输入、网络与绘制时间。

## 数据、历史校验与发布条件

与本轮原始 main 的 Git 对象逐一比较，dist 中 6 个 JSON 字节相同，12 个页面的 1,233 个锚点及其顺序相同，学习数据源和冻结基线均无差异。170 组辨析、90 个多义词的 487 个义项、7 个短语及 11 篇文章保持原样。文章词典覆盖 1,880 个不同英文词形。

单独执行了 11 月 10 日的历史发布比较器 `scripts/verify_release_diff.py`。它固定引用当时的 main，但从运行目录读取冻结清单。在当前 main 和本候选上都以相同的 `Invalid freeze: content/article-dictionary.json` 失败。在该脚本当时审查的提交 `8646f522936969867eec1b2918454be759c33090` 上重跑通过。本轮以当前 main 字节比对和现行审计验证资料完整性，保留该历史脚本及清单原貌。

尚待真机确认的项目包括 iPhone Safari 地址栏和系统键盘升降、VoiceOver 朗读顺序、麦克风系统权限界面、真人录音与扬声器回放、美式及英式系统音色。WebKit 和 macOS Safari 未在本次浏览器矩阵中运行。两个生产站点的上线后哈希校验留待获准发布后执行。

## 变更文件

- `content/` 下的 `interface.js`、`interface.py`、`practice-recording.js`、`practice.js`、`reader.js`、`search.css`、`search.js`、`speech.js`。
- `dist/` 下的 `interface.js`、`pronunciation.js`、`reader.js`、`search.js`、`search.css` 以及 12 个既有 HTML 页面。
- `scripts/` 下的 `audit_baseline.py`、`benchmark_search.cjs`、`full-qa.html`、`mobile-qa.html`、`reader-qa.html`、`test_search.cjs`、`test_search_dialog.cjs`、`test_speech.cjs`、`test_integration_browser.py`。
- `docs/integration-review-20261120.md` 记录本次验收和限制。

## 复现

在仓库根目录运行以下命令。交互测试使用 Python Playwright，支持通过 CHROMIUM_PATH 指定 Chrome for Testing 可执行文件。站点本身未引入这些测试依赖。

```sh
python3 scripts/audit_baseline.py --output /tmp/taslexicon-audit.json
node scripts/benchmark_search.cjs
python3 scripts/test_integration_browser.py
```

三套 HTML QA 分别位于 scripts 目录。使用构建产物的临时副本，通过本地 HTTP 访问。全站 QA 需要 `scripts/prepare_full_qa.py` 所生成的清单和子路径镜像。
