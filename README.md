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
