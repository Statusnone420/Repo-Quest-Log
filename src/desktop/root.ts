import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPO_MARKERS = ["PLAN.md", "STATE.md", "README.md", "AGENTS.md"];

export interface DesktopRootOptions {
  argv: readonly string[];
  cwd: string;
  execPath: string;
  lastRoot?: string | null;
}

export function resolveDesktopRepoRoot(options: DesktopRootOptions): string {
  const explicit = firstMeaningfulArg(options.argv);
  if (explicit) {
    const candidate = resolve(explicit);
    if (hasRepoMarkers(candidate)) {
      return candidate;
    }

    const candidateDir = dirname(candidate);
    if (hasRepoMarkers(candidateDir)) {
      return candidateDir;
    }

    const ancestor = findMarkedAncestor(candidate);
    if (ancestor) {
      return ancestor;
    }

    // No markers anywhere up the tree — accept a bare directory the user explicitly passed.
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  if (options.lastRoot && existsSync(options.lastRoot)) {
    return resolve(options.lastRoot);
  }

  return (
    findMarkedAncestor(options.cwd) ??
    findMarkedAncestor(dirname(options.execPath)) ??
    resolve(options.cwd)
  );
}

function firstMeaningfulArg(argv: readonly string[]): string | undefined {
  for (const arg of argv) {
    if (!arg || arg.startsWith("-")) {
      continue;
    }
    return arg;
  }

  return undefined;
}

function findMarkedAncestor(startDir: string): string | undefined {
  let current = resolve(startDir);

  while (true) {
    if (hasRepoMarkers(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

function hasRepoMarkers(dir: string): boolean {
  return REPO_MARKERS.some((marker) => existsSync(resolve(dir, marker)));
}
