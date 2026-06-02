import { describe, expect, it } from "vitest";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { renderDesktopHtml } from "../src/desktop/render.js";
import { desktopUserArgv, resolveDesktopRepoRoot } from "../src/desktop/root.js";
import type { QuestState } from "../src/engine/types.js";

const require = createRequire(import.meta.url);

describe("renderDesktopHtml", () => {
  it("renders the desktop HUD shell from QuestState", () => {
    const html = renderDesktopHtml(sampleState(), { appVersion: "0.5.0" });

    expect(html).toContain("repo quest log");
    expect(html).toContain("v0.5.0");
    expect(html).toContain("Ship v0.1");
    expect(html).toContain("Current focus");
    expect(html).toContain("Why this matters");
    expect(html).toContain("Settings");
    expect(html).toContain("Open Repo");
    expect(html).toContain('data-role="topbar-switch-repo"');
    expect(html).toContain("Switch Repo");
    expect(html).toContain("Ctrl+O");
    expect(html).toContain("Ctrl+Shift+C");
    expect(html).toContain("Prompt dir");
    expect(html).toContain("Save repo config");
    expect(html).toContain("Writes .repolog.json in this repo.");
    expect(html).toContain("Create repo guide");
    expect(html).not.toContain(">Write CHARTER.md<");
    expect(html).toContain('data-config-field="watchDebounce"');
    expect(html).toContain("data-config-error");
    expect(html).toContain("Watch debounce must be a number from 100 to 10000.");
    expect(html).toContain("Startup");
    expect(html).toContain("Remember");
    expect(html).toContain("Forget");
    expect(html).toContain("data-writeback-toggle");
    expect(html).toContain("Theme");
    expect(html).toContain("run-digest");
    expect(html).toContain("source: STATE.md resume note");
    expect(html).toContain("desktop-preview.html");
    expect(html).toContain("data-copy-context=");
    expect(html).toContain('data-ui-action="refresh"');
    expect(html).toContain("change-spark");
    expect(html).toContain("Standup");
  });

  it("does not render the first-run setup card for a healthy PLAN.md repo even when STATE.md is absent", () => {
    const state = sampleState();
    state.scannedFiles = ["PLAN.md"];

    const html = renderDesktopHtml(state, { appVersion: "0.5.0" });

    expect(html).not.toContain('<div class="settings-panel-card" data-setup-card>');
  });

  it("renders wizard safeguards for missing PLAN.md repos", () => {
    const state = sampleState();
    state.scannedFiles = ["README.md"];

    const html = renderDesktopHtml(state, { appVersion: "0.5.0" });

    expect(html).toContain('<div class="settings-panel-card" data-setup-card>');
    expect(html).toContain('data-ui-action="run-doctor-again"');
    expect(html).toContain("humanError(error)");
    expect(html).toContain("setBusy(button, true)");
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
    expect(source).toContain("win.show()");
    expect(source).toContain("require.main === module || process.versions.electron");
    expect(source).toContain("formatCodeOpenTarget");
    expect(source).toContain('spawn("code", ["-g"');
    expect(source).toContain("About Repo Quest Log");
    expect(source).toContain("setAppUserModelId");
    expect(source).toContain('require(path.join(__dirname, "package.json"))');
    expect(source).toContain("repolog:first-run-check");
    expect(source).toContain("repolog:wizard-dismiss");
    expect(source).toContain("first-run-state.json");
    expect(source).toContain("handoff-settings.json");
    expect(source).toContain("repolog:get-handoff-settings");
    expect(source).toContain("repolog:save-handoff-settings");
    expect(source).toContain("lastWizardRun: Date.now()");
    expect(source).toContain("repolog:toast");
    expect(packageJson.build?.win?.target).toEqual(["nsis", "portable"]);
    expect(packageJson.build?.extraResources).toEqual([{ from: "build/icon.png", to: "build/icon.png" }]);
  });

  it("feeds desktop workspace activity into scan state without repo-local runtime writes", async () => {
    const source = await readFile(join(process.cwd(), "apps/desktop/main.cjs"), "utf8");

    expect(source).toContain("startWorkspaceActivityWatcher");
    expect(source).toContain("createRefreshQueue");
    expect(source).toContain("refreshQueue.enqueue(changes)");
    expect(source).toContain("recentActivity = mergeRecentActivity(events, recentActivity)");
    expect(source).toContain("recentActivity: runRecentActivity");
    expect(source).toContain("repolog:get-file-diff");
    expect(source).not.toContain("readWorkspaceMode");
    expect(source).not.toContain("writeWorkspaceMode");
    expect(source).not.toContain("repolog:set-workspace-mode");
    expect(source).not.toContain('path.join(targetRoot, ".repolog", "activity');
  });

  it("does not accumulate preload HTML listeners across document rewrites", async () => {
    const preloadSource = await readFile(join(process.cwd(), "apps", "desktop", "preload.cjs"), "utf8");

    expect(preloadSource).toContain("let htmlCallback");
    expect(preloadSource).toContain("let toastCallback");
    expect(preloadSource).toContain("function installBridgeListeners");
    expect(preloadSource).toContain("htmlCallback = callback");
    expect(preloadSource).toContain("toastCallback = callback");
  });

  it("exposes a desktop clipboard fallback for copy prompt buttons", async () => {
    const preloadSource = await readFile(join(process.cwd(), "apps", "desktop", "preload.cjs"), "utf8");
    const mainSource = await readFile(join(process.cwd(), "apps", "desktop", "main.cjs"), "utf8");

    expect(preloadSource).toContain("copyText(text)");
    expect(preloadSource).toContain('ipcRenderer.invoke("repolog:copy-text", text)');
    expect(mainSource).toContain('ipcMain.handle("repolog:copy-text"');
    expect(mainSource).toContain("clipboard.writeText");
  });

  it("keeps the newest queued refresh change for each file", () => {
    const { mergeChangesForRefresh } = require("../apps/desktop/refresh-queue.cjs") as {
      mergeChangesForRefresh(next: { file: string; at: string }[], previous: { file: string; at: string }[]): { file: string; at: string }[];
    };

    const merged = mergeChangesForRefresh(
      [{ file: "src/web/render.ts", at: "newer" }],
      [
        { file: "src/web/render.ts", at: "older" },
        { file: "src/engine/prompts.ts", at: "older-only" },
      ],
    );

    expect(merged).toEqual([
      { file: "src/web/render.ts", at: "newer" },
      { file: "src/engine/prompts.ts", at: "older-only" },
    ]);
  });

  it("puts the newest refresh batch before older queued files", () => {
    const { mergeChangesForRefresh } = require("../apps/desktop/refresh-queue.cjs") as {
      mergeChangesForRefresh(next: { file: string; at: string }[], previous: { file: string; at: string }[]): { file: string; at: string }[];
    };

    const merged = mergeChangesForRefresh(
      [{ file: "src/desktop/git-diff.ts", at: "newest" }],
      [
        { file: "src/web/render.ts", at: "older" },
        { file: "src/engine/prompts.ts", at: "older" },
      ],
    );

    expect(merged.map((change) => change.file)).toEqual([
      "src/desktop/git-diff.ts",
      "src/web/render.ts",
      "src/engine/prompts.ts",
    ]);
  });

  it("resolves queued refresh promises only after the queued work completes", async () => {
    const { createRefreshQueue } = require("../apps/desktop/refresh-queue.cjs") as {
      createRefreshQueue(worker: (changes: { file: string }[]) => Promise<void>): {
        enqueue(changes?: { file: string }[]): Promise<void>;
      };
    };
    let releaseFirst: (() => void) | undefined;
    const calls: string[][] = [];
    const queue = createRefreshQueue(async (changes) => {
      calls.push(changes.map((change) => change.file));
      if (calls.length === 1) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
    });

    const first = queue.enqueue([{ file: "first" }]);
    let secondResolved = false;
    const second = queue.enqueue([{ file: "second" }]).then(() => {
      secondResolved = true;
    });
    await Promise.resolve();

    expect(secondResolved).toBe(false);
    releaseFirst?.();
    await Promise.all([first, second]);

    expect(secondResolved).toBe(true);
    expect(calls).toEqual([["first"], ["second"]]);
  });

  it("runs and resolves queued refreshes even when no changes are supplied", async () => {
    const { createRefreshQueue } = require("../apps/desktop/refresh-queue.cjs") as {
      createRefreshQueue(worker: (changes: { file: string }[]) => Promise<void>): {
        enqueue(changes?: { file: string }[]): Promise<void>;
      };
    };
    let releaseFirst: (() => void) | undefined;
    const calls: string[][] = [];
    const queue = createRefreshQueue(async (changes) => {
      calls.push(changes.map((change) => change.file));
      if (calls.length === 1) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
    });

    const first = queue.enqueue([{ file: "first" }]);
    const second = queue.enqueue();
    releaseFirst?.();
    await Promise.all([first, second]);

    expect(calls).toEqual([["first"], []]);
  });

  it("settles queued refresh waiters quietly when cancelled during repo switch", async () => {
    const { createRefreshQueue } = require("../apps/desktop/refresh-queue.cjs") as {
      createRefreshQueue(worker: (changes: { file: string }[]) => Promise<void>): {
        cancelQueued(): void;
        enqueue(changes?: { file: string }[]): Promise<void>;
      };
    };
    let releaseFirst: (() => void) | undefined;
    const queue = createRefreshQueue(async (changes) => {
      if (changes[0]?.file === "first") {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
    });

    const first = queue.enqueue([{ file: "first" }]);
    const second = queue.enqueue([{ file: "second" }]);
    queue.cancelQueued();
    releaseFirst?.();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it("rejects queued refresh promises when the in-flight refresh fails", async () => {
    const { createRefreshQueue } = require("../apps/desktop/refresh-queue.cjs") as {
      createRefreshQueue(worker: (changes: { file: string }[]) => Promise<void>): {
        enqueue(changes?: { file: string }[]): Promise<void>;
      };
    };
    let releaseFirst: (() => void) | undefined;
    const queue = createRefreshQueue(async (changes) => {
      if (changes[0]?.file === "first") {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        throw new Error("first failed");
      }
    });

    const first = queue.enqueue([{ file: "first" }]);
    const second = queue.enqueue([{ file: "second" }]);
    releaseFirst?.();

    await expect(first).rejects.toThrow("first failed");
    await expect(second).rejects.toThrow("first failed");
  });

  it("guards refresh callbacks by repo generation during repo switches", async () => {
    const source = await readFile(join(process.cwd(), "apps", "desktop", "main.cjs"), "utf8");

    expect(source).toContain("targetGeneration");
    expect(source).toContain("const watchedGeneration = targetGeneration");
    expect(source).toContain("watchedGeneration !== targetGeneration");
    expect(source).toContain("refreshQueue.cancelQueued");
    expect(source).toContain("runGeneration !== targetGeneration");
    expect(source).toContain("watcherRestartId");
    expect(source).toContain("closeIfStale");
  });
});

describe("resolveDesktopRepoRoot", () => {
  it("keeps --repo-root arguments from a packaged desktop executable", () => {
    const argv = [
      "C:\\Program Files\\Repo Quest Log\\Repo Quest Log.exe",
      "--repo-root",
      "D:\\Repos\\Target App",
    ];

    expect(desktopUserArgv(argv)).toEqual(["--repo-root", "D:\\Repos\\Target App"]);
  });

  it("strips the Electron script path in development desktop runs", () => {
    const argv = [
      "D:\\Repo Quest Log\\node_modules\\electron\\dist\\electron.exe",
      "D:\\Repo Quest Log\\apps\\desktop\\main.cjs",
      "--repo-root",
      "D:\\Repos\\Target App",
    ];

    expect(desktopUserArgv(argv)).toEqual(["--repo-root", "D:\\Repos\\Target App"]);
  });

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

  it("accepts --repo-root as the explicit startup directory", async () => {
    const dir = join(tmpdir(), `repo-quest-log-flag-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    try {
      const resolved = resolveDesktopRepoRoot({
        argv: ["--repo-root", dir],
        cwd: tmpdir(),
        execPath: join(tmpdir(), "Repo Quest Log.exe"),
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


describe("desktop digest hardening", () => {
  it("digest skips symlinked planning files", async () => {
    const source = await readFile(join(process.cwd(), "apps", "desktop", "main.cjs"), "utf8");
    expect(source).toContain("assertRegularFilePath(targetRoot, filePath)");
    expect(source).toContain("skippedFiles");
    expect(source).toContain("planningLimit = 20000");
    expect(source).toContain('reason === "missing" && options.optional');
    expect(source).toContain('readPlanningFile(fileName, { optional: true })');
  });

  it("does not write live HTML or digest cache into the opened repo", async () => {
    const source = await readFile(join(process.cwd(), "apps", "desktop", "main.cjs"), "utf8");

    expect(source).toContain("loadURL");
    expect(source).toContain("data:text/html;charset=utf-8,");
    expect(source).not.toContain('path.join(targetRoot, ".repolog", "desktop-live.html")');
    expect(source).not.toContain('path.join(targetRoot, ".repolog", "digest.json")');
  });

  it("passes targetRoot into tuneup so generic repos get repository context", async () => {
    const desktopSource = await readFile(join(process.cwd(), "apps", "desktop", "main.cjs"), "utf8");
    const vscodeSource = await readFile(join(process.cwd(), "extensions", "vscode", "extension.js"), "utf8");

    expect(desktopSource).toContain("buildTuneup(state, report, targetRoot)");
    expect(vscodeSource).toContain("buildTuneup(state, report, this.rootDir)");
    expect(vscodeSource).toContain("buildTuneup(state, report, rootDir)");
  });

  it("explicit repo writes return the exact files they write", async () => {
    const source = await readFile(join(process.cwd(), "apps", "desktop", "main.cjs"), "utf8");

    expect(source).toContain("files: outputs.map");
    expect(source).toContain("files: [repoConfigFile()]");
    expect(source).toContain("files: [charterPath]");
    expect(source).toContain("repolog:apply-generated-docs");
  });

  it("exposes app-level Agent Handoff settings without repo writes", async () => {
    const desktopSource = await readFile(join(process.cwd(), "apps", "desktop", "main.cjs"), "utf8");
    const preloadSource = await readFile(join(process.cwd(), "apps", "desktop", "preload.cjs"), "utf8");

    expect(desktopSource).toContain("handoffSettingsFile()");
    expect(desktopSource).toContain("readHandoffSettings()");
    expect(desktopSource).toContain("writeHandoffSettings(");
    expect(desktopSource).toContain("appStorageRoot()");
    expect(desktopSource).not.toContain('path.join(targetRoot, ".repolog", "handoff');
    expect(preloadSource).toContain("getHandoffSettings()");
    expect(preloadSource).toContain("saveHandoffSettings(payload)");
  });
});
