# 3.0 审计 · 2026-11-01

GitHub main: dd2382c26778e48e67c856c21b501d724e49a061；工作树干净；完整历史4个提交；无既有标签。已读取 README、PROJECT_AUDIT、DUAL_DEPLOYMENT、GITHUB_PAGES、发布记录、生成器与验证脚本。

架构：Python 标准库生成静态 HTML，内联 CSS/JS，hash 导航；content 为内容源，dist 为产物，migration 哈希锁，scripts 验证，唯一 Pages workflow。app.js 是已停用的旧学习系统，不启用。

基线：113组、277分组词条、272唯一ID；62词352义项；A—T20段、32阅读词汇、33短语。原 SHA-256 校验通过。源文件清单见备份 tar 与 migration/content-baseline.json。

Sites 原项目第17版，源码 HEAD 8ddc834b79351c69582a83f17b7dd65855703792。官方返回 current_live_url 为 https://vocab-notebook-20261021.fukai114514.chatgpt.site，与历史 abloomfawn22 地址不同；未主动修改域名。Sites 独有5个源文件修改；逐义项多重集完全相等，仅排序；文章原有所有字段完全相等，新增20段译文；另有 Part 标题及界面清理。机器差异见 sites-diff.json。不能以 GitHub 旧版本覆盖 Sites。

备份：两仓完整 Git bundle（verify 成功）；GitHub bundle 已克隆恢复并确认 HEAD；源包含 content/dist/migration/scripts/.github/部署文档/发布记录，Sites 包含原 hosting 身份。仓库外归档 Vocabulary_Notebook_3.0_Preupgrade_Backup.tar.gz 已独立保存，附各包 SHA256SUMS。备份是修改前制作。

Pages 原地址 HTTP 200，浏览器已加载首页。发布设置、最新运行 SHA、所有交互仍需进一步核查，不能仅据此批准生产发布。

拟修改：合并上述5个文件的已识别增量；新增搜索生成器/JS/CSS、稳定义项元数据、阅读交互、语义保护清单、PR检查及部署健康检查。原语料保持受保护；不刷新全部哈希。

风险：Sites 排序尚无逐词词典证据；译文未人工复核；原文 O 段重复保留；真实 iPhone Safari/发音需人工验收。任何未过检查的构建不得合并发布，Sites 保持现状。
