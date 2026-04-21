import { describe, expect, it } from "vitest";

import { renderDesktopHtml, renderVSCodeHtml } from "../src/web/render.js";
import type { QuestState } from "../src/engine/types.js";

describe("web renderers", () => {
  it("renders a live-bridge desktop document", () => {
    const html = renderDesktopHtml(sampleState(), { liveBridge: "desktop" });

    expect(html).toContain("repo quest log");
    expect(html).toContain("Resume where you left off");
    expect(html).toContain("window.repologDesktop");
    expect(html).toContain("data-copy-context=");
    expect(html).toContain('data-ui-action="refresh"');
    expect(html).toContain("--rql-density");
    expect(html).toContain("@media (max-width: 1099px)");
    expect(html).toContain("@media (max-height: 600px)");
    expect(html).toContain("data-palette");
    expect(html).toContain("Objective");
    expect(html).toContain("Resume for Claude Code");
  });

  it("renders a VS Code panel document", () => {
    const html = renderVSCodeHtml(sampleState(), { liveBridge: "vscode" });

    expect(html).toContain("Repo Quest Log");
    expect(html).toContain("Repo Quest Log Panel");
    expect(html).toContain("repolog:replaceHtml");
    expect(html).toContain("data-open-doc=");
    expect(html).toContain("change-spark");
    expect(html).toContain("@media (max-width: 480px)");
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
      { id: "2", text: "Wire VS Code extension", doc: "PLAN.md", confidence: 1, agent: "codex" },
    ],
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
    recentChanges: [{ file: "PLAN.md", at: "1m", diff: "+3 -1" }],
    decisions: [],
  };
}
