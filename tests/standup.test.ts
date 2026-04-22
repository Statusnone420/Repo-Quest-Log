import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { buildStandup, buildStandupForRepo } from "../src/engine/standup.js";
import { scanRepo } from "../src/engine/scan.js";
import type { QuestState } from "../src/engine/types.js";

describe("buildStandup", () => {
  it("returns the strict markdown format and json shape", () => {
    const result = buildStandup(sampleState(), {
      now: new Date("2026-04-22T16:00:00.000Z"),
      completedItems: [
        { text: "Finish export helper", doc: "PLAN.md", completedAt: "2026-04-22T13:00:00.000Z" },
      ],
    });

    expect(result.markdown).toBe([
      "## Standup — 2026-04-22",
      "**Done**",
      "- Finish export helper (PLAN.md)",
      "**Working on**",
      "- Wire the desktop button (PLAN.md)",
      "**Changed**",
      "- src/web/render.ts (+5 -2)",
    ].join("\n"));
    expect(result.json).toEqual({
      date: "2026-04-22",
      since: "today",
      done: [{ text: "Finish export helper", doc: "PLAN.md" }],
      workingOn: [{ text: "Wire the desktop button", doc: "PLAN.md" }],
      changed: [{ file: "src/web/render.ts", diff: "+5 -2" }],
    });
  });

  it("renders empty sections without crashing", () => {
    const result = buildStandup(emptyState(), {
      now: new Date("2026-04-22T16:00:00.000Z"),
      completedItems: [],
    });

    expect(result.markdown).toBe([
      "## Standup — 2026-04-22",
      "**Done**",
      "- none",
      "**Working on**",
      "- none",
      "**Changed**",
      "- none",
    ].join("\n"));
    expect(result.json).toEqual({
      date: "2026-04-22",
      since: "today",
      done: [],
      workingOn: [],
      changed: [],
    });
  });
});

describe("buildStandupForRepo", () => {
  it("extracts completed items from tracked sections and filters by since", async () => {
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
          "- [x] verify the json output",
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
      await writeFile(join(root, "AGENTS.md"), "# Agents\n", "utf8");

      const state = await scanRepo(root);
      const result = await buildStandupForRepo(root, state, {
        since: "today",
        now: new Date(),
      });

      expect(result.markdown).toContain("## Standup —");
      expect(result.markdown).toContain("**Done**");
      expect(result.markdown).toContain("- finish the export helper (PLAN.md)");
      expect(result.markdown).toContain("- verify the json output (PLAN.md)");
      expect(result.markdown).toContain("**Working on**");
      expect(result.markdown).toContain("- wire the desktop button (PLAN.md)");
      expect(result.json.done).toEqual([
        { text: "finish the export helper", doc: "PLAN.md" },
        { text: "verify the json output", doc: "PLAN.md" },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function sampleState(): QuestState {
  return {
    schemaVersion: 2,
    name: "Repo Quest Log",
    branch: "main",
    lastScan: "2026-04-22T16:00:00.000Z",
    scannedFiles: ["PLAN.md", "STATE.md"],
    mission: "Keep repo intent legible.",
    objective: {
      title: "Ship standup export",
      doc: "PLAN.md",
      line: 4,
      progress: { done: 1, total: 3 },
    },
    activeQuest: {
      title: "Ship standup export",
      doc: "PLAN.md",
      line: 4,
      progress: { done: 1, total: 3 },
    },
    resumeNote: {
      task: "Wire the desktop button",
      doc: "PLAN.md",
      since: "just now",
      lastTouched: "src/web/render.ts",
    },
    now: [
      { id: "1", text: "Wire the desktop button", doc: "PLAN.md", confidence: 0.92, agent: "codex" },
    ],
    next: [],
    blocked: [],
    agents: [],
    recentChanges: [{ file: "src/web/render.ts", at: "14m", diff: "+5 -2" }],
    decisions: [],
    agentActivity: [],
    config: { writeback: false, prompts: { dir: "~/.repolog/prompts" } },
  };
}

function emptyState(): QuestState {
  return {
    ...sampleState(),
    now: [],
    recentChanges: [],
  };
}
