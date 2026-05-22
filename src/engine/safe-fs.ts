import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
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

export async function assertSafeRepoWriteTarget(rootDir: string, filePath: string): Promise<void> {
  const root = resolve(rootDir);
  const target = resolve(filePath);
  assertLexicallyInside(root, target);

  const realRoot = normalizeForPlatform(await realpath(root));
  const realParent = normalizeForPlatform(await realpath(dirname(target)));
  assertRelativeInside(realRoot, realParent, dirname(target));

  try {
    const stat = await lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Refusing to write non-regular file: ${filePath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function ensureSafeDirectory(rootDir: string, dirPath: string): Promise<void> {
  const root = resolve(rootDir);
  const target = resolve(dirPath);
  assertLexicallyInside(root, target);

  try {
    const stat = await lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Refusing to use non-directory path: ${dirPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await mkdir(target, { recursive: true });
  }

  const realRoot = normalizeForPlatform(await realpath(root));
  const realTarget = normalizeForPlatform(await realpath(target));
  assertRelativeInside(realRoot, realTarget, target);
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

function assertLexicallyInside(root: string, target: string): void {
  const normalizedRoot = normalizeForPlatform(root);
  const normalizedTarget = normalizeForPlatform(target);
  if (normalizedTarget === normalizedRoot) return;
  if (!normalizedTarget.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`Path escapes repo root: ${target}`);
  }
}

function assertRelativeInside(realRoot: string, realTarget: string, displayPath: string): void {
  const rel = relative(realRoot, realTarget);
  if (rel === "" || rel === ".") return;
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
    throw new Error(`Path escapes repo root: ${displayPath}`);
  }
}
