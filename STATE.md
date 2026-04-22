---
title: Repo Quest Log — State
status: active
owner: claude
---

# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Resume Note.

## Current Focus
RepoBot Phase 2 underway: CLI chat mode, desktop RepoBot card, VS Code webview bridge, and provider selection are in place. 46 tests green.

## Last Session — RepoBot Phase 2 chat surface (2026-04-22)
- **`src/engine/llm-providers.ts`** (NEW): provider registry for Anthropic, OpenAI, Google, and local Ollama, with auth discovery from env, standard token files, `~/.repolog/llm-config.json`, and runtime `ask()` clients.
- **`src/engine/copilot.ts`** (NEW): strict JSON prompt builder and response parser for `analysis`, `fixes`, `reasoning`, `confidence`, plus RepoBot context/request helpers.
- **`src/engine/config.ts` / `src/engine/types.ts` / `src/engine/scan.ts`**: repo config now preserves `llm.provider` / `llm.discovered` and exposes it on the scan snapshot.
- **`src/cli/copilot-auth.ts`** (NEW) + **`src/cli/index.ts`**: `repolog auth discover`, `repolog auth use <provider>`, `repolog auth status`, and `repolog repobot` now work from the CLI.
- **`apps/desktop/main.cjs`**, **`apps/desktop/preload.cjs`**, **`extensions/vscode/extension.js`**, and **`src/web/render.ts`**: RepoBot ask/status/provider selection are wired through the desktop shell and the shared settings panel.
- **`docs/SCHEMA.md`**, **`PLAN.md`**, **`AGENTS.md`**, and **`plan_implementation.md`** updated to reflect the RepoBot naming and phase 2 progress.
- **`tests/auth.test.ts`** and **`tests/copilot.test.ts`** (NEW): auth discovery, repo selection write-back, prompt construction, RepoBot query flow, and fenced JSON parsing are covered by 3 fixture-backed tests.
- `npm run build`, `npm run lint`, and `npm test` all pass (46 tests, 17 files).

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
> Handoff complete: Codex now owns RepoBot implementation (plan_implementation.md, 38h, 4 phases). Phase 2 chat interfaces are in progress: provider abstraction, auth discovery, prompt engineering, CLI repobot, and desktop/webview RepoBot surfaces are wired. 46 tests green.

Last touched: `plan_implementation.md`, `PLAN.md`, `AGENTS.md`, `STATE.md`

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
