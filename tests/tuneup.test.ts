import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runDoctor } from "../src/engine/doctor.js";
import { buildTuneup } from "../src/engine/tuneup.js";

async function makeRepo(
  files: Record<string, string>,
  extraDirs: string[] = [],
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "repolog-tuneup-"));
  for (const [name, content] of Object.entries(files)) {
    const full = join(root, name);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  for (const dir of extraDirs) {
    await mkdir(join(root, dir), { recursive: true });
  }
  await mkdir(join(root, ".git"), { recursive: true });
  return root;
}

const PRISTINE_FILES = {
  "PLAN.md":
    "---\ntitle: Test repo\nstatus: active\n---\n\n## Mission\n\nA test repo.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] active task\n\n## Next\n\n- [ ] queued task\n",
  "STATE.md": "## Current Focus\nWorking on stuff.\n\n## Resume Note\n\n> Session 1: did things.\n",
  "CLAUDE.md": "## Role\n\nImplementer.\n\n## Owned Areas\n\n- `src/` — source\n",
  ".repolog/CHARTER.md": "# Charter\n\nThis repo uses RepoLog.\n",
};

describe("buildTuneup", () => {
  it("pristine repo scores 100 structural and 100 content", async () => {
    const root = await makeRepo(PRISTINE_FILES);
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    expect(result.score).toBe(100);
    expect(result.contentScore).toBe(100);
    expect(result.gaps).toHaveLength(0);
    expect(result.contentGaps).toHaveLength(0);
  });

  it("missing ## Objective yields structural gap and suggestedMarkdown", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Mission\n\nA test repo.\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1: did things.\n",
      "CLAUDE.md": "## Owned Areas\n\n- `src/`\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    const objectiveGap = result.gaps.find((g) => g.id === "missing-objective");
    expect(objectiveGap).toBeDefined();
    expect(objectiveGap!.severity).toBe("high");
    expect(objectiveGap!.suggestedMarkdown).toContain("## Objective");
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
  });

  it("missing ## Now yields high-severity structural gap", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Mission\n\nA thing.\n\n## Objective\n\nShip v1.\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
      "CLAUDE.md": "## Owned Areas\n\n- `src/`\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    const nowGap = result.gaps.find((g) => g.id === "empty-now");
    expect(nowGap).toBeDefined();
    expect(nowGap!.severity).toBe("high");
  });

  it("per-agent prompt includes agent owned areas and content gap info", async () => {
    const root = await makeRepo({
      "PLAN.md":
        "## Mission\n\nA thing.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
      "CLAUDE.md": "## Role\n\nImplementer.\n\n## Owned Areas\n\n- `src/` — code\n- `tests/` — tests\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    const agentIds = Object.keys(result.perAgent);
    expect(agentIds.length).toBeGreaterThan(0);
    const prompt = result.perAgent[agentIds[0]!]!;
    expect(prompt).toContain("src/");
  });

  it("CHARTER.md generation is deterministic", async () => {
    const root = await makeRepo(PRISTINE_FILES);
    const report = await runDoctor(root);

    const result1 = await buildTuneup(report.state, report, root);
    const result2 = await buildTuneup(report.state, report, root);

    expect(result1.charter).toBe(result2.charter);
    expect(result1.charter).toContain("## Required Headings");
    expect(result1.charter).toContain("## Rules");
  });

  it("missing CHARTER.md yields med-severity structural gap", async () => {
    const root = await makeRepo({
      "PLAN.md":
        "## Mission\n\nA thing.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
      "CLAUDE.md": "## Owned Areas\n\n- `src/`\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    const charterGap = result.gaps.find((g) => g.id === "no-charter");
    expect(charterGap).toBeDefined();
    expect(charterGap!.severity).toBe("med");
    expect(result.score).toBeLessThan(100);
  });

  it("prompt contains both scores and fix sections", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    expect(result.prompt).toContain("/100");
    expect(result.prompt).toContain("Structural ");
    expect(result.prompt).toContain("Content ");
    expect(result.prompt).toContain("repolog tuneup");
  });

  it("tuneup score and contentScore are included in doctor report", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Mission\n\nA thing.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
    });
    const report = await runDoctor(root);

    expect(typeof report.tuneup.score).toBe("number");
    expect(typeof report.tuneup.contentScore).toBe("number");
    expect(Array.isArray(report.tuneup.gaps)).toBe(true);
    expect(Array.isArray(report.tuneup.contentGaps)).toBe(true);
  });

  it("boilerplate mission triggers content gap with currentContent", async () => {
    const root = await makeRepo({
      "PLAN.md":
        "---\ntitle: Test\nstatus: active\n---\n\n## Mission\n\nThis template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1: did dev work.\n",
      "CLAUDE.md": "## Role\n\nImplementer.\n\n## Owned Areas\n\n- `src/` — source\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    const boilerGap = result.contentGaps.find((g) => g.id === "mission-boilerplate");
    expect(boilerGap).toBeDefined();
    expect(boilerGap!.severity).toBe("high");
    expect(boilerGap!.currentContent).toContain("minimal setup");
    expect(result.contentScore).toBeLessThan(100);
    expect(result.score).toBe(100); // structural is still perfect
  });

  it("generic objective triggers content gap", async () => {
    const root = await makeRepo({
      "PLAN.md":
        "---\ntitle: Test\nstatus: active\n---\n\n## Mission\n\nA real app.\n\n## Objective\n\nCurrent session focus\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1: did dev work.\n",
      "CLAUDE.md": "## Role\n\nImplementer.\n\n## Owned Areas\n\n- `src/` — source\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    const genericGap = result.contentGaps.find((g) => g.id === "objective-generic");
    expect(genericGap).toBeDefined();
    expect(genericGap!.currentContent).toBe("Current session focus");
    expect(result.contentScore).toBeLessThan(100);
    expect(result.score).toBe(100);
  });

  it("game-progress resume note triggers content gap", async () => {
    const root = await makeRepo({
      "PLAN.md":
        "## Mission\n\nA real app.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] Approaching Chapter 10\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1: did dev work.\n",
      "CLAUDE.md": "## Owned Areas\n\n- `src/`\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    // The resume note task is pulled from the top now-task "Approaching Chapter 10"
    const gameGap = result.contentGaps.find((g) => g.id === "resume-note-game-progress");
    expect(gameGap).toBeDefined();
    expect(gameGap!.severity).toBe("high");
    expect(result.contentScore).toBeLessThan(100);
  });

  it("prompt includes Repo Fingerprint section when rootDir provided", async () => {
    const root = await makeRepo(PRISTINE_FILES);
    // Write a package.json so the fingerprint has something to show
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "test-app", description: "A test application", version: "1.0.0" }),
      "utf8",
    );
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    expect(result.prompt).toContain("## Context");
    expect(result.prompt).toContain("test-app");
  });

  it("content quality prompt shows Now/Problem/Write per issue", async () => {
    const root = await makeRepo({
      "PLAN.md":
        "## Mission\n\nThis boilerplate provides a minimal setup to get React working.\n\n## Objective\n\nCurrent session focus\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1: did dev work.\n",
      "CLAUDE.md": "## Owned Areas\n\n- `src/`\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = await buildTuneup(report.state, report, root);

    expect(result.prompt).toContain("**Now:**");
    expect(result.prompt).toContain("**Problem:**");
    expect(result.prompt).toContain("**Write:**");
  });
});
