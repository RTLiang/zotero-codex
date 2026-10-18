# Interactive UI

New chats expose a dynamic tool that displays generated HTML inside a sandboxed frame. The transcript owns the document; the selected Codex storage owns bounded JSON interaction state. Ordinary follow-up messages automatically include the latest four widgets' saved states as untrusted context.

## Sub-features

- `generate`: real Codex tool call becomes a visible interactive document as soon as its completed tool event arrives, while the turn may still be running.
- `operate`: inline scripts update controls and charts locally.
- `restore`: switching chats and reopening restores the saved JSON state.
- `context`: sending an ordinary question includes current widget state without another button.
- `isolation`: opaque origin, CSP and frame-scoped HTTP cancellation isolate generated code.

## How to get to it (user POV)

- Open Codex for a fixture paper in the library or PDF reader, start a new chat, and ask an ordinary question about a mechanism, comparison, or parameter effect. The assistant should supply a useful interactive view without requiring a visualization request. Explicit requests for interactive explanations or calculators also work.
- Operate its slider/buttons. Switch chats and return through the picker.
- Ask an ordinary follow-up question in the composer; no selection or context button is needed.

## Driving it with control.mjs and native app control

Preconditions: doctor passes, isolated fixture context is inspected, scratch storage has authenticated login through native Settings, and the CLI supports experimental dynamic tools (tested schema: 0.162.1).

For proactive generation, start a new chat and send a synthetic question such as: "A container starts with 80 units and retains a fixed fraction each round. Explain how the retained fraction changes the amount after several rounds, and compare retaining 60% with retaining 90%." Do not mention a visualization, tool, slider, or HTML. Inspect the real tool history and rendered frame, operate its controls, and confirm that the view explains the requested relationship. The response should integrate the view without asking permission or narrating tool use. In separate new chats, check a simple factual question and a text-only explanation request; both should finish without a UI tool call. Record the model and observed behavior; prompt wording and unit checks alone do not prove model selection.

1. Capture before generation. Send a synthetic request for a slider and numeric output with stable control IDs. Observe `.zcs-pending-response` above the composer, including with a long user message: its elapsed time advances, its long-wait hint appears after 20 seconds, and a started UI tool changes the label to generating an interactive view. Capture the first `.zcs-interactive-frame` and whether Stop is still present; the completed tool should render without waiting for turn completion. Stopping or switching chats must remove the pending timer.
2. Resize the native sidebar and compare `.zcs-interactive-body`/frame widths with the card's available width. Use a widget whose content toggles between more than 900 px tall and short. Verify the frame grows to fit and shrinks afterward; ordinary content should scroll with the transcript, without a second vertical scrollbar. The frame height remains bounded at 6000 px for oversized documents.
3. Read the frame document's principal and content. Verify scripts run, its principal is null rather than system, and generated code cannot access parent document, Zotero, Components or ChromeUtils.
4. Drive `fill '<pane> .zcs-interactive-frame >>> #slider' 7`, capture the resulting output and independently read the JSON sidecar under scratch storage. Keep raw paths private.
5. Switch chats using the picker and reopen. Capture the restored slider/output and persisted transcript tool arguments.
6. Send a question that asks for the current value without supplying it. Verify the model's answer and actual turn context carry that state.
7. Use a disposable generated diagnostic UI and local HTTP listener to attempt fetch, external images, iframe self-navigation and meta refresh. Assert zero received requests and observe blocked privileged access. Test ordinary navigation too; CSP alone does not prove blocked self-navigation.
8. Repeat the relevant path in the PDF reader for that entry's acceptance. Record any untested entry separately. Cleanup the owned profile and credentials after evidence collection.

## Gotchas

- Dynamic tools are experimental. This CLI registers them on new chats; resume restores the original tool list. Old chats created without the tool require a new chat.
- UI appears on a successful completed tool event; partial HTML is never executed. Waiting feedback covers model generation, whose duration depends on the chosen model and reasoning effort. Tool acceptance is not proof of rendering.
- JSON state is limited to 16 KiB per widget, 16 levels; HTML is limited to 128 KiB. The in-memory store cache holds 64 items. Aggregate disk eviction and historical frame virtualization are not implemented. Forked chats start with default interaction state.
- A browser preview, unit test or sandbox attribute alone does not establish native isolation. Inspect the principal and real network behavior.
- Invalid state or persistence failure must show an error; never silently count it as restored state. HTML is never written to an extra artifact store.
