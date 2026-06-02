import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import matter from "gray-matter";

import type { HandoffSettings, QuestState } from "./types.js";

export interface PromptPreset {
  id: string;
  glyph: string;
  label: string;
  sub: string;
  keywords: string;
  body: string;
  intentId?: string;
  source?: "builtin" | "user" | "repo";
}

export function buildContextPrompt(state: QuestState): string {
  return `I am resuming work on ${state.name} (branch: ${state.branch}).
Mission: ${state.mission}
Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total} · ${state.activeQuest.doc}${state.activeQuest.line ? `:${state.activeQuest.line}` : ""})
Current task: ${state.resumeNote.task}
Last touched: ${state.resumeNote.lastTouched} · ${state.resumeNote.since}
Please read ${state.resumeNote.lastTouched} and let's continue.`;
}

export function buildPromptPresets(state: QuestState, handoffSettings: HandoffSettings = {}): PromptPreset[] {
  const nowList = state.now.slice(0, 5).map((task, index) => `${index + 1}. ${task.text}${task.doc ? ` (${task.doc})` : ""}`).join("\n");
  const nextList = state.next.slice(0, 5).map((task, index) => `${index + 1}. ${task.text}`).join("\n");
  const activeBlocked = state.blocked.filter((task) => !isNoneBlocker(task.text, task.reason));
  const blockedList = activeBlocked.map((task, index) => `${index + 1}. ${task.text} — waiting on ${task.reason} (${task.since})`).join("\n");
  const agentList = state.agents.map((agent) => `- ${agent.name} (${agent.role}): ${agent.objective}`).join("\n");
  const activityList = (state.recentActivity ?? [])
    .slice(0, 5)
    .map((event) => `- ${event.kind.toUpperCase()} ${event.file}${event.outsideScope ? " (outside declared scope)" : ""}`)
    .join("\n");

  const resumeCore = `Repo: ${state.name} (branch: ${state.branch})
Mission: ${state.mission}
Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total})
Current task: ${state.resumeNote.task}
Last touched: ${state.resumeNote.lastTouched} · ${state.resumeNote.since}`;
  const sourceBlock = renderInstructionSources(state, handoffSettings);
  const currentFocus = state.now.length > 0
    ? nowList
    : `No current task is set. Treat "${state.resumeNote.task}" as stale context until you verify it in the repo docs.`;
  const sourceDocs = sourceDocList(state);

  return [
    {
      id: "resume-current-work",
      glyph: "R",
      label: "Resume current work",
      sub: "Continue from the current repo state",
      keywords: "resume continue current work handoff",
      intentId: "resume-current-work",
      body: `You are taking over an in-progress local repo session.

${resumeCore}
${sourceBlock}

Current focus:
${currentFocus}

First action:
1. Open the source docs listed below and confirm the actual current task.
2. Run a lightweight status check before editing.
3. If the next action is ambiguous, stop and ask instead of guessing.

Source docs to inspect:
${sourceDocs}

Working rules:
- Keep changes surgical.
- Do not rewrite repo docs unless asked.
- Report assumptions, files touched, and verification before handing back.`,
    },
    {
      id: "review-changes",
      glyph: "V",
      label: "Review changes",
      sub: "Check recent diffs and risks",
      keywords: "review changes diff risk",
      intentId: "review-changes",
      body: `Review contract: inspect the current repo changes and report risk.

${resumeCore}
${sourceBlock}

Current focus:
${currentFocus}

Recent activity:
${activityList || "(none)"}

Findings first:
- Bugs or regressions.
- Scope drift from the stated task.
- Missing tests or verification.
- Files that look unrelated.

Do not rewrite code during the review. If there are no meaningful changes, say that clearly and name the next useful check.`,
    },
    {
      id: "explain-recent-activity",
      glyph: "?",
      label: "Explain recent activity",
      sub: "Summarize what changed and why",
      keywords: "explain recent activity summary",
      intentId: "explain-recent-activity",
      body: `Explain what has happened in this repo recently.

${resumeCore}
${sourceBlock}

Recent activity:
${activityList || "(none)"}

If there is no recent activity, say so and use the objective, current focus, and source docs as context instead.

Output:
1. What changed.
2. Why it probably changed.
3. What is still uncertain.
4. The safest next check.`,
    },
    {
      id: "repair-repo-docs",
      glyph: "!",
      label: "Repair repo docs",
      sub: "Make planning docs useful again",
      keywords: "repair docs planning state agents",
      intentId: "repair-repo-docs",
      body: `Make the repo memory docs useful again without expanding scope.

${resumeCore}
${sourceBlock}

Current focus:
${currentFocus}

Blocked:
${blockedList || "No active blockers."}

First action:
1. Identify the smallest doc gap blocking a useful next handoff.
2. Propose exact markdown edits.
3. Do not write files unless explicitly asked.

Keep AGENTS.md generic unless the repo already has active provider-specific docs.`,
    },
    {
      id: "brief-fresh-session",
      glyph: "B",
      label: "Brief fresh session",
      sub: "Onboard a fresh agent session",
      keywords: "briefing intent onboard fresh",
      intentId: "brief-fresh-session",
      body: `Fresh-session brief for ${state.name}.

Mission: ${state.mission}
Current objective: ${state.activeQuest.title}
Branch: ${state.branch}
${sourceBlock}

Current focus:
${currentFocus}

Next (${state.next.length}):
${nextList || "(none)"}

Agent docs:
${agentList || "(none configured)"}

Start by restating the objective, the next concrete action, and any assumption you need confirmed before writing code.`,
    },
    {
      id: "standup",
      glyph: "*",
      label: "Daily standup",
      sub: "What's in flight + what's next",
      keywords: "standup daily update",
      intentId: "daily-standup",
      body: `Standup contract for ${state.name} (${state.branch}).

Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total})

Current focus:
${currentFocus}

Next:
${nextList || "(none)"}

Blocked:
${blockedList || "(none)"}

Recent activity:
${activityList || "(none)"}

Output:
1. What is in flight.
2. What changed since the last handoff.
3. Risks or asks.
4. The next concrete action.`,
    },
  ].map((preset) => ({ ...preset, source: "builtin" as const }));
}

function sourceDocList(state: QuestState): string {
  const docs = new Set<string>();
  for (const doc of [state.activeQuest.doc, state.resumeNote.lastTouched]) {
    if (doc && !doc.includes(" ")) docs.add(doc);
  }
  for (const agent of state.agents) {
    if (agent.status !== "archived" && agent.file) docs.add(agent.file);
  }
  return docs.size ? [...docs].map((doc) => `- ${doc}`).join("\n") : "- PLAN.md\n- STATE.md\n- AGENTS.md";
}

function isNoneBlocker(text: string, reason = ""): boolean {
  const normalized = `${text} ${reason}`.replace(/\s+/g, " ").trim().toLowerCase();
  return normalized === "none" || normalized === "none none" || /^none\b/.test(normalized);
}

export interface LoadPromptOptions {
  rootDir: string;
  userPromptDir?: string;
  repoPromptDir?: string;
  handoffSettings?: HandoffSettings;
}

export async function loadPromptPresets(
  state: QuestState,
  options: LoadPromptOptions,
): Promise<PromptPreset[]> {
  const builtins = buildPromptPresets(state, options.handoffSettings);
  const userDir = options.userPromptDir ?? defaultUserPromptDir();
  const repoDir = options.repoPromptDir ?? join(options.rootDir, ".repolog", "prompts");

  const userOverrides = await readPromptDir(userDir, "user", state);
  const repoOverrides = await readPromptDir(repoDir, "repo", state);

  const byId = new Map<string, PromptPreset>();
  for (const preset of builtins) byId.set(preset.id, preset);
  for (const preset of userOverrides) byId.set(preset.id, preset);
  for (const preset of repoOverrides) byId.set(preset.id, preset);

  return [...byId.values()];
}

function renderInstructionSources(state: QuestState, settings: HandoffSettings): string {
  const lines: string[] = [];
  if (settings.includePersonalGuideDefault && settings.personalAgentGuide?.trim()) {
    lines.push(`Personal Agent Guide:\n${settings.personalAgentGuide.trim()}`);
  }

  const includeDocs = settings.includeRepoAgentDocsDefault !== false;
  if (includeDocs) {
    const docs = [...new Set(state.agents.map((agent) => agent.file).filter(Boolean))];
    lines.push(`Instruction sources:\n${docs.length ? docs.map((doc) => `- ${doc}`).join("\n") : "- (none discovered)"}`);
  }

  if (settings.includeRecentActivityDefault) {
    const activity = (state.recentActivity ?? [])
      .slice(0, 5)
      .map((event) => `- ${event.kind.toUpperCase()} ${event.file}${event.outsideScope ? " (outside declared scope)" : ""}`)
      .join("\n");
    lines.push(`Recent activity:\n${activity || "(none)"}`);
  }

  return lines.length ? `\n${lines.join("\n\n")}\n` : "";
}

export function defaultUserPromptDir(): string {
  return join(homedir(), ".repolog", "prompts");
}

async function readPromptDir(
  dir: string,
  source: "user" | "repo",
  state: QuestState,
): Promise<PromptPreset[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const results: PromptPreset[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const full = resolve(dir, entry);
    try {
      const raw = await readFile(full, "utf8");
      const parsed = matter(raw);
      const data = parsed.data as Record<string, unknown>;
      const id = String(data.id ?? entry.replace(/\.md$/, ""));
      const preset: PromptPreset = {
        id,
        label: String(data.label ?? id),
        sub: String(data.sub ?? ""),
        glyph: String(data.glyph ?? "*"),
        keywords: String(data.keywords ?? id),
        body: renderTemplate(parsed.content.trim(), state),
        source,
      };
      results.push(preset);
    } catch {
      // skip malformed prompt files silently; doctor command will surface these later
    }
  }
  return results;
}

export function renderTemplate(template: string, state: QuestState): string {
  const nowList = state.now
    .slice(0, 5)
    .map((task, i) => `${i + 1}. ${task.text}${task.doc ? ` (${task.doc})` : ""}`)
    .join("\n");
  const nextList = state.next
    .slice(0, 5)
    .map((task, i) => `${i + 1}. ${task.text}`)
    .join("\n");
  const activeBlocked = state.blocked.filter((task) => !isNoneBlocker(task.text, task.reason));
  const blockedList = activeBlocked
    .map((task, i) => `${i + 1}. ${task.text} — waiting on ${task.reason} (${task.since})`)
    .join("\n");
  const agentList = state.agents
    .map((agent) => `- ${agent.name} (${agent.role}): ${agent.objective}`)
    .join("\n");

  const vars: Record<string, string> = {
    name: state.name,
    branch: state.branch,
    mission: state.mission,
    "objective.title": state.activeQuest.title,
    "objective.doc": state.activeQuest.doc,
    "objective.done": String(state.activeQuest.progress.done),
    "objective.total": String(state.activeQuest.progress.total),
    "resume.task": state.resumeNote.task,
    "resume.lastTouched": state.resumeNote.lastTouched,
    "resume.since": state.resumeNote.since,
    now: nowList || "(none)",
    next: nextList || "(none)",
    blocked: blockedList || "(none)",
    agents: agentList || "(none)",
  };

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}
