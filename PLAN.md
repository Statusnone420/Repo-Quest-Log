# PLAN.md

One sentence: **what this repo is trying to become.**
> A local-first CLI + TUI + desktop + VS Code shell that makes repo intent legible at a glance and hands that intent to whichever coding agent you open next.

## Objective
Ship v0.4: honest Agents roster (status from .md frontmatter), on-demand LLM Digest via OpenRouter, Light/Dark theme, font picker, font size fix, and polished 3-column layout. Keep the local-first, markdown-first philosophy intact.

## Current Focus
v0.4 feature pass complete and verified. Agents section is honest (per-agent status from frontmatter), Digest works (OpenRouter, confirmed live hit), layout restructured (Agents own col 3, Decisions in col 2), Settings panel themes correctly in Light mode. 67 tests green.

**Objective Sync Rule:** When PLAN.md's `## Objective` changes, review and update all agent objectives (CLAUDE.md, GEMINI.md, AGENTS.md) to align with the new direction. Each agent's objective should support the repo objective from their specific angle (e.g., Claude = execution, Gemini = architecture).

## Now
- [x] Theme: Light/Dark only, fix density clamp (126% → 150%), add font picker
- [x] Agents: honest per-agent status from .md frontmatter, remove fake confidence feed
- [x] OpenRouter: API key in Electron userData, model config, `repolog:run-digest` IPC handler
- [x] Digest button: on-demand, bundles PLAN+STATE+agents+git log, shows 3-part result in Agents panel
- [x] Layout: col 1 = Now+Blocked, col 2 = Next+Changes+Decisions, col 3 = Agents full-height
- [x] Light mode: settings panel background uses CSS vars, fully themed

## Next
- [ ] macOS host decision and prototyping
- [ ] Publish binary to npm via GitHub releases

## v0.1 (completed)
- [x] Define supported file names and heading patterns — `src/engine/fileset.ts`
- [x] Parse markdown into sections and checklists — `src/engine/parse.ts`
- [x] Normalize `ParsedDoc[]` into shared `QuestState` — `src/engine/normalize.ts`
- [x] Rank tasks into Now / Next / Blocked — `src/engine/rank.ts`
- [x] Build Agents panel from `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` — `src/engine/agents.ts`
- [x] File watching and auto-refresh — `src/engine/watcher.ts`
- [x] One-line `resume_note` from top active task + last-touched file — `src/engine/normalize.ts`
- [x] CLI `repolog scan .` → JSON
- [x] TUI `repolog watch` → live terminal HUD
- [x] Desktop shell over shared HUD renderer (Electron, Windows packaged to `release-fresh/`)
- [x] VS Code side-panel extension over the same `QuestState`

## v0.2 (completed)
- [x] Live git panel — branch, ahead/behind, dirty count, last commit subject + relative time
- [x] Agent activity feed — infer agent × file from mtimes × owned-areas in AGENTS.md / CLAUDE.md / GEMINI.md
- [x] Standup export — one-keypress markdown of today's done + currently-active to clipboard
- [x] Opt-in write-back for checkbox toggles only, gated by `.repolog.json` → `"writeback": true`, with persistent on-screen banner
- [x] Schema v2 — rename `activeQuest` → `objective`, add `gitContext`, `agentActivity`, `config.writeback`; ship compat shim for v1
- [x] Resume-prompt palette (Ctrl+K) pulled forward from v0.1 — 6 presets, in-memory templates, clipboard + toast
- [x] `repolog prompt list` / `repolog prompt <id> [--copy]` / `repolog status --short` CLI commands
- [x] Externalize prompt-palette templates — loader reads `~/.repolog/prompts/*.md` and `<repo>/.repolog/prompts/*.md`

## v0.3 (completed)
- [x] `repolog tuneup` CLI + `buildTuneup` engine (score, gaps, prompt, charter, perAgent)
- [x] "Tune this repo" Settings panel card (coverage meter, prompt textarea, action buttons)
- [x] TUI `t` hotkey — tuneup overlay with score bar + gap list
- [x] VS Code `repoQuestLog.tuneup` command (quick pick: copy/charter/per-agent)
- [x] Desktop IPC `repolog:run-tuneup` + `repolog:write-tuneup-charter`
- [x] `CHARTER.md` generation: `.repolog/CHARTER.md` written via `--write-charter` or UI button
- [x] `tests/tuneup.test.ts` — 8 tests, all green
- [x] Settings panel redesign: scrollable body with fixed head/footer, tuneup promoted to top

## Blocked
- [ ] Publish npm package `@repo-quest/core` — **need npm org + CI secrets**

## Out of scope
Source-code parsing · multi-repo dashboards · team sync · cloud anything · plugin marketplace · timers · pomodoros · streaks · gamification · free-text markdown write-back · chat/back-and-forth LLM interfaces · auto-firing LLM calls.
