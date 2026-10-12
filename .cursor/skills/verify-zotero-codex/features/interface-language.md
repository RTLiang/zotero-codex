# Interface language

The plugin offers Follow Zotero, English, and 简体中文 for its own controls. The choice is saved independently of Zotero's application language and does not set the language of model replies.

## Sub-features

- `sidebar-choice` switches the visible sidebar immediately and updates an open chat or settings page.
- `native-preferences-choice` switches Codex's native preferences and open sidebar without requiring Save and reconnect.
- `follow-host` restores Zotero's application locale and persists the selected mode.
- `reader-entry` applies the same choice in the PDF reader's item pane.

## How to get to it (user POV)

- Open a paper in the library, then Codex's sidebar Settings → Interface → Language.
- Or open Zotero Settings → Codex → Interface → Language.
- Select Follow Zotero, English, or 简体中文. Reopen the sidebar to confirm the choice persisted. Repeat in the PDF reader's sidebar.

## Driving it with control.mjs and native app control

- Launch a fresh isolated profile and run doctor. Seed a disposable paper, select its visible row, and open the Codex sidenav. Capture `snapshot language-before --run "$verify_run"` and check the host chrome language separately.
- Click `.zcs-more-button` (the sidebar's Settings button, `zotero-codex-settings-button`) to open the sidebar settings page, then `select '.zcs-language-select' zh-CN --run "$verify_run"`. Capture `snapshot language-zh --run "$verify_run"`. The plugin settings title, section labels, and option text should be Chinese while Zotero chrome remains in its original language.
- Open the chat page, capture its localized title and composer placeholder, then reopen Settings. Switch to `en-US`; capture the same controls in English. Use `read` only to inspect the stored `extensions.zotero.codexSidebar.language` preference independently, not to change it.
- Open Zotero Settings → Codex using the sidebar link. The sidebar settings page is open after the language step, so `click '[data-zcs-l10n-id="zotero-codex-runtime-settings"]' --run "$verify_run"` leaves for native preferences. `windows` must show the preferences window. Use `select '#codex-setting-language' zh-CN --run "$verify_run" --window preferences`, then capture both native preferences and the sidebar. Repeat with `auto`, and check the saved preference plus the displayed host-language strings.
- On a separate fresh profile, seed/open a disposable PDF through the reader path described in the main skill. Switch the PDF reader sidebar's `.zcs-language-select`, capture its plugin strings, and verify the stored choice. Keep the PDF fixture and profile disposable.
- Run cleanup. Keep the screenshots, DOM snapshots, action log, and independent preference observation outside `scratch/`.

## Gotchas

- UI labels use stable `data-zcs-l10n-id` attributes. Explicit language removes native `data-l10n-id`, so selectors based only on that attribute fail after switching.
- `.zcs-more-button` opens the sidebar settings page directly. It is not a menu. `.zcs-settings-navigation` is the Proxy and storage row inside that page, and clicking it opens native preferences. It is not part of the language switch, and it does not exist while the chat page is showing.
- A translated empty state or settings page proves interface strings only; it does not prove a model's reply language.
- A screenshot after a switch does not prove persistence. Reopen the view and inspect the saved preference.
- Library and PDF-reader sidebars are separate native entry points; report either one as unverified when it was not driven.
