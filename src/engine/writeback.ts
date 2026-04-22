import { readFile, writeFile } from "node:fs/promises";

export interface ChecklistToggleResult {
  ok: boolean;
  changed: boolean;
  checked?: boolean;
  reason?: string;
}

export async function toggleChecklistItem(
  filePath: string,
  line: number,
  expectedText: string,
  nextChecked?: boolean,
): Promise<ChecklistToggleResult> {
  if (!Number.isInteger(line) || line < 1) {
    return { ok: false, changed: false, reason: "invalid line number" };
  }

  const raw = await readFile(filePath, "utf8");
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
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
    return { ok: false, changed: false, reason: "task text changed" };
  }

  const currentChecked = (match[2] ?? " ").toLowerCase() === "x";
  const checked = typeof nextChecked === "boolean" ? nextChecked : !currentChecked;

  if (checked === currentChecked) {
    return { ok: true, changed: false, checked: currentChecked };
  }

  lines[line - 1] = `${match[1]}${checked ? "x" : " "}${match[3]}${match[4] ?? ""}`;
  await writeFile(filePath, lines.join(newline), "utf8");

  return { ok: true, changed: true, checked };
}

function normalizeTaskText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
