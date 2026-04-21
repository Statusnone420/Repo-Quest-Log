// Sample repo state — the meta case: we're using Repo Quest Log to build Repo Quest Log itself.
// This is what the tool would extract from markdown files in the repo.

const repoState = {
  name: "repo-quest-log",
  branch: "feat/tui-hud",
  lastScan: "just now",
  scannedFiles: [
    "PLAN.md",
    "STATE.md",
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "docs/tui_implementation.md",
    "docs/roadmap.md",
  ],

  mission:
    "Make repo intent legible at a glance for distractible humans working with coding agents.",

  activeQuest: {
    title: "Ship v0.1 — local CLI + TUI HUD",
    doc: "PLAN.md",
    line: 42,
    progress: { done: 4, total: 11 },
  },

  resumeNote: {
    task: "Wire chokidar file-watcher into the normalizer",
    doc: "docs/tui_implementation.md",
    since: "17 min ago",
    lastTouched: "src/engine/watcher.ts",
    thought: "Was about to replace polling with a debounced change-stream.",
  },

  now: [
    { id: "n1", text: "Wire file-watcher into normalizer", agent: "codex", doc: "tui_implementation.md", est: "M" },
    { id: "n2", text: "Define QuestState JSON schema v1", agent: "claude", doc: "PLAN.md", est: "S" },
    { id: "n3", text: "Rank tasks into Now / Next / Blocked", agent: "codex", doc: "PLAN.md", est: "L" },
  ],

  next: [
    { id: "x1", text: "Parse markdown with remark + extract checklists", agent: "codex", doc: "PLAN.md" },
    { id: "x2", text: "Build Agents panel from AGENTS.md / CLAUDE.md", agent: "claude", doc: "PLAN.md" },
    { id: "x3", text: "Ink-based terminal renderer, stable placement", agent: "—", doc: "tui_implementation.md" },
    { id: "x4", text: "Session Anchor: one-line resume note", agent: "claude", doc: "PLAN.md" },
    { id: "x5", text: "Heuristic confidence score per extracted quest", agent: "—", doc: "roadmap.md" },
  ],

  blocked: [
    { id: "b1", text: "Desktop shell decision: Tauri vs native", reason: "Waiting on scope review", since: "2d" },
    { id: "b2", text: "Publish npm package @repo-quest/core", reason: "Need npm org + CI secrets", since: "1d" },
  ],

  agents: [
    {
      id: "claude",
      name: "Claude",
      file: "CLAUDE.md",
      role: "Planner / doc-first",
      area: "specs, PRDs, schemas",
      objective: "Draft QuestState v1 and freeze the extraction grammar",
      constraints: ["no code writes without plan approval", "reads PLAN.md first"],
      status: "active",
      lastTask: "Drafted schema for resume_note",
    },
    {
      id: "codex",
      name: "Codex",
      file: "AGENTS.md",
      role: "Implementer",
      area: "src/engine/*, CLI entry",
      objective: "Land the file-watcher and normalizer",
      constraints: ["local-only writes", "must pass vitest suite"],
      status: "working",
      lastTask: "Patched chokidar debounce timing",
    },
    {
      id: "gemini",
      name: "Gemini",
      file: "GEMINI.md",
      role: "Reviewer",
      area: "tests, type-safety",
      objective: "Audit normalizer output against fixtures",
      constraints: ["read-only", "comments in PR only"],
      status: "idle",
      lastTask: "Reviewed PR #12",
    },
  ],

  recentChanges: [
    { file: "PLAN.md", at: "2m", diff: "+3 −1" },
    { file: "docs/tui_implementation.md", at: "14m", diff: "+22 −4" },
    { file: "STATE.md", at: "1h", diff: "+1 −1" },
    { file: "AGENTS.md", at: "3h", diff: "+8 −0" },
  ],
};

window.repoState = repoState;
