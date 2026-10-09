---
name: verify-zotero-codex
description: Verify Codex for Zotero in the real Zotero 10 desktop sidebar on macOS. Use after changing sidebar controls, paper context, conversations, attachments, or connection preferences, and when reproducing a native plugin bug.
---

# Verify Codex for Zotero

Read [features/README.md](features/README.md), then the feature being changed. The primary application is a bootstrapped Zotero plugin. `npm run preview` is a secondary browser layout preview with simulated data. It cannot prove native installation, PDF selection, real conversations, or storage behavior.

## Launch

Run from the repository root. Prerequisites are Node 20 or later, npm, `zip`, macOS, and Zotero 10.0.x. The helper defaults to `/Applications/Zotero.app/Contents/MacOS/zotero`; set `ZOTERO_BIN` to another installation's executable if necessary. `VERIFY_CODEX_BIN` can select the actual Codex executable. Otherwise the helper uses `which codex`, and the plugin retains its normal auto-detection fallback.

```sh
verify_control="$PWD/.cursor/skills/verify-zotero-codex/scripts/control.mjs"
verify_run="$PWD/output/verification/$(date -u +%Y%m%dT%H%M%SZ)-permissions"
"$verify_control" launch --run "$verify_run"
"$verify_control" doctor --run "$verify_run"
```

`launch` runs the repository's `npm run check` and `npm run build`, installs that XPI in a new profile, and starts Zotero with `--new-instance --profile … --marionette --remote-allow-system-access -ZoteroDebugText`. It prints `"ready": true` only after the plugin initializes and the doctor passes. The profile chooses a free Marionette port, disables Zotero's connector HTTP server and automatic sync, and directs both the Zotero database and Codex storage into this run's `scratch/`. Authentication is empty. It does not import the user's library, settings, or login.

Each run needs a fresh directory. Several independent profiles can coexist, but only one agent may drive a given `instance.json`. Never attach this helper to the daily Zotero profile or its running Codex process. Native OS file dialogs can belong to another instance; confirm the fixture paper and window before using them. This recipe has been exercised on macOS with Zotero 10.0.5. Treat Windows and Linux control as unverified.

Teardown is `"$verify_control" cleanup --run "$verify_run"`. Run cleanup after every failed iteration too. A command sandbox may need host permission for local TCP, GUI launch, and process inspection. Request that narrowly for this helper with the isolated run path; do not fall back to the daily app.

## Doctor

```sh
"$verify_control" doctor --run "$verify_run"
```

This reads the Marionette session's PID and profile, the live Zotero data directory, plugin presence, active installed add-on version, Codex storage and working directories, and the packaged source fingerprint. All must match `instance.json`. A source change after launch requires cleanup and a new build. `connected: false` is normal before opening the sidebar and does not invalidate local controls; it also does not prove an authenticated model connection. Doctor does not send a prompt or change preferences.

## Drive

The executable helper uses the installed Zotero's Marionette protocol, with no downloaded WebDriver dependencies. It selects the real `zoteroPane.xhtml` window, uses WebDriver pointer actions for clicks, and dispatches input/change/keyboard events to the production DOM controls. Zotero's virtualized tree requires pointer down/up; a bare DOM `click()` is insufficient. A windowless Marionette session avoids Firefox's browser-window startup wait. Zotero's chrome windows still render normally.

Run the complete local permission proof once:

```sh
"$verify_control" prove --run "$verify_run"
```

It seeds two disposable journal articles through Zotero's supported Item API, then selects a visible item row and opens the Codex sidenav using pointer actions. Seeding supplies data only. The actual proof uses the production permission button, file-access select, and `/approvals` composer command. It asserts the panel reopens with `workspace-write`, checks the stored preference independently, saves screenshots, and confirms that no chat session was created. It sends no model turn. Network initialization is possible when the sidebar connects; this is not a network-isolation test.

For other mapped features, use these commands against the same owned instance:

```sh
"$verify_control" snapshot before-action --run "$verify_run"
"$verify_control" click '.zcs-permissions-trigger' --run "$verify_run"
"$verify_control" select '.zcs-permission-field:nth-of-type(3) select' workspace-write --run "$verify_run"
"$verify_control" fill '.zcs-input' /approvals --run "$verify_run"
"$verify_control" key '.zcs-input' Enter --run "$verify_run"
"$verify_control" snapshot after-action --run "$verify_run"
```

`seed` creates the two articles without driving a feature. Use it once per fresh run. `windows` lists native window URLs. `--window preferences` selects the native Zotero settings window after a user action opens it. `check SELECTOR true|false` toggles a checkbox through its click event. `read SCRIPT_FILE` executes a JavaScript body that returns observations from the selected window. Keep those scripts read-only. The bundled proof's preference flush is evidence collection, not a substitute for changing a control.

Before using selectors, inspect the current DOM snapshot. Classes and `data-l10n-id` handles survive English/Chinese localization; translated button text may not. Scope selectors to the active item-details pane if library and PDF views coexist. The helper rejects hidden or disabled targets. It does not drive a native file picker, select PDF text, or synthesize clipboard images. Use available native app control for those actions and pair its screenshots/action record with this helper's resulting DOM snapshot. Report such entry points as untested if native control is unavailable.

Real reply, history, and image-generation tests need a login in the scratch Codex directory. Configure it through Zotero Settings → Codex's one-time login import, or sign in with the CLI configured for that directory. Keep credentials out of evidence. Preserve the isolated storage and working directory when changing other settings. The permission smoke needs no login; passing it says nothing about remote model availability, tool approvals, or generated images.

## Evidence

Evidence lives in `output/verification/<run>/` outside `scratch/`. The helper writes:

- `instance.json` and `doctor.json` identify the PID, build/version, package/source hashes, and isolated paths.
- `check.log`, `build.log`, and `zotero.log` record package validation and native startup.
- `actions.jsonl` records each attempted control action, its result, observations, and snapshots.
- `<label>.dom.json` records visible controls, roles, labels, values and dialog state. This is a DOM/ARIA attribute inventory, not a complete accessibility-tree dump.
- `<label>.png` captures the native Zotero chrome window. Inspect the pixels as well as assertions.
- `fixtures.json` identifies the seeded papers. `permissions-proof.json` records the feature, both tested entries, preference persistence and absence of a chat session.
- `cleanup.json` records removed scratch state and the surviving evidence files.

Capture the action and resulting state. A final screenshot alone is insufficient. For writes, verify the stored result independently through a file, read-only query, or a reopened user view. A real chat proof needs the rendered user message, response, stored session and reopening behavior. Never replace the client with the preview's simulator, call sidebar setters, or fabricate transcript entries to prove user behavior. The baseline smoke uses the real plugin and CLI boundary without a mocked server.

For dry-run or test-mode paths, observe files, sessions, network activity or external objects to establish what the mode actually skips. This helper's default empty login does not guarantee zero network traffic. Record exact failures and skipped entry points; do not count another entry point as their proof.

Repository unit tests are separate evidence. Run `npm test` and record its exit status when the change affects covered behavior. A native proof does not erase failing unit tests, and passing unit tests do not prove native behavior.

The initial executed proof and its limits are recorded in [verification.md](verification.md).

## Cleanup

```sh
"$verify_control" cleanup --run "$verify_run"
test ! -e "$verify_run/scratch"
test -s "$verify_run/permissions-proof.json"
test -s "$verify_run/permissions-slash-entry.png"
test -s "$verify_run/actions.jsonl"
```

Cleanup verifies that the recorded PID's command still names this profile, stops that PID and its captured descendants, and removes only `scratch/`. It never kills by process name. If ownership cannot be established or a process does not exit, it preserves scratch state and reports failure. Repeated cleanup is safe. Proof files survive. On a failed run the successful-proof files may not exist; retain its logs and failure captures instead.

`prove` captures a failure snapshot and attempts cleanup automatically when it fails. Check the reported cleanup result before starting another iteration; other manually driven commands still need explicit cleanup.

## Helpers

All invocations above use [scripts/control.mjs](scripts/control.mjs), which is executable and uses only Node built-ins. Its commands are `launch`, `doctor`, `windows`, `seed`, `prove`, `click`, `fill`, `key`, `select`, `check`, `snapshot`, `read`, and `cleanup`; each accepts `--run DIRECTORY`. UI commands also accept `--window preferences`.

After application changes, use `/maintain-verification-skill` to update the feature map and rerun the affected native paths.
