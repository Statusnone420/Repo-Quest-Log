const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { mkdir, writeFile } = require("node:fs/promises");

const { app, BrowserWindow, ipcMain } = require("electron");
const { screen } = require("electron");
const { resolveDesktopRepoRoot } = require(path.join(__dirname, "..", "..", "dist", "desktop", "root.js"));

const repoRoot = path.resolve(__dirname, "..", "..");
const targetRoot = resolveDesktopRepoRoot({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  execPath: process.execPath,
});

let win = null;
let initialLoadComplete = false;
let watcherHandle = null;
let recentChanges = [];
let modulesPromise = null;
let revealTimer = null;
const liveHtmlPath = path.join(targetRoot, ".repolog", "desktop-live.html");

function mergeChanges(next, previous) {
  const merged = new Map();

  for (const change of next) {
    merged.set(change.file, change);
  }

  for (const change of previous) {
    if (!merged.has(change.file)) {
      merged.set(change.file, change);
    }
  }

  return [...merged.values()].slice(0, 10);
}

async function loadModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      importModule("dist/engine/scan.js"),
      importModule("dist/engine/watcher.js"),
      importModule("dist/web/render.js"),
    ]).then(([scan, watcher, web]) => ({
      scanRepo: scan.scanRepo,
      startWatcher: watcher.startWatcher,
      renderDesktopHtml: web.renderDesktopHtml,
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
  const { scanRepo, renderDesktopHtml } = await loadModules();
  recentChanges = mergeChanges(changes, recentChanges);

  try {
    const state = await scanRepo(targetRoot, {
      recentChanges,
      lastTouchedFile: recentChanges[0] && recentChanges[0].file,
    });
    const html = renderDesktopHtml(state, { liveBridge: "desktop" });
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

async function start() {
  await app.whenReady();
  createWindow();
  await refresh();

  const { startWatcher } = await loadModules();
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

ipcMain.on("repolog:refresh", () => {
  void refresh();
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

module.exports = {
  resolveDesktopRepoRoot,
};
