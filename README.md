# Codex Sidebar for Zotero

[简体中文](#简体中文) · [English](#english)

## 简体中文

这是一个面向 Zotero 10 的本机插件：把 Codex 任务列表、历史消息和输入框放进 Zotero 右侧条目面板，并通过本机 `codex app-server` 继续同一组 Codex 任务。

它不复制或另建聊天数据库。插件启动用户已经安装并登录的 Codex CLI，因此 Codex Desktop、Codex CLI、Codex Chrome 侧栏和本插件在同一个 Codex 主目录下保存的任务可以出现在同一任务列表中。普通 ChatGPT 网页对话不属于 Codex 任务，不会出现在这里。

## 当前功能

- 在 Zotero 条目详情和 PDF 阅读器的官方 Item Pane 中显示 Codex 侧栏。
- 列出、打开并继续本机已有 Codex 任务，实时显示回答和运行状态。
- 采用类似 ChatGPT for Chrome 的极简侧栏：顶部任务搜索浮层、右上角设置菜单和底部悬浮输入框。
- 回答区只显示正文，不重复显示头像或 Codex 署名；输入栏按钮使用固定正圆尺寸并统一垂直基线。
- 聊天正文支持拖选文字并复制选中的片段。
- 安全渲染 Markdown 正文：支持 1–6 级标题、引用、分隔线、列表与任务列表、表格、强调、删除线、链接、代码块和常用 LaTeX 数学表达式。
- 点击“新任务”立即进入空白草稿，首次发送时才创建持久化任务，并在 Codex Desktop/CLI 中继续查看。
- 新任务首轮回复完成后，后台生成简短标题并同步到 Codex 任务；标题生成失败时保留首条消息作为标题。
- 每篇 Zotero 文献独立绑定一个 Codex 任务：切换文献会自动恢复各自的聊天；首次打开未聊过的文献时保持空白，第一次发送才创建任务。
- 任务列表默认只显示当前文献 PDF 所在工作目录中的对话；可关闭“只看本篇文献的对话”查看所有任务。无本地 PDF 时只显示当前绑定的任务。
- 设置使用独立页面管理 CLI 路径、自动检测与重新连接，不显示连接状态标记。
- 设置页可选择显示或隐藏工作过程（CoT）、工具活动与处理步骤；默认隐藏。
- 可从“＋”选择图片、直接粘贴截图或拖入图片；发送前可预览和移除，并通过 Codex 原生图片输入随消息共享到同一任务。
- 可从“＋”选择“生成图片”，输入示意图需求后发送；侧栏会在聊天中直接显示 Codex 生成的图片。也可手动输入 `$imagegen` 调用同一功能。
- 侧栏、PDF 选区按钮、动态提示与错误信息支持 Fluent 国际化，随 Zotero 使用简体中文或英文。
- 从本机 Codex 账号动态读取可用模型，并在输入框底部选择模型及该模型支持的思考强度；选择会应用到下一轮及后续对话。
- 回答生成期间仍可选择下一次回复使用的模型和思考强度；用户与助手消息均可复制。
- 可编辑任意已有用户消息：最新消息会在原任务中撤回并重发；编辑更早的消息时会从该轮之前创建共享任务分支，避免删除后续历史。
- 通过输入框左下角的“＋”菜单选择是否附带当前条目的标题、作者、日期、DOI、摘要和本地 PDF 路径。
- 发送请求时，如果当前 Codex 环境中的 OpenAI 官方 Zotero skill 已启用且可用，会自动加载它，用于搜索本地文献、读取索引全文、导出 BibTeX、插入 citation key 和导入参考文献；不可用时继续普通对话。
- 在 PDF 中选中文字后，当前选区会自动出现在输入框中并附到下一条消息；新的选区会替换旧的当前选区。“添加到 Codex”可把选区固定下来，以便继续选择并附加多个片段。
- 支持停止当前 turn，以及在侧栏中处理命令、文件和权限确认。
- 默认新任务使用 `read-only` 沙箱和 `on-request` 审批；插件本身不直接改写 Zotero 条目。

## 环境

- Zotero 10.0.x（本机版本为 10.0.2；manifest 明确限定为 `10.0.*`）
- 已安装 Codex CLI，并完成 `codex login`
- [OpenAI 官方 CLI 文档](https://learn.chatgpt.com/docs/codex/cli)推荐独立安装器，并提供 npm/Homebrew 安装选项。安装路径由安装方式和前缀决定，并非统一固定目录。
- 官方独立安装器：macOS/Linux 默认 `~/.local/bin/codex`；Windows 默认 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`。自动检测也支持 `CODEX_INSTALL_DIR` 自定义目录。
- macOS/Linux 会搜索继承的 PATH、`NPM_CONFIG_PREFIX` / `npm_config_prefix` 下的 `bin/codex`，以及常见 Homebrew、Linuxbrew 和用户安装目录。nvm/fnm 等安装若已加入 Zotero 继承的 PATH，也可被发现；否则在设置中填写绝对路径。
- macOS 会自动探测 `/opt/homebrew/bin/codex`、`/usr/local/bin/codex` 等常见位置；也可在侧栏的“连接设置”里填绝对路径
- Windows 会检测 PATH、`%APPDATA%\npm`、用户目录下的 `.cargo\bin` 和 `.local\bin`。npm 安装产生的 `codex.cmd` 会解析为包内的原生 `codex.exe`；也可在连接设置中填写 `codex.exe` 或 `codex.cmd` 的绝对路径。安装或登录 Codex 后重启 Zotero，使它继承最新环境变量。

## 安装

在项目目录执行：

```bash
npm test
npm run check
npm run build
```

随后在 Zotero 中打开“工具 → 插件”，点击齿轮按钮，选择“Install Plugin From File…”，安装 `dist/` 中当前版本的 XPI。选中文献或打开 PDF 后，点击右侧边栏中的 Codex 图标。

版本号使用 `年份.当年第几天.当天小版本号`。Release 工作流会按 UTC 日期自动递增版本号。

## CI/CD

推送到 `main` 或创建 Pull Request 时，GitHub Actions 会自动执行静态检查、测试、XPI 构建和压缩包完整性检查，并保留 14 天的 CI 构建产物。每次推送到 `main` 后，Release 工作流会在这些检查通过后自动生成下一个 `年份.当年第几天.当天小版本号` 版本、构建 XPI、创建带版本 tag 的 GitHub Release、计算 SHA-256，并更新 `updates.json` 和两个版本字段，供 Zotero 自动更新使用。无需手动改版本号或推送 tag。

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

## English

A native Zotero 10 plugin that brings Codex chats, message history, and a composer into the right-hand item pane. It connects through the local `codex app-server`.

The plugin uses your installed, signed-in Codex CLI and does not maintain a separate chat database. Chats stored under the same Codex home can be opened from Codex Desktop, the CLI, the Codex Chrome sidebar, and this plugin. Ordinary ChatGPT web conversations are not Codex chats and do not appear here.

### Features

- Works in Zotero's item details pane and PDF reader.
- Browse, search, open, and continue local Codex chats with live responses and activity updates.
- A compact interface with a chat picker, settings menu, and bottom composer. Responses omit redundant avatars and assistant labels; text can be selected and copied.
- Render Markdown headings, blockquotes, lists, task lists, tables, emphasis, strikethrough, links, code blocks, and common LaTeX expressions.
- Start a blank draft immediately; a persistent chat is created only when you send the first message. A short title is generated after the first response, falling back to the first message if title generation fails.
- Each paper has its own chat binding. Switching papers restores the corresponding chat; papers without a chat start with an empty draft.
- By default, the chat picker shows conversations in the current PDF's working directory. Turn off the current-paper filter to browse all chats. Without a local PDF, the filter shows only the bound chat.
- Manage the CLI path, automatic detection, and reconnection from a dedicated settings page.
- Optionally show reasoning summaries, tool activity, and processing steps; hidden by default.
- Attach images through the “+” menu, paste screenshots, or drag images into the composer. Preview or remove them before sending as native Codex image inputs.
- Choose “Generate image” or type `$imagegen` to request images; generated images appear directly in the conversation.
- The sidebar, PDF selection button, notifications, and errors follow Zotero's Simplified Chinese or English language setting.
- Choose from the models available to your Codex account and their supported reasoning efforts. While a response is running, you can choose settings for the next reply.
- Copy user and assistant messages. Editing the latest user message reverts and resends that turn; editing an earlier message creates a branch before that turn to preserve subsequent history.
- Choose whether to include the current paper's title, authors, date, DOI, abstract, and local PDF path.
- Automatically load the enabled, available official OpenAI Zotero skill to search papers, read indexed text, export BibTeX, insert citation keys, or import references. Normal chat continues when the skill is unavailable.
- Selected PDF text is attached to the next message. A new selection replaces the current selection; “Add to Codex” pins a selection so you can include several passages.
- Stop a running response and handle command, file, and permission approvals in the sidebar.
- New chats default to a `read-only` sandbox with `on-request` approvals. The plugin itself does not directly modify Zotero items.

### Requirements and CLI detection

- Zotero 10.0.x; the manifest limits compatibility to `10.0.*`.
- Codex CLI installed and authenticated with `codex login`.
- The [official Codex CLI documentation](https://learn.chatgpt.com/docs/codex/cli) provides standalone, npm, and Homebrew installation options. The executable location depends on the installation method and prefix.
- Standalone installer defaults: `~/.local/bin/codex` on macOS/Linux; `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe` on Windows. Custom `CODEX_INSTALL_DIR` locations are also detected.
- macOS/Linux detection searches the inherited PATH, `bin/codex` under `NPM_CONFIG_PREFIX` or `npm_config_prefix`, and common Homebrew, Linuxbrew, and user installation directories. macOS includes `/opt/homebrew/bin/codex` and `/usr/local/bin/codex`. nvm/fnm installations are detected when their directories are in Zotero's inherited PATH; otherwise, enter the executable's absolute path in settings.
- Windows detection also searches `%APPDATA%\npm`, `.cargo\bin`, and `.local\bin` under your user directory. npm's `codex.cmd` shim is resolved to the package's native `codex.exe`. You can enter either path in settings. Restart Zotero after installing Codex or changing environment variables.

### Installation

Download the XPI from the [latest release](https://github.com/RTLiang/zotero-codex/releases/latest). In Zotero, open Tools → Plugins, click the gear button, choose “Install Plugin From File…”, and select the XPI. Select a paper or open a PDF, then click the Codex icon in the right sidebar.

To build from source, run these commands in the project directory and install the resulting XPI from `dist/`:

```bash
npm test
npm run check
npm run build
```

Versions follow `year.day-of-year.daily-revision`. The release workflow increments versions using the UTC date.

### CI and releases

Pushes to `main` and pull requests run syntax checks, tests, XPI builds, and archive integrity checks. CI artifacts are retained for 14 days. After successful checks on `main`, the release workflow generates the next version, builds the XPI, publishes a tagged GitHub Release, calculates SHA-256, and updates `updates.json` and the version fields for Zotero's automatic updates. Release titles contain only the version number. Manual version bumps and tag pushes are unnecessary.

### Privacy and permissions

Current-paper context is included by default and appears as a removable attachment. You can turn it off through the “+” menu. Metadata, the local PDF path, and selected passages are sent as application context only when you send a message. The plugin does not read or copy `auth.json`; authentication and network requests are handled by your existing Codex CLI.

This is a local integration. It does not embed the ChatGPT website. The `codex app-server` interface is experimental, so major CLI updates may require protocol adjustments.

### Implementation references

- [Zotero 10 for Developers](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [Zotero bootstrapped plugins and ItemPaneManager](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [LLM for Zotero](https://github.com/yilewang/llm-for-zotero): local `codex app-server` process integration.
- [zotero-translate](https://github.com/dingdinglz/zotero-translate): PDF reader events and native pane lifecycle.

### Development and troubleshooting

`npm run check` validates the manifest and script syntax. `npm test` covers chat history, Zotero context conversion, and CLI discovery. If the sidebar cannot find Codex, check the executable and authentication in your terminal:

```bash
# macOS / Linux
which codex
codex --version
codex login status
```

```powershell
# Windows PowerShell
Get-Command codex
codex --version
codex login status
```

You can also inspect `Zotero.CodexSidebar.connected` and `Zotero.CodexSidebar.binaryPath` in Zotero's developer console.
