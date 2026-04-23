const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const { mkdir, writeFile } = require("node:fs/promises");

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, screen, clipboard } = require("electron");
const { resolveDesktopRepoRoot } = require(path.join(__dirname, "..", "..", "dist", "desktop", "root.js"));

const repoRoot = path.resolve(__dirname, "..", "..");
const { version: appVersion } = require(path.join(__dirname, "package.json"));

function appIconPath() {
  const bundled = path.join(process.resourcesPath, "build", "icon.png");
  const local = path.join(repoRoot, "build", "icon.png");
  const candidate = app.isPackaged ? bundled : local;
  return fs.existsSync(candidate) ? candidate : undefined;
}

function lastRootFile() {
  try {
    return path.join(app.getPath("userData"), "last-root.txt");
  } catch {
    return path.join(repoRoot, ".repolog", "last-root.txt");
  }
}

function readLastRoot() {
  try {
    const raw = fs.readFileSync(lastRootFile(), "utf8").trim();
    return raw && fs.existsSync(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeLastRoot(dir) {
  try {
    const file = lastRootFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, dir, "utf8");
  } catch {
    // best-effort only
  }
}

function clearLastRoot() {
  try {
    fs.rmSync(lastRootFile(), { force: true });
  } catch {
    // best-effort only
  }
}

function windowBoundsFile() {
  try {
    return path.join(app.getPath("userData"), "window-bounds.json");
  } catch {
    return path.join(repoRoot, ".repolog", "window-bounds.json");
  }
}

function readWindowBounds() {
  try {
    const raw = fs.readFileSync(windowBoundsFile(), "utf8");
    const b = JSON.parse(raw);
    if (b && typeof b.width === "number" && typeof b.height === "number") return b;
  } catch {
    // fall through
  }
  return null;
}

function saveWindowBounds(win) {
  try {
    const b = win.getBounds();
    fs.writeFileSync(windowBoundsFile(), JSON.stringify(b), "utf8");
  } catch {
    // best-effort only
  }
}

function firstRunStateFile() {
  try {
    return path.join(app.getPath("userData"), "first-run-state.json");
  } catch {
    return path.join(repoRoot, ".repolog", "first-run-state.json");
  }
}

function openRouterConfigFile() {
  try {
    return path.join(app.getPath("userData"), "openrouter.json");
  } catch {
    return path.join(repoRoot, ".repolog", "openrouter.json");
  }
}

let openrouterConfig = { key: "", model: "nvidia/nemotron-3-super-120b-a12b:free" };
try {
  const orPath = openRouterConfigFile();
  if (fs.existsSync(orPath)) {
    const parsed = JSON.parse(fs.readFileSync(orPath, "utf8"));
    openrouterConfig = { key: parsed.key || "", model: parsed.model || "nvidia/nemotron-3-super-120b-a12b:free" };
  }
} catch { /* best-effort */ }

function readFirstRunState() {
  try {
    const raw = fs.readFileSync(firstRunStateFile(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeFirstRunState(data) {
  try {
    const file = firstRunStateFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // best-effort only
  }
}

function repoConfigFile() {
  return path.join(targetRoot, ".repolog.json");
}

function ensureRepoConfigFile() {
  const file = repoConfigFile();
  if (fs.existsSync(file)) {
    return file;
  }

  const defaultConfig = {
    excludes: ["archive", "archives", "archived"],
    writeback: false,
    prompts: { dir: "~/.repolog/prompts" },
  };

  try {
    fs.writeFileSync(file, `${JSON.stringify(defaultConfig, null, 2)}\n`, "utf8");
  } catch {
    // best-effort only
  }

  return file;
}

let targetRoot = resolveDesktopRepoRoot({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  execPath: process.execPath,
  lastRoot: readLastRoot(),
});

let win = null;
let initialLoadComplete = false;
let watcherHandle = null;
let recentChanges = [];
let currentState = null;
let modulesPromise = null;
let revealTimer = null;
let liveHtmlPath = path.join(targetRoot, ".repolog", "desktop-live.html");

async function loadModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      importModule("dist/engine/config.js"),
      importModule("dist/engine/init.js"),
      importModule("dist/engine/changes.js"),
      importModule("dist/engine/editor.js"),
      importModule("dist/engine/doctor.js"),
      importModule("dist/engine/scan.js"),
      importModule("dist/engine/watcher.js"),
      importModule("dist/engine/writeback.js"),
      importModule("dist/engine/standup.js"),
      importModule("dist/web/render.js"),
      importModule("dist/engine/prompts.js"),
    ]).then(([config, init, changes, editor, doctor, scan, watcher, writeback, standup, web, prompts]) => ({
      readRepoConfig: config.readRepoConfig,
      writeRepoConfig: config.writeRepoConfig,
      writeInitTemplates: init.writeInitTemplates,
      mergeChanges: changes.mergeChanges,
      formatCodeOpenTarget: editor.formatCodeOpenTarget,
      formatDoctorReport: doctor.formatDoctorReport,
      runDoctor: doctor.runDoctor,
      scanRepo: scan.scanRepo,
      startWatcher: watcher.startWatcher,
      toggleChecklistItem: writeback.toggleChecklistItem,
      buildStandupMarkdown: standup.buildStandupMarkdown,
      renderDesktopHtml: web.renderDesktopHtml,
      loadPromptPresets: prompts.loadPromptPresets,
    })).then(async (mods) => {
      const tuneup = await importModule("dist/engine/tuneup.js");
      return { ...mods, buildTuneup: tuneup.buildTuneup };
    });
  }

  return modulesPromise;
}

async function importModule(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return import(pathToFileURL(filePath).href);
}

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const saved = readWindowBounds();
  const defaultWidth = Math.min(1280, workArea.width);
  const defaultHeight = Math.min(800, workArea.height);
  const bounds = saved
    ? { width: saved.width, height: saved.height, x: saved.x, y: saved.y }
    : { width: defaultWidth, height: defaultHeight };

  win = new BrowserWindow({
    ...bounds,
    minWidth: 700,
    minHeight: 560,
    icon: appIconPath(),
    useContentSize: true,
    backgroundColor: "#0b0d10",
    title: "Repo Quest Log",
    autoHideMenuBar: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on("resize", () => saveWindowBounds(win));
  win.on("move", () => saveWindowBounds(win));

  win.on("closed", () => {
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    win = null;
  });

  win.webContents.on("did-finish-load", () => {
    initialLoadComplete = true;
    revealWindow();
  });

  win.once("ready-to-show", () => {
    revealWindow();
  });

  revealTimer = setTimeout(() => {
    revealWindow();
  }, 1500);
}

function revealWindow() {
  if (!win || win.isDestroyed() || win.isVisible()) {
    return;
  }

  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }

  win.maximize();
  win.show();
}

async function refresh(changes = []) {
  const { mergeChanges, scanRepo, renderDesktopHtml, loadPromptPresets } = await loadModules();
  recentChanges = mergeChanges(changes, recentChanges);

  try {
    currentState = await scanRepo(targetRoot, {
      recentChanges,
      lastTouchedFile: recentChanges[0] && recentChanges[0].file,
    });
    const presets = await loadPromptPresets(currentState, { rootDir: targetRoot });
    const html = renderDesktopHtml(currentState, { liveBridge: "desktop", presets, appVersion, openrouterConfigured: !!(openrouterConfig.key) });
    await pushHtml(html);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await pushHtml(renderErrorHtml(message));
  }
}

async function pushHtml(html) {
  if (!win || win.isDestroyed()) {
    return;
  }

  if (!initialLoadComplete) {
    await mkdir(path.dirname(liveHtmlPath), { recursive: true });
    await writeFile(liveHtmlPath, html, "utf8");
    await win.loadFile(liveHtmlPath);
    return;
  }

  win.webContents.send("repolog:html", html);
}

function renderErrorHtml(message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Repo Quest Log - Error</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #0b0d10; color: #e6ecf2; font-family: "JetBrains Mono", Consolas, monospace; }
    body { padding: 32px; }
    h1 { margin: 0 0 16px; font-size: 18px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; color: rgba(230,236,242,0.78); line-height: 1.5; }
  </style>
</head>
<body>
  <h1>repolog desktop failed</h1>
  <pre>${escapeHtml(message)}</pre>
</body>
</html>`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function startWatcherForTarget() {
  const { startWatcher } = await loadModules();
  if (watcherHandle) {
    await watcherHandle.close();
    watcherHandle = null;
  }
  watcherHandle = await startWatcher({
    cwd: targetRoot,
    onRefresh: (changes) => {
      void refresh(changes);
    },
    onError: (error) => {
      process.stderr.write(`RepoLog watcher error: ${error instanceof Error ? error.message : String(error)}\n`);
      if (win && !win.isDestroyed()) {
        win.webContents.send("repolog:toast", { message: "File watch lost sync; re-scanning." });
      }
      void refresh();
    },
    onConfigChanged: () => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("repolog:config-changed", { ok: true });
      }
    },
  });
}

function readFirstRunForTarget() {
  const state = readFirstRunState();
  return state && state.repos && state.repos[targetRoot] ? state.repos[targetRoot] : {};
}

function writeFirstRunForTarget(data) {
  const state = readFirstRunState();
  const repos = state && typeof state.repos === "object" ? state.repos : {};
  repos[targetRoot] = { ...(repos[targetRoot] || {}), ...data };
  writeFirstRunState({ ...state, repos });
}

async function openRepoPicker() {
  if (!win || win.isDestroyed()) return;
  const result = await dialog.showOpenDialog(win, {
    title: "Open a repo folder",
    properties: ["openDirectory"],
    defaultPath: targetRoot,
  });
  if (result.canceled || !result.filePaths[0]) return;
  await switchRoot(result.filePaths[0]);
}

async function openRepoConfig() {
  const filePath = ensureRepoConfigFile();
  await openDoc(filePath, 1);
}

async function firstRunCheck() {
  const planPath = path.join(targetRoot, "PLAN.md");
  const statePath = path.join(targetRoot, "STATE.md");
  const charterPath = path.join(targetRoot, ".repolog", "CHARTER.md");
  const state = readFirstRunForTarget();
  return {
    hasPlanMd: fs.existsSync(planPath),
    hasStateMd: fs.existsSync(statePath),
    hasCharterMd: fs.existsSync(charterPath),
    wizardPrompts: [
      fs.existsSync(planPath) ? "" : "Create PLAN.md first so RepoLog can understand the repo objective.",
      fs.existsSync(statePath) ? "" : "Add STATE.md so the resume note has a home.",
      fs.existsSync(charterPath) ? "" : "Generate CHARTER.md so agents know the markdown rules.",
    ].filter(Boolean),
    lastWizardRun: state.lastWizardRun || null,
  };
}

async function switchRoot(newRoot) {
  targetRoot = path.resolve(newRoot);
  liveHtmlPath = path.join(targetRoot, ".repolog", "desktop-live.html");
  recentChanges = [];
  writeLastRoot(targetRoot);
  if (win && !win.isDestroyed()) {
    win.setTitle(`Repo Quest Log — ${path.basename(targetRoot)}`);
  }
  await refresh();
  await startWatcherForTarget();
}

function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Repo…",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            void openRepoPicker();
          },
        },
        {
          label: "Refresh",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            void refresh();
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Repo Quest Log",
          click: () => {
            void dialog.showMessageBox(win, {
              type: "info",
              title: "About Repo Quest Log",
              message: "Repo Quest Log",
              detail: `Version ${appVersion}\nPortable build available via electron-builder.\nLocal-first desktop shell for repo intent legibility.`,
              buttons: ["OK"],
            });
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function start() {
  await app.whenReady();
  app.setAppUserModelId("com.repoquestlog.app");
  buildMenu();
  createWindow();
  if (win) {
    win.setTitle(`Repo Quest Log — ${path.basename(targetRoot)}`);
  }
  await refresh();
  await startWatcherForTarget();
}

ipcMain.on("repolog:refresh", () => {
  void refresh();
});

ipcMain.on("repolog:open-repo", () => {
  void openRepoPicker();
});

ipcMain.on("repolog:open-config", () => {
  void openRepoConfig();
});

ipcMain.handle("repolog:toggle-checklist", async (_event, payload = {}) => {
  const { readRepoConfig, toggleChecklistItem } = await loadModules();
  const doc = typeof payload.doc === "string" ? payload.doc : "";
  const text = typeof payload.text === "string" ? payload.text : "";
  const line = Number.isInteger(payload.line) ? payload.line : undefined;
  const checked = typeof payload.checked === "boolean" ? payload.checked : undefined;

  if (!doc || !text || !line) {
    return { ok: false, changed: false, reason: "missing task reference" };
  }

  const config = await readRepoConfig(targetRoot);
  if (!config.writeback) {
    return { ok: false, changed: false, reason: "writeback disabled" };
  }

  const filePath = path.resolve(targetRoot, doc);
  const rootPrefix = `${targetRoot}${path.sep}`;
  if (!(filePath === targetRoot || filePath.startsWith(rootPrefix)) || !fs.existsSync(filePath)) {
    return { ok: false, changed: false, reason: "missing doc" };
  }

  const result = await toggleChecklistItem(filePath, line, text, checked);
  if (result.ok && result.changed) {
    await refresh();
  }

  return result;
});

ipcMain.handle("repolog:first-run-check", async () => firstRunCheck());

ipcMain.handle("repolog:wizard-dismiss", async () => {
  writeFirstRunForTarget({ lastWizardRun: Date.now() });
  return { ok: true };
});

ipcMain.handle("repolog:init-template", async (_event, payload = {}) => {
  const { writeInitTemplates } = await loadModules();
  const target = payload && typeof payload.target === "string" ? payload.target : "plan";
  const force = payload && payload.force === true;
  await writeInitTemplates(targetRoot, [target], { write: true, force });
  await refresh();
  await startWatcherForTarget();
  return { success: true };
});

ipcMain.handle("repolog:write-config", async (_event, payload = {}) => {
  const { writeRepoConfig } = await loadModules();
  await writeRepoConfig(targetRoot, payload);
  await refresh();
  await startWatcherForTarget();
  if (win && !win.isDestroyed()) {
    win.webContents.send("repolog:config-changed", { ok: true });
  }
  return { success: true };
});

ipcMain.handle("repolog:run-doctor", async () => {
  const { formatDoctorReport, runDoctor } = await loadModules();
  const report = await runDoctor(targetRoot);
  return {
    text: formatDoctorReport(report),
    hasWarn: report.findings.some((finding) => finding.severity === "warn"),
  };
});

ipcMain.handle("repolog:copy-standup", async () => {
  try {
    const { buildStandupMarkdown, scanRepo } = await loadModules();
    const state = currentState ?? await scanRepo(targetRoot);
    const markdown = await buildStandupMarkdown(targetRoot, state);
    clipboard.writeText(markdown);
    return { ok: true, text: markdown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: message };
  }
});

ipcMain.handle("repolog:run-tuneup", async () => {
  const { runDoctor, buildTuneup, scanRepo } = await loadModules();
  const state = currentState ?? await scanRepo(targetRoot);
  const report = await runDoctor(targetRoot);
  return buildTuneup(state, report);
});

ipcMain.handle("repolog:write-tuneup-charter", async (_event, charter) => {
  const charterDir = path.join(targetRoot, ".repolog");
  fs.mkdirSync(charterDir, { recursive: true });
  fs.writeFileSync(path.join(charterDir, "CHARTER.md"), typeof charter === "string" ? charter : "", "utf8");
  return { ok: true };
});

ipcMain.handle("repolog:save-openrouter-config", async (_event, payload = {}) => {
  // If key is not supplied in payload, preserve the existing key
  const key = typeof payload.key === "string" && payload.key.trim()
    ? payload.key.trim()
    : openrouterConfig.key;
  const model = typeof payload.model === "string" && payload.model.trim()
    ? payload.model.trim()
    : "nvidia/nemotron-3-super-120b-a12b:free";
  openrouterConfig = { key, model };
  try {
    const orPath = openRouterConfigFile();
    fs.mkdirSync(path.dirname(orPath), { recursive: true });
    fs.writeFileSync(orPath, JSON.stringify({ key, model }, null, 2), "utf8");
  } catch { /* best-effort */ }
  return { success: true };
});

ipcMain.handle("repolog:get-openrouter-config", async () => {
  return {
    configured: !!(openrouterConfig.key),
    model: openrouterConfig.model || "nvidia/nemotron-3-super-120b-a12b:free",
    keyPreview: openrouterConfig.key
      ? "sk-or-••••••" + openrouterConfig.key.slice(-4)
      : "",
  };
});

ipcMain.handle("repolog:run-digest", async () => {
  if (!openrouterConfig.key) return { error: "No OpenRouter API key configured. Add one in Settings." };
  if (!targetRoot) return { error: "No repo open." };

  const read = (f) => {
    try { return fs.readFileSync(path.join(targetRoot, f), "utf8"); }
    catch { return "(not found)"; }
  };

  const agentFiles = ["CLAUDE.md", "AGENTS.md", "GEMINI.md", "CODEX.md"]
    .map((f) => { const c = read(f); return c !== "(not found)" ? `### ${f}\n${c}` : null; })
    .filter(Boolean).join("\n\n");

  let gitLog = "(unavailable)";
  try {
    gitLog = require("node:child_process").execSync(
      'git log --format="%h %s (%ar)" --since=7.days --max-count=20',
      { cwd: targetRoot, encoding: "utf8", timeout: 8000 }
    ).trim() || "(no recent commits)";
  } catch { /* non-git repo or timeout */ }

  const contextPrompt = `You are a senior engineering lead doing a quick repo status check. Prioritize the git log and ## Now / ## Blocked sections — those reflect what actually happened, not just the plan. Return ONLY a JSON object, no markdown, no extra text.

## Recent git commits (last 7 days — most reliable signal)
${gitLog}

## PLAN.md (## Now and ## Blocked are the critical sections)
${read("PLAN.md")}

## STATE.md (## Current Focus and ## Resume Note show last session)
${read("STATE.md")}

## Agent files (## Current Task shows what each agent last did)
${agentFiles || "(none)"}

Based on the git commits and Now/Blocked tasks, return exactly this JSON — be specific, avoid restating the plan docs verbatim:
{"summary":"What actually happened recently and where things stand (2 sentences max, reference specific features or files)","stuck":"The most concrete blocker or risk right now, or 'Nothing blocked'","next":"The single most actionable next step (name a specific file, command, or decision — not vague advice)"}`;

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterConfig.key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/statusnone420/repo-quest-log",
        "X-Title": "RepoLog",
      },
      body: JSON.stringify({
        model: openrouterConfig.model || "nvidia/nemotron-3-super-120b-a12b:free",
        messages: [{ role: "user", content: contextPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return { error: `OpenRouter ${resp.status}: ${errText.slice(0, 160)}` };
    }

    const data = await resp.json();
    const rawContent = data.choices?.[0]?.message?.content ?? "{}";
    let parsed = {};
    try { parsed = JSON.parse(rawContent); } catch { parsed = {}; }

    const result = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "No summary returned.",
      stuck: typeof parsed.stuck === "string" ? parsed.stuck : "Unknown.",
      next: typeof parsed.next === "string" ? parsed.next : "Unknown.",
      generatedAt: new Date().toISOString(),
      model: openrouterConfig.model || "nvidia/nemotron-3-super-120b-a12b:free",
    };

    const digestDir = path.join(targetRoot, ".repolog");
    fs.mkdirSync(digestDir, { recursive: true });
    fs.writeFileSync(path.join(digestDir, "digest.json"), JSON.stringify(result, null, 2), "utf8");

    return { result };
  } catch (err) {
    return { error: `Digest failed: ${err.message || String(err)}` };
  }
});

ipcMain.on("repolog:remember-startup-root", () => {
  writeLastRoot(targetRoot);
});

ipcMain.on("repolog:forget-startup-root", () => {
  clearLastRoot();
});

ipcMain.on("repolog:open-doc", (_event, payload = {}) => {
  const doc = typeof payload.doc === "string" ? payload.doc : "";
  if (!doc) {
    return;
  }

  const filePath = path.resolve(targetRoot, doc);
  if (!filePath.startsWith(targetRoot) || !fs.existsSync(filePath)) {
    return;
  }

  const line = Number.isInteger(payload.line) ? payload.line : undefined;
  void openDoc(filePath, line);
});

ipcMain.on("repolog:window-action", (_event, action) => {
  if (!win || win.isDestroyed()) {
    return;
  }

  if (action === "minimize") {
    win.minimize();
    return;
  }

  if (action === "maximize") {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return;
  }

  if (action === "close") {
    win.close();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (watcherHandle) {
    await watcherHandle.close();
  }
});

if (require.main === module) {
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    process.stdout.write(`v${appVersion}\n`);
    app.exit(0);
  }
  void start().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    app.exit(1);
  });
}

async function openDoc(filePath, line) {
  const { formatCodeOpenTarget } = await loadModules();
  const target = formatCodeOpenTarget(filePath, line);

  if (line !== undefined) {
    const opened = await tryOpenWithCode(target);
    if (opened) {
      return;
    }
  }

  await shell.openPath(filePath);
}

function tryOpenWithCode(target) {
  return new Promise((resolve) => {
    const child = spawn("code", ["-g", target], {
      cwd: targetRoot,
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    });

    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
    child.unref();
  });
}

module.exports = {
  resolveDesktopRepoRoot,
};
