import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { startWatcher } from "../src/engine/watcher.js";
import type { FileChange } from "../src/engine/types.js";

const fixtureRoot = join(process.cwd(), "tests", "fixtures", "healthy");
const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    await rmDir(dir);
  }
});

describe("startWatcher", () => {
  it("debounces a burst of file changes into one pipeline run", async () => {
    const cwd = await createTempRepo();
    const runs: FileChange[][] = [];

    const handle = await startWatcher({
      cwd,
      globs: ["PLAN.md", "README.md"],
      debounceMs: 75,
      runInitial: false,
      onRefresh: (changes) => {
        runs.push([...changes]);
      },
    });

    try {
      await writeFile(join(cwd, "README.md"), "# Repo Quest Log\n\nChange one.\n");
      await writeFile(join(cwd, "PLAN.md"), await readFile(join(fixtureRoot, "PLAN.md"), "utf8") + "\n\n- [ ] another change\n");

      await waitFor(() => runs.length === 1, 1000);

      expect(runs[0]?.map((change) => change.file)).toEqual(["PLAN.md", "README.md"]);
      expect(runs[0]?.every((change) => change.at === "just now")).toBe(true);
    } finally {
      await handle.close();
    }
  });
});

async function createTempRepo(): Promise<string> {
  const cwd = join(tmpdir(), `repo-quest-log-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempDirs.push(cwd);
  await mkdir(cwd, { recursive: true });
  await copyFile(join(fixtureRoot, "PLAN.md"), join(cwd, "PLAN.md"));
  await copyFile(join(fixtureRoot, "README.md"), join(cwd, "README.md"));
  return cwd;
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for watcher flush");
    }
    await delay(25);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function rmDir(dir: string): Promise<void> {
  const { rm } = await import("node:fs/promises");
  await rm(dir, { recursive: true, force: true });
}
