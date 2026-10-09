# Codex for Zotero feature map

This map covers the native Zotero sidebar and its preferences. Read the main [verification skill](../SKILL.md) for launch, ownership, authentication and cleanup. In each recipe, `verify_control` and `verify_run` are the shell variables established there. Use a fresh run for each independent proof.

## Coverage and evidence

| Feature | User entry points | Initial proof status |
| --- | --- | --- |
| [Commands and permissions](commands-permissions.md) | Bottom permission button, `/approvals`, slash menu, model button, `/model` | Permission button and `/approvals` are the generated smoke; other branches require separate proofs |
| [Paper context](paper-context.md) | Library item pane, PDF reader sidebar, Item/+ menu, selection popup | Source-mapped; native paper selection supplies the smoke fixture |
| [Conversations](conversations.md) | Header +, picker New chat, `/new`, picker rows/search/filter, message controls | Source-mapped; authenticated reply/history paths are untested by the smoke |
| [Images and message rendering](images-rendering.md) | + menu, paste, drag/drop, image click, message transcript | Source-mapped; requires image input or real reply evidence |
| [Connection and storage](connection-storage.md) | Sidebar Settings, its Zotero settings link, Zotero Settings → Codex | Source-mapped; preferences and reconnect need their own proof |

Every feature entry uses exactly four H2 sections. Keep entry points explicit as the app changes. A full feature claim requires every relevant mapped entry; report exclusions individually. The initial skill creation needs one feature proof, not a blanket claim about the entire plugin.

UI evidence includes a screenshot with Zotero identity, the visible DOM/ARIA inventory, and the action record. Mutation evidence also includes an independent stored-state check. Capture before/action/after, keep fixtures disposable, and preserve evidence during cleanup. `npm run preview` is simulated layout evidence only.
