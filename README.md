# Repo Quest Log

A local-first CLI + TUI + desktop + VS Code shell that makes repo intent legible at a glance — and hands that intent to whichever coding agent you open next.

It reads your planning markdown (`PLAN.md`, `STATE.md`, `AGENTS.md`, etc.) and builds a live structured HUD of what's happening now, what's next, and what's blocked. No server or account required; the optional on-demand Digest uses a user-supplied OpenRouter key and is off by default.

---

## Install

### Desktop app (Windows)
Download the latest installer from [GitHub Releases](https://github.com/Statusnone420/Repo-Quest-Log/releases):
- **`Repo Quest Log Setup <version>.exe`** — recommended, installs like any app
- **`Repo Quest Log <version>.exe`** — portable, run anywhere

> First launch may trigger Windows SmartScreen. That's expected for a new binary with low reputation — check the publisher name and file name before allowing.

### VS Code extension
```bash
code --install-extension repo-quest-log-0.0.4.vsix
```
Download the `.vsix` from the same release page, then run the command above.

### CLI (from source)
```bash
git clone https://github.com/Statusnone420/Repo-Quest-Log.git
cd Repo-Quest-Log
npm install
npm run build
npm link   # makes `repolog` available globally
```

---

## Surfaces

| Surface | Command |
|---|---|
| CLI scan (JSON) | `repolog scan .` |
| Live terminal HUD | `repolog watch .` |
| Desktop app (dev) | `npm run desktop:app` |
| Desktop app (build) | `npm run desktop:build` |
| VS Code extension (dev) | Open `extensions/vscode/` as extension-development folder |
| VS Code extension (package) | `npm run pack:vscode` |

---

## CLI Reference

```
repolog scan [path]               Parse repo and output QuestState as JSON
repolog watch [path]              Live terminal HUD (TUI), refreshes on file change
repolog status --short            One-line summary for shell status-line integrations
repolog doctor [path] [--json]    Diagnose missing headings, malformed config, empty buckets
repolog tuneup [path]             Score repo legibility (0-100), generate fix prompt for agents
  --write-charter                 Write .repolog/CHARTER.md
  --copy                          Copy prompt to clipboard
  --agent=claude|codex|gemini     Output agent-specific prompt
repolog prompt list               List available prompt presets
repolog prompt <id> [--copy]      Render a prompt preset (copy to clipboard with --copy)
repolog standup [--copy] [--json] Today's done + active tasks as markdown
```

---

## Keyboard Shortcuts (Desktop + TUI)

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Prompt palette — 6 presets, copy to clipboard |
| `Ctrl+Shift+C` | Standup export — today's tasks as markdown, copied |
| `Ctrl+O` | Open repo folder picker (desktop) |
| `Ctrl+R` | Force refresh |
| `t` | Tuneup overlay — score bar + gap list (TUI) |
| `q` / `Esc` | Close overlay |

---

## Prompt Templates

Built-in presets are always available. Override per-user or per-repo:

- **User:** `~/.repolog/prompts/*.md`
- **Repo:** `.repolog/prompts/*.md` (wins over user)

Frontmatter fields: `id`, `label`, `sub`, `glyph`, `keywords`

Available template variables:
```
{{name}}  {{branch}}  {{mission}}  {{objective.title}}
{{objective.done}}  {{objective.total}}  {{resume.task}}
{{now}}  {{next}}  {{blocked}}  {{agents}}
```

---

## Repo Setup

RepoLog reads standard markdown files it finds in the repo root. No config required to get started.

| File | What it feeds |
|---|---|
| `PLAN.md` | Objective, Now / Next / Blocked task lists |
| `STATE.md` | Current focus, resume note, recent decisions |
| `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` | Agent roles, owned areas, activity feed |
| `.repolog.json` | Optional: `writeback`, `prompts.dir`, `excludes` |
| `.repolog/CHARTER.md` | Agent onboarding doc (generate with `repolog tuneup --write-charter`) |

Heading patterns that the scanner recognises: `## Objective`, `## Now`, `## Next`, `## Blocked`, `## Mission`, `## Owned Areas`, `## Resume Note`. See [`docs/SCHEMA.md`](docs/SCHEMA.md) for the full spec.

---

## Repository layout

The root is kept for runtime entry points, package metadata, current planning state, and agent-discovery files. Longer product notes, implementation plans, screenshots, archived handoffs, and design references live under [`docs/`](docs/README.md).

Agent instruction files (`AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`) intentionally remain in the root so coding-agent tools can find them.

---

## AI-assisted workflow

This project uses documented AI-assisted development workflows. Files such as `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` define repo conventions, verification steps, and agent responsibilities. They are part of the development process, not runtime requirements.

---

## "Tune this repo" — Score and Fix

```bash
repolog tuneup
```

Scores your repo's markdown legibility from 0–100 across 8 checks (mission, objective, now-heading, agent owned areas, state resume note, plan next section, charter present, frontmatter). Outputs a targeted fix prompt you can paste directly into Claude, Codex, or Gemini.

```bash
repolog tuneup --write-charter   # generates .repolog/CHARTER.md
repolog tuneup --agent=claude    # Claude-specific prompt
```

The score also appears in the desktop Settings panel with a live coverage meter and one-click copy.

---

## Desktop: Open Any Repo

Press **Ctrl+O** (or File → Open Repo…) to point the app at any folder. The choice persists between sessions. You can also create a desktop shortcut to `Repo Quest Log.exe` and drag a folder onto it to open that repo directly.

---

## Building from Source

```bash
npm install
npm run build      # TypeScript compile
npm run lint       # type-check
npm test           # Vitest suite
npm run desktop:build   # Electron installer → release/
npm run pack:vscode     # VS Code .vsix → release/
```

---

## Contributing

Forks, pull requests, and alternate product directions are welcome. Please keep the copyright notice in the LICENSE.

---

## License

[MIT](LICENSE) — © 2026 Statusnone420
