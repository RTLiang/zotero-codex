# Conversations

Users create, search, resume and manage chats while replies stream. Chats can continue in the background, and earlier-message edits preserve later history through a branch.

## Sub-features

- `new-chat` opens a blank composer and creates a stored chat only on the first message.
- `send-stop` streams a response and interrupts an active reply.
- `picker` searches recent chats, filters to a paper, and loads further rows on scroll.
- `background` keeps a reply running while users switch chats and restores its Stop button.
- `history-edit` copies messages, edits the latest turn, or branches an earlier turn.
- `manage` archives/deletes a chat and clears its paper bindings after success.
- `title` begins with the paper title and later generates a paper-related name.

## How to get to it (user POV)

- Open Codex for a library paper or a PDF.
- Start through the header +, New chat in the chat picker, or `/new`.
- Send through the arrow button or Enter; Shift+Enter adds a line. Stop uses the same button while running.
- Click the chat title to open the picker, search, toggle Current paper, and select a row.
- Hover a message for Copy/Edit controls. Right-click a chat row or the current title to archive/delete.

## Driving it with control.mjs and native app control

Preconditions:

- Doctor passes and a fixture paper is open. The scratch Codex storage has an authenticated account for reply/history paths. Never use the daily shared storage to manufacture test history.
- Preserve the isolated working directory when configuring login. Use disposable prompts and chats only.

- Cover header entry with `click '[data-l10n-id="zotero-codex-new-chat-button"]'`, picker entry with `click '.zcs-thread-trigger'` then `click '.zcs-new-thread-row'`, and command entry with `fill '.zcs-input' /new` then `key '.zcs-input' Enter`. Add `--run "$verify_run"` to each. Capture each blank composer and confirm no new session appeared until sending.
- Send `fill '.zcs-input' 'Reply with exactly VERIFICATION_OK. Do not use tools.'` then `click '.zcs-send-button'`. Repeat the send entry through `key '.zcs-input' Enter` in a new disposable chat. Capture a user message, streaming activity and final `.zcs-assistant .zcs-message-content`. Read the new session file under scratch runtime and reopen the chat through the picker.
- For interruption/background coverage, use a prompt that produces enough text to observe an active reply. While `.zcs-send-stop` is visible, switch through the picker or start a new chat. Return to the running row and confirm Stop is restored. Click `.zcs-send-button` to interrupt. Capture terminal state and the stored turn. Native notification delivery/click needs native app control and a genuinely background completion.
- Open `click '.zcs-thread-trigger'`, then `fill '.zcs-thread-search' VERIFICATION_OK`. Capture matching and empty search states. Toggle `.zcs-paper-only-filter input`. Scroll the real chat list with native control for pagination; a short list cannot prove further-batch loading.
- Message buttons use `[data-l10n-id="zotero-codex-copy-message"]` and `[data-l10n-id="zotero-codex-edit-message"]`. Scope to the target `.zcs-user` message before clicking. Use the composer to resend, reopen history, and confirm the latest-turn update. Repeat on an earlier user turn and verify the original chat remains available. Do not call edit/fork methods directly.
- Use native context-click on a disposable picker row or title. Select the visible `.zcs-thread-context-menu` action and complete Zotero's real confirmation dialog. Reopen the picker and inspect the stored chat/binding state. Capture cancel and success separately; never target the user's real chats.

## Gotchas

- Blank new-chat UI is not a stored chat. A streaming activity line is not a completed answer.
- Automatic title generation can create an extra model request. Record the final name after completion, and preserve a manual name if that path is under test.
- Background reply, OS notification delivery and notification-click navigation are separate claims.
- Picker search depends on the actual loaded chat title/text, not necessarily the literal prompt. Use the displayed title when the prompt term is absent.
- Archive and delete differ. Verify the selected operation and cancellation; screenshots of a disappearing row alone do not establish backend success.
