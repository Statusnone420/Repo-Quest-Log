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
      findings.push({
        severity: "warn",
        code: `missing-${doc.file.toLowerCase()}`,
        message: `${doc.file} is missing at repo root.`,
        suggestion: doc.file === "PLAN.md"
          ? "Add PLAN.md with `## Objective`, `## Now`, `## Next`, and `## Blocked` headings so RepoLog can explain what this repo is trying to become and what to do next."
          : doc.file === "STATE.md"
          ? "Add STATE.md with a `## Resume Note` section so the HUD can answer \"where was I?\" for the next agent."
          : "Add README.md so the scanner has a mission fallback.",
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
      suggestion: "Add at least one agent file to populate the Agents rail and enable activity inference.",
    });
  }

  const configStatus = await probeConfig(absolute, findings);

  if (!state.now.length) {
    findings.push({
      severity: "warn",
      code: "empty-now",
      message: "Now bucket is empty.",
      suggestion: "Add a `## Now` (or `## Current` / `## In Progress`) heading with `- [ ]` checklist items in PLAN.md.",
    });
  }
  if (!state.next.length) {
    findings.push({
      severity: "info",
      code: "empty-next",
      message: "Next bucket is empty.",
      suggestion: "Add a `## Next` (or `## Upcoming` / `## Queue`) heading with upcoming `- [ ]` items.",
    });
  }
  if (!state.blocked.length) {
    findings.push({
      severity: "ok",
      code: "empty-blocked",
      message: "No blocked items detected.",
    });
  }

  if (!state.mission) {
    findings.push({
      severity: "warn",
      code: "missing-mission",
      message: "Mission could not be extracted.",
      suggestion: "Add a `## Mission` heading to PLAN.md or README.md with one sentence describing what this repo is.",
    });
  }

  if (!state.activeQuest.title) {
    findings.push({
      severity: "warn",
      code: "missing-objective",
      message: "Objective title could not be extracted.",
      suggestion: "Add a `## Objective` section in PLAN.md with 1 to 2 sentences describing what this repo aims to become. RepoLog uses that heading to anchor the current milestone.",
    });
  }

  if (!state.scannedFiles.length) {
    findings.push({
      severity: "warn",
      code: "no-scanned-files",
      message: "No markdown files matched the scanner.",
      suggestion: `Create one of: ${[...EXPECTED_DOCS, ...AGENT_DOCS].join(", ")} or rename existing docs to match (see docs/SCHEMA.md extraction table).`,
    });
  }

  if (!findings.some((finding) => finding.severity === "warn")) {
    findings.unshift({
      severity: "ok",
      code: "all-clear",
      message: "No blocking issues detected.",
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
      suggestion: "Validate the file as JSON and keep only supported keys: excludes, writeback, prompts.dir, watch.debounce, watch.reportFileChanges, and schemaVersion.",
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
    if (finding.suggestion) {
      lines.push(`      → ${finding.suggestion}`);
    }
  }

  lines.push("");
  lines.push("Heading patterns (from docs/SCHEMA.md):");
  for (const [bucket, pattern] of Object.entries(HEADING_PATTERNS)) {
    lines.push(`  ${bucket.padEnd(12)} ${pattern.source}`);
  }

  return lines.join("\n");
}
