const path = require("node:path");
const { pathToFileURL } = require("node:url");

const vscode = require("vscode");

const repoRoot = path.resolve(__dirname, "..", "..");

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

class RepoQuestViewProvider {
  constructor(context) {
    this.context = context;
    this.view = undefined;
    this.rootDir = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;
    this.recentChanges = [];
    this.watcherHandle = undefined;
    this.modulesPromise = undefined;
  }

  async resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };

    if (!this.rootDir) {
      view.webview.html = renderWorkspaceRequiredHtml();
      return;
    }

    await this.refresh();
    await this.ensureWatcher();
  }

  async refresh(changes = []) {
    if (!this.view || !this.rootDir) {
      return;
    }

    const modules = await this.loadModules();
    this.recentChanges = mergeChanges(changes, this.recentChanges);
    const state = await modules.scanRepo(this.rootDir, {
      recentChanges: this.recentChanges,
      lastTouchedFile: this.recentChanges[0] && this.recentChanges[0].file,
    });
    const html = modules.renderVSCodeHtml(state, { liveBridge: "vscode" });

    if (!this.view.webview.html) {
      this.view.webview.html = html;
      return;
    }

    await this.view.webview.postMessage({
      type: "repolog:replaceHtml",
      html,
    });
  }

  async ensureWatcher() {
    if (this.watcherHandle || !this.rootDir) {
      return;
    }

    const modules = await this.loadModules();
    this.watcherHandle = await modules.startWatcher({
      cwd: this.rootDir,
      onRefresh: (changes) => {
        void this.refresh(changes);
      },
      onError: (error) => {
        void vscode.window.showErrorMessage(`Repo Quest Log watcher failed: ${String(error)}`);
      },
    });
    this.context.subscriptions.push({
      dispose: () => {
        if (this.watcherHandle) {
          void this.watcherHandle.close();
          this.watcherHandle = undefined;
        }
      },
    });
  }

  async loadModules() {
    if (!this.modulesPromise) {
      this.modulesPromise = Promise.all([
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "scan.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "watcher.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "web", "render.js")).href),
      ]).then(([scan, watcher, web]) => ({
        scanRepo: scan.scanRepo,
        startWatcher: watcher.startWatcher,
        renderVSCodeHtml: web.renderVSCodeHtml,
      }));
    }

    return this.modulesPromise;
  }
}

function renderWorkspaceRequiredHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      background: #1e1e1e;
      color: #cccccc;
      font-family: "Segoe UI", sans-serif;
    }
    body { padding: 16px; line-height: 1.5; }
    h1 { margin: 0 0 10px; font-size: 16px; }
    p { margin: 0; color: #858585; }
  </style>
</head>
<body>
  <h1>Repo Quest Log</h1>
  <p>Open a workspace folder first so the extension can scan the repo.</p>
</body>
</html>`;
}

function activate(context) {
  const provider = new RepoQuestViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("repoQuestLog.view", provider),
    vscode.commands.registerCommand("repoQuestLog.refresh", () => provider.refresh()),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
