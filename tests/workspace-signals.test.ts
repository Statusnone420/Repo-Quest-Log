import { describe, expect, it } from "vitest";

import {
  annotateRecentActivity,
  computeWorkspaceSignals,
  deriveWorkspaceScope,
} from "../src/engine/workspace-signals.js";
import type { AgentProfile, RecentActivityEvent, Task } from "../src/engine/types.js";

const now = Date.parse("2026-06-01T17:00:00.000Z");

describe("workspace signals", () => {
  it("computes edit rate, file spread, last edit age, and trend buckets", () => {
    const events: RecentActivityEvent[] = [
      event("src/web/render.ts", "change", 12),
      event("src/engine/workspace-signals.ts", "change", 28),
      event("tests/workspace-signals.test.ts", "add", 120),
      event("src/web/render.ts", "change", 260),
    ];

    const signals = computeWorkspaceSignals(events, ["src", "tests"], now);

    expect(signals.editRate).toBe(2);
    expect(signals.filesTouched).toBe(3);
    expect(signals.lastEditAge).toBe("12s ago");
    expect(signals.state).toBe("Focused");
    expect(signals.trend).toHaveLength(30);
  });

  it("marks scope drift only when a usable scope exists", () => {
    const events: RecentActivityEvent[] = [
      event("README.md", "change", 12),
      event("src/web/render.ts", "change", 28),
    ];

    const withoutScope = computeWorkspaceSignals(events, [], now);
    const withScope = computeWorkspaceSignals(events, ["src/web"], now);
    const annotated = annotateRecentActivity(events, ["src/web"], now);

    expect(withoutScope.scopeActive).toBe(false);
    expect(withoutScope.scopeDriftCount).toBe(0);
    expect(withScope.scopeActive).toBe(true);
    expect(withScope.scopeDriftCount).toBe(1);
    expect(annotated.find((item) => item.file === "README.md")?.outsideScope).toBe(true);
  });

  it("keeps scope drift brief and counts unique files", () => {
    const events: RecentActivityEvent[] = [
      event("repolog-layout-ping.md", "add", 5),
      event("repolog-layout-ping.md", "change", 12),
      event("repolog-layout-ping.md", "unlink", 45),
      event("README.md", "change", 90),
    ];

    const signals = computeWorkspaceSignals(events, ["src/web"], now);

    expect(signals.scopeDriftCount).toBe(1);
    expect(signals.state).toBe("Drifting");

    const settled = computeWorkspaceSignals(events, ["src/web"], now + 70_000);
    expect(settled.scopeDriftCount).toBe(0);
    expect(settled.state).toBe("Focused");
  });

  it("classifies repeated same-file edits as thrash", () => {
    const events: RecentActivityEvent[] = [
      event("src/web/render.ts", "change", 5),
      event("src/web/render.ts", "change", 12),
      event("src/web/render.ts", "change", 24),
      event("src/web/render.ts", "change", 36),
      event("src/web/render.ts", "change", 48),
    ];

    const signals = computeWorkspaceSignals(events, ["src/web"], now);

    expect(signals.thrashLevel).toBe("High");
    expect(signals.state).toBe("Thrashing");
    expect(signals.repeatedFiles).toEqual(["src/web/render.ts"]);
  });

  it("prefers the active Now task agent's owned area for scope", () => {
    const agents: AgentProfile[] = [
      agent("codex", "src/web/** · apps/desktop/**"),
      agent("claude", "docs/**"),
    ];
    const nowTasks: Task[] = [
      { id: "1", text: "Fix desktop HUD", doc: "PLAN.md", confidence: 1, agent: "codex" },
    ];

    expect(deriveWorkspaceScope(nowTasks, agents)).toEqual(["src/web", "apps/desktop"]);
    expect(deriveWorkspaceScope([], agents)).toEqual(["src/web", "apps/desktop", "docs"]);
  });

  it("keeps archived agent docs out of fallback workspace scope", () => {
    const agents: AgentProfile[] = [
      agent("codex", "src/web/**"),
      { ...agent("claude", "docs/**"), status: "archived" },
      { ...agent("gemini", "architecture/**"), status: "archived" },
    ];

    expect(deriveWorkspaceScope([], agents)).toEqual(["src/web"]);
  });

  it("accepts bare directory and list-style owned areas", () => {
    const agents: AgentProfile[] = [
      agent("codex", "- src\n- docs\n- `apps/desktop/**`\n- general"),
    ];

    expect(deriveWorkspaceScope([], agents)).toEqual(["src", "docs", "apps/desktop"]);
    expect(computeWorkspaceSignals([event("README.md", "change", 5)], ["src"], now).scopeDriftCount).toBe(1);
  });
});

function event(file: string, kind: RecentActivityEvent["kind"], secondsAgo: number): RecentActivityEvent {
  return { file, kind, ts: now - (secondsAgo * 1000) };
}

function agent(id: string, area: string): AgentProfile {
  return {
    id,
    name: id,
    file: `${id}.md`,
    role: "role",
    area,
    objective: "objective",
    constraints: [],
    status: "idle",
  };
}
