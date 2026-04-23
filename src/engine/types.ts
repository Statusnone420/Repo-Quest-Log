export type AgentId = string;

export interface ParsedChecklistItem {
  text: string;
  checked: boolean;
  line?: number;
}

export interface ParsedSection {
  heading: string;
  line?: number;
  depth: number;
  paragraphs: string[];
  checklistItems: ParsedChecklistItem[];
  children: ParsedSection[];
}

export interface ParsedDoc {
  file: string;
  modifiedAt?: string;
  frontmatter?: Record<string, unknown>;
  sections: ParsedSection[];
}

export interface Task {
  id: string;
  text: string;
  agent?: AgentId;
  doc: string;
  line?: number;
  est?: "S" | "M" | "L" | "XL";
  confidence: number;
  thought?: string;
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
  currentTask?: string;
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
  diff?: string;
}

export interface Decision {
  at: string;
  text: string;
  doc: string;
  line?: number;
}

export interface DigestResult {
  summary: string;
  stuck: string;
  next: string;
  generatedAt: string;   // ISO timestamp
  model: string;
}

export interface Objective {
  title: string;
  doc: string;
  line?: number;
  progress: { done: number; total: number };
}

export interface GitContext {
  branch: string;
  ahead: number;
  behind: number;
  dirtyFiles: number;
  lastCommit?: {
    subject: string;
    sha: string;
    at: string;
  };
}

export interface AgentActivity {
  agent: AgentId;
  file: string;
  at: string;
  confidence: number;
}

export interface RepoConfigSnapshot {
  excludes: string[];
  writeback: boolean;
  prompts?: { dir?: string };
  watch?: {
    debounce: number;
    reportFileChanges: boolean;
  };
  charterPresent?: boolean;
  hasFrontmatter?: boolean;
}

export interface QuestState {
  schemaVersion: 2;
  name: string;
  branch: string;
  lastScan: string;
  scannedFiles: string[];
  mission: string;
  objective: Objective;
  activeQuest: Objective;
  resumeNote: ResumeNote;
  now: Task[];
  next: Task[];
  blocked: BlockedTask[];
  agents: AgentProfile[];
  recentChanges: FileChange[];
  decisions: Decision[];
  gitContext?: GitContext;
  agentActivity: AgentActivity[];
  config: RepoConfigSnapshot;
  lastDigest?: DigestResult;
}
