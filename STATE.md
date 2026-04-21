# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Session Anchor.

## Current Focus
Defining the `QuestState` schema and wiring the file watcher. Everything else is blocked on the schema freeze.

## Last Session
- Drafted `docs/SCHEMA.md` v0 — needs review before Codex starts on `normalize.ts`
- Dropped the design mockup into `docs/design/`

## Resume Note
> Was about to replace polling with a debounced change-stream in `src/engine/watcher.ts`. 250ms feels right; test against a repo with a noisy formatter-on-save.

Last touched: `src/engine/watcher.ts` (does not exist yet — scaffolded by task 6)

## Recent Decisions
- TypeScript over Rust for v0.1 (faster iteration, Ink for TUI)
- chokidar over fs.watch (cross-platform reliability)
- Heuristic extraction only in v0.1; structured frontmatter mode is an opt-in convention, not a requirement
