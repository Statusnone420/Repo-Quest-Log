import { describe, expect, it } from "vitest";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { renderDesktopHtml, renderVSCodeHtml } from "../src/web/render.js";
import { scanRepo } from "../src/engine/scan.js";
import type { QuestState } from "../src/engine/types.js";

describe("web renderers", () => {
  it("renders a live-bridge desktop document", () => {
    const html = renderDesktopHtml(sampleState(), { liveBridge: "desktop" });

    expect(html).toContain("repo quest log");
    expect(html).toContain("Current focus");
    expect(html).toContain("Why this matters");
    expect(html).toContain("Settings");
    expect(html).toContain("Ctrl+O");
    expect(html).toContain("Ctrl+Shift+C");
    expect(html).toContain("Prompt dir");
    expect(html).toContain("Save repo config");
    expect(html).toContain("Writes .repolog.json in this repo.");
    expect(html).toContain("App-only settings stay outside the repo.");
    expect(html).toContain("Optional repo guide");
    expect(html).toContain("Create repo guide");
    expect(html).not.toContain(">Write CHARTER.md<");
    expect(html).toContain('data-config-field="excludes"');
    expect(html).toContain("Startup");
    expect(html).toContain("data-writeback-toggle");
    expect(html).toContain("Theme");
    expect(html).toContain("Workspace Signals");
    expect(html).toContain("Agent Docs");
    expect(html).toContain("run-digest");
    expect(html).toContain("source: STATE.md resume note");
    expect(html).toContain("source: PLAN.md");
    expect(html).toContain("window.repologDesktop");
    expect(html).toContain("data-copy-context=");
    expect(html).toContain('data-ui-action="refresh"');
    expect(html).toContain("--rql-density");
    expect(html).toContain("@media (max-width: 1180px)");
    expect(html).toContain("@media (max-height: 640px)");
    expect(html).toContain("data-palette");
    expect(html).toContain("Objective");
    expect(html).toContain("Resume for Claude Code");
    expect(html).toContain("Standup");
  });

  it("renders settings as focused sections with analyze fixes before the prompt", () => {
    const html = renderDesktopHtml(sampleState(), { liveBridge: "desktop" });

    expect(html).toContain("Overview<small>Analyze</small>");
    expect(html).toContain("Repo config<small>Watcher and write-back</small>");
    expect(html).toContain("Prompts<small>Palette and standup</small>");
    expect(html).toContain("Digest<small>OpenRouter</small>");
    expect(html).toContain("Appearance<small>Theme, density, font</small>");
    expect(html).toContain("No network call. This reads repo context locally and builds a repair prompt.");
    expect(html).toContain("Digest summarizes the current repo state with your OpenRouter key.");
    expect(html.indexOf("Top fixes first")).toBeLessThan(html.indexOf("Generated repair prompt"));
    expect(html).toContain("split(/\\s+/)");
    expect(html).not.toContain("split(/s+/)");
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

  it("renders the first-run empty state when no markdown files match", () => {
    const html = renderDesktopHtml({
      ...sampleState(),
      scannedFiles: [],
      mission: "",
      now: [],
      next: [],
      blocked: [],
      recentChanges: [],
    });

    expect(html).toContain('class="empty-state"');
    expect(html).toContain("PLAN.md");
    expect(html).toContain("STATE.md");
    expect(html).toContain("AGENTS.md");
    expect(html).not.toContain("CLAUDE.md");
    expect(html).toContain("Create PLAN.md");
  });

  it("does not render the setup card from the healthy fixture", async () => {
    const root = await copyFixture("healthy");

    try {
      const state = await scanRepo(root);
      const html = renderDesktopHtml(state, { liveBridge: "desktop" });

      expect(html).toContain("Settings");
      expect(html).toContain("Save repo config");
      expect(html).toContain('data-ui-action="save-config"');
      expect(html).not.toContain('<div class="settings-panel-card" data-setup-card>');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("renders the first-run setup buttons from the noisy fixture", async () => {
    const root = await copyFixture("noisy");

    try {
      const state = await scanRepo(root);
      state.scannedFiles = state.scannedFiles.filter((file) => !/PLAN\.md$/i.test(file));
      const html = renderDesktopHtml(state, { liveBridge: "desktop" });

      expect(html).toContain('data-ui-action="init-plan"');
      expect(html).toContain('data-ui-action="init-state"');
      expect(html).toContain('data-ui-action="init-config"');
      expect(html).toContain('data-ui-action="dismiss-wizard"');
      expect(html).toContain('data-ui-action="save-config"');
      expect(html).toContain("Create PLAN.md");
      expect(html).toContain("Create STATE.md");
      expect(html).toContain("Create .repolog.json");
      expect(html).toContain("Skip for now");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("renders the normal HUD with inline help for generic repos", async () => {
    const root = join(tmpdir(), `repo-quest-log-generic-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Widget API\n\nA small TypeScript service for tracking warehouse widgets.\n", "utf8");
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "widget-api", description: "Tracks warehouse widgets" }, null, 2), "utf8");
    await writeFile(join(root, "src", "index.ts"), "export const widget = true;\n", "utf8");

    try {
      const state = await scanRepo(root);
      const html = renderDesktopHtml(state, { liveBridge: "desktop" });

      expect(html).toContain('class="header-strip"');
      expect(html).toContain('class="board"');
      expect(html).toContain("Objective");
      expect(html).toContain("Now");
      expect(html).toContain("Agent Docs");
      expect(html).toContain("Repo Context");
      expect(html).not.toContain("onboarding-dashboard");
      expect(html).not.toContain("This repo is not agent-ready yet");
      expect(html).not.toContain("Docs not initialized");
      expect(html).toContain("TypeScript");
      expect(html).toContain("widget-api");
      expect(html).toContain("Good raw context, missing agent-ready structure.");
      expect(html).toContain("Add planning docs when you want better resume prompts.");
      expect(html).toContain("Generate setup prompt");
      expect(html).toContain("PLAN.md");
      expect(html).toContain("STATE.md");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("renders the normal HUD for source-only repos with no markdown docs", async () => {
    const root = join(tmpdir(), `repo-quest-log-source-only-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "source-only-api", description: "Tracks inventory events" }, null, 2), "utf8");
    await writeFile(join(root, "src", "index.ts"), "export const service = true;\n", "utf8");

    try {
      const state = await scanRepo(root);
      const html = renderDesktopHtml(state, { liveBridge: "desktop" });

      expect(state.scannedFiles).toEqual([]);
      expect(html).toContain('class="header-strip"');
      expect(html).toContain('class="board"');
      expect(html).toContain("Repo Context");
      expect(html).toContain("source-only-api");
      expect(html).toContain("No objective set yet");
      expect(html).toContain("No current task set");
      expect(html).not.toContain('class="empty-state"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("renders the approved desktop signal surfaces without fake agent liveness", () => {
    const state = sampleState();
    state.workspaceSignals = {
      state: "Focused",
      editRate: 7,
      filesTouched: 4,
      lastEditAge: "12s ago",
      scopeDriftCount: 1,
      thrashLevel: "Medium",
      repeatedFiles: ["src/web/render.ts"],
      trend: Array.from({ length: 30 }, (_, index) => index % 5),
      scopeActive: true,
    };
    state.recentActivity = [
      { file: "src/web/render.ts", kind: "change", ts: Date.now() - 12000, outsideScope: false },
      { file: "README.md", kind: "change", ts: Date.now() - 28000, outsideScope: true },
    ];

    const html = renderDesktopHtml(state, { liveBridge: "desktop" });

    expect(html).toContain("Workspace Signals");
    expect(html).toContain("Automatic agent work mode");
    expect(html).toContain("Writing code");
    expect(html).toContain("Checking diffs");
    expect(html).toContain("Collecting context");
    expect(html).toContain("No active agent work");
    expect(html).toContain("Recent Activity");
    expect(html).toContain("Agent Docs");
    expect(html).toContain("Prompt Palette");
    expect(html).toContain("Activity timeline");
    expect(html).toContain("data-timeline-window=\"5\"");
    expect(html).toContain("data-timeline-window=\"15\"");
    expect(html).toContain("data-timeline-window=\"30\"");
    expect(html).toContain("Scope map");
    expect(html).toContain("data-ui-action=\"open-diff\"");
    expect(html).toContain("Declared role");
    expect(html).toContain("Last written task");
    expect(html).toContain("agent-health-rail");
    expect(html.indexOf("Automatic agent work mode")).toBeGreaterThan(html.indexOf("Workspace Signals"));
    expect(html).toContain("aria-current=\"true\"");
    expect(html).not.toContain("data-workspace-mode");
    expect(html).not.toContain("agent-status");
    expect(html).not.toContain(">working<");
    expect(html).not.toContain(">idle<");
  });

  it("infers reviewing from dirty files when no edits are active", () => {
    const state = sampleState();
    state.workspaceSignals = {
      state: "Quiet",
      editRate: 0,
      filesTouched: 0,
      lastEditAge: "no activity",
      scopeDriftCount: 0,
      thrashLevel: "None",
      repeatedFiles: [],
      trend: Array.from({ length: 30 }, () => 0),
      scopeActive: true,
    };
    state.recentActivity = [];
    state.gitContext = { branch: "dev", ahead: 0, behind: 0, dirtyFiles: 17, lastCommit: "abc123" };

    const html = renderDesktopHtml(state, { liveBridge: "desktop" });

    expect(html).toContain("Automatic agent work mode");
    expect(html).toContain("Reviewing 17 changed files");
    expect(html).toContain("17 dirty files ready for diff review");
    expect(html).toContain("<div class=\"mode-card\" aria-current=\"true\" title=\"Reviewing is inferred");
    expect(html).not.toContain("workspace mode:");
    expect(html).not.toContain("data-workspace-mode");
    expect(html).not.toContain("browser history");
  });

  it("does not keep building from stale spread-window activity", () => {
    const state = sampleState();
    state.workspaceSignals = {
      state: "Focused",
      editRate: 0,
      filesTouched: 3,
      lastEditAge: "7m ago",
      scopeDriftCount: 0,
      thrashLevel: "None",
      repeatedFiles: [],
      trend: Array.from({ length: 30 }, () => 0),
      scopeActive: true,
    };
    state.recentActivity = [];
    state.gitContext = { branch: "dev", ahead: 0, behind: 0, dirtyFiles: 4, lastCommit: "abc123" };

    const html = renderDesktopHtml(state, { liveBridge: "desktop" });

    expect(html).toContain("Reviewing 4 changed files");
    expect(html).not.toContain("Agent work is changing");
  });

  it("infers researching from planning context when there are no edits or diffs", () => {
    const state = sampleState();
    state.workspaceSignals = {
      state: "Quiet",
      editRate: 0,
      filesTouched: 0,
      lastEditAge: "no activity",
      scopeDriftCount: 0,
      thrashLevel: "None",
      repeatedFiles: [],
      trend: Array.from({ length: 30 }, () => 0),
      scopeActive: false,
    };
    state.recentActivity = [];
    state.recentChanges = [{ file: "PLAN.md", at: "1h", diff: "clean" }];
    state.gitContext = { branch: "dev", ahead: 0, behind: 0, dirtyFiles: 0, lastCommit: "abc123" };

    const html = renderDesktopHtml(state, { liveBridge: "desktop" });

    expect(html).toContain("<div class=\"signal-value\">Researching</div>");
    expect(html).toContain("Researching is inferred when planning context exists");
    expect(html).not.toContain("data-workspace-mode");
  });

  it("labels archived agent docs as reference docs", () => {
    const state = sampleState();
    state.agents[0]!.status = "archived";

    const html = renderDesktopHtml(state, { liveBridge: "desktop" });

    expect(html).toContain("Reference");
    expect(html).toContain("Declared role");
    expect(html).toContain("Last written task");
  });

  it("renders empty Now as an actionable current-task warning", () => {
    const html = renderDesktopHtml({ ...sampleState(), now: [] }, { liveBridge: "desktop" });

    expect(html).toContain("No current task set");
    expect(html).toContain("Add a short ## Now section");
    expect(html).toContain("- [ ] Fix the thing you are doing next");
    expect(html).toContain("Copy repair prompt");
    expect(html).toContain("Open PLAN.md");
    expect(html).not.toContain("No items yet");
  });

  it("does not treat Blocked: None as a blocker", () => {
    const html = renderDesktopHtml({
      ...sampleState(),
      blocked: [
        {
          id: "blocked-none",
          text: "None",
          doc: "PLAN.md",
          line: 62,
          confidence: 1,
          reason: "None",
          since: "just now",
        },
      ],
    }, { liveBridge: "desktop" });

    expect(html).toContain("No blockers right now");
    expect(html).not.toContain("PLAN.md:62");
  });

  it("emits desktop scripts that parse as valid JavaScript", () => {
    const html = renderDesktopHtml(sampleState(), { liveBridge: "desktop" });
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(() => new Function(script)).not.toThrow();
    }
  });
});

function sampleState(): QuestState {
  return {
    schemaVersion: 2,
    name: "Repo Quest Log",
    branch: "main",
    lastScan: "2026-04-21T17:19:15.779Z",
    scannedFiles: ["PLAN.md", "STATE.md"],
    mission: "A local-first CLI + TUI that makes repo intent legible at a glance.",
    objective: {
      title: "Ship v0.1",
      doc: "PLAN.md",
      line: 6,
      progress: { done: 1, total: 7 },
    },
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
    agentActivity: [
      { agent: "codex", file: "src/web/render.ts", at: "2m", confidence: 0.92 },
    ],
    recentChanges: [{ file: "PLAN.md", at: "1m", diff: "+3 -1" }],
    decisions: [],
    config: { writeback: false, prompts: { dir: "~/.repolog/prompts" } },
  };
}

async function copyFixture(name: "healthy" | "noisy"): Promise<string> {
  const source = join(process.cwd(), "tests", "fixtures", name);
  const target = join(tmpdir(), `repo-quest-log-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await cp(source, target, { recursive: true });
  return target;
}
