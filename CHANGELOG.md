# CHANGELOG

## v0.5.0 - 2026-06-01

### Features
- Desktop now keeps the same RepoLog HUD for normal, messy, and partially documented repos instead of replacing weak repos with a separate onboarding dashboard.
- Added a compact Repo Context panel with detected repo type, manifest, git status, missing planning docs, docs found, source preview, and inline setup actions.
- Added the Full Signal System visual pass: `Workspace Signals` now owns automatic read-only agent work modes (`Building`, `Reviewing`, `Researching`, `Idle`) with live evidence, 5m/15m/30m activity timeline windows, scope map lanes, Agent Docs health rails, readiness meters, and lazy diff preview drawer.
- Generic repos now show sparse Objective, Resume, Now, Agent Docs, and Prompt Palette surfaces with calm repair guidance instead of judgment copy.
- Retired root `CLAUDE.md` and `GEMINI.md` guidance now lives in `docs/Archived/agent-docs/` with a README explaining keep-vs-delete handling for historical agent docs.
- Agent docs can now be marked `status: archived` so old tool guidance stays visible as reference without driving active workspace scope.
- Package, desktop, and VS Code extension metadata are bumped to 0.5.0 for the next release train.

### Fixes
- Removed the full-screen "not agent-ready" takeover path that made first open feel like a failed setup flow.
- Fallback copy now explains missing PLAN.md or STATE.md context inside the normal panels.
- Source-only repos with no markdown docs now render the normal HUD instead of the first-run empty state.
- Generic-repo web coverage now asserts the standard board remains visible and setup help is inline.
- Packaged desktop `--repo-root <path>` now works again instead of dropping the flag and falling back to the saved last-opened repo.
- Desktop now has an explicit top-bar `Switch Repo` button, because the repo name was only text and was not a working affordance.
- Settings now clearly separates repo-local config writes from app-only settings, and labels `.repolog/CHARTER.md` as an optional repo guide instead of raw jargon.
- Workspace Signals now uses neutral labels (`Review scope`, `High churn`, `Outside scope`, `Edit churn`) and only escalates broader outside-scope activity or heavy repeated edits.
- Workspace mode moved out of the top bar and into `Workspace Signals` as inferred status, so users cannot manually force stale agent-work states.
- Workspace mode and timeline window choices stay app-local, and diff previews use capped read-only Git calls instead of doing full diff work during scans.
- Desktop activity watching now ignores `release/` and `.repolog/` so packaging output and RepoLog support files do not flood the app with rebuild events.
- Added `npm run test:release-smoke` for disposable temp-repo checks before release uploads.

### Breaking Changes
- None.

## v0.4.0 - 2026-04-23

### Features
- First-run wizard now appears only when PLAN.md is missing and can generate PLAN.md, STATE.md, or .repolog.json from the desktop setup card.
- Settings UI can edit excludes, write-back, prompt directory, debounce, and file-change reporting without manual JSON edits.
- Doctor findings now include plain-language `why` and `fix` guidance so new users know what to add next.
- Watcher and write-back paths are hardened for config changes, file deletion, stale checklist lines, and same-file write queues.
- Desktop startup accepts `--repo-root <path>` and `--version` for release and portable-exe workflows.

### Fixes
- Wizard actions disable immediately while template writes are running and expose a "Run Doctor Again?" action after setup changes.
- Settings validation errors now appear inline instead of only as toasts.
- VS Code config saves now reply with `configSaved` or `error` messages that the shared renderer can handle.
- Watcher errors are logged with context and desktop users see "File watch lost sync; re-scanning."
- Write-back stale-line failures now return "Line has changed since last read; re-scan required" and trigger a renderer rescan.

### Breaking Changes
- None.
