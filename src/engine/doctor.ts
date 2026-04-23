import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { HEADING_PATTERNS } from "./fileset.js";
import { validateAndFillConfig } from "./config.js";
import { scanRepo } from "./scan.js";
import { buildTuneup, type TuneupResult } from "./tuneup.js";
import type { QuestState } from "./types.js";

export type DoctorSeverity = "ok" | "info" | "warn";

export interface DoctorFinding {
  severity: DoctorSeverity;
  code: string;
  message: string;
  why: string;
  fix: string;
  suggestion?: string;
}

export interface DoctorReport {
  rootDir: string;
  scannedFiles: string[];
  expectedDocs: Array<{ file: string; present: boolean }>;
  configStatus: "missing" | "ok" | "invalid";
  counts: { now: number; next: number; blocked: number; agents: number; decisions: number };
  findings: DoctorFinding[];
  state: QuestState;
  tuneup: Pick<TuneupResult, "score" | "contentScore" | "gaps" | "contentGaps">;
}

const EXPECTED_DOCS = ["PLAN.md", "STATE.md", "README.md"] as const;
const AGENT_DOCS = ["AGENTS.md", "CLAUDE.md", "GEMINI.md"] as const;

export async function runDoctor(rootDir: string): Promise<DoctorReport> {
  const absolute = resolve(rootDir);
  const state = await scanRepo(absolute);
  const findings: DoctorFinding[] = [];

  const expectedDocs = await Promise.all(
    EXPECTED_DOCS.map(async (file) => ({ file, present: await fileExists(resolve(absolute, file)) })),
  );
  for (const doc of expectedDocs) {
    if (!doc.present) {
      const planFix = "Create PLAN.md with `## Objective`, `## Now`, `## Next`, and `## Blocked` headings.";
      const stateFix = "Create STATE.md with a `## Resume Note` section.";
      const readmeFix = "Create README.md with one sentence explaining what this repo is.";
      findings.push({
        severity: "warn",
        code: `missing-${doc.file.toLowerCase()}`,
        message: `${doc.file} is missing at repo root.`,
        why: doc.file === "PLAN.md"
          ? "Without PLAN.md, RepoLog cannot explain the repo objective or current work."
          : doc.file === "STATE.md"
          ? "Without STATE.md, the next session has no stable resume note."
          : "Without README.md, RepoLog loses a useful fallback for the repo mission.",
        fix: doc.file === "PLAN.md" ? planFix : doc.file === "STATE.md" ? stateFix : readmeFix,
        suggestion: doc.file === "PLAN.md" ? planFix : doc.file === "STATE.md" ? stateFix : readmeFix,
      });
    }
  }

  const agentsPresent = await Promise.all(
    AGENT_DOCS.map(async (file) => ({ file, present: await fileExists(resolve(absolute, file)) })),
  );
  const anyAgentDoc = agentsPresent.some((doc) => doc.present);
  if (!anyAgentDoc) {
    findings.push({
      severity: "info",
      code: "no-agent-docs",
      message: "No AGENTS.md / CLAUDE.md / GEMINI.md found.",
      why: "Without an agent file, RepoLog cannot show who owns which part of the repo.",
      fix: "Add AGENTS.md with each agent's role, owned area, objective, and constraints.",
      suggestion: "Add AGENTS.md with each agent's role, owned area, objective, and constraints.",
    });
  }

  const configStatus = await probeConfig(absolute, findings);

  if (!state.now.length) {
    findings.push({
      severity: "warn",
      code: "empty-now",
      message: "Now bucket is empty.",
      why: "Without a Now section, RepoLog cannot show what should happen next.",
      fix: "Add `## Now` to PLAN.md with unchecked items like `- [ ] Ship the next release`.",
      suggestion: "Add `## Now` to PLAN.md with unchecked items like `- [ ] Ship the next release`.",
    });
  }
  if (!state.next.length) {
    findings.push({
      severity: "info",
      code: "empty-next",
      message: "Next bucket is empty.",
      why: "Without a Next section, handoff prompts have no follow-up work to reference.",
      fix: "Add `## Next` to PLAN.md with upcoming unchecked checklist items.",
      suggestion: "Add `## Next` to PLAN.md with upcoming unchecked checklist items.",
    });
  }
  if (!state.blocked.length) {
    findings.push({
      severity: "ok",
      code: "empty-blocked",
      message: "No blocked items detected.",
      why: "This is fine when nothing is blocked.",
      fix: "If something is waiting on a person or decision, add it under `## Blocked`.",
    });
  }

  if (!state.mission) {
    findings.push({
      severity: "warn",
      code: "missing-mission",
      message: "Mission could not be extracted.",
      why: "Without a mission sentence, RepoLog cannot summarize the repo at a glance.",
      fix: "Add `## Mission` to PLAN.md or README.md with one sentence describing the repo.",
      suggestion: "Add `## Mission` to PLAN.md or README.md with one sentence describing the repo.",
    });
  }

  if (!state.activeQuest.title) {
    findings.push({
      severity: "warn",
      code: "missing-objective",
      message: "Objective title could not be extracted.",
      why: "Without an Objective, agents can misunderstand scope and work on the wrong task.",
      fix: "Add `## Objective` near the top of PLAN.md with 1 to 2 sentences describing what this repo aims to become.",
      suggestion: "Add `## Objective` near the top of PLAN.md with 1 to 2 sentences describing what this repo aims to become.",
    });
  }

  if (!state.scannedFiles.length) {
    findings.push({
      severity: "warn",
      code: "no-scanned-files",
      message: "No markdown files matched the scanner.",
      why: "Without supported markdown files, RepoLog has no local context to display.",
      fix: `Create one of: ${[...EXPECTED_DOCS, ...AGENT_DOCS].join(", ")}.`,
      suggestion: `Create one of: ${[...EXPECTED_DOCS, ...AGENT_DOCS].join(", ")}.`,
    });
  }

  findings.sort((a, b) => findingOrder(a.code) - findingOrder(b.code));

  if (!findings.some((finding) => finding.severity === "warn")) {
    findings.unshift({
      severity: "ok",
      code: "all-clear",
      message: "No blocking issues detected.",
      why: "RepoLog found enough structure to build the panel.",
      fix: "No required fix. Keep PLAN.md and STATE.md current as work changes.",
    });
  }

  const partialReport = {
    rootDir: absolute,
    scannedFiles: state.scannedFiles,
    expectedDocs,
    configStatus,
    counts: {
      now: state.now.length,
      next: state.next.length,
      blocked: state.blocked.length,
      agents: state.agents.length,
      decisions: state.decisions.length,
    },
    findings,
    state,
    tuneup: { score: 0, contentScore: 100, gaps: [] as TuneupResult["gaps"], contentGaps: [] as TuneupResult["contentGaps"] },
  };

  const { score, contentScore, gaps, contentGaps } = await buildTuneup(state, partialReport as DoctorReport, absolute);
  partialReport.tuneup = { score, contentScore, gaps, contentGaps };

  return partialReport as DoctorReport;
}

function findingOrder(code: string): number {
  if (code === "missing-plan.md") return 10;
  if (code === "missing-state.md") return 20;
  if (code === "missing-objective") return 30;
  if (code === "empty-now") return 40;
  if (code === "missing-readme.md" || code === "missing-mission" || code === "no-scanned-files" || code === "no-agent-docs") return 50;
  if (code === "invalid-config" || code === "empty-next" || code === "empty-blocked") return 60;
  return 100;
}

async function probeConfig(rootDir: string, findings: DoctorFinding[]): Promise<"missing" | "ok" | "invalid"> {
  const path = resolve(rootDir, ".repolog.json");
  try {
    const raw = await readFile(path, "utf8");
    validateAndFillConfig(JSON.parse(raw));
    return "ok";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "missing";
    }
    findings.push({
      severity: "warn",
      code: "invalid-config",
      message: ".repolog.json is present but could not be parsed.",
      why: "Invalid settings make RepoLog fall back to defaults.",
      fix: "Fix the JSON and keep these keys only: excludes, writeback, prompts.dir, watch.debounce, watch.reportFileChanges, schemaVersion.",
      suggestion: "Fix the JSON and keep these keys only: excludes, writeback, prompts.dir, watch.debounce, watch.reportFileChanges, schemaVersion.",
    });
    return "invalid";
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  const mark = (severity: DoctorSeverity): string =>
    severity === "warn" ? "!" : severity === "info" ? "i" : "+";

  lines.push(`repolog doctor · ${report.rootDir}`);
  lines.push("");
  lines.push(`Scanned ${report.scannedFiles.length} file(s)${report.scannedFiles.length ? `: ${report.scannedFiles.join(", ")}` : ""}`);
  lines.push(
    `Counts  now=${report.counts.now}  next=${report.counts.next}  blocked=${report.counts.blocked}  agents=${report.counts.agents}  decisions=${report.counts.decisions}`,
  );
  lines.push(`Config  ${report.configStatus}`);
  lines.push("");

  const missingExpected = report.expectedDocs.filter((doc) => !doc.present);
  if (missingExpected.length) {
    lines.push(`Missing expected docs: ${missingExpected.map((doc) => doc.file).join(", ")}`);
    lines.push("");
  }

  lines.push("Findings:");
  for (const finding of report.findings) {
    lines.push(`  [${mark(finding.severity)}] ${finding.code}: ${finding.message}`);
    lines.push(`      why: ${finding.why}`);
    lines.push(`      fix: ${finding.fix}`);
  }

  lines.push("");
  lines.push("Heading patterns (from docs/SCHEMA.md):");
  for (const [bucket, pattern] of Object.entries(HEADING_PATTERNS)) {
    lines.push(`  ${bucket.padEnd(12)} ${pattern.source}`);
  }

  return lines.join("\n");
}
