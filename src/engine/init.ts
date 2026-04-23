import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { defaultRepoConfig } from "./config.js";

export type InitTarget = "plan" | "state" | "config";

export interface InitTemplateResult {
  target: InitTarget;
  fileName: string;
  content: string;
}

export function buildInitTemplates(rootDir: string): InitTemplateResult[] {
  const repoName = basename(resolve(rootDir)) || "Repo";

  return [
    {
      target: "plan",
      fileName: "PLAN.md",
      content: buildPlanTemplate(repoName),
    },
    {
      target: "state",
      fileName: "STATE.md",
      content: buildStateTemplate(repoName),
    },
    {
      target: "config",
      fileName: ".repolog.json",
      content: `${JSON.stringify(defaultRepoConfig(), null, 2)}\n`,
    },
  ];
}

export function buildPlanTemplate(repoName: string): string {
  return `---
title: ${repoName}
---

## Mission

A calm memory layer for repos that use AI coding agents.

## Objective

<!-- RepoLog looks here to answer: "What is this repo trying to become?" -->

Describe the current milestone in one sentence.

## Now

<!-- Unchecked items here appear in the HUD as current work. -->

- [ ] First active task

## Next

<!-- RepoLog pulls these into the HUD and handoff prompts as upcoming work. -->

- [ ] Next task after the current focus

## Blocked

<!-- List blockers with owner/reason so agents see what is waiting. -->

- [ ] Waiting on something external

## Releases (v0.1 / v0.2 / v0.3)

- [ ] Note the release history here.
`;
}

export function buildStateTemplate(repoName: string): string {
  return `---
title: ${repoName}
status: active
owner: claude
---

## Current Focus

<!-- One-liner: what is the team focused on right now? -->

One sentence about the current workstream.

## Resume Note

<!-- One paragraph: what happened last session and what the next agent should know. -->

> What happened last session and what the next agent should know.

## Recent Decisions

<!-- Bullet list of key decisions and why they were made. Helps prevent rework. -->

- Decision text and why it was made.
`;
}

export async function writeInitTemplates(
  rootDir: string,
  targets: readonly InitTarget[],
  options: { force?: boolean; write?: boolean } = {},
): Promise<InitTemplateResult[]> {
  const templates = buildInitTemplates(rootDir);
  const selected = templates.filter((template) => targets.includes(template.target));

  if (!options.write) {
    return selected;
  }

  await mkdir(resolve(rootDir), { recursive: true });
  for (const template of selected) {
    const filePath = resolve(rootDir, template.fileName);
    if (!options.force) {
      try {
        await access(filePath);
        throw new Error(`${template.fileName} already exists`);
      } catch (error) {
        if (error instanceof Error && error.message.endsWith("already exists")) {
          throw error;
        }
      }
    }

    await writeFile(filePath, template.content, "utf8");
  }

  return selected;
}
