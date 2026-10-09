# Initial native proof

On 2026-10-09, the generated helper completed launch, doctor, the mapped permission feature, screenshot inspection, cleanup and evidence-survival checks on macOS with Zotero 10.0.5 and plugin 2026.282.2.

Evidence directory for the final helper: `output/verification/20261009-final/`. The earlier successful iteration remains in `output/verification/20261009-permissions-5/`.

- `doctor.json` records the native plugin, installed package version, PID and isolated profile/data/runtime/workspace paths.
- Packaged source SHA-256 was `ddcfa67bac1ce4374531d349d7b808a034762950f48f0285dce786c3c4bb043b`. XPI SHA-256 was `c86128646253239afd317a6511e86149e1b94f21680c9d713e4da217bf78bb8f`.
- `actions.jsonl` records fixture-row selection, Codex sidenav navigation, the permission button, the file-access change, Escape, `/approvals`, Enter and the resulting captures.
- `permissions-button-entry.png` and `permissions-slash-entry.png` show the actual Zotero sidebar. The latter visibly shows Write in the working folder and the Workspace footer. Its DOM inventory confirms the dialog state.
- `permissions-proof.json` confirms the stored access preference, the matching value in the saved preferences file, an empty composer, zero transcript messages, and no session files created.
- `cleanup.json` confirms scratch removal. The proof JSON, action record and four screenshots were checked again after cleanup.
- The repository test run recorded 107 tests passed, zero failed in this run's `tests.log`. Static checks and the package build passed in `check.log` and `build.log`.

This proves the permission button and `/approvals` path in the library item pane, with preference persistence. It does not prove real model responses, actual tool approval handling, PDF-reader selections, OS notifications, image generation, proxy routing or Windows/Linux operation. Those entries remain mapped for later feature-specific runs.

Earlier failed iterations are retained separately with logs and cleanup records. They identified the virtualized tree's `treeitem` role, pointer-action requirements, and escaping in Zotero's generated `data-pane` value. A source change also caused the doctor to reject a stale instance as intended. No failed iteration counts as a successful feature proof.

## Shared permission choice controls

On 2026-10-09, permission fields were replaced with the same button/list implementation as Model and reasoning. The initial proof above assigned a native select value and dispatched change; it did not establish that the native dropdown opened under a mouse click. The updated proof uses pointer clicks to open each list and choose all eight options across policy, reviewer and file access.

Successful evidence is in `output/verification/20261009-permission-choices-reader-4/` for the PDF-reader entry and `output/verification/20261009-permission-choices-library-2/` for the library entry. Both ran in isolated Zotero 10.0.5 profiles, checked stored preferences and selection checkmarks, kept the permission panel open after selection, exercised full-access network behavior and reopened the panel through `/approvals`. Both profiles were cleaned; screenshots, action records and proof JSON survive.

The reader run also used pointer clicks to select the actual CLI-listed `gpt-6-sol` model and `high` effort. `model-effort-changed.png`, its DOM inventory and the read observation in `actions.jsonl` confirm both saved values, matching selected options and footer text, with zero messages. The reader package was 2026.282.3; the final library package was 2026.282.4. Product files under `content/` were identical across those builds; the packaged manifest version changed.

The final test log `output/verification/20261009-permissions-final-tests.log` records 112 passed, zero failed. Native launch checks and packaging passed. Failed reader iterations remain separate: one test instance exited before reconnection, and the others exposed hidden library-pane selection and escaping in the harness. They are not successful permission proofs. These checks cover local controls and persistence, not model responses or actual tool approval requests.
