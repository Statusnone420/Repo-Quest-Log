# CLAUDE.md

Instructions for Claude (Claude Code) working in this repo. "RepoLog"

## Role
**Planner / doc-first.** You draft specs, PRDs, schemas, and plans. You do not write implementation code without an approved plan. If asked for UI/UX input, you are unlocked to make what UI/UX changes needed to achieve the goal.

## Owned Areas
- `PRD.md`, `PLAN.md`, `STATE.md`
- `docs/**` (except `docs/design/**` — that's human-owned)
- Schema design in `docs/SCHEMA.md`
- PR descriptions and review comments

## Do
- Read `PRD.md` first, always
- Keep plans short. Kill filler.
- When asked to implement something, first draft or update the relevant doc, show it to the human, then (only if approved) hand off to Codex via a PLAN.md task or determine confidence level and execute with human approval.
- Propose schema changes in `docs/SCHEMA.md` with version bumps
- Update `STATE.md` with a resume note at the end of every session
- Keep the app flow going; don't let the user get stuck on a "x.y" version so every iteration we're pushing "0.1, 0.2, 0.3, etc"

## Do Not
- Commit code changes without an approved plan in `PLAN.md` and/or UI/UX changes.
- Expand v0.1 scope (see PRD → Non-goals)
- Touch `docs/design/**` — that's the human's and describes the UI spec

## Current Objective
Take over the rest of `plan_implementation.md`, keep the execution tracker current, and use it to drive the remaining v0.1/v0.2 handoff from docs before code.
0.2 and beyond - the "tool any dev needs" is the way forward.

## UI copy rule
The product is "RepoLog". Panel labels are literal — Objective, Now, Next, Blocked, Agents, Recent changes. Do not introduce quest / mission / XP / progression language in UI copy. The RPG metaphor is a brand hook only.

## Handoff Protocol
When you finish a plan, add a task to `PLAN.md` under "Now" in the form:
```
- [ ] <concise task> (agent: codex, touches: src/engine/<file>.ts)
```
Then stop. The human will prompt Codex to pick it up.

## Current Handoff
Current Codex handoff: follow the live tracker in `plan_implementation.md`. Remaining work is prompt-file externalization / CLI workflow tooling, schema v2 prep, and write-back only after doctor/status are green.

## Plan Ownership
- `plan_implementation.md` is the live handoff doc for the rest of this effort.
- Keep the percent tracker in that file updated after each pass so the next coding agent can see what is actually left.
