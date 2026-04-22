const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const { mkdir, writeFile } = require("node:fs/promises");

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, screen } = require("electron");
const { resolveDesktopRepoRoot } = require(path.join(__dirname, "..", "..", "dist", "desktop", "root.js"));

const repoRoot = path.resolve(__dirname, "..", "..");

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
let modulesPromise = null;
let revealTimer = null;
let liveHtmlPath = path.join(targetRoot, ".repolog", "desktop-live.html");

async function loadModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      importModule("dist/engine/changes.js"),
      importModule("dist/engine/editor.js"),
      importModule("dist/engine/scan.js"),
      importModule("dist/engine/watcher.js"),
      importModule("dist/web/render.js"),
      importModule("dist/engine/prompts.js"),
    ]).then(([changes, editor, scan, watcher, web, prompts]) => ({
      mergeChanges: changes.mergeChanges,
      formatCodeOpenTarget: editor.formatCodeOpenTarget,
      scanRepo: scan.scanRepo,
      startWatcher: watcher.startWatcher,
      renderDesktopHtml: web.renderDesktopHtml,
      loadPromptPresets: prompts.loadPromptPresets,
    }));
  }

  return modulesPromise;
}

async function importModule(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return import(pathToFileURL(filePath).href);
}

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: workArea.width,
    height: workArea.height,
    minWidth: 700,
    minHeight: 560,
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
    const state = await scanRepo(targetRoot, {
      recentChanges,
      lastTouchedFile: recentChanges[0] && recentChanges[0].file,
    });
    const presets = await loadPromptPresets(state, { rootDir: targetRoot });
    const html = renderDesktopHtml(state, { liveBridge: "desktop", presets });
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
      const message = error instanceof Error ? error.stack || error.message : String(error);
      void pushHtml(renderErrorHtml(message));
    },
  });
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
