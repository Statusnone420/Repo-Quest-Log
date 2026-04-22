#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import React from "react";
import { render } from "ink";

import { renderDesktopHtml } from "../desktop/render.js";
import { copyTextToClipboard } from "../engine/clipboard.js";
import { formatCopilotResponse, runCopilotQuery } from "../engine/copilot.js";
import { formatDoctorReport, runDoctor } from "../engine/doctor.js";
import { loadPromptPresets } from "../engine/prompts.js";
import { buildStandupForRepo, type StandupSince } from "../engine/standup.js";
import { scanRepo } from "../engine/scan.js";
import { buildTuneup } from "../engine/tuneup.js";
import { formatStaticFrame, WatchApp } from "../tui/App.js";
import { buildAuthDiscoveryReport, formatAuthDiscoveryReport, saveSelectedProvider } from "./copilot-auth.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = readCommand(args);

  if (command.mode === "scan") {
    const state = await scanRepo(command.rootDir);
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }

  if (command.mode === "doctor") {
    const report = await runDoctor(command.rootDir);
    if (command.json) {
      const { state: _state, ...rest } = report;
      process.stdout.write(`${JSON.stringify(rest, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${formatDoctorReport(report)}\n`);
    const hasWarn = report.findings.some((f) => f.severity === "warn");
    if (hasWarn) process.exitCode = 1;
    return;
  }

  if (command.mode === "auth") {
    if (command.action === "use") {
      await saveSelectedProvider(command.rootDir, command.provider);
      const report = await buildAuthDiscoveryReport(command.rootDir);
      if (command.json) {
        process.stdout.write(`${JSON.stringify({ selectedProvider: command.provider, report }, null, 2)}\n`);
      } else {
        process.stdout.write(`selected ${command.provider} for ${report.rootDir}\n`);
      }
      return;
    }

    const report = await buildAuthDiscoveryReport(command.rootDir);
    if (command.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    process.stdout.write(`${formatAuthDiscoveryReport(report)}\n`);
    return;
  }

  if (command.mode === "repobot") {
    await runRepoBot(command);
    return;
  }

  if (command.mode === "tuneup") {
    const report = await runDoctor(command.rootDir);
    const tuneup = buildTuneup(report.state, report);

    if (command.agent) {
      const agentPrompt = tuneup.perAgent[command.agent];
      if (!agentPrompt) {
        process.stderr.write(`note: no agent file found for "${command.agent}" — using generic prompt\n`);
        const output = tuneup.prompt;
        if (command.copy) {
          const copied = await copyTextToClipboard(output);
          if (!copied) process.stderr.write("clipboard unavailable\n");
          else process.stderr.write("tuneup prompt copied to clipboard\n");
          return;
        }
        process.stdout.write(`${output}\n`);
        return;
      }
      if (command.copy) {
        const copied = await copyTextToClipboard(agentPrompt);
        if (!copied) process.stderr.write("clipboard unavailable\n");
        else process.stderr.write(`tuneup prompt for ${command.agent} copied to clipboard\n`);
        return;
      }
      process.stdout.write(`${agentPrompt}\n`);
      return;
    }

    if (command.writeCharter) {
      const charterPath = resolve(command.rootDir, ".repolog", "CHARTER.md");
      await mkdir(resolve(command.rootDir, ".repolog"), { recursive: true });
      await writeFile(charterPath, tuneup.charter, "utf8");
      process.stderr.write(`wrote ${charterPath}\n`);
    }

    if (command.copy) {
      const copied = await copyTextToClipboard(tuneup.prompt);
      if (!copied) process.stderr.write("clipboard unavailable\n");
      else process.stderr.write("tuneup prompt copied to clipboard\n");
      return;
    }

    process.stdout.write(`${tuneup.prompt}\n`);
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

  if (command.mode === "standup") {
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
  | { mode: "doctor"; rootDir: string; json: boolean }
  | { mode: "auth"; rootDir: string; action: "discover"; json: boolean }
  | { mode: "auth"; rootDir: string; action: "status"; json: boolean }
  | { mode: "auth"; rootDir: string; action: "use"; provider: string; json: boolean }
  | { mode: "repobot"; rootDir: string; prompt: string | null; json: boolean }
  | { mode: "tuneup"; rootDir: string; writeCharter: boolean; copy: boolean; agent: string | null }
  | { mode: "desktop"; rootDir: string; outputFile: string }
  | { mode: "prompt"; rootDir: string; action: "list" }
  | { mode: "prompt"; rootDir: string; action: "render"; id: string; copy: boolean }
  | { mode: "standup"; rootDir: string; copy: boolean; json: boolean; since: StandupSince };

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
  if (first === "repobot") {
    const pathArg = args.slice(1).find((arg) => !arg.startsWith("-") && !arg.startsWith("--prompt="));
    const prompt = args.find((arg) => arg.startsWith("--prompt="))?.slice("--prompt=".length) ?? null;
    return {
      mode: "repobot",
      rootDir: resolve(pathArg ?? "."),
      prompt,
      json: args.includes("--json"),
    };
  }
  if (first === "doctor") {
    const pathArg = args.slice(1).find((arg) => !arg.startsWith("-"));
    return { mode: "doctor", rootDir: resolve(pathArg ?? "."), json: args.includes("--json") };
  }
  if (first === "auth") {
    const subcommand = args[1];
    const json = args.includes("--json");
    if (subcommand === "use") {
      const provider = args[2];
      if (!provider || provider.startsWith("-")) {
        process.stderr.write("missing provider for repolog auth use\n");
        process.exit(1);
      }
      const rootDir = readPathArg(args.slice(3)) ?? resolve(".");
      return { mode: "auth", rootDir, action: "use", provider, json };
    }
    const rootDir = readPathArg(args.slice(2)) ?? resolve(".");
    if (subcommand === "status") {
      return { mode: "auth", rootDir, action: "status", json };
    }
    return { mode: "auth", rootDir, action: "discover", json };
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

async function runRepoBot(command: Extract<Command, { mode: "repobot" }>): Promise<void> {
  const prompt = command.prompt?.trim() || (stdin.isTTY ? await runRepoBotInteractivePrompt(command.rootDir) : await readStdin());
  if (!prompt) {
    process.stderr.write("missing prompt for repolog repobot\n");
    process.exit(1);
  }

  const result = await runCopilotQuery(command.rootDir, prompt);
  if (command.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatCopilotResponse(result)}\n`);
}

async function runRepoBotInteractivePrompt(rootDir: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const state = await scanRepo(rootDir);
  process.stdout.write(`RepoBot ready for ${state.name}. Type a question, or "exit" to quit.\n`);

  while (true) {
    const answer = await rl.question("RepoBot> ");
    const prompt = answer.trim();
    if (!prompt) {
      continue;
    }
    if (prompt === "exit" || prompt === "quit") {
      rl.close();
      process.exit(0);
    }
    rl.close();
    return prompt;
  }
}

async function readStdin(): Promise<string> {
  if (stdin.isTTY) {
    return "";
  }

  return await new Promise<string>((resolveInput) => {
    const chunks: Buffer[] = [];
    stdin.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stdin.on("end", () => resolveInput(Buffer.concat(chunks).toString("utf8").trim()));
    stdin.resume();
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
      "  repolog doctor [path] [--json]  Explain what was scanned and why state looks empty",
      "  repolog auth discover [path] [--json] Scan machine for LLM auth",
      "  repolog auth status [path] [--json]   Show saved provider and discovery status",
      "  repolog auth use <provider> [path] [--json] Save preferred provider to .repolog.json",
      "  repolog repobot [path] [--prompt=...] [--json]  Ask RepoBot a repo question",
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

function readPathArg(args: string[]): string | undefined {
  return args.find((arg) => !arg.startsWith("-") && arg !== "discover" && arg !== "status" && arg !== "use");
}

function readStandupSince(args: string[]): StandupSince {
  const value = args.find((arg) => arg.startsWith("--since="))?.slice("--since=".length) ?? "today";
  if (value === "today" || value === "yesterday" || value === "7d") {
    return value;
  }
  process.stderr.write(`invalid --since value: ${value}\n`);
  process.exit(1);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
