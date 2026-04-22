import { describe, expect, it } from "vitest";
import { cp, rm } from "node:fs/promises";
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
    expect(html).toContain("Save settings");
    expect(html).toContain('data-config-field="excludes"');
    expect(html).toContain("Startup");
    expect(html).toContain("data-writeback-toggle");
    expect(html).toContain("Theme");
    expect(html).toContain("likely working");
    expect(html).toContain("heuristic feed");
    expect(html).toContain("source: STATE.md resume note");
    expect(html).toContain("source: PLAN.md");
    expect(html).toContain("window.repologDesktop");
    expect(html).toContain("data-copy-context=");
    expect(html).toContain('data-ui-action="refresh"');
    expect(html).toContain("--rql-density");
    expect(html).toContain("@media (max-width: 1099px)");
    expect(html).toContain("@media (max-height: 600px)");
    expect(html).toContain("data-palette");
    expect(html).toContain("Objective");
    expect(html).toContain("Resume for Claude Code");
    expect(html).toContain("Standup");
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
    expect(html).toContain("CLAUDE.md");
    expect(html).toContain("Create PLAN.md");
  });

  it("renders the setup card from the healthy fixture without throwing", async () => {
    const root = await copyFixture("healthy");

    try {
      const state = await scanRepo(root);
      const html = renderDesktopHtml(state, { liveBridge: "desktop" });

      expect(html).toContain("Settings");
      expect(html).toContain("Save settings");
      expect(html).toContain('data-ui-action="save-config"');
      expect(html).toContain('data-ui-action="init-state"');
      expect(html).toContain('data-ui-action="dismiss-wizard"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("renders the first-run setup buttons from the noisy fixture", async () => {
    const root = await copyFixture("noisy");

    try {
      const state = await scanRepo(root);
      const html = renderDesktopHtml(state, { liveBridge: "desktop" });

      expect(html).toContain('data-ui-action="init-state"');
      expect(html).toContain('data-ui-action="init-config"');
      expect(html).toContain('data-ui-action="dismiss-wizard"');
      expect(html).toContain('data-ui-action="save-config"');
      expect(html).toContain("Create STATE.md");
      expect(html).toContain("Create .repolog.json");
      expect(html).toContain("Skip for now");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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
