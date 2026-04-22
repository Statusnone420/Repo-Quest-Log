import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { toggleChecklistItem } from "../src/engine/writeback.js";

describe("toggleChecklistItem", () => {
  it("toggles a checklist line and preserves LF endings", async () => {
    const root = join(tmpdir(), `repo-quest-log-writeback-${Date.now()}`);
    const file = join(root, "PLAN.md");
    await mkdir(root, { recursive: true });
    await writeFile(file, "# Plan\n- [ ] ship the shell\n", "utf8");

    try {
      const result = await toggleChecklistItem(file, 2, "ship the shell");
      expect(result.ok).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.checked).toBe(true);
      expect(await readFile(file, "utf8")).toBe("# Plan\n- [x] ship the shell\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses to edit when the source line text changed", async () => {
    const root = join(tmpdir(), `repo-quest-log-writeback-${Date.now()}-stale`);
    const file = join(root, "PLAN.md");
    await mkdir(root, { recursive: true });
    await writeFile(file, "# Plan\n- [ ] ship the shell now\n", "utf8");

    try {
      const result = await toggleChecklistItem(file, 2, "ship the shell");
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("task text changed");
      expect(await readFile(file, "utf8")).toBe("# Plan\n- [ ] ship the shell now\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves CRLF when toggling back to unchecked", async () => {
    const root = join(tmpdir(), `repo-quest-log-writeback-${Date.now()}-crlf`);
    const file = join(root, "PLAN.md");
    await mkdir(root, { recursive: true });
    await writeFile(file, "# Plan\r\n- [x] ship the shell\r\n", "utf8");

    try {
      const result = await toggleChecklistItem(file, 2, "ship the shell", false);
      expect(result.ok).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.checked).toBe(false);
      expect(await readFile(file, "utf8")).toBe("# Plan\r\n- [ ] ship the shell\r\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
