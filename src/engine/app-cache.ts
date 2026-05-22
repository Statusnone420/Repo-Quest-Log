import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { repoCacheDir } from "./digest-cache.js";

export function defaultAppCacheRoot(): string {
  return join(homedir(), ".repolog", "cache");
}

export function desktopPreviewPath(rootDir: string, cacheRoot = defaultAppCacheRoot()): string {
  return join(repoCacheDir(cacheRoot, resolve(rootDir)), "desktop-preview.html");
}
