import { execFileSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
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
    await mkdir(join(cwd, "docs", "Archived", "agent-docs"), { recursive: true });

    try {
      await writeRepoFile(cwd, "PLAN.md", "# Plan\n\n- [ ] First task\n");
      await writeRepoFile(cwd, "STATE.md", "# State\n");
      await writeRepoFile(cwd, "README.md", "# Readme\n");
      await writeRepoFile(cwd, "AGENTS.md", "# Agents\n");
      await writeRepoFile(cwd, "docs/Archived/implementation_plan.md", "# Archived plan\n\n- [ ] stale\n");
      await writeRepoFile(cwd, "docs/Archived/agent-docs/CLAUDE.md", "# Claude\n\nArchived instructions\n");

      const state = await scanRepo(cwd);

      expect(state.scannedFiles).not.toContain("docs/Archived/implementation_plan.md");
      expect(state.scannedFiles).not.toContain("docs/Archived/agent-docs/CLAUDE.md");
      expect(state.recentChanges.some((change) => change.file.includes("Archived"))).toBe(false);
      expect(state.agents.some((agent) => agent.file === "docs/Archived/agent-docs/CLAUDE.md")).toBe(false);
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

  it("marks archived agent docs from frontmatter as reference docs", async () => {
    const cwd = join(tmpdir(), `repo-quest-log-scan-${Date.now()}-archived-agent`);
    await mkdir(cwd, { recursive: true });

    try {
      await writeRepoFile(cwd, "CLAUDE.md", "---\nowner: claude\nstatus: Archived \nrole: historical notes\narea: docs/**\n---\n\n# Claude\n");

      const state = await scanRepo(cwd);

      expect(state.agents[0]).toEqual(
        expect.objectContaining({
          id: "claude",
          file: "CLAUDE.md",
          status: "archived",
        }),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("normalizes reference-style agent status aliases", async () => {
    const cwd = join(tmpdir(), `repo-quest-log-scan-${Date.now()}-reference-agent`);
    await mkdir(cwd, { recursive: true });

    try {
      await writeRepoFile(cwd, "GEMINI.md", "---\nowner: gemini\nstatus:  Reference \nrole: historical notes\narea: architecture/**\n---\n\n# Gemini\n");
      await writeRepoFile(cwd, "CLAUDE.md", "---\nowner: claude\nstatus: Paused\nrole: historical notes\narea: docs/**\n---\n\n# Claude\n");
      await writeRepoFile(cwd, "AGENTS.md", "---\nowner: codex\nstatus: inactive\nrole: historical notes\narea: src/**\n---\n\n# Agents\n");

      const state = await scanRepo(cwd);

      expect(state.agents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "gemini", file: "GEMINI.md", status: "archived" }),
          expect.objectContaining({ id: "claude", file: "CLAUDE.md", status: "archived" }),
          expect.objectContaining({ id: "codex", file: "AGENTS.md", status: "archived" }),
        ]),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("caps rendered recent activity without capping workspace signal calculations", async () => {
    const cwd = join(tmpdir(), `repo-quest-log-scan-${Date.now()}-activity-cap`);
    await mkdir(cwd, { recursive: true });

    try {
      await writeRepoFile(cwd, "PLAN.md", "# Plan\n\n## Now\n\n- [ ] First task\n");
      await writeRepoFile(cwd, "STATE.md", "# State\n");
      await writeRepoFile(cwd, "README.md", "# Readme\n");
      await writeRepoFile(cwd, "AGENTS.md", "# Agents\n\n## Owned Areas\n\nsrc/**\n");
      const now = Date.now();
      const recentActivity = Array.from({ length: 45 }, (_, index) => ({
        file: `src/file-${index}.ts`,
        kind: "change" as const,
        ts: now - (index * 1000),
      }));

      const state = await scanRepo(cwd, { recentActivity });

      expect(state.recentActivity).toHaveLength(40);
      expect(state.workspaceSignals?.editRate).toBe(45);
      expect(state.workspaceSignals?.filesTouched).toBe(45);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("keeps useful signals from a noisy fixture repo", async () => {
    const fixtureRoot = join(process.cwd(), "tests", "fixtures", "noisy");
    const cwd = join(tmpdir(), `repo-quest-log-scan-${Date.now()}-noisy`);

    try {
      await cp(fixtureRoot, cwd, { recursive: true });
      const state = await scanRepo(cwd);

      expect(state.scannedFiles).toContain("PLAN.md");
      expect(state.scannedFiles).toContain("README.md");
      expect(state.scannedFiles).not.toContain("docs/Archived/old.md");
      expect(state.activeQuest).toEqual(
        expect.objectContaining({
          title: "Stabilize noisy-fixture extraction.",
          progress: { done: 1, total: 2 },
        }),
      );
      expect(state.now.map((task) => task.text)).toEqual([
        "Wire the shared prompt module into the HUD",
        "Fix desktop click-to-open at exact lines",
      ]);
      expect(state.next.map((task) => task.text)).toEqual([
        "Add prompt-file loading later",
        "Refresh the README without changing behavior",
      ]);
      expect(state.blocked[0]).toEqual(
        expect.objectContaining({
          text: "Confirm archived markdown is excluded",
          reason: "Waiting on fixture coverage for archived docs.",
        }),
      );
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
