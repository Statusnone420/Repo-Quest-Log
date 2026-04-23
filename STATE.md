---
title: Repo Quest Log — State
status: active
owner: claude
---

# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Resume Note.

## Current Focus
v0.5 pass complete. Agents section rebuilt (honest status from .md content, Digest button + OpenRouter integration). Theme simplified to Light/Dark, font picker added, font size cap raised to 150%. 67 tests green.

## Resume Note

> Session 2026-04-23 (v0.5): Rewrote Agents tile — removed mtime heuristics and fake confidence feed entirely. Agent status now sourced from `## Current Task` / `## Last Task` in each agent .md. Added `DigestResult` type and `lastDigest` to `QuestState`; scan.ts loads `.repolog/digest.json` on startup. Added on-demand Digest button: bundles PLAN.md + STATE.md + agent files + 7-day git log → POST to OpenRouter (default: nemotron-free) → shows 3-part summary in Agents panel. API key stored in Electron userData (`openrouter.json`), never in repo. Theme simplified to Dark/Light only; `normalizeTheme()` maps slate/dim → dark. Font picker (System/Mono/Serif) with `--rql-font` CSS var. Density clamp raised from 1.32 → 1.5 (fixes 126% ceiling bug). Stale test assertion updated (`heuristic feed` → `run-digest`). `npm run build && npm run lint && npm test` passes with 67 tests across 17 files.

## Last Session — UI polish pass (2026-04-22)
- **Settings rack**: Removed filler description copy and Ctrl+ chip row; removed Standup button and extra Refresh from the rack. Rack now shows only Open Settings + Open Repo.
- **Settings panel**: Removed "Run doctor" button (superseded by Tune this repo). Added Standup card, Theme picker (Dark/Slate/Dim), and Density card inside the panel grid.
- **Topbar**: Removed HTML window controls (minimize/maximize/close) — OS provides them. Removed duplicate ↻ refresh; kept single ↻ at topbar right.
- **Scale**: Raised cap from 124% to 150%. Density clamp bumped to 1.32.
- **Theme system**: `[data-theme="slate"]` and `[data-theme="dim"]` CSS overrides on `<html>`. JS reads/saves/applies theme alongside scale+density in `localStorage`.
- **Recent Changes tile**: flex bumped from 0.48 → 0.72 so it gets more vertical space in the Next column.
- **Startup window**: `apps/desktop/main.cjs` now defaults to 1280×800 (capped at workArea). Saves/restores `window-bounds.json` in Electron userData on resize/move.
- **Tests**: Updated 3 stale assertions (`Run doctor` → `Theme`, `workArea.width` → `defaultWidth`). All 52 pass.

## Last Session — v0.4 handler regression fix & re-handoff (2026-04-22)
- **Fix completed**: Re-implemented the wizard/config handlers in `src/web/render.ts` with explicit try/catch protection around the new branches and an outer click-listener safety net.
- **Coverage added**: Added fixture-backed web tests for both `tests/fixtures/healthy/` and `tests/fixtures/noisy/` so the setup card renders safely from real scan output.
- **Verification**: `npm run build`, `npm run lint`, `npm test`, and `npm run desktop:build` all passed.
- **v0.4 implementation attempt 1**: Agent added init/config/wizard handlers but one threw an uncaught error, breaking ALL click event handling (except Ctrl+K). Isolated issue to: `init-plan`, `init-state`, `init-config`, `dismiss-wizard`, or `save-config` handlers.
- **Triage**: Removed all three handler blocks + `collectConfig()`/`saveConfig()` functions. Click listener restored. UI responsive again.
- **Verdict**: Root cause was likely an error in `window.repologDesktop.initTemplate()` or `window.repologDesktop.writeConfig()` calls, or possibly `vscode` object was undefined causing cascading errors.
- **Next steps**: Re-implement handlers with explicit error handling. See FIX_V0.4_HANDLERS.md (created) for detailed spec.

## Last Session — v0.4 scaffold and release sync (2026-04-22)
- **`src/engine/config.ts`**: Added `validateAndFillConfig`, `defaultRepoConfig`, and atomic `writeRepoConfig`. Config now carries `excludes`, `writeback`, `prompts.dir`, `watch.debounce`, `watch.reportFileChanges`, and `schemaVersion`.
- **`src/engine/init.ts`**: Added plan/state/config template builders plus `writeInitTemplates(...)` for `repolog init`.
- **`src/cli/index.ts`**: Added `repolog init [--plan|--state|--config|--all] [--write] [--force]` and `--version` parsing. Entry point is now test-safe when imported.
- **`src/engine/writeback.ts`**: Hardened checklist toggles with same-file locking, temp-file writes, rename-based replacement, and post-write verification.
- **`src/engine/doctor.ts` / `src/engine/tuneup.ts`**: Clearer findings and paste-ready tuneup prompts with numbered gaps and verification steps.
- **`tests/config.test.ts` / `tests/cli.test.ts`** (NEW): Added coverage for config defaults/validation/write path and init parser/template generation.
- **Versions/docs**: Bumped packages toward `0.0.4`, updated changelog, README install hint, and start of v0.4 tracker sync.
- `npm run lint` and `npm test` — green (49 tests, 17 files).

## Last Session — v0.3 Tuneup + Settings redesign (2026-04-22)
- **`src/engine/tuneup.ts`** (NEW): `buildTuneup(state, doctorReport): TuneupResult`. Score weights: mission(15) + objective(15) + now-heading(15) + agents-owned-areas(10) + state-resume(10) + plan-next(10) + charter-present(15) + frontmatter(10) = 100. Generates per-repo prompt, CHARTER.md contents, and per-agent prompts.
- **`src/engine/types.ts`**: Added `charterPresent?` and `hasFrontmatter?` to `RepoConfigSnapshot`.
- **`src/engine/scan.ts`**: Detects `.repolog/CHARTER.md` and parsed doc frontmatter; sets both fields on config snapshot.
- **`src/engine/doctor.ts`**: `DoctorReport` now includes `tuneup: { score, gaps }` built from `buildTuneup`.
- **`src/cli/index.ts`**: `repolog tuneup [path] [--write-charter] [--copy] [--agent=claude|codex|gemini]`. Missing agent → stderr note + generic prompt. Charter write uses `--write-charter` flag.
- **`src/web/render.ts`**: "Tune this repo" full-width card in settings panel. Coverage meter (accent ≥80, warn 50-79, danger <50), read-only prompt textarea (max-height 40vh), Copy / Write CHARTER.md / Preview Gaps / Send to Claude|Codex|Gemini buttons. Desktop calls `window.repologDesktop.runTuneup()`; VS Code posts `{ type: "runTuneup" }`.
- **`src/tui/App.tsx`**: `t` hotkey triggers `runDoctor` + `buildTuneup` then shows `TuneupOverlay` (score bar + gap list). `q`/Esc dismisses.
- **`extensions/vscode/extension.js`**: `repoQuestLog.tuneup` command registered — runs quick pick with Copy / Write CHARTER / per-agent options. Webview handles `runTuneup` and `writeTuneupCharter` messages.
- **`apps/desktop/main.cjs` + `preload.cjs`**: `repolog:run-tuneup` and `repolog:write-tuneup-charter` IPC handlers.
- **`tests/tuneup.test.ts`** (NEW): 8 tests — pristine=100, missing-objective gap, missing-now gap, per-agent prompt content, charter determinism, missing-charter gap, prompt structure, doctor JSON output.
- `npm run build && npm run lint && npm test` — 42 tests, 15 files, all green.

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
> v0.4 handler regression is fixed. Init/config/wizard click paths are guarded again and verified; next agent should continue with the remaining v0.4 first-run/config/write-back polish from `IMPLEMENTATION_PLAN_v0.4.md`.

Last touched: `IMPLEMENTATION_PLAN_v0.4.md`, `STATE.md`, `src/web/render.ts`

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
