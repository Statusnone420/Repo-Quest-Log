# PLAN.md

One sentence: **what this repo is trying to become.**
> A local-first CLI + TUI + desktop + VS Code shell that makes repo intent legible at a glance and hands that intent to whichever coding agent you open next.

## Objective
Close v0.1 with a fit-to-window desktop, a TUI that visually matches it, and clean panel labels — then ship the v0.2 agent-integration wedge (resume-prompt palette, git panel, agent activity feed, standup export, opt-in write-back).

## Current Focus
v0.2 is closed. CLI, TUI, desktop, and VS Code stay pinned to one shared `QuestState` pipeline and one renderer. Next session should start the v0.3 kickoff.
Detailed completion estimates now live in `plan_implementation.md`.

## Now — v0.1 close-out
- [x] Fit-to-window desktop: responsive density + inner-panel scroll fallback so the shell never shows an outer scrollbar on 1080p+ (agent: codex, touches: src/web/render.ts, apps/desktop/)
- [x] Desktop cockpit rewrite: compact top strip, stat bar, single-row 3-col board, priority-bar task rows (claude, touches: src/web/render.ts)
- [x] Resume-prompt palette (Ctrl+K) pulled forward from v0.2 — 6 presets, in-memory templates, clipboard + toast (claude, touches: src/web/render.ts)
- [x] Rename "Active Quest" → "Objective" in desktop UI copy (schema key stays `activeQuest` until v0.2 schema v2)
- [x] **TUI visual parity** — top strip + cockpit + compact task rows + Ctrl+K overlay landed in `src/tui/App.tsx`
- [x] Rename "Active Quest" → "Objective" in TUI and VS Code surfaces (agent: codex, touches: src/tui/App.tsx, extensions/vscode/)
- [x] Fixture coverage for noisy / imperfect repo docs under tests/fixtures/ (agent: codex, touches: tests/)
- [x] Click-to-open doc links verified in every remaining surface (agent: codex, touches: extensions/vscode/)
- [x] Externalize prompt-palette templates — loader reads `~/.repolog/prompts/*.md` and `<repo>/.repolog/prompts/*.md`, repo wins, built-ins fall through
- [x] `repolog prompt list` / `repolog prompt <id> [--copy]` / `repolog status --short` CLI commands
- [x] Wire TUI and desktop Ctrl+K to the shared `loadPromptPresets` loader so external overrides show up in the palettes (agent: claude, touches: src/tui/App.tsx, src/web/render.ts, apps/desktop/main.cjs, extensions/vscode/extension.js)
- [x] `repolog doctor` [`--json`] — reports scanned files, missing expected docs, malformed config, empty buckets, and suggestions keyed to `docs/SCHEMA.md`

## Next — v0.2 (agent-integration wedge)
- [x] Live git panel — branch, ahead/behind, dirty count, last commit subject + relative time
- [x] Agent activity feed — infer agent × file from mtimes × owned-areas in AGENTS.md / CLAUDE.md / GEMINI.md
- [x] Standup export — one-keypress markdown of today's done + currently-active to clipboard
- [x] Opt-in write-back for checkbox toggles only, gated by `.repolog.json` → `"writeback": true`, with persistent on-screen banner
- [x] Schema v2 — rename `activeQuest` → `objective`, add `gitContext`, `agentActivity`, `config.writeback`; ship compat shim for v1

## Now — v0.3
- [x] `repolog tuneup` CLI + `buildTuneup` engine (score, gaps, prompt, charter, perAgent)
- [x] "Tune this repo" Settings panel card (coverage meter, prompt textarea, action buttons)
- [x] TUI `t` hotkey — tuneup overlay with score bar + gap list
- [x] VS Code `repoQuestLog.tuneup` command (quick pick: copy/charter/per-agent)
- [x] Desktop IPC `repolog:run-tuneup` + `repolog:write-tuneup-charter`
- [x] `CHARTER.md` generation: `.repolog/CHARTER.md` written via `--write-charter` or UI button
- [x] `tests/tuneup.test.ts` — 8 tests, all green

## Later — v0.3+
- [ ] `gh` integration: open PRs on current branch + assigned issues, only if gh is installed and authed
- [ ] macOS host decision: SwiftUI + WKWebView vs native redraw
- [ ] Publish binary to npm (from README; not a priority — GitHub releases are the ship channel)
- [ ] Optional LLM "summarize this week" pass, user-supplied key, off by default

## Blocked
- [ ] Publish npm package `@repo-quest/core` — **need npm org + CI secrets**

## v0.1 core — build tasks (reference, all complete)

1. [x] Define supported file names and heading patterns — `src/engine/fileset.ts`
2. [x] Parse markdown into sections and checklists — `src/engine/parse.ts`
3. [x] Normalize `ParsedDoc[]` into shared `QuestState` — `src/engine/normalize.ts`
4. [x] Rank tasks into Now / Next / Blocked — `src/engine/rank.ts`
5. [x] Build Agents panel from `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` — `src/engine/agents.ts`
6. [x] File watching and auto-refresh — `src/engine/watcher.ts`
7. [x] One-line `resume_note` from top active task + last-touched file — `src/engine/normalize.ts`
8. [x] CLI `repolog scan .` → JSON
9. [x] TUI `repolog watch` → live terminal HUD
10. [x] Desktop shell over shared HUD renderer (Electron, Windows packaged to `release-fresh/`)
11. [x] VS Code side-panel extension over the same `QuestState`

## Out of scope (v0.1 and v0.2)
Source-code parsing · LLM calls · multi-repo dashboards · team sync · cloud anything · plugin marketplace · settings UI beyond `.repolog.json` · theming · timers · pomodoros · streaks · gamification · free-text markdown write-back.
