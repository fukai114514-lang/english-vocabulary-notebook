# english-vocabulary-notebook
Personal English vocabulary learning website

---

# 英语词汇查阅网站

一个简洁的静态查阅网站，保留 113 个原有辨析词组、277 个分组词条，并新增独立的“多义词详解 · 截图收藏”Part（62词）。页面支持 Part 切换、英文或中文关键词搜索、最近更新筛选、折叠阅读、横向对比表、英文释义、英美语音选择与打印。无登录、学习任务或进度要求。

## 本地启动

需要 Python 3：

```sh
python3 content/render.py
python3 -m http.server 8000 --directory dist
```

打开 `http://localhost:8000/`。MacBook Air M1 可直接运行；iPhone 可通过同一网络访问 Mac 的局域网地址与端口。静态发布时上传 `dist/`。

## 目录与数据

- `content/comparisons.txt`：原有词组顺序和逐词对比数据。
- `content/selection-notes.txt`：辨析选择提示。
- `content/english-captions.txt`：英文释义。
- `content/base.html`：原有说明与例句。
- `content/polysemy.txt`：2026-10-28两页截图合并的62个单词；每行保存词性、中文释义、英文释义、例句及译文。
- `content/polysemy.py`：独立 Part 的解析、校验及界面生成；`dist/polysemy.json` 是该 Part 的结构化副本，同时收录于 `dist/vocabulary.json` 的 `parts` 字段。旧 `groups`、`words` 与组号保持原样。
- `content/render.py`：生成 `dist/index.html`，同时复制结构化 `vocabulary.json`。
- `content/pronunciation.js`、`pronunciation.css`：设备语音朗读与样式。
- `content/vocabulary.json`：结构化副本，保存稳定 ID 和组号；目前查阅页面由原有资料生成。
- `PROJECT_AUDIT.md`：升级前项目审计。
- `backups/pre-2.0-source.tar.gz`、Git 标签 `checkpoint-before-2.0`：升级前源文件备份。

## 数据与限制

此前 2.0 试验版曾将学习状态保存在浏览器 IndexedDB；这版不读取、不更改，也不删除已有记录。语音依赖浏览器与设备可用音色；若缺少所选口音，页面会提示。IPA 与未经核实的考试标签暂不显示。内容源于已有笔记与补充草稿，尚需逐词校对。

## 构建与发布

运行 `python3 content/render.py`，将 `dist/` 作为静态目录部署。现有 Sites 项目通过 `.openai/hosting.json` 保持项目身份及原网址。项目没有依赖安装、lint 或 typecheck 命令。
