# CHANGELOG

## 0.0.4 - 2026-04-22

- Live git panel: branch, ahead/behind, dirty count, last commit subject, and relative age.
- Agent activity feed: inferred recent file ownership from markdown-owned areas and change history.
- Standup export: `repolog standup [--since=today|yesterday|7d] [--copy] [--json]` plus one-keypress copy in TUI, desktop, and VS Code.
- Opt-in write-back: checkbox toggles only, gated by `.repolog.json` and guarded by exact-line safety checks.
- Schema v2: `objective` rename, `gitContext`, `agentActivity`, and `config.writeback` with `activeQuest` compat shim.
- VSIX packaging: `npm run pack:vscode` now emits `release/repo-quest-log-0.0.4.vsix` alongside the Windows release flow.
- Ship/shareability polish: install docs, version bump to `0.0.4`, and first-run empty-state parity coverage.
