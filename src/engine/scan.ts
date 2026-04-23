import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";

import { inferAgentActivity } from "./activity.js";
import { extractAgentProfiles } from "./agents.js";
import { isExcludedPath, readRepoConfig } from "./config.js";
import { readGitContext } from "./git.js";
import { normalizeQuestState } from "./normalize.js";
import { parseRepo } from "./parse.js";
import { relativeSince } from "./time.js";
import type { DigestResult, FileChange, QuestState } from "./types.js";

export interface ScanOptions {
  recentChanges?: readonly FileChange[];
  lastTouchedFile?: string;
  lastTouchedAt?: string;
}

export async function scanRepo(rootDir: string, options: ScanOptions = {}): Promise<QuestState> {
  const resolvedRoot = resolve(rootDir);
  const config = await readRepoConfig(resolvedRoot);
  const docs = await parseRepo(resolvedRoot);
  const gitContext = readGitContext(resolvedRoot);
  const recentChanges = buildRecentChanges(docs, options.recentChanges, resolvedRoot, config.excludes);
  const agents = extractAgentProfiles(docs);
  const agentActivity = inferAgentActivity(agents, recentChanges);

  const charterPresent = await fileExists(resolve(resolvedRoot, ".repolog", "CHARTER.md"));
  const hasFrontmatter = docs.some(
    (doc) => doc.frontmatter && Object.keys(doc.frontmatter).length > 0,
  );

   const state = normalizeQuestState(docs, {
     repoRoot: resolvedRoot,
     repoName: basename(resolvedRoot),
     branch: gitContext?.branch ?? readBranchName(resolvedRoot),
     lastScan: new Date().toISOString(),
     recentChanges,
     lastTouchedFile: options.lastTouchedFile,
     lastTouchedAt: options.lastTouchedAt,
     gitContext,
     agentActivity,
     config: {
       excludes: config.excludes,
       writeback: config.writeback,
       prompts: config.prompts,
       watch: config.watch,
       charterPresent,
       hasFrontmatter,
     },
   });

   // Load persisted digest into scan
   const digestPath = join(resolvedRoot, ".repolog", "digest.json");
   if (existsSync(digestPath)) {
     try {
       state.lastDigest = JSON.parse(readFileSync(digestPath, "utf8")) as DigestResult;
     } catch { /* corrupt digest, ignore */ }
   }

   return state;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
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
