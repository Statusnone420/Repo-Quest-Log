#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { resolve } from "node:path";

import { scanRepo } from "../engine/scan.js";
import { formatStaticFrame, WatchApp } from "../tui/App.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = readCommand(args);

  if (command.mode === "scan") {
    const state = await scanRepo(command.rootDir);
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const state = await scanRepo(command.rootDir);
    process.stdout.write(`${formatStaticFrame(state, { interactive: false })}\n`);
    return;
  }

  render(React.createElement(WatchApp, { rootDir: command.rootDir }));
}

function readCommand(args: string[]): { mode: "scan" | "watch"; rootDir: string } {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--watch")) {
    const maybePath = args.find((arg) => !arg.startsWith("-") && arg !== "scan" && arg !== "watch");
    return {
      mode: "watch",
      rootDir: resolve(maybePath ?? "."),
    };
  }

  const [first, second] = args;
  if (first === "scan") {
    return { mode: "scan", rootDir: resolve(second ?? ".") };
  }
  if (first === "watch") {
    return { mode: "watch", rootDir: resolve(second ?? ".") };
  }

  return {
    mode: "watch",
    rootDir: resolve(first ?? "."),
  };
}

function printHelp(): void {
  process.stdout.write(
    [
      "repolog",
      "",
      "Usage:",
      "  repolog                Start the TUI watcher in the current repo",
      "  repolog scan [path]    Print QuestState JSON for a repo",
      "  repolog watch [path]   Start the TUI watcher for a repo",
      "  repolog --watch [path] Same as watch",
      "",
      "Keys in watch mode:",
      "  q quit",
      "  r rescan",
      "",
    ].join("\n"),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
