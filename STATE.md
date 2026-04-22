# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Resume Note.

## Current Focus
v0.1 close-out: keep the desktop / VS Code / TUI surfaces aligned to one shared `QuestState`, then move the remaining work into prompt-file externalization, CLI workflow tooling, and schema v2 prep. v0.2 wedge work starts only after the v0.1 punch list is green.

## Last Session
- Desktop shell is now in a usable state: packaged rebuild succeeds, the direct exe in `release\win-unpacked\Repo Quest Log.exe` is the preferred test target, click-to-open works, and the shell has in-app refresh + window controls.
- Desktop readability pass landed in `src/web/render.ts`: larger defaults, clearer agent chips (`CX` / `CL` / `GM`), less cryptic Ctrl+K copy, and better header-strip fit without outer scroll.
- Repo-level excludes are now live via `.repolog.json`; `archive` / `archives` / `archived` are ignored by default so stale docs stop polluting Recent changes.
- Shared workflow helpers were centralized into `src/engine/prompts.ts`, `src/engine/changes.ts`, `src/engine/time.ts`, and `src/engine/editor.ts` so the TUI, desktop shell, and renderer stop duplicating prompt and recent-change logic.
- Desktop click-to-open now tries exact-line `code -g` opens before falling back to the system file handler, and the same path is exercised by the VS Code view via the shared change-merging helper.
- Fixture coverage now includes a noisy repo with malformed config plus archived markdown, and the tests assert the extractor keeps the useful signals while ignoring the archived tree.
- The docs now carry a live percent tracker in `plan_implementation.md`, and `CLAUDE.md` has been repointed to own the rest of that handoff.
- `npm run build`, `npm run lint`, and `npm test` are green.

## Resume Note
> Shared prompt presets and the desktop line-open path are consolidated. The next doc-driven step is prompt-file externalization plus CLI workflow tooling, with `plan_implementation.md` now acting as the live handoff for the remaining work.

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
