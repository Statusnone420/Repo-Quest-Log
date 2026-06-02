import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("perf soak harness", () => {
  it("keeps the report but removes the disposable repo by default", async () => {
    const { stdout } = await execFileAsync("node", [
      "scripts/perf-soak.cjs",
      "--no-launch",
      "--events",
      "1",
      "--max-seconds",
      "2",
      "--interval-ms",
      "10",
    ], { cwd: process.cwd(), encoding: "utf8" });

    const reportPath = stdout.match(/RepoLog perf soak report: (.+)/)?.[1]?.trim();
    expect(reportPath).toBeTruthy();

    const report = JSON.parse(await readFile(reportPath!, "utf8")) as { repo: string };
    expect(existsSync(reportPath!)).toBe(true);
    expect(existsSync(report.repo)).toBe(false);
  });
});
