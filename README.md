# Repo Quest Log

Local-first repo HUD for markdown-driven coding-agent workflows.

## Current Surfaces

- CLI JSON scan: `repolog scan .`
- Terminal HUD: `repolog` or `repolog watch .`
- Desktop snapshot: `repolog desktop .`
- Windows desktop app: `npm run desktop:app -- .`
- One-click desktop launcher: `Launch Repo Quest Log.cmd`
- VS Code extension shell: open `extensions/vscode/` as an extension-development folder and run the extension host

## Notes

- All surfaces consume the same `QuestState` schema from `docs/SCHEMA.md`.
- The desktop app and VS Code panel share the renderer in `src/web/render.ts`.
- The design source of truth remains `docs/design/Repo Quest Log.html`.
