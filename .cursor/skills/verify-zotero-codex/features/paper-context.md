# Paper context

The composer can attach the current paper's metadata and PDF passages. Each paper remembers its chat, and switching papers restores the appropriate context and draft.

## Sub-features

- `item-context` shows title, creators, date, DOI, abstract and the local PDF path when available.
- `context-toggle` includes or removes current-item metadata.
- `selection-live` uses the latest reader text selection for the next message.
- `selection-pin` pins several passages through Add to Codex and supports removing a passage.
- `paper-switch` keeps drafts, attachments and chat bindings associated with the selected paper.

## How to get to it (user POV)

- Select a paper in My Library, then click Codex in the right sidenav.
- Open a PDF and click Codex in the reader's right sidenav.
- Click the composer's Item button or +, then Include current item. The current-paper attachment also has a remove button.
- Select PDF text to attach the live selection. Click Add to Codex in the selection popup to pin it.

## Driving it with control.mjs and native app control

Preconditions:

- Doctor passes. Run `seed` once or use the fixtures already created by `prove`.
- Metadata-only checks need no model reply. Reader paths require a disposable local PDF attached to a fixture paper through Zotero's normal attachment UI.

- Select paper A by its visible title in `#zotero-items-tree [role="treeitem"]`. `snapshot paper-list --run "$verify_run"` exposes the current row ID. In the fresh fixture list A is `#item-tree-main-default-row-0`; use `click '#item-tree-main-default-row-0'` with the run argument and confirm the title before relying on the index.
- Click the visible Codex `[data-pane]` button whose value contains `codex-sidebar`. The smoke resolves this handle dynamically. Capture `snapshot paper-context-before --run "$verify_run"`; expect Verification paper A in the attachment.
- Open with `click '.zcs-context-mode'` or `click '.zcs-add-button'`, then toggle with `click '.zcs-context-option'`. Expect the paper chip in `.zcs-attachments` to disappear and reappear. Repeat both menu entry points for a full toggle claim.
- Type an unsent draft with `fill '.zcs-input' 'Draft for paper A'`. Select B's title-bearing row with pointer actions and confirm A's draft/context does not appear on B. Return to A and capture the restored draft. No direct view setters count as proof.
- For PDF entry, open the fixture attachment in Zotero using native app control, click its Codex sidenav, then select visible text with a real pointer drag. Capture the selection action and the `.zcs-live-selection-attachment` result. Click the selection popup's `.zcs-reader-add` button in the reader document and select another passage. Expect separate pinned `.zcs-selection-attachment` chips. The main-window helper does not traverse the embedded PDF text layer; native control must perform this step.
- Remove a live or pinned passage through that chip's `.zcs-attachment-remove`, then capture the attachment list. For an authenticated send, inspect the stored user turn as well as the screen to confirm only the intended passages were sent and consumed.

## Gotchas

- Item rows use `role="treeitem"`, not `role="row"`. Their numeric suffix is a rendered index, not the Zotero database ID.
- A paper without a PDF is valid for metadata checks but cannot prove reader selection behavior.
- The main window can retain both library and reader panes. Scope DOM selectors to the visible pane and use native control only on the owned fixture window.
- Replacing live selection and pinning selection are different operations. Cover both when selection handling changes.
- Unsent draft restoration is distinct from persisted conversation bindings. A chat-binding claim needs a real created chat for each paper and reopening evidence.
