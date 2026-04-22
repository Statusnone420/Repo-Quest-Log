# CLAUDE.md

Instructions for Claude (Claude Code) working in this repo. "RepoLog"

## Role
**Planner + implementer (unlocked).** You draft specs, PRDs, schemas, and plans AND you write implementation code. Keep scope tight, and verify with `npm run build && npm run lint && npm test` before declaring a pass done. UI/UX changes are in scope when they serve the active plan.

## Owned Areas
- `PRD.md`, `PLAN.md`, `STATE.md`
- `docs/**` (except `docs/design/**` — that's human-owned)
- Schema design in `docs/SCHEMA.md`
- `src/**`, `apps/**`, `extensions/**`, `tests/**`
- PR descriptions and review comments
- `STATE.md` `CLAUDE.md` - these are for you, update them after each task you complete. Keep them updated and current.

## Do
- Read `PRD.md`, `PLAN.md`, `STATE.md`, `docs/SCHEMA.md`, and `plan_implementation.md` before starting any task
- Treat `plan_implementation.md` as the live source of truth for remaining work; update percentages after each completed pass
- Work top-down through the execution tracker
- Keep plans short. Kill filler.
- Propose schema changes in `docs/SCHEMA.md` with version bumps
- Update `STATE.md` with a resume note at the end of every session
- Keep the app flow going; ship incremental v0.x releases
- Prefer shared engine modules and minimal churn
- Run build/lint/tests before finishing a pass

## Do Not
- **NEVER commit or push to git.** The human is the only one who commits. Git is how they audit and revert AI work. Finish your work, verify build/lint/tests, then stop — the human will commit.
- Expand scope beyond the active pass in `plan_implementation.md` (unless the user asks you to)
- Touch `docs/design/**` — that's the human's and describes the UI spec
- Add new runtime dependencies without a note
- Redesign landed work unless source disagrees with docs

## Current Objective
Drive `plan_implementation.md` to 100% in order: Foundation → Workflow tooling → Context enrichment (schema v2) → Safe write-back. "Tool any dev needs" is the north star for v0.2+.

## UI copy rule
The product is "RepoLog". Panel labels are literal — Objective, Now, Next, Blocked, Agents, Recent changes. Do not introduce quest / mission / XP / progression language in UI copy. The RPG metaphor is a brand hook only.

## Output discipline
- Keep updates short. State what changed, what was verified, what remains.
- Don't spend tokens on speculation.
- Stop and report if blocked; keep the blocker narrowly defined.

## Plan Ownership
- `plan_implementation.md` is the live handoff doc for the rest of this effort.
- Keep the percent tracker in that file updated after each pass.
