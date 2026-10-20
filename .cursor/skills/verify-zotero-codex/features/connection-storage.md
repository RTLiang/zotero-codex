# Connection and storage

Users choose the plugin's default model, reasoning effort, Fast mode, CLI executable, proxy, Codex storage and working directory in Zotero's Codex preferences. Model defaults save immediately; saving connection settings reconnects the sidebar while preserving unsent drafts.

## Sub-features

- `settings-entry` opens native preferences from the sidebar link or Zotero Settings.
- `default-model` chooses only a catalog model or Codex default, saves in this plugin's Zotero preferences and applies to new chats. It never writes a Codex model configuration.
- `default-reasoning-fast` offers the selected model's supported reasoning efforts and enables Fast only when it advertises priority service. The empty effort follows Codex's default. Both choices save immediately and apply to idle new-chat views; changing defaults preserves an already open chat's current selections.
- `refresh-models` reloads the real CLI catalog, updates sidebar model controls and clears an unavailable saved model so selection falls back to the catalog's Codex default. Failed refreshes preserve the existing catalog and preference.
- `proxy` enables manual fields only for manual mode and saves inherited/direct/manual configuration.
- `storage` keeps Codex storage, working directories and paper bindings associated with the chosen configuration.
- `reconnect-draft` preserves the current paper's unsent text/images across reconnection.
- Reconnect drafts are kept in memory and keyed by paper/body while runtime views are detached and recreated; this does not promise durable draft storage across Zotero restarts.
- `busy-save` disables Save and reconnect while a reply/request is active. Model and language choices still save immediately.
- `login-import` optionally copies the existing local login once without overwrite.

## How to get to it (user POV)

- In the sidebar, click Settings (•••), then Proxy and storage on the settings page. In Zotero itself, open Settings → Codex.
- Choose proxy mode, executable, storage and working directory, then Save and reconnect.
- In sidebar Settings or Zotero Settings → Codex, choose Default model, Default reasoning effort and Enable Fast by default. Click Refresh model list as needed. There is no manual model-ID input.
- Use Zotero directories fills paths. Import existing login once is an explicit checkbox.
- Reconnect and CLI auto-detection controls are also available in sidebar Settings.

## Driving it with control.mjs and native app control

Preconditions:

- Doctor passes and the current fixture sidebar is open. Keep `scratch/runtime` and `scratch/workspace` configured; never point this verification instance at daily Codex storage.
- Saving/reconnecting needs an actual usable CLI. Proxy reachability needs an actual proxy endpoint, not a guessed address.
- Login import needs an existing local login and a dedicated destination different from its source. A successful first import also requires that the destination has no login yet. Check existence and permissions without reading credential contents.

- Enter through `click '.zcs-more-button'` then `click '[data-zcs-l10n-id="zotero-codex-runtime-settings"]'`, with `--run "$verify_run"`. `windows --run "$verify_run"` should list the native preferences URL. Alternatively use native app control to open Zotero Settings → Codex and capture that independent entry.
- Inspect `snapshot runtime-before --run "$verify_run" --window preferences`. Set `select '#codex-setting-proxyMode' manual` with both flags and confirm `#codex-setting-proxyURL` and `#codex-setting-proxyBypass` become enabled. Switch to direct and inherit and confirm disabled fields. This proves field behavior only.
- For models, inspect `.zcs-default-model-select` options, choose an actually listed model with `select`, then click `.zcs-refresh-models`. Use the active library/reader pane prefix in sidebar Settings; use `--window preferences` and `#codex-setting-model-select` in native preferences. Capture the selection and `.zcs-model-settings-status`, then independently read the plugin's `model` preference and reopen the view. Choose the empty option to restore Codex default and confirm the override is empty. Model selection saves without Save and reconnect. Verify both sidebar entries and native preferences, including explicit Chinese/English display.
- For reasoning/Fast defaults, select a listed `.zcs-default-reasoning-select` value and toggle `.zcs-default-fast-checkbox`. Read the saved `reasoningEffort` and `serviceTier` preferences independently, reopen settings and compare the controls. Return to an existing synthetic chat to check that its selections remain intact; start a new chat and inspect its footer and model popover for the new defaults. Restore empty effort and Fast off, then repeat. Native preferences use `#codex-setting-model-reasoning` and `.zcs-default-fast-checkbox` with `--window preferences`. A disabled Fast control requires an actual catalog model without priority support; record that branch as untested if none is available.
- Check that refresh disables its controls while pending and restores them on completion. Catalog removal and failure require an actual unavailable model/CLI failure or separate unit evidence; do not substitute a fabricated native catalog. Unit tests cover removed-model fallback and failure preservation.
- Non-manual proxy fields are hidden as well as disabled, so their absence from a visible-control snapshot cannot prove the disabled property. Use a read-only observation of `#codex-manual-proxy.hidden` and both inputs' `disabled` properties for that assertion.
- For a real save, leave isolated directories intact, enter an actual executable in `#codex-setting-codexPath`, and click `#codex-settings-save`. Capture `#codex-settings-status`, then run doctor to check connection/runtime identity. Read stored preference values independently. A status saying Connected alone does not prove a model reply or actual proxy routing.
- Executable and storage fields live in collapsible sections. Inspect their containing `details` and expand the observed `summary` before filling a hidden path or checking login import. Saved nonempty paths open their section automatically; an empty executable path leaves auto-detection selected and its section collapsed on reopening.
- Before opening preferences, enter `Draft survives reconnect` in `.zcs-input` and attach a disposable image through the normal picker. Save the native settings, close only the isolated preferences window with `close-window --run "$verify_run" --window preferences`, then return to the paper and capture both text and attachment. Switch papers during reconnection only when explicitly testing that branch; confirm restoration follows the latest selected paper.
- For busy-save, start a real reply and open preferences. Expect `#codex-settings-save` disabled with the wait explanation, while `#codex-setting-model-select` and `#codex-setting-language` remain enabled. Stop or finish the reply normally; Save becomes available. Check the preferences file/runtime process to confirm the blocked connection save changed neither.
- For login import, check `#codex-import-login` only when that test is in scope, then save. Verify destination existence and permissions without reading or logging credentials. Repeat with an existing destination: expect an explicit destination-exists error before disconnect or preference changes. Compare hashes privately to prove no overwrite and confirm the runtime and draft remain intact. Uncheck import before a normal reconnect. The default smoke does not copy login.
- Capture `snapshot runtime-after --run "$verify_run" --window preferences`. Preserve failure status and the existing draft if applying settings fails; run cleanup afterwards.

## Gotchas

- Saving is asynchronous and can temporarily disable the sidebar. Wait for actual completion and re-run doctor if anything looks wrong.
- An unopened library sidebar with a pending paper must not keep Save disabled while the reader sidebar is idle. Open native preferences from the reader before ever opening the library sidebar, then confirm Save is enabled. Initializing views, active context loads and model requests still block Save.
- Use Zotero directories populates fields; it does not apply them until Save. Existing chats are not moved to new storage.
- A custom executable wrapper can override proxy environment choices. Use the actual executable for routing tests and observe the child's environment/network separately.
- One-time login import is different from ongoing credential synchronization. Never include auth contents in evidence.
- Runtime reconnection, authentication, remote model response and proxy routing are different proof boundaries.
- Settings-page defaults initialize new chats. Footer model, reasoning and Fast choices affect the current chat without writing those defaults. Existing chats retain their selection when the default changes. A native catalog/selection proof does not establish that a remote model accepts a turn.
- Footer `textContent` includes hidden labels, including Fast when its badge is hidden. Check the badge's `hidden` property, the popover's selected option and visible pixels before asserting the active speed.
