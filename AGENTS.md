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
Keep the CLI, desktop app, and VS Code extension on one shared `QuestState` and one design-faithful renderer while landing the v0.4 first-run/config/write-back pass.

## Last Task
Desktop shell hardening landed: packaged rebuild works, click-to-open works in desktop, archive/exclude filtering is live, and the current push is v0.4 init/config/write-back scaffolding plus root-doc sync.
