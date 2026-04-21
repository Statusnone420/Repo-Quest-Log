import { describe, expect, it } from "vitest";

import { renderDesktopHtml } from "../src/desktop/render.js";
import type { QuestState } from "../src/engine/types.js";

describe("renderDesktopHtml", () => {
  it("renders the desktop HUD shell from QuestState", () => {
    const html = renderDesktopHtml(sampleState());

    expect(html).toContain("repo quest log");
    expect(html).toContain("Ship v0.1");
    expect(html).toContain("Resume where you left off");
    expect(html).toContain("desktop-preview.html");
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
    next: [],
    blocked: [],
    agents: [
      {
        id: "codex",
        name: "Codex",
        file: "AGENTS.md",
        role: "Implementer",
        area: "src/**",
        objective: "Ship the first desktop shell",
        constraints: [],
        status: "working",
      },
    ],
    recentChanges: [{ file: "PLAN.md", at: "1m" }],
  };
}
