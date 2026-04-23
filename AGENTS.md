# AGENTS.md

Instructions for any coding agent working in this repo (Codex, generic agents, CI bots). "RepoLog"

## Role
**Implementer of Backend Code and Coding Expert** You write TypeScript per `PLAN.md`. You do not redesign. You do not expand scope.

## Owned Areas
- `src/engine/**` — parser, normalizer, ranker, watcher
- `src/cli/**` — CLI entry, argv parsing, JSON output
- `src/web/**` — shared HTML/CSS renderer for desktop + VS Code shells
- `apps/desktop/**` — Windows desktop host
- `extensions/vscode/**` — VS Code extension shell
- `tests/**` — vitest suites, fixture repos

## Do
- Read `PRD.md`, `PLAN.md`, `docs/SCHEMA.md`, and `STATE.md` before starting any task
- Work through `PLAN.md` → "The 7 build tasks" in order
- Keep the design mockup (`docs/design/Repo Quest Log.html`) as the source of truth for visual output
- Write tests against the fixture repos under `tests/fixtures/` before marking a task done
- Update `STATE.md` when you finish a task. Keep all relevant md's updated when finishing tasks.
- Run `npm run lint && npm test` before committing
- Check with `CLAUDE.md` to make sure you and Claude are on the same page but don't intefere in what it's doing.

## Do Not
- Add source-code parsing (v0.2+)
- Add LLM calls (v0.2+, and even then: opt-in, user-supplied key)
- Introduce new dependencies without a note in the PR description
- Touch `src/tui/**` until all 7 engine tasks land

## Constraints
- Local-only file reads/writes
- Node 20+
- Zero network calls at runtime
- Must pass the vitest suite
- Prefer standard-library solutions over dependencies

## Current Objective

Ship v0.5: honest Agents roster (status from .md content), on-demand LLM Digest via OpenRouter, Light/Dark theme, font picker, font size fix. See `plan_implementation.md` for execution spec.

## Current Task

v0.5 pass complete. Agents section honest, Digest button wired, OpenRouter IPC handlers live, Light theme and font picker in settings. 67 tests green.

---

## GOD MODE — v0.4 Diamond Execution

**Read this section before touching any file.**

### The only rule
Audit the actual code first. Never assume spec = implementation. Read the file, report what's real vs. stub, then fix. Run `npm run build && npm run lint && npm test` after closing each gate. Anything failing = gate is not closed.

### Gate order (strict — do not skip ahead)

---

**GATE 1 — First-run wizard is airtight**
Audit `apps/desktop/main.cjs` and `src/web/render.ts`. Verify:
1. `repolog:first-run-check` IPC handler exists and checks `PLAN.md` presence at repo root.
2. Wizard renders **only** when `hasPlanMd === false`. Healthy fixture must NOT show the wizard.
3. `repolog:wizard-dismiss` writes `lastWizardRun: Date.now()` to `~/.repolog/first-run-state.json` in Electron userData (not in repo). On next startup, wizard is suppressed for that repo.
4. Every wizard action button (`init-plan`, `init-state`, `init-config`) disables itself and shows a spinner immediately on click, before the IPC call resolves.
5. IPC errors surface as a one-sentence human-readable toast, not `[object Object]` or a raw stack trace.
6. After a file is created, a "Run Doctor Again?" button appears and re-runs doctor in place.

Fix anything that doesn't hold. Tests: `tests/desktop.test.ts` must cover startup check (healthy = no wizard, noisy = wizard), dismiss persistence, and error toast shape.

---

**GATE 2 — Doctor output is instantly actionable**
Audit `src/engine/doctor.ts`. For every finding, verify:
1. A `why` field or inline sentence exists: one line explaining what breaks without it.
2. A `fix` or `example` field exists: exactly what the user should type or add.
3. Findings are emitted in this severity order: PLAN.md missing → STATE.md missing → Objective → Now → structural → formatting. No finding above its severity peer.
4. No finding text contains internal variable names, import paths, or jargon a first-time user wouldn't know.

Rewrite any finding that fails. Tests: `tests/doctor.test.ts` must assert on `why` and `fix` presence, and on sort order across finding types.

---

**GATE 3 — Settings UI works end-to-end**
Audit `src/web/render.ts` (settings card) and `apps/desktop/main.cjs` (`repolog:write-config` handler). Verify:
1. On settings panel open, all fields are populated from current `.repolog.json` (or defaults if file missing). Fields must not be blank or show `undefined`.
2. Clicking Save with invalid input (e.g., non-numeric debounce) shows an error banner inline — no silent failure, no toast-only.
3. `repolog:write-config` writes atomically: read current → merge → validate via `validateAndFillConfig` → write `.repolog.json.tmp` → `fs.renameSync` → emit `repolog:config-changed` → trigger rescan.
4. On success: toast "Settings saved ✓" appears and watcher rescans immediately (visible as an updated "Recent changes" timestamp or file count).
5. On write failure (permissions, disk): error banner in settings panel states what failed.
6. VS Code: `writeConfig` message handler in `extensions/vscode/extension.js` writes the file and sends back `{ type: "configSaved" }` or `{ type: "error", message: "..." }`.

Fix anything that doesn't hold. Tests: `tests/config.test.ts` must cover atomic write path, merge behavior, and validation rejection.

---

**GATE 4 — Write-back never silently clobbers**
Audit `src/engine/writeback.ts`. Verify:
1. Every task toggle write follows: read original → write to `${file}.tmp` → `fs.renameSync(tmp, file)` → read back → SHA-256 compare → rollback on mismatch.
2. Stale-line detection: if the target line changed since last scan, the write is rejected with `"Line has changed since last read; re-scan required"` — not silently applied.
3. Concurrent writes to the same file are queued (a per-file `Promise` chain), not raced.
4. On any failure, the renderer receives `{ error: "..." }` with a human-readable message, then triggers `repolog:rescan`.

Fix anything that doesn't hold. Tests: `tests/writeback.test.ts` must cover atomic path, SHA mismatch rollback, stale-line rejection, and concurrent write queuing.

---

**GATE 5 — Watcher feels alive**
Audit `src/engine/watcher.ts`. Verify:
1. `add`, `change`, `unlink`, and `unlinkDir` events all trigger a debounced rescan.
2. Debounce value is `Math.max(config.watch.debounce ?? 500, 500)` ms — never lower.
3. Rapid-fire events (5 in 100ms) collapse to exactly 1 rescan after the debounce window.
4. On chokidar `error` event: log to stderr with file + event context, emit an `error` event that the desktop/TUI consumer can catch to show "File watch lost sync; re-scanning."
5. When `.repolog.json` changes on disk, the watcher emits a `config-changed` event and scan re-reads config via `validateAndFillConfig` before rebuilding `QuestState`.

Fix anything that doesn't hold. Tests: `tests/watcher.test.ts` must cover create/modify/delete/unlink events, debounce collapse, and error emit.

---

**GATE 6 — Version and release are clean**
Audit `src/cli/index.ts`, `apps/desktop/main.cjs`, and `CHANGELOG.md`. Verify:
1. `repolog --version` prints exactly `vX.Y.Z` (from `package.json`) and exits 0. No extra lines, no banner.
2. `RepoLog.exe --repo-root <path>` reads `--repo-root` from `process.argv` before the window is created and passes it to `resolveDesktopRepoRoot`. Verify with a path that has no `.repolog.json`.
3. `CHANGELOG.md` has a `## v0.4.0 — YYYY-MM-DD` section with Features, Fixes, and Breaking Changes subsections, ready to paste into a GitHub release.
4. `npm run build && npm run lint && npm test` all pass with 59+ tests before you report Gate 6 closed.

Fix anything that doesn't hold.

---

### After all 6 gates close

1. Update `STATE.md` Resume Note with what was audited, what was fixed, and the final test count.
2. Update `AGENTS.md` Current Task to "All 6 diamond gates closed. Ready for release."
3. Update the `## ✅ CURRENT STATUS` block in `IMPLEMENTATION_PLAN_v0.4.md` to reflect gate completions.
4. Do NOT commit. Stop and report to the human.

---

## Last Task
Diamond gate closeout completed and verified. First-run wizard, doctor findings, settings save flow, write-back queue/stale handling, watcher config/error handling, repo-root startup parsing, and release notes are aligned. `npm run build && npm run lint && npm test` passes with 67 tests.
