# QuestState Schema v1

The single JSON shape that every surface (CLI, TUI, desktop, VS Code panel) consumes. If your PR changes this shape, bump the version and update `docs/design/data.jsx` to match.

## TypeScript (canonical)

```ts
export type AgentId = string; // "claude" | "codex" | "gemini" | custom

export interface Task {
  id: string;             // stable within a scan, e.g. "plan.md#now-1"
  text: string;
  agent?: AgentId;        // inferred from context, or explicit in frontmatter
  doc: string;            // source file, e.g. "PLAN.md"
  line?: number;          // source line number for click-to-open
  est?: "S" | "M" | "L" | "XL";
  confidence: number;     // 0..1 — how sure the extractor is
}

export interface BlockedTask extends Task {
  reason: string;
  since: string;          // human-readable: "2d", "17m", "just now"
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  file: string;           // "CLAUDE.md" | "AGENTS.md" | "GEMINI.md" | custom
  role: string;
  area: string;
  objective: string;
  constraints: string[];
  status: "active" | "working" | "idle";
  lastTask?: string;
}

export interface ResumeNote {
  task: string;           // the one task
  doc: string;             // source doc
  since: string;           // idle time
  lastTouched: string;     // file path the watcher last saw change
  thought?: string;        // extracted from nearest prose paragraph
}

export interface FileChange {
  file: string;
  at: string;              // relative: "2m", "1h"
  diff?: string;           // "+3 -1" if git available
}

export interface QuestState {
  schemaVersion: 1;
  name: string;            // repo name
  branch: string;          // current git branch
  lastScan: string;        // ISO or "just now"
  scannedFiles: string[];

  mission: string;         // one sentence
  activeQuest: {
    title: string;
    doc: string;
    line?: number;
    progress: { done: number; total: number };
  };

  resumeNote: ResumeNote;
  now: Task[];             // max 3 after ranking
  next: Task[];            // max 5 after ranking
  blocked: BlockedTask[];
  agents: AgentProfile[];
  recentChanges: FileChange[];
}
```

## Extraction sources per field

| Field | Source |
|---|---|
| `mission` | First sentence under `## Mission` or the first non-heading sentence in `PLAN.md` / `README.md` |
| `activeQuest.title` | First non-empty line under `## Active Quest` in `PLAN.md` |
| `activeQuest.progress` | Count `- [x]` vs `- [ ]` under the Active Quest section |
| `now` | Unchecked items under headings matching `/current\|now\|in progress\|active/i` |
| `next` | Unchecked items under headings matching `/next\|upcoming\|queue/i` |
| `blocked` | Unchecked items under `/blocked\|waiting/i` headings, reason = nearest italics or paragraph |
| `agents[]` | One entry per `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, parsed section by section |
| `resumeNote` | Top item in `now`, cross-referenced with most-recent-touched file from watcher |
| `recentChanges` | File watcher events, deduped and sorted desc |

## Structured mode (opt-in)

Repos that want precise control can use frontmatter on agent files:

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

- Breaking changes → bump `schemaVersion`
- Additive fields → keep the version, document in this file
- Design mockup in `docs/design/data.jsx` must stay in sync with the latest schema — CI should fail if it drifts
