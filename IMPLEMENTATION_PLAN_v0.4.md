# RepoLog v0.4 Implementation Plan

**Objective:** Enable anyone to download the RepoLog exe, install it, open it in a repo folder, run the doctor once, and have the docs self-manage themselves with good reporting through the HUD.

**Target:** Ship v0.4 with frictionless first-run doctor workflow, reliable file watching + write-back, and polished settings/config UI.

**Ownership:** AGENTS.md for backend implementation; CLAUDE.md for design/planning as needed.

---

## Prerequisites for Implementation

- Read `docs/SCHEMA.md` for all type shapes: `RepoConfig`, `QuestState`, `DoctorReport`, `TuneupResult`
- Fixture repos: use `tests/fixtures/healthy/` (expected to pass doctor) and `tests/fixtures/noisy/` (expected to show gaps) for all test scenarios
- Design spec: `docs/design/Repo Quest Log.html` is the visual source of truth; desktop UI must match exactly

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

---

## The Five Work Streams

### 1. First-Run Wizard (Desktop App)

**Goal:** User opens RepoLog exe → app detects PLAN.md/STATE.md/CHARTER.md → if missing, offers guided setup.

**Execution Order:** Tasks must run in sequence: 1a → 1b → 1c → 1d. CLI generators (1d) must exist before wizard UI (1b) can call them.

#### Tasks

**1a. Startup health check**
- **File:** `apps/desktop/main.cjs` (execute after repo root is resolved)
- **Logic:**
  - Check if `PLAN.md` exists in repo root. If missing, set `wizardTrigger = true`.
  - Check if `STATE.md` exists. If missing, note it (but don't trigger wizard alone).
  - Check if `.repolog/CHARTER.md` exists. If missing, note it (suggestion only).
  - Store results in a `firstRunState` object to pass to renderer via IPC.
- **Trigger Rule:** Wizard appears **only if PLAN.md is missing**. Other gaps are suggestions, not blockers.
- **IPC Handler:** `repolog:first-run-check`
  - **Input:** none
  - **Returns:** `{ hasPlanMd: boolean, hasStateMd: boolean, hasCharterMd: boolean, wizardPrompts: string[] }`
  - **Storage:** `firstRunState` persisted in Electron userData at `~/.repolog/first-run-state.json`
- **Test:** Run on `tests/fixtures/healthy/` (PLAN.md present, no wizard) and `tests/fixtures/noisy/` (PLAN.md missing, wizard triggered)

**1b. First-run wizard UI panel**
- **File:** `src/web/render.ts` (new "Setup" card in settings, or dedicated modal)
- **Visual Spec:** Follows `docs/design/Repo Quest Log.html`; simple card with sequential steps:
  1. "Welcome to RepoLog" — brief mission statement (1 sentence: "A calm memory layer for repos using AI agents").
  2. "Running doctor…" — spinner while `repolog doctor --json` executes
  3. "Here's what we found:" — display doctor findings as list (missing files, gaps, health score)
  4. "Fix it now?" — offer action buttons:
     - "Generate CHARTER.md" → runs tuneup, writes `.repolog/CHARTER.md`
     - "Create PLAN.md template" → calls `repolog init --plan` via IPC
     - "Create STATE.md template" → calls `repolog init --state` via IPC
     - "Skip, I'll do it later" → dismisses wizard, shows normal HUD
- **Behavior:**
  - Wizard shows **only once per repo** (checked via `lastWizardRun` timestamp in Electron userData)
  - Each action button calls the corresponding IPC handler (see 1c)
  - After action succeeds, show toast: "PLAN.md created ✓" or "CHARTER.md written ✓" (2s duration, auto-dismiss)
  - Dismiss button → write `lastWizardRun = now()` to userData, then show normal HUD, no nag on future starts
  - If doctor times out (>30s), show "Doctor scan timed out; run doctor manually." and disable "Run Doctor" button
- **Doctor Re-run:** After user creates files, offer "Run Doctor Again?" button to update findings in real-time

**1c. Desktop app IPC wiring**
- **File:** `apps/desktop/main.cjs` + `apps/desktop/preload.cjs`
- **IPC Handlers (all async, return via `event.reply`):**
  - `repolog:first-run-check` → returns `{ hasPlanMd, hasStateMd, hasCharterMd, wizardPrompts }`
  - `repolog:run-doctor` → executes `repolog doctor --json`, returns parsed JSON (or error with message)
  - `repolog:create-plan-template` → calls `repolog init --plan --write` (see 1d), returns success/error
  - `repolog:create-state-template` → calls `repolog init --state --write`, returns success/error
  - `repolog:wizard-dismiss` → writes `lastWizardRun: Date.now()` to userData (path: `~/.repolog/first-run-state.json`), returns acknowledged
- **Preload Bridge:** Expose to renderer as `window.repologDesktop.firstRunCheck()`, `window.repologDesktop.runDoctor()`, etc.
- **Error Handling:** If a handler fails, emit error event with context (handler name, error message); renderer shows error toast

**1d. CLI generators (new)**
- **File:** `src/cli/index.ts` (new subcommand: `repolog init`)
- **Commands:**
  - `repolog init --plan [--write]` → generates PLAN.md template
    - Default: write to stdout
    - With `--write`: write to `./PLAN.md` in current repo root
    - Fails if file already exists (unless `--force`)
  - `repolog init --state [--write]` → generates STATE.md template
    - Default: write to stdout
    - With `--write`: write to `./STATE.md` in current repo root
    - Fails if file already exists (unless `--force`)
  - `repolog init --config [--write]` → generates `.repolog.json` template with defaults
    - Default: write to stdout
    - With `--write`: write to `./.repolog.json` in current repo root
  - `repolog init --all` → creates all three (PLAN.md, STATE.md, .repolog.json) at repo root in one call
- **Template Content:**
  - **PLAN.md:** Frontmatter `---\ntitle: [Repo Name]\n---`, then sections: `## Objective`, `## Now`, `## Next`, `## Blocked`, `## Releases (v0.1 / v0.2 / v0.3)` with placeholders
  - **STATE.md:** Frontmatter with status/owner, then sections: `## Current Focus`, `## Resume Note`, `## Recent Decisions` with explanatory comments
  - **.repolog.json:** Defaults: `{ "excludes": [], "writeback": false, "prompts": { "dir": "~/.repolog/prompts" }, "schemaVersion": 2 }`
- **Comments in Templates:** Each section includes a 1–2 line comment explaining how RepoLog uses it (e.g., "RepoLog extracts NOW items from this section and shows them in the HUD")
- **Exit Codes:** 
  - `0` on success
  - `1` if file already exists (without `--force`)
  - `1` if write fails (permission error, disk full, etc.)

**Acceptance Criteria (1a–1d):**
- [ ] `repolog init --plan --write` creates readable PLAN.md in repo root with proper structure
- [ ] `repolog init --state --write` creates readable STATE.md in repo root with proper structure
- [ ] `repolog init --config --write` creates `.repolog.json` with sensible defaults
- [ ] Desktop startup health check runs; IPC returns correct shape
- [ ] Wizard appears **only when PLAN.md is missing**; not for other gaps
- [ ] Wizard clicking "Create PLAN.md" calls init → writes file → shows toast
- [ ] Wizard clicking "Generate CHARTER.md" runs tuneup and writes file; UI reflects success
- [ ] Wizard dismissal sets `lastWizardRun` timestamp; wizard doesn't reappear on next startup
- [ ] Tests pass: `tests/desktop.test.ts` (startup check, IPC handlers, sync flow)
- [ ] Tests pass: `tests/cli.test.ts` for `repolog init` command (all subcommands, --write flag, error cases)

---

### 2. Settings & Config UI (Desktop + VS Code)

**Goal:** Make `.repolog.json` editable in the UI without touching JSON directly. Provide sensible defaults and validation.

#### Tasks

**2a. Config UI panel (desktop/web renderer)**
- **File:** `src/web/render.ts` (new "Settings" card/panel)
- **UI Fields:**
  - **Excludes:** Multiline textarea, default suggestions: `archive`, `archived`, `node_modules`, one per line
  - **Write-back:** Toggle switch (off by default); show warning banner "Write-back is ON. Toggling tasks will update your markdown files." when enabled
  - **Prompts dir:** Text input, defaults to `~/.repolog/prompts` (expanded via `path.join(os.homedir(), '.repolog', 'prompts')` on Windows)
  - **Watch auto-refresh:** Toggle (on by default), optional delay field in ms
  - **Report file changes:** Toggle (on by default)
- **Behavior:**
  - Load current config from `.repolog.json` on scan; populate fields
  - "Save" button validates all fields, then calls IPC handler `repolog:write-config` (see 2c)
  - On success: show toast "Settings saved ✓" (2s auto-dismiss)
  - On validation error: show error banner in UI (e.g., "Excludes must be a list, one per line")
  - Prevent save if validation fails
- **Visual spec:** Match `docs/design/Repo Quest Log.html` density + color palette

**2b. Config validation & defaults**
- **File:** `src/engine/config.ts` (new `validateAndFillConfig` function)
- **Function Signature:** `validateAndFillConfig(raw: unknown): RepoConfig`
- **Default Values Table:**
  | Field | Type | Default | Description |
  |-------|------|---------|-------------|
  | `excludes` | `string[]` | `[]` | Glob patterns to skip (e.g., "node_modules") |
  | `writeback` | `boolean` | `false` | Enable checkbox-only write-back |
  | `prompts.dir` | `string` | `~/.repolog/prompts` | User prompt templates directory |
  | `watch.debounce` | `number` | `500` | ms delay before re-scan on file change |
  | `watch.reportFileChanges` | `boolean` | `true` | Emit file change events to UI |
  | `schemaVersion` | `number` | `2` | Config format version (for future migrations) |
- **Behavior:**
  - If `.repolog.json` is missing, return defaults (don't create file yet; file is written on first save)
  - If `.repolog.json` is corrupt JSON, throw error with message: "Invalid .repolog.json: {parse error}"
  - Merge user config with defaults: user values override defaults
  - Validate types and constraints:
    - `excludes`: must be `string[]`, each item is a valid glob pattern
    - `writeback`: must be `boolean`
    - `prompts.dir`: must be a `string`, expands `~` to `os.homedir()`
    - `watch.debounce`: must be a `number`, minimum 100ms, maximum 10000ms
  - Return validated + merged config or throw descriptive error
- **Test File:** `tests/config.test.ts` — scenarios:
  - Pristine repo (no `.repolog.json`): returns defaults
  - Missing `.repolog.json`: returns defaults
  - Corrupt JSON: throws error with parse details
  - Partial config (only `excludes` present): merges with defaults
  - Valid config: validates and returns unchanged
  - Invalid types (e.g., `writeback: "yes"`): throws type error

**2c. Desktop IPC for config write**
- **File:** `apps/desktop/main.cjs`
- **IPC Handler:** `repolog:write-config`
  - **Input:** `{ excludes?: string[], writeback?: boolean, promptsDir?: string, ... }`
  - **Behavior:**
    1. Read current `.repolog.json` (or use empty object if missing)
    2. Merge incoming changes (user values win)
    3. Validate merged config via `validateAndFillConfig`
    4. Write to temp file: `.repolog.json.tmp` in same directory
    5. Atomic rename: `fs.renameSync('.repolog.json.tmp', '.repolog.json')` (Windows-safe)
    6. If rename fails, restore from temp and throw error
    7. Emit `repolog:config-changed` event to renderer
    8. Trigger watcher to re-scan immediately
  - **Returns:** `{ success: true }` or throws with `{ error: string }`
  - **Atomicity Note:** On Windows, `fs.renameSync` is atomic if source and target are on the same drive. For network paths, add a retry loop (3 attempts, 100ms delay)

**2d. VS Code extension config UI**
- **File:** `extensions/vscode/extension.js`
- **Approach:** VS Code extension uses the shared HTML renderer (webview panel). Config UI is part of the same panel.
- **Message Flow:**
  - Renderer posts message: `{ type: "writeConfig", payload: { excludes, writeback, ... } }`
  - Extension.js receives message in webview post handler
  - Extension calls: `fs.writeFileSync(path.join(repoRoot, '.repolog.json'), JSON.stringify(merged, null, 2))`
  - Extension re-triggers scan via shared engine module
  - Sends back `{ type: "configSaved" }` to renderer
- **Error Handling:** If write fails, send back `{ type: "error", message: "Failed to save config" }`

**Acceptance Criteria (2a–2d):**
- [ ] Settings panel displays current `.repolog.json` values in all fields
- [ ] All fields are editable without JSON editing
- [ ] "Save" button validates fields; prevents save on validation error
- [ ] Invalid config shows error banner in UI with specific error message
- [ ] On success, config is written atomically; toast shows "Settings saved ✓"
- [ ] Watcher re-scans immediately after config write
- [ ] Defaults are sensible: excludes=[], writeback=false, debounce=500
- [ ] Validation function tested with pristine/missing/corrupt/partial configs
- [ ] VS Code extension can read/write config via shared renderer
- [ ] Tests pass: `tests/config.test.ts` + smoke tests for UI save flow

---

### 3. File Watch & Write-Back Hardening

**Goal:** Ensure file changes (external and write-back) are reliably detected and synced without data loss.

#### Tasks

**3a. Watcher robustness audit**
- **File:** `src/engine/watcher.ts`
- **Audit Checklist:**
  - [ ] Does it handle file creation (new PLAN.md)? Test with `tests/fixtures/noisy/` → add a new file and verify watcher detects it
  - [ ] Does it handle file deletion (old task doc)? Test deletion and verify event fires
  - [ ] Does it debounce multiple rapid changes? Verify at least 500ms debounce is applied
  - [ ] Does it recover if a watched file is temporarily deleted? (e.g., vim `.swp` file cycle)
  - [ ] Does it handle symlinks / junctions (Windows)? Test with junctions in fixture
  - [ ] Current debounce value? Audit the code and note the existing value; increase to **500ms minimum** if lower
- **Required Changes:**
  - Debounce: minimum 500ms (apply to all events: create, modify, unlink)
  - Explicit handlers for `unlink` and `unlinkDir` events (not just `add` and `change`)
  - Error logging: any watcher error → log to stderr with context (file name, event type, error message)
  - Error recovery: emit `error` event so consumers (desktop, TUI) can show user-facing banner: "File watch lost sync; re-scanning repo."
- **Test:** `tests/watcher.test.ts`
  - Create/modify/delete scenarios on healthy and noisy fixtures
  - Rapid-fire changes (5 changes in 100ms) → verify debounce collapses to 1 scan
  - Symlink handling on Windows (if applicable)
  - Unlink event verification (file deletion)

**3b. Write-back atomicity hardening**
- **File:** `src/engine/writeback.ts` (review + enhance existing implementation)
- **Current:** Stale-line detection, exact-match on toggle targets
- **Hardening Requirements:**
  1. **Atomic writes:**
     - Write to temp file first: `${targetFile}.tmp` in same directory as target
     - After write succeeds, `fs.renameSync(tmp, target)` for atomic replacement
     - On Windows, atomic rename is safe if source and target are on the same drive
  2. **Write verification:**
     - After rename, immediately read file back and compare SHA-256 of written content vs. intended content
     - If SHA doesn't match, restore from backup (save original before write), throw error with details
  3. **Rollback:**
     - If verification fails, restore original file and throw: `"Write verification failed: content mismatch. Original restored."`
     - Log before/after SHA for audit trail
  4. **Concurrent write safety:**
     - Queue writes (use a simple `writeQueue: Promise[]` array)
     - Wait for previous write to complete before starting next
     - Reject concurrent writes to the same file with: `"Another write is in progress for this file"`
  5. **Stale-line detection (existing, verify):**
     - Before rewriting, check that the target line still matches the original
     - If line has changed, reject write with: `"Line has changed since last read; re-scan required"`
- **Test:** `tests/writeback.test.ts`
  - Atomic writes on healthy fixture
  - Concurrent write attempts → verify queue behavior
  - Stale-line detection → modify file externally, then try write-back → should reject
  - Rollback scenario: force write to fail (e.g., mock SHA mismatch) → verify original is restored
  - Log audit trail: capture before/after SHA and verify in logs

**3c. Desktop app sync flow**
- **File:** `apps/desktop/main.cjs` + renderer (`src/web/render.ts`)
- **Flow (user toggles checkbox in UI):**
  1. Renderer calls `repolog:toggle-task` IPC with task ID
  2. Desktop handler calls `writeback.toggleTask(taskId)` from engine
  3. If success:
     - Emit `repolog:task-toggled` event with updated task state to renderer
     - Renderer shows toast: "Task updated ✓" (2s)
     - Renderer optimistically updates UI immediately
  4. If write fails (stale line, permission error, etc.):
     - Return error response: `{ error: "Stale line; re-scan required" }`
     - Renderer shows error toast: "Failed to update task. Re-scanning…" (with spinner)
     - Renderer triggers full re-scan via `repolog:rescan` IPC
  5. Watcher detects file change (from write or re-scan)
  6. Watcher broadcasts updated `QuestState` to renderer
  7. Renderer reconciles optimistic update with new state (should match if write succeeded)
- **IPC Handlers:**
  - `repolog:toggle-task` with payload `{ taskId: string }`
    - Returns: `{ success: true, updatedState: QuestState }` or `{ error: string }`
  - `repolog:rescan` → full re-scan, returns updated `QuestState`

**3d. Config sync on write**
- **File:** `src/engine/watcher.ts` + `src/engine/scan.ts`
- **Behavior:**
  - When `.repolog.json` is written (via settings UI), watcher detects `change` event
  - Watcher emits `config-changed` event with new config
  - Scan re-reads `.repolog.json` via `validateAndFillConfig`
  - Scan rebuilds `QuestState` with new config (excludes may change visible files)
  - Broadcast updated state to all consumers (renderer, TUI, etc.)

**Acceptance Criteria (3a–3d):**
- [ ] Watcher detects file create/modify/delete events without missing any
- [ ] Debounce is at least 500ms (verify in audit)
- [ ] Unlink events are handled explicitly
- [ ] Errors emit to consumers; desktop shows "lost sync" banner on recovery
- [ ] Write-back uses atomic temp → rename pattern
- [ ] Written content verified via SHA; rollback on mismatch
- [ ] Concurrent writes are queued safely
- [ ] Stale-line detection prevents clobbering
- [ ] Checkbox toggle → UI update → toast flow works end-to-end
- [ ] Config changes trigger re-scan and state update
- [ ] Tests pass: `tests/watcher.test.ts` + `tests/writeback.test.ts`

---

### 4. Clarity & Documentation

**Goal:** Ensure new users understand doctor findings and can act on them; init templates are self-explanatory.

#### Tasks

**4a. Init template comments**
- **File:** `src/cli/index.ts` (init template generators)
- **PLAN.md comments:**
  - After `## Objective:` → "RepoLog looks here to answer: 'What is this repo trying to become?'"
  - After `## Now:` → "Unchecked items here appear in the HUD as current work. Prefix task names with status: `- [ ] [design]`, `- [ ] [implement]`, etc."
  - After `## Next:` → "RepoLog pulls these into the HUD. These items feed into the prompt palette for 'what's coming next?'"
  - After `## Blocked:` → "List any blockers here with owner/reason. Agents see these when resuming context."
- **STATE.md comments:**
  - After `## Current Focus:` → "One-liner: what is the team focused on right now?"
  - After `## Resume Note:` → "One paragraph. What did the last session accomplish? What should the next agent know?"
  - After `## Recent Decisions:` → "Bullet list of key decisions and *why* they were made. Helps prevent rework."
- **All comments:** 1–2 lines max, no fluff, explain *why* RepoLog cares about the section

**4b. Doctor output clarity**
- **File:** `src/engine/doctor.ts`
- **Review & Improve:**
  - [ ] Are finding messages clear to first-time users? (e.g., avoid jargon)
  - [ ] Do suggestions actually fix the issue? (test the suggestion manually)
  - [ ] Is severity (error, warning, info) correct?
- **Required Improvements:**
  - When suggesting a missing `## Objective`, show example: "Add `## Objective` heading at the top of PLAN.md with 1–2 sentences describing what this repo aims to achieve."
  - When suggesting missing `## Now`, show example: "Add `## Now` section with unchecked items: `- [ ] [task name]`"
  - Explain *why* each finding matters:
    - "Without an Objective, RepoLog can't answer: 'What is this repo trying to become?' Agents use this to understand scope."
    - "Without a Now section, agents don't know what to work on next."
  - Prioritize findings by impact:
    - **Critical:** PLAN.md missing (can't resolve repo intent)
    - **High:** STATE.md missing (resume context incomplete)
    - **Medium:** Objective missing (repo intent unclear)
    - **Low:** Formatting issues, old frontmatter
- **Example Finding Improvement:**
  - **Before:** "Missing Objective in PLAN.md"
  - **After:** "PLAN.md is missing an Objective. Add a `## Objective` heading with 1–2 sentences describing what this repo aims to become. Without it, agents can't understand the scope and may work on the wrong tasks."

**4c. Tuneup prompt clarity**
- **File:** `src/engine/tuneup.ts`
- **Improvements:**
  - Intro line: "RepoLog found opportunities to improve your repo's legibility. Here's a suggested prompt for Claude/Codex/Gemini to apply fixes:"
  - Format gaps as a numbered list with clear headings and markdown diffs:
    ```
    1. Add Objective to PLAN.md
       Current: (nothing)
       Add:
       ## Objective
       Describe what this repo is trying to become.
    ```
  - Each gap includes a concrete action (diff-style)
  - End with: "After applying these changes, run `repolog doctor` again to verify."
  - Ensure prompt is ready-to-paste into an LLM without any manual editing needed
  - **Test:** Paste generated tuneup prompt into Claude, Codex, or Gemini; verify it runs without clarification requests

**Acceptance Criteria (4a–4c):**
- [ ] Init templates include helpful comments (tested on generated files)
- [ ] Doctor findings are clear and actionable; new user can understand and fix each one
- [ ] Doctor findings explain *why* they matter
- [ ] Doctor findings are prioritized by impact
- [ ] Tuneup prompts include intro line + numbered gaps with diffs + verification step
- [ ] Tuneup prompt is LLM-ready (can be pasted directly)
- [ ] New-user feedback loop works: doctor → fix → tuneup → apply → verify → good state

---

### 5. Release & Deployment Improvements

**Goal:** Make exe distribution seamless; add release notes + installer polish + portable exe enhancements.

#### Tasks

**5a. Release notes automation**
- **File:** `CHANGELOG.md` (review + structure)
- **Format:**
  ```markdown
  ## v0.4.0 — 2026-04-22

  ### Features
  - First-run wizard: desktop app detects missing PLAN.md, offers guided setup
  - Settings UI: edit excludes, write-back toggle, prompts directory without JSON
  - File watch + write-back hardening: atomic writes, verification, error recovery
  - Init templates: `repolog init --plan`, `--state`, `--config` with helpful comments
  - Doctor clarity: findings explain why they matter; suggestions are actionable

  ### Fixes
  - Watcher now handles file creation/deletion events
  - Write-back uses atomic temp → rename pattern
  - Config validation provides sensible defaults

  ### Breaking Changes
  - (none in v0.4)
  ```
- **Extraction:** v0.4 notes are copy-paste-ready for GitHub release description
- **Automation Note:** User will manually create the GitHub release; this task ensures notes are structured

**5b. Installer messaging**
- **File:** `release/` or electron-builder config in `package.json`
- **Review:** Does the NSIS installer show helpful first-run text?
- **Changes:**
  - Installer welcome page: "RepoLog helps you manage repo context with AI agents. Install and open your repo to get started."
  - Installer finish page: "RepoLog is installed. To get started: 1) Open a repo folder via File → Open Repo, 2) Let it run the doctor, 3) Fix any issues. Done!"
  - (Optional) Checkbox: "Create desktop shortcut"
  - (Optional) Run RepoLog checkbox: "Launch RepoLog now" (default: checked)

**5c. Portable exe enhancements**
- **File:** `apps/desktop/main.cjs`
- **Requirements:**
  - `last-root.txt` stored in Electron userData (e.g., `~/.repolog/last-root.txt`), not in repo. This prevents cross-contamination when opening multiple repos.
  - Command-line arg support: `RepoLog.exe --repo-root C:\path\to\repo` opens specific repo on startup
  - `--version` flag shows version: `RepoLog.exe --version` → outputs `v0.4.0` (or current version)
  - CLI `--version` flag: `repolog --version` → same output
- **Test:** 
  - Open exe from different locations, verify state isolation
  - Open multiple repos with `--repo-root` flag, verify no cross-contamination
  - Run `RepoLog.exe --version` and `repolog --version`, verify output

**5d. Distribution checklist**
- **Task:** Before shipping v0.4, verify all items:
  - [ ] `npm run build` succeeds without errors (TypeScript compile)
  - [ ] `npm run lint` succeeds (no ESLint errors)
  - [ ] `npm test` passes all 50+ tests (up from 42)
  - [ ] `npm run desktop:build` succeeds and produces `.exe`
  - [ ] `.exe` runs standalone on clean Windows (no missing dependencies)
  - [ ] First-run wizard appears (tested on clean Windows VM)
  - [ ] `repolog` CLI works from cmd and PowerShell
  - [ ] TUI renders correctly in Windows Terminal with correct colors
  - [ ] VS Code extension installs and loads without errors
  - [ ] `CHANGELOG.md` is updated with v0.4.0 notes (copy-paste ready)
  - [ ] GitHub release draft is prepared (user will publish)

**Acceptance Criteria (5a–5d):**
- [ ] CHANGELOG.md is structured for easy GitHub release extraction
- [ ] Installer shows helpful first-run messaging
- [ ] Exe accepts `--repo-root` argument and opens specified repo
- [ ] Exe shows `--version`
- [ ] Multiple repos can be opened without state leakage (tested)
- [ ] Distribution checklist is documented and all items verified
- [ ] Pre-release testing passes on clean Windows environment

---

## Integration Checkpoints

### Checkpoint 1: First-Run Wizard (Week 1)
**Files:** `apps/desktop/main.cjs`, `src/web/render.ts`, `src/cli/index.ts`
**Tests:** `tests/desktop.test.ts`, `tests/cli.test.ts`
**Verify:** 
- Desktop app detects missing PLAN.md, shows wizard
- User can click "Create PLAN.md" and file is created
- Wizard doesn't reappear on next startup
- All tests pass

### Checkpoint 2: Settings UI + Config Hardening (Week 2)
**Files:** `src/web/render.ts`, `src/engine/config.ts`, `apps/desktop/main.cjs`
**Tests:** `tests/config.test.ts`, UI smoke tests
**Verify:**
- Settings panel displays current config values
- User can edit all fields without JSON
- Save button validates and persists changes
- Watcher re-scans on config change

### Checkpoint 3: File Watch & Write-Back (Week 2–3)
**Files:** `src/engine/watcher.ts`, `src/engine/writeback.ts`, `apps/desktop/main.cjs`
**Tests:** `tests/watcher.test.ts`, `tests/writeback.test.ts`
**Verify:**
- Watcher detects all file events (create, modify, delete)
- Write-back is atomic and verified
- Concurrent writes are queued safely
- Stale-line detection works

### Checkpoint 4: Clarity & Documentation (Week 3)
**Files:** `src/engine/doctor.ts`, `src/engine/tuneup.ts`, `src/cli/index.ts`
**Tests:** `tests/doctor.test.ts`, manual review of outputs
**Verify:**
- Doctor findings are clear and actionable
- Init templates include helpful comments
- Tuneup prompts are LLM-ready

### Checkpoint 5: Release & Deployment (Week 4)
**Files:** `CHANGELOG.md`, `release/`, `apps/desktop/main.cjs`, distribution checklist
**Tests:** Full pre-release QA on clean Windows
**Verify:**
- Exe runs standalone
- First-run wizard works end-to-end
- Doctor → fix → verify feedback loop succeeds
- Distribution checklist passes

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

- `tests/cli.test.ts` (new): `repolog init --plan --write`, `--state --write`, `--config --write`, `--all`, error cases
- `tests/config.test.ts` (new): Validation, defaults, merge, pristine/missing/corrupt/partial configs
- `tests/desktop.test.ts`: Startup check, IPC handlers, sync flow, error handling
- `tests/watcher.test.ts`: Create/modify/delete/unlink events, debounce, symlinks, error recovery
- `tests/writeback.test.ts`: Atomic writes, verification, rollback, stale-line detection, concurrent writes
- `tests/doctor.test.ts`: Findings are clear, suggestions are actionable, prioritization
- `tests/tuneup.test.ts` (existing): Prompt quality, charter determinism, LLM-readiness
- Manual UI QA: First-run wizard flow, settings panel save flow, error toasts, visual spec match

---

## Handoff Notes for Agents

- **Architecture:** One shared `QuestState` drives all surfaces (TUI, desktop, VS Code). Keep this pattern.
- **Testing:** Write tests *before* or *during* implementation. All 42 existing tests must still pass at end.
- **Build Gate:** Before marking task done, run `npm run build && npm run lint && npm test`. Anything failing = not done.
- **Fixture Repos:** Test all new code on `tests/fixtures/healthy/` (expected to pass doctor) and `tests/fixtures/noisy/` (expected to show gaps).
- **Design Spec:** `docs/design/Repo Quest Log.html` is visual truth. Desktop UI must match exactly.
- **Type Shapes:** See `docs/SCHEMA.md` for `RepoConfig`, `QuestState`, `DoctorReport`, `TuneupResult`.
- **No Dependencies:** Avoid new runtime dependencies. Prefer Node builtins or existing packages (remark, chokidar, etc.).
- **Backwards Compat:** If you change `QuestState` shape, add schema version bump and compat shim.
- **Git:** User commits only. You ship code; they audit and commit.
- **IPC Specs:** All handlers are documented with input/output shapes above; implement exactly as specified.
- **Atomic Writes:** Windows requires `fs.renameSync()` atomicity; test on network paths with retry logic.
- **Platform Handling:** `~` expansions use `path.join(os.homedir(), ...)` on all platforms.

---

## Success Criteria

- ✅ 50+ tests pass (up from 42)
- ✅ Zero unhandled errors in desktop app, TUI, VS Code extension
- ✅ First-run wizard works on clean Windows install
- ✅ Doctor findings are actionable; improve state from "messy" to "good"
- ✅ Settings UI is usable without JSON editing
- ✅ File watch + write-back are reliable (no lost changes)
- ✅ Init templates are self-explanatory
- ✅ Release checklist is complete
- ✅ User can hand off repo state to Claude/Codex/Gemini and self-manage after setup
