# QuestState Schema

The single JSON shape every surface (CLI, TUI, desktop, VS Code panel) consumes. If your PR changes this shape, bump the version and update `docs/design/data.jsx` to match.

- **v1** — shipped in v0.1. Current on-disk contract.
- **v2** — drafted for v0.2. Renames `activeQuest` → `objective`, adds `gitContext`, `agentActivity`, and `config`. Ships with a compat shim that still emits v1 fields for one version.

## v1 — canonical (current)

```ts
export type AgentId = string; // "claude" | "codex" | "gemini" | custom

export interface Task {
  id: string;             // stable within a scan, e.g. "plan.md#now-1"
  text: string;
  agent?: AgentId;
  doc: string;            // source file, e.g. "PLAN.md"
  line?: number;          // source line number for click-to-open
  est?: "S" | "M" | "L" | "XL";
  confidence: number;     // 0..1
}

export interface BlockedTask extends Task {
  reason: string;
  since: string;
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  file: string;
  role: string;
  area: string;
  objective: string;
  constraints: string[];
  status: "active" | "working" | "idle";
  lastTask?: string;
}

export interface ResumeNote {
  task: string;
  doc: string;
  since: string;
  lastTouched: string;
  thought?: string;
}

export interface FileChange {
  file: string;
  at: string;
  diff?: string;           // "+3 -1" if git available
}

export interface QuestState {
  schemaVersion: 1;
  name: string;
  branch: string;
  lastScan: string;
  scannedFiles: string[];

  mission: string;
  activeQuest: {
    title: string;
    doc: string;
    line?: number;
    progress: { done: number; total: number };
  };

  resumeNote: ResumeNote;
  now: Task[];
  next: Task[];
  blocked: BlockedTask[];
  agents: AgentProfile[];
  recentChanges: FileChange[];
  decisions: Decision[];        // added late in v0.1 — newest first, max 10
}

export interface Decision {
  at: string;                   // "YYYY-MM-DD"
  text: string;
  doc: string;                  // source file
  line?: number;
}
```

## v2 — draft (v0.2)

Additive + one rename. Emit both `activeQuest` and `objective` for one release so consumers can migrate; drop `activeQuest` in v0.3.

```ts
export interface GitContext {
  branch: string;
  ahead: number;
  behind: number;
  dirtyFiles: number;
  lastCommit?: {
    subject: string;
    sha: string;           // short
    at: string;            // relative
  };
}

export interface AgentActivity {
  agent: AgentId;
  file: string;
  at: string;              // relative, e.g. "12m"
  confidence: number;      // mtime × owned-areas match strength, 0..1
}

export interface RepoConfig {
  writeback: boolean;      // default false; loaded from .repolog.json
  prompts?: {
    dir: string;           // default "~/.repolog/prompts"
  };
  watch: {
    debounce: number;      // default 500
    reportFileChanges: boolean; // default true
  };
  schemaVersion: number;   // default 2
}

export interface QuestState {
  schemaVersion: 2;
  name: string;
  branch: string;          // kept for back-compat; mirrors gitContext.branch
  lastScan: string;
  scannedFiles: string[];

  mission: string;
  objective: {             // renamed from activeQuest
    title: string;
    doc: string;
    line?: number;
    progress: { done: number; total: number };
  };
  activeQuest?: QuestState["objective"]; // compat shim, v2-only, dropped in v3

  resumeNote: ResumeNote;
  now: Task[];
  next: Task[];
  blocked: BlockedTask[];
  agents: AgentProfile[];
  recentChanges: FileChange[];
  decisions: Decision[];

  gitContext?: GitContext;
  agentActivity?: AgentActivity[];
  config: RepoConfig;
}
```

## Extraction sources per field

| Field | Source |
|---|---|
| `mission` | First sentence under `## Mission` or first non-heading sentence in `PLAN.md` / `README.md` |
| `objective.title` (v2) / `activeQuest.title` (v1) | First non-empty line under a heading matching `/active\s+quest\|current\s+objective\|objective\|focus/i` in `PLAN.md` |
| `objective.progress` | Count `- [x]` vs `- [ ]` under the Objective section |
| `now` | Unchecked items under headings matching `/current\|now\|in progress\|active/i` |
| `next` | Unchecked items under headings matching `/next\|upcoming\|queue/i` |
| `blocked` | Unchecked items under `/blocked\|waiting/i`, reason = nearest italics or paragraph |
| `agents[]` | One entry per `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, parsed section by section |
| `resumeNote` | Top item in `now`, cross-referenced with most-recent-touched file from watcher |
| `recentChanges` | File watcher events, deduped and sorted desc |
| `decisions` | Bullets under `/recent decisions\|decisions\|decision log/i` in `STATE.md` or any `*_log.md`. Format: `YYYY-MM-DD — text`. Newest first, max 10. |
| `gitContext` (v2) | `git rev-parse` / `git status --porcelain` / `git log -1 --pretty` — all skipped silently if not a repo |
| `agentActivity` (v2) | For each changed file in the last N days, score it against each agent's `area` globs in AGENTS.md / CLAUDE.md / GEMINI.md; keep top-match with confidence |
| `config` (v2) | `.repolog.json` at repo root; missing file = all defaults |

## `.repolog.json` (v2)

```json
{
  "excludes": ["docs/Archived"],
  "writeback": false,
  "prompts": { "dir": "~/.repolog/prompts" },
  "watch": { "debounce": 500, "reportFileChanges": true },
  "schemaVersion": 2
}
```

- Missing file → all defaults.
- `excludes` / `exclude` / `ignore` / `ignored` may contain repo-relative paths or folder names to skip from scanning and watcher-based recent-changes. Folder-name excludes match any path segment; path excludes match that subtree exactly.
- `archive`, `archives`, and `archived` are ignored by default even without a config file so stale planning docs do not pollute the HUD.
- `writeback: true` enables **checkbox toggles only** (see below). Nothing else is ever written.
- `watch.debounce` controls the watcher debounce window in milliseconds; `watch.reportFileChanges` toggles file-change reporting in the HUD.
- Invalid JSON → log a warning and fall back to defaults; never crash the scan.

## Write-back rules (v2, opt-in)

- Off by default. Only active when `.repolog.json` has `"writeback": true`.
- Scope: toggling a rendered checkbox for a `Task` in Now / Next / Blocked rewrites `- [ ]` → `- [x]` (or reverse) at exactly `task.doc` + `task.line`.
- The matched source line must still start with `- [ ]` / `- [x]` and the task text must still match after trimming; otherwise the write is skipped and the UI shows a warning.
- Never edits any other content. No adds, deletes, reorders, heading edits, or free-text changes.
- When on, every surface shows a persistent "write-back ON" banner.

## Structured mode (opt-in, unchanged)

```markdown
---
owner: claude
area: frontend
status: active
---

## Current Objective
Fix chat tab scrolling and font issues

## Tasks
- [ ] audit tab layout
- [ ] patch font sizing
- [ ] verify dark mode
```

When frontmatter is present, it wins over heuristics.

## Versioning

- Breaking changes → bump `schemaVersion`.
- Additive fields → keep the version, document here.
- `docs/design/data.jsx` must stay in sync with the latest schema — CI should fail if it drifts.
- v2 ships with both `objective` and `activeQuest` populated for one release; v3 drops `activeQuest`.
