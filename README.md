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

By default, conversations use your existing Codex sign-in and remain available across Codex apps on this computer. You can opt into dedicated storage in Zotero preferences. ChatGPT conversations on chatgpt.com are separate and do not appear here.

## Features

- Works in Zotero's item details pane and PDF reader.
- Find, search, open, and continue conversations, with live responses and activity updates.
- Switch chats or start a new one while a reply runs in the background. Returning to a running chat restores its progress and Stop button. Background replies show a desktop notification when ready; click it to return to the chat.
- Start a conversation from a paper or return to one you already started.
- Render Markdown headings, blockquotes, lists, task lists, tables, emphasis, strikethrough, links, code blocks, and common LaTeX expressions.
- A new conversation is created when you send the first message. With item context enabled, its initial title uses the paper title; after the first reply, Codex uses the paper context, request, and answer to generate a short title identifying the paper's method or topic. Manually changed titles are preserved.
- Each paper remembers its conversation. Switching papers returns you to the conversation you used for that paper.
- Search recent conversations or filter the list to the current paper.
- The main view contains the chat, with model, reasoning effort, and permissions below the composer. Open Settings for connection and display options. Skills are invoked through the `/` menu.
- Show activity details such as tool use, file changes, and reasoning summaries; off by default.
- Add images from the “+” menu, paste screenshots, or drag them into the message. Preview or remove images before sending.
- Click an attached or generated image to enlarge it. Press Esc, click the empty area, or use the close button to return to the chat.
- Choose “Generate image” or type `$imagegen` to request images; generated images appear directly in the conversation.
- The sidebar, PDF selection button, notifications, and errors follow Zotero's Simplified Chinese or English language setting.
- Choose from the models available to your Codex account and their supported reasoning efforts. While a response is running, you can choose settings for the next reply.
- Copy messages. Editing your latest message updates the conversation; editing an earlier message starts a branch so later replies remain available.
- Choose whether to include the current paper's title, authors, date, DOI, abstract, and local PDF path.
- Automatically load the enabled, available official OpenAI Zotero skill to search papers, read indexed text, export BibTeX, insert citation keys, or import references. Normal chat continues when the skill is unavailable.
- Selected PDF text is attached to the next message. A new selection replaces the current selection; “Add to Codex” pins a selection so you can include several passages.
- Stop a running response and handle command, file, and permission approvals in the sidebar.
- Type `/` to browse commands and enabled skills. `/skills` searches available skills; selecting one inserts `$skill-name`, and `/skill-name your request` invokes it directly. Use ↑/↓ to choose, Enter or Tab to select, and Escape to close the menu. `/model` opens model settings and `/new` starts a chat while existing replies continue.
- `/approvals` opens the bottom permission panel for approval policy (`untrusted`, `on-request`, `never`), reviewer (you or automatic review), file access, and network access. Changes apply to the next reply, including in existing chats. Defaults remain `read-only` with `on-request` approvals. `never` denies actions that require approval; full access allows file changes and network access. The plugin itself does not directly modify Zotero items.

## Proxy, paths and dedicated storage

Open **Zotero Settings → Codex** (also linked from the sidebar's settings).

- **Proxy mode:** inherit Zotero's environment (the default), connect directly, or specify an HTTP/HTTPS/SOCKS5 proxy. Desktop Zotero may not inherit terminal proxy variables. Manual mode overrides all uppercase/lowercase proxy variables; direct mode clears them and bypasses every host. Use the actual Codex executable: a custom wrapper can override these choices.
- **Codex executable:** an absolute path, or leave blank for auto-detection.
- **Codex storage directory:** leave blank to keep existing shared storage. **Use dedicated Zotero directories** fills `<Zotero data directory>/codex-sidebar/runtime`. Its `sessions/` folder and SQLite state are kept there; changing the working directory alone does not relocate sessions. Configuration and skills are also separate. Existing chats are not moved: switch back to their storage directory to continue them.
- **Working directory:** leave blank to use the paper's PDF directory. When configured, new chats use separate `papers/<paper-key>` subdirectories. Existing chats retain their original working directory.

Save after all replies, including background replies, and requests have finished. The sidebar reconnects and preserves unsent text/images with their original paper. If you switch papers or open another reader while it reconnects, the sidebar restores the latest selection. Paper-to-chat bindings are maintained separately for each storage directory.

A new storage directory needs its own login. Optionally check **Import existing local Codex login once** when saving: this copies only the local `auth.json` without overwriting an existing login. It does not continuously synchronize credentials; reauthentication may be required later. Keyring-only logins cannot be imported this way. Alternatively, sign in using that directory:

```sh
CODEX_HOME="/absolute/path/to/codex-storage" codex login
```

In Windows PowerShell, set `$env:CODEX_HOME = "C:\absolute\path\to\codex-storage"` before running `codex login`. Other Codex apps only see these chats when configured to use the same storage directory. Keep the directory private and out of cloud sync because it contains login credentials and conversation data.

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

## Frontend preview

Run `npm run preview` and open `http://127.0.0.1:4318`. This uses the production sidebar renderer with simulated conversations and responses; it never starts Codex or accesses your Zotero library. Add `?width=320&theme=dark` to inspect a narrow, dark sidebar. Preview files are excluded from the XPI.

The layout follows a conversation-focused Chrome sidebar. Neutral surfaces and grouped settings draw on [Magpie's frontend](https://github.com/yetone/magpie/tree/main/internal/gui/assets), adapted to Zotero's narrow pane.

## CI and releases

Pushes to `main` and pull requests run syntax checks, tests, XPI builds, and archive integrity checks. CI artifacts are retained for 14 days. After successful checks on `main`, the release workflow generates the next version, builds the XPI, publishes a tagged GitHub Release, calculates SHA-256, and updates `updates.json` and the version fields for Zotero's automatic updates. Release titles contain only the version number. Manual version bumps and tag pushes are unnecessary.

## Privacy and permissions

Current-paper context is included by default and appears as a removable attachment. You can turn it off through the “+” menu. Metadata, the local PDF path, and selected passages are sent as application context only when you send a message. Authentication and network requests are handled by Codex CLI. Only the explicitly selected one-time login import copies `auth.json` locally into the chosen storage directory (private file permissions, no overwrite); the plugin does not parse or log its contents.

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
