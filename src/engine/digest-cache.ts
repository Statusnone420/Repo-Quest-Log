import { createHash } from "node:crypto";
import { mkdir, readFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";

import { cleanupTempFile, writeAtomicExclusive } from "./safe-fs.js";
import type { DigestResult } from "./types.js";

export function repoCacheKey(repoRoot: string): string {
  return createHash("sha256").update(resolve(repoRoot)).digest("hex").slice(0, 24);
}

export function repoCacheDir(cacheRoot: string, repoRoot: string): string {
  return join(cacheRoot, "repos", repoCacheKey(repoRoot));
}

export function digestCacheFile(cacheRoot: string, repoRoot: string): string {
  return join(repoCacheDir(cacheRoot, repoRoot), "digest.json");
}

export async function readLastDigest(cacheRoot: string, repoRoot: string): Promise<DigestResult | undefined> {
  try {
    const raw = await readFile(digestCacheFile(cacheRoot, repoRoot), "utf8");
    return JSON.parse(raw) as DigestResult;
  } catch {
    return undefined;
  }
}

export async function writeLastDigest(cacheRoot: string, repoRoot: string, digest: DigestResult): Promise<string> {
  const filePath = digestCacheFile(cacheRoot, repoRoot);
  await mkdir(repoCacheDir(cacheRoot, repoRoot), { recursive: true });
  const tempPath = await writeAtomicExclusive(filePath, `${JSON.stringify(digest, null, 2)}\n`);
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await cleanupTempFile(tempPath);
    throw error;
  }
  return filePath;
}
