#!/usr/bin/env node
import { mkdir, readFileSync, writeFile } from "node:fs";
import { mkdir as mkdirAsync, writeFile as writeFileAsync } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { render } from "ink";

import { renderDesktopHtml } from "../desktop/render.js";
import { copyTextToClipboard } from "../engine/clipboard.js";
import { buildInitTemplates, writeInitTemplates, type InitTarget } from "../engine/init.js";
import { formatDoctorReport, runDoctor } from "../engine/doctor.js";
import { loadPromptPresets } from "../engine/prompts.js";
import { buildStandupForRepo, type StandupSince } from "../engine/standup.js";
import { scanRepo } from "../engine/scan.js";
import { buildTuneup } from "../engine/tuneup.js";
import { formatStaticFrame, WatchApp } from "../tui/App.js";

async function main(): Promise<void> {
  const command = readCommand(process.argv.slice(2));

  switch (command.mode) {
    case "version":
      process.stdout.write(`${readPackageVersion()}\n`);
      return;
    case "init": {
      const targets = command.all ? (["plan", "state", "config"] as const) : command.targets;
      if (command.write) {
        const outputs = await writeInitTemplates(command.rootDir, targets, { force: command.force, write: true });
        for (const template of outputs) {
          process.stderr.write(`wrote ${resolve(command.rootDir, template.fileName)}\n`);
        }
        return;
      }

      const outputs = buildInitTemplates(command.rootDir).filter((template) => targets.includes(template.target));
      for (const template of outputs) {
        process.stdout.write(`--- ${template.fileName} ---\n`);
        process.stdout.write(`${template.content}\n`);
      }
      return;
    }
    case "scan": {
      const state = await scanRepo(command.rootDir);
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
      return;
    }
    case "doctor": {
      const report = await runDoctor(command.rootDir);
      if (command.json) {
        const { state: _state, ...rest } = report;
        process.stdout.write(`${JSON.stringify(rest, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${formatDoctorReport(report)}\n`);
      if (report.findings.some((finding) => finding.severity === "warn")) {
        process.exitCode = 1;
      }
      return;
    }
    case "tuneup": {
      const report = await runDoctor(command.rootDir);
      const tuneup = await buildTuneup(report.state, report, command.rootDir);

      if (command.agent) {
        const agentPrompt = tuneup.perAgent[command.agent];
        if (!agentPrompt) {
          process.stderr.write(`note: no agent file found for "${command.agent}" - using generic prompt\n`);
          const output = tuneup.prompt;
          if (command.copy) {
            const copied = await copyTextToClipboard(output);
            process.stderr.write(copied ? "tuneup prompt copied to clipboard\n" : "clipboard unavailable\n");
            return;
          }
          process.stdout.write(`${output}\n`);
          return;
        }

        if (command.copy) {
          const copied = await copyTextToClipboard(agentPrompt);
          process.stderr.write(copied ? `tuneup prompt for ${command.agent} copied to clipboard\n` : "clipboard unavailable\n");
          return;
        }
        process.stdout.write(`${agentPrompt}\n`);
        return;
      }

      if (command.writeCharter) {
        const charterPath = resolve(command.rootDir, ".repolog", "CHARTER.md");
        await mkdirAsync(resolve(command.rootDir, ".repolog"), { recursive: true });
        await writeFileAsync(charterPath, tuneup.charter, "utf8");
        process.stderr.write(`wrote ${charterPath}\n`);
      }

      if (command.copy) {
        const copied = await copyTextToClipboard(tuneup.prompt);
        process.stderr.write(copied ? "tuneup prompt copied to clipboard\n" : "clipboard unavailable\n");
        return;
      }

      process.stdout.write(`${tuneup.prompt}\n`);
      return;
    }
    case "status": {
      const state = await scanRepo(command.rootDir);
      const title = state.activeQuest.title.split("\n")[0]!.slice(0, 60);
      const line = `${title} · ${state.now.length} now · ${state.blocked.length} blocked · ${state.branch}`;
      process.stdout.write(`${line}\n`);
      return;
    }
    case "prompt": {
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
        const copied = await copyTextToClipboard(match.body);
        if (!copied) {
          process.stderr.write("clipboard unavailable\n");
          process.exit(1);
        }
        process.stderr.write(`copied ${match.id} to clipboard\n`);
        return;
      }

      process.stdout.write(`${match.body}\n`);
      return;
    }
    case "standup": {
      const state = await scanRepo(command.rootDir);
      const result = await buildStandupForRepo(command.rootDir, state, { since: command.since });
      if (command.copy) {
        const copied = await copyTextToClipboard(result.markdown);
        if (!copied) {
          process.stderr.write("clipboard unavailable\n");
          process.exit(1);
        }
        process.stderr.write("copied standup export to clipboard\n");
        return;
      }
      process.stdout.write(command.json ? `${JSON.stringify(result.json, null, 2)}\n` : `${result.markdown}\n`);
      return;
    }
    case "desktop": {
      const state = await scanRepo(command.rootDir);
      const html = renderDesktopHtml(state);
      await mkdirAsync(dirname(command.outputFile), { recursive: true });
      await writeFileAsync(command.outputFile, html, "utf8");
      process.stdout.write(`desktop snapshot written to ${command.outputFile}\n`);
      return;
    }
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const state = await scanRepo(command.rootDir);
    process.stdout.write(`${formatStaticFrame(state, { interactive: false })}\n`);
    return;
  }

  render(React.createElement(WatchApp, { rootDir: command.rootDir }));
}

type Command =
  | { mode: "version" }
  | { mode: "scan" | "watch" | "status"; rootDir: string }
  | { mode: "doctor"; rootDir: string; json: boolean }
  | { mode: "tuneup"; rootDir: string; writeCharter: boolean; copy: boolean; agent: string | null }
  | { mode: "desktop"; rootDir: string; outputFile: string }
  | { mode: "init"; rootDir: string; targets: InitTarget[]; all: boolean; write: boolean; force: boolean }
  | { mode: "prompt"; rootDir: string; action: "list" }
  | { mode: "prompt"; rootDir: string; action: "render"; id: string; copy: boolean }
  | { mode: "standup"; rootDir: string; copy: boolean; json: boolean; since: StandupSince };

export function readCommand(args: string[]): Command {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    return { mode: "version" };
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
  if (first === "doctor") {
    const pathArg = args.slice(1).find((arg) => !arg.startsWith("-"));
    return { mode: "doctor", rootDir: resolve(pathArg ?? "."), json: args.includes("--json") };
  }
  if (first === "tuneup") {
    const pathArg = args.slice(1).find((arg) => !arg.startsWith("-"));
    const agentArg = args.find((a) => a.startsWith("--agent="))?.slice("--agent=".length) ?? null;
    return {
      mode: "tuneup",
      rootDir: resolve(pathArg ?? "."),
      writeCharter: args.includes("--write-charter"),
      copy: args.includes("--copy"),
      agent: agentArg,
    };
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
  if (first === "init") {
    const targets: InitTarget[] = [];
    if (args.includes("--plan")) targets.push("plan");
    if (args.includes("--state")) targets.push("state");
    if (args.includes("--config")) targets.push("config");
    const all = args.includes("--all");
    if (all) {
      targets.splice(0, targets.length, "plan", "state", "config");
    }
    if (targets.length === 0) {
      targets.push("plan");
    }

    const pathArg = args.slice(1).find((arg) => !arg.startsWith("-"));
    return {
      mode: "init",
      rootDir: resolve(pathArg ?? "."),
      targets,
      all,
      write: args.includes("--write"),
      force: args.includes("--force"),
    };
  }
  if (first === "standup") {
    const pathArg = args.slice(1).find((arg) => !arg.startsWith("-"));
    return {
      mode: "standup",
      rootDir: resolve(pathArg ?? "."),
      copy: args.includes("--copy"),
      json: args.includes("--json"),
      since: readStandupSince(args),
    };
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
      "  repolog desktop [path] Write a desktop HUD snapshot HTML file",
      "  repolog init [path] [--plan|--state|--config|--all] [--write] [--force]",
      "  repolog status [path] --short   Print a one-line status summary",
      "  repolog doctor [path] [--json]  Explain what was scanned and why state looks empty",
      "  repolog tuneup [path] [--write-charter] [--copy] [--agent=claude|codex|gemini]",
      "  repolog prompt list             List available prompt presets",
      "  repolog prompt <id> [--copy]    Render a prompt; --copy sends to clipboard",
      "  repolog standup [path] [--since=today|yesterday|7d] [--copy] [--json]",
      "",
      "Keys in watch mode:",
      "  q quit",
      "  r rescan",
      "  t tuneup overlay",
      "",
    ].join("\n"),
  );
}

function readStandupSince(args: string[]): StandupSince {
  const value = args.find((arg) => arg.startsWith("--since="))?.slice("--since=".length) ?? "today";
  if (value === "today" || value === "yesterday" || value === "7d") {
    return value;
  }
  process.stderr.write(`invalid --since value: ${value}\n`);
  process.exit(1);
}

function readPackageVersion(): string {
  const raw = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ? `v${parsed.version}` : "v0.0.0";
}

const isEntryPoint = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isEntryPoint) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}

export { main };
