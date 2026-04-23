import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatDoctorReport, runDoctor } from "../src/engine/doctor.js";

describe("runDoctor", () => {
  it("flags missing expected docs and empty Now bucket on a messy repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-doctor-messy-"));
    await writeFile(join(root, "README.md"), "# project\n\nsome prose with no heading structure.\n", "utf8");

    const report = await runDoctor(root);

    expect(report.counts.now).toBe(0);
    expect(report.configStatus).toBe("missing");
    expect(report.findings.some((f) => f.code === "missing-plan.md")).toBe(true);
    expect(report.findings.some((f) => f.code === "missing-state.md")).toBe(true);
    expect(report.findings.some((f) => f.code === "empty-now")).toBe(true);
    expect(report.findings.some((f) => f.code === "no-agent-docs")).toBe(true);
    expect(report.findings.every((f) => f.why && f.fix)).toBe(true);
    expect(report.findings.map((f) => f.code).slice(0, 4)).toEqual([
      "missing-plan.md",
      "missing-state.md",
      "missing-objective",
      "empty-now",
    ]);

    const formatted = formatDoctorReport(report);
    expect(formatted).toContain("Findings:");
    expect(formatted).toContain("missing-plan.md");
    expect(formatted).toContain("why:");
    expect(formatted).toContain("fix:");
    expect(formatted).toContain("Create PLAN.md");
  });

  it("reports invalid .repolog.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-doctor-badconfig-"));
    await writeFile(join(root, "PLAN.md"), "## Objective\nShip it\n\n## Now\n- [ ] one thing\n", "utf8");
    await writeFile(join(root, ".repolog.json"), "{ not valid json", "utf8");

    const report = await runDoctor(root);
    expect(report.configStatus).toBe("invalid");
    expect(report.findings.some((f) => f.code === "invalid-config")).toBe(true);
  });

  it("returns an all-clear when the repo has the expected structure", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-doctor-healthy-"));
    await writeFile(
      join(root, "PLAN.md"),
      "## Mission\nA thing.\n\n## Objective\nShip v1\n\n## Now\n- [ ] do the work\n\n## Next\n- [ ] the next thing\n",
      "utf8",
    );
    await writeFile(join(root, "STATE.md"), "## Resume Note\n> go go go\n", "utf8");
    await writeFile(join(root, "README.md"), "# project\n", "utf8");
    await writeFile(join(root, "AGENTS.md"), "# Agents\n\n## Codex\nImplementer.\n", "utf8");
    await mkdir(join(root, ".git"), { recursive: true });

    const report = await runDoctor(root);
    expect(report.counts.now).toBeGreaterThan(0);
    expect(report.findings.some((f) => f.code === "all-clear")).toBe(true);
  });
});
