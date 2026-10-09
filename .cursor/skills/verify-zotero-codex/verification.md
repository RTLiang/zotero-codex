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
