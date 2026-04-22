import type { DoctorReport } from "./doctor.js";
import type { AgentProfile, QuestState } from "./types.js";

export interface Gap {
  id: string;
  severity: "high" | "med" | "low";
  file: string;
  heading: string;
  fix: string;
  suggestedMarkdown: string;
}

export interface TuneupResult {
  score: number;
  gaps: Gap[];
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

export function buildTuneup(state: QuestState, _doctorReport: DoctorReport): TuneupResult {
  const gaps: Gap[] = [];
  let score = 0;

  if (state.mission?.trim()) {
    score += WEIGHTS.mission;
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

  if (state.activeQuest.title?.trim()) {
    score += WEIGHTS.objective;
  } else {
    gaps.push({
      id: "missing-objective",
      severity: "high",
      file: "PLAN.md",
      heading: "## Objective",
      fix: "Add a `## Objective` section. The first non-empty line becomes the title.",
      suggestedMarkdown: "## Objective\n\nDescribe the current milestone or goal in one sentence.\n",
    });
  }

  if (state.now.length > 0) {
    score += WEIGHTS["now-heading"];
  } else {
    gaps.push({
      id: "empty-now",
      severity: "high",
      file: "PLAN.md",
      heading: "## Now",
      fix: "Add a `## Now` heading with at least one `- [ ]` checklist item.",
      suggestedMarkdown: "## Now\n\n- [ ] First active task\n",
    });
  }

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

  if (state.resumeNote.task?.trim()) {
    score += WEIGHTS["state-resume"];
  } else {
    gaps.push({
      id: "missing-resume",
      severity: "high",
      file: "STATE.md",
      heading: "## Resume Note",
      fix: 'Add a `## Resume Note` section to STATE.md so RepoLog can answer "where was I?"',
      suggestedMarkdown: "## Resume Note\n\n> Session N: brief summary of what was done and what comes next.\n",
    });
  }

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

  const charter = buildCharter(state);
  const prompt = buildPrompt(state, gaps, score, charter);
  const perAgent = buildPerAgentPrompts(state, gaps);

  return { score, gaps, prompt, charter, perAgent };
}

function buildPrompt(state: QuestState, gaps: Gap[], score: number, charter: string): string {
  const repoName = state.name || "this repo";

  const gapList = gaps
    .map((gap) => {
      const md = gap.suggestedMarkdown
        ? `\n\n   Suggested markdown:\n   \`\`\`markdown\n${gap.suggestedMarkdown.split("\n").map((l) => `   ${l}`).join("\n").trimEnd()}\n   \`\`\``
        : "";
      return `- **${gap.id}** (${gap.severity}) — \`${gap.file}\`: ${gap.fix}${md}`;
    })
    .join("\n\n");

  const header = `# RepoLog Tuneup — \`${repoName}\`

This repo uses **Repo Quest Log** (RepoLog) to maintain a structured markdown dashboard for agents and humans. RepoLog reads specific headings from PLAN.md, STATE.md, AGENTS.md, and similar files to build a live HUD.

**Your task:** bring this repo to 100% RepoLog legibility. Current score: **${score}/100**.`;

  const body =
    gaps.length === 0
      ? "\n\nNo gaps found. This repo is already at 100% legibility."
      : `\n\n## Gaps to Fix\n\n${gapList}`;

  const footer = `\n\n## After Applying Changes

1. Run \`repolog doctor\` to verify findings.
2. Update \`STATE.md\` with a resume note describing what you changed.
3. If \`.repolog/CHARTER.md\` does not exist, run \`repolog tuneup --write-charter\` to generate it.

The charter below describes the conventions agents must follow when editing markdown in this repo.

## CHARTER.md Contents

\`\`\`markdown
${charter}
\`\`\`
`;

  return `${header}${body}${footer}`;
}

function buildCharter(state: QuestState): string {
  const repoName = state.name || "this repo";
  const agentList =
    state.agents.length > 0
      ? state.agents.map((a: AgentProfile) => `- **${a.name}** (\`${a.file}\`): ${a.area || "general"}`).join("\n")
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
2. **Resume note**: After any session, update the \`## Resume Note\` in STATE.md.
3. **Heading stability**: Do not rename or reorder required headings. RepoLog uses regex to find them.
4. **One objective**: Keep a single, clear sentence under \`## Objective\` in PLAN.md.
5. **Frontmatter**: If frontmatter is present, do not remove it.

## Source Files Being Scanned

${fileList}`;
}

function buildPerAgentPrompts(state: QuestState, gaps: Gap[]): Record<string, string> {
  const result: Record<string, string> = {};
  const repoName = state.name || "this repo";

  for (const agent of state.agents) {
    const agentGaps = gaps.filter((g) => g.file === agent.file || g.id === "agents-no-owned-areas");
    const otherGaps = gaps.filter((g) => !agentGaps.includes(g));
    const orderedGaps = [...agentGaps, ...otherGaps];

    const ownedAreas = agent.area?.trim()
      ? agent.area
      : `(not defined — add ## Owned Areas to \`${agent.file}\`)`;

    const gapLines =
      orderedGaps.length === 0
        ? "No gaps found."
        : orderedGaps.map((g) => `- **${g.id}** (${g.severity}) — \`${g.file}\`: ${g.fix}`).join("\n");

    result[agent.id] = `# RepoLog Tuneup — ${agent.name}

You are **${agent.name}** (id: \`${agent.id}\`), working in \`${repoName}\`.
Your owned areas: ${ownedAreas}

Your task: fix the RepoLog legibility gaps below, starting with any that touch your owned areas.

${gapLines}

After applying changes, update STATE.md with a resume note describing what you changed.
`;
  }

  return result;
}
