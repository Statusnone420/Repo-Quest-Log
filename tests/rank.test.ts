import { describe, expect, it } from "vitest";

import { rankBuckets } from "../src/engine/rank.js";

describe("rankBuckets", () => {
  it("sorts by doc priority, line number, and confidence", () => {
    const ranked = rankBuckets(
      {
        now: [
          { id: "c", text: "Later item", doc: "notes.md", line: 20, confidence: 0.7 },
          { id: "a", text: "Top item", doc: "STATE.md", line: 30, confidence: 0.4 },
          { id: "b", text: "Earlier item", doc: "PLAN.md", line: 5, confidence: 0.9 },
          { id: "d", text: "Dropped by cap", doc: "PLAN.md", line: 1, confidence: 1 },
        ],
        next: [
          { id: "n2", text: "Middle", doc: "README.md", line: 12, confidence: 0.8 },
          { id: "n1", text: "First", doc: "README.md", line: 3, confidence: 0.8 },
        ],
        blocked: [
          { id: "x2", text: "Blocked B", doc: "README.md", line: 11, confidence: 0.8, reason: "waiting", since: "1d" },
          { id: "x1", text: "Blocked A", doc: "STATE.md", line: 2, confidence: 0.8, reason: "waiting", since: "2h" },
        ],
      },
      {
        docOrder: ["STATE.md", "PLAN.md", "README.md"],
        nowLimit: 3,
        nextLimit: 5,
      },
    );

    expect(ranked.now.map((task) => task.id)).toEqual(["a", "d", "b"]);
    expect(ranked.next.map((task) => task.id)).toEqual(["n1", "n2"]);
    expect(ranked.blocked.map((task) => task.id)).toEqual(["x1", "x2"]);
  });
});
