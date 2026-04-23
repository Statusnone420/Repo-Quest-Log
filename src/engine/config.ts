import { readFile, writeFile, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

export interface RepoConfig {
  excludes: string[];
  writeback: boolean;
  prompts: {
    dir?: string;
  };
  watch: {
    debounce: number;
    reportFileChanges: boolean;
  };
  schemaVersion: number;
}

export interface RepoConfigInput {
  excludes?: unknown;
  exclude?: unknown;
  ignore?: unknown;
  ignored?: unknown;
  writeback?: unknown;
  prompts?: unknown;
  watch?: unknown;
  schemaVersion?: unknown;
}

const DEFAULT_CONFIG: RepoConfig = {
  excludes: ["archive", "archives", "archived"],
  writeback: false,
  prompts: { dir: defaultPromptDir() },
  watch: {
    debounce: 500,
    reportFileChanges: true,
  },
  schemaVersion: 2,
};

export function defaultRepoConfig(): RepoConfig {
  return cloneConfig(DEFAULT_CONFIG);
}

export async function readRepoConfig(rootDir: string): Promise<RepoConfig> {
  const configPath = resolve(rootDir, ".repolog.json");

  try {
    const raw = await readFile(configPath, "utf8");
    return validateAndFillConfig(JSON.parse(raw) as RepoConfigInput);
  } catch {
    return defaultRepoConfig();
  }
}

export function validateAndFillConfig(raw: unknown): RepoConfig {
  if (raw === undefined || raw === null) {
    return defaultRepoConfig();
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid .repolog.json: expected an object");
  }

  const input = raw as RepoConfigInput;
  const excludes = readStringArray(input.excludes ?? input.exclude ?? input.ignore ?? input.ignored);
  const writeback = input.writeback === undefined ? DEFAULT_CONFIG.writeback : assertBoolean(input.writeback, "writeback");
  const prompts = readPromptsConfig(input.prompts);
  const watch = readWatchConfig(input.watch);
  const schemaVersion = input.schemaVersion === undefined ? DEFAULT_CONFIG.schemaVersion : assertNumber(input.schemaVersion, "schemaVersion", 0);

  return {
    excludes: dedupeExcludes([
      ...DEFAULT_CONFIG.excludes,
      ...excludes,
    ]),
    writeback,
    prompts,
    watch,
    schemaVersion,
  };
}

export async function writeRepoConfig(
  rootDir: string,
  next: Partial<RepoConfigInput>,
): Promise<RepoConfig> {
  const filePath = resolve(rootDir, ".repolog.json");
  const current = await readRepoConfig(rootDir);
  const merged = validateAndFillConfig({
    excludes: next.excludes ?? current.excludes,
    writeback: next.writeback ?? current.writeback,
    prompts: next.prompts ?? current.prompts,
    watch: next.watch ?? current.watch,
    schemaVersion: next.schemaVersion ?? current.schemaVersion,
  });
  const json = `${JSON.stringify(merged, null, 2)}\n`;
  const tempPath = `${filePath}.tmp`;

  await writeFile(tempPath, json, "utf8");
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch {
      // best effort cleanup
    }
    throw error;
  }

  return merged;
}

export function isExcludedPath(relativePath: string, config: Pick<RepoConfig, "excludes">): boolean {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/").filter(Boolean);

  return config.excludes.some((entry) => matchesExclude(normalized, segments, normalizePath(entry)));
}

function readPromptsConfig(value: unknown): { dir?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return cloneConfig(DEFAULT_CONFIG).prompts;
  }

  const dir = (value as { dir?: unknown }).dir;
  if (typeof dir !== "string" || !dir.trim()) {
    return cloneConfig(DEFAULT_CONFIG).prompts;
  }

  return { dir: expandHome(dir.trim()) };
}

function readWatchConfig(value: unknown): RepoConfig["watch"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_CONFIG.watch };
  }

  const debounce = (value as { debounce?: unknown }).debounce;
  const reportFileChanges = (value as { reportFileChanges?: unknown }).reportFileChanges;

  return {
    debounce: debounce === undefined ? DEFAULT_CONFIG.watch.debounce : assertNumber(debounce, "watch.debounce", 100, 10000),
    reportFileChanges: reportFileChanges === undefined ? DEFAULT_CONFIG.watch.reportFileChanges : assertBoolean(reportFileChanges, "watch.reportFileChanges"),
  };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function dedupeExcludes(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of entries) {
    const normalized = normalizePath(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
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

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
}

function expandHome(value: string): string {
  if (value === "~") {
    return homedir();
  }

  if (value.startsWith("~/")) {
    return resolve(homedir(), value.slice(2));
  }

  return value;
}

function defaultPromptDir(): string {
  return resolve(homedir(), ".repolog", "prompts");
}

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid .repolog.json: ${field} must be boolean`);
  }
  return value;
}

function assertNumber(value: unknown, field: string, minimum = Number.NEGATIVE_INFINITY, maximum = Number.POSITIVE_INFINITY): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid .repolog.json: ${field} must be a number`);
  }
  if (value < minimum) {
    throw new Error(`Invalid .repolog.json: ${field} must be at least ${minimum}`);
  }
  if (value > maximum) {
    throw new Error(`Invalid .repolog.json: ${field} must be at most ${maximum}`);
  }
  return value;
}

function cloneConfig(config: RepoConfig): RepoConfig {
  return {
    excludes: [...config.excludes],
    writeback: config.writeback,
    prompts: { ...config.prompts },
    watch: { ...config.watch },
    schemaVersion: config.schemaVersion,
  };
}
