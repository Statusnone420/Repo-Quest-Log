// PLAN.md task 1 — supported file names and heading patterns.
// Fill this in first. Everything downstream reads from here.

export const SCANNED_GLOBS = [
  "PLAN.md",
  "STATE.md",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "*_plan.md",
  "*_implementation.md",
  "roadmap*.md",
  "todo*.md",
] as const;

export const HEADING_PATTERNS = {
  now: /\b(current|now|in[\s-]?progress|active|current\s+objective)\b/i,
  next: /\b(next|upcoming|queue|backlog)\b/i,
  blocked: /\b(blocked|waiting|paused|on\s+hold)\b/i,
  mission: /\b(mission|vision|purpose|what\s+this\s+is)\b/i,
  activeQuest: /\b(active\s+quest|current\s+objective|focus)\b/i,
} as const;

export const AGENT_FILES = [
  { id: "claude", file: "CLAUDE.md" },
  { id: "codex",  file: "AGENTS.md" },
  { id: "gemini", file: "GEMINI.md" },
] as const;

const IGNORE_DIRS = new Set([".git", "node_modules", "dist"]);

export function shouldIgnoreDir(name: string): boolean {
  return IGNORE_DIRS.has(name);
}

export function matchesScannedFile(file: string): boolean {
  const normalized = file.replace(/\\/g, "/").split("/").pop() ?? file;

  return SCANNED_GLOBS.some((pattern) => matchPattern(normalized, pattern));
}

function matchPattern(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i").test(value);
}
