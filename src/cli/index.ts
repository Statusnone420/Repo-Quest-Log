#!/usr/bin/env node
// CLI entry: `quest-log scan .` prints QuestState JSON.
// `quest-log --watch` launches the TUI (once task 6 lands).
//
// TODO: wire up commander or a hand-rolled argv parser, then call into
// src/engine and src/tui.

console.log(JSON.stringify({
  schemaVersion: 1,
  error: "not_implemented",
  message: "See PLAN.md — task 1 first.",
}, null, 2));
