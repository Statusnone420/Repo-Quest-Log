export function formatCodeOpenTarget(filePath: string, line?: number, column = 1): string {
  if (!line || line < 1) {
    return filePath;
  }

  return `${filePath}:${line}:${column}`;
}

export function buildCodeOpenArgs(filePath: string, line?: number, column = 1): string[] {
  return ["-g", formatCodeOpenTarget(filePath, line, column)];
}
