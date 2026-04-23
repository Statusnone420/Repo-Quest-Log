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
  manifestType?: "package.json" | "pyproject.toml" | "Cargo.toml";
  packageName?: string;
  packageDescription?: string;
  packageVersion?: string;
  readmePreview?: string;
  recentCommits: string[];
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

export async function gatherRepoContext(rootDir: string): Promise<RepoContext> {
  const context: RepoContext = { recentCommits: [], sourceTree: [] };

  // Manifest: package.json → pyproject.toml → Cargo.toml
  try {
    const raw = await readFile(join(rootDir, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    context.manifestType = "package.json";
    if (typeof pkg.name === "string") context.packageName = pkg.name;
    if (typeof pkg.description === "string") context.packageDescription = pkg.description;
    if (typeof pkg.version === "string") context.packageVersion = pkg.version;
  } catch {
    try {
      const raw = await readFile(join(rootDir, "pyproject.toml"), "utf8");
      context.manifestType = "pyproject.toml";
      const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
      const desc = /^\s*description\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
      if (name) context.packageName = name;
      if (desc) context.packageDescription = desc;
    } catch {
      try {
        const raw = await readFile(join(rootDir, "Cargo.toml"), "utf8");
        context.manifestType = "Cargo.toml";
        const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
        const desc = /^\s*description\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
        if (name) context.packageName = name;
        if (desc) context.packageDescription = desc;
      } catch { /* no manifest */ }
    }
  }

  // README preview (first 60 lines)
  try {
    const raw = await readFile(join(rootDir, "README.md"), "utf8");
    context.readmePreview = raw.split(/\r?\n/).slice(0, 60).join("\n");
  } catch { /* no README */ }

  // Recent git commits (oneline, message only)
  try {
    const log = execFileSync("git", ["log", "--oneline", "-20"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    context.recentCommits = log.split(/\r?\n/).filter(Boolean).map((l) => l.replace(/^[a-f0-9]+ /, "").trim());
  } catch { /* no git */ }

  // Source file tree (up to 30 entries, 2 levels deep)
  for (const dir of ["src", "lib", "app", "cmd", "source", "packages"]) {
    if (context.sourceTree.length >= 30) break;
    try {
      const entries = await listSourceFiles(join(rootDir, dir), dir);
      const remaining = 30 - context.sourceTree.length;
      context.sourceTree.push(...entries.slice(0, remaining));
    } catch { /* dir doesn't exist */ }
  }

  return context;
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
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
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
      const hints = buildMissionHints(state, context);
      contentGaps.push({
        id: "mission-boilerplate",
        severity: "high",
        file: "PLAN.md",
        heading: "## Mission",
        fix: "Replace with a real one-sentence description of what this repo does. Current text is boilerplate.",
        suggestedMarkdown: hints.suggested,
        currentContent: state.mission,
        contextHints: hints.clues || undefined,
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
      suggestedMarkdown: "## Mission\n\n> One sentence: what this repo is trying to become.\n",
    });
  }

  // ── Structural: objective ────────────────────────────────────────────────
  if (state.activeQuest.title?.trim()) {
    score += WEIGHTS.objective;
    if (isGenericObjective(state.activeQuest.title)) {
      const commitHint = context?.recentCommits.length
        ? `Recent commits: ${context.recentCommits.slice(0, 5).join("; ")}`
        : undefined;
      contentGaps.push({
        id: "objective-generic",
        severity: "high",
        file: state.activeQuest.doc ?? "PLAN.md",
        heading: "## Objective",
        fix: `Replace with the actual current development milestone. "${state.activeQuest.title}" is a placeholder.`,
        suggestedMarkdown:
          "## Objective\n\nDescribe the specific milestone you are driving toward right now in one clear sentence.\n",
        currentContent: state.activeQuest.title,
        contextHints: commitHint,
      });
      contentPenalty += CONTENT_PENALTIES["objective-generic"];
    }
  } else {
    gaps.push({
      id: "missing-objective",
      severity: "high",
      file: "PLAN.md",
      heading: "## Objective",
      fix: "Add a `## Objective` section with 1 to 2 sentences describing what this repo aims to become.",
      suggestedMarkdown: "## Objective\n\nDescribe the current milestone or goal in one sentence.\n",
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
      fix: "Add a `## Now` heading with at least one unchecked checklist item so RepoLog can surface active work.",
      suggestedMarkdown: "## Now\n\n- [ ] First active task\n",
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
      fix: "Add `## Owned Areas` to each agent file listing the files or directories that agent manages.",
      suggestedMarkdown: "## Owned Areas\n\n- `src/` — primary source files\n- `docs/` — documentation\n",
    });
  } else {
    gaps.push({
      id: "no-agent-files",
      severity: "med",
      file: "AGENTS.md",
      heading: "## Owned Areas",
      fix: "Add AGENTS.md, CLAUDE.md, or GEMINI.md with a `## Owned Areas` section.",
      suggestedMarkdown:
        "## Role\n\nAgent responsible for implementation tasks.\n\n## Owned Areas\n\n- `src/` — primary source files\n",
    });
  }

  // ── Structural: resume note ──────────────────────────────────────────────
  if (state.resumeNote.task?.trim()) {
    score += WEIGHTS["state-resume"];
    if (isGameProgress(state.resumeNote.task)) {
      const commitHint = context?.recentCommits.length
        ? `Recent commits suggest actual dev work: ${context.recentCommits.slice(0, 5).join("; ")}`
        : undefined;
      contentGaps.push({
        id: "resume-note-game-progress",
        severity: "high",
        file: "STATE.md",
        heading: "## Resume Note",
        fix: "This describes game state, not development work. An AI agent cannot resume coding from this. Replace with what was last worked on in the codebase.",
        suggestedMarkdown:
          "## Resume Note\n\n> Session N: describe what you last worked on and what comes next in development.\n",
        currentContent: state.resumeNote.task,
        contextHints: commitHint,
      });
      contentPenalty += CONTENT_PENALTIES["resume-note-game-progress"];
    }
  } else {
    gaps.push({
      id: "missing-resume",
      severity: "high",
      file: "STATE.md",
      heading: "## Resume Note",
      fix: 'Add a `## Resume Note` section to STATE.md so RepoLog can answer "where was I?" for the next agent.',
      suggestedMarkdown: "## Resume Note\n\n> Session N: brief summary of what was done and what comes next.\n",
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
      fix: "Add a `## Next` heading with upcoming `- [ ]` items so the HUD can show the queue.",
      suggestedMarkdown: "## Next\n\n- [ ] Upcoming task or milestone\n",
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
      fix: "Run `repolog tuneup --write-charter` to generate `.repolog/CHARTER.md` so agents know how to write markdown RepoLog can read.",
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
      fix: "Add YAML frontmatter to PLAN.md or STATE.md for richer metadata (title, status, owner).",
      suggestedMarkdown: "---\ntitle: Repo Name\nstatus: active\nowner: team\n---\n",
    });
  }

  const contentScore = Math.max(0, 100 - contentPenalty);
  const charter = buildCharter(state);
  const prompt = buildPrompt(state, gaps, contentGaps, score, contentScore, charter, context);
  const perAgent = buildPerAgentPrompts(state, gaps, contentGaps);

  return { score, contentScore, gaps, contentGaps, prompt, charter, perAgent };
}

// ── Content quality helpers ──────────────────────────────────────────────────

function isBoilerplate(text: string): boolean {
  return BOILERPLATE_PATTERNS.some((p) => p.test(text));
}

function isGenericObjective(text: string): boolean {
  return GENERIC_OBJECTIVE_PATTERNS.some((p) => p.test(text.trim()));
}

function isGameProgress(text: string): boolean {
  return GAME_PROGRESS_PATTERNS.some((p) => p.test(text));
}

function buildMissionHints(
  state: QuestState,
  context: RepoContext | null,
): { suggested: string; clues: string } {
  const clues: string[] = [];
  if (context?.packageName) clues.push(`Package name: \`${context.packageName}\``);
  if (context?.packageDescription) clues.push(`Package description: "${context.packageDescription}"`);
  if (context?.recentCommits.length) {
    clues.push(`Recent commits: ${context.recentCommits.slice(0, 5).join("; ")}`);
  }
  if (context?.sourceTree.length) {
    clues.push(`Source files: ${context.sourceTree.slice(0, 10).join(", ")}`);
  }
  const name = state.name || context?.packageName || "this repo";
  const suggested = `## Mission\n\n${name} — [one sentence describing what this repo actually does, derived from the context clues above].\n`;
  return { suggested, clues: clues.join("\n") };
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
  const repoName = state.name || "this repo";
  const hasAnyGaps = gaps.length > 0 || contentGaps.length > 0;

  const structLine =
    gaps.length === 0
      ? `**Structural score: ${score}/100** ✓ — all required sections present`
      : `**Structural score: ${score}/100** — ${gaps.length} structural gap${gaps.length !== 1 ? "s" : ""} found`;

  const contentLine =
    contentGaps.length === 0
      ? `**Content quality: ${contentScore}/100** ✓ — content looks accurate`
      : `**Content quality: ${contentScore}/100** — ${contentGaps.length} content quality issue${contentGaps.length !== 1 ? "s" : ""} found`;

  const header = `# RepoLog Tuneup — \`${repoName}\`

${structLine}
${contentLine}`;

  const fingerprint = buildFingerprint(context);

  const body = hasAnyGaps
    ? buildGapSection(gaps, contentGaps)
    : "\n\n✓ No gaps found. This repo has strong structural completeness and accurate content.";

  const footer = `\n\n## After Applying Changes

1. Run \`repolog doctor\` to verify findings.
2. Update \`STATE.md\` with a resume note describing what you changed in development terms.
3. If \`.repolog/CHARTER.md\` does not exist, run \`repolog tuneup --write-charter\` to generate it.
4. Re-run \`repolog doctor\` after the edits land.

The charter below describes the conventions agents must follow when editing markdown in this repo.

## CHARTER.md Contents

\`\`\`markdown
${charter}
\`\`\`
`;

  return `${header}${fingerprint}${body}${footer}`;
}

function buildFingerprint(context: RepoContext | null): string {
  if (!context) return "";
  if (!context.manifestType && !context.recentCommits.length && !context.sourceTree.length) return "";

  const lines: string[] = ["\n\n## Repo Fingerprint\n"];
  lines.push(
    "RepoLog gathered this context from your repo to help AI agents write accurate, specific content:\n",
  );

  if (context.manifestType) {
    const desc = context.packageDescription
      ? ` — "${context.packageDescription}"`
      : " — no description field set";
    lines.push(`**Manifest (${context.manifestType}):** \`${context.packageName ?? "unknown"}\`${context.packageVersion ? ` v${context.packageVersion}` : ""}${desc}`);
  }

  if (context.recentCommits.length > 0) {
    lines.push("\n**Recent commits:**");
    for (const commit of context.recentCommits.slice(0, 12)) {
      lines.push(`- ${commit}`);
    }
  }

  if (context.sourceTree.length > 0) {
    lines.push(`\n**Source tree:** \`${context.sourceTree.slice(0, 20).join("`, `")}\``);
  }

  return lines.join("\n");
}

function buildGapSection(gaps: Gap[], contentGaps: Gap[]): string {
  const parts: string[] = [];

  if (gaps.length > 0) {
    parts.push(
      "\n\n## Structural Gaps\n\nThese required sections are missing or empty. Add them so RepoLog can display your dashboard correctly.\n",
    );
    for (const [index, gap] of gaps.entries()) {
      const mdBlock = gap.suggestedMarkdown.trim()
        ? `\n   \`\`\`markdown\n${gap.suggestedMarkdown
            .split("\n")
            .map((l) => `   ${l}`)
            .join("\n")
            .trimEnd()}\n   \`\`\``
        : "";
      parts.push(
        `${index + 1}. **${gap.heading}** (\`${gap.file}\`) [${gap.severity.toUpperCase()}]\n   ${gap.fix}${mdBlock}`,
      );
    }
  }

  if (contentGaps.length > 0) {
    parts.push(
      "\n\n## Content Quality Issues\n\nThese sections exist but contain inaccurate, generic, or boilerplate content. Replace the content with accurate, specific information derived from the Repo Fingerprint above.\n",
    );
    for (const [index, gap] of contentGaps.entries()) {
      const currentBlock = gap.currentContent
        ? `\n\n   **Currently reads:**\n   > ${gap.currentContent.split("\n").join("\n   > ")}\n`
        : "";
      const hintsBlock = gap.contextHints
        ? `\n   **Context clues for replacement:**\n   ${gap.contextHints.split("\n").join("\n   ")}\n`
        : "";
      const mdBlock = gap.suggestedMarkdown.trim()
        ? `\n   **Suggested replacement:**\n   \`\`\`markdown\n${gap.suggestedMarkdown
            .split("\n")
            .map((l) => `   ${l}`)
            .join("\n")
            .trimEnd()}\n   \`\`\``
        : "";
      parts.push(
        `${index + 1}. **${gap.heading}** (\`${gap.file}\`) [${gap.severity.toUpperCase()}]\n   ${gap.fix}${currentBlock}${hintsBlock}${mdBlock}`,
      );
    }
  }

  return parts.join("\n\n");
}

// ── Charter ──────────────────────────────────────────────────────────────────

function buildCharter(state: QuestState): string {
  const repoName = state.name || "this repo";
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
If you are an agent editing markdown files in this repo, follow these conventions
so RepoLog can parse your changes correctly.

## Required Headings

RepoLog reads the following headings. Use these exact names (case-insensitive):

| File      | Heading        | Purpose                                    |
|-----------|----------------|--------------------------------------------|
| PLAN.md   | ## Objective   | One-sentence current milestone             |
| PLAN.md   | ## Now         | Active checklist (- [ ] items)             |
| PLAN.md   | ## Next        | Upcoming checklist (- [ ] items)           |
| PLAN.md   | ## Blocked     | Blocked items with reason                  |
| STATE.md  | ## Resume Note | One-line summary of last session           |

## Frontmatter Conventions

Optional YAML frontmatter at the top of PLAN.md or STATE.md:

\`\`\`yaml
---
title: Human-readable title
status: active | paused | complete
owner: team-name or agent-id
---
\`\`\`

## Agent Files

Each agent file (AGENTS.md, CLAUDE.md, GEMINI.md, etc.) should contain:

- **## Owned Areas** — list of files/directories this agent manages
- **## Role** — one-sentence description of the agent's responsibility
- **## Objective** — current goal for this agent

Known agents in this repo:

${agentList}

## How Agents Should Update Markdown

1. **Checklist items only**: Only toggle \`[ ]\` to \`[x]\` for completed tasks. Do not rewrite task text.
2. **Resume note**: After any session, update the \`## Resume Note\` in STATE.md with what you worked on in development terms.
3. **Heading stability**: Do not rename or reorder required headings. RepoLog uses regex to find them.
4. **One objective**: Keep a single, clear sentence under \`## Objective\` in PLAN.md.
5. **Frontmatter**: If frontmatter is present, do not remove it.
6. **No boilerplate**: Mission and Objective must describe this specific repo, not template defaults.

## Source Files Being Scanned

${fileList}`;
}

// ── Per-agent prompts ────────────────────────────────────────────────────────

function buildPerAgentPrompts(
  state: QuestState,
  gaps: Gap[],
  contentGaps: Gap[],
): Record<string, string> {
  const result: Record<string, string> = {};
  const repoName = state.name || "this repo";
  const allGaps = [...gaps, ...contentGaps];

  for (const agent of state.agents) {
    const agentGaps = allGaps.filter(
      (g) => g.file === agent.file || g.id === "agents-no-owned-areas",
    );
    const otherGaps = allGaps.filter((g) => !agentGaps.includes(g));
    const orderedGaps = [...agentGaps, ...otherGaps];

    const ownedAreas = agent.area?.trim()
      ? agent.area
      : `(not defined — add ## Owned Areas to \`${agent.file}\`)`;

    const gapLines =
      orderedGaps.length === 0
        ? "No gaps found."
        : orderedGaps
            .map((g) => {
              const current = g.currentContent
                ? `\n  Currently reads: "${g.currentContent.replace(/\n/g, " ").slice(0, 100)}"`
                : "";
              return `- **${g.id}** (${g.severity}) — \`${g.file}\`: ${g.fix}${current}`;
            })
            .join("\n");

    result[agent.id] = `# RepoLog Tuneup — ${agent.name}

You are **${agent.name}** (id: \`${agent.id}\`), working in \`${repoName}\`.
Your owned areas: ${ownedAreas}

Your task: fix the RepoLog legibility gaps below, starting with any that touch your owned areas.
Content quality issues include the current bad content so you know exactly what to replace.

${gapLines}

After applying changes, update STATE.md with a resume note describing what you changed in development terms (not game progress).
`;
  }

  return result;
}
