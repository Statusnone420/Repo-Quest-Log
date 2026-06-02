import { stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import chokidar from "chokidar";

import { isExcludedPath, readRepoConfig } from "./config.js";
import type { RecentActivityEvent, RecentActivityKind } from "./types.js";

const BUILT_IN_IGNORES = [
  ".git",
  "node_modules",
  "release",
  "dist",
  "build",
  ".repolog",
  ".next",
  "coverage",
  ".cache",
  ".turbo",
  ".vercel",
  ".venv",
  "venv",
  "env",
  "__pycache__",
];

export interface WorkspaceActivityWatcherOptions {
  cwd: string;
  debounceMs?: number;
  maxEvents?: number;
  onActivity: (events: readonly RecentActivityEvent[]) => Promise<void> | void;
  onConfigChanged?: () => Promise<void> | void;
  onError?: (error: unknown) => void;
}

export interface WorkspaceActivityWatcherHandle {
  close(): Promise<void>;
  flush(): Promise<void>;
}

export async function startWorkspaceActivityWatcher(
  options: WorkspaceActivityWatcherOptions,
): Promise<WorkspaceActivityWatcherHandle> {
  let config = await readRepoConfig(options.cwd);
  let excludes = [...BUILT_IN_IGNORES, ...config.excludes];
  let debounceMs = Math.max(options.debounceMs ?? config.watch?.debounce ?? 500, 500);
  const maxEvents = options.maxEvents ?? 500;
  const pending: RecentActivityEvent[] = [];
  let timer: NodeJS.Timeout | undefined;
  let configPoller: NodeJS.Timeout | undefined;
  let configMtimeMs = await readConfigMtime(options.cwd);
  let inFlight = false;

  const watcher = chokidar.watch(["**/*", ".repolog.json"], {
    cwd: options.cwd,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: false,
    ignored: (watchedPath) => {
      const relativePath = isAbsolute(watchedPath)
        ? relative(options.cwd, watchedPath)
        : watchedPath;
      const normalized = normalizePath(relativePath);
      if (!normalized || normalized === ".") {
        return false;
      }
      return isExcludedPath(normalized, { excludes });
    },
  });

  const schedule = (): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      void flush().catch((error: unknown) => handleError(error, "(flush)", "flush"));
    }, debounceMs);
  };

  const record = (kind: RecentActivityKind, file: string): void => {
    const normalized = normalizePath(file);
    if (!normalized || isExcludedPath(normalized, { excludes })) {
      return;
    }
    pending.unshift({
      file: normalized,
      kind,
      ts: Date.now(),
    });
    if (pending.length > maxEvents) {
      pending.length = maxEvents;
    }
    schedule();
  };

  const reloadConfig = async (): Promise<void> => {
    config = await readRepoConfig(options.cwd);
    excludes = [...BUILT_IN_IGNORES, ...config.excludes];
    debounceMs = Math.max(options.debounceMs ?? config.watch?.debounce ?? 500, 500);
    configMtimeMs = await readConfigMtime(options.cwd);
    await options.onConfigChanged?.();
  };

  watcher.on("add", (file) => {
    if (normalizePath(file) === ".repolog.json") {
      void reloadConfig().catch((error: unknown) => handleError(error, ".repolog.json", "add"));
      return;
    }
    record("add", file);
  });
  watcher.on("change", (file) => {
    if (normalizePath(file) === ".repolog.json") {
      void reloadConfig().catch((error: unknown) => handleError(error, ".repolog.json", "change"));
      return;
    }
    record("change", file);
  });
  watcher.on("unlink", (file) => record("unlink", file));
  watcher.on("error", (error) => handleError(error, "(watcher)", "error"));

  await new Promise<void>((resolve) => {
    watcher.once("ready", () => resolve());
  });

  configPoller = setInterval(() => {
    void reloadConfigIfTouched().catch((error: unknown) => handleError(error, ".repolog.json", "poll"));
  }, Math.max(debounceMs, 1000));

  async function flush(): Promise<void> {
    if (inFlight) {
      return;
    }
    const events = pending.splice(0, pending.length);
    if (events.length === 0) {
      return;
    }
    inFlight = true;
    try {
      await options.onActivity(events);
    } finally {
      inFlight = false;
      if (pending.length > 0) {
        schedule();
      }
    }
  }

  return {
    async close() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (configPoller) {
        clearInterval(configPoller);
        configPoller = undefined;
      }
      pending.length = 0;
      await watcher.close();
    },
    flush,
  };

  function handleError(error: unknown, file: string, event: string): void {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`RepoLog activity watcher error (${event} ${file}): ${message}\n`);
    options.onError?.(error instanceof Error ? error : new Error(message));
  }

  async function reloadConfigIfTouched(): Promise<void> {
    const nextMtime = await readConfigMtime(options.cwd);
    if (nextMtime === configMtimeMs) {
      return;
    }
    await reloadConfig();
  }
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

async function readConfigMtime(cwd: string): Promise<number | undefined> {
  try {
    return (await stat(join(cwd, ".repolog.json"))).mtimeMs;
  } catch {
    return undefined;
  }
}
