import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildAuthDiscoveryReport, formatAuthDiscoveryReport, saveSelectedProvider } from "../src/cli/copilot-auth.js";
import { discoverProviders } from "../src/engine/llm-providers.js";

describe("LLM auth discovery", () => {
  it("discovers provider credentials from standard locations and saves the selected provider", async () => {
    const homeDir = await mktempDir("repolog-auth-home-");
    const repoRoot = await mktempDir("repolog-auth-repo-");

    try {
      await cp(join(process.cwd(), "tests", "fixtures", "auth-repo"), repoRoot, { recursive: true });
      await writeFile(join(homeDir, ".claude", "token.json"), JSON.stringify({ token: "anthropic-secret" }), "utf8");
      await writeFile(join(homeDir, ".config", "openai", "auth.json"), JSON.stringify({ api_key: "openai-secret" }), "utf8");
      await writeFile(
        join(homeDir, ".config", "gcloud", "application_default_credentials.json"),
        JSON.stringify({
          refresh_token: "refresh-token",
          client_id: "client-id",
          client_secret: "client-secret",
          project_id: "demo-project",
          location: "us-central1",
        }),
        "utf8",
      );
      await writeFile(
        join(homeDir, ".repolog", "llm-config.json"),
        JSON.stringify({ provider: "local-ollama", endpoint: "http://127.0.0.1:11434", model: "llama3.1" }),
        "utf8",
      );

      const providers = discoverProviders({ homeDir });
      expect(providerByName(providers, "anthropic")?.available).toBe(true);
      expect(providerByName(providers, "openai")?.available).toBe(true);
      expect(providerByName(providers, "google")?.available).toBe(true);
      expect(providerByName(providers, "local-ollama")?.available).toBe(true);
      expect(providerByName(providers, "local-ollama")?.endpoint).toBe("http://127.0.0.1:11434");

      await saveSelectedProvider(repoRoot, "openai");
      const saved = JSON.parse(await readFile(join(repoRoot, ".repolog.json"), "utf8")) as {
        llm?: { provider?: string; discovered?: boolean };
      };
      expect(saved.llm).toEqual({ provider: "openai", discovered: true });

      const report = await buildAuthDiscoveryReport(repoRoot, { homeDir });
      expect(report.selectedProvider).toBe("openai");
      expect(formatAuthDiscoveryReport(report)).toContain("openai");
      expect(formatAuthDiscoveryReport(report)).toContain("[selected]");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});

async function mktempDir(prefix: string): Promise<string> {
  const root = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(join(root, ".config", "openai"), { recursive: true });
  await mkdir(join(root, ".config", "gcloud"), { recursive: true });
  await mkdir(join(root, ".claude"), { recursive: true });
  await mkdir(join(root, ".repolog"), { recursive: true });
  return root;
}

function providerByName(
  providers: Array<{ name: string; available: boolean; endpoint?: string }>,
  name: string,
): { name: string; available: boolean; endpoint?: string } | undefined {
  return providers.find((provider) => provider.name === name);
}
