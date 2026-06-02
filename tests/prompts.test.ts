import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildContextPrompt,
  buildPromptPresets,
  loadPromptPresets,
  renderTemplate,
} from "../src/engine/prompts.js";
import type { QuestState } from "../src/engine/types.js";

const createdDirs: string[] = [];

afterEach(async () => {
  // leave tmp dirs to OS cleanup; no-op
  createdDirs.length = 0;
});

describe("prompt helpers", () => {
  it("builds the shared resume context and provider-neutral handoff presets", () => {
    const state = sampleState();

    expect(buildContextPrompt(state)).toContain("Objective: Ship v0.1");

    const presets = buildPromptPresets(state);
    expect(presets).toHaveLength(6);
    expect(presets.map((preset) => preset.label)).toEqual([
      "Resume current work",
      "Review changes",
      "Explain recent activity",
      "Repair repo docs",
      "Brief fresh session",
      "Daily standup",
    ]);
    expect(presets[0]?.source).toBe("builtin");

    const serialized = JSON.stringify(presets);
    expect(serialized).not.toContain("Resume for Claude Code");
    expect(serialized).not.toContain("Resume for Codex");
    expect(serialized).not.toContain("Resume for Gemini");
    expect(serialized).not.toContain("Claude planner");
    expect(serialized).not.toContain("Codex implementer");
    expect(serialized).not.toContain("Gemini reviewer");
  });

  it("can include app-level Personal Agent Guide text without repo writes", () => {
    const presets = buildPromptPresets(sampleState(), {
      personalAgentGuide: "Think before coding. Keep changes surgical.",
      includePersonalGuideDefault: true,
      includeRepoAgentDocsDefault: true,
      includeRecentActivityDefault: true,
    });

    const resume = presets.find((preset) => preset.id === "resume-current-work");

    expect(resume?.body).toContain("Personal Agent Guide");
    expect(resume?.body).toContain("Think before coding. Keep changes surgical.");
    expect(resume?.body).toContain("Instruction sources");
    expect(resume?.body).toContain("AGENTS.md");
  });

  it("does not paste Blocked: None as a real blocker", () => {
    const state = sampleState();
    state.blocked = [{
      id: "blocked-none",
      text: "None",
      reason: "None",
      since: "11d",
      doc: "PLAN.md",
      confidence: 1,
    }];

    const bodies = buildPromptPresets(state).map((preset) => preset.body).join("\n---\n");

    expect(bodies).toContain("No active blockers.");
    expect(bodies).toContain("Blocked:\n(none)");
    expect(bodies).not.toContain("waiting on None");
  });

  it("renders template variables against QuestState", () => {
    const state = sampleState();
    const body = renderTemplate(
      "Repo {{name}} on {{branch}}\nObjective: {{objective.title}} ({{objective.done}}/{{objective.total}})\nNow:\n{{now}}",
      state,
    );
    expect(body).toContain("Repo Repo Quest Log on main");
    expect(body).toContain("Objective: Ship v0.1 (1/7)");
    expect(body).toContain("1. Wire desktop shell (PLAN.md)");
  });

  it("does not render Blocked: None in custom prompt templates", () => {
    const state = sampleState();
    state.blocked = [{
      id: "blocked-none",
      text: "None",
      reason: "None",
      since: "11d",
      doc: "PLAN.md",
      confidence: 1,
    }];

    const body = renderTemplate("Blocked:\n{{blocked}}", state);

    expect(body).toBe("Blocked:\n(none)");
    expect(body).not.toContain("waiting on None");
  });

  it("loads user and repo prompt overrides and repo wins over user", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-prompts-root-"));
    const userDir = await mkdtemp(join(tmpdir(), "repolog-prompts-user-"));
    createdDirs.push(root, userDir);

    const repoDir = join(root, ".repolog", "prompts");
    await mkdir(repoDir, { recursive: true });

    await writeFile(
      join(userDir, "resume-current-work.md"),
      "---\nid: resume-current-work\nlabel: User Resume Override\nsub: x\nglyph: R\nkeywords: resume\n---\nFrom user",
      "utf8",
    );
    await writeFile(
      join(userDir, "custom.md"),
      "---\nid: custom\nlabel: Custom Only\nsub: y\nglyph: K\nkeywords: custom\n---\nHello {{name}}",
      "utf8",
    );
    await writeFile(
      join(repoDir, "resume-current-work.md"),
      "---\nid: resume-current-work\nlabel: Repo Resume Override\nsub: x\nglyph: R\nkeywords: resume\n---\nFrom repo",
      "utf8",
    );

    const presets = await loadPromptPresets(sampleState(), {
      rootDir: root,
      userPromptDir: userDir,
    });

    const resume = presets.find((p) => p.id === "resume-current-work");
    expect(resume?.label).toBe("Repo Resume Override");
    expect(resume?.source).toBe("repo");
    expect(resume?.body).toBe("From repo");

    const custom = presets.find((p) => p.id === "custom");
    expect(custom?.source).toBe("user");
    expect(custom?.body).toBe("Hello Repo Quest Log");
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
        id: "agents",
        name: "Agent Guidance",
        file: "AGENTS.md",
        role: "Shared coding guidance",
        area: "repo/**",
        objective: "Keep agents aligned",
        constraints: [],
        status: "active",
      },
    ],
    recentChanges: [{ file: "PLAN.md", at: "1m", diff: "+3 -1" }],
    decisions: [],
  };
}
