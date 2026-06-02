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
  const lastTouched = promptSafeLastTouched(state);
  const objectiveDoc = promptSafeObjectiveDoc(state);
  return `I am resuming work on ${state.name} (branch: ${state.branch}).
Mission: ${state.mission}
Objective: ${state.activeQuest.title} (${formatProgress(state.activeQuest.progress.done, state.activeQuest.progress.total)} · ${objectiveDoc}${state.activeQuest.line && objectiveDoc === state.activeQuest.doc ? `:${state.activeQuest.line}` : ""})
Current task: ${state.resumeNote.task}
Last touched: ${lastTouched} · ${state.resumeNote.since}
Please read ${lastTouched} and let's continue.`;
}

export function buildPromptPresets(state: QuestState, handoffSettings: HandoffSettings = {}): PromptPreset[] {
  const effectiveSettings = normalizeHandoffSettings(handoffSettings);
  const nowList = state.now.slice(0, 5).map((task, index) => `${index + 1}. ${task.text}${task.doc ? ` (${task.doc})` : ""}`).join("\n");
  const nextList = state.next.slice(0, 5).map((task, index) => `${index + 1}. ${task.text}`).join("\n");
  const activeBlocked = state.blocked.filter((task) => !isNoneBlocker(task.text, task.reason));
  const blockedList = activeBlocked.map((task, index) => `${index + 1}. ${task.text} — waiting on ${task.reason} (${task.since})`).join("\n");
  const activeAgents = state.agents.filter((agent) => agent.status !== "archived");
  const agentList = activeAgents.map((agent) => `- ${agent.name} (${agent.role}): ${agent.objective}`).join("\n");
  const activityList = recentEvidenceList(state);
  const progress = formatProgress(state.activeQuest.progress.done, state.activeQuest.progress.total);

  const resumeCore = `Repo: ${state.name} (branch: ${state.branch})
Mission: ${state.mission}
Objective: ${state.activeQuest.title} (${progress})
Current task: ${state.resumeNote.task}
Last touched: ${promptSafeLastTouched(state)} · ${state.resumeNote.since}`;
  const sourceBlock = renderInstructionSources(state, effectiveSettings);
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
      body: `You are taking over an in-progress local repo session. Your job is to recover the real next action, then continue only when the repo evidence supports it.

Situation:
${resumeCore}

Current focus:
${currentFocus}

Recent evidence:
${activityList || "(none)"}
${sourceBlock}

Source docs to inspect:
${sourceDocs}

Start here:
1. Read the source docs above and confirm whether the current task is still real.
2. Check repo status and the smallest relevant diff before editing.
3. Name the next concrete action in one sentence.

Stop and ask if:
- The docs disagree about the current task.
- The next action would require changing unrelated files.
- You cannot verify the repo state cheaply.

Output:
- Assumptions you are making.
- The next action you will take.
- Files you expect to touch.
- The verification you will run before handing back.`,
    },
    {
      id: "review-changes",
      glyph: "V",
      label: "Review changes",
      sub: "Check recent diffs and risks",
      keywords: "review changes diff risk",
      intentId: "review-changes",
      body: `Review contract: inspect the current repo changes and report risk. Do not edit files during this handoff.

Situation:
${resumeCore}

Current focus:
${currentFocus}

Recent evidence:
${activityList || "(none)"}
${sourceBlock}

Start here:
1. Inspect git status and the files listed in recent evidence.
2. Compare the changes against the current task and source docs.
3. Separate real issues from cosmetic preferences.

Stop and ask if:
- The requested review target is unclear.
- The branch has generated or unrelated changes you cannot attribute.
- You would need to run destructive commands to continue.

Output:
- Findings first, ordered by severity.
- Scope drift or unrelated files.
- Missing tests or verification.
- If clean, say so and name the remaining residual risk.`,
    },
    {
      id: "explain-recent-activity",
      glyph: "?",
      label: "Explain recent activity",
      sub: "Summarize what changed and why",
      keywords: "explain recent activity summary",
      intentId: "explain-recent-activity",
      body: `Explain what has happened in this repo recently as a plain-English timeline for a human who lost context.

Situation:
${resumeCore}

Current focus:
${currentFocus}

Recent evidence:
${activityList || "(none)"}
${sourceBlock}

Start here:
1. Group the recent evidence into a short timeline.
2. Tie each change back to the current objective when possible.
3. Call out what is inferred versus confirmed.

Stop and ask if:
- The user needs code changes instead of an explanation.
- The evidence is too stale to infer what happened.
- A claim would require reading files you have not inspected.

Output:
- What changed.
- Why it probably changed.
- What is still uncertain.
- The safest next check.`,
    },
    {
      id: "repair-repo-docs",
      glyph: "!",
      label: "Repair repo docs",
      sub: "Make planning docs useful again",
      keywords: "repair docs planning state agents",
      intentId: "repair-repo-docs",
      body: `Make the repo memory docs useful again without expanding scope. Do not write repo files unless the human explicitly approves the edit.

Situation:
${resumeCore}

Current focus:
${currentFocus}

Blocked:
${blockedList || "No active blockers."}

Recent evidence:
${activityList || "(none)"}
${sourceBlock}

Start here:
1. Identify the smallest stale or missing doc fact that blocks a useful handoff.
2. Propose exact markdown edits for only that gap.
3. Keep AGENTS.md generic unless active provider-specific docs already exist.

Stop and ask if:
- The docs conflict and the right source of truth is unclear.
- The repair would rewrite product direction instead of clarifying state.
- The human has not approved repo-file writes.

Output:
- The doc gap.
- The proposed edit.
- Why it is safe and scoped.
- Whether a file write is being requested or only proposed.`,
    },
    {
      id: "brief-fresh-session",
      glyph: "B",
      label: "Brief fresh session",
      sub: "Onboard a fresh agent session",
      keywords: "briefing intent onboard fresh",
      intentId: "brief-fresh-session",
      body: `Fresh-session brief for ${state.name}. Use this to onboard a brand-new agent without assuming they know the project.

Situation:
${resumeCore}

Current focus:
${currentFocus}

Next (${state.next.length}):
${nextList || "(none)"}

Agent docs:
${agentList || "(none configured)"}
${sourceBlock}

Recent evidence:
${activityList || "(none)"}

Start here:
1. Restate the repo mission and current objective in plain language.
2. Identify the next concrete action and the docs to read first.
3. Name any assumption that must be confirmed before code changes.

Stop and ask if:
- There is no credible current task.
- The agent docs appear archived or provider-specific in a way that does not apply.
- The next action would require new product direction.

Output:
- One-paragraph project brief.
- Current task and likely next action.
- Docs to read first.
- Assumptions needing confirmation.`,
    },
    {
      id: "standup",
      glyph: "*",
      label: "Daily standup",
      sub: "What's in flight + what's next",
      keywords: "standup daily update",
      intentId: "daily-standup",
      body: `Standup contract for ${state.name} (${state.branch}). Produce a short operator update, not a narrative.

Situation:
${resumeCore}

Current focus:
${currentFocus}

Next:
${nextList || "(none)"}

Blocked:
${blockedList || "(none)"}

Recent evidence:
${activityList || "(none)"}

Start here:
1. Summarize what is in flight.
2. Summarize what changed since the last handoff.
3. Identify the next concrete action.

Stop and ask if:
- There is no current task and the user expects a work plan.
- Blockers are ambiguous or stale.
- You cannot distinguish recent evidence from old repo history.

Output:
1. In flight.
2. Recent change.
3. Risks or asks.
4. Next action.`,
    },
  ].map((preset) => ({ ...preset, source: "builtin" as const }));
}

function formatProgress(done: number, total: number): string {
  return total > 0 ? `${done}/${total}` : "progress not set";
}

function recentEvidenceList(state: QuestState): string {
  const activity = (state.recentActivity ?? [])
    .slice(0, 5)
    .map((event) => `- ${event.kind.toUpperCase()} ${event.file}${event.outsideScope ? " (outside declared scope)" : ""}`);
  if (activity.length) return activity.join("\n");

  const changes = (state.recentChanges ?? [])
    .slice(0, 5)
    .map((change) => `- ${change.file}${change.diff ? ` (${change.diff})` : ""}${change.at ? ` · ${change.at}` : ""}`);
  return changes.join("\n");
}

function sourceDocList(state: QuestState): string {
  const docs = new Set<string>();
  for (const doc of [promptSafeObjectiveDoc(state), promptSafeLastTouched(state)]) {
    if (doc && !doc.includes(" ") && !isArchivedDoc(state, doc)) docs.add(doc);
  }
  for (const agent of state.agents) {
    if (agent.status !== "archived" && agent.file) docs.add(agent.file);
  }
  return docs.size ? [...docs].map((doc) => `- ${doc}`).join("\n") : "- PLAN.md\n- STATE.md\n- AGENTS.md";
}

function isArchivedDoc(state: QuestState, doc: string): boolean {
  return state.agents.some((agent) => agent.status === "archived" && agent.file === doc);
}

function promptSafeLastTouched(state: QuestState): string {
  const lastTouched = state.resumeNote.lastTouched;
  if (lastTouched && !isArchivedDoc(state, lastTouched)) {
    return lastTouched;
  }
  if (state.resumeNote.doc && !isArchivedDoc(state, state.resumeNote.doc)) {
    return state.resumeNote.doc;
  }
  return promptSafeObjectiveDoc(state);
}

function promptSafeObjectiveDoc(state: QuestState): string {
  if (state.activeQuest.doc && !isArchivedDoc(state, state.activeQuest.doc)) {
    return state.activeQuest.doc;
  }
  if (state.resumeNote.doc && !isArchivedDoc(state, state.resumeNote.doc)) {
    return state.resumeNote.doc;
  }
  const activeAgentDoc = state.agents.find((agent) => agent.status !== "archived" && agent.file)?.file;
  return activeAgentDoc || "PLAN.md";
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

function normalizeHandoffSettings(settings: HandoffSettings): Required<Pick<HandoffSettings,
  "instructionSourceSelection" |
  "includePersonalGuideDefault" |
  "includeRepoAgentDocsDefault" |
  "includeRecentActivityDefault"
>> & Pick<HandoffSettings, "personalAgentGuide"> {
  const rawSelection = settings.instructionSourceSelection;
  const hasSelection = Array.isArray(rawSelection);
  const selection = hasSelection
    ? rawSelection.filter((item): item is string => typeof item === "string")
    : [];
  const selected = new Set(selection);
  return {
    personalAgentGuide: settings.personalAgentGuide,
    instructionSourceSelection: selection,
    includePersonalGuideDefault: hasSelection
      ? selected.has("personal-agent-guide")
      : settings.includePersonalGuideDefault === true,
    includeRepoAgentDocsDefault: hasSelection
      ? selected.has("repo-agent-docs")
      : settings.includeRepoAgentDocsDefault !== false,
    includeRecentActivityDefault: hasSelection
      ? selected.has("recent-activity")
      : settings.includeRecentActivityDefault !== false,
  };
}

function renderInstructionSources(state: QuestState, settings: ReturnType<typeof normalizeHandoffSettings>): string {
  const lines: string[] = [];
  if (settings.includePersonalGuideDefault && settings.personalAgentGuide?.trim()) {
    lines.push(`Personal Agent Guide:\n${settings.personalAgentGuide.trim()}`);
  }

  const includeDocs = settings.includeRepoAgentDocsDefault !== false;
  if (includeDocs) {
    const docs = [...new Set(state.agents
      .filter((agent) => agent.status !== "archived")
      .map((agent) => agent.file)
      .filter(Boolean))];
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
    .filter((agent) => agent.status !== "archived")
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
    "resume.lastTouched": promptSafeLastTouched(state),
    "resume.since": state.resumeNote.since,
    now: nowList || "(none)",
    next: nextList || "(none)",
    blocked: blockedList || "(none)",
    agents: agentList || "(none)",
  };

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}
