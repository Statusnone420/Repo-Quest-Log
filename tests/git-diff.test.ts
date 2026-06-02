import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { readFileDiff } from "../src/desktop/git-diff.js";

describe("desktop read-only diff preview", () => {
  it("returns capped unified diff for a tracked changed file", async () => {
    const repoRoot = join(tmpdir(), `repo-quest-log-diff-${Date.now()}`);
    await mkdir(repoRoot, { recursive: true });

    try {
      await writeFile(join(repoRoot, "PLAN.md"), "# Plan\n\n- [ ] First task\n", "utf8");
      execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Repo Quest Log"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["commit", "-m", "initial"], { cwd: repoRoot, stdio: "ignore" });

      await writeFile(join(repoRoot, "PLAN.md"), "# Plan\n\n- [ ] First task\n- [ ] Second task\n", "utf8");

      const diff = readFileDiff(repoRoot, "PLAN.md", { maxBytes: 4096 });

      expect(diff.ok).toBe(true);
      expect(diff.file).toBe("PLAN.md");
      expect(diff.text).toContain("diff --git");
      expect(diff.text).toContain("+");
      expect(diff.truncated).toBe(false);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("refuses path traversal outside the repo", async () => {
    const repoRoot = join(tmpdir(), `repo-quest-log-diff-safe-${Date.now()}`);
    await mkdir(repoRoot, { recursive: true });

    try {
      const diff = readFileDiff(repoRoot, "../outside.md");

      expect(diff.ok).toBe(false);
      expect(diff.reason).toContain("outside repo");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("truncates large diffs instead of failing the preview", async () => {
    const repoRoot = join(tmpdir(), `repo-quest-log-diff-large-${Date.now()}`);
    await mkdir(repoRoot, { recursive: true });

    try {
      await writeFile(join(repoRoot, "PLAN.md"), "# Plan\n", "utf8");
      execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Repo Quest Log"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["commit", "-m", "initial"], { cwd: repoRoot, stdio: "ignore" });

      await writeFile(join(repoRoot, "PLAN.md"), Array.from({ length: 5000 }, (_, index) => `- [ ] Task ${index}`).join("\n"), "utf8");

      const diff = readFileDiff(repoRoot, "PLAN.md", { maxBytes: 512 });

      expect(diff.ok).toBe(true);
      expect(diff.truncated).toBe(true);
      expect(Buffer.byteLength(diff.text, "utf8")).toBeLessThanOrEqual(512);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("previews untracked added files as added content", async () => {
    const repoRoot = join(tmpdir(), `repo-quest-log-diff-untracked-${Date.now()}`);
    await mkdir(repoRoot, { recursive: true });

    try {
      await writeFile(join(repoRoot, "PLAN.md"), "# Plan\n", "utf8");
      execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Repo Quest Log"], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["commit", "-m", "initial"], { cwd: repoRoot, stdio: "ignore" });

      await mkdir(join(repoRoot, "src"), { recursive: true });
      await writeFile(join(repoRoot, "src", "new.ts"), "export const value = 1;\n", "utf8");

      const diff = readFileDiff(repoRoot, "src/new.ts", { maxBytes: 4096 });

      expect(diff.ok).toBe(true);
      expect(diff.text).toContain("new file");
      expect(diff.text).toContain("+export const value = 1;");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
