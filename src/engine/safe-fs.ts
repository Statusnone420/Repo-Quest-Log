import { randomBytes } from "node:crypto";
import { lstat, mkdtemp, open, realpath, rm, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

function normalizeForPlatform(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

export async function assertPathInsideRepo(rootDir: string, targetPath: string): Promise<void> {
  const realRoot = normalizeForPlatform(await realpath(resolve(rootDir)));
  const realTarget = normalizeForPlatform(await realpath(resolve(targetPath)));
  const rel = relative(realRoot, realTarget);
  if (rel === "" || rel === ".") return;
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
    throw new Error(`Path escapes repo root: ${targetPath}`);
  }
}

export async function assertRegularFilePath(rootDir: string, filePath: string): Promise<void> {
  await assertPathInsideRepo(rootDir, filePath);
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Refusing to use non-regular file: ${filePath}`);
  }
}

export async function writeAtomicExclusive(filePath: string, content: string): Promise<string> {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const tempPath = join(dir, `.${base}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  const handle = await open(tempPath, "wx", 0o600);
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }
  return tempPath;
}

export async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    await unlink(tempPath);
  } catch {
    // best effort
  }
}
