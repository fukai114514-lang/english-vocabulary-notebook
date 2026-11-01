# English Vocabulary Notebook 3.0 候选版验收报告

日期：2026-11-01。结论：功能分支候选版，未批准生产发布；不是双站同步完成报告。

## 已完成并验证

- 读取最新 main HEAD：dd2382c26778e48e67c856c21b501d724e49a061。初始工作树干净、4个历史提交、无原有标签；本地创建 checkpoint-before-3.0-20261101 与功能分支 upgrade/3.0-safe-20261101。
- 读取并审计 README、PROJECT_AUDIT、DUAL_DEPLOYMENT、GITHUB_PAGES、已有发布记录、content/dist/migration/scripts/.github。保持Python静态架构，不启用停用的旧学习系统。
- 备份：GitHub与Sites完整 bundle 均经 git bundle verify；GitHub bundle 已克隆且恢复HEAD相符。源码tar可读取，外部总包含 SHA256SUMS，已保存为 Vocabulary_Notebook_3.0_Preupgrade_Backup.tar.gz。未修改生产源码前制作，未覆盖在线站。
- Sites 原项目第17版源码 HEAD 8ddc834b79351c69582a83f17b7dd65855703792 已读取并独立备份。仅5个源文件不同；352个原义项内容多重集相等，原文章字段完全相等。安全合并增量，未复制旧dist覆盖网站，未改变Sites身份。详见 sites-diff.json。
- 原内容保留：113组、277分组词汇、272唯一ID，groups/words逐字段完全相等；多义词62词/352义项的词性、双语释义、双语例句按多重集完全相等；文章原有全部字段完全相等，含A—T20段、32词、33短语；113张表存在。原SHA基线不变，8个已有文件的许可差异单独记录并同时受语义保护。
- 索引827条：390辨析记录（277词条+113全文补充）、352义项、20段原文与译文、32阅读词、33短语。全部目标锚点存在、无重复ID；全部索引字段在HTML中有对应内容。352个稳定义项ID与排序解耦。
- 文章译文在完整英文A—T之后，20段对应，新增 nap-zh-A…T 锚点，单独 translationZh 字段；原文 O 段重复原样保留，编校说明单独存储。
- 命令实测：render.py、verify_migration.py、verify_preservation.py、verify_upgrade.py、test_search.cjs、node --check、Python compileall、重建后 dist 无差异。
- 浏览器实测（Chrome，1363×936桌面视口）：credit 8条、nap 15条、sleep 25条、学分1条、power nap 3条、brutal 2条；CREDIT同8条；napping有结果；不存在词、特殊符号、恶意HTML均无匹配且未执行。安全DOM节点高亮，无查询innerHTML。
- 浏览器确认“学分”高亮，结果锚点 sense-credit-03，credit自动展开；ArrowDown聚焦结果，Enter打开 group-087；前进后退恢复辨析与阅读Part；62个多义词全部展开/收起；查词卡显示已收录nap释义，关闭返回触发词焦点；引用阅读词汇后后退返回原文 nap-E；英文/译文DOM均20段，桌面无整体横向溢出。
- 原Pages线上3资源均HTTP200且SHA与升级前构建相等，详见 preupgrade-live-resources.json。最新既有Pages运行40868436775成功，对应dd2382c完整SHA，详见 runs-observed.json。这只证明原线上版，不是3.0已上线。

## 已完成但未充分验证

- 新增PR完整性工作流与现有Pages工作流的发布后全资源SHA检查，尚需远端CI执行结果。
- 搜索、轻量查词卡和分组导航已完成桌面浏览器验证；未完成手机视口、Android或真实iPhone Safari测试，未验证设备语音实际播放。
- 多义词元数据包含稳定ID、排序依据、审核状态、语域/地域/搭配等可扩展字段；未知字段为null或空数组，没有伪造资料。现有词级搭配、释义和例句全保留；并非352义项均已补齐新内容。
- 本次继承Sites原有重排，逐词记录了原位置至新顺序。未提供客观词频认证，未把所有排序标记为已审核。
- 原站Pages基本搜索已浏览器确认，设置来源API未能读取（公共请求404）。不能把成功run等同于已读取Settings页。

## 未完成或受权限／环境阻碍

- 未合并main、未发布3.0 Pages、未发布Sites。按用户发布门槛保留原生产站。
- GitHub命令行push缺少凭据；使用已连接GitHub接口创建功能分支及阶段提交，远端SHA与本地提交元数据不同，应以PR完整SHA为发布来源。
- 未配置main分支保护：当前未保护且连接账号有admin，但现有接口未暴露设置操作；只增加CI并提出明确建议，没有擅自更改仓库设置。
- Sites旧记录地址及官方current_live_url的3资源均HTTP403。源码可获取，但未证明公开资源SHA或两个线上站功能一致。官方当前地址与旧记录不同，本次未更改域名。
- 当前工具没有验证过从GitHub到Sites的完整自动发布流程；双站仍须先Pages后Sites逐次人工控制同步。

## 需要人工审阅

- 全部62词/352义项的排序、词性、释义对应、例句自然性、搭配、英美及专业用法。逐词清单见 polysemy-review.md。Cambridge credit与nap搜索可检索，完整页返回403，未据摘要伪造全面审核。
- 20段译文为从Sites保留的完整草稿，明确 needs-human-review；需要逐句核对准确性与专业术语。
- 查词对阅读词优先使用已有阅读释义；其他多义词只列现有候选并说明语境尚未确认，不编造自动词义消歧。
- 真实iPhone Safari、Android、触屏卡片布局与发音；通过前不要将本报告视为生产发布许可。

## 继续执行与回滚

先审阅PR中的源数据/排序差异和上述内容，再完成手机及CI验收。满足条件后正常合并main；等待原Pages工作流，记录完整SHA并浏览器及check_deployment.py验证，独立备份该版本。只有Pages成功才重新读取Sites最新源码/发布版，差异对账后通过官方工具发布原项目。每站独立回滚：GitHub正常revert并重部署；Sites恢复原项目已保存正常版本。当前功能分支可关闭PR，生产无需回滚。

## 本地阶段提交

```text
a7fdc16d3f533b108d895ae36d000321d6fe33ff docs: audit current sources and verify independent recovery backups
cf2c78c4a131d4a689228e195b3c09a0ee4a647b fix: reconcile audited Sites changes without losing original semantic records
47d00126eb81c3ea3c3c1c01b05b00994165acd3 feat: add unified static search, stable sense anchors and article lookup
5458aab010ee8ba842468706ae0fad35be68ac15 test: enforce semantic preservation, index coverage and deployment resource parity
2fbee31019393f6def65122e9ade002393d5764b fix: preserve part navigation and lookup focus across hash changes
c2faec4d5f91791e3e7faf42775b63f4d7c88dda fix: return from dictionary references to the originating article paragraph
```
