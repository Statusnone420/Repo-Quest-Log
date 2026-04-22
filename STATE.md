# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Resume Note.

## Current Focus
v0.1 close-out: keep the desktop / VS Code / TUI surfaces aligned to one shared `QuestState`, then move the remaining work into prompt-file externalization, CLI workflow tooling, and schema v2 prep. v0.2 wedge work starts only after the v0.1 punch list is green.

## Last Session
- CLAUDE.md role unlocked: Claude now plans AND implements (build/lint/test gate still required).
- Foundation pass closed: TUI visual parity confirmed landed in `src/tui/App.tsx`, PLAN.md reconciled to source, tracker bumped to 100% for that pass.
- Prompt externalization landed: `loadPromptPresets` in `src/engine/prompts.ts` merges built-ins with `~/.repolog/prompts/*.md` (user) and `<repo>/.repolog/prompts/*.md` (repo-wins). Markdown frontmatter + `{{var}}` template rendering.
- `RepoConfig` expanded: now parses `writeback: boolean` and `prompts.dir?: string` from `.repolog.json` (still back-compat with plain excludes files).
- New CLI surfaces: `repolog status --short`, `repolog prompt list`, `repolog prompt <id> [--copy]` (clipboard via `clip`/`pbcopy`/`xclip`).
- `npm run build`, `npm run lint`, `npm test` all green (20 tests, 10 files).

## Resume Note
> Prompt loader + `repolog prompt` / `repolog status --short` shipped. Next slice: wire the TUI and desktop Ctrl+K palettes to `loadPromptPresets` so external overrides show up in-app, then start `repolog doctor`.

Last touched: `src/engine/prompts.ts`

## Recent Decisions
- TypeScript over Rust for v0.1 (faster iteration, Ink for TUI)
- chokidar over fs.watch (cross-platform reliability)
- Heuristic extraction only in v0.1; structured frontmatter mode is opt-in
- Desktop and VS Code shells consume one shared HTML renderer so layout decisions stay synchronized
- Windows desktop host is Electron for now; macOS deferred to v0.3+
- Drop the RPG metaphor from UI copy; keep the brand
- Resume-prompt palette is the v0.2 wedge — everything else in v0.2 serves it or is cut
- Opt-in write-back allowed from v0.2, scoped strictly to checkbox toggles, off by default, with a persistent on-screen banner when on
- `.repolog.json` excludes are acceptable in v0.1 as a repo-legibility control; no full settings UI yet
- Timers, pomodoros, streaks, and any gamification are permanently out of scope
