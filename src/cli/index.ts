#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import React from "react";
import { render } from "ink";

import { spawn } from "node:child_process";

import { renderDesktopHtml } from "../desktop/render.js";
import { loadPromptPresets } from "../engine/prompts.js";
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

  if (command.mode === "status") {
    const state = await scanRepo(command.rootDir);
    const title = state.activeQuest.title.split("\n")[0]!.slice(0, 60);
    const line = `${title} · ${state.now.length} now · ${state.blocked.length} blocked · ${state.branch}`;
    process.stdout.write(`${line}\n`);
    return;
  }

  if (command.mode === "prompt") {
    const state = await scanRepo(command.rootDir);
    const presets = await loadPromptPresets(state, { rootDir: command.rootDir });
    if (command.action === "list") {
      for (const preset of presets) {
        const src = preset.source ?? "builtin";
        process.stdout.write(`${preset.id.padEnd(20)} ${src.padEnd(8)} ${preset.label}\n`);
      }
      return;
    }
    const match = presets.find((preset) => preset.id === command.id);
    if (!match) {
      process.stderr.write(`unknown prompt id: ${command.id}\n`);
      process.exit(1);
    }
    if (command.copy) {
      await copyToClipboard(match.body);
      process.stderr.write(`copied ${match.id} to clipboard\n`);
      return;
    }
    process.stdout.write(`${match.body}\n`);
    return;
  }

  if (command.mode === "desktop") {
    const state = await scanRepo(command.rootDir);
    const html = renderDesktopHtml(state);
    await mkdir(dirname(command.outputFile), { recursive: true });
    await writeFile(command.outputFile, html, "utf8");
    process.stdout.write(`desktop snapshot written to ${command.outputFile}\n`);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const state = await scanRepo(command.rootDir);
    process.stdout.write(`${formatStaticFrame(state, { interactive: false })}\n`);
    return;
  }

  render(React.createElement(WatchApp, { rootDir: command.rootDir }));
}

type Command =
  | { mode: "scan" | "watch" | "status"; rootDir: string }
  | { mode: "desktop"; rootDir: string; outputFile: string }
  | { mode: "prompt"; rootDir: string; action: "list" }
  | { mode: "prompt"; rootDir: string; action: "render"; id: string; copy: boolean };

function readCommand(args: string[]): Command {
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
  if (first === "status") {
    const pathArg = args.slice(1).find((arg) => !arg.startsWith("-"));
    return { mode: "status", rootDir: resolve(pathArg ?? ".") };
  }
  if (first === "prompt") {
    const rootIdx = args.indexOf("--root");
    const rootDir = rootIdx >= 0 && args[rootIdx + 1] ? resolve(args[rootIdx + 1]!) : resolve(".");
    if (!second || second === "list") {
      return { mode: "prompt", rootDir, action: "list" };
    }
    const copy = args.includes("--copy");
    return { mode: "prompt", rootDir, action: "render", id: second, copy };
  }
  if (first === "desktop") {
    const rootDir = resolve(second ?? ".");
    const outIndex = args.indexOf("--out");
    const outputFile = outIndex >= 0 && args[outIndex + 1]
      ? resolve(args[outIndex + 1]!)
      : resolve(rootDir, ".repolog", "desktop-preview.html");
    return { mode: "desktop", rootDir, outputFile };
  }
  if (first === "watch") {
    return { mode: "watch", rootDir: resolve(second ?? ".") };
  }

  return {
    mode: "watch",
    rootDir: resolve(first ?? "."),
  };
}

async function copyToClipboard(text: string): Promise<void> {
  const { platform } = process;
  const cmd = platform === "win32" ? "clip" : platform === "darwin" ? "pbcopy" : "xclip";
  const args = platform === "linux" ? ["-selection", "clipboard"] : [];
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", rejectPromise);
    child.on("exit", (code) => (code === 0 ? resolvePromise() : rejectPromise(new Error(`${cmd} exited ${code}`))));
    child.stdin.end(text);
  });
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
      "  repolog desktop [path] Write a desktop HUD snapshot HTML file",
      "  repolog status [path] --short   Print a one-line status summary",
      "  repolog prompt list             List available prompt presets",
      "  repolog prompt <id> [--copy]    Render a prompt; --copy sends to clipboard",
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
