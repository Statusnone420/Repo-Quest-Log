import { extractAgentProfiles } from "./agents.js";
import { HEADING_PATTERNS } from "./fileset.js";
import { rankBuckets } from "./rank.js";
import { relativeSince } from "./time.js";
import type {
  AgentActivity,
  AgentId,
  BlockedTask,
  Decision,
  FileChange,
  GitContext,
  Objective,
  ParsedDoc,
  ParsedSection,
  QuestState,
  RepoConfigSnapshot,
  ResumeNote,
  Task,
} from "./types.js";

export interface NormalizeOptions {
  repoRoot?: string;
  repoName?: string;
  branch?: string;
  lastScan?: string;
  lastTouchedFile?: string;
  lastTouchedAt?: string;
  recentChanges?: readonly FileChange[];
  gitContext?: GitContext;
  agentActivity?: readonly AgentActivity[];
  config?: RepoConfigSnapshot;
}

interface ExtractedTask extends Task {
  thought?: string;
}

interface ExtractedBlockedTask extends BlockedTask {
  thought?: string;
}

const DOC_PRIORITY = new Map([
  ["state.md", 0],
  ["plan.md", 1],
  ["readme.md", 2],
]);

export function normalizeQuestState(
  docs: readonly ParsedDoc[],
  options: NormalizeOptions = {},
): QuestState {
  const sortedDocs = [...docs].sort((left, right) => compareDocs(left.file, right.file));
  const scannedFiles = dedupeStrings(sortedDocs.map((doc) => doc.file));

  const mission = extractMission(sortedDocs);
  const activeQuest = extractActiveQuest(sortedDocs);
  const now = collectTasks(sortedDocs, HEADING_PATTERNS.now, "now", 3);
  const next = collectTasks(sortedDocs, HEADING_PATTERNS.next, "next", 5);
  const blocked = collectBlockedTasks(sortedDocs, HEADING_PATTERNS.blocked);
  const ranked = rankBuckets({ now, next, blocked }, { docOrder: scannedFiles });
  const agents = extractAgentProfiles(sortedDocs);
  const recentChanges = dedupeRecentChanges(options.recentChanges ?? []);
  const decisions = extractDecisions(sortedDocs);
  const topTask = ranked.now[0] ?? ranked.next[0] ?? ranked.blocked[0];

  const branch = options.gitContext?.branch ?? options.branch ?? "main";

  return {
    schemaVersion: 2,
    name: options.repoName ?? inferRepoName(options.repoRoot, scannedFiles),
    branch,
    lastScan: options.lastScan ?? "just now",
    scannedFiles,
    mission,
    objective: activeQuest,
    activeQuest,
    resumeNote: buildResumeNote({
      activeQuest,
      recentChanges,
      topTask,
      lastTouchedFile: options.lastTouchedFile,
      lastTouchedAt: options.lastTouchedAt,
      docs: sortedDocs,
    }),
    now: ranked.now,
    next: ranked.next,
    blocked: ranked.blocked,
    agents,
    recentChanges,
    decisions,
    gitContext: options.gitContext,
    agentActivity: [...(options.agentActivity ?? [])],
    config: options.config ?? { writeback: false },
  };
}

function extractDecisions(docs: readonly ParsedDoc[]): Decision[] {
  const results: Decision[] = [];
  for (const doc of docs) {
    const file = (doc.file.split(/[\\/]/).pop() ?? doc.file).toLowerCase();
    const isStateDoc = file === "state.md";
    const isLogDoc = /_log\.md$/i.test(file);
    if (!isStateDoc && !isLogDoc) continue;
    const section = findSectionByHeading(doc.sections, HEADING_PATTERNS.decisions);
    if (!section) continue;
    collectDecisionBullets(section, doc.file, results);
  }
  results.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return results.slice(0, 10);
}

function collectDecisionBullets(section: ParsedSection, doc: string, out: Decision[]): void {
  for (const item of section.checklistItems) {
    const parsed = parseDecisionLine(item.text);
    if (!parsed) continue;
    out.push({ at: parsed.at, text: parsed.text, doc, line: item.line });
  }
  for (const paragraph of section.paragraphs) {
    for (const line of paragraph.split(/\r?\n/)) {
      const trimmed = line.replace(/^[-*]\s+/, "").trim();
      if (!trimmed) continue;
      const parsed = parseDecisionLine(trimmed);
      if (!parsed) continue;
      out.push({ at: parsed.at, text: parsed.text, doc });
    }
  }
  for (const child of section.children) {
    collectDecisionBullets(child, doc, out);
  }
}

function parseDecisionLine(raw: string): { at: string; text: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})\s*[—–\-:]\s*(.+)$/.exec(raw.trim());
  if (!match) return null;
  const at = match[1] ?? "";
  const text = (match[2] ?? "").trim();
  if (!at || !text) return null;
  return { at, text };
}

export const normalize = normalizeQuestState;

function extractMission(docs: readonly ParsedDoc[]): string {
  const missionDoc = docs.find((doc) => isFile(doc.file, "PLAN.md"))
    ?? docs.find((doc) => isFile(doc.file, "README.md"));
  if (!missionDoc) {
    return "";
  }

  const missionSection = findSectionByHeading(missionDoc.sections, HEADING_PATTERNS.mission);
  const sourceText = firstMeaningfulParagraph(missionSection ? [missionSection] : missionDoc.sections)
    ?? firstNonEmptyParagraph(findFirstSection(missionDoc.sections))
    ?? "";

  return firstSentence(sourceText);
}

function extractActiveQuest(docs: readonly ParsedDoc[]): Objective {
  const questDoc = docs.find((doc) => isFile(doc.file, "PLAN.md"))
    ?? docs[0];
  const questSection = questDoc ? findSectionByHeading(questDoc.sections, HEADING_PATTERNS.activeQuest) : undefined;
  const tasks = questSection ? collectChecklistItems(questSection) : [];
  const checked = tasks.filter((task) => task.checked).length;

  return {
    title: firstNonEmptyParagraph(questSection) ?? questSection?.heading ?? "",
    doc: questDoc?.file ?? "PLAN.md",
    line: questSection?.line,
    progress: {
      done: checked,
      total: tasks.length,
    },
  };
}

function collectTasks(
  docs: readonly ParsedDoc[],
  headingPattern: RegExp,
  bucket: "now" | "next",
  limit: number,
): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];

  for (const doc of docs) {
    for (const section of walkSections(doc.sections)) {
      if (!headingPattern.test(section.section.heading)) {
        continue;
      }

      const checklistItems = collectChecklistItems(section.section);
      if (checklistItems.length === 0) {
        continue;
      }

      const thought = firstNonEmptyParagraph(section.section)
        ?? checklistItems[0]?.text
        ?? "";
      const agent = inferAgent(doc.file);
      const sectionName = bucket;

      for (const [index, item] of checklistItems.entries()) {
        if (item.checked) {
          continue;
        }

        tasks.push({
          id: buildTaskId(doc.file, sectionName, section.section.line, item.line, index),
          text: item.text,
          agent,
          doc: doc.file,
          line: item.line ?? section.section.line,
          est: estimateTaskSize(item.text),
          confidence: 0.95,
          thought,
        });
      }
    }
  }

  return tasks.slice(0, limit);
}

function collectBlockedTasks(
  docs: readonly ParsedDoc[],
  headingPattern: RegExp,
): ExtractedBlockedTask[] {
  const tasks: ExtractedBlockedTask[] = [];

  for (const doc of docs) {
    for (const section of walkSections(doc.sections)) {
      if (!headingPattern.test(section.section.heading)) {
        continue;
      }

      const checklistItems = collectChecklistItems(section.section);
      const reason = firstSentence(firstNonEmptyParagraph(section.section) ?? section.section.paragraphs[0] ?? "");
      if (checklistItems.length === 0) {
        const fallback = firstNonEmptyParagraph(section.section);
        if (!fallback) {
          continue;
        }

        tasks.push({
          id: buildTaskId(doc.file, "blocked", section.section.line, undefined, tasks.length),
          text: fallback,
          agent: inferAgent(doc.file),
          doc: doc.file,
          line: section.section.line,
          est: estimateTaskSize(fallback),
          confidence: 0.8,
          reason: reason || fallback,
          since: relativeSince(doc.modifiedAt),
          thought: fallback,
        });
        continue;
      }

      for (const [index, item] of checklistItems.entries()) {
        if (item.checked) {
          continue;
        }

        tasks.push({
          id: buildTaskId(doc.file, "blocked", section.section.line, item.line, index),
          text: splitBlockedText(item.text).text,
          agent: inferAgent(doc.file),
          doc: doc.file,
          line: item.line ?? section.section.line,
          est: estimateTaskSize(splitBlockedText(item.text).text),
          confidence: 0.95,
          reason: reason || splitBlockedText(item.text).reason || item.text,
          since: relativeSince(doc.modifiedAt),
          thought: firstNonEmptyParagraph(section.section) ?? splitBlockedText(item.text).text,
        });
      }
    }
  }

  return tasks;
}

function buildResumeNote(params: {
  activeQuest: Objective;
  recentChanges: readonly FileChange[];
  topTask?: ExtractedTask | ExtractedBlockedTask;
  lastTouchedFile?: string;
  lastTouchedAt?: string;
  docs: readonly ParsedDoc[];
}): ResumeNote {
  const topTask = params.topTask;
  const lastTouchedFile = params.lastTouchedFile
    ?? params.recentChanges[0]?.file
    ?? topTask?.doc
    ?? params.activeQuest.doc;
  const sourceDoc = params.docs.find((doc) => isFile(doc.file, lastTouchedFile ?? ""));
  const thought = "thought" in (topTask ?? {}) ? topTask?.thought : undefined;

  return {
    task: topTask?.text ?? params.activeQuest.title,
    doc: topTask?.doc ?? params.activeQuest.doc,
    since: relativeSince(params.lastTouchedAt ?? sourceDoc?.modifiedAt),
    lastTouched: lastTouchedFile ?? params.activeQuest.doc,
    thought: thought || firstNonEmptyParagraph(findSectionByHeading(sourceDoc?.sections ?? [], HEADING_PATTERNS.activeQuest)) || topTask?.text,
  };
}

function walkSections(
  sections: readonly ParsedSection[],
): Array<{ section: ParsedSection }> {
  const result: Array<{ section: ParsedSection }> = [];
  const stack = [...sections].map((section) => ({ section }));

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current) {
      continue;
    }

    result.push(current);
    for (const child of current.section.children) {
      stack.push({ section: child });
    }
  }

  return result;
}

function collectChecklistItems(section: ParsedSection): ParsedSection["checklistItems"] {
  const items = [...section.checklistItems];
  for (const child of section.children) {
    items.push(...collectChecklistItems(child));
  }
  return items;
}

function findSectionByHeading(
  sections: readonly ParsedSection[],
  pattern: RegExp,
): ParsedSection | undefined {
  for (const section of sections) {
    if (pattern.test(section.heading)) {
      return section;
    }

    const child = findSectionByHeading(section.children, pattern);
    if (child) {
      return child;
    }
  }

  return undefined;
}

function findFirstSection(sections: readonly ParsedSection[]): ParsedSection | undefined {
  const first = sections[0];
  if (!first) {
    return undefined;
  }

  return first;
}

function firstNonEmptyParagraph(section: ParsedSection | undefined): string | undefined {
  if (!section) {
    return undefined;
  }

  return section.paragraphs.find((paragraph) => paragraph.trim().length > 0)?.trim();
}

function firstMeaningfulParagraph(sections: readonly ParsedSection[]): string | undefined {
  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed || /^one sentence:/i.test(trimmed)) {
        continue;
      }
      return trimmed;
    }

    const child = firstMeaningfulParagraph(section.children);
    if (child) {
      return child;
    }
  }

  return undefined;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return match?.[1] ?? trimmed;
}

function buildTaskId(
  file: string,
  bucket: string,
  sectionLine: number | undefined,
  itemLine: number | undefined,
  index: number,
): string {
  const fileId = normalizeId(file);
  const lineId = itemLine ?? sectionLine;
  const suffix = lineId ? `${lineId}` : `${index + 1}`;
  return `${fileId}#${bucket}-${suffix}`;
}

function splitBlockedText(text: string): { text: string; reason?: string } {
  const match = text.match(/^(.*?)\s+[—-]\s+(.*)$/);
  if (!match) {
    return { text };
  }

  const taskText = match[1]?.trim();
  const reason = match[2]?.trim();
  return {
    text: taskText || text,
    reason: reason || undefined,
  };
}

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function estimateTaskSize(text: string): "S" | "M" | "L" | "XL" {
  const length = text.trim().length;
  if (length < 40) {
    return "S";
  }
  if (length < 80) {
    return "M";
  }
  if (length < 140) {
    return "L";
  }
  return "XL";
}

function dedupeRecentChanges(changes: readonly FileChange[]): FileChange[] {
  const seen = new Map<string, FileChange>();
  for (const change of changes) {
    if (!seen.has(change.file)) {
      seen.set(change.file, change);
    }
  }
  return [...seen.values()];
}

function inferRepoName(repoRoot: string | undefined, scannedFiles: readonly string[]): string {
  if (repoRoot) {
    const normalized = repoRoot.replace(/[\\/]+$/, "");
    const parts = normalized.split(/[\\/]/);
    return parts[parts.length - 1] ?? "repo";
  }

  const known = scannedFiles.find((file) => isFile(file, "package.json") || isFile(file, "README.md"));
  return known ? "repo" : "repo";
}

function inferAgent(file: string): AgentId | undefined {
  const normalized = fileName(file).toLowerCase();
  if (isFile(normalized, "CLAUDE.md")) {
    return "claude";
  }
  if (isFile(normalized, "GEMINI.md")) {
    return "gemini";
  }
  if (isFile(normalized, "AGENTS.md") || isFile(normalized, "PLAN.md") || isFile(normalized, "STATE.md")) {
    return "codex";
  }
  return undefined;
}

function compareDocs(left: string, right: string): number {
  const leftPriority = DOC_PRIORITY.get(fileName(left).toLowerCase()) ?? 99;
  const rightPriority = DOC_PRIORITY.get(fileName(right).toLowerCase()) ?? 99;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  return fileName(left).localeCompare(fileName(right));
}

function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }
  return output;
}

function isFile(left: string, right: string): boolean {
  return fileName(left).toLowerCase() === fileName(right).toLowerCase();
}

function fileName(file: string): string {
  return file.replace(/\\/g, "/").split("/").pop() ?? file;
}
