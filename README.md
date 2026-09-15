# Codex Sidebar for Zotero

这是一个面向 Zotero 10 的本机插件：把 Codex 任务列表、历史消息和输入框放进 Zotero 右侧条目面板，并通过本机 `codex app-server` 继续同一组 Codex 任务。

它不复制或另建聊天数据库。插件启动用户已经安装并登录的 Codex CLI，因此 Codex Desktop、Codex CLI、Codex Chrome 侧栏和本插件在同一个 Codex 主目录下保存的任务可以出现在同一任务列表中。普通 ChatGPT 网页对话不属于 Codex 任务，不会出现在这里。

## 当前功能

- 在 Zotero 条目详情和 PDF 阅读器的官方 Item Pane 中显示 Codex 侧栏。
- 列出、打开并继续本机已有 Codex 任务，实时显示回答和运行状态。
- 采用类似 ChatGPT for Chrome 的极简侧栏：顶部任务搜索浮层、右上角设置菜单和底部悬浮输入框。
- 回答区只显示正文，不重复显示头像或 Codex 署名；输入栏按钮使用固定正圆尺寸并统一垂直基线。
- 安全渲染 Markdown 正文：支持 1–6 级标题、引用、分隔线、列表与任务列表、表格、强调、删除线、链接、代码块和常用 LaTeX 数学表达式。
- 点击“新任务”立即进入空白草稿，首次发送时才创建持久化任务，并在 Codex Desktop/CLI 中继续查看。
- 每篇 Zotero 文献独立绑定一个 Codex 任务：切换文献会自动恢复各自的聊天；首次打开未聊过的文献时保持空白，第一次发送才创建任务。
- 设置使用独立页面管理 CLI 路径、自动检测与重新连接，不显示连接状态标记。
- 侧栏、PDF 选区按钮、动态提示与错误信息支持 Fluent 国际化，随 Zotero 使用简体中文或英文。
- 从本机 Codex 账号动态读取可用模型，并在输入框底部选择模型及该模型支持的思考强度；选择会应用到下一轮及后续对话。
- 回答生成期间仍可选择下一次回复使用的模型和思考强度；用户与助手消息均可复制。
- 可编辑任意已有用户消息：最新消息会在原任务中撤回并重发；编辑更早的消息时会从该轮之前创建共享任务分支，避免删除后续历史。
- 通过输入框左下角的“＋”菜单选择是否附带当前条目的标题、作者、日期、DOI、摘要和本地 PDF 路径。
- 在 PDF 中选中文字后，当前选区会自动出现在输入框中并附到下一条消息；新的选区会替换旧的当前选区。“添加到 Codex”可把选区固定下来，以便继续选择并附加多个片段。
- 支持停止当前 turn，以及在侧栏中处理命令、文件和权限确认。
- 默认新任务使用 `read-only` 沙箱和 `on-request` 审批；插件本身不直接改写 Zotero 条目。

## 环境

- Zotero 10.0.x（本机版本为 10.0.2；manifest 明确限定为 `10.0.*`）
- 已安装 Codex CLI，并完成 `codex login`
- macOS 会自动探测 `/opt/homebrew/bin/codex`、`/usr/local/bin/codex` 等常见位置；也可在侧栏的“连接设置”里填绝对路径

## 安装

在项目目录执行：

```bash
npm test
npm run check
npm run build
```

随后在 Zotero 中打开“工具 → 插件”，点击齿轮按钮，选择“Install Plugin From File…”，安装 `dist/zotero-codex-sidebar-2026.258.2.xpi`。选中文献或打开 PDF 后，点击右侧边栏中的 Codex 图标。

版本号使用 `年份.当年第几天.当天小版本号`，例如 2026 年第 257 天的第一个版本为 `2026.257.1`。

## 隐私与权限

“当前文献”上下文默认附带，并在输入框内显示为可移除的附件；也可以通过“＋”菜单关闭。只有点击发送时，插件才会把元数据、本地 PDF 路径和暂存选区作为应用上下文交给 Codex。插件不会读取或复制 `auth.json`，登录和网络请求由用户现有的 Codex CLI 处理。

请注意：这是本机集成，不是把 ChatGPT 网站嵌入 Zotero；`codex app-server` 仍属于实验性接口，Codex CLI 大版本升级后可能需要同步更新协议字段。

## 实现依据

- [Zotero 10 for Developers](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [Zotero 7+ bootstrapped plugin 与 ItemPaneManager 文档](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [LLM for Zotero](https://github.com/yilewang/llm-for-zotero)：参考本机 `codex app-server` 进程桥接
- [zotero-translate](https://github.com/dingdinglz/zotero-translate)：参考 PDF 阅读器事件和 Zotero 原生面板生命周期

## 开发与诊断

`npm run check` 检查 manifest 和全部脚本语法，`npm test` 测试任务历史与 Zotero 上下文转换。若侧栏提示找不到 Codex CLI，可先在终端运行：

```bash
which codex
codex --version
codex login status
```

也可在 Zotero 的开发者控制台检查 `Zotero.CodexSidebar.connected` 和 `Zotero.CodexSidebar.binaryPath`。
