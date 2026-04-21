# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Session Anchor.

## Current Focus
Core engine is landed and the first usable CLI + watch TUI path is wired. Next is product hardening and companion surfaces.

## Last Session
- Drafted `docs/SCHEMA.md` v0 — needs review before Codex starts on `normalize.ts`
- Dropped the design mockup into `docs/design/`
- Implemented `src/engine/normalize.ts` and `src/engine/watcher.ts`, plus fixture-backed vitest coverage
- Added `src/engine/rank.ts` and a `repolog` bin alias
- Wired `parse.ts`, `agents.ts`, `scan.ts`, `repolog scan`, and `repolog --watch` / `repolog watch`

## Resume Note
> Was about to harden the TUI against real-world repo noise and start the desktop / VS Code companion surfaces on top of the shared `QuestState` scan pipeline.

Last touched: `src/engine/watcher.ts`

## Recent Decisions
- TypeScript over Rust for v0.1 (faster iteration, Ink for TUI)
- chokidar over fs.watch (cross-platform reliability)
- Heuristic extraction only in v0.1; structured frontmatter mode is an opt-in convention, not a requirement
