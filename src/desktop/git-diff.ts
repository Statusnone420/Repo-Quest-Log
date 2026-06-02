import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export interface FileDiffResult {
  ok: boolean;
  file: string;
  text: string;
  truncated: boolean;
  reason?: string;
}

export interface FileDiffOptions {
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 80 * 1024;

export function readFileDiff(
  repoRoot: string,
  file: string,
  options: FileDiffOptions = {},
): FileDiffResult {
  const safe = safeRepoRelativePath(repoRoot, file);
  if (!safe.ok) {
    return { ok: false, file, text: "", truncated: false, reason: safe.reason };
  }

  try {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const tracked = readTrackedDiff(repoRoot, safe.file, maxBytes);
    const untracked = tracked.text ? undefined : readUntrackedPreview(repoRoot, safe.file, maxBytes);
    const preview = tracked.text ? tracked : untracked;
    return {
      ok: true,
      file: safe.file,
      text: preview?.text || "No uncommitted diff for this file.",
      truncated: !!preview?.truncated,
    };
  } catch (error) {
    return {
      ok: false,
      file: safe.file,
      text: "",
      truncated: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function readTrackedDiff(repoRoot: string, file: string, maxBytes: number): { text: string; truncated: boolean } {
  const result = spawnSync("git", ["diff", "--no-ext-diff", "--unified=3", "HEAD", "--", file], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: Math.max(maxBytes * 16, DEFAULT_MAX_BYTES),
    stdio: ["ignore", "pipe", "ignore"],
  });

  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const capped = capUtf8(stdout, maxBytes);
  return {
    text: capped.text,
    truncated: capped.truncated || !!result.error,
  };
}

function readUntrackedPreview(repoRoot: string, file: string, maxBytes: number): { text: string; truncated: boolean } {
  const status = execFileSync("git", ["status", "--porcelain", "--", file], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (!status.split(/\r?\n/).some((line) => line.startsWith("?? "))) {
    return { text: "", truncated: false };
  }

  const filePath = resolve(repoRoot, file);
  if (!existsSync(filePath)) {
    return { text: "", truncated: false };
  }

  const content = capUtf8(readFileSync(filePath, "utf8"), maxBytes);
  return {
    text: [
    `diff --git a/${file} b/${file}`,
    "new file",
    "--- /dev/null",
    `+++ b/${file}`,
    "@@",
    ...content.text.split(/\r?\n/).filter((line) => line.length > 0).map((line) => `+${line}`),
    ].join("\n"),
    truncated: content.truncated,
  };
}

function safeRepoRelativePath(repoRoot: string, file: string): { ok: true; file: string } | { ok: false; reason: string } {
  const root = resolve(repoRoot);
  const target = resolve(root, file);
  const rel = relative(root, target).replace(/\\/g, "/");

  if (!rel || rel.startsWith("../") || rel === ".." || /^[A-Za-z]:\//.test(rel)) {
    return { ok: false, reason: "file is outside repo" };
  }

  return { ok: true, file: rel };
}

function capUtf8(value: string, maxBytes: number): { text: string; truncated: boolean } {
  const buffer = Buffer.from(value, "utf8");
  if (buffer.byteLength <= maxBytes) {
    return { text: value, truncated: false };
  }

  return {
    text: buffer.subarray(0, maxBytes).toString("utf8"),
    truncated: true,
  };
}
