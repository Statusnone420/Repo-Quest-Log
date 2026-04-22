import { HEADING_PATTERNS } from "./fileset.js";
import { parseRepo } from "./parse.js";
import type { FileChange, ParsedDoc, ParsedSection, QuestState, Task } from "./types.js";

export type StandupSince = "today" | "yesterday" | "7d";

export interface StandupCompletedItem {
  text: string;
  doc: string;
  line?: number;
  completedAt: string;
}

export interface StandupJson {
  date: string;
  since: StandupSince;
  done: Array<{ text: string; doc: string }>;
  workingOn: Array<{ text: string; doc: string }>;
  changed: Array<{ file: string; diff: string }>;
}

export interface StandupResult {
  markdown: string;
  json: StandupJson;
}

export interface BuildStandupOptions {
  since?: StandupSince;
  now?: Date;
  completedItems?: readonly StandupCompletedItem[];
}

export async function buildStandupForRepo(
  rootDir: string,
  state: QuestState,
  options: BuildStandupOptions = {},
): Promise<StandupResult> {
  const now = options.now ?? new Date();
  const completedItems = options.completedItems ?? await extractCompletedStandupItems(rootDir, {
    since: options.since ?? "today",
    now,
  });
  return buildStandup(state, {
    ...options,
    now,
    completedItems,
  });
}

export async function buildStandupMarkdown(
  rootDir: string,
  state: QuestState,
  options: BuildStandupOptions = {},
): Promise<string> {
  const result = await buildStandupForRepo(rootDir, state, options);
  return result.markdown;
}

export function buildStandup(
  state: QuestState,
  options: BuildStandupOptions = {},
): StandupResult {
  const now = options.now ?? new Date();
  const since = options.since ?? "today";
  const date = formatDate(now);
  const done = dedupeCompletedItems(options.completedItems ?? []).map((item) => ({
    text: item.text,
    doc: item.doc,
  }));
  const workingOn = state.now.slice(0, 3).map((task) => ({
    text: task.text,
    doc: task.doc,
  }));
  const changed = filterRecentChanges(state.recentChanges, since, now).map((change) => ({
    file: change.file,
    diff: change.diff ?? "no diff",
  }));

  const json: StandupJson = {
    date,
    since,
    done,
    workingOn,
    changed,
  };

  const markdown = [
    `## Standup — ${date}`,
    "**Done**",
    ...(json.done.length > 0 ? json.done.map((item) => `- ${item.text} (${item.doc})`) : ["- none"]),
    "**Working on**",
    ...(json.workingOn.length > 0 ? json.workingOn.map((item) => `- ${item.text} (${item.doc})`) : ["- none"]),
    "**Changed**",
    ...(json.changed.length > 0 ? json.changed.map((item) => `- ${item.file} (${item.diff})`) : ["- none"]),
  ].join("\n");

  return { markdown, json };
}

export async function extractCompletedStandupItems(
  rootDir: string,
  options: { since?: StandupSince; now?: Date } = {},
): Promise<StandupCompletedItem[]> {
  const docs = await parseRepo(rootDir);
  return collectCompletedStandupItems(docs, {
    since: options.since ?? "today",
    now: options.now ?? new Date(),
  });
}

export function collectCompletedStandupItems(
  docs: readonly ParsedDoc[],
  options: { since: StandupSince; now: Date },
): StandupCompletedItem[] {
  const threshold = getSinceThreshold(options.since, options.now);
  const results: StandupCompletedItem[] = [];

  for (const doc of docs) {
    const modifiedAt = Date.parse(doc.modifiedAt ?? "");
    if (!Number.isFinite(modifiedAt) || modifiedAt < threshold) {
      continue;
    }

    for (const section of walkSections(doc.sections)) {
      if (!isTrackedChecklistSection(section.section.heading)) {
        continue;
      }

      for (const item of section.section.checklistItems) {
        if (!item.checked) {
          continue;
        }

        results.push({
          text: item.text,
          doc: doc.file,
          line: item.line,
          completedAt: new Date(modifiedAt).toISOString(),
        });
      }
    }
  }

  return dedupeCompletedItems(results);
}

function filterRecentChanges(changes: readonly FileChange[], since: StandupSince, now: Date): FileChange[] {
  const maxMinutes = sinceToMaxMinutes(since, now);
  return changes.filter((change) => {
    const age = relativeTextToMinutes(change.at);
    if (age === undefined) {
      return since === "7d";
    }
    return age <= maxMinutes;
  });
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

function dedupeCompletedItems(entries: readonly StandupCompletedItem[]): StandupCompletedItem[] {
  const seen = new Set<string>();
  const unique: StandupCompletedItem[] = [];

  for (const entry of [...entries].sort((left, right) => right.completedAt.localeCompare(left.completedAt))) {
    const key = `${entry.doc}:${entry.line ?? 0}:${entry.text}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getSinceThreshold(since: StandupSince, now: Date): number {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  if (since === "today") {
    return value.getTime();
  }
  if (since === "yesterday") {
    value.setDate(value.getDate() - 1);
    return value.getTime();
  }
  value.setDate(value.getDate() - 7);
  return value.getTime();
}

function sinceToMaxMinutes(since: StandupSince, now: Date): number {
  if (since === "7d") {
    return 7 * 24 * 60;
  }

  const anchor = new Date(now);
  anchor.setHours(0, 0, 0, 0);
  if (since === "yesterday") {
    anchor.setDate(anchor.getDate() - 1);
  }

  return Math.max(0, Math.ceil((now.getTime() - anchor.getTime()) / 60000));
}

function relativeTextToMinutes(value: string): number | undefined {
  const text = value.trim().toLowerCase();
  if (!text) {
    return undefined;
  }
  if (text === "just now" || text === "now") {
    return 0;
  }

  const short = /^(\d+)\s*([smhd])$/.exec(text);
  if (short) {
    const amount = Number(short[1]);
    const unit = short[2] ?? "";
    if (unit === "s") return 0;
    if (unit === "m") return amount;
    if (unit === "h") return amount * 60;
    if (unit === "d") return amount * 24 * 60;
  }

  const long = /^(\d+)\s*(sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours|day|days)\b/.exec(text);
  if (!long) {
    return undefined;
  }

  const amount = Number(long[1]);
  const unit = long[2] ?? "";
  if (unit.startsWith("sec")) return 0;
  if (unit.startsWith("min")) return amount;
  if (unit.startsWith("h")) return amount * 60;
  return amount * 24 * 60;
}
