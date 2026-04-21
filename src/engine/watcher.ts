import chokidar from "chokidar";

import { SCANNED_GLOBS } from "./fileset.js";
import type { FileChange } from "./types.js";

export interface WatcherOptions {
  cwd: string;
  globs?: readonly string[];
  debounceMs?: number;
  runInitial?: boolean;
  onRefresh: (changes: readonly FileChange[]) => Promise<void> | void;
  onError?: (error: unknown) => void;
}

export interface WatcherHandle {
  close(): Promise<void>;
  flush(): Promise<void>;
}

export async function startWatcher(options: WatcherOptions): Promise<WatcherHandle> {
  const watcher = chokidar.watch(options.globs ?? SCANNED_GLOBS, {
    cwd: options.cwd,
    ignoreInitial: true,
    persistent: true,
  });

  const debounceMs = options.debounceMs ?? 250;
  const pendingChanges = new Map<string, FileChange>();
  let timer: NodeJS.Timeout | undefined;
  let inFlight = false;

  const schedule = (): void => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      void flush().catch((error: unknown) => {
        options.onError?.(error);
      });
    }, debounceMs);
  };

  const record = (file: string): void => {
    const normalized = normalizePath(file);
    pendingChanges.delete(normalized);
    pendingChanges.set(normalized, {
      file: normalized,
      at: "just now",
    });
    schedule();
  };

  watcher.on("add", record);
  watcher.on("change", record);
  watcher.on("unlink", record);
  watcher.on("addDir", record);
  watcher.on("unlinkDir", record);
  watcher.on("error", (error) => {
    options.onError?.(error);
  });

  await new Promise<void>((resolve) => {
    watcher.once("ready", () => resolve());
  });

  if (options.runInitial ?? true) {
    await options.onRefresh([]);
  }

  async function flush(): Promise<void> {
    if (inFlight) {
      return;
    }

    const changes = [...pendingChanges.values()].reverse();
    pendingChanges.clear();
    if (changes.length === 0) {
      return;
    }

    inFlight = true;
    try {
      await options.onRefresh(changes);
    } finally {
      inFlight = false;
      if (pendingChanges.size > 0) {
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

      pendingChanges.clear();
      await watcher.close();
    },
    flush,
  };
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}
