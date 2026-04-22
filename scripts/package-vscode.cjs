const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const extensionDir = path.join(rootDir, "extensions", "vscode");
const vsceEntryPoint = path.join(rootDir, "node_modules", "@vscode", "vsce", "vsce");
const extensionPackage = JSON.parse(fs.readFileSync(path.join(extensionDir, "package.json"), "utf8"));
const outputPath = path.join(rootDir, "release", `repo-quest-log-${extensionPackage.version}.vsix`);

if (!fs.existsSync(path.join(rootDir, "dist"))) {
  throw new Error("Root dist/ is missing. Run npm run build before packaging the VSIX.");
}

if (!fs.existsSync(vsceEntryPoint)) {
  throw new Error("vsce is not installed. Run npm install before packaging the VSIX.");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

// vsce looks for LICENSE in the extension directory, not the repo root
fs.copyFileSync(path.join(rootDir, "LICENSE"), path.join(extensionDir, "LICENSE"));

const result = spawnSync(process.execPath, [
  vsceEntryPoint,
  "package",
  "--out",
  outputPath,
], {
  cwd: extensionDir,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
