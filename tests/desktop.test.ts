import { describe, expect, it } from "vitest";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { renderDesktopHtml } from "../src/desktop/render.js";
import { resolveDesktopRepoRoot } from "../src/desktop/root.js";
import type { QuestState } from "../src/engine/types.js";

describe("renderDesktopHtml", () => {
  it("renders the desktop HUD shell from QuestState", () => {
    const html = renderDesktopHtml(sampleState(), { appVersion: "0.0.4" });

    expect(html).toContain("repo quest log");
    expect(html).toContain("v0.0.4");
    expect(html).toContain("Ship v0.1");
    expect(html).toContain("Current focus");
    expect(html).toContain("Why this matters");
    expect(html).toContain("Settings");
    expect(html).toContain("Open Repo");
    expect(html).toContain("Ctrl+O");
    expect(html).toContain("Ctrl+Shift+C");
    expect(html).toContain("Prompt dir");
    expect(html).toContain("Save settings");
    expect(html).toContain('data-config-field="watchDebounce"');
    expect(html).toContain("Startup");
    expect(html).toContain("Remember");
    expect(html).toContain("Forget");
    expect(html).toContain("data-writeback-toggle");
    expect(html).toContain("Theme");
    expect(html).toContain("likely working");
    expect(html).toContain("source: STATE.md resume note");
    expect(html).toContain("desktop-preview.html");
    expect(html).toContain("data-copy-context=");
    expect(html).toContain('data-ui-action="refresh"');
    expect(html).toContain("change-spark");
    expect(html).toContain("Standup");
  });
});

describe("desktop shell sizing", () => {
  it("opens with a window size that can fit the target 560px fallback height", async () => {
    const source = await readFile(join(process.cwd(), "apps/desktop/main.cjs"), "utf8");
    const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as {
      build?: { win?: { target?: string | string[] } };
    };

    expect(source).toContain("defaultWidth");
    expect(source).toContain("defaultHeight");
    expect(source).toContain("minWidth: 700");
    expect(source).toContain("minHeight: 560");
    expect(source).toContain("icon: appIconPath()");
    expect(source).toContain("useContentSize: true");
    expect(source).toContain("formatCodeOpenTarget");
    expect(source).toContain('spawn("code", ["-g"');
    expect(source).toContain("About Repo Quest Log");
    expect(source).toContain("setAppUserModelId");
    expect(source).toContain('require(path.join(__dirname, "package.json"))');
    expect(packageJson.build?.win?.target).toEqual(["nsis", "portable"]);
    expect(packageJson.build?.extraResources).toEqual([{ from: "build/icon.png", to: "build/icon.png" }]);
  });
});

describe("resolveDesktopRepoRoot", () => {
  it("walks up from the exe directory when no repo root argument is passed", async () => {
    const root = join(tmpdir(), `repo-quest-log-root-${Date.now()}`);
    const releaseDir = join(root, "release");
    const nestedExeDir = join(releaseDir, "win-unpacked");

    await mkdir(nestedExeDir, { recursive: true });
    await Promise.all([
      writeFile(join(root, "PLAN.md"), "# plan\n"),
      writeFile(join(root, "STATE.md"), "# state\n"),
      writeFile(join(root, "README.md"), "# readme\n"),
      writeFile(join(root, "AGENTS.md"), "# agents\n"),
    ]);

    try {
      const resolved = resolveDesktopRepoRoot({
        argv: [],
        cwd: nestedExeDir,
        execPath: join(nestedExeDir, "Repo Quest Log.exe"),
      });

      expect(resolved).toBe(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prefers a persisted lastRoot when cwd has no markers", async () => {
    const lastRoot = join(tmpdir(), `repo-quest-log-last-${Date.now()}`);
    const elsewhere = join(tmpdir(), `repo-quest-log-elsewhere-${Date.now()}`);
    await mkdir(lastRoot, { recursive: true });
    await mkdir(elsewhere, { recursive: true });
    try {
      const resolved = resolveDesktopRepoRoot({
        argv: [],
        cwd: elsewhere,
        execPath: join(elsewhere, "Repo Quest Log.exe"),
        lastRoot,
      });
      expect(resolved).toBe(lastRoot);
    } finally {
      await rm(lastRoot, { recursive: true, force: true });
      await rm(elsewhere, { recursive: true, force: true });
    }
  });

  it("accepts an explicit argv directory even without repo markers", async () => {
    const dir = join(tmpdir(), `repo-quest-log-explicit-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    try {
      const resolved = resolveDesktopRepoRoot({
        argv: [dir],
        cwd: tmpdir(),
        execPath: join(dir, "Repo Quest Log.exe"),
      });
      expect(resolved).toBe(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores an argv path that points at the release folder", async () => {
    const root = join(tmpdir(), `repo-quest-log-root-${Date.now()}`);
    const releaseDir = join(root, "release");
    const nestedExeDir = join(releaseDir, "win-unpacked");

    await mkdir(nestedExeDir, { recursive: true });
    await Promise.all([
      writeFile(join(root, "PLAN.md"), "# plan\n"),
      writeFile(join(root, "STATE.md"), "# state\n"),
      writeFile(join(root, "README.md"), "# readme\n"),
      writeFile(join(root, "AGENTS.md"), "# agents\n"),
    ]);

    try {
      const resolved = resolveDesktopRepoRoot({
        argv: [nestedExeDir],
        cwd: nestedExeDir,
        execPath: join(nestedExeDir, "Repo Quest Log.exe"),
      });

      expect(resolved).toBe(root);
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
    agentActivity: [
      { agent: "codex", file: "src/web/render.ts", at: "2m", confidence: 0.92 },
    ],
    recentChanges: [{ file: "PLAN.md", at: "1m", diff: "+3 -1" }],
    decisions: [],
    config: { writeback: false, prompts: { dir: "~/.repolog/prompts" } },
  };
}
