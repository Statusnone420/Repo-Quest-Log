# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Session Anchor.

## Current Focus
Core engine is landed. Active work is hardening the live shells and keeping desktop / VS Code pinned to the same shared renderer and `QuestState` contract.

## Last Session
- Landed the shared web HUD renderer in `src/web/render.ts`
- Added a real Windows desktop host at `apps/desktop/` using Electron + the shared renderer
- Added a real VS Code side-panel shell at `extensions/vscode/`
- Fixed TUI continuation wrapping so long task lines stop duplicating their numeric prefixes
- Kept desktop snapshot generation (`repolog desktop`) on the same renderer the desktop app and VS Code panel consume

## Resume Note
> Was about to package the desktop shell path, then tighten the VS Code panel refresh / click behavior and keep polishing TUI layout fidelity against the design mockup.

Last touched: `apps/desktop/main.cjs`

## Recent Decisions
- TypeScript over Rust for v0.1 (faster iteration, Ink for TUI)
- chokidar over fs.watch (cross-platform reliability)
- Heuristic extraction only in v0.1; structured frontmatter mode is an opt-in convention, not a requirement
- Desktop and VS Code shells consume one shared HTML renderer so layout decisions stay synchronized
- Windows desktop host is Electron for speed now; macOS can later reuse the same renderer inside a Swift host
