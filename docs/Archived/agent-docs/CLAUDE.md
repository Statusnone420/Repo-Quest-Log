---
owner: claude
name: Claude
status: archived
role: Reference-only historical implementer notes
area: docs
objective: Keep for historical context; Codex is the active implementer for v0.5.
---

# Archived Agent Doc

This file was moved out of the repo root on 2026-06-01. Keep it as historical Claude guidance only. It should not be treated as an active RepoLog agent doc or workspace-scope source.

# CLAUDE.md

Instructions for Claude (Claude Code) working in this repo. Product name: RepoLog.

## Role
**Planner and implementer.** You draft specs, PRDs, schemas, and plans, and you write implementation code. Keep scope tight, and verify with `npm run build && npm run lint && npm test` before declaring a pass done. UI/UX changes are in scope when they serve the active plan.

## Owned Areas
- `docs/product/PRD.md`, `PLAN.md`, `STATE.md`
- `docs/**` (except `docs/design/**` — that's human-owned)
- Schema design in `docs/SCHEMA.md`
- `src/**`, `apps/**`, `extensions/**`, `tests/**`
- PR descriptions and review comments
- `STATE.md` `CLAUDE.md` - these are for you, update them after each task you complete. Keep them updated and current.

## Do
- Read `docs/product/PRD.md`, `PLAN.md`, `STATE.md`, `docs/SCHEMA.md`, and `docs/plans/plan_implementation.md` before starting any task
- Treat `docs/plans/plan_implementation.md` as the live source of truth for remaining work; update percentages after each completed pass
- Work top-down through the execution tracker
- Keep plans short and remove filler.
- Propose schema changes in `docs/SCHEMA.md` with version bumps
- Update `STATE.md` with a resume note at the end of every session
- Keep the app flow going; ship incremental v0.x releases
- Prefer shared engine modules and minimal churn
- Run build/lint/tests before finishing a pass

## Do Not
- **NEVER commit or push to git.** The human is the only one who commits. Git is how they audit and revert AI work. Finish your work, verify build/lint/tests, then stop — the human will commit.
- Expand scope beyond the active pass in `docs/plans/plan_implementation.md` (unless the user asks you to)
- Touch `docs/design/**` — that's the human's and describes the UI spec
- Add new runtime dependencies without a note
- Redesign landed work unless source disagrees with docs

## Objective
Reference only. Claude is not an active agent for the v0.5 HUD consistency pass; keep this file for historical instructions unless the human explicitly deletes it.

## UI copy rule
The product is "RepoLog". Panel labels are literal — Objective, Now, Next, Blocked, Agents, Recent changes. Do not introduce quest / mission / XP / progression language in UI copy. The RPG metaphor is a brand hook only.

## Output discipline
- Keep updates short. State what changed, what was verified, what remains.
- Don't spend tokens on speculation.
- Stop and report if blocked; keep the blocker narrowly defined.

## Plan Ownership
- `docs/plans/plan_implementation.md` is the live handoff doc for the rest of this effort.
- Keep the percent tracker in that file updated after each pass.
