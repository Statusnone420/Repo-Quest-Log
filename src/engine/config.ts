import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { CopilotProviderId } from "./types.js";

export interface RepoConfig {
  excludes: string[];
  writeback: boolean;
  prompts: {
    dir?: string;
  };
  llm?: {
    provider?: CopilotProviderId;
    discovered?: boolean;
  };
}

const DEFAULT_EXCLUDES = ["archive", "archives", "archived"] as const;

export async function readRepoConfig(rootDir: string): Promise<RepoConfig> {
  const configPath = resolve(rootDir, ".repolog.json");

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as {
      exclude?: unknown;
      excludes?: unknown;
      ignore?: unknown;
      ignored?: unknown;
      writeback?: unknown;
      prompts?: unknown;
      llm?: unknown;
    };

    return {
      excludes: dedupeExcludes([
        ...DEFAULT_EXCLUDES,
        ...readStringArray(parsed.exclude),
        ...readStringArray(parsed.excludes),
        ...readStringArray(parsed.ignore),
        ...readStringArray(parsed.ignored),
      ]),
      writeback: parsed.writeback === true,
      prompts: readPromptsConfig(parsed.prompts),
      llm: readLlmConfig(parsed.llm),
    };
  } catch {
    return { excludes: [...DEFAULT_EXCLUDES], writeback: false, prompts: {} };
  }
}

function readPromptsConfig(value: unknown): { dir?: string } {
  if (!value || typeof value !== "object") return {};
  const dir = (value as { dir?: unknown }).dir;
  return typeof dir === "string" && dir.trim() ? { dir: dir.trim() } : {};
}

function readLlmConfig(value: unknown): RepoConfig["llm"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const provider = (value as { provider?: unknown }).provider;
  const discovered = (value as { discovered?: unknown }).discovered;

  if (typeof provider !== "string" || !isCopilotProviderId(provider)) {
    return undefined;
  }

  return {
    provider,
    discovered: discovered === true,
  };
}

export async function setRepoLlmSelection(
  rootDir: string,
  provider: CopilotProviderId,
): Promise<void> {
  const configPath = resolve(rootDir, ".repolog.json");
  let current: Record<string, unknown> = {};

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      current = parsed as Record<string, unknown>;
    }
  } catch {
    current = {};
  }

  current.llm = {
    ...(current.llm && typeof current.llm === "object" && !Array.isArray(current.llm)
      ? (current.llm as Record<string, unknown>)
      : {}),
    provider,
    discovered: true,
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
}

export function isCopilotProviderId(value: string): value is CopilotProviderId {
  return value === "anthropic" || value === "openai" || value === "google" || value === "local-ollama";
}

export function isExcludedPath(relativePath: string, config: Pick<RepoConfig, "excludes">): boolean {
  const normalized = normalize(relativePath);
  const segments = normalized.split("/").filter(Boolean);

  return config.excludes.some((entry) => matchesExclude(normalized, segments, normalize(entry)));
}

function matchesExclude(relativePath: string, segments: string[], entry: string): boolean {
  if (!entry) {
    return false;
  }

  if (entry.includes("/")) {
    return relativePath === entry || relativePath.startsWith(`${entry}/`);
  }

  return segments.some((segment) => segment === entry);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function dedupeExcludes(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of entries) {
    const normalized = normalize(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalize(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
}
