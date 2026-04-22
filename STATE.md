# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Resume Note.

## Current Focus
v0.2 wedge is mostly landed in code: shared `QuestState` now carries `gitContext`, `agentActivity`, and `config.writeback`, and the desktop shell shows the git strip, agent feed, and safe checkbox write-back. Standup export is landed; the remaining open close-out slice is ship/shareability.

## Last Session
- Standup export landed across CLI, shared engine formatting, TUI, desktop, and VS Code webview. New CLI: `repolog standup [--since=today|yesterday|7d] [--copy] [--json]`. Standup copy hotkey is now `Ctrl+Shift+C` in the shared renderer, with the prompt-palette toast styling and a 2s timeout.
- CLAUDE.md role unlocked: Claude now plans AND implements (build/lint/test gate still required).
- Foundation pass closed: TUI visual parity confirmed landed in `src/tui/App.tsx`, PLAN.md reconciled to source, tracker bumped to 100% for that pass.
- Prompt externalization landed: `loadPromptPresets` in `src/engine/prompts.ts` merges built-ins with `~/.repolog/prompts/*.md` (user) and `<repo>/.repolog/prompts/*.md` (repo-wins). Markdown frontmatter + `{{var}}` template rendering.
- `RepoConfig` expanded: now parses `writeback: boolean` and `prompts.dir?: string` from `.repolog.json` (still back-compat with plain excludes files).
- Context enrichment landed: `gitContext`, `agentActivity`, `schemaVersion: 2`, and live git/activity rendering are wired through the shared `QuestState`.
- Safe write-back landed: checkbox-only toggles now write back through the desktop shell with stale-line refusal and exact-line safety checks.
- Desktop shell got a lighter ship pass: repo version is visible in the chrome, About is in the menu, and Windows build config now targets both NSIS and portable artifacts.
- Desktop shell now uses the repo icon from `build/icon.png` in both runtime and packaged builds.
- New CLI surfaces: `repolog status --short`, `repolog prompt list`, `repolog prompt <id> [--copy]` (clipboard via `clip`/`pbcopy`/`xclip`).
- Desktop shell: **Ctrl+O / File → Open Repo…** folder picker + persistent `last-root.txt` in Electron userData, so the exe is now a real portable HUD you can aim at any repo. Title bar reflects the active repo basename.
- `resolveDesktopRepoRoot` now accepts an optional `lastRoot`, falls back to it when cwd/exec paths have no markers, and accepts a bare user-picked directory when no marker ancestor exists.
- `npm run build`, `npm run lint`, `npm test` all green (30 tests, 13 files).

## Resume Note
> Standup export is now wired through the shared engine formatter and available from CLI (`repolog standup` with `--since`, `--copy`, `--json`) plus TUI, desktop, and VS Code via `Ctrl+Shift+C`. Shared `clip` / `pbcopy` / `xclip` clipboard helper deduped into `src/engine/clipboard.ts`. Next slice: 0.0.2 ship/shareability polish.

Last touched: `src/engine/standup.ts`

## Recent Decisions
- 2026-04-21 — `repolog doctor` is the trust layer for messy repos: it explains *why* state looks sparse and which exact heading to add. The CLI exits 1 when any warn-level finding fires, so CI can gate on it.
- 2026-04-21 — Heuristic drift: bare `## Objective` was silently invisible to the scanner even though SCHEMA.md promised it worked. Fixed in `fileset.ts` and SCHEMA extraction table updated to cite the real regex.

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
