import { describe, expect, it } from "vitest";

import { inferAgentActivity } from "../src/engine/activity.js";
import type { AgentProfile, FileChange } from "../src/engine/types.js";

const agents: AgentProfile[] = [
  {
    id: "claude",
    name: "Claude",
    file: "CLAUDE.md",
    role: "Planner + implementer",
    area: "src, docs, tests",
    objective: "Drive plan to 100%",
    constraints: [],
    status: "active",
  },
  {
    id: "codex",
    name: "Codex",
    file: "AGENTS.md",
    role: "Implementer",
    area: "apps/desktop, extensions",
    objective: "Ship surfaces",
    constraints: [],
    status: "working",
  },
];

describe("inferAgentActivity", () => {
  it("scores recent files against agent-owned areas", () => {
    const changes: FileChange[] = [
      { file: "src/engine/git.ts", at: "2m" },
      { file: "apps/desktop/main.cjs", at: "5m" },
      { file: "README.md", at: "1h" },
    ];

    const activity = inferAgentActivity(agents, changes);
    expect(activity.length).toBe(2);
    expect(activity[0]?.agent).toBe("claude");
    expect(activity[0]?.file).toBe("src/engine/git.ts");
    expect(activity[1]?.agent).toBe("codex");
    expect(activity[1]?.file).toBe("apps/desktop/main.cjs");
    expect(activity[0]?.confidence).toBeGreaterThan(0.5);
  });

  it("returns empty when no agents or no changes", () => {
    expect(inferAgentActivity([], [{ file: "x", at: "2m" }])).toEqual([]);
    expect(inferAgentActivity(agents, [])).toEqual([]);
  });
});
