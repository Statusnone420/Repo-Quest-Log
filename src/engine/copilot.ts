import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createProviderRegistry, type CopilotAnswer, type LLMDiscoveryOptions, type LLMProvider, type LLMProviderDiscovery } from "./llm-providers.js";
import { readRepoConfig } from "./config.js";
import type { DoctorFinding, DoctorReport } from "./doctor.js";
import { runDoctor } from "./doctor.js";
import { scanRepo } from "./scan.js";
import type { CopilotProviderId, QuestState } from "./types.js";

export interface CopilotPromptInput {
  doctorReport: Pick<DoctorReport, "rootDir" | "scannedFiles" | "counts" | "findings" | "tuneup">;
  mdContents: Record<string, string>;
  userQuery: string;
}

export interface CopilotContext {
  repo: {
    name: string;
    branch: string;
    mission: string;
    objective: string;
    now: string[];
    next: string[];
    blocked: string[];
    agents: Array<{ id: string; name: string; objective: string; status: string }>;
    resumeNote: string;
  };
  doctorReport: CopilotPromptInput["doctorReport"];
  mdContents: Record<string, string>;
  userQuery: string;
}

export interface CopilotSessionResult {
  provider: CopilotProviderId;
  model: string;
  context: CopilotContext;
  request: ReturnType<typeof buildCopilotRequest>;
  response: CopilotAnswer;
}

export interface CopilotPromptBundle {
  systemPrompt: string;
  userPrompt: string;
}

export { type CopilotAnswer };

export function buildCopilotPrompt(input: CopilotPromptInput): CopilotPromptBundle {
  return {
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input),
  };
}

export function parseCopilotResponse(raw: string): CopilotAnswer | null {
  const json = extractJsonPayload(raw);
  if (!json) {
    return null;
  }

  try {
    const parsed = JSON.parse(json) as Partial<CopilotAnswer>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      analysis: typeof parsed.analysis === "string" ? parsed.analysis : "",
      fixes: typeof parsed.fixes === "string" ? parsed.fixes : "",
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      confidence: clampConfidence(parsed.confidence),
    };
  } catch {
    return null;
  }
}

export function buildCopilotRequest(input: CopilotPromptInput): { prompt: string; context: Record<string, unknown> } {
  const { systemPrompt, userPrompt } = buildCopilotPrompt(input);
  return {
    prompt: systemPrompt,
    context: {
      userPrompt,
      query: input.userQuery,
      docs: input.mdContents,
      doctorReport: {
        rootDir: input.doctorReport.rootDir,
        scannedFiles: input.doctorReport.scannedFiles,
        counts: input.doctorReport.counts,
        findings: input.doctorReport.findings,
        tuneup: input.doctorReport.tuneup,
      },
    },
  };
}

export async function buildCopilotContext(
  rootDir: string,
  state: QuestState,
  doctorReport: Pick<DoctorReport, "rootDir" | "scannedFiles" | "counts" | "findings" | "tuneup">,
  userQuery: string,
): Promise<CopilotContext> {
  const mdContents = await loadCopilotMarkdown(rootDir, state.scannedFiles);
  return {
    repo: {
      name: state.name,
      branch: state.branch,
      mission: state.mission,
      objective: state.activeQuest.title,
      now: state.now.map((task) => task.text),
      next: state.next.map((task) => task.text),
      blocked: state.blocked.map((task) => `${task.text} — ${task.reason}`),
      agents: state.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        objective: agent.objective,
        status: agent.status,
      })),
      resumeNote: `${state.resumeNote.task} · ${state.resumeNote.lastTouched} · ${state.resumeNote.since}`,
    },
    doctorReport,
    mdContents,
    userQuery,
  };
}

export async function resolveCopilotProvider(
  rootDir: string,
  options: LLMDiscoveryOptions = {},
): Promise<{ provider: LLMProvider; discovery: LLMProviderDiscovery; providers: LLMProviderDiscovery[] }> {
  const registry = createProviderRegistry(options);
  const config = await readRepoConfig(rootDir);
  const discoveries = registry.map((provider) => provider.describeAuth());

  const configuredName = config.llm?.provider;
  const configured = configuredName ? registry.find((entry) => entry.name === configuredName) : undefined;
  const authenticatedDiscovery = discoveries.find((provider) => provider.available && provider.tokenFound);
  const authenticated = authenticatedDiscovery
    ? registry.find((entry) => entry.name === authenticatedDiscovery.name)
    : undefined;
  const chosen = configured ?? authenticated ?? registry[0];
  if (!chosen) {
    throw new Error("No RepoBot providers are configured.");
  }

  const discovery = chosen.describeAuth();
  return { provider: chosen, discovery, providers: discoveries };
}

export async function runCopilotQuery(
  rootDir: string,
  userQuery: string,
  options: LLMDiscoveryOptions = {},
): Promise<CopilotSessionResult> {
  const state = await scanRepo(rootDir);
  const report = await runDoctor(rootDir);
  const context = await buildCopilotContext(rootDir, state, report, userQuery);
  const request = buildCopilotRequest({
    doctorReport: report,
    mdContents: context.mdContents,
    userQuery,
  });
  const { provider } = await resolveCopilotProvider(rootDir, options);
  const token = provider.discoverToken() ?? "";
  if (!provider.canDiscoverAuth()) {
    throw new Error(`No usable auth found for ${provider.name}.`);
  }
  const response = await provider.createClient(token).ask(request.prompt, request.context);
  return {
    provider: provider.name,
    model: provider.getModel(),
    context,
    request,
    response,
  };
}

export function formatCopilotResponse(result: CopilotSessionResult): string {
  const lines: string[] = [];
  lines.push(`RepoBot · ${result.provider} · ${result.model} · ${Math.round(result.response.confidence * 100)}%`);
  lines.push("");
  if (result.response.analysis) {
    lines.push("Analysis:");
    lines.push(result.response.analysis);
    lines.push("");
  }
  if (result.response.fixes) {
    lines.push("Fixes:");
    lines.push(result.response.fixes);
    lines.push("");
  }
  if (result.response.reasoning) {
    lines.push("Reasoning:");
    lines.push(result.response.reasoning);
    lines.push("");
  }
  lines.push("User query:");
  lines.push(result.context.userQuery);
  return lines.join("\n");
}

function buildSystemPrompt(): string {
  return [
    "You are RepoBot for RepoLog.",
    "Work only from the supplied repo markdown context and doctor findings.",
    "Return strict JSON only, with no markdown fences and no extra keys.",
    "Schema: { analysis: string, fixes: string, reasoning: string, confidence: number }",
    "analysis: short diagnosis of the issue.",
    "fixes: concise markdown-ready patch guidance with file references when possible.",
    "reasoning: why the fix is correct and what tradeoffs matter.",
    "confidence: a number from 0 to 1.",
    "If the context is incomplete, say so and lower confidence.",
  ].join(" ");
}

function buildUserPrompt(input: CopilotPromptInput): string {
  const findings = input.doctorReport.findings.map(formatFinding).join("\n");
  const docs = Object.entries(input.mdContents)
    .map(([file, content]) => `--- ${file} ---\n${content.trim()}`)
    .join("\n\n");

  return [
    `Repo root: ${input.doctorReport.rootDir}`,
    `User query: ${input.userQuery.trim()}`,
    "",
    `Scanned files: ${input.doctorReport.scannedFiles.join(", ") || "(none)"}`,
    `Counts: now=${input.doctorReport.counts.now}, next=${input.doctorReport.counts.next}, blocked=${input.doctorReport.counts.blocked}, agents=${input.doctorReport.counts.agents}, decisions=${input.doctorReport.counts.decisions}`,
    "",
    "Doctor findings:",
    findings || "(none)",
    "",
    "Markdown context:",
    docs || "(none)",
    "",
    "Respond with JSON only.",
  ].join("\n");
}

function formatFinding(finding: DoctorFinding): string {
  const detail = finding.suggestion ? ` | suggestion: ${finding.suggestion}` : "";
  return `- [${finding.severity}] ${finding.code}: ${finding.message}${detail}`;
}

function extractJsonPayload(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return fence[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return undefined;
}

function clampConfidence(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(1, Math.max(0, parsed));
}

async function loadCopilotMarkdown(rootDir: string, files: readonly string[]): Promise<Record<string, string>> {
  const relevant = files.filter((file) => /(?:^|[\\/])(PLAN|STATE|README|AGENTS|CLAUDE|GEMINI)\.md$/i.test(file) || /CHARTER\.md$/i.test(file));
  const selected = relevant.slice(0, 8);
  const result: Record<string, string> = {};

  for (const file of selected) {
    const full = join(rootDir, file);
    try {
      const raw = await readFile(full, "utf8");
      result[file] = raw.slice(0, 12000);
    } catch {
      // ignore missing docs; chat can still proceed with the rest of the context
    }
  }

  return result;
}
