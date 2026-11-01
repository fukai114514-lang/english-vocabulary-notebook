# 双站部署与同步约定

唯一维护来源：https://github.com/fukai114514-lang/english-vocabulary-notebook （Public，经用户选择）。

- A：https://vocab-notebook-20261021.abloomfawn22.chatgpt.site
- B：https://fukai114514-lang.github.io/english-vocabulary-notebook/

GitHub main 自动部署 B。A 使用 Sites 自身源仓库；当前接口不提供绑定此 GitHub 仓库的持续自动部署。A 是发布副本，不接受独立内容维护。没有建立双站自动同步。

## 每次更新

1. 从 main 建功能分支，仅修改这份 content。保存旧版本 Git SHA；不要重写历史。
2. 运行 `python3 content/render.py` 和 `python3 scripts/verify_migration.py`。基线锁定全部现有源文件和输出；修改内容需逐项审阅差异后才可更新 migration/content-baseline.json，不可为消除失败而盲目刷新。
3. 合并 main，等待既有 Pages 工作流成功。下载并独立保存该次 `source-backup-<SHA>` 工件；工件保留90天，不是永久备份。
4. 检查 B：Part切换、英文/中文搜索、展开收起、113张对比表、午睡文章A—T锚点、手机横向表格、语音按钮。语音取决于设备音色。
5. B 验收失败：停止，不动 A；在 GitHub revert 该提交，使 B 回到上一正常版本。
6. B 验收通过后，请 Codex“将 GitHub 指定完整提交 SHA 同步到现有 Sites 项目 appgprj_6ad839362bf88191b072fd0e000203f7”。先读取 A 最新源仓库和版本并独立备份；比较 content 与 dist，发现独立编辑立即停止，先合并到 GitHub。不要拿旧归档直接覆盖。
7. 在临时工作副本检出这个 GitHub SHA，构建、运行完整性校验。将同一 content、dist 同步到 Sites 工作副本；保留 A 原有 .openai/hosting.json 项目身份、备份、Git历史和其他非发布文件。凭据仅通过官方 helper stdin，禁止提交到 GitHub。按 Sites 官方 source helper 提交、打包、保存版本并发布现有 A 项目；禁止新建替代站。
8. 运行 `python3 scripts/verify_sites.py`，三份公开资源必须两站都逐字节等于本地构建。它校验数量、全部数据与页面实现一致，不能替代浏览器交互检查。随后在两站重复第4步，记录 GitHub SHA、Sites版本号、检查结果及日期于发布记录。
9. A 更新失败保留 B；A 发布后发现问题则部署 A 前一保存版本。两站分开回滚，不同时发布未经验证的修复。

## 数据基线

113组 / 277分组词条 / 272唯一词条ID；多义词62词 / 352义项；午睡文章20段（A—T）、32词、33短语。已有逐词释义、例句、表格由完整性脚本检查。备份需包含 content、dist、migration、scripts 和 Git 历史；另存于仓库之外，不能只依赖 Actions 工件或同仓库备份。

## 首次审计 2026-10-29

GitHub初始提交 b9f17846c5766778cceada72fb6d26e64b77d06b；A审计源提交 d5acfc0932f1701277557ad47a05c61b26a3faf6，线上版本14。两者词汇和文章数据一致；GitHub迁移版本多了跨Part锚点恢复脚本，A 尚无此脚本。因此初始状态不能宣称功能完全一致。已有 Pages 工作流运行成功；不新增重复工作流。

## 3.0 候选版发布门槛（2026-11-01）

当前改动仅位于 upgrade/3.0-safe-20261101；未合并 main、未发布任一站。Sites 原项目已到17版，源 SHA 8ddc834b79351c69582a83f17b7dd65855703792；其独有排序、译文、标题与界面增量已先回收至功能分支。官方当前 live URL 为 https://vocab-notebook-20261021.fukai114514.chatgpt.site，旧文档地址不在本次主动更改范围内。两种地址的公开资源读取均403，不代表源码不可获取；不能声称两站线上一致。

发布前执行：

```sh
python3 content/render.py
python3 scripts/verify_migration.py
python3 scripts/verify_upgrade.py
node --check content/search.js
node scripts/test_search.cjs
git diff --exit-code -- dist
```

保留 migration/content-baseline.json 原始哈希。reviewed-changes-3.0.json 仅列明确审阅的8个既有文件新哈希；verify_preservation.py 同时逐字段锁定原 groups/words、按多重集锁定全部原义项、逐字段锁定原文章。未来修改必须新增具体差异证据，不能把 baseline、快照或审阅清单当作消除失败的按钮。

CI validate.yml 在PR/功能分支运行；pages.yml 保持唯一生产工作流，新增索引检查、完整备份范围和上线资源SHA检查。建议管理员在 main 设置至少一个PR审核与 `integrity` 必要检查；本次没有配置该设置的原生工具，没有更改仓库保护状态。合并前应完成移动端交互与内容复核，并记录验收结论。

上线后先确认 GitHub workflow 的 SHA，再运行 `python3 scripts/check_deployment.py https://fukai114514-lang.github.io/english-vocabulary-notebook/`，在浏览器检查搜索、锚点、发音与阅读。保存完整SHA及外部备份。任何失败停止 Sites 发布。

Sites 同步仍为官方工具驱动的受控手动流程，不是 GitHub 自动同步。发布前重新读取最新源码和版本；只将审核提交的内容和构建产物合入原项目，保留原 .openai/hosting.json、项目身份和历史。若出现新差异先对账。verify_sites.py 现在比较 dist 中所有文件，包括文章数据、搜索索引与JS/CSS；403如实记为未验证。

回滚：功能分支可关闭PR，生产站完全不变。若之后合并且上线失败，在 main 正常 revert 该合并并重新部署，禁止 reset/force push。Sites 只部署原项目上一正常保存版本；禁止同时覆盖两站。
