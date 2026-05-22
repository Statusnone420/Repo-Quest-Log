import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOpenRouterDigest } from "../src/engine/digest.js";

describe("runOpenRouterDigest", () => {
  it("uses mocked OpenRouter and persists the digest outside the repo by default", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "repolog-digest-repo-"));
    const cacheRoot = await mkdtemp(join(tmpdir(), "repolog-digest-cache-"));
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Generic repo has useful raw context.",
              stuck: "Missing agent-ready docs.",
              next: "Create PLAN.md and STATE.md.",
            }),
          },
        },
      ],
    }), { status: 200 });

    try {
      const result = await runOpenRouterDigest({
        apiKey: "sk-or-test",
        model: "test/model",
        prompt: "Analyze this repo",
        cacheRoot,
        repoRoot,
        fetchImpl,
      });

      expect(result.error).toBeUndefined();
      expect(result.result?.summary).toContain("useful raw context");
      expect(result.cacheFile).toContain(cacheRoot);
      expect(result.cacheFile).not.toContain(repoRoot);
      expect(existsSync(join(repoRoot, ".repolog", "digest.json"))).toBe(false);
      expect(existsSync(join(repoRoot, ".repolog"))).toBe(false);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
      await rm(cacheRoot, { recursive: true, force: true });
    }
  });
});
