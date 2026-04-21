# PRD — Repo Quest Log

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

> The app should always answer: "What am I doing right now, and why?" — and hand that answer to whichever agent you're about to open.

Not analytics. Not orchestration. Not another agent. A **calm memory layer** around the ones you already use, with first-class "copy this into your agent" ergonomics.

## Who it's for

- Solo developers who use 1+ coding agents daily (primary)
- ADHD / distractible developers specifically (primary)
- Seasoned devs running multi-agent workflows who want a legibility layer (co-primary, v0.2)
- Teams with multi-agent workflows (later)

## Product name vs panel language

The product is "Repo Quest Log". Panels use literal labels — **Objective**, **Now**, **Next**, **Blocked**, **Agents**, **Recent changes**. Avoid "quest / mission / XP / progression" in UI copy; the RPG metaphor is a brand hook, not a surface.

---

## v0.1 — shipped / closing out

**Do:**
- Scan repo for a fixed list of markdown files
- Extract: mission, objective, now / next / blocked tasks, agent profiles, resume note
- Render the HUD in a terminal (TUI), a Windows desktop shell, and a VS Code side panel — all over one shared `QuestState` contract and one renderer
- Refresh on file change
- Local-first, zero network calls, zero inference by default

**Done:** core engine, CLI, TUI, shared HTML renderer, Electron desktop host, VS Code extension, Windows packaging to `release-fresh/`, click-to-open, copy-context affordances, density controls.

**v0.1 close-out punch list:**
- Fit-to-window desktop layout (no outer scroll) — responsive density + inner-panel scroll fallback
- TUI visual parity with the desktop HUD (same regions, same palette, same density modes)
- Rename "Active Quest" → "Objective" across UI copy (schema rename deferred to v0.2 / schema v2)
- Fixture coverage for noisy / imperfect repos
- Click-to-open doc links in every remaining surface

## v0.2 — the agent-integration wedge

Everything in v0.2 is about making Repo Quest Log *disappear into the agent workflow*. The thing the user loves most today is the one-click "resume prompt" paste. Lean into that.

**Do:**
1. **Resume-prompt palette (⌘K / Ctrl+K).** Presets that copy a ready-to-paste message to the clipboard:
   - Resume for Claude Code
   - Resume for Codex
   - Resume for Gemini
   - Daily standup (what I did + what's next)
   - Blocker summary (for a human or an agent)
   - Repo intent briefing (for a fresh agent session)
   Each preset is a small, editable template under `~/.repolog/prompts/`.
2. **Live git panel.** Branch, ahead/behind, dirty-file count, last commit subject + relative time. Calm, one row, no dashboard vibes.
3. **Agent activity feed.** Infer "which agent most likely touched which file, when" from file mtimes × `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` owned-areas. Surfaces as a compact feed under the Agents rail.
4. **Standup export.** One keypress → markdown of done-today (newly-checked items since midnight) + currently-active Now items, copied to clipboard.
5. **Opt-in write-back (checkbox toggles only).** Disabled by default. Enabled via `.repolog.json` → `"writeback": true`. When on: checking a Now / Next / Blocked item in TUI or desktop rewrites `- [ ]` → `- [x]` in the source markdown and nothing else. A persistent banner shows "write-back ON" so it is never silent. No free-text edits. No reordering. No adds or deletes.

**Do not (still):**
- Parse source code
- Orchestrate agents
- Call LLMs (still off by default; if introduced in v0.3+, opt-in with user key)
- Multi-repo dashboards
- Team sync, cloud anything
- Timers, pomodoros, streaks, XP, or any gamification

## v0.3+ — after the wedge lands

- `gh` integration: open PRs on current branch + assigned issues, surfaced only if `gh` is installed and authed
- macOS host decision: SwiftUI + WKWebView shell vs native redraw
- `npm` publish: `@repo-quest/core` and `repo-quest-log` binary
- Schema v2 rename (`activeQuest` → `objective`) with a one-version compatibility shim
- Optional LLM "summarize this week" pass, user-supplied key, off by default

---

## Files scanned

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
- **Structured mode** — repos that opt into the RQL frontmatter convention (see `docs/SCHEMA.md`)

## The HUD

Stable regions, stable placement, same order on every surface:

1. **Mission** — one sentence
2. **Objective** — current top outcome + progress (internal schema key remains `activeQuest` until schema v2)
3. **Resume Note** — the ADHD killer feature; feeds the resume-prompt palette
4. **Now** — max 3 items
5. **Next** — max 5 items
6. **Blocked** — waiting-on list with reasons
7. **Agents** — cards from `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` + activity feed (v0.2)
8. **Recent changes** — from file watcher + git diff stats
9. **Git** — branch / ahead-behind / dirty / last commit (v0.2)

## Success criteria

- v0.1: `repolog scan .` on this repo produces useful JSON; `repolog watch` used daily for a week without annoyance; a non-author gets correct output in <60s.
- v0.2: the resume-prompt palette is the way the user starts every agent session; desktop shell never shows an outer scrollbar on a 1080p+ monitor; at least three prompt presets are customized per user within a week.

## Non-goals

- Beautiful onboarding (still)
- Marketing site
- Settings UI beyond `.repolog.json`
- Themes (single calm palette for v0.2; theme hook only if it falls out cheap)
- Plugin marketplace
- Timers, pomodoros, streaks, XP, any gamification
- Free-text write-back to markdown (only checkbox toggles, opt-in)

## Business model (post-MVP, not a v0.1/v0.2 concern)

- Core: open-source CLI + TUI + desktop + VS Code extension (free)
- Later: team sync, GitHub issue integration, hosted prompt-template sync as a paid tier

## Risks

- **Heuristic extraction fails on messy repos.** Mitigation: structured mode; v0.1 fixture coverage for noisy repos.
- **Feature creep into agent orchestration.** Mitigation: this PRD. "Legibility, not orchestration" is the line.
- **Write-back silently corrupts a user's markdown.** Mitigation: default off, explicit opt-in flag, checkbox-only, persistent banner, touches only the exact line matched by the task's `doc` + `line`.
- **Resume-prompt palette becomes yet-another-snippet-manager.** Mitigation: ship with 6 good presets, make editing one-file-per-preset, no UI for template management.

## Decision log

- 2026-04-21 — TUI first, desktop later (per feedback; faster to ship, works beside agents immediately)
- 2026-04-21 — TypeScript core (not Rust — faster iteration, community familiarity, Ink for TUI)
- 2026-04-21 — Local-only, zero tokens by default
- 2026-04-21 — Desktop and VS Code shells consume one shared HTML renderer
- 2026-04-21 — Windows desktop host is Electron for v0.1; macOS deferred
- 2026-04-21 — Drop "quest / mission / XP" metaphor from panel labels; keep brand. Panels use literal names.
- 2026-04-21 — Opt-in write-back allowed from v0.2, scoped to checkbox toggles only.
- 2026-04-21 — Timers / gamification permanently out of scope.
- 2026-04-21 — Resume-prompt palette is the v0.2 wedge; everything else in v0.2 serves it or is cut.
