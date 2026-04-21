# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Resume Note.

## Current Focus
v0.1 close-out: fit-to-window desktop layout, TUI visual parity with the desktop HUD, and renaming "Active Quest" → "Objective" in UI copy. v0.2 wedge (resume-prompt palette, git panel, agent activity feed, standup export, opt-in write-back) begins only after the v0.1 punch list is green.

## Last Session
- Planner pass with Claude Design took the app from "good" to "close to great"
- Confirmed the packaged Windows exe in `release-fresh/` is the canonical build
- Agreed to drop the RPG metaphor from UI copy (panels become Objective / Now / Next / Blocked / Agents / Recent changes); product name stays
- Ranked v0.2 features around the agent-integration wedge: resume-prompt palette is the killer; git panel, agent activity feed, standup export, and opt-in write-back round it out
- Ruled out timers / pomodoros / gamification permanently
- Opted in to scoped write-back (checkbox toggles only, gated by `.repolog.json`) starting v0.2
- Rewrote `PRD.md`, `PLAN.md`, `docs/SCHEMA.md` (v2 draft), and this file to reflect the new plan
- Queued the first Codex handoff: fit-to-window responsive desktop in `src/web/render.ts` + `apps/desktop/`
- Codex landed the fit-to-window desktop shell pass with viewport-aware density, inner-panel scroll fallback, and tighter Electron window bounds

## Resume Note
> About to hand off the fit-to-window desktop layout to Codex (responsive density + inner-panel scroll fallback so the shell never shows an outer scrollbar). After that lands, TUI visual parity and the "Active Quest" → "Objective" copy rename are the next two Now items.

Last touched: `PLAN.md`

## Recent Decisions
- TypeScript over Rust for v0.1 (faster iteration, Ink for TUI)
- chokidar over fs.watch (cross-platform reliability)
- Heuristic extraction only in v0.1; structured frontmatter mode is opt-in
- Desktop and VS Code shells consume one shared HTML renderer so layout decisions stay synchronized
- Windows desktop host is Electron for now; macOS deferred to v0.3+
- Drop the RPG metaphor from UI copy; keep the brand
- Resume-prompt palette is the v0.2 wedge — everything else in v0.2 serves it or is cut
- Opt-in write-back allowed from v0.2, scoped strictly to checkbox toggles, off by default, with a persistent on-screen banner when on
- Timers, pomodoros, streaks, and any gamification are permanently out of scope
