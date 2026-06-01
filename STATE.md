---
title: Repo Quest Log — State
status: active
owner: claude
---

# STATE.md

Live "where we are." Update this as work progresses. The normalizer reads this to build the Resume Note.

## Current Focus
v0.5 HUD consistency pass verified. RepoLog desktop keeps the same shell for every non-empty repo, fills sparse planning state with detected repo context, offers setup actions inline, moves closer to the accepted HUD mockup structure, and keeps retired Claude/Gemini instructions in `docs/Archived/agent-docs/` instead of treating them as active root agent docs.

## Resume Note

> Session 2026-06-01 (v0.5 packaged repo-root fix): Root-caused the packaged desktop "stuck on PR-Dashboard" regression to Electron argv shape. Dev Electron uses `electron.exe apps/desktop/main.cjs --repo-root <path>`, but the packaged EXE uses `Repo Quest Log.exe --repo-root <path>`; `apps/desktop/main.cjs` always passed `process.argv.slice(2)`, which dropped the flag in packaged builds and fell back to the saved last root. Added `desktopUserArgv()` in `src/desktop/root.ts`, wired desktop startup through it, and covered packaged/dev argv handling in `tests/desktop.test.ts`. Fixed the missing in-app affordance by adding an explicit top-bar `Switch Repo` button wired to the same folder picker; the repo name was only text. Settings now states that `Save repo config` writes repo-local `.repolog.json`, while app-only settings stay outside the repo, and `CHARTER.md` is presented as an optional repo guide. Workspace Signals copy was softened: light outside-scope edits become `Review scope`, medium repeated edits no longer hijack the overall state, and visible labels say `Outside scope` / `Edit churn` instead of drift/thrash jargon. The broad activity watcher now ignores `release/` and `.repolog/` to avoid packaging/support-file event storms while the app is open. Added `tests/release-smoke.test.ts` plus `npm run test:release-smoke` for disposable temp-repo checks: packaged `--repo-root`, sparse source repo normal HUD/read-only behavior, and archived agent docs excluded from active roster. Verification passed: `npm run build`, `npm run lint`, `npm test` (111 tests / 23 files), `npm run test:release-smoke` (20 tests / 3 files), and `npm run desktop:build`.

> Session 2026-06-01 (v0.5 HUD consistency pass): Generic and weakly documented repos no longer get a full-screen "not agent-ready" onboarding takeover. `src/web/render.ts` now always renders the normal desktop HUD for non-empty repos, uses fallback Objective/Resume/Mission copy when PLAN.md or STATE.md are sparse, moves the desktop structure toward the accepted mockup (topbar actions, Current Focus/Objectives/Agent Docs top row, Workspace Signals strip, lower Now/Activity/Prompt/Digest/Repo Context grid), and keeps setup prompt/preview/write actions inline. Retired root `CLAUDE.md` and `GEMINI.md` guidance moved to `docs/Archived/agent-docs/` as reference-only material, with `AGENTS.md` now the active root instruction doc. Archived/reference agent status now normalizes case/whitespace aliases and does not define fallback workspace scope. Follow-up 5.3-Codex review findings were fixed: empty-state setup no longer asks for root CLAUDE.md, v0.4 gate instructions were replaced with v0.5 handoff checks, stale layout CSS was removed, and alias coverage was broadened. Release metadata is bumped to 0.5.0 across root, desktop, and VS Code package files, with v0.5.0 changelog notes. Verification passed: `npm run build`, `npm run lint`, `npm test` (104 tests / 22 files). Browser/app visual QA was intentionally not run per human direction.

> Session 2026-06-01 (layout rescue + config trust fix): Sent reversible watcher pings via a temporary `repolog-layout-ping.md` add/change/delete to confirm Workspace Signals and Recent Activity respond without leaving a repo artifact. Fixed the desktop board CSS in `src/web/render.ts` so fullscreen and wide windows allocate more width to Agent Docs, keep Now/Blocked stable on the left, give middle-column history/decisions useful vertical room, and avoid equal-third compression. Root-caused `.repolog.json` dirtying: `validateAndFillConfig()` expanded `~/.repolog/prompts` into a Windows absolute path, then `writeRepoConfig()` serialized that machine path into repo-local config on Settings save. `src/engine/config.ts` now preserves the portable prompt-dir string for repo config, with coverage in `tests/config.test.ts`; this repo's `.repolog.json` is clean. Fixed sticky Workspace Signals drift in `src/engine/workspace-signals.ts`: scope drift now counts unique outside-scope files only in the last minute, so throwaway test pings do not keep the HUD in Drifting for ten minutes; covered in `tests/workspace-signals.test.ts`. Verification passed: `npm run build`, `npm run lint`, `npm test` (99 tests / 22 files). Rendered browser QA was attempted against the generated desktop snapshot, but the in-app browser blocked both `file://` and localhost snapshot navigation.

> Session 2026-06-01 (Workspace Signals rescue): Added `src/engine/workspace-signals.ts` for edit rate, file spread, scope drift, thrash, trend buckets, and scope derivation from Now agent owned areas. Added desktop-only `src/engine/activity-watcher.ts` for broad chokidar metadata events with built-in ignores and no content reads. `scanRepo` now accepts optional `recentActivity` and emits additive `workspaceSignals` / `recentActivity`. Desktop main keeps activity state in memory and passes it into scans. Shared renderer now shows Workspace Signals, Recent Activity, Agent Docs, Prompt Palette, empty-Now repair actions, and filters `Blocked: None`; visible fake agent liveness was removed from desktop and VS Code, and "idle" resume wording was removed from prompts/TUI. Prompt presets also filter `Blocked: None`, so paste-ready standup/blocker prompts no longer claim a fake blocker. Desktop startup was fixed so Electron runs `start()` when loaded as the Electron main process, then verified with Computer against the real app window. README is reframed around "You opened a repo. What were you doing?" and uses a current rendered desktop screenshot at `docs/assets/desktop-workspace-signals.png`. Final verification passed: `npm run build`, `npm run lint`, `npm test` (93 tests / 22 files), Electron desktop smoke with live temp-file activity, generic repo preview smoke, and headless Chrome rendered the product-proof screenshot from app output.

> Session 2026-05-22 (trust pass): Stopped repo-local runtime writes on desktop open/render/analyze. Desktop initial HTML now loads via `BrowserWindow.loadURL("data:text/html...")`; last-root, window bounds, first-run state, OpenRouter config, and digest cache stay under Electron userData/app cache keyed by repo hash. `scanRepo` no longer reads `.repolog/digest.json`; Digest stores last result through `src/engine/digest-cache.ts` / `src/engine/digest.ts`. `repolog desktop` default snapshot moved to `~/.repolog/cache/.../desktop-preview.html`. Generic repos now get `repoContext` and readiness scores (`repoLogStructureScore`, `contextUsefulnessScore`, `agentReadinessScore`) plus an onboarding dashboard: "This repo is not agent-ready yet." `buildTuneup(state, report, rootDir)` is wired in desktop and VS Code, includes generated PLAN.md/STATE.md/AGENTS.md previews, and the prompt tells agents to inspect real repo context, avoid invented details, preserve docs, mark assumptions, and not touch code unless needed for documentation inference. Explicit writes now return files written and use safe write targets for init/config/charter/generated docs. Final verification passed: `npm run build`, `npm run lint`, `npm test` (82 tests / 20 files), and `npm run desktop:app -- --repo-root <temp generic repo>` smoke with clean git status before/after.

> Session 2026-04-23 (v0.4): Full feature pass — frontmatter-based Agents roster (status from .md frontmatter, not mtime heuristics), on-demand Digest via OpenRouter (nemotron-free default, key in Electron userData), Light/Dark theme, font picker (System/Mono/Serif), density clamp raised 1.32→1.5 (fixes 126% ceiling). Layout restructured: Agents own the third column full-height; Decisions moved to col 2 alongside Next+Recent Changes. Settings panel background now uses `--bg-elevated` (themes correctly in Light mode). Agent status uses `agent.status` from frontmatter directly (global roster status no longer overrides all agents). Click delegation bug fixed (Save + Digest buttons used `data-action` instead of `data-ui-action`). SVG info icons replace letter-in-circle markers. Dropdown `option` colors added for dark/light. `npm run build && npm run lint && npm test` passes with 67 tests across 17 files.

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
- CLAUDE.md role expanded: Claude now plans AND implements (build/lint/test gate still required).
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
> v0.4 handler regression is fixed. Init/config/wizard click paths are guarded again and verified; next agent should continue with the remaining v0.4 first-run/config/write-back polish from `docs/Archived/IMPLEMENTATION_PLAN_v0.4.md`.

Last touched: `docs/Archived/IMPLEMENTATION_PLAN_v0.4.md`, `STATE.md`, `src/web/render.ts`

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
