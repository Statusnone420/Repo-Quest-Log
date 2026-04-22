import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { buildStandupMarkdown } from "../src/engine/standup.js";
import { scanRepo } from "../src/engine/scan.js";

describe("buildStandupMarkdown", () => {
  it("copies newly checked items and current now items into markdown", async () => {
    const root = join(tmpdir(), `repo-quest-log-standup-${Date.now()}`);
    await mkdir(root, { recursive: true });
    try {
      await writeFile(
        join(root, "PLAN.md"),
        [
          "# Mission",
          "Keep the repo legible.",
          "",
          "## Objective",
          "Ship standup export",
          "",
          "## Now",
          "- [x] finish the export helper",
          "- [ ] wire the desktop button",
          "",
          "## Next",
          "- [ ] polish the clipboard message",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        join(root, "STATE.md"),
        [
          "## Resume Note",
          "Keep moving.",
        ].join("\n"),
        "utf8",
      );

      const state = await scanRepo(root);
      const markdown = await buildStandupMarkdown(root, state);

      expect(markdown).toContain("# Standup -");
      expect(markdown).toContain("## Done Today");
      expect(markdown).toContain("- [x] finish the export helper (PLAN.md:");
      expect(markdown).toContain("## Now");
      expect(markdown).toContain("- [ ] wire the desktop button (PLAN.md:");
      expect(markdown).toContain("- Branch: ");
      expect(markdown).toContain("- Objective: Ship standup export");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
