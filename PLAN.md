# PLAN.md

One sentence: **what this repo is trying to become.**
> A local-first CLI + TUI that makes repo intent legible at a glance for developers working with coding agents.

## Active Quest
Ship v0.1 — local CLI + TUI HUD

## Current Objective
Land the core engine (markdown scanner → normalizer → QuestState JSON) before touching any UI.

## Now
- [ ] Wire file-watcher into normalizer (chokidar, 250ms debounce)
- [ ] Define QuestState JSON schema v1 — freeze the shape (see `docs/SCHEMA.md`)
- [ ] Rank extracted items into Now / Next / Blocked

## Next
- [ ] Parse markdown with remark + extract checklist items
- [ ] Build Agents panel from `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
- [ ] Ink-based terminal renderer, stable placement (match `docs/design/`)
- [ ] Session Anchor: one-line resume note from most-recent-touched active task
- [ ] Heuristic confidence score per extracted quest

## Blocked
- [ ] Desktop shell decision: Tauri vs native — **waiting on scope review**
- [ ] Publish npm package `@repo-quest/core` — **need npm org + CI secrets**

## The 7 build tasks (in order)

1. **Define supported file names and heading patterns.** Write the fixed list and regex for each category. Output: `src/engine/fileset.ts`.
2. **Parse markdown into sections and checklists.** Use `remark` + `unified`. Return a `ParsedDoc[]`. Output: `src/engine/parse.ts`.
3. **Build a normalizer that maps `ParsedDoc[]` into one shared `QuestState` JSON.** Schema in `docs/SCHEMA.md`. Output: `src/engine/normalize.ts`.
4. **Rank tasks into Now / Next / Blocked.** Heuristic priority stack from PRD. Output: `src/engine/rank.ts`.
5. **Build the Agents panel from `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`.** One profile per agent file. Output: `src/engine/agents.ts`.
6. **Add file watching and auto-refresh.** `chokidar`, debounced, re-runs the pipeline. Output: `src/engine/watcher.ts`.
7. **One-line `resume_note` generated from the top active task + last-touched file.** Output: folded into `normalize.ts`.

That is enough for a useful prototype. Only after all 7 land do we touch the TUI renderer.

## Build order after core

1. CLI: `quest-log scan .` → prints JSON
2. TUI: `quest-log --watch` → Ink renderer, matches `docs/design/Repo Quest Log.html`
3. Snapshot tests against fixture repos in `tests/fixtures/`
4. Publish as `@repo-quest/core` + `repo-quest-log` binary
5. (Out of v0.1) Desktop shell, VS Code extension, menu-bar widget

## Out of scope for v0.1

Source-code parsing · automatic markdown write-back · LLM summarization · multi-repo dashboards · team sync · cloud anything · plugin marketplace · settings UI · theming.
