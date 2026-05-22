import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildInitTemplates, writeInitTemplates } from "../src/engine/init.js";
import { readCommand } from "../src/cli/index.js";

describe("CLI command parsing", () => {
  it("parses init targets and version flag", () => {
    expect(readCommand(["--version"])).toEqual({ mode: "version" });
    expect(readCommand(["init", "--plan", "--write"])).toMatchObject({
      mode: "init",
      targets: ["plan"],
      write: true,
    });
    expect(readCommand(["init", "--all"])).toMatchObject({
      mode: "init",
      all: true,
      targets: ["plan", "state", "config"],
    });
  });

  it("defaults desktop snapshots to the app cache, not the target repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-cli-desktop-"));
    try {
      const command = readCommand(["desktop", root]);
      expect(command).toMatchObject({ mode: "desktop", rootDir: resolve(root) });
      if (command.mode !== "desktop") throw new Error("expected desktop command");
      expect(command.outputFile.startsWith(resolve(root))).toBe(false);
      expect(command.outputFile).toContain("desktop-preview.html");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("init templates", () => {
  it("builds templates with the expected sections", () => {
    const templates = buildInitTemplates("D:/Repo Quest Log");
    expect(templates.map((template) => template.fileName)).toEqual(["PLAN.md", "STATE.md", ".repolog.json"]);
    expect(templates[0]?.content).toContain("## Objective");
    expect(templates[1]?.content).toContain("## Resume Note");
    expect(templates[2]?.content).toContain("\"writeback\": false");
  });

  it("writes templates to disk when requested", async () => {
    const root = await mkdtemp(join(tmpdir(), "repolog-init-"));
    try {
      const outputs = await writeInitTemplates(root, ["plan", "state", "config"], { write: true, force: true });
      expect(outputs).toHaveLength(3);
      expect(outputs.map((output) => output.filePath)).toEqual([
        join(root, "PLAN.md"),
        join(root, "STATE.md"),
        join(root, ".repolog.json"),
      ]);
      expect(await readFile(join(root, "PLAN.md"), "utf8")).toContain("## Objective");
      expect(await readFile(join(root, "STATE.md"), "utf8")).toContain("## Resume Note");
      expect(await readFile(join(root, ".repolog.json"), "utf8")).toContain("\"schemaVersion\": 2");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
