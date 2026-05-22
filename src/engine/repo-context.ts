import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { RepoContext } from "./types.js";

const SKIP_NAMES = new Set([
  "node_modules", ".git", ".svn", "dist", "build", "out", "__pycache__",
  ".next", ".nuxt", "target", "vendor", "venv", ".venv", "env",
  "coverage", ".cache", ".parcel-cache", "tmp", ".tmp",
]);

const README_CANDIDATES = [
  "README.md", "README.MD", "readme.md",
  "README.rst", "README.txt", "README.org", "README",
];

const ENTRY_POINTS: Record<string, string[]> = {
  TypeScript: ["src/index.ts", "src/main.ts", "index.ts", "main.ts", "src/app.ts", "app.ts"],
  JavaScript: ["src/index.js", "index.js", "main.js", "src/main.js", "src/app.js", "app.js"],
  Python: ["main.py", "app.py", "__main__.py", "src/main.py", "cli.py", "bot.py", "run.py"],
  Rust: ["src/main.rs", "src/lib.rs"],
  Go: ["main.go", "cmd/main.go", "cmd/root.go"],
  Ruby: ["main.rb", "app.rb", "lib/main.rb", "bin/run"],
  "C#": ["Program.cs", "src/Program.cs"],
};

export async function gatherRepoContext(rootDir: string): Promise<RepoContext> {
  const context: RepoContext = {
    repoType: "unknown",
    recentCommits: [],
    rootFiles: [],
    sourceTree: [],
    docsFound: [],
  };

  context.rootFiles = await scanRootFiles(rootDir);
  context.repoType = detectRepoType(context.rootFiles);
  context.docsFound = await findDocs(rootDir, context.rootFiles);
  await readManifest(rootDir, context);

  for (const name of README_CANDIDATES) {
    try {
      const raw = await readFile(join(rootDir, name), "utf8");
      context.readmePreview = raw.split(/\r?\n/).slice(0, 60).join("\n");
      break;
    } catch {
      // try next candidate
    }
  }

  try {
    const log = execFileSync("git", ["log", "--oneline", "-20"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    context.recentCommits = log
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.replace(/^[a-f0-9]+ /, "").trim());
  } catch {
    // non-git repos still get README/manifest/tree context
  }

  for (const ep of ENTRY_POINTS[context.repoType] ?? []) {
    try {
      const raw = await readFile(join(rootDir, ep), "utf8");
      context.entryPointFile = ep;
      context.entryPointPreview = raw.split(/\r?\n/).slice(0, 30).join("\n");
      break;
    } catch {
      // try next candidate
    }
  }

  await fillSourceTree(rootDir, context);
  if (context.repoType === "JavaScript" && context.sourceTree.some((file) => /\.(ts|tsx)$/i.test(file))) {
    context.repoType = "TypeScript";
  }
  return context;
}

export function scoreContextUsefulness(context: RepoContext | null | undefined): number {
  if (!context) return 0;
  let score = 0;
  if (context.readmePreview) score += 30;
  if (context.manifestType || context.packageName || context.packageDescription) score += 25;
  if (context.recentCommits.length > 0) score += 20;
  if (context.docsFound.length > 0) score += 15;
  if (context.sourceTree.length > 0 || context.entryPointPreview) score += 10;
  return Math.min(100, score);
}

async function scanRootFiles(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    return entries
      .filter((entry) => !entry.name.startsWith(".") || entry.name === ".repolog")
      .filter((entry) => !SKIP_NAMES.has(entry.name))
      .map((entry) => entry.name + (entry.isDirectory() ? "/" : ""))
      .sort();
  } catch {
    return [];
  }
}

function detectRepoType(rootFiles: string[]): string {
  const names = new Set(rootFiles.map((file) => file.toLowerCase().replace(/\/$/, "")));
  if (names.has("package.json")) {
    if (names.has("tsconfig.json") || rootFiles.some((file) => file.endsWith(".ts"))) return "TypeScript";
    return "JavaScript";
  }
  if (names.has("pyproject.toml") || names.has("setup.py") || names.has("requirements.txt")) return "Python";
  if (names.has("cargo.toml")) return "Rust";
  if (names.has("go.mod")) return "Go";
  if (names.has("gemfile") || rootFiles.some((file) => file.endsWith(".gemspec"))) return "Ruby";
  if (names.has("pom.xml") || names.has("build.gradle") || names.has("build.gradle.kts")) return "Java";
  if (rootFiles.some((file) => file.endsWith(".csproj") || file.endsWith(".sln"))) return "C#";
  if (names.has("cmakelists.txt")) return "C/C++";
  if (rootFiles.some((file) => file.endsWith(".tf"))) return "Terraform";
  if (rootFiles.some((file) => file.endsWith(".sh") || file.endsWith(".bash"))) return "Shell";
  if (rootFiles.length > 0 && rootFiles.every((file) => file.endsWith(".md") || file.endsWith(".txt") || file.endsWith(".rst"))) return "docs";
  return "unknown";
}

async function readManifest(rootDir: string, context: RepoContext): Promise<void> {
  try {
    const raw = await readFile(join(rootDir, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    context.manifestType = "package.json";
    if (typeof pkg.name === "string") context.packageName = pkg.name;
    if (typeof pkg.description === "string") context.packageDescription = pkg.description;
    if (typeof pkg.version === "string") context.packageVersion = pkg.version;
    return;
  } catch {
    // try next manifest
  }

  try {
    const raw = await readFile(join(rootDir, "pyproject.toml"), "utf8");
    context.manifestType = "pyproject.toml";
    const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
    const desc = /^\s*description\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
    if (name) context.packageName = name;
    if (desc) context.packageDescription = desc;
    return;
  } catch {
    // try next manifest
  }

  try {
    const raw = await readFile(join(rootDir, "Cargo.toml"), "utf8");
    context.manifestType = "Cargo.toml";
    const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
    const desc = /^\s*description\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
    if (name) context.packageName = name;
    if (desc) context.packageDescription = desc;
    return;
  } catch {
    // try next manifest
  }

  try {
    const raw = await readFile(join(rootDir, "go.mod"), "utf8");
    context.manifestType = "go.mod";
    const mod = /^module\s+(\S+)/m.exec(raw)?.[1];
    if (mod) context.packageName = mod.split("/").pop();
  } catch {
    // no manifest
  }
}

async function findDocs(rootDir: string, rootFiles: string[]): Promise<string[]> {
  const docs = rootFiles
    .filter((file) => /\.(md|rst|txt)$/i.test(file))
    .map((file) => file.replace(/\/$/, ""));
  try {
    const entries = await readdir(join(rootDir, "docs"), { withFileTypes: true });
    docs.push(
      ...entries
        .filter((entry) => entry.isFile() && /\.(md|rst|txt)$/i.test(entry.name))
        .map((entry) => `docs/${entry.name}`),
    );
  } catch {
    // docs folder is optional
  }
  return [...new Set(docs)].sort();
}

async function fillSourceTree(rootDir: string, context: RepoContext): Promise<void> {
  const sourceDirs = [
    "src", "lib", "app", "cmd", "source", "packages",
    "scripts", "tools", "core", "api", "server", "client",
    "backend", "frontend", "bot", "extension", "plugin",
  ];
  for (const dir of sourceDirs) {
    if (context.sourceTree.length >= 25) break;
    const entries = await listSourceFiles(join(rootDir, dir), dir);
    const remaining = 25 - context.sourceTree.length;
    context.sourceTree.push(...entries.slice(0, remaining));
  }
}

async function listSourceFiles(dir: string, prefix: string): Promise<string[]> {
  const result: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_NAMES.has(entry.name)) continue;
    const itemPath = `${prefix}/${entry.name}`;
    if (entry.isFile()) {
      result.push(itemPath);
      continue;
    }
    if (!entry.isDirectory()) continue;
    try {
      const sub = await readdir(join(dir, entry.name), { withFileTypes: true });
      for (const subEntry of sub) {
        if (subEntry.isFile() && !subEntry.name.startsWith(".")) {
          result.push(`${itemPath}/${subEntry.name}`);
        }
      }
    } catch {
      // skip unreadable nested source dirs
    }
  }
  return result;
}
