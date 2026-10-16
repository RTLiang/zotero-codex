# Codex for Zotero feature map

This map covers the native Zotero sidebar and its preferences. Read the main [verification skill](../SKILL.md) for launch, ownership, authentication and cleanup. In each recipe, `verify_control` and `verify_run` are the shell variables established there. Independent proofs use fresh runs; a combined maintenance pass may reuse one owned, healthy profile serially. Each abbreviated selector must be prefixed with the active library or reader pane as specified in the main skill.

Before any recipe, follow [contributor privacy](../SKILL.md#contributor-privacy) for fixtures, model requests, and shared evidence. Raw captures remain local; share only inspected, sanitized copies.

## Coverage and evidence

| Feature | User entry points | Proof boundaries |
| --- | --- | --- |
| [Commands and permissions](commands-permissions.md) | Bottom permission button, `/approvals`, slash menu, model button, `/model` | Permission button and `/approvals` are the generated smoke; other branches require separate proofs |
| [Paper context](paper-context.md) | Library item pane, PDF reader sidebar, Item/+ menu, selection popup, current/other saved-paper links | Context controls and extraction differ from authenticated citation clicks; inspect the target heading/object |
| [Conversations](conversations.md) | Header +, picker New chat, `/new`, picker rows/search/filter, message controls, paper-switch drafts, occupied-chat send | Draft switching, authenticated reply/history, external ownership and notifications need separate observations |
| [Images and message rendering](images-rendering.md) | + menu, paste, drag/drop, image click, message transcript | Source-mapped; requires image input or real reply evidence |
| [Connection and storage](connection-storage.md) | Sidebar Settings, default model and model refresh, its Zotero settings link, Zotero Settings → Codex | Model controls save without reconnect; connection preferences and reconnect need their own proof |
| [Interactive UI](interactive-ui.md) | New chat prompt, generated controls, normal follow-up, chat picker reopen | Requires real tool history, native interaction/state/context and isolation proof |
| [Interface language](interface-language.md) | Sidebar Settings → Language, Zotero Settings → Codex → Language, library and PDF-reader sidebars | Source-mapped; verify immediate switching and saved preference in an isolated profile |

Every feature entry uses exactly four H2 sections. Keep entry points explicit as the app changes. A maintenance pass covers every feature file from source and exercises at least one native path per file; it does not establish every sub-feature. Report exclusions individually. Full feature acceptance requires every relevant mapped entry. Store dated run outcomes outside Git rather than treating this map as a permanent record that a path is tested or untested.

UI evidence includes a screenshot with Zotero identity, the visible DOM/ARIA inventory, and the action record. Mutation evidence also includes an independent stored-state check. Capture before/action/after, keep fixtures disposable, and preserve evidence during cleanup. `npm run preview` is simulated layout evidence only.
