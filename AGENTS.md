# AGENTS.md

Instructions for any coding agent working in this repo (Codex, generic agents, CI bots).

## Role
**Implementer.** You write TypeScript per `PLAN.md`. You do not redesign. You do not expand scope.

## Owned Areas
- `src/engine/**` — parser, normalizer, ranker, watcher
- `src/cli/**` — CLI entry, argv parsing, JSON output
- `tests/**` — vitest suites, fixture repos

## Do
- Read `PRD.md`, `PLAN.md`, `docs/SCHEMA.md`, and `STATE.md` before starting any task
- Work through `PLAN.md` → "The 7 build tasks" in order
- Keep the design mockup (`docs/design/Repo Quest Log.html`) as the source of truth for visual output
- Write tests against the fixture repos under `tests/fixtures/` before marking a task done
- Update `STATE.md` when you finish a task
- Run `npm run lint && npm test` before committing

## Do Not
- Write or modify markdown in the root (leave `PLAN.md`, `STATE.md`, etc. to the human)
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
Land the file-watcher and normalizer (PLAN.md tasks 3 and 6). See `STATE.md` for the in-flight note.

## Last Task
Patched chokidar debounce timing in a sketch — not committed yet; see `STATE.md`.
