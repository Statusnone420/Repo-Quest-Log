import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { buildCopilotPrompt, buildCopilotRequest, formatCopilotResponse, parseCopilotResponse, resolveCopilotProvider, runCopilotQuery } from "../src/engine/copilot.js";
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

  it("falls back to an authenticated provider when the configured one is missing", async () => {
    const homeDir = await mktempDir("repolog-copilot-home-");
    const repoRoot = await mktempDir("repolog-copilot-repo-");

    try {
      await writeFile(
        join(repoRoot, ".repolog.json"),
        JSON.stringify({ llm: { provider: "anthropic" } }, null, 2),
        "utf8",
      );
      await writeFile(join(homeDir, ".config", "openai", "auth.json"), JSON.stringify({ api_key: "openai-secret" }), "utf8");

      const result = await resolveCopilotProvider(repoRoot, { homeDir });

      expect(result.provider.name).toBe("openai");
      expect(result.discovery.available).toBe(true);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
      await rm(repoRoot, { recursive: true, force: true });
    }
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

async function mktempDir(prefix: string): Promise<string> {
  const root = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(join(root, ".config", "openai"), { recursive: true });
  await mkdir(join(root, ".config", "gcloud"), { recursive: true });
  await mkdir(join(root, ".claude"), { recursive: true });
  await mkdir(join(root, ".repolog"), { recursive: true });
  return root;
}
