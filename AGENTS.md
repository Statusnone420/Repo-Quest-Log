# AGENTS.md

Instructions for any coding agent working in this repo (Codex, generic agents, CI bots). Product name: RepoLog.

## Role
**Backend implementer and coding agent.** You write TypeScript per `PLAN.md`. You do not redesign. You do not expand scope.

## Owned Areas
- `src/engine/**` — parser, normalizer, ranker, watcher
- `src/cli/**` — CLI entry, argv parsing, JSON output
- `src/web/**` — shared HTML/CSS renderer for desktop + VS Code shells
- `apps/desktop/**` — Windows desktop host
- `extensions/vscode/**` — VS Code extension shell
- `tests/**` — vitest suites, fixture repos

## Do
- Read `docs/product/PRD.md`, `PLAN.md`, `docs/SCHEMA.md`, and `STATE.md` before starting any task
- Work through `PLAN.md` → "The 7 build tasks" in order
- Keep the design mockup (`docs/design/Repo Quest Log.html`) as the source of truth for visual output
- Write tests against the fixture repos under `tests/fixtures/` before marking a task done
- Update `STATE.md` when you finish a task. Keep all relevant md's updated when finishing tasks.
- Run `npm run lint && npm test` before committing
- Treat root-level agent docs as active tool instructions. Retired tool docs belong in `docs/Archived/agent-docs/` as reference-only material.

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

Ship the v0.5 daily-use desktop rescue: same RepoLog shell for every repo, inline setup help for sparse/messy repos, archived reference handling for retired agent docs, observable Workspace Signals, corrected Agent Docs, prompt resume flow, and README/product proof that makes the value obvious in 30 seconds.

## Current Task

v0.5 HUD consistency pass verified: desktop keeps the normal RepoLog shell for every non-empty repo, degrades sparse markdown state inline, shows detected repo context as useful fallback data, archives retired Claude/Gemini root docs under `docs/Archived/agent-docs/`, moves the desktop HUD closer to the accepted mockup structure, bumps release metadata to 0.5.0, and passes `npm run build`, `npm run lint`, and `npm test` (104 tests / 22 files). Browser/app visual QA was intentionally skipped per human direction.

---

## Agent Execution Protocol — v0.5 Release Handoff

**Read this section before touching release files.**

### Core rule
Audit the actual code first. Never assume docs equal implementation. Read the file, report what is real, then fix. Before handoff, run `npm run build`, `npm run lint`, and `npm test`. Anything failing means the pass is not ready.

### v0.5 handoff checks
1. Desktop renderer keeps the normal RepoLog shell for non-empty generic, messy, and source-only repos.
2. Sparse repos get inline Repo Context setup help, not a full-screen onboarding takeover.
3. Retired Claude/Gemini guidance stays under `docs/Archived/agent-docs/` unless the human explicitly reactivates those tools.
4. Root setup guidance defaults to `PLAN.md`, `STATE.md`, and `AGENTS.md`; `CLAUDE.md` and `GEMINI.md` are optional active-tool docs.
5. Archived/reference agent statuses do not define active workspace scope.
6. Version metadata and `CHANGELOG.md` stay aligned with `package.json`.
7. Browser/app visual QA is optional only when the human explicitly asks not to run it; otherwise compare the renderer against the accepted mockup.

### After verification
1. Update `STATE.md` Resume Note with what changed and final verification count.
2. Update `AGENTS.md` Current Task with the verified state.
3. Do NOT commit. Stop and report to the human.

---

## Last Task
Product trust pass completed and covered by tests. Repo-local runtime writes found: `.repolog/desktop-live.html`, `.repolog/digest.json`, `.repolog/CHARTER.md`, `.repolog.json`, first-run state, window bounds, last-root, and OpenRouter config. Runtime writes moved to userData/cache; `.repolog/CHARTER.md`, `.repolog.json`, PLAN.md, STATE.md, and AGENTS.md remain explicit user-triggered writes.
