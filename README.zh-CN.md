# Zotero Codex

[English](README.md) · 简体中文

## 安装

1. 安装 [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)，运行 `codex login` 登录。
2. 从[最新 Release](https://github.com/RTLiang/zotero-codex/releases/latest) 下载 **.xpi** 文件。
3. 在 Zotero 10 中打开 **工具 → 插件**，点击齿轮按钮，选择 **Install Plugin From File…（从文件安装插件）**，选中下载的 XPI。
4. 重启 Zotero，选中文献或打开 PDF，点击右侧边栏的 **Codex** 图标。

如果未自动找到 Codex，在侧栏设置中填写可执行文件的绝对路径。

## 简介

阅读文献时，可以直接在 Zotero 中与 Codex 讨论。需要时附上题录信息、摘要或 PDF 选中文本，也能在 Codex Desktop、命令行或本侧栏继续已有对话。

对话沿用你现有的 Codex 登录状态，并可在本机的 Codex 应用之间继续。chatgpt.com 上的 ChatGPT 对话与 Codex 对话分开保存，不会显示在这里。

## 功能

- 在 Zotero 文献详情和 PDF 阅读器旁边打开 Codex 侧栏。
- 搜索、打开并继续已有对话，实时查看回复和执行状态。
- 从当前文献开始新对话，也可以回到之前的对话。
- 回答区只显示正文，不重复显示头像或 Codex 署名；输入栏按钮使用固定正圆尺寸并统一垂直基线。
- 聊天正文支持拖选文字并复制选中的片段。
- 安全渲染 Markdown 正文：支持 1–6 级标题、引用、分隔线、列表与任务列表、表格、强调、删除线、链接、代码块和常用 LaTeX 数学表达式。
- 发送第一条消息时才会创建对话；Codex 会在首次回复后为对话生成简短标题。
- 每篇文献都会记住对应的对话；切换文献时可以接着上次的讨论继续。
- 可搜索最近的对话，也可以只查看当前文献的对话。
- 可在设置中修改 Codex 程序路径或重新连接。
- 可选择显示执行详情，例如工具调用、文件变更和思考摘要；默认关闭。
- 可从“＋”选择图片、粘贴截图或拖入图片；发送前可预览和移除，图片会随对话发送。
- 可从“＋”选择“生成图片”，输入示意图需求后发送；侧栏会在聊天中直接显示 Codex 生成的图片。也可手动输入 `$imagegen` 调用同一功能。
- 侧栏、PDF 选区按钮、动态提示与错误信息支持 Fluent 国际化，随 Zotero 使用简体中文或英文。
- 从本机 Codex 账号动态读取可用模型，并在输入框底部选择模型及该模型支持的思考强度；选择会应用到下一轮及后续对话。
- 回答生成期间仍可选择下一次回复使用的模型和思考强度；用户与助手消息均可复制。
- 可编辑已有消息：修改最后一条消息会更新当前对话；修改较早的消息会另开分支，保留后续内容。
- 通过输入框左下角的“＋”菜单选择是否附带当前条目的标题、作者、日期、DOI、摘要和本地 PDF 路径。
- 发送请求时，如果当前 Codex 环境中的 OpenAI 官方 Zotero skill 已启用且可用，会自动加载它，用于搜索本地文献、读取索引全文、导出 BibTeX、插入 citation key 和导入参考文献；不可用时继续普通对话。
- 在 PDF 中选中文字后，当前选区会自动出现在输入框中并附到下一条消息；新的选区会替换旧的当前选区。“添加到 Codex”可把选区固定下来，以便继续选择并附加多个片段。
- 支持停止当前 turn，以及在侧栏中处理命令、文件和权限确认。
- 新对话默认使用 `read-only` 沙箱和 `on-request` 审批；插件本身不直接改写 Zotero 条目。

## 环境

- Zotero 10.0.x（本机版本为 10.0.2；manifest 明确限定为 `10.0.*`）
- 已安装 Codex CLI，并完成 `codex login`
- [OpenAI 官方 CLI 文档](https://learn.chatgpt.com/docs/codex/cli)推荐独立安装器，并提供 npm/Homebrew 安装选项。安装路径由安装方式和前缀决定，并非统一固定目录。
- 官方独立安装器：macOS/Linux 默认 `~/.local/bin/codex`；Windows 默认 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`。自动检测也支持 `CODEX_INSTALL_DIR` 自定义目录。
- macOS/Linux 会搜索继承的 PATH、`NPM_CONFIG_PREFIX` / `npm_config_prefix` 下的 `bin/codex`，以及常见 Homebrew、Linuxbrew 和用户安装目录。nvm/fnm 等安装若已加入 Zotero 继承的 PATH，也可被发现；否则在设置中填写绝对路径。
- macOS 会自动探测 `/opt/homebrew/bin/codex`、`/usr/local/bin/codex` 等常见位置；也可在侧栏的“连接设置”里填绝对路径
- Windows 会检测 PATH、`%APPDATA%\npm`、用户目录下的 `.cargo\bin` 和 `.local\bin`。npm 安装产生的 `codex.cmd` 会解析为包内的原生 `codex.exe`；也可在连接设置中填写 `codex.exe` 或 `codex.cmd` 的绝对路径。安装或登录 Codex 后重启 Zotero，使它继承最新环境变量。

## 从源码构建

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
