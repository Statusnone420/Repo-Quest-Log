import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPO_MARKERS = ["PLAN.md", "STATE.md", "README.md", "AGENTS.md"];

export interface DesktopRootOptions {
  argv: readonly string[];
  cwd: string;
  execPath: string;
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
