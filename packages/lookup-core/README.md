# TAsLEXICON Shared Lookup Core

依赖为零的 ECMAScript 模块。网站和扩展从同一份源码、词典和测试夹具消费。当前候选使用 core 0.1.0、schema 1，适配阶段可以按需加载。

## 构建与测试

在网站仓库根目录运行以下命令。需要 Python 3 和 Node.js 22+。

```sh
python3 content/render.py
npm --prefix packages/lookup-core run build
npm --prefix packages/lookup-core test
npm --prefix packages/lookup-core run benchmark
```

构建写入 `build/lookup-core/`，包含 `lookup-dictionary.json`、`lookup-manifest.json` 和 `OEWN-LICENSE.md`。应用宿主读取这组生成物。源码构建使用仓库中固定的词库摘录，可断网执行。生成器可以接收任意已生成的站点目录和单独的输出目录。

## Dictionary Schema v1

| 层级 | 字段与含义 |
|---|---|
| 词库 | `schemaVersion`、`dataVersion`、`sources`、`entries` |
| 条目 | `id` 是稳定键，`lemma` 保留来源显示形式，`kind` 为 word 或 expression，`category` 记录源栏目，`groupIds` 保留辨析组关系，`inflectedForms` 记录匹配键，`morphologySourceId` 记录词形数据来源 |
| 条目位置 | `scope` 为 null 或 `{ articleId, paragraphId }`。段落标注和文章搭配的语义由对应段落提供 |
| 条目发音与关联 | `ipa` 是 `{ accent, value }` 数组，`relatedWords` 来源于原条目或同组词 |
| 义项 | `id`、`partOfSpeech`、`ipa`、`definitionEn`、`meaningZh`、`examples: [{en, zh}]`、`collocations`、`relatedWords`、`usageRegister`。未收录文本为 null，未收录列表为空数组 |
| 出处 | 条目和义项均带 `provenance: {sourceId, file, recordId, href}`。网站 href 是保留原锚点的相对链接，Wordnet recordId 使用固定版本 WNDB 词性/位移 |
| 来源目录 | `sources[sourceId]` 含名称、URL、许可和随包 notice；网站原数据的未声明许可标为 null |

现有 Phrases 保留原 ID，Word Meanings 保留每个 Sense ID 及原顺序。比较记录使用原组 ID 和原词 ID 的组合，保留同一个词在不同组里的释义和链接。原始正文、词条附注、分类页面与完整记录继续由现有生成器维护，派生词典只投影查词字段。无现成 ID 的来源按原文键或段落 ID 加词面建立稳定键。站点其他学习栏继续沿用各自的数据结构。

Open English Wordnet 2025 提供站点词表的 POS/不规则词形元数据，并补足 incur、phenomenon、assumption、well 的英文义项。发行源压缩包 SHA-256 为 `38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93`。需要刷新词形或重建摘录时，先生成网站，再运行 `python3 packages/lookup-core/import-wordnet.py <official-wndb.zip>`。摘录转换字段、保留例句与上游标识。CC BY 4.0 和 Princeton WordNet 通知随词库交付。发布时保留完整 notice。 [上游发行版本](https://github.com/globalwordnet/english-wordnet/releases/tag/2025-edition)

## API

`index.mjs` 导出 `coreVersion`、`schemaVersion`、`normalizeToken`、`validateDictionary`、`createLookupEngine` 和 `createDictionaryStore`。通常由宿主读取本地字节及锁定清单，然后用 store 验证和安装。已有受信 JSON 的测试可用 `createLookupEngine(json, options)` 直接进行结构验证并创建 engine。

| 接口 | 返回 |
|---|---|
| `normalizeToken(text)` | 小写单词、货币标注或缩略词键。支持大小写、边缘标点、Unicode 引号、连字符和 NFC。无可用单项时返回 null |
| `engine.lookupWord(text)` | `{ status, query, matches }`。保留精确词面和词形候选，精确结果在前。每个 match 包含不可变 `entry` 和 `reason`，义项保留原顺序 |
| `engine.lemmatize(text)` | `{ status, query, lemmas }`。词形还原候选在前，已有精确词面随后，去重。同形歧义可有多个词元，例如 better 的 good、well、better |
| `engine.lookupExpression(text, scope?)` | 同查词结果结构。段落义随可信 scope 返回，再列通用表达及有证据的词形。无匹配时 `status: 'not-listed'` |
| `engine.getRelatedEntries(entryId)` | 根据现有相关词和分组关系返回收录条目。调用方使用查词结果的 `entry.id` |
| `engine.getContextualCandidates({windowText, anchor, scope?})` | `{ status, candidates, wordFallback }`。每项候选含 `entry`、`reason`、`span`、`surface` 和 `tokenCount`。首项是优先结果，其余包含重叠或并列候选 |

单词的 `status` 为 `found` 或 `not-listed`，非法输入的 `query` 为 null。语料缺少时直接报告未收录。词形规则须匹配已收录且具对应词性的词元，覆盖常见规则与不规则变化、复数、时态、分词、比较级和常见连字符形式。词表、词性及经过确认的形态规则决定实际覆盖率，同形义项由调用者呈现为备选。

上下文窗口最多 256 个 UTF-16 单元，anchor 与 span 均是以原始窗口为准的半开区间 `{start, end}`。锚点可为词内光标位置，或位于单个词中的非空选择。匹配只检查锚点左右各 8 个词。标点和换行阻断匹配，NBSP 与普通词间空白可连接同一表达。候选依次按段落标注、来源明确的文章搭配、通用精确表达、通用词形排序，同层级长匹配优先。网页适配器负责在编辑区、隐藏区、不同块、链接、控件和 frame 边界停止采集，以及把 UTF-16 范围再映射到原始位置。普通行内标签的相邻文字可以用同一文本窗口传入。

```js
import { createDictionaryStore } from './packages/lookup-core/index.mjs';

const store = createDictionaryStore(async (bytes) => {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...hash].map((value) => value.toString(16).padStart(2, '0')).join('');
});
const result = await store.install(dictionaryBytes, pinnedManifest);
if (result.status === 'installed' || result.status === 'unchanged') {
  const { candidates, wordFallback } = result.engine.getContextualCandidates({
    windowText: 'Things improve over time.',
    anchor: { start: 20, end: 24 },
  });
  // candidates[0].entry.id === 'phrase-over-time'
}
```

## 版本、校验与更新

- Core 使用 SemVer。架构约定中的查词接口、结果顺序或偏移量变动按不兼容变更处理。Schema major 与 core 独立更新。
- `dataVersion` 对 schema、来源及按稳定顺序排列的内容求 SHA-256。manifest 同时记录完整字节长度、字典 SHA-256、输入 SHA-256、词条/义项数量和 notice 哈希。Git 锁定候选的完整提交 SHA，构建时核对这些指纹，随包固定源码、manifest、数据和许可。
- `createDictionaryStore(digest, {cacheSize})` 使用调用者提供的 SHA-256 函数，先校验字节，再校验 JSON 结构、版本、条目与 Sense ID 唯一性。清单来自随包锁定版本或等效受信渠道。空 store 的 `current` 为 null，可据此呈现词库不可用。
- `install` 返回 `installed`、`unchanged`、`invalid-data` 或 `superseded`。更新成功会原子替换当前引擎与查询缓存，无效更新保留最后可用快照。后发安装请求优先。回退时重新安装上一组已核对的 core、清单、词库和许可。
- 每个快照默认以 256 项 LRU 缓存规范化单词查询，包括未命中项。`cacheSize: 0` 可关闭缓存，正文窗口即时处理。网络、持久化和重新获取由宿主处理。
