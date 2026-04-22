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
  it("builds the shared resume context and prompt presets", () => {
    const state = sampleState();

    expect(buildContextPrompt(state)).toContain("Objective: Ship v0.1");

    const presets = buildPromptPresets(state);
    expect(presets).toHaveLength(6);
    expect(presets[0]?.label).toBe("Resume for Claude Code");
    expect(presets[0]?.source).toBe("builtin");
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

  it("loads user and repo prompt overrides and repo wins over user", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-prompts-root-"));
    const userDir = await mkdtemp(join(tmpdir(), "repolog-prompts-user-"));
    createdDirs.push(root, userDir);

    const repoDir = join(root, ".repolog", "prompts");
    await mkdir(repoDir, { recursive: true });

    await writeFile(
      join(userDir, "resume-claude.md"),
      "---\nid: resume-claude\nlabel: User Claude Override\nsub: x\nglyph: C\nkeywords: claude\n---\nFrom user",
      "utf8",
    );
    await writeFile(
      join(userDir, "custom.md"),
      "---\nid: custom\nlabel: Custom Only\nsub: y\nglyph: K\nkeywords: custom\n---\nHello {{name}}",
      "utf8",
    );
    await writeFile(
      join(repoDir, "resume-claude.md"),
      "---\nid: resume-claude\nlabel: Repo Claude Override\nsub: x\nglyph: C\nkeywords: claude\n---\nFrom repo",
      "utf8",
    );

    const presets = await loadPromptPresets(sampleState(), {
      rootDir: root,
      userPromptDir: userDir,
    });

    const claude = presets.find((p) => p.id === "resume-claude");
    expect(claude?.label).toBe("Repo Claude Override");
    expect(claude?.source).toBe("repo");
    expect(claude?.body).toBe("From repo");

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
