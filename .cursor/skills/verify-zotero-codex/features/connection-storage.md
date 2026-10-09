# Connection and storage

Users choose the CLI executable, proxy, private session storage and working directory in Zotero's Codex preferences. Saving reconnects the sidebar while preserving unsent drafts.

## Sub-features

- `settings-entry` opens native preferences from the sidebar link or Zotero Settings.
- `proxy` enables manual fields only for manual mode and saves inherited/direct/manual configuration.
- `storage` keeps Codex storage, working directories and paper bindings associated with the chosen configuration.
- `reconnect-draft` preserves the current paper's unsent text/images across reconnection.
- `busy-save` prevents settings changes while a reply/request is active.
- `login-import` optionally copies the existing local login once without overwrite.

## How to get to it (user POV)

- In the sidebar, click ••• → Proxy and storage. In Zotero itself, open Settings → Codex.
- Choose proxy mode, executable, storage and working directory, then Save and reconnect.
- Use Zotero directories fills paths. Import existing login once is an explicit checkbox.
- Reconnect and CLI auto-detection controls are also available in sidebar Settings.

## Driving it with control.mjs and native app control

Preconditions:

- Doctor passes and the current fixture sidebar is open. Keep `scratch/runtime` and `scratch/workspace` configured; never point this verification instance at daily Codex storage.
- Saving/reconnecting needs an actual usable CLI. Proxy reachability needs an actual proxy endpoint, not a guessed address.

- Enter through `click '.zcs-more-button'` then `click '[data-l10n-id="zotero-codex-runtime-settings"]'`, with `--run "$verify_run"`. `windows --run "$verify_run"` should list the native preferences URL. Alternatively use native app control to open Zotero Settings → Codex and capture that independent entry.
- Inspect `snapshot runtime-before --run "$verify_run" --window preferences`. Set `select '#codex-setting-proxyMode' manual` with both flags and confirm `#codex-setting-proxyURL` and `#codex-setting-proxyBypass` become enabled. Switch to direct and inherit and confirm disabled fields. This proves field behavior only.
- For a real save, leave isolated directories intact, enter an actual executable in `#codex-setting-codexPath`, and click `#codex-settings-save`. Capture `#codex-settings-status`, then run doctor to check connection/runtime identity. Read stored preference values independently. A status saying Connected alone does not prove a model reply or actual proxy routing.
- Before reconnect, enter `Draft survives reconnect` in `.zcs-input` and attach a disposable image through the normal picker. Save the native settings, return to the paper, and capture both text and attachment. Switch papers during reconnection only when explicitly testing that branch; confirm restoration follows the latest selected paper.
- For busy-save, start a real reply and open preferences. Expect `#codex-settings-save` disabled with the wait explanation. Stop the reply normally; the button becomes available. Check the preferences file/runtime process to confirm the blocked attempt changed neither.
- For login import, check `#codex-import-login` only when that test is in scope, then save. Verify destination existence and permissions without reading or logging credentials. Repeat with an existing destination and compare hashes privately to prove no overwrite. The default smoke does not copy login.
- Capture `snapshot runtime-after --run "$verify_run" --window preferences`. Preserve failure status and the existing draft if applying settings fails; run cleanup afterwards.

## Gotchas

- Saving is asynchronous and can temporarily disable the sidebar. Wait for actual completion and re-run doctor if anything looks wrong.
- Use Zotero directories populates fields; it does not apply them until Save. Existing chats are not moved to new storage.
- A custom executable wrapper can override proxy environment choices. Use the actual executable for routing tests and observe the child's environment/network separately.
- One-time login import is different from ongoing credential synchronization. Never include auth contents in evidence.
- Runtime reconnection, authentication, remote model response and proxy routing are different proof boundaries.
