import { createHash } from "node:crypto";
import { readFile, rename, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface ChecklistToggleResult {
  ok: boolean;
  changed: boolean;
  checked?: boolean;
  reason?: string;
}

const writeQueues = new Map<string, Promise<ChecklistToggleResult>>();

export async function toggleChecklistItem(
  filePath: string,
  line: number,
  expectedText: string,
  nextChecked?: boolean,
): Promise<ChecklistToggleResult> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve({ ok: true, changed: false });
  const next = previous.then(() => toggleChecklistItemUnsafe(filePath, line, expectedText, nextChecked));
  writeQueues.set(filePath, next.catch(() => ({ ok: false, changed: false })));
  try {
    return await next;
  } finally {
    if (writeQueues.get(filePath) === next) {
      writeQueues.delete(filePath);
    }
  }
}

async function toggleChecklistItemUnsafe(
  filePath: string,
  line: number,
  expectedText: string,
  nextChecked?: boolean,
): Promise<ChecklistToggleResult> {
  if (!Number.isInteger(line) || line < 1) {
    return { ok: false, changed: false, reason: "invalid line number" };
  }

  const original = await readFile(filePath, "utf8");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original.split(/\r?\n/);
  const current = lines[line - 1];

  if (typeof current !== "string") {
    return { ok: false, changed: false, reason: "line not found" };
  }

  const match = /^(\s*[-*]\s+\[)( |x|X)(\]\s+)(.*)$/.exec(current);
  if (!match) {
    return { ok: false, changed: false, reason: "line is not a checklist item" };
  }

  const currentText = normalizeTaskText(match[4] ?? "");
  const expected = normalizeTaskText(expectedText);
  if (!currentText || currentText !== expected) {
    return { ok: false, changed: false, reason: "Line has changed since last read; re-scan required" };
  }

  const currentChecked = (match[2] ?? " ").toLowerCase() === "x";
  const checked = typeof nextChecked === "boolean" ? nextChecked : !currentChecked;
  if (checked === currentChecked) {
    return { ok: true, changed: false, checked: currentChecked };
  }

  lines[line - 1] = `${match[1]}${checked ? "x" : " "}${match[3]}${match[4] ?? ""}`;
  const nextContent = lines.join(newline);
  const tempPath = tempWritePath(filePath);
  const originalHash = hashContent(original);
  const nextHash = hashContent(nextContent);

  await writeFile(tempPath, nextContent, "utf8");
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await cleanupTemp(tempPath);
    throw error;
  }

  try {
    const written = await readFile(filePath, "utf8");
    if (hashContent(written) !== nextHash) {
      await writeFile(filePath, original, "utf8");
      throw new Error("Write verification failed: content mismatch. Original restored.");
    }
  } catch (error) {
    if (String((error as Error).message).includes("content mismatch")) {
      throw error;
    }
    await writeFile(filePath, original, "utf8");
    throw error;
  }

  if (hashContent(original) !== originalHash) {
    // no-op: the original content hash is captured for auditability and parity with the plan.
  }

  return { ok: true, changed: true, checked };
}

async function cleanupTemp(tempPath: string): Promise<void> {
  try {
    await unlink(tempPath);
  } catch {
    // best effort cleanup
  }
}

function tempWritePath(filePath: string): string {
  const dir = dirname(filePath);
  const base = filePath.split(/[\\/]/).pop() ?? "file";
  return join(dir, `${base}.tmp`);
}

function hashContent(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeTaskText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
