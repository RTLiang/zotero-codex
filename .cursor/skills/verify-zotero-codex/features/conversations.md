# Conversations

Users create, search, resume and manage chats while replies stream. Chats can continue in the background, and earlier-message edits preserve later history through a branch.

## Sub-features

- `new-chat` opens a blank composer and creates a stored chat only on the first message.
- `send-stop` streams a response and interrupts an active reply.
- `picker` searches recent chats, filters to a paper, and loads further rows on scroll.
- `paper-drafts` preserves unsent text and image attachments independently while switching between library papers.
- `background` keeps a reply running while users switch chats and restores its Stop button.
- `history-edit` copies messages, edits the latest turn, or branches an earlier turn.
- `manage` archives/deletes a chat and clears its paper bindings after success.
- `title` begins with the paper title when Include current item is enabled, then may generate a paper-related name.

## How to get to it (user POV)

- Open Codex for a library paper or a PDF.
- Start through the header +, New chat in the chat picker, or `/new`.
- For paper-scoped drafts, open Codex on fixture paper A, enter disposable text and attach a fixture image, select paper B and confirm its composer is independent, then return to A and verify both text and image are restored. Enter a B draft and repeat in the other direction. Capture each switch and inspect the resulting composer state.
- Send through the arrow button or Enter; Shift+Enter adds a line. Stop uses the same button while running.
- Click the chat title to open the picker, search, toggle Current paper, and select a row.
- Hover a message for Copy/Edit controls. Right-click a chat row or the current title to archive/delete.

## Driving it with control.mjs and native app control

Preconditions:

- Doctor passes and a fixture paper is open. The scratch Codex storage has an authenticated account for reply/history paths. Never use the daily shared storage to manufacture test history.
- Preserve the isolated working directory when configuring login. Use disposable prompts and chats only.

- Cover header entry with `click '[data-zcs-l10n-id="zotero-codex-new-chat-button"]'`, picker entry with `click '.zcs-thread-trigger'` then `click '.zcs-new-thread-row'`, and command entry with `fill '.zcs-input' /new` then `key '.zcs-input' Enter`. Add `--run "$verify_run"` to each. Capture each blank composer and confirm no new session appeared until sending.
- Send `fill '.zcs-input' 'Reply with exactly VERIFICATION_OK. Do not use tools.'` then `click '.zcs-send-button'`. Repeat the send entry through `key '.zcs-input' Enter` in a new disposable chat. Capture a user message, streaming activity and final `.zcs-assistant .zcs-message-content`. Read the new session file under scratch runtime and reopen the chat through the picker.
- For interruption/background coverage, use a prompt that produces enough text to observe an active reply. While `.zcs-send-stop` is visible, switch through the picker or start a new chat. Return to the running row and confirm Stop is restored. Click `.zcs-send-button` to interrupt. Capture terminal state and the stored turn. Native notification delivery/click needs native app control and a genuinely background completion.
- Open `click '.zcs-thread-trigger'`, then `fill '.zcs-thread-search' VERIFICATION_OK`. Capture matching and empty search states. Toggle `.zcs-paper-only-filter input`. Incremental list display requires at least 41 matching disposable sessions: confirm the first 40 rows, scroll the real list with native control and observe row 41. This expands the locally loaded list; it is not another backend page fetch. A short list cannot prove this branch.
- Message buttons use `[data-zcs-l10n-id="zotero-codex-copy-message"]` and `[data-zcs-l10n-id="zotero-codex-edit-message"]`. Scope to the target `.zcs-user` message before clicking. Use the composer to resend, reopen history, and confirm the latest-turn update. Repeat on an earlier user turn and verify the original chat remains available. Do not call edit/fork methods directly.
- Use native context-click on a disposable picker row or title. A picker row also supports `key '<pane-prefix> .zcs-thread-row' ContextMenu`; capture that menu before choosing an operation. Select Archive in `.zcs-thread-context-menu` and inspect the stored chat/binding state; archive runs without a confirmation dialog. On a separate disposable chat, select Delete, capture cancellation in Zotero's confirmation dialog, then confirm deletion and inspect the stored state. Never target the user's real chats.

## Gotchas

- Blank new-chat UI is not a stored chat. A streaming activity line is not a completed answer.
- Paper-switch drafts are held in memory. Confirm each paper's text and image return after A→B→A; the blank composer on B is expected until a B draft is entered.
- Automatic title generation can create an extra model request. Record the final name after completion, and preserve a manual name if that path is under test.
- Background reply, OS notification delivery and notification-click navigation are separate claims.
- Picker search depends on the actual loaded chat title/text, not necessarily the literal prompt. Use the displayed title when the prompt term is absent.
- Archive and delete differ: only deletion asks for confirmation. Verify the selected operation and deletion cancellation; screenshots of a disappearing row alone do not establish backend success.
