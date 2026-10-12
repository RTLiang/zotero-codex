# Verification

- After changing Zotero runtime behavior, read `.cursor/skills/verify-zotero-codex/SKILL.md` and the affected feature recipe. Run the relevant native Zotero path in an isolated profile, and inspect its actions, resulting state, and screenshots. Run `npm test` when the changed behavior has test coverage.
- For documentation, CI, and other changes without an affected native user path, run the applicable checks. If a relevant native path cannot be run, record the reason and the remaining unverified behavior. Passing static checks or the browser preview does not establish native behavior.
- Put the verification report in the pull request description under **Verification**. State the checks and native entry points run, their results, links to evidence reviewers can access, and any skipped paths or limitations. Report failed checks explicitly. Do not add a verification report or generated evidence to Git; keep credentials and the isolated profile's `scratch/` directory out of the PR.

# Documentation

Committed docs cover the change, its decisions, and its checks. Leave agent process notes, skill references, and run logs out of them.
