import { afterEach, describe, expect, it } from "vitest";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { startWorkspaceActivityWatcher } from "../src/engine/activity-watcher.js";
import type { RecentActivityEvent } from "../src/engine/types.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace activity watcher", () => {
  it("records add, change, and unlink metadata without repo writes", async () => {
    const root = join(tmpdir(), `repolog-activity-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    await mkdir(root, { recursive: true });
    const batches: RecentActivityEvent[][] = [];
    const handle = await startWorkspaceActivityWatcher({
      cwd: root,
      debounceMs: 500,
      onActivity: (events) => {
        batches.push([...events]);
      },
    });

    try {
      const file = join(root, "src", "web", "render.ts");
      await mkdir(join(root, "src", "web"), { recursive: true });
      await writeFile(file, "one", "utf8");
      await waitForKinds(batches, handle, ["add"]);
      await writeFile(file, "two", "utf8");
      await waitForKinds(batches, handle, ["add", "change"]);
      await unlink(file);
      await waitForKinds(batches, handle, ["add", "change", "unlink"]);
    } finally {
      await handle.close();
    }

    const events = batches.flat();
    expect(events.map((event) => event.kind)).toEqual(expect.arrayContaining(["add", "change", "unlink"]));
    expect(events.every((event) => event.file === "src/web/render.ts")).toBe(true);
    expect(events.every((event) => typeof event.ts === "number" && event.ts > 0)).toBe(true);
  }, 15_000);

  it("ignores built-in noisy directories", async () => {
    const root = join(tmpdir(), `repolog-activity-ignore-${Date.now()}`);
    roots.push(root);
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
    await mkdir(join(root, "release", "win-unpacked"), { recursive: true });
    await mkdir(join(root, "dist"), { recursive: true });
    await mkdir(join(root, "build"), { recursive: true });
    await mkdir(join(root, ".repolog"), { recursive: true });
    const batches: RecentActivityEvent[][] = [];
    const handle = await startWorkspaceActivityWatcher({
      cwd: root,
      debounceMs: 500,
      onActivity: (events) => {
        batches.push([...events]);
      },
    });

    try {
      await writeFile(join(root, "node_modules", "pkg", "index.js"), "module.exports = 1", "utf8");
      await writeFile(join(root, "release", "win-unpacked", "Repo Quest Log.exe"), "binary", "utf8");
      await writeFile(join(root, "dist", "index.js"), "compiled", "utf8");
      await writeFile(join(root, "build", "icon.png"), "asset", "utf8");
      await writeFile(join(root, ".repolog", "CHARTER.md"), "guide", "utf8");
      await pause(650);
      await handle.flush();
    } finally {
      await handle.close();
    }

    expect(batches.flat()).toEqual([]);
  });

  it("reloads excludes when .repolog.json changes", async () => {
    const root = join(tmpdir(), `repolog-activity-config-${Date.now()}`);
    roots.push(root);
    await mkdir(join(root, "src"), { recursive: true });
    const batches: RecentActivityEvent[][] = [];
    let resolveConfigReload: (() => void) | undefined;
    const configReloaded = new Promise<void>((resolve) => {
      resolveConfigReload = resolve;
    });
    const handle = await startWorkspaceActivityWatcher({
      cwd: root,
      debounceMs: 500,
      onActivity: (events) => {
        batches.push([...events]);
      },
      onConfigChanged: () => {
        resolveConfigReload?.();
      },
    });

    try {
      await writeFile(join(root, ".repolog.json"), JSON.stringify({ excludes: ["src"] }), "utf8");
      await waitFor(configReloaded, 5_000, "config reload");
      await writeFile(join(root, "src", "ignored.ts"), "ignored", "utf8");
      await pause(650);
      await handle.flush();
    } finally {
      await handle.close();
    }

    expect(batches.flat().some((event) => event.file === "src/ignored.ts")).toBe(false);
  }, 15_000);
});

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), ms)),
  ]);
}

async function waitForKinds(
  batches: RecentActivityEvent[][],
  handle: { flush(): Promise<void> },
  kinds: RecentActivityEvent["kind"][],
): Promise<void> {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    await pause(100);
    await handle.flush();
    const seen = new Set(batches.flat().map((event) => event.kind));
    if (kinds.every((kind) => seen.has(kind))) {
      return;
    }
  }
  await handle.flush();
}
