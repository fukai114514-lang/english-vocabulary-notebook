# Phase 05 · Dictionary Interface & Interaction Redesign

2026-11-25 · **CONDITIONAL PASS**。网站阅读器和扩展查词界面通过桌面与移动视口的浏览器验收。Safari 扩展安装、设备试听和系统无障碍操作待真机验收。

## 版式与交互

共享实现位于 `packages/dictionary-ui/panel.mjs` 与 `style.css`。主标题、功能标签、细线及正文引用用统一字体、间距和浅/深/系统主题令牌。扩展从网站候选消费字节一致的只读副本。网站 `content/reader.js` 和扩展的 Shadow DOM 适配器各自处理宿主数据、定位、语音及保存。

| 层级 | 呈现 |
|---|---|
| Detected expression → In this context → English definition | 支持的完整表达取代单词成为标题，紧接语境义和英文。置信不足时显示普通单词，并保留可能表达入口。 |
| Original sentence → Selected word | 原句以衬线字体显示，并标出候选跨度。使用 Selected word 按钮在同一面板切换。 |
| Other meanings → Collocations → Word families → Related words → View full entry | 按资料可用性显示。词、搭配和相关词可继续查询，原条目或段落链接沿用站内锚点。缺少词族资料时省略该栏。 |

- 桌面浮层在锚点上方或下方寻找空间，按可见视口避让并独立滚动。移动端底部面板有 Compact 和 Expanded 两态，使用 safe-area 和 44 CSS px 操作区。保留正文滚动位置和原生页面手势。
- 面板在连续查词时复用。新的选词、Esc 和关闭操作会正确处理待返回结果。网站阅读器保持词按钮的原有键盘导航及清晰的键盘焦点；扩展可按 F8 将焦点移入面板。
- 字体与颜色变化不推动正文布局。网站查词按钮关闭原生灰蓝触摸框与按压背景。短语感知默认关闭，开启后仅在主动查词期间标记该次受支持的表达。网站标记组成词，扩展使用不改变正文 DOM 的覆盖层。关闭时移除标记。
- 英美朗读、速度选择和停止按钮使用本地设备音色。打开发音控件无需录音权限。网站收藏仅保存词或表达字符串于此站点本地存储，可打开或移除。扩展沿用私有 IndexedDB 收藏及原有摘录 opt-in。输入另一个词、展开相关词或用 Back 可在同一面板继续。网站不共享收藏内容到扩展。
- 正常网站构建随阅读页生成压缩词典、索引模块和来源许可。初次查词才加载。同源部署即可使用。稳态使用原条目 ID、链接、文章、组号和品牌。网站与扩展沿用 Phase 03 的数据版本和语言识别边界。

## 验收记录

| 检查 | 结果 |
|---|---|
| 视觉与交互矩阵 | 48/48。Chromium 151.0.7922.34 的四种视口以及 Linux WebKit 26.5 的两种视口，覆盖两端和四种主题/系统组合。核对颜色、边缘、滚动条、正文位置、44 px 控件、展开状态、默认标记关闭。桌面流程额外验证切换、嵌套返回、发音速率、显式收藏和 Esc。 |
| 浏览器截图 | 10 张实测截图。桌面浅色之前/之后，以及移动深色之前、紧凑、展开。网站用 VPN 文章，扩展用本地阅读夹具及真实 content script。 |
| 网站回归 | 静态构建、历史内容与 URL 保护门禁通过，10/10 阅读及站内交互通过。Shared Core 31/31，Chromium 和 WebKit 两个阅读烟测通过。 |
| 扩展回归 | 32/32 Node、35/35 DOM/交互与收藏测试通过。通过 Safari 资源静态打包与原生工程检查。完整 Chromium 扩展进程在此 Linux 环境遇到 socket 限制。 |
| 待真机 | macOS/iPhone Safari 安装授权、原生长按与选择手柄、真实音色、VoiceOver、Firefox 与 Chromium 品牌原生安装。浏览器模拟尺寸或触屏不等同设备运行。 |

`scripts/review_dictionary_ui.mjs` 运行跨端矩阵。先在网站候选运行 `python3 content/render.py`，在两个扩展版本构建 `dist/`。在网站 Phase 03 基线生成原预览后，以其 `build/context-reader/` 路径传入 `SITE_BASE`。设置 `EXT_BASE`、`EXT_DIST`、`PLAYWRIGHT_MODULE`、`CHROMIUM_PATH` 和 `WEBKIT_PATH`，输出目录由 `VISUAL_OUT` 指定。验证数据见 [浏览器矩阵](phase-05-browser-matrix.json)。

## 基线与恢复

| 仓库 | 父基线 | 设计候选 |
|---|---|---|
| 网站 | `9cd72744df6f93d0d277e706719a64af695e1fc2` | `feature/dictionary-interface-redesign` |
| 扩展 | `0f5b7d23ada60d640eaee8db0adab48cec4943a0` | `feature/dictionary-interface-redesign` |

恢复时从各自父提交重新构建和装载测试资源。既有私有收藏无需迁移。上线、App Store 提交或两端的发布权限独立处理。下一阶段先在 MacBook Air M1 与 iPhone 复核真机操作和辅助功能，记录设备、系统、浏览器和完整候选 SHA。
