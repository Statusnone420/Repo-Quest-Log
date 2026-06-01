# CHANGELOG

## v0.5.0 - 2026-06-01

### Features
- Desktop now keeps the same RepoLog HUD for normal, messy, and partially documented repos instead of replacing weak repos with a separate onboarding dashboard.
- Added a compact Repo Context panel with detected repo type, manifest, git status, missing planning docs, docs found, source preview, and inline setup actions.
- Generic repos now show sparse Objective, Resume, Now, Agent Docs, and Prompt Palette surfaces with calm repair guidance instead of judgment copy.
- Retired root `CLAUDE.md` and `GEMINI.md` guidance now lives in `docs/Archived/agent-docs/` with a README explaining keep-vs-delete handling for historical agent docs.
- Agent docs can now be marked `status: archived` so old tool guidance stays visible as reference without driving active workspace scope.
- Package, desktop, and VS Code extension metadata are bumped to 0.5.0 for the next release train.

### Fixes
- Removed the full-screen "not agent-ready" takeover path that made first open feel like a failed setup flow.
- Fallback copy now explains missing PLAN.md or STATE.md context inside the normal panels.
- Source-only repos with no markdown docs now render the normal HUD instead of the first-run empty state.
- Generic-repo web coverage now asserts the standard board remains visible and setup help is inline.

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
