# Codex Sidebar for Zotero

English · [简体中文](README.zh-CN.md)

## Installation

1. Install [Codex CLI](https://learn.chatgpt.com/docs/codex/cli) and run `codex login`.
2. Download the **.xpi** file from the [latest release](https://github.com/RTLiang/zotero-codex/releases/latest).
3. In Zotero 10, open **Tools → Plugins**, click the gear button, and choose **Install Plugin From File…**. Select the downloaded XPI.
4. Restart Zotero, select a paper or open a PDF, then click the **Codex** icon in the right sidebar.

If Codex is not found automatically, enter its absolute executable path in the sidebar settings.

## About

A native Zotero 10 plugin that brings Codex chats, message history, and a composer into the right-hand item pane. It connects through the local `codex app-server`.

The plugin uses your installed, signed-in Codex CLI and does not maintain a separate chat database. Chats stored under the same Codex home can be opened from Codex Desktop, the CLI, the Codex Chrome sidebar, and this plugin. Ordinary ChatGPT web conversations are not Codex chats and do not appear here.

## Features

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
