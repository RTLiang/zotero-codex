# Interactive UI

New chats expose a dynamic tool that displays generated HTML inside a sandboxed frame. The transcript owns the document; the selected Codex storage owns bounded JSON interaction state. Ordinary follow-up messages automatically include the latest four widgets' saved states as untrusted context.

## Sub-features

- `generate`: real Codex tool call becomes a visible interactive document after turn completion.
- `operate`: inline scripts update controls and charts locally.
- `restore`: switching chats and reopening restores the saved JSON state.
- `context`: sending an ordinary question includes current widget state without another button.
- `isolation`: opaque origin, CSP and frame-scoped HTTP cancellation isolate generated code.

## How to get to it (user POV)

- Open Codex for a fixture paper in the library or PDF reader, start a new chat, and ask for an interactive explanation or calculator.
- Operate its slider/buttons. Switch chats and return through the picker.
- Ask an ordinary follow-up question in the composer; no selection or context button is needed.

## Driving it with control.mjs and native app control

Preconditions: doctor passes, isolated fixture context is inspected, scratch storage has authenticated login through native Settings, and the CLI supports experimental dynamic tools (tested schema: 0.162.1).

1. Capture before generation. Send a synthetic request for a slider and numeric output with stable control IDs; await a completed reply and `.zcs-interactive-frame`.
2. Read the frame document's principal and content. Verify scripts run, its principal is null rather than system, and generated code cannot access parent document, Zotero, Components or ChromeUtils.
3. Drive `fill '<pane> .zcs-interactive-frame >>> #slider' 7`, capture the resulting output and independently read the JSON sidecar under scratch storage. Keep raw paths private.
4. Switch chats using the picker and reopen. Capture the restored slider/output and persisted transcript tool arguments.
5. Send a question that asks for the current value without supplying it. Verify the model's answer and actual turn context carry that state.
6. Use a disposable generated diagnostic UI and local HTTP listener to attempt fetch, external images, iframe self-navigation and meta refresh. Assert zero received requests and observe blocked privileged access. Test ordinary navigation too; CSP alone does not prove blocked self-navigation.
7. Repeat the relevant path in the PDF reader for that entry's acceptance. Record any untested entry separately. Cleanup the owned profile and credentials after evidence collection.

## Gotchas

- Dynamic tools are experimental. This CLI registers them on new chats; resume restores the original tool list. Old chats created without the tool require a new chat.
- UI appears after turn completion, not during tool streaming. Tool acceptance is not proof of rendering.
- JSON state is limited to 16 KiB per widget, 16 levels; HTML is limited to 128 KiB. The in-memory store cache holds 64 items. Aggregate disk eviction and historical frame virtualization are not implemented. Forked chats start with default interaction state.
- A browser preview, unit test or sandbox attribute alone does not establish native isolation. Inspect the principal and real network behavior.
- Invalid state or persistence failure must show an error; never silently count it as restored state. HTML is never written to an extra artifact store.
