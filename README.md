# Codex for Zotero

English · [简体中文](README.zh-CN.md)

## Installation

1. Install [Codex CLI](https://learn.chatgpt.com/docs/codex/cli) and run `codex login`.
2. Download the **.xpi** file from the [latest release](https://github.com/RTLiang/zotero-codex/releases/latest).
3. In Zotero 10, open **Tools → Plugins**, click the gear button, and choose **Install Plugin From File…**. Select the downloaded XPI.
4. Restart Zotero, select a paper or open a PDF, then click the **Codex** icon in the right sidebar.

If Codex is not found automatically, enter its absolute executable path in the sidebar settings.

## About

Read a paper in Zotero and discuss it with Codex in the same window. Add citation details, the abstract, or selected PDF text when useful, then continue the conversation in Codex Desktop, the command line, or this sidebar.

Conversations use your existing Codex sign-in and remain available across Codex apps on this computer. ChatGPT conversations on chatgpt.com are separate and do not appear here.

## Features

- Works in Zotero's item details pane and PDF reader.
- Find, search, open, and continue conversations, with live responses and activity updates.
- Start a conversation from a paper or return to one you already started.
- Render Markdown headings, blockquotes, lists, task lists, tables, emphasis, strikethrough, links, code blocks, and common LaTeX expressions.
- A new conversation is created when you send the first message. Codex gives it a short title after its first reply.
- Each paper remembers its conversation. Switching papers returns you to the conversation you used for that paper.
- Search recent conversations or filter the list to the current paper.
- Set the Codex app path or reconnect from Settings.
- Show activity details such as tool use, file changes, and reasoning summaries; off by default.
- Add images from the “+” menu, paste screenshots, or drag them into the message. Preview or remove images before sending.
- Choose “Generate image” or type `$imagegen` to request images; generated images appear directly in the conversation.
- The sidebar, PDF selection button, notifications, and errors follow Zotero's Simplified Chinese or English language setting.
- Choose from the models available to your Codex account and their supported reasoning efforts. While a response is running, you can choose settings for the next reply.
- Copy messages. Editing your latest message updates the conversation; editing an earlier message starts a branch so later replies remain available.
- Choose whether to include the current paper's title, authors, date, DOI, abstract, and local PDF path.
- Automatically load the enabled, available official OpenAI Zotero skill to search papers, read indexed text, export BibTeX, insert citation keys, or import references. Normal chat continues when the skill is unavailable.
- Selected PDF text is attached to the next message. A new selection replaces the current selection; “Add to Codex” pins a selection so you can include several passages.
- Stop a running response and handle command, file, and permission approvals in the sidebar.
- New chats default to a `read-only` sandbox with `on-request` approvals. The plugin itself does not directly modify Zotero items.

## Requirements and CLI detection

- Zotero 10.0.x; the manifest limits compatibility to `10.0.*`.
- Codex CLI installed and authenticated with `codex login`.
- The [official Codex CLI documentation](https://learn.chatgpt.com/docs/codex/cli) provides standalone, npm, and Homebrew installation options. The executable location depends on the installation method and prefix.
- Standalone installer defaults: `~/.local/bin/codex` on macOS/Linux; `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe` on Windows. Custom `CODEX_INSTALL_DIR` locations are also detected.
- macOS/Linux detection searches the inherited PATH, `bin/codex` under `NPM_CONFIG_PREFIX` or `npm_config_prefix`, and common Homebrew, Linuxbrew, and user installation directories. macOS includes `/opt/homebrew/bin/codex` and `/usr/local/bin/codex`. nvm/fnm installations are detected when their directories are in Zotero's inherited PATH; otherwise, enter the executable's absolute path in settings.
- Windows detection also searches `%APPDATA%\npm`, `.cargo\bin`, and `.local\bin` under your user directory. npm's `codex.cmd` shim is resolved to the package's native `codex.exe`. You can enter either path in settings. Restart Zotero after installing Codex or changing environment variables.

## Build from source

To build from source, run these commands in the project directory and install the resulting XPI from `dist/`:

```bash
npm test
npm run check
npm run build
```

Versions follow `year.day-of-year.daily-revision`. The release workflow increments versions using the UTC date.

## CI and releases

Pushes to `main` and pull requests run syntax checks, tests, XPI builds, and archive integrity checks. CI artifacts are retained for 14 days. After successful checks on `main`, the release workflow generates the next version, builds the XPI, publishes a tagged GitHub Release, calculates SHA-256, and updates `updates.json` and the version fields for Zotero's automatic updates. Release titles contain only the version number. Manual version bumps and tag pushes are unnecessary.

## Privacy and permissions

Current-paper context is included by default and appears as a removable attachment. You can turn it off through the “+” menu. Metadata, the local PDF path, and selected passages are sent as application context only when you send a message. The plugin does not read or copy `auth.json`; authentication and network requests are handled by your existing Codex CLI.

This is a local integration. It does not embed the ChatGPT website. The `codex app-server` interface is experimental, so major CLI updates may require protocol adjustments.

## Implementation references

- [Zotero 10 for Developers](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [Zotero bootstrapped plugins and ItemPaneManager](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [LLM for Zotero](https://github.com/yilewang/llm-for-zotero): local `codex app-server` process integration.
- [zotero-translate](https://github.com/dingdinglz/zotero-translate): PDF reader events and native pane lifecycle.

## Development and troubleshooting

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
