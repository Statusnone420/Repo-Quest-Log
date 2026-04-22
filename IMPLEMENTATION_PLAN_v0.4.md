# RepoLog v0.4 Implementation Plan

**Objective:** Enable anyone to download the RepoLog exe, install it, open it in a repo folder, run the doctor once, and have the docs self-manage themselves with good reporting through the HUD.

**Target:** Ship v0.4 with frictionless first-run doctor workflow, reliable file watching + write-back, and polished settings/config UI.

**Ownership:** AGENTS.md for backend implementation; CLAUDE.md for design/planning as needed.

---

## Context

**Current State (end of v0.3):**
- ✅ Core engine: parse, normalize, rank, watcher, git/agent tracking
- ✅ CLI: scan, doctor, tuneup, status, prompt, standup commands
- ✅ Desktop app: Electron shell on Windows, click-to-open, opt-in write-back, folder picker
- ✅ TUI: live terminal HUD with hotkeys (⌘K, t, Ctrl+Shift+C)
- ✅ VS Code extension: webview with same renderer
- ✅ Test suite: 42 tests, all green
- ✅ Doctor + Tuneup engines: health scoring, gap detection, charter generation
- ⚠️ **First-run experience**: Desktop app has no guided flow; users must manually run doctor from CLI
- ⚠️ **Settings UI**: `.repolog.json` is hand-editable only; no visual defaults
- ⚠️ **Watcher reliability**: Works, but edge cases around file sync need hardening
- ⚠️ **Deployment**: Exe is packaged but needs release notes + simplified distribution

**Design Authority:** [Repo Quest Log.html](docs/design/Repo%20Quest%20Log.html) — this is the visual spec. Desktop app must match it exactly.

---

## The Five Work Streams

### 1. First-Run Wizard (Desktop App)

**Goal:** User opens RepoLog exe → app detects PLAN.md/STATE.md/CHARTER.md → if missing, offers guided setup.

#### Tasks

**1a. Startup health check**
- **File:** `apps/desktop/main.cjs` (after repo root is resolved)
- **Logic:**
  - Check if `PLAN.md` exists. If missing, set a flag `showFirstRunWizard = true`.
  - Check if `STATE.md` exists. If missing, add to `wizardPrompts`.
  - Check if `.repolog/CHARTER.md` exists. If missing, note it.
  - Store results in a `firstRunState` object shared with renderer.
- **IPC:** Expose `repolog:first-run-check` handler that returns `{ hasPlanMd, hasStateMd, hasCharterMd, wizardPrompts: string[] }`.
- **Test:** Verify on healthy and noisy fixtures.

**1b. First-run wizard UI panel**
- **File:** `src/web/render.ts` (new "Setup" card in settings, or dedicated modal)
- **Visual Spec:** Follows [design mockup](docs/design/Repo%20Quest%20Log.html); simple card with steps:
  1. "Welcome to RepoLog" — explain what it does in 1 sentence.
  2. "Running doctor…" — show spinner while `repolog doctor` runs.
  3. "Here's what we found:" — display doctor findings (missing files, gaps, score).
  4. "Fix it now?" — offer buttons:
     - "Generate CHARTER.md" → runs tuneup, writes `.repolog/CHARTER.md`
     - "Create PLAN.md template" → generates a starter PLAN.md
     - "Create STATE.md template" → generates a starter STATE.md
     - "Skip, I'll do it later" → dismisses wizard, shows HUD
- **Behavior:**
  - Wizard only shows once (check `lastWizardRun` in userData).
  - Each "Fix" button runs the appropriate CLI command via IPC.
  - After fixes, re-scan and show updated doctor output.
  - Dismiss button → normal HUD, no nag.
- **Toast on action:** "CHARTER.md written ✓" or "PLAN.md created ✓"

**1c. Desktop app wiring**
- **File:** `apps/desktop/main.cjs` + `preload.cjs`
- **IPC Handlers:**
  - `repolog:first-run-check` → returns health check object
  - `repolog:run-doctor` → runs `repolog doctor --json`, returns findings
  - `repolog:create-plan-template` → writes a minimal PLAN.md to repo root
  - `repolog:create-state-template` → writes a minimal STATE.md to repo root
  - `repolog:wizard-dismiss` → writes `lastWizardRun` timestamp to userData, never show again
- **Preload:** Expose `window.repologDesktop.firstRunCheck()`, etc.

**1d. CLI generators (new)**
- **File:** `src/cli/index.ts` (new subcommand: `repolog init`)
- **Commands:**
  - `repolog init --plan` → writes `PLAN.md` template to stdout or file
  - `repolog init --state` → writes `STATE.md` template to stdout or file
  - Both templates include:
    - Proper heading structure (`## Objective`, `## Now`, `## Next`, `## Blocked`)
    - Example checklist items
    - Comments explaining how RepoLog uses them
  - `repolog init --all` → creates all three (PLAN.md, STATE.md, .repolog.json) at once
- **Template content:**
  - PLAN.md: mission, objective, now/next/blocked, v0.1/v0.2/v0.3 sections (placeholders)
  - STATE.md: title, status, current-focus, resume-note, recent-decisions
  - .repolog.json: excludes, writeback: false, prompts.dir, schema version

**Acceptance Criteria:**
- [ ] First-run wizard appears on startup when PLAN.md is missing
- [ ] Doctor findings display in wizard UI with actionable buttons
- [ ] Clicking "Generate CHARTER.md" runs tuneup and writes file; UI reflects success
- [ ] Clicking template buttons creates readable starter files
- [ ] Wizard dismissal prevents re-showing on next startup
- [ ] Wizard does not appear if PLAN.md exists (health check passes)
- [ ] Tests pass: `tests/desktop.test.ts` + doctor integration

---

### 2. Settings & Config UI (Desktop + VS Code)

**Goal:** Make `.repolog.json` editable in the UI without touching JSON directly. Provide sensible defaults.

#### Tasks

**2a. Config UI panel (desktop/web)**
- **File:** `src/web/render.ts` (new "Settings" tab or expanded settings panel)
- **Fields:**
  - **Excludes:** Multiline textarea with `archive`, `archived`, `node_modules` (default) as suggestions
  - **Write-back:** Toggle switch (off by default, with warning banner if on)
  - **Prompts dir:** Text input, defaults to `~/.repolog/prompts`
  - **Watch auto-refresh:** Toggle (on by default, delay in ms)
  - **Report file changes:** Toggle (on by default)
- **Behavior:**
  - Fields pull from `.repolog.json` on scan.
  - "Save" button writes updated config back to `.repolog.json` via IPC.
  - Toast on save: "Settings saved ✓"
  - Invalid JSON → show error banner, prevent save.
- **Visual spec:** Match [design mockup](docs/design/Repo%20Quest%20Log.html) density + color palette.

**2b. Config validation & defaults**
- **File:** `src/engine/config.ts` (new or expanded)
- **Function:** `validateAndFillConfig(raw: unknown): RepoConfig`
- **Behavior:**
  - If `.repolog.json` is missing, create defaults (see Templates above).
  - If `.repolog.json` is corrupt JSON, warn in doctor + UI.
  - Merge user config with defaults (user wins).
  - Validate types: `excludes: string[]`, `writeback: boolean`, `prompts.dir: string`
  - Return validated config or throw with message.
- **Test:** `tests/config.test.ts` (if new) — pristine, missing, corrupt, partial configs.

**2c. Desktop IPC for config write**
- **File:** `apps/desktop/main.cjs`
- **Handler:** `repolog:write-config` with payload `{ excludes?, writeback?, promptsDir? }`
- **Behavior:**
  - Read current `.repolog.json`
  - Merge changes (user wins)
  - Write back atomically (write to temp, rename)
  - Return success or error
  - Trigger watcher to re-scan

**2d. VS Code config UI**
- **File:** `extensions/vscode/extension.js`
- **Approach:** Use VS Code's `QuickPick` or a webview tab to show the same settings fields.
- **IPC:** Webview posts `{ type: "writeConfig", payload: {...} }` → extension writes to `.repolog.json` in repo.

**Acceptance Criteria:**
- [ ] Settings panel displays current `.repolog.json` values
- [ ] All fields are editable (no JSON editing required)
- [ ] "Save" writes config atomically; watcher re-scans
- [ ] Defaults are sensible (excludes, writeback: false, auto-refresh on)
- [ ] Invalid config shows error in doctor + UI banner
- [ ] Validation function exists and is tested
- [ ] VS Code extension can read/write config

---

### 3. File Watch & Write-Back Hardening

**Goal:** Ensure that file changes (both external and write-back) are reliably detected and synced.

#### Tasks

**3a. Watcher robustness audit**
- **File:** `src/engine/watcher.ts`
- **Review:**
  - Does it handle file creation (new PLAN.md)?
  - Does it handle file deletion (old task doc)?
  - Does it debounce multiple rapid changes?
  - Does it recover if a watched file is temporarily deleted?
  - Does it handle symlinks / junctions (Windows)?
- **Changes:**
  - Increase debounce from current value to 500ms if needed.
  - Add explicit handler for file `unlink` / `unlinkDir` events.
  - Log errors to stderr with context (file, event type).
  - Emit `error` event so consumers can react (e.g., desktop shows banner "lost sync, re-scanning").
- **Test:** `tests/watcher.test.ts` — create/modify/delete/rapid-change scenarios.

**3b. Write-back atomicity**
- **File:** `src/engine/writeback.ts` (review + harden existing)
- **Current:** Checks stale-line detection, exact-match on toggle targets.
- **Hardening:**
  - Write to temp file first, then atomic rename.
  - Add sync option: after write, signal watcher to pause briefly, read back file to confirm, resume.
  - Add rollback: if written content doesn't match what we intended, restore and throw.
  - Log all write operations with before/after SHA (for audit).
- **Test:** `tests/writeback.test.ts` — concurrent writes, stale-line detection, rollback scenarios.

**3c. Desktop app sync flow**
- **File:** `apps/desktop/main.cjs` + renderer
- **Flow:**
  1. User toggles checkbox in UI (via click or `repolog:toggle-task`)
  2. Desktop calls `writeback.toggleTask()`
  3. If success, emit `repolog:task-toggled` to renderer
  4. Renderer shows toast + optimistically updates UI
  5. If fail (stale line), show error toast + force re-scan
  6. Watcher detects file change, broadcasts updated state
  7. Renderer updates from state (reconciles optimistic updates)
- **IPC:** `repolog:toggle-task` handler + response handler for errors.

**3d. Config sync on write**
- **File:** `src/engine/watcher.ts` + `src/engine/scan.ts`
- **Behavior:**
  - When `.repolog.json` is written (e.g., from settings UI), watcher emits reload signal.
  - Scan re-reads config and rebuilds `QuestState`.
  - Renderer receives updated state and re-renders.

**Acceptance Criteria:**
- [ ] Watcher detects file create/modify/delete without missing events
- [ ] Write-back is atomic; temp file → rename pattern used
- [ ] After write, file is read back and verified to match
- [ ] Rollback happens if verification fails
- [ ] Concurrent writes are queued or rejected safely
- [ ] Stale-line detection works (no clobbering)
- [ ] Tests pass: `tests/watcher.test.ts` + `tests/writeback.test.ts`

---

### 4. Settings & Config UI (Desktop + VS Code)

**Goal:** Make `.repolog.json` editable in the UI without touching JSON directly. Provide sensible defaults.

#### Tasks

**4a. Docstring / comment templates**
- **Files:** `src/cli/index.ts` (init templates)
- **Content:**
  - Generated PLAN.md includes comments explaining how RepoLog reads each section.
  - Generated STATE.md includes comments about Resume Note, Recent Decisions, current focus.
  - Generated .repolog.json includes comments (JSON5 style, will be cleaned on read).
  - Each comment is on-point, no fluff.

**4b. Doctor output clarity**
- **File:** `src/engine/doctor.ts`
- **Review current findings:**
  - Are messages clear to new users?
  - Do suggestions actually fix the issue?
  - Is the severity level correct?
- **Improvements:**
  - Add example headings when suggesting fixes (e.g., "Add `## Objective:` at the top of PLAN.md").
  - Explain *why* each finding matters (e.g., "Without an Objective, RepoLog can't answer 'what's this repo trying to become?'").
  - If multiple files are missing, prioritize by impact (PLAN.md > STATE.md > README.md).

**4c. Tuneup prompt clarity**
- **File:** `src/engine/tuneup.ts`
- **Review:** Is the generated prompt human-friendly?
- **Improvements:**
  - Add intro line: "RepoLog found opportunities to improve your repo's legibility. Here's a suggested prompt for Claude/Codex/Gemini to apply fixes:"
  - Format gaps as a numbered list with markdown diffs.
  - End with: "After applying these changes, run `repolog doctor` to verify."
  - Ensure prompt is ready-to-paste into LLM without modification.

**Acceptance Criteria:**
- [ ] Doctor findings are clear and actionable
- [ ] Init templates include helpful comments
- [ ] Tuneup prompts are LLM-ready (no manual editing needed)
- [ ] New-user feedback loop: doctor → fix → verify → good state

---

### 5. Release & Deployment Improvements

**Goal:** Make the exe distribution seamless; add release notes + installer polish.

#### Tasks

**5a. Release notes automation**
- **File:** `CHANGELOG.md` (review structure)
- **Task:**
  - Ensure CHANGELOG.md uses semantic versioning + date format.
  - Add automation to extract v0.4 notes for GitHub release description.
  - Format: "## v0.4.0 — Date" with bullet list of features, fixes, breaking changes (if any).
- **Note:** User will manually create the GitHub release; this task is to make the notes structured + copy-paste-ready.

**5b. Installer messaging**
- **File:** `release/builder-debug.yml` or electron-builder config in `package.json`
- **Review:**
  - Does the NSIS installer show helpful text about opening RepoLog in a repo folder?
  - Does the final screen suggest "Run RepoLog now"?
  - Are file associations set up (optional: `.repolog.json` → open in RepoLog)?
- **Changes:**
  - Add installer finish page with: "RepoLog is installed. To get started: 1) Open a repo folder in RepoLog via File → Open Repo, 2) Let it run the doctor, 3) Fix any issues. Done!"
  - (Optional) Add checkbox: "Create desktop shortcut"

**5c. Portable exe enhancements**
- **File:** `apps/desktop/main.cjs`
- **Task:**
  - Ensure `last-root.txt` is stored in userData (not repo), so user can open multiple repos without cross-contamination.
  - Add command-line arg support: `RepoLog.exe --repo-root C:\path\to\repo` to open a specific repo on startup.
  - Add `--version` flag to CLI and desktop app.
- **Test:** Open exe from different locations, open multiple repos, verify state isolation.

**5d. Distribution checklist**
- **Task:** Before shipping v0.4, verify:
  - [ ] `npm run desktop:build` succeeds without errors
  - [ ] `.exe` runs standalone (no missing dependencies)
  - [ ] First-run wizard appears (tested on clean Windows VM)
  - [ ] `repolog` CLI works from cmd/PowerShell
  - [ ] TUI renders correctly in Windows Terminal
  - [ ] VS Code extension installs and loads without errors
  - [ ] All tests pass: `npm test`
  - [ ] No TypeScript errors: `npm run lint`
  - [ ] Changelog is updated with v0.4 notes
  - [ ] GitHub release draft is ready (user will publish)

**Acceptance Criteria:**
- [ ] CHANGELOG.md is structured for easy extraction
- [ ] Installer shows helpful first-run text
- [ ] Exe accepts `--repo-root` argument
- [ ] Exe shows `--version`
- [ ] Multiple repos can be opened without state leakage
- [ ] Distribution checklist is documented and all items verified
- [ ] Pre-release testing passes on clean Windows environment

---

## Integration Checkpoints

### Checkpoint 1: First-Run Wizard (Week 1)
- `apps/desktop/main.cjs`: startup check + IPC handlers
- `src/web/render.ts`: wizard UI card
- `src/cli/index.ts`: `repolog init` subcommand
- Tests: `tests/desktop.test.ts` integration
- **Verify:** Desktop app detects missing PLAN.md, shows wizard, user can create templates

### Checkpoint 2: Settings UI + Config Hardening (Week 2)
- `src/web/render.ts`: settings panel with config fields
- `src/engine/config.ts`: validation + defaults
- `apps/desktop/main.cjs`: config write IPC
- Tests: `tests/config.test.ts` + UI smoke tests
- **Verify:** Settings are editable in UI; changes persist to `.repolog.json`

### Checkpoint 3: File Watch & Write-Back (Week 2–3)
- `src/engine/watcher.ts`: robustness audit + error handling
- `src/engine/writeback.ts`: atomic writes + verification
- `apps/desktop/main.cjs`: sync flow IPC
- Tests: `tests/watcher.test.ts` + `tests/writeback.test.ts`
- **Verify:** Changes sync reliably; write-back toggles work without clobbering

### Checkpoint 4: Clarity & Docs (Week 3)
- `src/engine/doctor.ts`: improved findings + suggestions
- `src/engine/tuneup.ts`: human-friendly prompts
- `src/cli/index.ts`: init templates with comments
- Tests: manual review of outputs + user-focused QA
- **Verify:** New users can understand findings and act on them

### Checkpoint 5: Release & Deployment (Week 4)
- CHANGELOG.md structured
- Installer messaging added
- Exe supports `--repo-root` + `--version`
- Distribution checklist completed
- **Verify:** Clean install → first-run wizard → doctor → docs self-manage

---

## Definition of Done (v0.4)

A RepoLog user should be able to:

1. **Download & install:** exe from GitHub release, installer runs, app starts
2. **Point at a repo:** Folder picker → select repo root → app loads (or use `--repo-root` flag)
3. **First-run:** Desktop detects missing PLAN.md → shows wizard → suggests fixes
4. **Generate structure:** User clicks "Create PLAN.md" or "Generate CHARTER.md" → files are created
5. **Run doctor:** User clicks "Run Doctor" → findings display in UI → suggestions are actionable
6. **Edit settings:** User opens Settings → edits excludes / write-back / prompts-dir → saves → watcher re-scans
7. **Watch & sync:** Files change externally → watcher detects → HUD updates. User toggles checkbox in UI → write-back updates markdown → watcher detects → UI reconciles.
8. **Self-manage:** After initial setup, markdown stays legible. Doctor runs periodically (or on-demand) and reports good health. User can hand off state to Claude/Codex/Gemini via copy-prompt, and those agents can update PLAN.md. RepoLog auto-detects changes and surfaces them.
9. **Release:** v0.4 tagged + released on GitHub with release notes + exe + vsix available for download

---

## Test Coverage Targets

- `tests/doctor.test.ts`: Findings are clear; health check logic is sound
- `tests/config.test.ts` (new): Validation handles pristine/missing/corrupt/partial configs
- `tests/watcher.test.ts`: Create/modify/delete events; debounce works
- `tests/writeback.test.ts`: Atomic writes; stale-line detection; rollback
- `tests/desktop.test.ts`: Startup check; IPC handlers; sync flow
- `tests/tuneup.test.ts` (existing): Prompt quality; charter determinism
- Manual UI QA: First-run wizard; settings panel; toast messages

---

## Handoff Notes for Agents

- **Architecture:** One shared `QuestState` drives all surfaces (TUI, desktop, VS Code). Keep this pattern; don't deviate.
- **Testing:** Write tests *before* or *during* implementation. All 42 existing tests must still pass at the end.
- **Build Gate:** Before marking a task done, run `npm run build && npm run lint && npm test`. If anything fails, it's not done.
- **Fixture Repos:** Use `tests/fixtures/healthy/` and `tests/fixtures/noisy/` for testing. Ensure your changes work on both.
- **Design Spec:** [Repo Quest Log.html](docs/design/Repo%20Quest%20Log.html) is the visual truth. Desktop must match it.
- **No Dependencies:** Avoid new runtime dependencies. Prefer Node builtins or existing packages (remark, chokidar, etc.).
- **Backwards Compat:** If you change `QuestState` shape, add a schema version bump and a compat shim so old state still works.
- **Git:** User commits only. You ship code; they audit and commit.

---

## Success Criteria

- ✅ 50+ tests pass (up from 42)
- ✅ Zero unhandled errors in desktop app, TUI, VS Code extension
- ✅ First-run wizard works on clean Windows install
- ✅ Doctor findings are actionable and improve state from "messy" to "good"
- ✅ Settings UI is usable without JSON editing
- ✅ File watch + write-back are reliable (no lost changes)
- ✅ Release checklist is complete
- ✅ User can hand off repo state to Claude/Codex/Gemini and self-manage after initial setup
