# 可复现的人工金标与计分

金标来自公开语料的独立人工标注。上游标注者没有为本项目验收例句打分。仓库保存原始句 ID、词元、所点位置、标签及句子哈希。用固定源包重建上下文。指定的十个功能例子和反例只在 Node 夹具中使用。

| 来源 | 输入及用途 |
|---|---|
| STREUSLE v5.0 | Nathan Schneider 与合作者标注的英语网络评论。固定在提交 `8ba61fe4f216e7967500a862554a4fff79d25f5d`。读取 strong/weak MWE 的 lexlemma 和 toknums，单独标记未参与任何 MWE 的普通词和易混词。测试索引、统计衍生物适用 CC BY-SA 4.0。[上游及贡献者](https://github.com/nert-nlp/streusle/tree/8ba61fe4f216e7967500a862554a4fff79d25f5d) · [随包署名与许可](../data/STREUSLE-LICENSE.txt) |
| Princeton SemCor | NLTK 分发的 semcor.zip，SHA-256 `126fa2e829ab63edd5b3fd9de45ef1d60d6880e01e25abc55b5ac7918a824655`。用手工词义键 lexsn 和 OEWN index.sense 映射 run 的动词义；多词范围来自原始下划线标注。[固定校验的源包](https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/semcor.zip) · [许可](../data/SEMCOR-LICENSE.txt) |
| Open English Wordnet 2025 | WNDB 包 english-wordnet-2025.zip，SHA-256 `38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93`。用于词义 ID、释义、例句、词性与上下义关系。[源版本](https://github.com/globalwordnet/english-wordnet/releases/tag/2025-edition) · [许可](../data/OEWN-LICENSE.md) |

## 复测

在仓库根目录准备上表三个原始输入。训练产物已随仓库固定，复测无需重新拟合。

```sh
git clone --branch v5.0 https://github.com/nert-nlp/streusle /tmp/streusle
git -C /tmp/streusle rev-parse HEAD
python3 content/render.py
cd packages/lookup-core
python3 evaluation/prepare.py /tmp/streusle /tmp/semcor.zip /tmp/english-wordnet-2025.zip /tmp/phase03-gold.json
node evaluation/score.mjs /tmp/phase03-gold.json
node evaluation/open-test.mjs /tmp/streusle/test/streusle.ud_test.json
npm run build
npm run benchmark
```

在同一目录可以独立再生派生数据。先运行 `python3 import-wordnet.py /tmp/english-wordnet-2025.zip`，再分别运行 `import-expressions.py` 和 `import-noun-classes.py`，参数相同。SemCor 词义模型用 `python3 evaluation/train-run.py /tmp/semcor.zip /tmp/english-wordnet-2025.zip` 生成。用 `python3 evaluation/train-expressions.py /tmp/streusle` 重建表达标注频数。

## 抽样、去重和分母

- 定向集由脚本按固定词元和原始顺序抽取，完整规则在 [prepare.py](prepare.py)。[gold.jsonl](gold.jsonl) 固定 189 条标注，包括 65 个连续表达、5 个非连续表达、18 个普通词、25 个易误判词和 76 个 run 动词义项。每条保留来源定位及 UTF-16 范围。将上游分词用单空格拼接后计算哈希，计分时逐项核对。
- 70 个正例分布为 pick up 40、by no means 15、take into account 11、put off 2、bank account 1、take for granted 1。每一处必须从**全部金标词**返回同一个首选词元与完全相同的 lexical components，忽略空槽中的词。词元或范围错误同时记一次 FP、一次 FN；只报可能时视为放弃自动判断。普通词按一次点击计。十个指定表达另有测试，覆盖包括槽位词在内的每一个词。
- 开放域在 STREUSLE 官方 test 分区的全部 535 句上遍历所有词。每句按词元及各段的位置去重，任一组成词触发即可。完整分区含 364 个唯一表达，包含未收录、地名、多类搭配。分别报告自动识别和允许显示首选建议的结果。开放分区与定向集局部重叠，两者不可合并做总指标。
- run 的金标按固定 WordNet 键映射至 manage、motion、operate、extend 四组。76 条分布依次为 19、25、11、21。排序器允许整个词典的候选（含其他词义和词性）。有证据的首选组正确计 1，错误和弃判均计 0。另报 supported 次数及条件正确率。多数类参照为 25/76。精确细义、其他单词和读者接受度没有独立准确率。
- 词义训练排除整个金标文档和完全相同的句子，收集 63 份独立文档、90 个 run 动词实例。表达使用频数只来自 STREUSLE train，排除定向集和官方 test 的整篇评论及文本哈希相同的句子，剩余 320 篇、2,418 句。词典数据沿用独立编纂的 OEWN；训练脚本和规则均可审查。开发中查看过这些评测结果，下一轮泛化评估须另留未查看的测试分区。

[定向结果与逐例错判](results.json) · [全量评论结果与样例](open-results.json) · [性能原始结果](benchmark.json)
