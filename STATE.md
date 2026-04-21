# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Resume Note.

## Current Focus
v0.1 close-out: fit-to-window desktop layout, TUI visual parity with the desktop HUD, and renaming "Active Quest" → "Objective" in UI copy. v0.2 wedge (resume-prompt palette, git panel, agent activity feed, standup export, opt-in write-back) begins only after the v0.1 punch list is green.

## Last Session
- User reported the desktop shell still scrolled vertically at near-full screen and felt like a "Word doc" instead of a tool — wanted cockpit density, info-at-a-glance
- Claude took the wheel on desktop UI/UX and rewrote `src/web/render.ts`:
  - Killed outer scroll for real — new grid is `auto auto auto 1fr` with a single-row 3-column board, no `auto`-rowed bottom tile
  - Collapsed mission + objective + resume into one compact top strip with left-edge color accents (blue / green / amber)
  - Added cockpit stat bar: `● 3 NOW · ○ 5 NEXT · ⏸ 1 BLOCKED · N AGENTS · N FILES WATCHED · tail context`
  - Task rows are now single-line with a colored priority bar, agent chip, and doc chip — truncated to line with hover tooltip — scans by shape not reading
  - Board columns: (Now + Blocked stacked) | (Next + Recent changes stacked) | (Agents full-height)
- Pulled **resume-prompt palette forward into v0.1** (was v0.2): `Ctrl+K` opens an overlay with 6 presets — Resume for Claude / Codex / Gemini, Daily standup, Blocker summary, Repo intent briefing. Each builds its message from live QuestState and copies to clipboard. Toast confirms the copy.
- "Active Quest" → "Objective" label done in desktop copy (schema key stays `activeQuest` until v0.2 schema v2)
- Updated tests for the new layout expectations; all 11 tests pass, `tsc` clean

## Resume Note
> In-flight: HUD v2 polish batch. #7 landed — `Decision { at, text, doc, line? }` added to QuestState, heuristic extractor pulls bullets under `/recent decisions|decisions|decision log/i` from STATE.md or `*_log.md`, and a right-column Decisions tile renders the latest 5 with inline "show all" expansion (hidden entirely when empty).

Last touched: `src/web/render.ts`

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
