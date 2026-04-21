import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { extractAgentProfiles } from "../src/engine/agents.js";
import { parseRepo } from "../src/engine/parse.js";

const tempDirs: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

describe("parseRepo", () => {
  it("extracts headings, paragraphs, checklist items, and agent profiles", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-parse-"));
    tempDirs.push(root);
    await mkdir(join(root, "docs"), { recursive: true });

    await writeFile(
      join(root, "PLAN.md"),
      [
        "# PLAN.md",
        "",
        "## Mission",
        "Make repo intent legible.",
        "",
        "## Now",
        "- [ ] Ship scan command",
        "- [x] Draft schema",
        "",
        "## Blocked",
        "- [ ] Pick desktop shell",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      join(root, "AGENTS.md"),
      [
        "## Role",
        "**Implementer.**",
        "",
        "## Owned Areas",
        "- src/engine/**",
        "",
        "## Current Objective",
        "Land the parser.",
        "",
        "## Constraints",
        "- Local only",
      ].join("\n"),
      "utf8",
    );

    const docs = await parseRepo(root);
    const plan = docs.find((doc) => doc.file === "PLAN.md");

    expect(plan?.sections[0]?.heading).toBe("PLAN.md");
    expect(plan?.sections[0]?.children[0]?.heading).toBe("Mission");
    expect(plan?.sections[0]?.children[0]?.paragraphs[0]).toBe("Make repo intent legible.");
    expect(plan?.sections[0]?.children[1]?.checklistItems).toEqual([
      { text: "Ship scan command", checked: false, line: 7 },
      { text: "Draft schema", checked: true, line: 8 },
    ]);

    const agents = extractAgentProfiles(docs);
    expect(agents).toEqual([
      expect.objectContaining({
        id: "codex",
        name: "Codex",
        role: "Implementer.",
        area: "src/engine/**",
        objective: "Land the parser.",
        constraints: ["Local only"],
      }),
    ]);
  });
});
