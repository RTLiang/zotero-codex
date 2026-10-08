# Zotero runtime settings

Goal: expose proxy, executable, work directory and isolated Codex storage in Zotero preferences.
Non-goals: modify the global Codex configuration, move existing chats, or replace the app-server protocol.

Decisions:
- Preserve inherited environment and shared storage by default for existing installs.
- Explicit direct/manual proxy modes override all six proxy environment variables; manual URLs cannot contain credentials.
- Dedicated CODEX_HOME stores sessions, SQLite, config and auth together. Work directory is independent.
- Optional one-time local login import copies only auth.json into private storage, never overwrites it, and never logs its contents. Future login/refresh belongs to the chosen storage.
- Paper bindings are scoped to CODEX_HOME. Existing shared bindings remain intact.
- Apply changes only while idle, detach/recreate sidebar views while retaining the registered section, and reconnect to avoid stale in-memory thread IDs. Preserve text/image drafts.
- Keep runtime/environment policy in a new focused module. The existing >3,000-line sidebar is changed only at its view lifecycle, paper-directory and settings UI boundaries; broad decomposition is outside this feature.
- Keep upstream version fields unchanged; release automation owns versioning. A local test XPI uses a separate version suffix to avoid replacing the installed build accidentally.

Progress:
- Baseline: 47 tests and static checks passed.
- Implemented preferences, runtime environment, isolated binding storage and idle reconnection.
- 60 tests and static checks passed, including invalid settings, active-request rejection and reconnect failures.
- Zotero 10.0.6 / Linux / Codex CLI 0.161.0: actual preference page, direct-mode child environment, manual proxy, local login import and independent SQLite/session storage verified.
- Real sidebar paper-summary response: first visible text 11.476 seconds, completion 12.557 seconds (single run, not a benchmark).
- Shared → dedicated → shared → dedicated switching restored the appropriate conversations; an unsent text draft survived proxy changes.
- Final packaged-build restart restored the existing conversation; a follow-up completed in 18.986 seconds and both user turns remained in one session file.
- Upstream PR #2 submitted; no account data, local screenshots or user-specific configuration is included.
- Fixed cross-compartment MutationObserver options in PDF selection popups. An exception previously aborted Zotero’s sequential reader event dispatch before Translate for Zotero could run. Popup tracking failures now clean up and report the cause without blocking other plugins.
- Set single-click event detail when revealing the Codex pane from a PDF selection.
- 63 tests, static checks and packaging passed. With Translate for Zotero 2.4.8, a real PDF selection popup displayed DeepL Free translation alongside Add to Codex; the selected text was successfully attached to the Codex conversation.
- Windows/macOS native runtime and keyring-only login import are not verified; keyring-only users must sign in separately.

Verification: environment/path/scoping regression tests, existing suite, real Zotero preference page, actual sidebar response and session location.
Rollback: restore backed-up XPI and runtime preferences; shared history and global Codex files remain untouched.
