# Product

## Register

product

## Users

RepoLog is for solo developers and small-team engineers who use AI coding agents inside real local repositories. They open a repo after hours, days, or weeks away and need to recover the active objective, current task, recent activity, blockers, and paste-ready agent context without reconstructing the work from memory.

Primary users are technical, impatient, and already comfortable with markdown planning files, terminals, desktop shells, VS Code, and agent tools such as Claude Code, Codex, and Gemini. They value clear operational truth over ceremony.

## Product Purpose

RepoLog is a local-first, markdown-first repo memory layer. It scans planning documents such as `PLAN.md`, `STATE.md`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`, then turns them into a calm HUD that answers: "I opened this repo, what was I doing?"

The product succeeds when a user can open a real repo and understand the objective, current focus, why the task matters, what changed recently, what to paste into an agent, and whether the repo context is clean enough for agent work. RepoLog must remain useful without cloud sync, team backends, runtime code parsing, or paid AI features.

## Brand Personality

Calm, exact, practical.

RepoLog should feel like a trusted local instrument panel for coding work: dense enough to be useful, quiet enough to keep open daily, and direct enough to expose messy context instead of hiding it. The RPG language is brand flavor, not operational UI copy.

## Anti-references

RepoLog must not become a gamified productivity app. No XP, streaks, timers, pomodoros, mascots, creature moods, "panicking" copy, motivational nudges, or animated emotional states.

RepoLog must not claim agent liveness unless backed by a real integration. Observable workspace activity is acceptable; fake labels such as "Codex idle" are not.

RepoLog must not become cloud sync, team coordination, agent orchestration, or a separate agent-monitor product. It must not ship marketing fluff that overpromises beyond the actual local app.

Visually, avoid decorative dashboard drama, nested card bloat, sci-fi excess, one-note dark-blue palettes, and settings screens that require users to hunt for basic actions.

## Design Principles

1. Answer the resume question first. The first viewport should tell the user what they were doing, why it matters, what changed, and what to do next.
2. Observable signals beat inferred identity. Show edit rate, files touched, recent activity, scope drift, and thrash only when they come from real local events.
3. Markdown remains the source of truth. The UI should clarify and repair planning docs, not replace them with a hidden database.
4. Dense can still be calm. Prefer scan-friendly structure, stable panels, restrained color, and familiar controls over decorative novelty.
5. Optional AI stays optional. OpenRouter digest and generated repair prompts can improve the workflow, but the core product must work without a key.
6. Trust is a feature. Runtime state belongs in app-owned storage, target repos should stay clean unless the user explicitly writes files, and warnings should be specific.

## Accessibility & Inclusion

RepoLog should target WCAG AA contrast for text and controls. It must be keyboard-friendly, readable at common laptop and desktop resolutions, and usable without color-only state indicators.

The HUD should avoid required horizontal scrolling and should keep text inside its containers at common widths. Font size and density controls should support long sessions, reduced eye strain, and different display setups. Motion should be minimal, purposeful, and respectful of reduced-motion preferences.
