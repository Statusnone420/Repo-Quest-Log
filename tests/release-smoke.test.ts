import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { desktopUserArgv, resolveDesktopRepoRoot } from "../src/desktop/root.js";
import { runDoctor } from "../src/engine/doctor.js";
import { scanRepo } from "../src/engine/scan.js";
import { buildTuneup } from "../src/engine/tuneup.js";
import { renderDesktopHtml } from "../src/web/render.js";

describe("v0.5 release smoke", () => {
  it("opens a packaged --repo-root target instead of falling back to the saved repo", async () => {
    const target = await mkdtemp(join(tmpdir(), "repolog-release-target-"));
    const saved = await mkdtemp(join(tmpdir(), "repolog-release-saved-"));

    try {
      await writeRepoFile(target, "README.md", "# Target App\n");
      await writeRepoFile(saved, "README.md", "# Saved App\n");

      const argv = desktopUserArgv([
        "C:\\Program Files\\Repo Quest Log\\Repo Quest Log.exe",
        "--repo-root",
        target,
      ]);
      const resolved = resolveDesktopRepoRoot({
        argv,
        cwd: "C:\\Program Files\\Repo Quest Log",
        execPath: "C:\\Program Files\\Repo Quest Log\\Repo Quest Log.exe",
        lastRoot: saved,
      });

      expect(resolved).toBe(target);
    } finally {
      await rm(target, { recursive: true, force: true });
      await rm(saved, { recursive: true, force: true });
    }
  });

  it("renders the normal HUD for a sparse source repo without writing repo-local files", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-release-sparse-"));
    await writeRepoFile(root, "README.md", "# Widget API\n\nTracks widget events.\n");
    await writeRepoFile(root, "package.json", JSON.stringify({ name: "widget-api", version: "1.0.0" }, null, 2));
    await writeRepoFile(root, "src/index.ts", "export const widget = true;\n");
    const before = await snapshotRepo(root);

    try {
      const state = await scanRepo(root);
      const report = await runDoctor(root);
      await buildTuneup(state, report, root);
      const html = renderDesktopHtml(state, { liveBridge: "desktop", appVersion: "0.5.0" });
      const after = await snapshotRepo(root);

      expect(after).toEqual(before);
      expect(state.name).toBe(basename(root));
      expect(state.repoContext?.manifestType).toBe("package.json");
      expect(html).toContain("Current Focus");
      expect(html).toContain("Repo Context");
      expect(html).toContain("No current task set");
      expect(html).not.toContain("This repo is not agent-ready yet");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps archived agent docs out of the active agent roster", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-release-archive-"));

    try {
      await writeRepoFile(root, "PLAN.md", "# Plan\n\n## Now\n\n- [ ] Ship v0.5\n");
      await writeRepoFile(root, "STATE.md", "# State\n");
      await writeRepoFile(root, "AGENTS.md", "---\nowner: codex\nstatus: active\nrole: implementer\narea: src/**\n---\n\n# Agents\n");
      await writeRepoFile(root, "docs/Archived/agent-docs/CLAUDE.md", "---\nowner: claude\nstatus: archived\n---\n\n# Claude\n");

      const state = await scanRepo(root);
      const html = renderDesktopHtml(state, { liveBridge: "desktop", appVersion: "0.5.0" });

      expect(state.scannedFiles).toContain("AGENTS.md");
      expect(state.scannedFiles).not.toContain("docs/Archived/agent-docs/CLAUDE.md");
      expect(state.agents).toHaveLength(1);
      expect(state.agents[0]).toEqual(expect.objectContaining({ file: "AGENTS.md", status: "active" }));
      expect(html).toContain("AGENTS.md");
      expect(html).not.toContain("docs/Archived/agent-docs/CLAUDE.md");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function writeRepoFile(root: string, file: string, content: string): Promise<void> {
  const fullPath = join(root, file);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function snapshotRepo(root: string): Promise<string[]> {
  const files: string[] = [];
  await walk(root, "", files);
  return files.sort();
}

async function walk(root: string, relativePath: string, files: string[]): Promise<void> {
  const dir = join(root, relativePath);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await walk(root, child, files);
      continue;
    }

    const path = join(root, child);
    const info = await stat(path);
    files.push(`${child}:${info.size}:${await readFile(path, "utf8")}`);
  }
}
