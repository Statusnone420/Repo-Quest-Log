import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface RepoConfig {
  excludes: string[];
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
    };

    return {
      excludes: dedupeExcludes([
        ...DEFAULT_EXCLUDES,
        ...readStringArray(parsed.exclude),
        ...readStringArray(parsed.excludes),
        ...readStringArray(parsed.ignore),
        ...readStringArray(parsed.ignored),
      ]),
    };
  } catch {
    return { excludes: [...DEFAULT_EXCLUDES] };
  }
}

export function isExcludedPath(relativePath: string, config: RepoConfig): boolean {
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
