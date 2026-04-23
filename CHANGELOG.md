# CHANGELOG

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
