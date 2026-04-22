import { parseRepo } from "./parse.js";
import { HEADING_PATTERNS } from "./fileset.js";
import type { ParsedDoc, ParsedSection, QuestState, Task } from "./types.js";

export interface StandupEntry {
  text: string;
  doc: string;
  line?: number;
  checked: boolean;
  at: number;
}

export async function buildStandupMarkdown(rootDir: string, state: QuestState): Promise<string> {
  const docs = await parseRepo(rootDir);
  const doneToday = collectDoneToday(docs);
  return formatStandupMarkdown(state, doneToday);
}

export function formatStandupMarkdown(
  state: QuestState,
  doneToday: readonly StandupEntry[] = [],
): string {
  const completed = [...doneToday].sort((left, right) => {
    if (left.at !== right.at) {
      return right.at - left.at;
    }
    return left.text.localeCompare(right.text);
  });
  const nowItems = state.now.slice(0, 3);

  return [
    `# Standup - ${state.name}`,
    "",
    `- Branch: ${state.branch}`,
    `- Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total})`,
    `- Resume: ${state.resumeNote.task}`,
    "",
    "## Done Today",
    ...(completed.length > 0 ? completed.map((item) => formatEntry(item, "x")) : ["- none"]),
    "",
    "## Now",
    ...(nowItems.length > 0 ? nowItems.map((task) => formatTask(task, " ")) : ["- none"]),
    "",
  ].join("\n");
}

function collectDoneToday(docs: readonly ParsedDoc[]): StandupEntry[] {
  const threshold = startOfToday();
  const results: StandupEntry[] = [];

  for (const doc of docs) {
    const modifiedAt = Date.parse(doc.modifiedAt ?? "");
    if (!Number.isFinite(modifiedAt) || modifiedAt < threshold) {
      continue;
    }

    for (const section of walkSections(doc.sections)) {
      if (!isTrackedChecklistSection(section.section.heading)) {
        continue;
      }

      for (const item of collectChecklistItems(section.section)) {
        if (!item.checked) {
          continue;
        }

        results.push({
          text: item.text,
          doc: doc.file,
          line: item.line,
          checked: true,
          at: modifiedAt,
        });
      }
    }
  }

  return dedupeStandupEntries(results);
}

function isTrackedChecklistSection(heading: string): boolean {
  return HEADING_PATTERNS.now.test(heading)
    || HEADING_PATTERNS.next.test(heading)
    || HEADING_PATTERNS.blocked.test(heading)
    || HEADING_PATTERNS.activeQuest.test(heading);
}

function walkSections(sections: readonly ParsedSection[]): Array<{ section: ParsedSection }> {
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
  return [...section.checklistItems];
}

function dedupeStandupEntries(entries: readonly StandupEntry[]): StandupEntry[] {
  const seen = new Set<string>();
  const unique: StandupEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.doc}:${entry.line ?? 0}:${entry.text}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

function formatEntry(entry: StandupEntry, marker: "x" | " "): string {
  return `- [${marker}] ${entry.text}${entry.doc ? ` (${entry.doc}${entry.line ? `:${entry.line}` : ""})` : ""}`;
}

function formatTask(task: Task, marker: "x" | " "): string {
  return formatEntry(
    {
      text: task.text,
      doc: task.doc,
      line: task.line,
      checked: marker === "x",
      at: 0,
    },
    marker,
  );
}

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}
