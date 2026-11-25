# Phase 03 · 智能表达识别与语境词义排序

2026-11-25 · **CONDITIONAL PASS**。定向交互和数据保护达到候选要求，可用于后续适配验证。开放域识别仍漏掉多数表达，run 的首选词义准确率低于多数类参照。保留普通词义和可能表达的呈现方式。

## 基线与恢复

网站仓库 `fukai114514-lang/english-vocabulary-notebook` 的独立分支为 `feature/contextual-expression-engine`，直接父提交为已验收的 Phase 02 `6c35477dd72bde37e0e44984c86d995e704228e1`。远端 main 恢复点为 `17795450973b124b22558f0c7d8bca520b4911ef`。用 `git rev-parse HEAD` 在候选签出中取得完整代码提交。词典数据版本为 `627e5c96098567043a2c2eae0175cf6e574a2d9e47bc15c5f430792a8529fa3c`，JSON 字节 SHA-256 为 `cb852c530ef65506be7ac5e32cb3ac1cb0955044ada3ab66086ea0292380d534`。core 0.2.0、schema 1。

本阶段修改范围为 lookup-core、生成目录忽略规则和开发交接文档。生产阅读器及学习栏目与 Phase 02 逐文件一致。Safari 接入归 `fukai114514-lang/taslexicon-extension` 的适配阶段维护，该仓库的工作副本此次用于取得测试依赖。恢复时检出上述 Phase 02 提交，重新构建其词库与清单，停用本地 reader 预览。收藏、文章和网页数据无需迁移。

## 查词接口

```js
const text = 'They put the meeting off.';
const start = text.indexOf('meeting');
const hit = engine.analyzeContext({ text, anchor: { start, end: start + 7 } });
const best = hit.candidates[0];
// best.entry.lemma === 'put off'
// best.surface === 'put the meeting off'
// best.span = {start:5, end:24}; components = [5,8) and [21,24)
// slots[0] = {role:'object', start:9, end:20}
// hit.wordFallback.query === 'meeting'
```

| 字段 | 调用约定 |
|---|---|
| `text, anchor, scope?` | 传入一个可读段落或标题原文。UTF-16 半开区间支持词内光标与单词选择。跨词选择、越界或标点返回空候选。可信 `scope` 包含 articleId、paragraphId。 |
| `sentence` | 句子的原文与其在输入块的起止位置。优先使用英语 Intl.Segmenter，另行处理换行、句末和常见缩写。 |
| `candidates[]` | 按分数列出重叠或竞争表达，每项含 entry、surface、span、components、slots、tokenCount、score、confidence、reason、evidence。span 包括中间宾语；components 仅表示固定词，slots 标明可变成分的原始位置。 |
| `senses[]` | 根据语法、词典释义/例句重合和训练语境返回排序后的真实 Sense ID、出处、score、semanticClass 和 evidence。相同分数延续原序。分数用于本次排序。 |
| `wordFallback` | 保留 Phase 02 普通查词结果，含所有本地已收录义项及 `not-listed`。客户端可同时呈现表达义和单词义。 |
| 置信状态 | `supported` 允许优先提示；`possible` 列出建议和匹配理由；`unresolved` 表示词义缺少语境证据。置信等级没有概率校准。 |

## 匹配与模块

- `sentence.mjs`、`tokens.mjs` 保留原始字符范围。以规范化词形查询静态本地索引与按首词建立的构式索引。语法引擎跨最多 16 个词，名词槽最多 5 个词；标点、换行和块边界阻断表达跨度。
- `constructions.mjs`、`pattern-matcher.mjs` 覆盖固定表达、搭配、习语、短语动词、词形变化、宾语可分和有限的非连续句型。11 个签入的构式带独立编写的双语识别说明，运行时只读。另从 OEWN 摘取 2,949 个二至四词词面，与专用规则按词元去重，词形条目和 2,427 个名词语义提示均可从固定源包生成。
- `index.mjs` 综合段落标注、文章搭配、构式完成度、词形与来源。优先分依次可为 100、92、84–89、80 等；有方向歧义或词典证据偏弱的条目降为 possible。共享核心用临近词与释义/例句的重合或独立语料标注频数支持普通词典匹配。频数门槛至少 3 个实例，标注比例至少 80%。同分才比较长度，同等级异义竞争标为可能。
- `sense-ranker.mjs` 用主语语义类、直接宾语、距离和空间补语区分 run 的常见用法；用 bank 修饰 account 识别银行义，take … into account 则优先呈现构式义。释义和例句重合可用于其他收录词；run 有分文档训练的 SemCor 词项统计回退。语法证据和相对分差控制 supported。
- `reader-adapter.mjs` 将词按钮或单词选择映射回块中原始位置，复用原查词卡并显示词组、单词、备选及依据。只有 supported 表达自动标出。用 `npm --prefix packages/lookup-core run reader` 生成预览，在仓库根运行 `python3 -m http.server 8000 --directory build/context-reader`，打开本机的 vpn-privacy.html。引擎本身仅接收字符串；预览从同源读取词典和清单，匹配全程离线，无正文上报、账户、录音或 LLM 依赖。

## 独立测试与误差

| 样本与计分 | TP / FP / FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| 定向人工金标，70 个表达、43 个负例，所有标注组成词均须正确 | 70 / 0 / 0 | 100% | 100% | 100% |
| STREUSLE 完整 test，535 句、364 个表达，自动提示 | 17 / 0 / 347 | 100% | 4.67% | 8.92% |
| 同一完整分区，连可能提示也计入首选 | 57 / 62 / 307 | 47.90% | 15.66% | 23.60% |

定向正例实际只覆盖六种词元，pick up 占 40/70；43 个普通词与易混词均未触发自动判断。开放分区的 100% 精确率仅基于 17 个自动提示。遗漏的金标包括 reviews-002317-0001 的 telephone number、reviews-002317-0003 的 thank you、reviews-011806-0002 的 Karol Bagh。允许可能提示后，reviews-005760-0003 的 bring out 和 reviews-025894-0003 的 one time 出现词典命中与原上下文人工分组不一致。其词形本身不足以确认该处构成表达。

SemCor 四类 run 金标共 76 条。首选排序正确 19 条、错误 43 条、弃判 14 条，全样本词义匹配率 **25.00%**，多数类基线为 **32.89%**。语法证据足以优先展示的有 8 条，其中 7 条正确、1 条错误，覆盖率 10.53%，其余 68 条仅显示候选或普通释义。按金标，受支持的正确数为 motion 1/25、operate 1/11、extend 3/21、manage 2/19。br-c15.xml 第 89 句的 extend 被错判为 motion，说明距离补语也可描述延伸。19/76 是开放排序结果，7/8 是小样本条件正确率，两者不可互换。

独立的 31 项 Node 测试另行验证十个指定表达的每一个组成词（光标和选中均测）、四种 run 语境、两种 account 语境、边界、词形和旧接口。网站静态门禁通过，Chromium 网站交互 10/10。Chromium Headless Shell 151.0.7922.34 与 Linux WebKit 26.5 的页面和 module Worker 验证通过；两者的预览阅读器均验证原文 rolled back、分离宾语测试夹具、普通词回退、关闭、复用、滚动位置和同源请求。选词通过原生 Selection API 构造并派发手势事件。真机长按、VoiceOver、浏览器品牌安装及扩展宿主仍待验收。

## 性能与交接

Linux x64、Node 24.22.3。已取得字典字节时的冷启动含哈希、解析、结构验证和建索引，30 次中位 132.39 ms、p95 279.83 ms。完整 JSON 4,483,429 字节，gzip 521,751 字节，5,517 条目、6,781 义项。定向真实语料 286 次单锚点分析的中位 0.091 ms、p95 0.429 ms；短句循环 10,000 次中位 0.014 ms、p95 0.036 ms。普通词热查询中位 0.87 µs。以上计时不含网页加载、手势、布局和真机首查。

下一阶段进入条件由职责承担者分别验收：

1. 语料维护者增加独立领域及未看过的文章级留出集，覆盖每一种目标构式和字面反例；扩充普通词、长间隔、协调嵌套、被动和语义歧义。当前规则不能普遍解析开放式槽位、跨句表达、长距依赖或全部命名实体。
2. NLP 维护者改进开放表达召回和词义排序，在新留出集上复算 P/R/F1、弃判率、各类准确率，并与多数类参照比较。达到双方约定的质量门槛之前，低置信义项保留为可选项。
3. 宿主维护者按固定 commit、manifest 和三个许可文件接入候选。Safari、iPhone 真机及其他浏览器扩展分别实测选词、UTF-16 范围、编辑区和 frame 边界、无障碍、冷启动与本地数据完整性。发布另行授权。

[语料、许可与复测命令](../../packages/lookup-core/evaluation/README.md) · [原始计分](../../packages/lookup-core/evaluation/results.json) · [开放分区与误判定位](../../packages/lookup-core/evaluation/open-results.json) · [性能数据](../../packages/lookup-core/evaluation/benchmark.json) · [跨阶段开发约定](handoff.md)
