#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));
const opts = {
  launch: args.launch !== false,
  keepRepo: args["keep-repo"] === true,
  events: numberArg(args.events, 40),
  intervalMs: numberArg(args["interval-ms"], 120),
  sampleMs: numberArg(args["sample-ms"], 1000),
  maxSeconds: numberArg(args["max-seconds"], 45),
  maxPrivateMb: numberArg(args["max-private-mb"], 750),
  maxWorkingSetMb: numberArg(args["max-working-mb"], 750),
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "repolog-perf-soak-"));
  seedRepo(repo);

  let child = null;
  const samples = [];
  const started = Date.now();
  let stoppedByLimit = false;

  try {
    if (opts.launch) {
      const electronPath = require("electron");
      child = spawn(electronPath, ["apps/desktop/main.cjs", "--repo-root", repo], {
        cwd: root,
        stdio: "ignore",
        detached: process.platform !== "win32",
        windowsHide: true,
      });
      await sleep(2500);
    }

    const sampleTimer = setInterval(() => {
      const sample = sampleProcesses(child?.pid);
      samples.push({ atMs: Date.now() - started, processes: sample });
      const overLimit = sample.find((proc) =>
        bytesToMb(proc.privateBytes) > opts.maxPrivateMb ||
        bytesToMb(proc.workingSetBytes) > opts.maxWorkingSetMb
      );
      if (overLimit) {
        stoppedByLimit = true;
        clearInterval(sampleTimer);
        killTree(child?.pid);
      }
    }, opts.sampleMs);

    try {
      await churn(repo);
      await sleep(Math.min(5000, opts.sampleMs * 2));
    } finally {
      clearInterval(sampleTimer);
    }
  } finally {
    const finalSample = sampleProcesses(child?.pid);
    samples.push({ atMs: Date.now() - started, processes: finalSample });
    killTree(child?.pid);
    const report = buildReport(repo, samples, stoppedByLimit);
    const reportPath = opts.keepRepo
      ? path.join(repo, "perf-soak-report.json")
      : path.join(os.tmpdir(), `repolog-perf-soak-report-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    if (!opts.keepRepo) {
      fs.rmSync(repo, { recursive: true, force: true });
    }
    printReport(report, reportPath);
  }
}

async function churn(repo) {
  const deadline = Date.now() + opts.maxSeconds * 1000;
  const target = path.join(repo, "repolog-soak-probe.tmp");
  for (let i = 0; i < opts.events && Date.now() < deadline; i += 1) {
    fs.writeFileSync(target, `soak ${i} ${Date.now()}\n`);
    await sleep(opts.intervalMs);
    if (i % 5 === 4 && fs.existsSync(target)) {
      fs.unlinkSync(target);
      await sleep(opts.intervalMs);
    }
  }
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

function seedRepo(repo) {
  fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "repolog-perf-soak-fixture", version: "0.0.0" }, null, 2));
  fs.writeFileSync(path.join(repo, "PLAN.md"), "# Plan\n\n## Now\n- [ ] Verify RepoLog stays responsive during bounded file churn\n");
  fs.writeFileSync(path.join(repo, "STATE.md"), "# State\n\nResume: perf soak fixture\n");
  fs.writeFileSync(path.join(repo, "AGENTS.md"), "# Agent Guidance\n\nKeep changes surgical. Verify before handoff.\n");
}

function sampleProcesses(rootPid) {
  if (!rootPid || process.platform !== "win32") return [];
  const command = `
$rootPid = ${Number(rootPid)};
$ids = @($rootPid);
$desc = @();
while ($ids.Count -gt 0) {
  $children = Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ParentProcessId };
  $desc += $children;
  $ids = @($children | Select-Object -ExpandProperty ProcessId);
}
$pids = @($rootPid) + @($desc | Select-Object -ExpandProperty ProcessId);
Get-Process -Id $pids -ErrorAction SilentlyContinue |
  Select-Object Id,ProcessName,CPU,WorkingSet64,PrivateMemorySize64,Handles |
  ConvertTo-Json -Compress
`;
  try {
    const raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", command], { encoding: "utf8", windowsHide: true }).trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((proc) => ({
      pid: proc.Id,
      name: proc.ProcessName,
      cpu: Number(proc.CPU ?? 0),
      workingSetBytes: Number(proc.WorkingSet64 ?? 0),
      privateBytes: Number(proc.PrivateMemorySize64 ?? 0),
      handles: Number(proc.Handles ?? 0),
    }));
  } catch {
    return [];
  }
}

function killTree(rootPid) {
  if (!rootPid) return;
  if (process.platform !== "win32") {
    try { process.kill(-rootPid, "SIGTERM"); } catch {}
    try { process.kill(rootPid, "SIGTERM"); } catch {}
    return;
  }
  const command = `
$rootPid = ${Number(rootPid)};
$ids = @($rootPid);
$desc = @();
while ($ids.Count -gt 0) {
  $children = Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ParentProcessId };
  $desc += $children;
  $ids = @($children | Select-Object -ExpandProperty ProcessId);
}
$pids = @($desc | Select-Object -ExpandProperty ProcessId) + @($rootPid);
Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue
`;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", command], { stdio: "ignore", windowsHide: true });
  } catch {}
}

function buildReport(repo, samples, stoppedByLimit) {
  const flat = samples.flatMap((sample) => sample.processes);
  const peakPrivateMb = Math.max(0, ...flat.map((proc) => bytesToMb(proc.privateBytes)));
  const peakWorkingSetMb = Math.max(0, ...flat.map((proc) => bytesToMb(proc.workingSetBytes)));
  const peakProcessCount = Math.max(0, ...samples.map((sample) => sample.processes.length));
  return {
    repo,
    options: opts,
    stoppedByLimit,
    peakPrivateMb,
    peakWorkingSetMb,
    peakProcessCount,
    sampleCount: samples.length,
    samples,
  };
}

function printReport(report, reportPath) {
  console.log(`RepoLog perf soak report: ${reportPath}`);
  console.log(`Peak private: ${report.peakPrivateMb.toFixed(1)} MB`);
  console.log(`Peak working set: ${report.peakWorkingSetMb.toFixed(1)} MB`);
  console.log(`Peak process count: ${report.peakProcessCount}`);
  console.log(`Stopped by limit: ${report.stoppedByLimit ? "yes" : "no"}`);
  if (report.stoppedByLimit) process.exitCode = 2;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-launch") {
      parsed.launch = false;
      continue;
    }
    if (arg === "--keep-repo") {
      parsed["keep-repo"] = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return parsed;
}

function numberArg(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function bytesToMb(value) {
  return value / 1024 / 1024;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
