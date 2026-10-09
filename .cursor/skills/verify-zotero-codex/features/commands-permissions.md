# Commands and permissions

Users open permission or model controls from the composer footer or local slash commands. Permission changes persist and apply to the next reply. Opening a local command should not create a chat.

## Sub-features

- `permission-button` opens and closes the bottom permission dialog.
- `permission-command` opens that dialog through `/approvals` and consumes the command without sending a turn.
- `permission-save` persists approval policy, reviewer, file access and network access.
- `command-menu` filters commands/skills and supports ArrowUp, ArrowDown, Enter, Tab and Escape.
- `model-choice` selects an account-supported model and reasoning effort through the bottom button or `/model`.

## How to get to it (user POV)

- Select a library paper or open its PDF, then click the Codex sidenav.
- Click the footer's file access button, or type `/approvals` and press Enter.
- Type `/` to browse commands, or `/skills` to browse available skills.
- Click the model footer button, or type `/model` and press Enter.

## Driving it with control.mjs

Preconditions:

- Launch and doctor pass. The local permission proof needs no model login.
- `prove` supplies two fixture papers, selects paper A and opens Codex. For manual coverage, use `seed` once and click its title-bearing `[role="treeitem"]` row from the DOM snapshot.
- Model/skill catalog checks require the actual CLI and applicable account/skills, not preview fixtures.

- Complete the initial permission feature proof with `"$verify_control" prove --run "$verify_run"`. Expect button and `/approvals` screenshots, persisted `workspace-write`, an empty composer and no messages/session.
- Open manually with `"$verify_control" click '.zcs-permissions-trigger' --run "$verify_run"`. The `.zcs-permissions-card` becomes visible and the trigger has `aria-expanded="true"`.
- Select policy with `"$verify_control" select '.zcs-permission-field:nth-of-type(1) select' never --run "$verify_run"`; reviewer with `select '.zcs-permission-field:nth-of-type(2) select' user`; access with `select '.zcs-permission-field:nth-of-type(3) select' workspace-write`. Apply the same `--run` argument to each command. Use `check '.zcs-permission-network input' true` for network access. Reopen the dialog and read the corresponding `extensions.zotero.codexSidebar.*` preferences to prove persistence.
- Cover the composer entry with `fill '.zcs-input' /approvals`, then `key '.zcs-input' Enter`, each with `--run "$verify_run"`. Expect the same dialog and no sent user message.
- Cover menu navigation with `fill '.zcs-input' /`, `key '.zcs-input' ArrowDown`, and `key '.zcs-input' Escape`. Capture `.zcs-command-menu` visibility and its option/active-descendant state before and after.
- Open model controls with `click '.zcs-model-trigger'`, or `fill '.zcs-input' /model` then `key '.zcs-input' Enter`. The `.zcs-model-popover` appears. Click `[data-l10n-id="zotero-codex-model-choice"]` and choose an actually listed `[role="option"]`; repeat with `[data-l10n-id="zotero-codex-effort-choice"]`. Capture both the selected option and footer text. Use the current snapshot to scope an option uniquely.
- Capture `snapshot commands-after --run "$verify_run"`. Record which entry points were exercised, including library versus PDF when the changed behavior affects both.

## Gotchas

- `never` denies operations that require approval. It does not grant access. Full access forces network access and disables its checkbox.
- Changing controls during a reply affects the next reply. A local control proof does not verify a real command/file/permission approval request.
- Model buttons can be disabled when no model catalog loaded. Record that precondition instead of fabricating a catalog.
- The exact third permission label is stable in this implementation; update the selector if the dialog's fields are reordered.
- Slash text can be consumed by the highlighted menu row on Enter. Capture the menu selection and resulting dialog.
