# English Vocabulary Notebook：发布前最终验收

日期：2026-11-10。结论：**CONDITIONAL PASS**。

在本次实际执行的 Chromium、静态构建和内容保护范围内，没有剩余已知发布阻塞缺陷，可进入受控发布准备。不能据此宣称 Safari/VoiceOver/真实语音已通过，不能宣称 A/B 已同步，也不构成合并或部署指令。本轮已停止在功能分支，没有合并 main、触发 Pages 或发布 Sites。

## 审查对象与证据

- 功能分支：`audit/apple-ui-baseline-20261109`。
- 原始 main：`b2e55d047e53b1183a30c8dc0cdea818b7df1b0b`。本轮重新 fetch origin/main，仍是同一 SHA。
- 审查起点及修复前恢复点：`11c735c113516b3c308adcf4304f681a1ae473d6`。
- 对比范围：原始 main → 审查起点的全部 40 个文件，再单独审阅本轮搜索修复、回归和部署文档改动。
- [完整文件差异清单](final-review-upgrade-diff.txt)、[本轮机器可读验证证据](final-review-validation.json)、[独立内容比较程序](../scripts/verify_release_diff.py)、[完整浏览器回归程序](../scripts/full-qa.html)。证据记录 dist 全文件 SHA256 和浏览器测试程序哈希。
- 浏览器证据保存的是实际观察到的汇总值与复现状态；没有导出完整逐步录像/trace。审查未直接采信此前“通过”的文字结论。

## 全部实际变更分类与当前架构

仍为 Python 标准库多阶段静态生成、原生 HTML/CSS/JavaScript、签入 dist 的架构，无新前端框架、第三方运行依赖或数据服务。

| 变化范围 | 实际变化与判断 |
| --- | --- |
| `content/search.css` → `dist/search.css` | 全站浅/深/系统主题 tokens、组件状态、手机卡片、导航、桌面宽度、阅读器和词典；仍有阶段性覆盖，非完全消除重复 |
| `content/interface.js` → `dist/interface.js` | 主导航与搜索分离、滚动恢复、对比表展示切换、表格 ARIA、动态顶部/视口边距、共享界面文案 |
| `content/reader.js` → `dist/reader.js` | 同一个非模态词典、稳定底部/定位浮层、键盘逐词选择、焦点恢复、阅读字号持久化、语音状态；上下文优先级未改 |
| `content/search.js` → `dist/search.js` | 界面标签、IME/快捷键保护；本轮补齐跨页搜索退出清理。匹配规则和索引未变 |
| `content/interface.py`、`english_ui.py`、`theme.js`、新 `ui-labels.json` | 界面文本集中、学习子树保护、生成时注入文案、文章 h1 层级；尚非所有英文都集中到目录 |
| 五个独立文章 HTML | 标题 h2→h1；nap 的一条统计界面文案英文化。无原文、译文、释义变化 |
| `.github/workflows/validate.yml` | 完整离线门禁及证据上传。生产 `pages.yml` 未变 |
| 22 个新增 docs/scripts 文件（起点范围） | 审计冻结、阶段报告/JSON、构建/路由/颜色/文案校验、浏览器测试；逐文件见差异清单 |
| 本轮追加 | 搜索修复；full-qa 新增6项断言并移除从未写入的 focusFailures 字段；独立 Git/HTML 比较；部署文档纠错；最终报告和证据 |

`content/base.html`、核心 `render.py`、`app.js`、`pronunciation.js`、全部学习 JSON/TXT、全部 migration 快照均未改。`dist/index.html`、全部生成学习 JSON 和搜索索引也与原始 main 字节相同。

## 学习内容：独立验证通过

不能只用新分支自己的冻结文件证明自己正确。本轮从原始 main 的 Git 对象读取全部 24 个冻结文件，先确认冻结哈希确实属于 main，再与当前文件逐字节比较，全部相同。

此外解析全部六个生成 HTML，逐项比较有序文本片段和有序锚点；唯一允许的差异是 nap 的统计标签：`A—T 段原文 · 32 个词汇 · 33 个短语` → `Original · A–T · 32 vocabulary items · 33 phrases`。六页共 8,977 个文本片段、921 个 ID 保持数量和顺序，没有重复 ID。

结合原有字段/多重集保护、词典和上下文检查，**没有发现本次升级新增的词条/义项/例句/文章/译文丢失、误改、重复或顺序变化**。这不是对原始内容全部语言学正确性的重新认证，也不将原有“段内译文 + 全文译文”的展示方式认定为数据重复。

- 137 组辨析、327 分组词条、322 唯一词条 ID。
- 75 个多义词、415 个义项。
- 5 篇文章、61 对双语段落；文章词典 1,346 个 token。
- 既有 URL、段落锚点、搜索目标和学习数据保留；未刷新保护基线。

## 发现与修复

| 优先级 | 证据 | 处理及复验 |
| --- | --- | --- |
| P1，发布前修复 | 搜索文章结果→文章→浏览器 Back，原页面恢复 `dialog.open=true`、`body.position=fixed`、`search-open=true`。跨页分支在 close() 前 return，导致缓存保留搜索状态 | 所有搜索导航先 close()，再改变 URL。真实浏览器 Back 后三项分别为 false、空、false；词库→文章及文章→词条两方向回归通过 |
| P2，发布操作文档错误 | DUAL_DEPLOYMENT 顶部 A URL 与后文历史 URL 不一致；113组/62词/三份资源为过期描述；verify_sites 默认 URL 也是历史地址 | 文档明确实时确认现有项目 URL/版本、显式传入 --a、全部 dist 文件校验；更新候选版统计，保留历史章节并标注历史性质 |
| 防御性处理，非已复现 Bug | close 事件可能晚于一次重新打开；本环境快速重开测试本来通过 | close 监听仅在 dialog 已关闭时恢复页面；本轮仍通过。不得将此项写成已复现竞态 |
| 测试证据清理 | 阶段06的 focusFailures 数组只初始化，从未追加 | 删除无意义字段；实际焦点断言保留。数组为空本身不是焦点测试证据 |

未改动视觉设计、学习功能或语料。没有遗留失败的产品回归断言。

## 本轮实际执行结果

| 检查 | 结果和边界 |
| --- | --- |
| 离线门禁 | 18条命令 + 3项门禁全部通过；包含构建、保护、索引/锚点、阅读词典、上下文、界面文案、路由、颜色、6个JS语法、搜索匹配、干净副本构建 |
| 构建复现 | 当前 dist 与重建相同；全新 content 副本生成结果相同；冻结文件不变；git diff --check 通过 |
| 独立 Git/HTML 内容比较 | 24个冻结文件与原始 main 同时核对、6页有序文本/锚点比较通过 |
| Chromium 布局 | 90场景：9种视口 × 浅/深色 × 首页/辨析/多义词/阅读目录/nap文章 |
| 全量条目与文章 | 424次展开/关闭；5篇文章 × 4视口 × 3主题=60组；每段首末词共1,464次查词打开/关闭检查 |
| 最终浏览器总计 | **6,999项断言通过**。无被测页面横向溢出；被捕获的交互错误为空。包含焦点、面板范围、连续选词复用、关闭/翻译/阅读位置、End可见性、导航Back/Forward、搜索键盘、主题刷新/跨页保持 |
| 视口 | 320×568、375×667、390×844、430×932、844×390、900×800、1024×768、1363×936、1728×1117；iframe实际内容宽度可能因15px桌面滚动条而略小 |
| 项目子目录兼容 | 根路径和模拟子目录的34个HTTP资源/哈希检查；子目录导航和词典加载通过。HTML仅剔除已确认的预览热重载注入再比哈希 |
| 静态链接/颜色 | 6页78条本地链接、24个资源引用；48组固体颜色对比度通过。不是所有运行时透明叠层的 WCAG 完整审计 |
| 额外人工浏览器检查 | 实际点击搜索结果和浏览器 Back 复现/复验；目视桌面首页、390px深色展开卡片、320px浅色阅读词典 |

批量测试运行于真实 Linux Chromium，但主要通过页面内 DOM click/合成键盘事件驱动，不是物理触屏或 Safari 模拟器。加载后才安装的交互 error/rejection 监听，不能证明所有启动异常与未执行路径不存在错误。浏览器日志抽样出现扩展自身错误，未看到应用错误。

## 阶段06证据复核

此前的90/424/60/1,464/6,993计数与脚本结构匹配，本轮同套基础流程再执行成功，新增6条搜索断言后为6,999。此前两项 reader 修复仍存在于代码，浮层边界和 End 焦点断言继续通过。

需要收窄的说法：1,464不是“每一个英文 token 都查过”，而是全部段落的首末词；连续切词另有专门样例。系统主题测试只验证当前浏览器偏好与持久化，并没有操作真实 OS 明暗切换。朗读仅有触发/错误反馈证据，没有真实发声成功证据。原阶段06已明确这些环境限制；本轮没有把它们升级成通过。

## 设计、维护性、性能与兼容性判断

参考 Apple HIG 的 [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)、[Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) 和 [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)。Apple 将玻璃材料用于导航/控件层、强调内容与功能层分开；这里仅借鉴原则，不声称实现了原生 Liquid Glass。

已证实的改善：共享配色/字体/间距、显式与系统深色一致；手机主导航与 Search 分离，aria-current 表达当前位置；导航触控矩形至少44px；对比表在手机纵向呈现而不复制内容；正文约62ch、可调17/20/23px；正文和词典使用实色阅读底；同一个词典更新内容，开关保持阅读位置；焦点样式、Escape、逐词键盘选择和 Reduced Motion 分支可查证。

剩余非阻塞事项：

- **目标设备风险**：iPhone/macOS Safari、真实触屏、地址栏/键盘变化、安全区、VoiceOver、OS Reduced Motion/主题即时切换、实际声音均未验证。代码有 visualViewport、safe-area、reduced-motion 处理；代码存在不等于设备行为正确。旧版浏览器的 dialog/ResizeObserver 等 API 无完整降级。
- **CSS维护债务**：约1,839行追加/格式化，后部阶段03/04/05覆盖前部组件规则，部分 !important 保留。当前矩阵没有发现冲突，但未来修改需注意级联顺序；本次不做高风险大清理。
- **性能债务**：index仍632,522字节（gzip约134.5KB），search-index仍716,684字节（gzip约158.4KB）；搜索仍全量扫描并渲染命中、reader仍逐词创建按钮。CSS由23,981→44,480字节，gzip约5,994→9,147。无低端设备性能测量，不把“无依赖”当成“性能已达标”。
- **事件/布局成本**：词典的 scroll/visualViewport/ResizeObserver 会读写布局；当前检查未发现持续循环或重复绑定引发错误，但未做帧耗时/内存剖析。Search并发首次加载没有共享 in-flight 请求，极快重开可能重复下载；非阻塞。
- **UI集中度**：新catalog改善维护，reader/pronunciation/interface仍有少量硬编码英文；翻译器还有基于文本匹配的fallback。当前所有生成文本通过原始main比较，不代表未来新学习文本与UI词碰撞可自动安全处理。
- **小屏词典信息密度**：320×568下稳定底部面板内部需要滚动才能看到部分释义；关闭按钮始终可达。不是已验证的遮挡/丢失，但真机可用性应复核。
- **无障碍边界**：固体色对比、显式焦点、表格role和逐段单Tab停靠有证据；没有全面读屏、200%缩放或每个控件触控尺寸认证。不能称为WCAG全面合规。

## 发布路径与阻塞判断

Pages维持唯一工作流：main push或手动workflow_dispatch，Python3.12构建dist，使用相对资源与hash导航，无需SPA重写。本轮未改生产workflow。功能分支/PR的 validate 完整测试比 Pages 子集更广，发布时必须核对**同一最终SHA**的完整验证结果；仓库保护规则是否强制执行未确认，不能假定CI通过就会自动阻止错误合并。

A由Sites独立源仓库手动同步，不能推定main更新后A会更新。本轮未读取/发布A的新版本、未测试新候选版线上A/B一致性。后续发布步骤必须确认A项目/版本/URL、先备份、再用同一验收SHA构建，线上逐文件校验。历史URL不可直接覆盖。真实线上一致性属于发布后的验收，不是本轮离线检查的通过项。

当前没有已知未修复P0/P1代码阻塞。**CONDITIONAL PASS的条件边界**是：接受上述明确未验证的平台风险后，才进入下一阶段的受控发布操作；若要求“已证实iPhone/Mac原生体验、全平台无障碍、双站线上一致”，现有证据不足以给PASS。发布前目标设备冒烟仍建议完成；任何数据/构建失败、实际设备关键流程失败、SHA变化未复验、A目标不明、构建或线上哈希不一致，都应立即阻止相应发布/同步。

本轮恢复点为审查起点Git提交，所有修复单独提交在功能分支；原始main和线上站点保持不变。历史外部bundle没有在本轮重新恢复演练，不把历史备份存在当成本轮恢复测试通过。

## 重复执行

```sh
python3 scripts/audit_baseline.py --output /tmp/release-validation.json
python3 scripts/verify_release_diff.py
python3 scripts/prepare_full_qa.py
# 本地静态预览 __qa.html，点击 Run regressions；运行中不要写文件或重新构建。
python3 scripts/prepare_full_qa.py --clean
python3 scripts/audit_baseline.py --output /tmp/release-validation-clean.json
git diff --check
```

独立Git比较需要原始main对象；浅克隆先fetch该提交。本轮补测使用的临时HTML已清除，未进入dist发布产物。完成审查并停止，不自动进入发布。
