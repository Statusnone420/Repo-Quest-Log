# Repo Quest Log

Local-first repo HUD for markdown-driven coding-agent workflows.

## Current Surfaces

- CLI JSON scan: `repolog scan .`
- Terminal HUD: `repolog` or `repolog watch .`
- Desktop snapshot: `repolog desktop .`
- Desktop dev shell: `npm run desktop:app`
- Packaged Windows app: `release\win-unpacked\Repo Quest Log.exe`
- Windows package build: `npm run desktop:build`
- VS Code extension shell: open `extensions/vscode/` as an extension-development folder and run the extension host

## Notes

- All surfaces consume the same `QuestState` schema from `docs/SCHEMA.md`.
- The desktop app and VS Code panel share the renderer in `src/web/render.ts`.
- `.repolog.json` supports repo-local excludes; archive / archived / archives are ignored by default.
- The design source of truth remains `docs/design/Repo Quest Log.html`.
- You can point the CLI or packaged desktop app at another repo by passing the repo path as the first non-flag argument. For example: `repolog scan C:\path\to\repo`, `repolog watch C:\path\to\repo`, `repolog desktop C:\path\to\repo`, or `release\win-unpacked\Repo Quest Log.exe C:\path\to\repo`.
- In the packaged desktop app, press **Ctrl+O** (File → Open Repo…) to switch to a different repo folder. The choice is remembered between sessions via Electron `userData\last-root.txt`. Tip on Windows: create a shortcut to `Repo Quest Log.exe` and drop it on your desktop — dragging a folder onto the shortcut will open that folder as the target repo.
- New CLI helpers: `repolog status --short` (one-line summary for status-line integrations), `repolog prompt list`, `repolog prompt <id>` (render), `repolog prompt <id> --copy` (copy to clipboard), `repolog doctor [--json]` (explains scanned files, missing docs/headings, malformed config, and how to fix a messy repo — exits 1 on warnings so CI can gate on it). Prompt templates live in built-ins, and can be overridden per-user at `~/.repolog/prompts/*.md` or per-repo at `.repolog/prompts/*.md` (repo wins). Frontmatter fields: `id`, `label`, `sub`, `glyph`, `keywords`. Body supports `{{name}}`, `{{branch}}`, `{{mission}}`, `{{objective.title}}`, `{{objective.done}}`, `{{objective.total}}`, `{{resume.task}}`, `{{now}}`, `{{next}}`, `{{blocked}}`, `{{agents}}`.
