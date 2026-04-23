import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import type { DoctorReport } from "./doctor.js";
import type { AgentProfile, QuestState } from "./types.js";

export interface Gap {
  id: string;
  severity: "high" | "med" | "low";
  file: string;
  heading: string;
  fix: string;
  suggestedMarkdown: string;
  currentContent?: string;
  contextHints?: string;
}

export interface RepoContext {
  // Detected language/type — works with zero manifest files
  repoType: string;
  // Manifest (optional — many repos won't have one)
  manifestType?: "package.json" | "pyproject.toml" | "Cargo.toml" | "go.mod" | "pom.xml" | "Gemfile";
  packageName?: string;
  packageDescription?: string;
  packageVersion?: string;
  // README in any format
  readmePreview?: string;
  // First ~30 lines of the repo's main entry point
  entryPointPreview?: string;
  entryPointFile?: string;
  // Git log — always the most useful signal
  recentCommits: string[];
  // File tree: root-level + one level deep, all non-ignored files
  rootFiles: string[];
  // Code files in recognized source dirs (for display/filtering)
  sourceTree: string[];
}

export interface TuneupResult {
  score: number;
  contentScore: number;
  gaps: Gap[];
  contentGaps: Gap[];
  prompt: string;
  charter: string;
  perAgent: Record<string, string>;
}

const WEIGHTS = {
  mission: 15,
  objective: 15,
  "now-heading": 15,
  "agents-owned-areas": 10,
  "state-resume": 10,
  "plan-next": 10,
  "charter-present": 15,
  frontmatter: 10,
} as const;

const CONTENT_PENALTIES = {
  "mission-boilerplate": 30,
  "objective-generic": 25,
  "resume-note-game-progress": 25,
} as const;

const BOILERPLATE_PATTERNS: RegExp[] = [
  /minimal setup/i,
  /starter template/i,
  /template.*repo/i,
  /this template/i,
  /boilerplate/i,
  /vite.*react/i,
  /react.*vite/i,
  /vite.*hmr/i,
  /eslint.*rules/i,
  /hmr.*eslint/i,
  /getting started with/i,
  /scaffolding/i,
  /create-react-app/i,
  /next\.js.*starter/i,
  /hello[,\s]+world/i,
  /example project/i,
  /sample application/i,
  /demo repo/i,
];

const GENERIC_OBJECTIVE_PATTERNS: RegExp[] = [
  /^current session focus$/i,
  /^current.*focus$/i,
  /^session focus$/i,
  /^current milestone$/i,
  /^ongoing work$/i,
  /^working on it$/i,
  /^in progress$/i,
  /^tbd$/i,
  /^wip$/i,
  /^todo$/i,
  /^placeholder$/i,
  /^describe.*milestone/i,
  /^one sentence.*goal/i,
  /^describe the (current|specific) milestone/i,
];

const GAME_PROGRESS_PATTERNS: RegExp[] = [
  /approaching chapter/i,
  /chapter \d+/i,
  /\blevel \d+\b/i,
  /boss (defeated|fight|battle)/i,
  /defeated.*boss/i,
  /~\d+\s*hours (played|total|logged)/i,
  /\d+\/\d+ quests/i,
  /\d+\s*hours played/i,
  /main quest/i,
  /side quest/i,
  /\bxp\b|\bexperience points\b/i,
];

// Files and dirs to always skip during tree scan
const SKIP_NAMES = new Set([
  "node_modules", ".git", ".svn", "dist", "build", "out", "__pycache__",
  ".next", ".nuxt", "target", "vendor", "venv", ".venv", "env",
  "coverage", ".cache", ".parcel-cache", "tmp", ".tmp",
]);

// README filenames to try, in priority order
const README_CANDIDATES = [
  "README.md", "README.MD", "readme.md",
  "README.rst", "README.txt", "README.org", "README",
];

// Entry point candidates per repo type
const ENTRY_POINTS: Record<string, string[]> = {
  TypeScript: ["src/index.ts", "src/main.ts", "index.ts", "main.ts", "src/app.ts", "app.ts"],
  JavaScript: ["src/index.js", "index.js", "main.js", "src/main.js", "src/app.js", "app.js"],
  Python: ["main.py", "app.py", "__main__.py", "src/main.py", "cli.py", "bot.py", "run.py"],
  Rust: ["src/main.rs", "src/lib.rs"],
  Go: ["main.go", "cmd/main.go", "cmd/root.go"],
  Ruby: ["main.rb", "app.rb", "lib/main.rb", "bin/run"],
  "C#": ["Program.cs", "src/Program.cs"],
};

// ── Universal repo context gathering ─────────────────────────────────────────

export async function gatherRepoContext(rootDir: string): Promise<RepoContext> {
  const context: RepoContext = {
    repoType: "unknown",
    recentCommits: [],
    rootFiles: [],
    sourceTree: [],
  };

  // 1. Scan root-level files — this works for ANY repo
  context.rootFiles = await scanRootFiles(rootDir);

  // 2. Detect repo type from what's actually there
  context.repoType = detectRepoType(context.rootFiles);

  // 3. Read manifest (optional — many repos won't have one)
  await readManifest(rootDir, context);

  // 4. Read README in any format
  for (const name of README_CANDIDATES) {
    try {
      const raw = await readFile(join(rootDir, name), "utf8");
      context.readmePreview = raw.split(/\r?\n/).slice(0, 60).join("\n");
      break;
    } catch { /* try next */ }
  }

  // 5. Git log — always the richest signal
  try {
    const log = execFileSync("git", ["log", "--oneline", "-20"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    context.recentCommits = log
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => l.replace(/^[a-f0-9]+ /, "").trim());
  } catch { /* no git */ }

  // 6. Read entry point file for the detected repo type
  const epCandidates = ENTRY_POINTS[context.repoType] ?? [];
  for (const ep of epCandidates) {
    try {
      const raw = await readFile(join(rootDir, ep), "utf8");
      context.entryPointFile = ep;
      context.entryPointPreview = raw.split(/\r?\n/).slice(0, 30).join("\n");
      break;
    } catch { /* try next */ }
  }

  // 7. Source tree (best-effort, for display)
  await fillSourceTree(rootDir, context);

  return context;
}

async function scanRootFiles(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith(".") || e.name === ".repolog")
      .filter((e) => !SKIP_NAMES.has(e.name))
      .map((e) => e.name + (e.isDirectory() ? "/" : ""))
      .sort();
  } catch {
    return [];
  }
}

function detectRepoType(rootFiles: string[]): string {
  const names = new Set(rootFiles.map((f) => f.toLowerCase().replace(/\/$/, "")));
  if (names.has("package.json")) {
    // TS vs JS: look for tsconfig
    if (names.has("tsconfig.json") || rootFiles.some((f) => f.endsWith(".ts"))) return "TypeScript";
    return "JavaScript";
  }
  if (names.has("pyproject.toml") || names.has("setup.py") || names.has("requirements.txt")) return "Python";
  if (names.has("cargo.toml")) return "Rust";
  if (names.has("go.mod")) return "Go";
  if (names.has("gemfile") || rootFiles.some((f) => f.endsWith(".gemspec"))) return "Ruby";
  if (names.has("pom.xml") || names.has("build.gradle") || names.has("build.gradle.kts")) return "Java";
  if (rootFiles.some((f) => f.endsWith(".csproj") || f.endsWith(".sln"))) return "C#";
  if (names.has("cmakelists.txt")) return "C/C++";
  if (rootFiles.some((f) => f.endsWith(".tf"))) return "Terraform";
  if (rootFiles.some((f) => f.endsWith(".sh") || f.endsWith(".bash"))) return "Shell";
  if (rootFiles.every((f) => f.endsWith(".md") || f.endsWith(".txt") || f.endsWith(".rst"))) return "docs";
  return "unknown";
}

async function readManifest(rootDir: string, context: RepoContext): Promise<void> {
  // package.json
  try {
    const raw = await readFile(join(rootDir, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    context.manifestType = "package.json";
    if (typeof pkg.name === "string") context.packageName = pkg.name;
    if (typeof pkg.description === "string") context.packageDescription = pkg.description;
    if (typeof pkg.version === "string") context.packageVersion = pkg.version;
    return;
  } catch { /* try next */ }

  // pyproject.toml
  try {
    const raw = await readFile(join(rootDir, "pyproject.toml"), "utf8");
    context.manifestType = "pyproject.toml";
    const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
    const desc = /^\s*description\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
    if (name) context.packageName = name;
    if (desc) context.packageDescription = desc;
    return;
  } catch { /* try next */ }

  // Cargo.toml
  try {
    const raw = await readFile(join(rootDir, "Cargo.toml"), "utf8");
    context.manifestType = "Cargo.toml";
    const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
    const desc = /^\s*description\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
    if (name) context.packageName = name;
    if (desc) context.packageDescription = desc;
    return;
  } catch { /* try next */ }

  // go.mod
  try {
    const raw = await readFile(join(rootDir, "go.mod"), "utf8");
    context.manifestType = "go.mod";
    const mod = /^module\s+(\S+)/m.exec(raw)?.[1];
    if (mod) context.packageName = mod.split("/").pop();
    return;
  } catch { /* no manifest */ }
}

async function fillSourceTree(rootDir: string, context: RepoContext): Promise<void> {
  const SOURCE_DIRS = [
    "src", "lib", "app", "cmd", "source", "packages",
    "scripts", "tools", "core", "api", "server", "client",
    "backend", "frontend", "bot", "extension", "plugin",
  ];
  for (const dir of SOURCE_DIRS) {
    if (context.sourceTree.length >= 25) break;
    try {
      const entries = await listSourceFiles(join(rootDir, dir), dir);
      const remaining = 25 - context.sourceTree.length;
      context.sourceTree.push(...entries.slice(0, remaining));
    } catch { /* skip */ }
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
    const path = `${prefix}/${entry.name}`;
    if (entry.isFile()) {
      result.push(path);
    } else if (entry.isDirectory()) {
      try {
        const sub = await readdir(join(dir, entry.name), { withFileTypes: true });
        for (const subEntry of sub) {
          if (subEntry.isFile() && !subEntry.name.startsWith(".")) {
            result.push(`${path}/${subEntry.name}`);
          }
        }
      } catch { /* skip */ }
    }
  }
  return result;
}

// ── Main build function ───────────────────────────────────────────────────────

export async function buildTuneup(
  state: QuestState,
  _doctorReport: DoctorReport,
  rootDir?: string,
): Promise<TuneupResult> {
  const gaps: Gap[] = [];
  const contentGaps: Gap[] = [];
  let score = 0;
  let contentPenalty = 0;

  const context = rootDir ? await gatherRepoContext(rootDir) : null;

  // ── Structural: mission ──────────────────────────────────────────────────
  if (state.mission?.trim()) {
    score += WEIGHTS.mission;
    if (isBoilerplate(state.mission)) {
      contentGaps.push({
        id: "mission-boilerplate",
        severity: "high",
        file: "PLAN.md",
        heading: "## Mission",
        fix: "Boilerplate text — not a real description of this repo.",
        suggestedMarkdown: "",
        currentContent: state.mission,
      });
      contentPenalty += CONTENT_PENALTIES["mission-boilerplate"];
    }
  } else {
    gaps.push({
      id: "missing-mission",
      severity: "high",
      file: "PLAN.md",
      heading: "## Mission",
      fix: "Add a `## Mission` heading with one sentence describing what this repo is.",
      suggestedMarkdown: buildMissionMarkdown(state, context),
    });
  }

  // ── Structural: objective ────────────────────────────────────────────────
  if (state.activeQuest.title?.trim()) {
    score += WEIGHTS.objective;
    if (isGenericObjective(state.activeQuest.title)) {
      contentGaps.push({
        id: "objective-generic",
        severity: "high",
        file: state.activeQuest.doc ?? "PLAN.md",
        heading: "## Objective",
        fix: "Generic placeholder — an AI agent cannot determine the active milestone from this.",
        suggestedMarkdown: "",
        currentContent: state.activeQuest.title,
      });
      contentPenalty += CONTENT_PENALTIES["objective-generic"];
    }
  } else {
    gaps.push({
      id: "missing-objective",
      severity: "high",
      file: "PLAN.md",
      heading: "## Objective",
      fix: "Add a `## Objective` section with one sentence describing the active milestone.",
      suggestedMarkdown: buildObjectiveMarkdown(context),
    });
  }

  // ── Structural: now ──────────────────────────────────────────────────────
  if (state.now.length > 0) {
    score += WEIGHTS["now-heading"];
  } else {
    gaps.push({
      id: "empty-now",
      severity: "high",
      file: "PLAN.md",
      heading: "## Now",
      fix: "Add a `## Now` heading with at least one `- [ ]` item so RepoLog can surface active work.",
      suggestedMarkdown: buildNowMarkdown(context),
    });
  }

  // ── Structural: agents ───────────────────────────────────────────────────
  const agentsWithAreas = state.agents.filter((a) => a.area?.trim());
  if (agentsWithAreas.length > 0) {
    score += WEIGHTS["agents-owned-areas"];
  } else if (state.agents.length > 0) {
    const agentFile = state.agents[0]!.file;
    gaps.push({
      id: "agents-no-owned-areas",
      severity: "med",
      file: agentFile,
      heading: "## Owned Areas",
      fix: "Add `## Owned Areas` to each agent file listing the files or dirs that agent manages.",
      suggestedMarkdown: buildOwnedAreasMarkdown(context),
    });
  } else {
    gaps.push({
      id: "no-agent-files",
      severity: "med",
      file: "AGENTS.md",
      heading: "## Owned Areas",
      fix: "Add AGENTS.md, CLAUDE.md, or GEMINI.md with `## Role` and `## Owned Areas` sections.",
      suggestedMarkdown: buildAgentFileMarkdown(context),
    });
  }

  // ── Structural: resume note ──────────────────────────────────────────────
  if (state.resumeNote.task?.trim()) {
    score += WEIGHTS["state-resume"];
    if (isGameProgress(state.resumeNote.task)) {
      contentGaps.push({
        id: "resume-note-game-progress",
        severity: "high",
        file: "STATE.md",
        heading: "## Resume Note",
        fix: "Game state, not dev state — an AI agent cannot resume coding from this.",
        suggestedMarkdown: "",
        currentContent: state.resumeNote.task,
      });
      contentPenalty += CONTENT_PENALTIES["resume-note-game-progress"];
    }
  } else {
    gaps.push({
      id: "missing-resume",
      severity: "high",
      file: "STATE.md",
      heading: "## Resume Note",
      fix: "Add `## Resume Note` to STATE.md so an agent can answer \"where was I?\" on the next session.",
      suggestedMarkdown: buildResumeMarkdown(context),
    });
  }

  // ── Structural: next ─────────────────────────────────────────────────────
  if (state.next.length > 0) {
    score += WEIGHTS["plan-next"];
  } else {
    gaps.push({
      id: "empty-next",
      severity: "low",
      file: "PLAN.md",
      heading: "## Next",
      fix: "Add a `## Next` heading with `- [ ]` items so the HUD queue is non-empty.",
      suggestedMarkdown: "## Next\n\n- [ ] [upcoming task]\n",
    });
  }

  // ── Structural: charter ──────────────────────────────────────────────────
  if (state.config.charterPresent) {
    score += WEIGHTS["charter-present"];
  } else {
    gaps.push({
      id: "no-charter",
      severity: "med",
      file: ".repolog/CHARTER.md",
      heading: "CHARTER.md",
      fix: "Run `repolog tuneup --write-charter` to write `.repolog/CHARTER.md` — agents use this to write RepoLog-compatible markdown.",
      suggestedMarkdown: "",
    });
  }

  // ── Structural: frontmatter ──────────────────────────────────────────────
  if (state.config.hasFrontmatter) {
    score += WEIGHTS.frontmatter;
  } else {
    gaps.push({
      id: "no-frontmatter",
      severity: "low",
      file: "PLAN.md",
      heading: "frontmatter",
      fix: "Add YAML frontmatter to PLAN.md for richer metadata.",
      suggestedMarkdown: buildFrontmatterMarkdown(state, context),
    });
  }

  const contentScore = Math.max(0, 100 - contentPenalty);
  const charter = buildCharter(state, context);
  const prompt = buildPrompt(state, gaps, contentGaps, score, contentScore, charter, context);
  const perAgent = buildPerAgentPrompts(state, gaps, contentGaps, context);

  return { score, contentScore, gaps, contentGaps, prompt, charter, perAgent };
}

// ── Detection helpers ────────────────────────────────────────────────────────

function isBoilerplate(text: string): boolean {
  return BOILERPLATE_PATTERNS.some((p) => p.test(text));
}

function isGenericObjective(text: string): boolean {
  return GENERIC_OBJECTIVE_PATTERNS.some((p) => p.test(text.trim()));
}

function isGameProgress(text: string): boolean {
  return GAME_PROGRESS_PATTERNS.some((p) => p.test(text));
}

// ── Structural gap markdown generators — pre-populated from context ──────────
//
// These replace the old "[placeholder]" templates. When context exists, the
// AI agent gets a real candidate to verify. When context is absent, the hint
// is structural but still specific.

function buildMissionMarkdown(state: QuestState, context: RepoContext | null): string {
  const name = state.name || context?.packageName || "this-repo";
  const candidate = extractReadmeMission(context) ?? context?.packageDescription;
  if (candidate) {
    return `## Mission\n\n${candidate}\n`;
  }
  if (context?.recentCommits.length) {
    const hint = context.recentCommits.slice(0, 2).join("; ");
    return `## Mission\n\n${name} — [one sentence: what it does. Commits suggest: ${hint}]\n`;
  }
  return `## Mission\n\n${name} — [one sentence: what this repo does]\n`;
}

function buildObjectiveMarkdown(context: RepoContext | null): string {
  if (context?.recentCommits.length) {
    const candidate = synthesizeObjective(context.recentCommits.slice(0, 4));
    return `## Objective\n\n${candidate}\n`;
  }
  return `## Objective\n\n[one sentence: the active dev milestone]\n`;
}

function buildNowMarkdown(context: RepoContext | null): string {
  if (context?.recentCommits.length) {
    // Convert 2-3 recent commits into tasks — they're likely what's active
    const tasks = context.recentCommits
      .slice(0, 3)
      .map((c) => `- [ ] ${c}`)
      .join("\n");
    return `## Now\n\n${tasks}\n`;
  }
  return `## Now\n\n- [ ] [active task]\n`;
}

function buildResumeMarkdown(context: RepoContext | null): string {
  if (context?.recentCommits.length) {
    const last = context.recentCommits[0]!;
    const next = context.recentCommits[1] ?? "upcoming task";
    return `## Resume Note\n\n> Session N: ${last.toLowerCase()} — next: ${next.toLowerCase()}.\n`;
  }
  return `## Resume Note\n\n> Session N: [last task done] — next: [upcoming task].\n`;
}

function buildOwnedAreasMarkdown(context: RepoContext | null): string {
  const sourceDirs = context?.sourceTree
    .map((f) => f.split("/")[0])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 4)
    .map((d) => `- \`${d}/\` — [describe]`)
    .join("\n");
  return sourceDirs
    ? `## Owned Areas\n\n${sourceDirs}\n`
    : `## Owned Areas\n\n- \`src/\` — primary source\n`;
}

function buildAgentFileMarkdown(context: RepoContext | null): string {
  const areas = buildOwnedAreasMarkdown(context).replace("## Owned Areas", "").trim();
  return `## Role\n\n[one sentence describing this agent's responsibility]\n\n## Owned Areas\n\n${areas}\n`;
}

function buildFrontmatterMarkdown(state: QuestState, context: RepoContext | null): string {
  const title = context?.packageName ?? state.name ?? "Repo";
  return `---\ntitle: ${title}\nstatus: active\nowner: [agent-id]\n---\n`;
}

// ── Candidate generation — derives real suggestions from context ─────────────

function buildCandidate(gap: Gap, context: RepoContext | null, state: QuestState): string {
  const name = state.name || context?.packageName || "this repo";

  if (gap.id === "mission-boilerplate") {
    const fromReadme = extractReadmeMission(context);
    if (fromReadme) {
      return `One sentence. README suggests:\n  → _"${fromReadme}"_  *(verify and edit)*`;
    }
    if (context?.packageDescription) {
      return `One sentence. ${context.manifestType} description:\n  → _"${context.packageDescription}"_  *(verify and edit)*`;
    }
    if (context?.recentCommits.length) {
      return `One sentence describing what \`${name}\` does. Commits suggest:\n${context.recentCommits.slice(0, 3).map((c) => `  - ${c}`).join("\n")}\n  Synthesize into one line.`;
    }
    return `One sentence: what does \`${name}\` actually do? Check the README or git log and write it here.`;
  }

  if (gap.id === "objective-generic") {
    if (context?.recentCommits.length) {
      const top = context.recentCommits.slice(0, 4);
      const candidate = synthesizeObjective(top);
      return `One sentence — the active dev milestone. Recent commits:\n${top.map((c) => `  - ${c}`).join("\n")}\n  → _"${candidate}"_  *(verify)*`;
    }
    return `One sentence: what specific code deliverable is actively in progress? Not game state — a feature, fix, or release.`;
  }

  if (gap.id === "resume-note-game-progress") {
    if (context?.recentCommits.length) {
      const last = context.recentCommits[0]!;
      const next = context.recentCommits[1] ?? "upcoming task";
      return `Dev state, not game state. Last commit: _"${last}"_\n  → _"> Session N: ${last.toLowerCase()} — next: ${next.toLowerCase()}."_  *(edit before saving)*`;
    }
    return `Dev state, not game state.\n  → _"> Session N: [what was last coded] — next: [upcoming task]."_`;
  }

  return gap.suggestedMarkdown || "[add content here]";
}

function extractReadmeMission(context: RepoContext | null): string | undefined {
  if (!context?.readmePreview) return undefined;
  for (const line of context.readmePreview.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^[#>|]/.test(t)) continue;
    if (/^\[!\[/.test(t) || t.startsWith("<")) continue;
    if (/^[-*]{3,}$/.test(t)) continue;
    if (t.length < 15 || t.length > 280) continue;
    const sentence = t.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? t;
    if (sentence.length >= 15) return sentence;
  }
  return undefined;
}

function synthesizeObjective(commits: string[]): string {
  const words = commits.join(" ").toLowerCase();
  if (/vendor|npc/.test(words)) return "Complete NPC vendor lookup and integrate into the command flow.";
  if (/bounty/.test(words)) return "Ship the bounty board automation.";
  if (/economy|investment|camp/.test(words)) return "Stabilize the camp economy tracker.";
  if (/auth|login|token/.test(words)) return "Complete the authentication flow.";
  if (/api|endpoint|route/.test(words)) return "Finish the API integration layer.";
  if (/test|spec|coverage/.test(words)) return "Achieve full test coverage for core modules.";
  if (/fix|bug|crash|error/.test(words)) return "Resolve open bugs and stabilize for release.";
  if (/refactor|clean|extract/.test(words)) return "Complete the refactor and clear tech debt.";
  if (/deploy|release|ship/.test(words)) return "Ship the next release.";
  if (/docs|readme|doc/.test(words)) return "Complete documentation.";
  if (/ui|component|screen|view/.test(words)) return "Complete the UI layer.";
  if (/discord|bot|command/.test(words)) return "Stabilize bot commands and error handling.";
  const first = commits[0] ?? "complete current work";
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}.`;
}

// ── Prompt generation ────────────────────────────────────────────────────────

function buildPrompt(
  state: QuestState,
  gaps: Gap[],
  contentGaps: Gap[],
  score: number,
  contentScore: number,
  charter: string,
  context: RepoContext | null,
): string {
  const repoName = state.name || context?.packageName || "this repo";
  const hasAnyGaps = gaps.length > 0 || contentGaps.length > 0;

  const structStatus = gaps.length === 0
    ? `${score}/100 ✓`
    : `${score}/100 (${gaps.length} missing)`;
  const contentStatus = contentGaps.length === 0
    ? `${contentScore}/100 ✓`
    : `${contentScore}/100 — ${contentGaps.length} to rewrite`;

  const header = `# RepoLog Tuneup — \`${repoName}\`\nStructural ${structStatus}  ·  Content ${contentStatus}`;

  const contextBlock = buildContextBlock(context);

  const body = hasAnyGaps
    ? buildIssues(gaps, contentGaps, context, state)
    : "\n✓ Nothing to fix — structural and content scores are both clean.";

  const afterLine = "After: update `STATE.md` resume note · run `repolog doctor` · commit.";
  const charterBlock = `## CHARTER.md — Agent Conventions\n\n\`\`\`markdown\n${charter}\n\`\`\``;

  return [header, contextBlock, body, "---", afterLine, "---", charterBlock]
    .filter(Boolean)
    .join("\n\n");
}

function buildContextBlock(context: RepoContext | null): string {
  if (!context) return "";

  const hasData =
    context.readmePreview ||
    context.recentCommits.length > 0 ||
    context.rootFiles.length > 0 ||
    context.manifestType;
  if (!hasData) return "";

  const parts: string[] = ["---", "## Context"];

  // Repo type — always useful for the agent
  const typeLabel = context.manifestType
    ? `${context.repoType} (${context.manifestType}${context.packageName ? ` · \`${context.packageName}\`` : ""}${context.packageVersion ? ` v${context.packageVersion}` : ""})`
    : context.repoType !== "unknown"
      ? context.repoType
      : null;
  if (typeLabel) parts.push(`**Type:** ${typeLabel}`);

  // README excerpt — primary signal
  if (context.readmePreview) {
    const excerpt = extractReadmeExcerpt(context.readmePreview);
    if (excerpt.length > 0) {
      parts.push("**README:**\n```\n" + excerpt.join("\n") + "\n```");
    }
  }

  // Package description (if not in README)
  if (context.packageDescription && !context.readmePreview) {
    parts.push(`**Description:** "${context.packageDescription}"`);
  }

  // Entry point preview (when README is sparse or missing)
  if (context.entryPointPreview && !context.readmePreview) {
    const epLines = context.entryPointPreview.split("\n").slice(0, 15);
    parts.push(`**${context.entryPointFile ?? "entry point"}:**\n\`\`\`\n${epLines.join("\n")}\n\`\`\``);
  }

  // Git log
  if (context.recentCommits.length > 0) {
    parts.push("**Git log:**\n" + context.recentCommits.slice(0, 10).map((c) => `- ${c}`).join("\n"));
  }

  // File tree — always useful for repos with no docs
  if (context.rootFiles.length > 0) {
    const files = context.rootFiles.slice(0, 20).join("  ");
    parts.push(`**Files:** ${files}`);
  }

  // Source tree
  if (context.sourceTree.length > 0) {
    parts.push(`**Source:** ${context.sourceTree.slice(0, 15).join(" · ")}`);
  }

  return parts.join("\n\n");
}

function extractReadmeExcerpt(readmePreview: string): string[] {
  return readmePreview
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith("#")) return false;
      if (/^\[!\[/.test(t) || t.startsWith("<") || t.startsWith("|")) return false;
      if (/^[-*]{3,}$/.test(t)) return false;
      return true;
    })
    .slice(0, 6);
}

function buildIssues(
  gaps: Gap[],
  contentGaps: Gap[],
  context: RepoContext | null,
  state: QuestState,
): string {
  const parts: string[] = ["---"];
  let n = 1;

  for (const gap of gaps) {
    const mdBlock = gap.suggestedMarkdown.trim()
      ? "```markdown\n" + gap.suggestedMarkdown.trim() + "\n```"
      : "";
    const lines = [`## ${n} · \`${gap.file}\` ${gap.heading}`, `**Add:** ${gap.fix}`];
    if (mdBlock) lines.push(mdBlock);
    parts.push(lines.join("\n"));
    n++;
  }

  for (const gap of contentGaps) {
    const now = gap.currentContent
      ? `"${gap.currentContent.replace(/\n/g, " ").slice(0, 120)}"`
      : "(empty)";
    const candidate = buildCandidate(gap, context, state);
    parts.push(
      [`## ${n} · \`${gap.file}\` ${gap.heading}`, `**Now:** ${now}`, `**Problem:** ${gap.fix}`, `**Write:** ${candidate}`].join("\n"),
    );
    n++;
  }

  return parts.join("\n\n");
}

// ── Charter ──────────────────────────────────────────────────────────────────

function buildCharter(state: QuestState, context: RepoContext | null = null): string {
  const repoName = state.name || context?.packageName || "this repo";
  const agentList =
    state.agents.length > 0
      ? state.agents
          .map((a: AgentProfile) => `- **${a.name}** (\`${a.file}\`): ${a.area || "general"}`)
          .join("\n")
      : "- No agent files found. Add AGENTS.md, CLAUDE.md, or GEMINI.md.";

  const fileList =
    state.scannedFiles.length > 0
      ? state.scannedFiles.map((f) => `- ${f}`).join("\n")
      : "- No files scanned yet.";

  return `# RepoLog Charter — \`${repoName}\`

This repo uses **Repo Quest Log** to maintain a structured markdown dashboard.
Follow these conventions so RepoLog can parse your changes correctly.

## Required Headings

| File     | Heading        | Purpose                          |
|----------|----------------|----------------------------------|
| PLAN.md  | ## Objective   | One-sentence current milestone   |
| PLAN.md  | ## Now         | Active checklist (- [ ] items)   |
| PLAN.md  | ## Next        | Upcoming checklist               |
| PLAN.md  | ## Blocked     | Blocked items with reason        |
| STATE.md | ## Resume Note | Last-session dev summary         |

## Frontmatter (optional)

\`\`\`yaml
---
title: [Human-readable title]
status: active | paused | complete
owner: [agent-id]
---
\`\`\`

## Agent Files

Each agent file should contain:
- **## Owned Areas** — files/dirs this agent manages
- **## Role** — one sentence
- **## Objective** — current goal

Known agents: ${agentList}

## Rules

1. Checklist items: toggle \`[ ]\` → \`[x]\` only — do not rewrite task text.
2. Resume note: dev state only, not game/hobby progress.
3. Headings: do not rename or reorder — RepoLog uses exact regex.
4. Objective: one sentence, updated each session.
5. Frontmatter: preserve if present.
6. Mission/Objective must describe this specific repo, not a template default.

## Files Being Scanned

${fileList}`;
}

// ── Per-agent prompts ────────────────────────────────────────────────────────

function buildPerAgentPrompts(
  state: QuestState,
  gaps: Gap[],
  contentGaps: Gap[],
  context: RepoContext | null,
): Record<string, string> {
  const result: Record<string, string> = {};
  const repoName = state.name || context?.packageName || "this repo";
  const allGaps = [...gaps, ...contentGaps];

  for (const agent of state.agents) {
    const agentGaps = allGaps.filter(
      (g) => g.file === agent.file || g.id === "agents-no-owned-areas",
    );
    const otherGaps = allGaps.filter((g) => !agentGaps.includes(g));
    const orderedGaps = [...agentGaps, ...otherGaps];

    const ownedAreas = agent.area?.trim()
      ? agent.area
      : `(none defined — add ## Owned Areas to \`${agent.file}\`)`;

    const contextBlock = buildContextBlock(context);

    const issueLines =
      orderedGaps.length === 0
        ? "No gaps — nothing to fix."
        : orderedGaps
            .map((g, i) => {
              const now = g.currentContent
                ? `\n   Now: "${g.currentContent.replace(/\n/g, " ").slice(0, 80)}"`
                : "";
              const write =
                g.id in CONTENT_PENALTIES
                  ? `\n   Write: ${buildCandidate(g, context, state)}`
                  : `\n   Add:\n\`\`\`markdown\n${g.suggestedMarkdown.trim()}\n\`\`\``;
              return `${i + 1}. \`${g.file}\` ${g.heading} [${g.severity}]${now}${write}`;
            })
            .join("\n\n");

    result[agent.id] = [
      `# RepoLog Tuneup — ${agent.name}`,
      `Repo: \`${repoName}\`  ·  Owned: ${ownedAreas}`,
      contextBlock,
      "---",
      issueLines,
      "---",
      "After: update `STATE.md` resume note with dev state (not game progress) · run `repolog doctor`.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return result;
}
