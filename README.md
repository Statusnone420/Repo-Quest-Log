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
- That makes the current exe suitable for read-only cross-repo testing now; the next remaining step is the workflow tooling in `plan_implementation.md`.
