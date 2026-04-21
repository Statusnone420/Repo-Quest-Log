import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { scanRepo } from "../src/engine/scan.js";

describe("scanRepo", () => {
  it("includes git diff stats on recent changes when the repo is tracked", async () => {
    const cwd = join(tmpdir(), `repo-quest-log-scan-${Date.now()}`);
    await mkdir(cwd, { recursive: true });

    try {
      await writeRepoFile(cwd, "PLAN.md", "# Plan\n\n- [ ] First task\n");
      await writeRepoFile(cwd, "STATE.md", "# State\n");
      await writeRepoFile(cwd, "README.md", "# Readme\n");
      await writeRepoFile(cwd, "AGENTS.md", "# Agents\n");

      execFileSync("git", ["init"], { cwd, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Repo Quest Log"], { cwd, stdio: "ignore" });
      execFileSync("git", ["add", "."], { cwd, stdio: "ignore" });
      execFileSync("git", ["commit", "-m", "initial"], { cwd, stdio: "ignore" });

      await writeRepoFile(cwd, "PLAN.md", "# Plan\n\n- [ ] First task\n- [ ] Second task\n");

      const state = await scanRepo(cwd);

      expect(state.recentChanges[0]?.file).toBe("PLAN.md");
      expect(state.recentChanges[0]?.diff).toContain("+1");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("ignores archived markdown docs by default", async () => {
    const cwd = join(tmpdir(), `repo-quest-log-scan-${Date.now()}-archived`);
    await mkdir(join(cwd, "docs", "Archived"), { recursive: true });

    try {
      await writeRepoFile(cwd, "PLAN.md", "# Plan\n\n- [ ] First task\n");
      await writeRepoFile(cwd, "STATE.md", "# State\n");
      await writeRepoFile(cwd, "README.md", "# Readme\n");
      await writeRepoFile(cwd, "AGENTS.md", "# Agents\n");
      await writeRepoFile(cwd, "docs/Archived/implementation_plan.md", "# Archived plan\n\n- [ ] stale\n");

      const state = await scanRepo(cwd);

      expect(state.scannedFiles).not.toContain("docs/Archived/implementation_plan.md");
      expect(state.recentChanges.some((change) => change.file.includes("Archived"))).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("respects excludes from .repolog.json", async () => {
    const cwd = join(tmpdir(), `repo-quest-log-scan-${Date.now()}-exclude`);
    await mkdir(join(cwd, "docs", "Notes"), { recursive: true });

    try {
      await writeRepoFile(cwd, "PLAN.md", "# Plan\n\n- [ ] First task\n");
      await writeRepoFile(cwd, "STATE.md", "# State\n");
      await writeRepoFile(cwd, "README.md", "# Readme\n");
      await writeRepoFile(cwd, "AGENTS.md", "# Agents\n");
      await writeRepoFile(cwd, ".repolog.json", JSON.stringify({ excludes: ["docs/Notes"] }, null, 2));
      await writeRepoFile(cwd, "docs/Notes/todo_notes.md", "# Notes\n\n- [ ] ignore me\n");

      const state = await scanRepo(cwd);

      expect(state.scannedFiles).not.toContain("docs/Notes/todo_notes.md");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

async function writeRepoFile(root: string, file: string, content: string): Promise<void> {
  const fullPath = join(root, file);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}
