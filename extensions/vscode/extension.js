const path = require("node:path");
const { pathToFileURL } = require("node:url");

const vscode = require("vscode");

const fs = require("node:fs");

let repoRoot = __dirname;
if (!fs.existsSync(path.join(repoRoot, "dist"))) {
  repoRoot = path.resolve(__dirname, "..", "..");
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
    this.currentState = undefined;
  }

  async resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };

    if (!this.rootDir) {
      view.webview.html = renderWorkspaceRequiredHtml();
      return;
    }

    view.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === "openDoc") {
          const docPath = path.join(this.rootDir, message.doc);
          try {
            const document = await vscode.workspace.openTextDocument(docPath);
            const editor = await vscode.window.showTextDocument(document);
            if (message.line) {
              const line = Math.max(0, message.line - 1);
              const position = new vscode.Position(line, 0);
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
          } catch (e) {
            vscode.window.showErrorMessage(`Could not open ${message.doc}: ${e.message}`);
          }
          return;
        }

        if (message.type === "copyStandup") {
          try {
            const modules = await this.loadModules();
            const state = this.currentState || await modules.scanRepo(this.rootDir);
            const markdown = await modules.buildStandupMarkdown(this.rootDir, state);
            await vscode.env.clipboard.writeText(markdown);
            await this.view.webview.postMessage({
              type: "repolog:toast",
              message: "standup export copied",
            });
          } catch (e) {
            const errorText = e instanceof Error ? e.message : String(e);
            await this.view.webview.postMessage({
              type: "repolog:toast",
              message: `standup export failed: ${errorText}`,
            });
          }
        }

        if (message.type === "runTuneup") {
          try {
            const modules = await this.loadModules();
            const state = this.currentState || await modules.scanRepo(this.rootDir);
            const report = await modules.runDoctor(this.rootDir);
            const tuneup = modules.buildTuneup(state, report);
            await this.view.webview.postMessage({ type: "repolog:tuneup", data: tuneup });
          } catch (e) {
            const errorText = e instanceof Error ? e.message : String(e);
            await this.view.webview.postMessage({
              type: "repolog:toast",
              message: `tuneup failed: ${errorText}`,
            });
          }
        }

        if (message.type === "writeTuneupCharter") {
          try {
            const fs = require("node:fs");
            const nodePath = require("node:path");
            const charterDir = nodePath.join(this.rootDir, ".repolog");
            const charterPath = nodePath.join(charterDir, "CHARTER.md");
            fs.mkdirSync(charterDir, { recursive: true });
            fs.writeFileSync(charterPath, message.charter || "", "utf8");
            await this.view.webview.postMessage({ type: "repolog:toast", message: "CHARTER.md written" });
          } catch (e) {
            const errorText = e instanceof Error ? e.message : String(e);
            await this.view.webview.postMessage({ type: "repolog:toast", message: `failed to write CHARTER.md: ${errorText}` });
          }
        }

        if (message.type === "writeConfig") {
          try {
            const modules = await this.loadModules();
            await modules.writeRepoConfig(this.rootDir, message.payload || {});
            await this.refresh();
            await this.view.webview.postMessage({ type: "repolog:toast", message: "settings saved" });
          } catch (e) {
            const errorText = e instanceof Error ? e.message : String(e);
            await this.view.webview.postMessage({ type: "repolog:toast", message: `settings save failed: ${errorText}` });
          }
        }

        if (message.type === "initTemplate") {
          try {
            const modules = await this.loadModules();
            const target = message.target || "plan";
            await modules.writeInitTemplates(this.rootDir, [target], { write: true, force: !!message.force });
            await this.refresh();
            await this.view.webview.postMessage({ type: "repolog:toast", message: `${target.toUpperCase()} created` });
          } catch (e) {
            const errorText = e instanceof Error ? e.message : String(e);
            await this.view.webview.postMessage({ type: "repolog:toast", message: `template creation failed: ${errorText}` });
          }
        }
      },
      undefined,
      this.context.subscriptions
    );

    await this.refresh();
    await this.ensureWatcher();
  }

  async refresh(changes = []) {
    if (!this.view || !this.rootDir) {
      return;
    }

    const modules = await this.loadModules();
    this.recentChanges = modules.mergeChanges(changes, this.recentChanges);
    const state = await modules.scanRepo(this.rootDir, {
      recentChanges: this.recentChanges,
      lastTouchedFile: this.recentChanges[0] && this.recentChanges[0].file,
    });
    this.currentState = state;
    const presets = await modules.loadPromptPresets(state, { rootDir: this.rootDir });
    const html = modules.renderVSCodeHtml(state, { liveBridge: "vscode", presets });

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
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "changes.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "scan.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "watcher.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "config.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "init.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "web", "render.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "prompts.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "standup.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "doctor.js")).href),
        import(pathToFileURL(path.join(repoRoot, "dist", "engine", "tuneup.js")).href),
      ]).then(([changes, scan, watcher, config, init, web, prompts, standup, doctor, tuneup]) => ({
        mergeChanges: changes.mergeChanges,
        scanRepo: scan.scanRepo,
        startWatcher: watcher.startWatcher,
        writeRepoConfig: config.writeRepoConfig,
        writeInitTemplates: init.writeInitTemplates,
        renderVSCodeHtml: web.renderVSCodeHtml,
        loadPromptPresets: prompts.loadPromptPresets,
        buildStandupMarkdown: standup.buildStandupMarkdown,
        runDoctor: doctor.runDoctor,
        buildTuneup: tuneup.buildTuneup,
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
    vscode.commands.registerCommand("repoQuestLog.tuneup", async () => {
      if (!provider.view) {
        vscode.window.showInformationMessage("Open the Repo Quest Log panel first.");
        return;
      }
      try {
        const modules = await provider.loadModules();
        const rootDir = provider.rootDir;
        if (!rootDir) {
          vscode.window.showInformationMessage("No workspace folder open.");
          return;
        }
        const state = provider.currentState || await modules.scanRepo(rootDir);
        const report = await modules.runDoctor(rootDir);
        const tuneup = modules.buildTuneup(state, report);

        const action = await vscode.window.showQuickPick(
          [
            { label: "Copy tuneup prompt", id: "copy" },
            { label: "Write .repolog/CHARTER.md", id: "charter" },
            { label: `Score: ${tuneup.score}/100 · ${tuneup.gaps.length} gap(s)`, id: "info" },
            ...Object.keys(tuneup.perAgent).map((agentId) => ({
              label: `Copy prompt for ${agentId}`,
              id: `agent-${agentId}`,
            })),
          ],
          { placeHolder: "RepoLog Tuneup" },
        );

        if (!action || action.id === "info") return;

        if (action.id === "copy") {
          await vscode.env.clipboard.writeText(tuneup.prompt);
          vscode.window.showInformationMessage("Tuneup prompt copied to clipboard.");
        } else if (action.id === "charter") {
          const nodePath = require("node:path");
          const nodeFs = require("node:fs");
          const charterDir = nodePath.join(rootDir, ".repolog");
          nodeFs.mkdirSync(charterDir, { recursive: true });
          nodeFs.writeFileSync(nodePath.join(charterDir, "CHARTER.md"), tuneup.charter, "utf8");
          vscode.window.showInformationMessage("CHARTER.md written to .repolog/");
        } else if (action.id.startsWith("agent-")) {
          const agentId = action.id.slice("agent-".length);
          const prompt = tuneup.perAgent[agentId] || tuneup.prompt;
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showInformationMessage(`Tuneup prompt for ${agentId} copied.`);
        }
      } catch (e) {
        vscode.window.showErrorMessage(`Tuneup failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
