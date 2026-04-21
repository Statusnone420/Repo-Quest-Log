import { basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { isExcludedPath, readRepoConfig } from "./config.js";
import { normalizeQuestState } from "./normalize.js";
import { parseRepo } from "./parse.js";
import type { FileChange, QuestState } from "./types.js";

export interface ScanOptions {
  recentChanges?: readonly FileChange[];
  lastTouchedFile?: string;
  lastTouchedAt?: string;
}

export async function scanRepo(rootDir: string, options: ScanOptions = {}): Promise<QuestState> {
  const resolvedRoot = resolve(rootDir);
  const config = await readRepoConfig(resolvedRoot);
  const docs = await parseRepo(resolvedRoot);

  return normalizeQuestState(docs, {
    repoRoot: resolvedRoot,
    repoName: basename(resolvedRoot),
    branch: readBranchName(resolvedRoot),
    lastScan: new Date().toISOString(),
    recentChanges: buildRecentChanges(docs, options.recentChanges, resolvedRoot, config.excludes),
    lastTouchedFile: options.lastTouchedFile,
    lastTouchedAt: options.lastTouchedAt,
  });
}

function buildRecentChanges(
  docs: Awaited<ReturnType<typeof parseRepo>>,
  incoming?: readonly FileChange[],
  rootDir?: string,
  excludes: readonly string[] = [],
): FileChange[] {
  const changes: FileChange[] = incoming && incoming.length > 0
    ? [...incoming]
    : [...docs]
        .sort((left, right) => {
          const leftTime = left.modifiedAt ? Date.parse(left.modifiedAt) : 0;
          const rightTime = right.modifiedAt ? Date.parse(right.modifiedAt) : 0;
          return rightTime - leftTime;
        })
        .slice(0, 8)
        .map((doc) => ({
          file: doc.file,
          at: relativeSince(doc.modifiedAt),
        }));
  const filtered = changes.filter((change) => !isExcludedPath(change.file, { excludes: [...excludes] }));

  if (!rootDir) {
    return filtered;
  }

  return filtered.map((change) => ({
    ...change,
    diff: change.diff ?? readDiffSummary(rootDir, change.file),
  }));
}

function readBranchName(rootDir: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "no-git";
  }
}

function readDiffSummary(rootDir: string, file: string): string | undefined {
  try {
    const output = execFileSync("git", ["diff", "HEAD", "--numstat", "--", file], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (!output) {
      return undefined;
    }

    const [addedRaw, deletedRaw] = output.split(/\s+/, 3);
    const added = addedRaw === "-" ? 0 : Number(addedRaw);
    const deleted = deletedRaw === "-" ? 0 : Number(deletedRaw);

    if (!Number.isFinite(added) || !Number.isFinite(deleted)) {
      return undefined;
    }

    return `+${added} -${deleted}`;
  } catch {
    return undefined;
  }
}

function relativeSince(iso?: string): string {
  if (!iso) {
    return "just now";
  }

  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "just now";
  }

  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) {
    return "just now";
  }
  if (deltaMs < hour) {
    return `${Math.max(1, Math.round(deltaMs / minute))}m`;
  }
  if (deltaMs < day) {
    return `${Math.max(1, Math.round(deltaMs / hour))}h`;
  }
  return `${Math.max(1, Math.round(deltaMs / day))}d`;
}
