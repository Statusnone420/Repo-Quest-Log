import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { runDoctor } from "../src/engine/doctor.js";
import { scanRepo } from "../src/engine/scan.js";
import { buildTuneup } from "../src/engine/tuneup.js";
import { renderDesktopHtml } from "../src/web/render.js";

describe("read-only repo operations", () => {
  it("scan, render, and analyze do not create repo-local support files", async () => {
    const root = await makeGenericRepo();
    const before = await snapshotRepo(root);

    try {
      const state = await scanRepo(root);
      renderDesktopHtml(state, { liveBridge: "desktop" });
      const report = await runDoctor(root);
      await buildTuneup(report.state, report, root);

      const after = await snapshotRepo(root);
      expect(after).toEqual(before);
      expect(after).not.toContain(".repolog/");
      expect(after).not.toContain(".repolog.json");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function makeGenericRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "repolog-readonly-"));
  await writeRepoFile(root, "README.md", "# Widget API\n\nA tiny TypeScript API for tracking widgets.\n");
  await writeRepoFile(
    root,
    "package.json",
    JSON.stringify({ name: "widget-api", version: "1.2.3", description: "Tracks widgets" }, null, 2),
  );
  await writeRepoFile(root, "src/index.ts", "export const name = 'widget-api';\n");
  return root;
}

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
    const info = await stat(join(root, child));
    files.push(`${child}:${info.size}:${await readFile(join(root, child), "utf8")}`);
  }
}
