import { describe, expect, it } from "vitest";

import { formatStaticFrame } from "../src/tui/App.js";
import type { QuestState } from "../src/engine/types.js";

describe("formatStaticFrame", () => {
  it("renders the desktop-style top strip with Objective copy", () => {
    const frame = formatStaticFrame(sampleState(), { columns: 160, rows: 40, interactive: true });

    expect(frame).toContain("repo quest log · Repo Quest Log / main");
    expect(frame).toContain("MISSION");
    expect(frame).toContain("OBJECTIVE");
    expect(frame).toContain("RESUME");
    expect(frame).not.toContain("┌─ Quest ");
    expect(frame).toContain("[ctrl+k] palette");
  });

  it("uses compact task rows with confidence dots and agent glyphs", () => {
    const frame = formatStaticFrame(sampleState(), { columns: 160, rows: 40 });

    expect(frame).toContain("••• 01 Wire desktop shell [CX] PLAN.md");
    expect(frame).toContain("CL Claude");
  });
});

function sampleState(): QuestState {
  return {
    schemaVersion: 1,
    name: "Repo Quest Log",
    branch: "main",
    lastScan: "2026-04-21T17:19:15.779Z",
    scannedFiles: ["PLAN.md", "STATE.md"],
    mission: "A local-first CLI + TUI that makes repo intent legible at a glance.",
    activeQuest: {
      title: "Ship v0.1",
      doc: "PLAN.md",
      line: 6,
      progress: { done: 1, total: 7 },
    },
    resumeNote: {
      task: "Wire desktop shell",
      doc: "PLAN.md",
      since: "just now",
      lastTouched: "desktop-preview.html",
      thought: "About to render the HUD from QuestState.",
    },
    now: [
      { id: "1", text: "Wire desktop shell", doc: "PLAN.md", confidence: 1, agent: "codex" },
    ],
    next: [
      { id: "2", text: "Wire VS Code extension", doc: "PLAN.md", confidence: 0.5, agent: "codex" },
    ],
    blocked: [],
    agents: [
      {
        id: "claude",
        name: "Claude",
        file: "CLAUDE.md",
        role: "Planner",
        area: "docs/**",
        objective: "Keep plans short",
        constraints: [],
        status: "active",
      },
    ],
    recentChanges: [{ file: "PLAN.md", at: "1m", diff: "+3 -1" }],
    decisions: [],
  };
}
