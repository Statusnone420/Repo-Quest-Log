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
  it("pristine repo scores 100", async () => {
    const root = await makeRepo(PRISTINE_FILES);
    const report = await runDoctor(root);
    const result = buildTuneup(report.state, report);

    expect(result.score).toBe(100);
    expect(result.gaps).toHaveLength(0);
  });

  it("missing ## Objective yields gap and suggestedMarkdown", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Mission\n\nA test repo.\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1: did things.\n",
      "CLAUDE.md": "## Owned Areas\n\n- `src/`\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = buildTuneup(report.state, report);

    const objectiveGap = result.gaps.find((g) => g.id === "missing-objective");
    expect(objectiveGap).toBeDefined();
    expect(objectiveGap!.severity).toBe("high");
    expect(objectiveGap!.suggestedMarkdown).toContain("## Objective");
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
  });

  it("missing ## Now yields high-severity gap", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Mission\n\nA thing.\n\n## Objective\n\nShip v1.\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
      "CLAUDE.md": "## Owned Areas\n\n- `src/`\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = buildTuneup(report.state, report);

    const nowGap = result.gaps.find((g) => g.id === "empty-now");
    expect(nowGap).toBeDefined();
    expect(nowGap!.severity).toBe("high");
  });

  it("per-agent prompt includes agent owned areas", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Mission\n\nA thing.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
      "CLAUDE.md": "## Role\n\nImplementer.\n\n## Owned Areas\n\n- `src/` — code\n- `tests/` — tests\n",
      ".repolog/CHARTER.md": "# Charter\n",
    });
    const report = await runDoctor(root);
    const result = buildTuneup(report.state, report);

    const agentIds = Object.keys(result.perAgent);
    expect(agentIds.length).toBeGreaterThan(0);
    const prompt = result.perAgent[agentIds[0]!]!;
    expect(prompt).toContain("src/");
  });

  it("CHARTER.md generation is deterministic", async () => {
    const root = await makeRepo(PRISTINE_FILES);
    const report = await runDoctor(root);

    const result1 = buildTuneup(report.state, report);
    const result2 = buildTuneup(report.state, report);

    expect(result1.charter).toBe(result2.charter);
    expect(result1.charter).toContain("## Required Headings");
    expect(result1.charter).toContain("## How Agents Should Update Markdown");
  });

  it("missing CHARTER.md yields med-severity gap", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Mission\n\nA thing.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n\n## Next\n\n- [ ] queue\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
      "CLAUDE.md": "## Owned Areas\n\n- `src/`\n",
    });
    const report = await runDoctor(root);
    const result = buildTuneup(report.state, report);

    const charterGap = result.gaps.find((g) => g.id === "no-charter");
    expect(charterGap).toBeDefined();
    expect(charterGap!.severity).toBe("med");
    expect(result.score).toBeLessThan(100);
  });

  it("prompt contains score and gap ids", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
    });
    const report = await runDoctor(root);
    const result = buildTuneup(report.state, report);

    expect(result.prompt).toContain("/100");
    expect(result.prompt).toContain("## Gaps to Fix");
    expect(result.prompt).toContain("repolog tuneup");
  });

  it("tuneup score is included in doctor JSON output", async () => {
    const root = await makeRepo({
      "PLAN.md": "## Mission\n\nA thing.\n\n## Objective\n\nShip v1.\n\n## Now\n\n- [ ] task\n",
      "STATE.md": "## Resume Note\n\n> Session 1.\n",
    });
    const report = await runDoctor(root);

    expect(typeof report.tuneup.score).toBe("number");
    expect(Array.isArray(report.tuneup.gaps)).toBe(true);
  });
});
