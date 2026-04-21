import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeQuestState } from "../src/engine/normalize.js";
import type { ParsedDoc, ParsedSection } from "../src/engine/types.js";

const fixtureRoot = join(process.cwd(), "tests", "fixtures", "healthy");

describe("normalizeQuestState", () => {
  it("maps the healthy fixture into a QuestState shape", async () => {
    const plan = await readFile(join(fixtureRoot, "PLAN.md"), "utf8");
    const readme = await readFile(join(fixtureRoot, "README.md"), "utf8");

    const state = normalizeQuestState(
      [
        {
          file: "PLAN.md",
          modifiedAt: "2026-04-21T16:00:00.000Z",
          sections: [
            section("Mission", 2, 2, [
              "Build a tiny fixture repo used to test Repo Quest Log's normalizer.",
            ]),
            section("Active Quest", 5, 2, ["Land task 3 of PLAN.md"]),
            section("Now", 8, 2, [], [
              checklist("Write snapshot test against this fixture", false, 9),
              checklist("Document the expected output", false, 10),
            ]),
            section("Next", 12, 2, [], [
              checklist("Add a messy fixture for heuristic-mode tests", false, 13),
              checklist("Add a frontmatter-heavy fixture for structured-mode tests", false, 14),
            ]),
            section("Blocked", 16, 2, ["waiting on test infra choice"], [
              checklist("Decide whether to inline fixtures or load from disk", false, 17),
            ]),
          ],
        },
        {
          file: "README.md",
          modifiedAt: "2026-04-21T16:10:00.000Z",
          sections: [],
        },
      ] satisfies ParsedDoc[],
      {
        repoRoot: fixtureRoot,
        repoName: "healthy-fixture",
        branch: "feat/tui-hud",
        lastScan: "just now",
        lastTouchedFile: "PLAN.md",
        recentChanges: [
          { file: "PLAN.md", at: "2m" },
          { file: "README.md", at: "5m" },
        ],
      },
    );

    expect(plan).toBeDefined();
    expect(state.schemaVersion).toBe(1);
    expect(state.name).toBe("healthy-fixture");
    expect(state.branch).toBe("feat/tui-hud");
    expect(state.scannedFiles).toEqual(["PLAN.md", "README.md"]);
    expect(state.mission).toBe("Build a tiny fixture repo used to test Repo Quest Log's normalizer.");
    expect(state.activeQuest).toEqual({
      title: "Land task 3 of PLAN.md",
      doc: "PLAN.md",
      line: 5,
      progress: { done: 0, total: 0 },
    });
    expect(state.now.map((task) => task.text)).toEqual([
      "Write snapshot test against this fixture",
      "Document the expected output",
    ]);
    expect(state.next.map((task) => task.text)).toEqual([
      "Add a messy fixture for heuristic-mode tests",
      "Add a frontmatter-heavy fixture for structured-mode tests",
    ]);
    expect(state.blocked).toEqual([
      expect.objectContaining({
        text: "Decide whether to inline fixtures or load from disk",
        reason: "waiting on test infra choice",
        since: expect.any(String),
      }),
    ]);
    expect(state.resumeNote).toEqual(
      expect.objectContaining({
        task: "Write snapshot test against this fixture",
        doc: "PLAN.md",
        lastTouched: "PLAN.md",
      }),
    );
    expect(state.recentChanges.map((change) => change.file)).toEqual(["PLAN.md", "README.md"]);
    expect(plan.length).toBeGreaterThan(0);
    expect(readme.length).toBeGreaterThan(0);
  });
});

function section(
  heading: string,
  line: number,
  depth: number,
  paragraphs: string[] = [],
  checklistItems: ParsedSection["checklistItems"] = [],
): ParsedSection {
  return {
    heading,
    line,
    depth,
    paragraphs,
    checklistItems,
    children: [],
  };
}

function checklist(text: string, checked: boolean, line: number) {
  return { text, checked, line };
}
