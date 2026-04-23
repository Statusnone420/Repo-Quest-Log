import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { defaultRepoConfig, readRepoConfig, validateAndFillConfig, writeRepoConfig } from "../src/engine/config.js";

describe("config validation", () => {
  it("fills defaults for a missing config", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-config-missing-"));

    try {
      const config = await readRepoConfig(root);
      expect(config).toEqual(defaultRepoConfig());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validates and fills a partial config", () => {
    const config = validateAndFillConfig({
      excludes: ["node_modules"],
      prompts: { dir: "~/.repolog/prompts" },
    });

    expect(config.excludes).toContain("node_modules");
    expect(config.writeback).toBe(false);
    expect(config.watch.debounce).toBe(500);
    expect(config.watch.reportFileChanges).toBe(true);
    expect(config.schemaVersion).toBe(2);
  });

  it("rejects invalid writeback values", () => {
    expect(() => validateAndFillConfig({ writeback: "yes" })).toThrow("writeback must be boolean");
  });

  it("rejects invalid debounce values", () => {
    expect(() => validateAndFillConfig({ watch: { debounce: "slow" } })).toThrow("watch.debounce must be a number");
    expect(() => validateAndFillConfig({ watch: { debounce: 25 } })).toThrow("watch.debounce must be at least 100");
    expect(() => validateAndFillConfig({ watch: { debounce: 20000 } })).toThrow("watch.debounce must be at most 10000");
  });

  it("returns defaults for corrupt .repolog.json (never crashes the scan)", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-config-corrupt-"));
    try {
      await writeFile(join(root, ".repolog.json"), "{ not: valid json <<<", "utf8");
      const config = await readRepoConfig(root);
      expect(config).toEqual(defaultRepoConfig());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validateAndFillConfig throws for non-object input", () => {
    expect(() => validateAndFillConfig("not an object")).toThrow("expected an object");
    expect(() => validateAndFillConfig([1, 2, 3])).toThrow("expected an object");
  });

  it("writes config atomically", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-config-write-"));
    try {
      await mkdir(join(root, ".repolog"), { recursive: true });
      await writeFile(join(root, ".repolog.json"), JSON.stringify({ writeback: false }, null, 2), "utf8");

      const next = await writeRepoConfig(root, { writeback: true, watch: { debounce: 750, reportFileChanges: false } });
      const raw = await readFile(join(root, ".repolog.json"), "utf8");

      expect(next.writeback).toBe(true);
      expect(next.watch.debounce).toBe(750);
      expect(next.watch.reportFileChanges).toBe(false);
      expect(raw).toContain("\"writeback\": true");
      expect(raw).toContain("\"excludes\"");
      expect(raw).not.toContain(".tmp");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
