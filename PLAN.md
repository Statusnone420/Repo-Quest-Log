# PLAN.md

One sentence: **what this repo is trying to become.**
> A local-first CLI + TUI that makes repo intent legible at a glance for developers working with coding agents.

## Active Quest
Ship the first usable multi-surface Repo Quest Log shells

## Current Objective
Keep all surfaces pinned to one shared `QuestState` pipeline and one design source of truth.

## Now
- [ ] Harden the TUI wrapping / spacing so no panel content gets visually mangled on real repos
- [ ] Turn the Windows desktop shell into a packaged app path on top of the shared HUD renderer
- [ ] Finish the VS Code side-panel shell so it live-refreshes from the active workspace

## Next
- [ ] Add a packaging path for Windows desktop builds
- [ ] Decide whether macOS ships as SwiftUI + WKWebView host or a native Swift redraw of the same layout
- [ ] Add click-to-open doc links in desktop and VS Code shells
- [ ] Add fixture coverage for noisy / imperfect repo docs
- [ ] Tighten recent-changes diff metadata when git context is available

## Blocked
- [ ] Publish npm package `@repo-quest/core` — **need npm org + CI secrets**

## The 7 build tasks (in order)

1. [x] **Define supported file names and heading patterns.** `src/engine/fileset.ts`
2. [x] **Parse markdown into sections and checklists.** `src/engine/parse.ts`
3. [x] **Build a normalizer that maps `ParsedDoc[]` into one shared `QuestState` JSON.** `src/engine/normalize.ts`
4. [x] **Rank tasks into Now / Next / Blocked.** `src/engine/rank.ts`
5. [x] **Build the Agents panel from `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`.** `src/engine/agents.ts`
6. [x] **Add file watching and auto-refresh.** `src/engine/watcher.ts`
7. [x] **One-line `resume_note` generated from the top active task + last-touched file.** folded into `src/engine/normalize.ts`

Core engine is complete. Current work is surface hardening and host shells.

## Build order after core

1. CLI: `repolog scan .` → prints JSON
2. TUI: `repolog` / `repolog watch` → live terminal HUD
3. Desktop shell: `npm run desktop:app -- .` → Electron host over the shared HUD renderer
4. VS Code extension: `extensions/vscode/` → live side panel over the same `QuestState`
5. Publish as `@repo-quest/core` + `repo-quest-log` binary

## Out of scope for v0.1

Source-code parsing · automatic markdown write-back · LLM summarization · multi-repo dashboards · team sync · cloud anything · plugin marketplace · settings UI · theming.
