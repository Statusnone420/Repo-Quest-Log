# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Session Anchor.

## Current Focus
Core engine is landed. Active work is hardening the live shells, making the TUI resize correctly, and keeping the desktop shell readable on large monitors without breaking the shared `QuestState` contract.

## Last Session
- Landed the shared web HUD renderer in `src/web/render.ts`
- Added a real Windows desktop host at `apps/desktop/` using Electron + the shared renderer
- Added a real VS Code side-panel shell at `extensions/vscode/`
- Fixed TUI continuation wrapping so long task lines stop duplicating their numeric prefixes
- Kept desktop snapshot generation (`repolog desktop`) on the same renderer the desktop app and VS Code panel consume
- Made the TUI width/height-aware instead of hard-coding a 110-char frame
- Added desktop display controls for zoom and density so the HUD is readable from farther away
- Made the desktop window launch maximized against the current work area instead of a fixed preview size
- Wired the density buttons to real CSS spacing/type-scale changes instead of dead controls

## Resume Note
> Was about to finish packaging the desktop host or wire click-to-open links, then decide whether the VS Code panel needs the same treatment first.

Last touched: `src/tui/App.tsx`

## Recent Decisions
- TypeScript over Rust for v0.1 (faster iteration, Ink for TUI)
- chokidar over fs.watch (cross-platform reliability)
- Heuristic extraction only in v0.1; structured frontmatter mode is an opt-in convention, not a requirement
- Desktop and VS Code shells consume one shared HTML renderer so layout decisions stay synchronized
- Windows desktop host is Electron for speed now; macOS can later reuse the same renderer inside a Swift host
