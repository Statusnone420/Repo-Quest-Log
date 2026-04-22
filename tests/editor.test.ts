import { describe, expect, it } from "vitest";

import { buildCodeOpenArgs, formatCodeOpenTarget } from "../src/engine/editor.js";

describe("editor helpers", () => {
  it("formats VS Code open targets with exact line numbers", () => {
    expect(formatCodeOpenTarget("PLAN.md", 12)).toBe("PLAN.md:12:1");
    expect(formatCodeOpenTarget("PLAN.md")).toBe("PLAN.md");
    expect(buildCodeOpenArgs("PLAN.md", 12)).toEqual(["-g", "PLAN.md:12:1"]);
  });
});
