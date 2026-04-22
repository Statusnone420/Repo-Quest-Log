import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import matter from "gray-matter";

import type { QuestState } from "./types.js";

export interface PromptPreset {
  id: string;
  glyph: string;
  label: string;
  sub: string;
  keywords: string;
  body: string;
  source?: "builtin" | "user" | "repo";
}

export function buildContextPrompt(state: QuestState): string {
  return `I am resuming work on ${state.name} (branch: ${state.branch}).
Mission: ${state.mission}
Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total} · ${state.activeQuest.doc}${state.activeQuest.line ? `:${state.activeQuest.line}` : ""})
Current task: ${state.resumeNote.task}
Last touched: ${state.resumeNote.lastTouched} · idle ${state.resumeNote.since}
Please read ${state.resumeNote.lastTouched} and let's continue.`;
}

export function buildPromptPresets(state: QuestState): PromptPreset[] {
  const nowList = state.now.slice(0, 5).map((task, index) => `${index + 1}. ${task.text}${task.doc ? ` (${task.doc})` : ""}`).join("\n");
  const nextList = state.next.slice(0, 5).map((task, index) => `${index + 1}. ${task.text}`).join("\n");
  const blockedList = state.blocked.map((task, index) => `${index + 1}. ${task.text} — waiting on ${task.reason} (${task.since})`).join("\n");
  const agentList = state.agents.map((agent) => `- ${agent.name} (${agent.role}): ${agent.objective}`).join("\n");

  const resumeCore = `Repo: ${state.name} (branch: ${state.branch})
Mission: ${state.mission}
Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total})
Current task: ${state.resumeNote.task}
Last touched: ${state.resumeNote.lastTouched} · idle ${state.resumeNote.since}`;

  return [
    {
      id: "resume-claude",
      glyph: "C",
      label: "Resume for Claude Code",
      sub: "Paste into Claude with full context",
      keywords: "claude resume planner",
      body: `I'm resuming our Claude Code session.
${resumeCore}

Now:
${nowList || "(none)"}

Please read PLAN.md and STATE.md, then continue from "${state.resumeNote.task}".`,
    },
    {
      id: "resume-codex",
      glyph: "X",
      label: "Resume for Codex",
      sub: "Paste into Codex - implementer mode",
      keywords: "codex resume implementer",
      body: `Resuming Codex implementer session.
${resumeCore}

Read AGENTS.md for your instructions, then pick up the Now task:
${nowList || "(none)"}

Run npm run lint && npm test before committing.`,
    },
    {
      id: "resume-gemini",
      glyph: "G",
      label: "Resume for Gemini",
      sub: "Paste into Gemini - reviewer mode",
      keywords: "gemini resume reviewer",
      body: `Resuming Gemini reviewer session.
${resumeCore}

Read GEMINI.md for your scope. Recent work touches: ${state.resumeNote.lastTouched}.
Please review the latest diff against AGENTS.md constraints.`,
    },
    {
      id: "standup",
      glyph: "*",
      label: "Daily standup",
      sub: "What's in flight + what's next",
      keywords: "standup daily update",
      body: `Standup - ${state.name} (${state.branch})

Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total})

In flight:
${nowList || "(none)"}

Up next:
${nextList || "(none)"}

Blocked:
${blockedList || "(none)"}`,
    },
    {
      id: "blocker-summary",
      glyph: "!",
      label: "Blocker summary",
      sub: "For a human or agent to unblock",
      keywords: "blocker blocked waiting",
      body: `Blocker summary - ${state.name}

${blockedList || "No active blockers."}

Context: objective is "${state.activeQuest.title}". Resolving these unblocks: ${state.resumeNote.task}.`,
    },
    {
      id: "briefing",
      glyph: "B",
      label: "Repo intent briefing",
      sub: "Onboard a fresh agent session",
      keywords: "briefing intent onboard fresh",
      body: `Briefing: ${state.name}

Mission: ${state.mission}
Current objective: ${state.activeQuest.title}
Branch: ${state.branch}

Now (${state.now.length}):
${nowList || "(none)"}

Next (${state.next.length}):
${nextList || "(none)"}

Agents in this repo:
${agentList || "(none configured)"}

Start by reading PRD.md, PLAN.md, STATE.md. Then ask me what the current priority is before writing code.`,
    },
  ].map((preset) => ({ ...preset, source: "builtin" as const }));
}

export interface LoadPromptOptions {
  rootDir: string;
  userPromptDir?: string;
  repoPromptDir?: string;
}

export async function loadPromptPresets(
  state: QuestState,
  options: LoadPromptOptions,
): Promise<PromptPreset[]> {
  const builtins = buildPromptPresets(state);
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
  const blockedList = state.blocked
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
