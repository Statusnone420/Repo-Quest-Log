# plan_implementation.md

## Product direction

Repo Quest Log already has the right wedge. The product docs define it as a **local-first legibility layer** for coding-agent workflows: a way to make repo intent, current work, blockers, and resume context visible without turning into an orchestrator, dashboard, or gamified task manager. The repo already ships multiple surfaces around that idea: JSON scan, terminal HUD, desktop HTML snapshot, Electron desktop shell, and a VS Code side panel, all anchored on the same `QuestState` contract. The current stack is deliberately small and practical: Node 20+, TypeScript 5.4, Ink for the TUI, Electron for the Windows desktop host, chokidar for watching, and markdown parsing through `gray-matter` plus the remark/unified toolchain. fileciteturn14file0 fileciteturn51file0 fileciteturn15file0 fileciteturn52file0

That product direction is strategically aligned with where agent tooling is going. GitHub’s current Copilot docs explicitly recognize repository agent-instruction files such as `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`, while Anthropic’s Claude Code docs treat markdown-based custom commands, status lines, and hooks as first-class workflow primitives. In other words, Repo Quest Log is not inventing a weird side format that only its own UI understands; it is already orbiting conventions that developers and agent platforms are adopting. citeturn3search6turn3search1turn2search0turn4search0turn4search1

The most important implication is this: the next pass should not try to make the app “bigger.” It should make the app **more reusable inside real developer workflows**. The right additions are the ones that help a developer or agent resume, validate, open, export, or hand off work faster, while keeping the current local-first and markdown-first philosophy intact. That is also consistent with the PRD’s own line in the sand: legibility, not orchestration. fileciteturn14file0

## Execution tracker

Overall progress: **30%**

| Workstream | Progress | What is actually left |
|---|---:|---|
| Foundation pass | 75% | Keep the shared helpers thin, finish any remaining doc/source reconciliation, and avoid reintroducing duplicated prompt or change logic. |
| Workflow tooling pass | 20% | External prompt files, `repolog prompt`, `repolog status --short`, `repolog doctor`, and command-palette parity in every surface. |
| Context enrichment pass | 0% | Schema v2 compat, `gitContext`, `agentActivity`, and minimal git/activity rendering. |
| Safe write-back pass | 0% | Opt-in checkbox-only write-back, banner, and adversarial tests. |

The next coding agent should treat the table above as the real priority order. If the percentage changes, update this table first.

## Codebase map

The core pipeline is already clean. `src/engine/fileset.ts` defines the markdown files and heading heuristics that matter. `src/engine/parse.ts` walks the repo, respects ignore rules, parses frontmatter, and builds sections/checklists from markdown. `src/engine/normalize.ts` turns that parsed material into `QuestState`, including mission, active quest, task buckets, agent profiles, recent changes, decisions, and the resume note. `src/engine/scan.ts` adds git branch and per-file diff summaries on top of that normalized state, while `src/engine/watcher.ts` debounces file events and refreshes state when relevant docs or `.repolog.json` change. fileciteturn22file0 fileciteturn23file0 fileciteturn25file0 fileciteturn26file0 fileciteturn27file0 fileciteturn28file0 fileciteturn29file0 fileciteturn30file0

The surfaces are also sensibly layered. The CLI entrypoint supports scan, watch, and desktop snapshot modes. The TUI is a full Ink application with a cockpit layout, “Objective” labeling, a Ctrl+K prompt palette, and static-frame fallback for non-interactive output. The desktop shell uses Electron with a preload bridge and live HTML replacement. The VS Code extension uses the same scan/watcher/render pipeline and posts file-open messages back into the extension host so it can open documents at exact lines. Desktop and VS Code share the HTML renderer in `src/web/render.ts`; the TUI is separate but consumes the same state. fileciteturn32file0 fileciteturn33file0 fileciteturn34file0 fileciteturn36file0 fileciteturn37file0 fileciteturn38file0 fileciteturn42file0 fileciteturn43file0

The repo also has a real test base, not just aspirational docs. There is coverage for normalization, scanning, watcher debounce behavior, web rendering, and desktop repo-root resolution. That is enough to support a disciplined next pass, but it is not yet enough to safely roll out write-back, richer config, or “messy repo” diagnostics without adding more fixtures and more negative-case tests. fileciteturn44file0 fileciteturn45file0 fileciteturn46file0 fileciteturn47file0 fileciteturn58file0

## Main findings

The first important finding is that the codebase is **ahead of the planning docs in a few places**. `PLAN.md` still lists TUI visual parity and some `Active Quest` → `Objective` renames as open work, but `src/tui/App.tsx` already contains a three-column HUD, `OBJECTIVE` copy, and Ctrl+K prompt palette behavior. That means the coding agent’s first job should not be new feature work; it should be a brief source-vs-doc reconciliation pass so the next handoff is not chasing stale tasks. fileciteturn16file0 fileciteturn17file0 fileciteturn33file0

The second finding is that the app now needs **shared workflow utilities** more than it needs more UI chrome. Prompt preset generation is duplicated in the TUI and the shared HTML renderer. Recent-change merging is duplicated in the TUI, Electron desktop host, and VS Code extension. “Relative since” formatting also exists in more than one place. Those duplications are manageable at v0.1, but they will turn into drift the moment prompt files, git context, activity feed, doctor output, or write-back get added. The next coding pass should centralize those utilities in engine-level modules before expanding features. fileciteturn33file0 fileciteturn36file0 fileciteturn37file0 fileciteturn42file0 fileciteturn28file0 fileciteturn29file0

The third finding is that **schema v2 is designed but not yet implemented**. The schema doc already drafts `objective`, `gitContext`, `agentActivity`, and `config`, but the runtime types and normalizer still emit `schemaVersion: 1` with `activeQuest` only. On top of that, the current config loader only supports exclude/ignore arrays; it does not yet support the draft `writeback` switch or prompt-directory configuration described in `docs/SCHEMA.md`. That gap is not a problem by itself, but it means anything involving prompt files, git status, or write-back should be done as part of a deliberate schema-compatibility pass, not as ad hoc fields added directly into the UI layer. fileciteturn15file0 fileciteturn21file0 fileciteturn25file0 fileciteturn28file0

The fourth finding is that **desktop file-open behavior is currently weaker than the data model suggests**. The renderer and extension both preserve `doc` and `line`, and the VS Code extension opens exact files and centers exact lines. The Electron desktop host, however, currently resolves the file path and calls `shell.openPath(filePath)`, which drops line precision entirely. For a tool that is supposed to reduce friction before handing work back to an agent or editor, this is a meaningful gap. fileciteturn36file0 fileciteturn42file0 fileciteturn37file0

The fifth finding is about product fit. Developers are using AI tools more than ever, but trust is not keeping up; Stack Overflow’s 2025 survey reported broad AI-tool usage alongside a sharp rise in distrust of output accuracy. That matters here. Repo Quest Log should earn trust by being transparent about **what it scanned, why it surfaced a task, what it ignored, and what it would write before it writes anything**. That makes a “doctor/explain” layer more urgent than ambitious write-back. citeturn2search1

The sixth finding is that the best “developer-friendly tools” for this app are **scriptable and repo-native**. Anthropic’s docs show markdown custom commands, shell-backed status lines, and hooks as normal parts of a coding-agent workflow; GitHub’s docs show repo-local agent instructions and custom agents built from markdown files; and VS Code’s UX guidance emphasizes commands and Quick Picks as discoverable, native interaction patterns rather than stuffing every action into a custom webview. That suggests the highest-leverage additions are: shared prompt files, CLI-accessible prompt/export/status commands, a doctor command, better editor-open integration, and minimal command-palette entrypoints in VS Code. citeturn2search0turn4search0turn4search1turn3search1turn3search6turn3search10turn3search0turn7search0turn3search7

## Recommended implementation strategy

The best next move is a **three-layer strategy**.

The first layer is **stabilization**: reconcile docs with source, move duplicated workflow logic into shared engine modules, and make the surfaces thinner. This protects the codebase from drift and gives the coding agent a safer base to build on. It also follows the repo’s own constraints: shared `QuestState`, one renderer for desktop/VS Code, no unnecessary dependencies, local-only behavior, and test-first discipline. fileciteturn18file0 fileciteturn19file0 fileciteturn51file0

The second layer is **developer workflow tooling**: prompt files, prompt export, status output, a doctor command, and exact editor-open behavior. This is where the product becomes genuinely useful between agent sessions. It turns Repo Quest Log from “a visible HUD” into “a small utility belt” that works from terminal, desktop, and IDE. It also keeps the scope controlled, because these are deterministic, local-first features rather than inference-heavy ones. The external docs back this direction directly: Claude Code supports markdown command files and scriptable status/hook integration; VS Code encourages commands and Quick Picks for user actions. citeturn2search0turn4search0turn4search1turn3search0turn7search0turn7search4

The third layer is **context enrichment with safe defaults**: schema v2 compatibility, lightweight git context, agent activity, and only then opt-in checkbox write-back. Write-back is useful, but it is also the first feature in this app that can silently damage a user’s source of truth if implemented lazily. The PRD and schema docs already recognize that risk, which is why they scope write-back to checkbox flips only, default it off, and require a persistent on-screen banner. That was the correct product instinct, and the implementation plan should preserve it. fileciteturn14file0 fileciteturn15file0

A final strategic note: if the desktop shell continues as Electron, keep its current local-only security posture and do not regress it. Electron’s current guidance still strongly recommends `nodeIntegration: false`, `contextIsolation: true`, careful IPC exposure, and validating IPC senders; the repo is already aligned with some of that through preload + context bridge and local file loading, so the next pass should harden those choices rather than weaken them. fileciteturn37file0 fileciteturn38file0 citeturn6search2turn5search0turn6search8

## Ready-to-build plan

### Foundation pass

Start by reconciling planning docs with the code that is actually on `main`. Specifically, update `PLAN.md` and `STATE.md` so they no longer claim that TUI Objective labeling and Ctrl+K parity are undone if those parts are already landed in `src/tui/App.tsx`. This is a short task, but it matters because the repo’s own agent instructions tell implementers to follow the docs first. If the docs are stale, every later handoff gets worse. fileciteturn16file0 fileciteturn17file0 fileciteturn18file0 fileciteturn19file0 fileciteturn33file0

Then add a thin set of shared engine modules and move duplicated logic into them:

- `src/engine/time.ts` for `relativeSince`
- `src/engine/changes.ts` for `mergeChanges`
- `src/engine/prompts.ts` for built-in prompt definitions, template rendering, and file loading
- `src/engine/editor.ts` for “open file at line” command construction and fallback behavior
- `src/engine/config.ts` expansion for new config keys beyond excludes

The goal here is not abstraction for abstraction’s sake. The goal is to ensure that CLI, TUI, desktop, and VS Code all derive prompt bodies, change merging, time strings, and editor-open behavior from one place. That will remove the biggest architectural friction before feature work starts. fileciteturn25file0 fileciteturn29file0 fileciteturn33file0 fileciteturn36file0 fileciteturn37file0 fileciteturn42file0

Done means:

- duplicated prompt-generation logic is removed from `src/tui/App.tsx` and `src/web/render.ts`
- duplicated change-merging logic is removed from TUI, desktop, and extension layers
- `npm run lint && npm test` stays green
- new unit tests cover prompt rendering, config loading, time formatting, and editor command formatting. fileciteturn52file0 fileciteturn44file0 fileciteturn45file0 fileciteturn46file0 fileciteturn47file0 fileciteturn58file0

Current estimate: **75%**

### Workflow tooling pass

This should be the real value-add pass.

Externalize prompts first. The repo already wants prompt templates moved out of hardcoded UI strings and into editable files, and the idea is backed by real agent-tooling patterns: Anthropic’s project/user command files are markdown, GitHub uses markdown instructions and agent profiles, and both approaches reward small, editable, repo-local text artifacts. The implementation should therefore support three prompt tiers in this order: built-ins, user overrides at `~/.repolog/prompts`, and repo overrides at `.repolog/prompts`. Repo-local prompts should win over user/global defaults because they are more specific to the current project. fileciteturn16file0 fileciteturn15file0 citeturn2search0turn3search10turn3search6

Add the following CLI commands in `src/cli/index.ts`:

- `repolog prompt list`
- `repolog prompt <id>`
- `repolog prompt <id> --copy`
- `repolog status --short`
- `repolog doctor`
- optional JSON mode later: `repolog doctor --json`

`repolog status --short` should emit a one-line summary that can fit into terminal prompts or Claude Code status-line integrations. `repolog prompt` should make the current palette useful outside the UI. `repolog doctor` should explain exactly what the scanner saw and why the current state looks the way it does. That doctor command is the biggest trust win in the whole plan. It should report scanned files, ignored paths, missing expected docs, missing sections, malformed config, and a short explanation for why each surfaced task landed in `now`, `next`, or `blocked`. citeturn4search0turn4search1turn2search1

At the surface layer:

- TUI Ctrl+K should consume the shared prompt registry instead of local hardcoded presets.
- Desktop Ctrl+K should do the same.
- VS Code should gain command-palette entrypoints and Quick Picks for prompt copy and doctor actions, instead of relying only on the webview. That is directly aligned with VS Code’s command, command-palette, and Quick Pick guidance. fileciteturn33file0 fileciteturn36file0 fileciteturn42file0 citeturn3search0turn7search0turn10search1turn7search4

Done means:

- prompt definitions live in shared files/modules, not duplicated UI code
- prompts can be listed and rendered from the CLI
- users can override at least one prompt by dropping a `.md` file into a prompt directory
- `repolog doctor` gives a useful answer on both a healthy fixture and a messy fixture
- VS Code exposes prompt and doctor actions through commands / Quick Picks, not only webview buttons. fileciteturn44file0 fileciteturn58file0

Current estimate: **20%**

### Context enrichment pass

Once the utilities are consolidated, implement schema v2 compatibility in a disciplined way.

Add `objective` while still emitting `activeQuest` for compatibility, then add `gitContext`, `agentActivity`, and `config`. The git context should stay calm and compact: branch, ahead/behind, dirty-file count, and last commit subject with relative age. The activity feed should remain heuristic and honest: infer only what the repo can defensibly infer from recent file changes and agent-area ownership, and render a confidence score the same way the rest of the HUD already does. This is already the direction laid out in the schema and PRD, so the work here is mostly “make the drafted contract real.” fileciteturn15file0 fileciteturn14file0

Implementation details:

- `src/engine/git.ts` should own git status reads
- `src/engine/activity.ts` should score changed files against agent-owned areas
- `src/engine/types.ts` and `src/engine/normalize.ts` should emit v2 compat fields
- `src/web/render.ts`, `src/tui/App.tsx`, and the VS Code webview should render the new context in a restrained way, ideally as a small strip or compact list rather than a whole new dashboard region
- `docs/SCHEMA.md` and `docs/design/data.jsx` should be kept in sync as the schema evolves, because the schema doc already says drift here should fail CI. fileciteturn21file0 fileciteturn28file0 fileciteturn36file0 fileciteturn33file0 fileciteturn42file0 fileciteturn15file0 fileciteturn50file0

Another high-value addition in this pass is exact editor-open integration outside VS Code. The recommended default is:

- if `code` is available, use `code -g file:line[:column]`
- otherwise fall back to the current system-open behavior

That is low-friction, cross-surface, and grounded in VS Code’s documented CLI support for `-g`. It also upgrades desktop click-to-open from “open the file somewhere” to “land me on the line that matters.” fileciteturn37file0 citeturn10search0turn10search2

Done means:

- schema output includes v2 fields plus v1 compat shim
- git context renders in all surfaces without changing the product into a dashboard
- agent activity appears in the Agents rail with explicit confidence
- desktop click-to-open can hit an exact line when VS Code CLI is available. fileciteturn15file0 fileciteturn14file0

Current estimate: **0%**

### Safe write-back pass

Write-back should be the last pass, not the first.

The repo’s own design is correct here: off by default, explicitly enabled in config, scoped to checkbox toggles only, line-precise, and visibly on. Implement it in one shared write-back module such as `src/engine/writeback.ts`, and make the UI surfaces use that same code path. Do not let each surface invent its own file-editing behavior. The write path should validate that the targeted line still starts with a markdown checkbox marker and that the task text still matches after trimming; otherwise it should refuse to write and show a warning. fileciteturn15file0 fileciteturn14file0

This pass also needs better test coverage than the repo has today. Add fixtures and tests for:

- stale line mismatch
- CRLF vs LF files
- duplicated task text on different lines
- excluded paths
- archived docs
- invalid `.repolog.json`
- safe reverse-toggle (`[x]` back to `[ ]`) behavior

The point is not just correctness. The point is confidence. If the app is going to edit a user’s human-authored markdown, it needs to be the most conservative part of the whole system. That is especially true in a moment when developers are using AI heavily but are increasingly skeptical of opaque automation. fileciteturn45file0 fileciteturn58file0 citeturn2search1

Done means:

- no write happens unless `writeback: true`
- every write is a one-line checkbox flip and nothing else
- every surface clearly indicates write-back is on
- stale or unsafe matches fail closed with a warning
- the write-back tests are the most adversarial tests in the repo. fileciteturn15file0

Current estimate: **0%**

## Open questions and safe defaults

If no one answers these before implementation starts, the coding agent should proceed with the following defaults.

Assume **source is the truth over stale planning docs**, then update those docs as the first small task. The repo’s own instructions depend on those docs for handoffs, so drift there is not cosmetic. fileciteturn18file0 fileciteturn19file0 fileciteturn16file0 fileciteturn33file0

Assume the default editor integration should target **VS Code CLI** when present, using `code -g`, because that is documented, line-aware, and fits the developer audience of this app. If it is unavailable, fall back to the current shell-open behavior rather than blocking the feature. citeturn10search0turn10search2

Assume prompt precedence should be **built-ins < user prompt dir < repo prompt dir**. That gives developers a good personal default, but still lets the current repo define the most relevant version of a prompt for its own workflow. That matches the logic behind project-specific command files and repo-local instructions in existing agent tools. citeturn2search0turn3search10turn3search6

Assume the first “developer-friendly tools” to ship are **`repolog prompt`**, **`repolog status --short`**, **`repolog doctor`**, and **exact editor-open behavior**. Those four additions are the best tradeoff between utility, safety, and implementation cost. They also make the app more useful to terminal-first developers, which is consistent with the repo’s TUI-first and local-first philosophy. fileciteturn14file0 fileciteturn52file0 citeturn4search0turn3search0turn7search0

Assume **no new runtime dependencies** unless something is genuinely painful to implement with the current stack. The repo instructions explicitly prefer standard approaches, local-only behavior, and passing tests over dependency drift. The current stack is already enough to ship this plan. fileciteturn18file0 fileciteturn52file0

Assume **Electron stays** for this pass. The packaged exe was not available in the synced repo, so this plan is based on the checked-in source, build config, and HTML preview/live artifacts rather than on binary inspection; that is enough for workflow and architecture work, but not a reason to fork into a host rewrite right now. Keep the current Desktop + VS Code + TUI architecture, make it more scriptable, make it more trustworthy, and make it easier to hand off work to agents. fileciteturn51file0 fileciteturn52file0 fileciteturn37file0

The ready-to-paste `PLAN.md` backlog for the coding agent is:

- [ ] Reconcile source-vs-doc drift and centralize shared prompt / recent-change / time / editor-open utilities (agent: codex, touches: src/engine/prompts.ts, src/engine/changes.ts, src/engine/time.ts, src/engine/editor.ts, src/engine/config.ts, src/tui/App.tsx, src/web/render.ts, apps/desktop/main.cjs, extensions/vscode/extension.js)
- [ ] Externalize prompt templates and add `repolog prompt` + `repolog status --short` CLI commands (agent: codex, touches: src/cli/index.ts, src/engine/prompts.ts, src/engine/config.ts, tests/)
- [ ] Add `repolog doctor` and exact line-open integration for desktop workflows (agent: codex, touches: src/engine/doctor.ts, src/engine/editor.ts, apps/desktop/main.cjs, apps/desktop/preload.cjs, extensions/vscode/extension.js, tests/)
- [ ] Ship schema v2 compatibility with `objective`, `gitContext`, and `agentActivity`, then render the minimal git/activity strip in all surfaces (agent: codex, touches: src/engine/types.ts, src/engine/scan.ts, src/engine/normalize.ts, src/web/render.ts, src/tui/App.tsx, extensions/vscode/extension.js, docs/SCHEMA.md, docs/design/data.jsx)
- [ ] Implement opt-in checkbox write-back only after the doctor pass is green (agent: codex, touches: src/engine/writeback.ts, src/engine/config.ts, src/web/render.ts, src/tui/App.tsx, tests/) fileciteturn19file0
