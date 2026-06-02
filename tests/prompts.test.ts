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

  it("builds useful handoff prompts with concrete first actions", () => {
    const state = sampleState();
    state.now = [];
    state.recentActivity = [];

    const presets = buildPromptPresets(state);
    const resume = presets.find((preset) => preset.id === "resume-current-work");
    const review = presets.find((preset) => preset.id === "review-changes");
    const explain = presets.find((preset) => preset.id === "explain-recent-activity");
    const repair = presets.find((preset) => preset.id === "repair-repo-docs");
    const brief = presets.find((preset) => preset.id === "brief-fresh-session");
    const standup = presets.find((preset) => preset.id === "standup");

    for (const preset of presets) {
      expect(preset.body, preset.id).toContain("Repo Quest Log");
      expect(preset.body, preset.id).not.toContain("Continue from \"");
      expect(preset.body, preset.id).not.toContain("what likely happened");
    }
    expect(resume?.body).toContain("Start here:");
    expect(resume?.body).toContain("Read the source docs above");
    expect(resume?.body).toContain("No current task is set");
    expect(review?.body).toContain("Review contract");
    expect(review?.body).toContain("Findings first");
    expect(explain?.body).toContain("plain-English timeline");
    expect(repair?.body).toContain("Propose exact markdown edits");
    expect(brief?.body).toContain("next concrete action");
    expect(standup?.body).toContain("Standup contract");
    expect(standup?.body).toContain("Risks or asks");
  });

  it("makes every built-in handoff operator-grade instead of generic continuation text", () => {
    const state = sampleState();
    state.recentActivity = [];

    const presets = buildPromptPresets(state);

    for (const preset of presets) {
      expect(preset.body, preset.id).toContain("Situation:");
      expect(preset.body, preset.id).toContain("Start here:");
      expect(preset.body, preset.id).toContain("Stop and ask if:");
      expect(preset.body, preset.id).toContain("Output:");
      expect(preset.body, preset.id).toContain("Recent evidence:");
      expect(preset.body, preset.id).not.toContain("(0/0)");
      expect(preset.body, preset.id).not.toMatch(/Continue from ".+"/);
    }

    expect(presets.find((preset) => preset.id === "resume-current-work")?.body).toContain("recover the real next action");
    expect(presets.find((preset) => preset.id === "review-changes")?.body).toContain("Do not edit files during this handoff");
    expect(presets.find((preset) => preset.id === "explain-recent-activity")?.body).toContain("plain-English timeline");
    expect(presets.find((preset) => preset.id === "repair-repo-docs")?.body).toContain("Do not write repo files unless the human explicitly approves");
    expect(presets.find((preset) => preset.id === "brief-fresh-session")?.body).toContain("onboard a brand-new agent");
    expect(presets.find((preset) => preset.id === "standup")?.body).toContain("short operator update");
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

  it("honors selected handoff instruction sources and skips archived docs", () => {
    const state = sampleState();
    state.recentActivity = [{ file: "src/web/render.ts", kind: "change", ts: Date.now(), outsideScope: false }];
    state.agents.push({
      id: "old-claude",
      name: "Claude Archive",
      file: "CLAUDE.md",
      role: "Historical notes",
      area: "docs/**",
      objective: "Reference only",
      constraints: [],
      status: "archived",
    });

    const guideOnly = buildPromptPresets(state, {
      personalAgentGuide: "Think before coding.",
      instructionSourceSelection: ["personal-agent-guide"],
      includePersonalGuideDefault: false,
      includeRepoAgentDocsDefault: true,
      includeRecentActivityDefault: true,
    });
    const guideBody = guideOnly.find((preset) => preset.id === "resume-current-work")?.body ?? "";

    expect(guideBody).toContain("Personal Agent Guide");
    expect(guideBody).toContain("Think before coding.");
    expect(guideBody).not.toContain("Recent activity:");
    expect(guideBody).not.toContain("Instruction sources:");
    expect(guideBody).not.toContain("CLAUDE.md");

    const docsAndActivity = buildPromptPresets(state, {
      instructionSourceSelection: ["repo-agent-docs", "recent-activity"],
      includePersonalGuideDefault: true,
      includeRepoAgentDocsDefault: false,
      includeRecentActivityDefault: false,
    });
    const docsBody = docsAndActivity.find((preset) => preset.id === "review-changes")?.body ?? "";

    expect(docsBody).toContain("Instruction sources:");
    expect(docsBody).toContain("AGENTS.md");
    expect(docsBody).toContain("Recent activity:");
    expect(docsBody).toContain("CHANGE src/web/render.ts");
    expect(docsBody).not.toContain("CLAUDE.md");
    expect(docsBody).not.toContain("Personal Agent Guide:");
  });

  it("keeps archived docs out of source doc lists and custom template agents", () => {
    const state = sampleState();
    state.resumeNote.lastTouched = "CLAUDE.md";
    state.agents.push({
      id: "old-claude",
      name: "Claude Archive",
      file: "CLAUDE.md",
      role: "Historical notes",
      area: "docs/**",
      objective: "Reference only",
      constraints: [],
      status: "archived",
    });

    const resume = buildPromptPresets(state).find((preset) => preset.id === "resume-current-work")?.body ?? "";
    const custom = renderTemplate("Agents:\n{{agents}}\nLast: {{resume.lastTouched}}", state);
    const context = buildContextPrompt(state);

    expect(resume).not.toContain("Source docs to inspect:\n- CLAUDE.md");
    expect(custom).not.toContain("Claude Archive");
    expect(custom).toContain("Last: PLAN.md");
    expect(context).not.toContain("Please read CLAUDE.md");
  });

  it("keeps archived objective docs out of context prompt fallbacks", () => {
    const state = sampleState();
    state.activeQuest.doc = "GEMINI.md";
    state.resumeNote.doc = "CLAUDE.md";
    state.resumeNote.lastTouched = "CLAUDE.md";
    state.agents = [
      {
        id: "old-gemini",
        name: "Gemini Archive",
        file: "GEMINI.md",
        role: "Historical notes",
        area: "docs/**",
        objective: "Reference only",
        constraints: [],
        status: "archived",
      },
      {
        id: "old-claude",
        name: "Claude Archive",
        file: "CLAUDE.md",
        role: "Historical notes",
        area: "docs/**",
        objective: "Reference only",
        constraints: [],
        status: "archived",
      },
    ];

    const context = buildContextPrompt(state);
    const resume = buildPromptPresets(state).find((preset) => preset.id === "resume-current-work")?.body ?? "";

    expect(context).not.toContain("GEMINI.md");
    expect(context).not.toContain("CLAUDE.md");
    expect(context).toContain("PLAN.md");
    expect(resume).not.toContain("GEMINI.md");
    expect(resume).not.toContain("CLAUDE.md");
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
