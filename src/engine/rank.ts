import type { BlockedTask, Task } from "./types.js";

export interface RankedBuckets {
  now: Task[];
  next: Task[];
  blocked: BlockedTask[];
}

export interface RankOptions {
  nowLimit?: number;
  nextLimit?: number;
  docOrder?: readonly string[];
}

export function rankBuckets(
  buckets: RankedBuckets,
  options: RankOptions = {},
): RankedBuckets {
  const docOrder = new Map(
    (options.docOrder ?? []).map((file, index) => [fileName(file), index]),
  );

  const nowLimit = options.nowLimit ?? 3;
  const nextLimit = options.nextLimit ?? 5;

  return {
    now: sortTasks(buckets.now, docOrder).slice(0, nowLimit),
    next: sortTasks(buckets.next, docOrder).slice(0, nextLimit),
    blocked: sortBlocked(buckets.blocked, docOrder),
  };
}

function sortTasks(tasks: readonly Task[], docOrder: Map<string, number>): Task[] {
  return [...tasks].sort((left, right) => compareTasks(left, right, docOrder));
}

function sortBlocked(tasks: readonly BlockedTask[], docOrder: Map<string, number>): BlockedTask[] {
  return [...tasks].sort((left, right) => compareTasks(left, right, docOrder));
}

function compareTasks(
  left: Task,
  right: Task,
  docOrder: Map<string, number>,
): number {
  const docDelta = scoreDoc(left.doc, docOrder) - scoreDoc(right.doc, docOrder);
  if (docDelta !== 0) {
    return docDelta;
  }

  const lineDelta = (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER);
  if (lineDelta !== 0) {
    return lineDelta;
  }

  const confidenceDelta = right.confidence - left.confidence;
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  return left.text.localeCompare(right.text);
}

function scoreDoc(doc: string, docOrder: Map<string, number>): number {
  const normalized = fileName(doc);
  const explicit = docOrder.get(normalized);
  if (explicit !== undefined) {
    return explicit;
  }

  if (normalized === "STATE.md") {
    return -3;
  }
  if (normalized === "PLAN.md") {
    return -2;
  }
  if (normalized === "README.md") {
    return -1;
  }

  return docOrder.size + 10;
}

function fileName(file: string): string {
  return file.replace(/\\/g, "/").split("/").pop() ?? file;
}
