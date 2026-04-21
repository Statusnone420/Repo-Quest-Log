# PRD — Repo Quest Log v0.1

## The problem

When you work on a repo with AI coding agents, context evaporates. You open the repo the next morning and forget:

- What the repo is actually trying to become
- What task you were on
- Why that task was the current one
- Which agent is doing what
- What's blocked and on whom

This is worse for ADHD users: working-memory load is high, organizational structure matters more, and unstructured tools make the problem worse.

Existing agents (Claude Code, Codex, Gemini) solve the *execution* layer. Nobody owns the *legibility* layer.

## The wedge

> The app should always answer: "What am I doing right now, and why?"

Not analytics. Not orchestration. Not another agent. A **calm memory layer** around the ones you already use.

## Who it's for

- Solo developers who use 1+ coding agents daily
- ADHD / distractible developers specifically (primary)
- Teams with multi-agent workflows (later)

## v0.1 scope — brutally narrow

**Do:**
- Scan repo for a fixed list of markdown files
- Extract: mission, active quest, now / next / blocked tasks, agent profiles, resume note
- Render the HUD in a terminal (TUI)
- Refresh on file change
- Local-first, zero network calls, zero inference by default

**Do not:**
- Parse source code
- Write back to files
- Orchestrate agents
- Call LLMs (optional in a later version, user brings key, off by default)
- Multi-repo dashboards
- Team sync
- Cloud anything

## Files scanned (v0.1)

- `PLAN.md`, `STATE.md`, `README.md`
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- `*_plan.md`, `*_implementation.md`, `roadmap*.md`, `todo*.md`

## Extraction rules (heuristic-first, zero tokens)

Priority stack for "what's current":
1. Unchecked checklist items under headings containing "Current", "Now", "In Progress", "Active"
2. Sections in `STATE.md` or `PLAN.md` marked active
3. Explicit agent sections in `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
4. Most-recently-modified relevant markdown file
5. Branch name / recent git diff (as enhancer, not primary)

Two extraction modes:
- **Heuristic mode** — messy repos, best-effort
- **Structured mode** — repos that opt into the RQL frontmatter convention (see `SCHEMA.md`)

## The HUD (see `docs/design/Repo Quest Log.html`)

Seven regions, stable placement:

1. **Mission** — one sentence
2. **Active Quest** — current top outcome + progress
3. **Session Anchor / Resume Note** — the ADHD killer feature
4. **Now** — max 3 items
5. **Next** — max 5 items
6. **Blocked** — waiting-on list with reasons
7. **Agents** — cards from `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
8. **Recent changes** — from file watcher

## Success criteria for v0.1

- `quest-log scan .` on this repo produces useful JSON
- `quest-log --watch` in a terminal pane beside Codex is something I use daily for a week without it getting annoying
- A non-author can run it on their own repo and get correct output in <60s

## Non-goals

- Beautiful onboarding
- Marketing site
- Settings UI
- Themes
- Plugin marketplace

## Business model (post-MVP, not a v0.1 concern)

- Core: open-source CLI + TUI (free)
- Later: polished desktop HUD, team sync, GitHub issue integration as paid tier

## Risks

- **Heuristic extraction fails on messy repos.** Mitigation: ship structured mode as escape hatch.
- **Feature creep into agent orchestration.** Mitigation: this PRD. If it's not in v0.1 scope, it's a v0.2 conversation.
- **Yet-another-productivity-tool fatigue.** Mitigation: zero onboarding. Works on repos that already have the files. No setup required.

## Decision log

- 2026-04-21 — TUI first, desktop later (per feedback; faster to ship, works beside agents immediately)
- 2026-04-21 — TypeScript core (not Rust — faster iteration, community familiarity, Ink for TUI)
- 2026-04-21 — Local-only, zero tokens by default
