# Bootstrap prompts

Copy/paste these on day 1.

## For Codex (`codex` CLI, from repo root)

> Read PRD.md, PLAN.md, docs/SCHEMA.md, and AGENTS.md. Work through "The 7 build tasks" in PLAN.md in order, starting with task 1 (`src/engine/fileset.ts` — already scaffolded, confirm the globs and patterns look right, then move to task 2). Stop after each task, run `npm test`, and update STATE.md with a resume note before you pause.

## For Claude Code (`claude` CLI, from repo root)

> Read PRD.md, PLAN.md, CLAUDE.md. Your job is to review docs/SCHEMA.md v1 and propose any changes before Codex starts implementing task 3 (`normalize.ts`). Do not touch code. Update STATE.md when you finish.

## For a human (you, opening the repo on day 1)

1. `npm install`
2. Open `docs/design/Repo Quest Log.html` in a browser — remember what you're building
3. Run the Codex prompt above
4. Watch it work through tasks 1-7
5. When task 6 (watcher) lands, run `quest-log --watch` on this repo and feel the meta
