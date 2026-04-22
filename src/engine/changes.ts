import type { FileChange } from "./types.js";

export function mergeChanges(next: readonly FileChange[], previous: readonly FileChange[]): FileChange[] {
  const merged = new Map<string, FileChange>();

  for (const change of next) {
    merged.set(change.file, change);
  }

  for (const change of previous) {
    if (!merged.has(change.file)) {
      merged.set(change.file, change);
    }
  }

  return [...merged.values()].slice(0, 10);
}
