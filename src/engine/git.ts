import { execFileSync } from "node:child_process";

import { relativeSince } from "./time.js";

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

export function readGitContext(rootDir: string): GitContext | undefined {
  const branch = runGit(rootDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch) {
    return undefined;
  }

  const { ahead, behind } = readAheadBehind(rootDir);
  const dirtyFiles = readDirtyFileCount(rootDir);
  const lastCommit = readLastCommit(rootDir);

  return { branch, ahead, behind, dirtyFiles, lastCommit };
}

function readAheadBehind(rootDir: string): { ahead: number; behind: number } {
  const raw = runGit(rootDir, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
  if (!raw) {
    return { ahead: 0, behind: 0 };
  }
  const [aheadRaw, behindRaw] = raw.split(/\s+/);
  const ahead = Number(aheadRaw);
  const behind = Number(behindRaw);
  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

function readDirtyFileCount(rootDir: string): number {
  const raw = runGit(rootDir, ["status", "--porcelain"]);
  if (!raw) {
    return 0;
  }
  return raw.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function readLastCommit(rootDir: string): GitContext["lastCommit"] {
  const raw = runGit(rootDir, ["log", "-1", "--pretty=%h%x1f%s%x1f%cI"]);
  if (!raw) {
    return undefined;
  }
  const [sha, subject, iso] = raw.split("\x1f");
  if (!sha || !subject) {
    return undefined;
  }
  return {
    sha,
    subject,
    at: relativeSince(iso),
  };
}

function runGit(rootDir: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}
