import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
      expect(await readFile(join(root, "PLAN.md"), "utf8")).toContain("## Objective");
      expect(await readFile(join(root, "STATE.md"), "utf8")).toContain("## Resume Note");
      expect(await readFile(join(root, ".repolog.json"), "utf8")).toContain("\"schemaVersion\": 2");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
