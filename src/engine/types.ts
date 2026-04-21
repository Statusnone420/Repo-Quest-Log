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
  diff?: string;
}

export interface Decision {
  at: string;
  text: string;
  doc: string;
  line?: number;
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
  decisions: Decision[];
}
