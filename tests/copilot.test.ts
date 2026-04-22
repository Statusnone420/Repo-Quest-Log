import { afterEach, describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";

import { buildCopilotPrompt, buildCopilotRequest, formatCopilotResponse, parseCopilotResponse, runCopilotQuery } from "../src/engine/copilot.js";
import type { DoctorReport } from "../src/engine/doctor.js";

describe("copilot prompt engineering", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a strict JSON-only prompt from doctor report context", () => {
    const report = sampleReport();
    const prompt = buildCopilotPrompt({
      doctorReport: report,
      mdContents: {
        "PLAN.md": "## Objective\nShip it.\n",
        "STATE.md": "## Resume Note\n> keep going\n",
      },
      userQuery: "Fix the Now section",
    });

    expect(prompt.systemPrompt).toContain("Return strict JSON only");
    expect(prompt.userPrompt).toContain("Fix the Now section");
    expect(prompt.userPrompt).toContain("Doctor findings:");
    expect(prompt.userPrompt).toContain("PLAN.md");

    const request = buildCopilotRequest({
      doctorReport: report,
      mdContents: {
        "PLAN.md": "## Objective\nShip it.\n",
      },
      userQuery: "Update objective",
    });

    expect(request.prompt).toContain("RepoBot for RepoLog");
    expect(request.context.userPrompt).toContain("Update objective");
  });

  it("parses fenced JSON responses into the copilot answer shape", () => {
    const parsed = parseCopilotResponse([
      "Here is the result:",
      "```json",
      JSON.stringify(
        {
          analysis: "The objective is stale.",
          fixes: "Update PLAN.md",
          reasoning: "The current objective conflicts with the plan.",
          confidence: 0.84,
        },
        null,
        2,
      ),
      "```",
    ].join("\n"));

    expect(parsed).toEqual({
      analysis: "The objective is stale.",
      fixes: "Update PLAN.md",
      reasoning: "The current objective conflicts with the plan.",
      confidence: 0.84,
    });
  });

  it("runs a RepoBot query against the fixture repo with the fallback provider", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      message: {
        content: JSON.stringify({
          analysis: "The repo needs a clearer objective.",
          fixes: "Update PLAN.md and STATE.md",
          reasoning: "The scan context shows the objective is underspecified.",
          confidence: 0.88,
        }),
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    const result = await runCopilotQuery(resolve("tests/fixtures/auth-repo"), "Fix the repo summary");

    expect(result.provider).toBe("local-ollama");
    expect(result.response.analysis).toContain("clearer objective");
    expect(formatCopilotResponse(result)).toContain("RepoBot");
    expect(result.context.userQuery).toBe("Fix the repo summary");
  });
});

function sampleReport(): Pick<DoctorReport, "rootDir" | "scannedFiles" | "counts" | "findings" | "tuneup"> {
  return {
    rootDir: "D:/Repo Quest Log",
    scannedFiles: ["PLAN.md", "STATE.md"],
    counts: { now: 1, next: 1, blocked: 0, agents: 1, decisions: 0 },
    findings: [
      {
        severity: "warn",
        code: "missing-objective",
        message: "Objective is missing.",
        suggestion: "Add ## Objective to PLAN.md.",
      },
    ],
    tuneup: { score: 72, gaps: [] },
  };
}
