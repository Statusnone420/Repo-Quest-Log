import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readLastDigest, writeLastDigest } from "../src/engine/digest-cache.js";
import type { DigestResult } from "../src/engine/types.js";

describe("digest cache", () => {
  it("stores the last digest outside the target repo", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "repolog-digest-repo-"));
    const cacheRoot = await mkdtemp(join(tmpdir(), "repolog-digest-cache-"));
    const digest: DigestResult = {
      summary: "Useful repo context found.",
      stuck: "Missing PLAN.md.",
      next: "Create agent-ready docs.",
      generatedAt: "2026-05-22T12:00:00.000Z",
      model: "test/model",
    };

    try {
      const written = await writeLastDigest(cacheRoot, repoRoot, digest);
      const loaded = await readLastDigest(cacheRoot, repoRoot);

      expect(written).toContain(cacheRoot);
      expect(written).not.toContain(repoRoot);
      expect(loaded).toEqual(digest);
      expect(existsSync(join(repoRoot, ".repolog", "digest.json"))).toBe(false);
      expect(existsSync(join(repoRoot, ".repolog"))).toBe(false);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
      await rm(cacheRoot, { recursive: true, force: true });
    }
  });
});
