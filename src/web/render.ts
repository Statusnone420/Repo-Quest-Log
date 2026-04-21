import type { AgentProfile, BlockedTask, FileChange, QuestState, Task } from "../engine/types.js";

export interface SurfaceHtmlOptions {
  liveBridge?: "desktop" | "vscode";
}

export function renderDesktopHtml(state: QuestState, options: SurfaceHtmlOptions = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(state.name)} - Repo Quest Log</title>
  <style>
    :root {
      --bg: #0b0d10;
      --bg-grid: rgba(120,140,180,0.035);
      --ui-scale: 1.12;
      --surface-pad: 24px;
      --topbar-pad-y: 14px;
      --topbar-pad-x: 24px;
      --main-pad: 22px;
      --tile-pad: 22px;
      --tile-gap: 18px;
      --tile-inner-gap: 12px;
      --mission-size: 17px;
      --anchor-size: 18px;
      --body-size: 12.5px;
      --tile: rgba(18,22,28,0.78);
      --tile-border: rgba(100,120,150,0.12);
      --tile-border-hot: rgba(140,170,220,0.28);
      --ink: #e6ecf2;
      --muted: rgba(220,230,245,0.48);
      --dim: rgba(220,230,245,0.32);
      --faint: rgba(220,230,245,0.18);
      --accent: #8ab4ff;
      --accent-soft: rgba(138,180,255,0.14);
      --warn: #e9b973;
      --warn-soft: rgba(233,185,115,0.12);
      --ok: #8ad6a8;
      --mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      --sans: Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
    }

    html[data-density="compact"] {
      --surface-pad: 16px;
      --topbar-pad-y: 10px;
      --topbar-pad-x: 18px;
      --main-pad: 16px;
      --tile-pad: 16px;
      --tile-gap: 12px;
      --tile-inner-gap: 8px;
      --mission-size: 15px;
      --anchor-size: 16px;
      --body-size: 12px;
    }

    html[data-density="spacious"] {
      --surface-pad: 24px;
      --topbar-pad-y: 14px;
      --topbar-pad-x: 24px;
      --main-pad: 22px;
      --tile-pad: 22px;
      --tile-gap: 18px;
      --tile-inner-gap: 12px;
      --mission-size: 17px;
      --anchor-size: 18px;
      --body-size: 12.5px;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); }
    body {
      font-family: var(--sans);
      background:
        radial-gradient(circle at 20% 10%, rgba(138,180,255,0.06), transparent 40%),
        radial-gradient(circle at 80% 90%, rgba(217,119,87,0.04), transparent 40%),
        linear-gradient(var(--bg-grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px),
        var(--bg);
      background-size: auto, auto, 32px 32px, 32px 32px, auto;
      overflow-x: hidden;
      overflow-y: auto;
    }

    .shell { min-height: 100vh; display: flex; flex-direction: column; }
    .topbar {
      display: flex; align-items: center; gap: 18px; padding: var(--topbar-pad-y) var(--topbar-pad-x);
      border-bottom: 1px solid var(--tile-border);
      flex-shrink: 0;
      min-width: 0;
      flex-wrap: wrap;
    }
    .brand, .mono { font-family: var(--mono); }
    .brand {
      display: flex; align-items: center; gap: 10px;
      color: var(--muted); font-size: 12px; letter-spacing: 0.4px;
      text-transform: lowercase;
    }
    .divider { width: 1px; height: 16px; background: var(--tile-border); }
    .repo-meta { display: flex; align-items: baseline; gap: 10px; font-family: var(--mono); font-size: 13px; }
    .repo-meta .branch { color: var(--accent); }
    .watch-meta {
      margin-left: auto; display: flex; align-items: center; gap: 6px;
      font-family: var(--mono); font-size: 11px; color: var(--muted);
      min-width: 0;
    }
    .surface-controls {
      display: inline-flex; align-items: center; gap: 6px;
      margin-left: 10px; padding-left: 10px;
      border-left: 1px solid var(--tile-border);
      font-family: var(--mono); font-size: 10px;
    }
    .surface-controls button {
      appearance: none; border: 1px solid rgba(138,180,255,0.22);
      background: rgba(255,255,255,0.03); color: var(--ink);
      border-radius: 6px; padding: 4px 8px; cursor: pointer;
      font: inherit;
    }
    .surface-controls button:hover { border-color: rgba(138,180,255,0.42); }
    .surface-controls .label { color: var(--muted); letter-spacing: 0.8px; text-transform: uppercase; }
    .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--ok); display: inline-block; }

    main {
      flex: 1; min-height: 0; padding: var(--main-pad);
      display: grid; gap: var(--tile-gap);
      grid-template-areas:
        "mission mission mission"
        "resume resume agents"
        "now next agents"
        "blocked changes agents";
      grid-template-columns: 1.15fr 1.15fr 1fr;
      grid-template-rows: auto auto 1fr auto;
    }

    .mission-banner {
      grid-area: mission;
      display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 24px;
      padding: calc(var(--tile-pad) + 2px) calc(var(--tile-pad) + 4px);
      background: linear-gradient(90deg, var(--accent-soft), transparent 70%);
      border: 1px solid var(--tile-border);
      border-radius: 10px;
      min-width: 0;
    }

    .kicker {
      font-family: var(--mono); font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase;
      color: var(--muted); margin-bottom: 6px;
    }
    .mission-text { font-size: var(--mission-size); line-height: 1.35; font-weight: 500; text-wrap: pretty; }
    .quest-meta { text-align: right; }
    .quest-meta .title { font-size: 14px; font-weight: 500; }
    .quest-meta .detail { margin-top: 4px; font-family: var(--mono); font-size: 11px; color: var(--muted); }

    .anchor {
      grid-area: resume;
      background: linear-gradient(135deg, var(--warn-soft), transparent 80%);
      border: 1px solid rgba(233,185,115,0.28);
      border-radius: 10px;
      padding: var(--tile-pad);
      display: flex; flex-direction: column; gap: 10px;
      min-width: 0;
    }
    .anchor-top { display: flex; align-items: center; gap: 8px; }
    .anchor-top .label {
      font-family: var(--mono); font-size: 10px; letter-spacing: 1.4px;
      text-transform: uppercase; color: var(--warn);
    }
    .anchor-top .idle { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--dim); }
    .copy-context-btn {
      appearance: none; background: transparent; border: 1px solid rgba(233,185,115,0.28);
      color: var(--warn); border-radius: 4px; padding: 4px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .copy-context-btn:hover { background: rgba(233,185,115,0.1); color: #fff; }
    .anchor-task { font-size: var(--anchor-size); line-height: 1.3; font-weight: 500; text-wrap: pretty; }
    .anchor-thought {
      font-family: var(--mono); font-size: var(--body-size); color: var(--muted);
      font-style: italic; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere;
    }
    .anchor-meta { display: flex; gap: 16px; flex-wrap: wrap; font-family: var(--mono); font-size: 11px; color: var(--dim); }

    .tile {
      background: var(--tile);
      border: 1px solid var(--tile-border);
      border-radius: 10px;
      padding: var(--tile-pad);
      display: flex; flex-direction: column; gap: var(--tile-inner-gap);
      min-height: 0;
      min-width: 0;
      backdrop-filter: blur(8px);
      box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 40px -20px rgba(0,0,0,0.6);
    }
    .tile.hot { border-color: var(--tile-border-hot); }
    .tile-header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .tile-title {
      margin: 0; font-family: var(--mono); font-size: 11px; font-weight: 500;
      color: var(--muted); letter-spacing: 1.4px; text-transform: uppercase;
    }
    .tile-meta { font-family: var(--mono); font-size: 10px; color: var(--faint); }
    .tile-body { display: flex; flex-direction: column; gap: 10px; min-height: 0; min-width: 0; }
    .now { grid-area: now; }
    .next { grid-area: next; }
    .blocked { grid-area: blocked; }
    .changes { grid-area: changes; }
    .agents { grid-area: agents; }

    .task-row {
      display: grid; grid-template-columns: 16px 18px minmax(0, 1fr) auto;
      gap: 10px; align-items: start; padding: 6px 0;
      border-bottom: 1px solid var(--faint);
      line-height: 1.35;
    }
    .task-index { font-family: var(--mono); font-size: 10px; color: var(--dim); text-align: right; padding-top: 2px; }
    .task-text { white-space: pre-wrap; overflow-wrap: anywhere; text-wrap: pretty; }
    .task-doc { font-family: var(--mono); font-size: 10px; color: var(--dim); text-align: right; }

    .agent-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 4px;
      font-family: var(--mono); font-size: 10px; font-weight: 600;
      margin-top: 1px;
    }
    .badge-codex { background: rgba(118,186,143,0.18); color: #8fd0a9; }
    .badge-claude { background: rgba(217,119,87,0.18); color: #e6a888; }
    .badge-gemini { background: rgba(138,180,255,0.18); color: #a8c3f0; }
    .badge-default { background: rgba(180,190,210,0.10); color: var(--dim); }

    .blocked-item {
      padding: 8px 0;
      border-bottom: 1px solid var(--faint);
      display: flex; flex-direction: column; gap: 4px;
      min-width: 0;
    }
    .blocked-title { display: flex; gap: 8px; align-items: baseline; }
    .blocked-title .index { font-family: var(--mono); font-size: 10px; color: var(--dim); }
    .blocked-title .text { font-weight: 500; line-height: 1.3; text-wrap: pretty; }
    .blocked-reason {
      padding-left: 18px; font-family: var(--mono); font-size: 11px; color: var(--muted);
      white-space: pre-wrap; overflow-wrap: anywhere;
    }

    .agent-card {
      padding: var(--tile-inner-gap); background: rgba(255,255,255,0.02); border: 1px solid var(--faint);
      border-radius: 6px; display: flex; flex-direction: column; gap: 6px;
      min-width: 0;
    }
    .agent-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .agent-name { font-size: 14px; font-weight: 600; }
    .agent-role {
      font-family: var(--mono); font-size: 10px; color: var(--dim);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .agent-status {
      margin-left: auto; display: flex; align-items: center; gap: 6px;
      font-family: var(--mono); font-size: 10px; letter-spacing: 0.4px; text-transform: lowercase;
    }
    .agent-status.active { color: var(--accent); }
    .agent-status.working { color: var(--ok); }
    .agent-status.idle { color: var(--dim); }
    .agent-objective {
      font-size: var(--body-size); line-height: 1.35; color: rgba(230,236,242,0.78);
      white-space: pre-wrap; overflow-wrap: anywhere; text-wrap: pretty;
    }
    .agent-meta {
      display: flex; gap: 10px; flex-wrap: wrap; font-family: var(--mono);
      font-size: 10.5px; color: var(--muted);
    }

    .change-row {
      display: grid; grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 10px; align-items: center; padding: 4px 0;
    }
    .change-file { white-space: pre-wrap; overflow-wrap: anywhere; }
    .change-diff { color: var(--ok); font-family: var(--mono); font-size: 11px; }
    .change-age { color: var(--dim); font-family: var(--mono); font-size: 11px; min-width: 34px; text-align: right; }

    @media (max-width: 1200px) {
      body { overflow: auto; }
      main {
        grid-template-areas:
          "mission"
          "resume"
          "now"
          "next"
          "blocked"
          "changes"
          "agents";
        grid-template-columns: 1fr;
        grid-template-rows: auto;
      }
      .mission-banner { grid-template-columns: 1fr; }
      .quest-meta { text-align: left; }
      .watch-meta { margin-left: 0; width: 100%; }
      .surface-controls { margin-left: 0; padding-left: 0; border-left: 0; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="#8ab4ff" stroke-width="1.3"></rect>
          <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#8ab4ff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span>repo quest log</span>
      </div>
      <span class="divider"></span>
      <div class="repo-meta">
        <span>${escapeHtml(state.name)}</span>
        <span style="color: var(--dim)">/</span>
        <span class="branch">${escapeHtml(state.branch)}</span>
      </div>
      <div class="watch-meta">
        <span class="dot"></span>
        <span>watching ${state.scannedFiles.length} files</span>
        <span style="color: var(--dim)">· scanned ${escapeHtml(state.lastScan)}</span>
      </div>
      <div class="surface-controls" aria-label="Display controls">
        <span class="label">Scale</span>
        <button type="button" data-ui-action="smaller" aria-label="Smaller">A-</button>
        <span data-ui-scale-label>112%</span>
        <button type="button" data-ui-action="larger" aria-label="Larger">A+</button>
        <span class="label">Density</span>
        <button type="button" data-ui-density="spacious">Wide</button>
        <button type="button" data-ui-density="compact">Compact</button>
      </div>
    </header>
    <main>
      <section class="mission-banner">
        <div>
          <div class="kicker">Mission</div>
          <div class="mission-text">${escapeHtml(state.mission)}</div>
        </div>
        <div class="quest-meta">
          <div class="kicker">Active Quest</div>
          <div class="title">${escapeHtml(state.activeQuest.title)}</div>
          <div class="detail">${state.activeQuest.progress.done}/${state.activeQuest.progress.total} complete · ${escapeHtml(state.activeQuest.doc)}${state.activeQuest.line ? `:${state.activeQuest.line}` : ""}</div>
        </div>
      </section>

      <section class="anchor">
        <div class="anchor-top">
          <span class="label">Resume where you left off</span>
          <span class="idle">idle ${escapeHtml(state.resumeNote.since)}</span>
          <button class="copy-context-btn" data-copy-context="${escapeHtml(buildContextPrompt(state))}" aria-label="Copy context for agent" title="Copy context for agent">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
          </button>
        </div>
        <div class="anchor-task">${escapeHtml(state.resumeNote.task)}</div>
        <div class="anchor-thought">&ldquo;${escapeHtml(state.resumeNote.thought ?? "")}&rdquo;</div>
        <div class="anchor-meta">
          <span>↳ ${escapeHtml(state.resumeNote.lastTouched)}</span>
          <span>· ${escapeHtml(state.resumeNote.doc)}</span>
        </div>
      </section>

      ${renderTaskTile("now", "Now", `max 3 · ${state.now.length} active`, state.now, true, true)}
      ${renderTaskTile("next", "Next", `queue · ${state.next.length}`, state.next, false, false)}
      ${renderBlockedTile(state.blocked)}
      ${renderChangesTile(state.recentChanges)}
      ${renderAgentsTile(state.agents)}
    </main>
  </div>
  ${renderLiveBridge(options.liveBridge)}
  ${renderSettingsScript()}
</body>
</html>`;
}

export function renderVSCodeHtml(state: QuestState, options: SurfaceHtmlOptions = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(state.name)} - Repo Quest Log Panel</title>
  <style>
    :root {
      --bg: #1e1e1e;
      --panel: #252526;
      --chrome: #323233;
      --border: #1a1a1a;
      --ink: #cccccc;
      --muted: #858585;
      --dim: #6a6a6a;
      --accent: #4ec9b0;
      --blue: #569cd6;
      --yellow: #dcdcaa;
      --red: #f48771;
      --mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      --sans: "Segoe UI", Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); }
    body { font-family: var(--sans); overflow: hidden; }

    .panel {
      width: 100vw; min-height: 100vh; background: var(--bg);
      display: flex; flex-direction: column;
    }
    .header {
      height: 35px; background: var(--chrome); display: flex; align-items: center;
      padding: 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px;
      font-weight: 700; color: var(--ink); border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .header .branch {
      margin-left: auto; color: var(--muted); font-size: 11px; text-transform: none;
      letter-spacing: 0; font-weight: 400; font-family: var(--mono);
    }

    .resume {
      padding: 10px 12px; border-bottom: 1px solid var(--border);
      background: rgba(220,220,170,0.06);
      flex-shrink: 0;
    }
    .resume-label {
      font-size: 10px; color: var(--yellow); font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; margin-bottom: 4px;
    }
    .resume-task { font-size: 13px; color: var(--ink); margin-bottom: 3px; line-height: 1.35; text-wrap: pretty; }
    .resume-thought {
      font-size: 11px; color: var(--muted); font-style: italic; line-height: 1.4;
      white-space: pre-wrap; overflow-wrap: anywhere;
    }

    .scroll { flex: 1; overflow-y: auto; min-height: 0; }
    .section { border-bottom: 1px solid var(--border); }
    .section-head {
      display: flex; align-items: center; gap: 4px; padding: 4px 8px;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700;
      color: var(--ink); background: var(--chrome);
    }
    .chevron { font-size: 9px; color: var(--muted); width: 10px; }
    .badge {
      margin-left: 6px; background: #3f3f41; color: #fff; font-size: 10px;
      padding: 0 6px; border-radius: 8px; font-weight: 600; letter-spacing: 0;
      font-family: var(--mono);
    }
    .section-body { padding: 4px 0; }
    .row {
      padding: 2px 24px; display: flex; align-items: flex-start; gap: 6px;
      font-size: 13px; color: var(--ink); line-height: 1.5;
    }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: rgba(255,255,255,0.04); }
    .row-icon { width: 12px; color: var(--muted); font-size: 11px; flex-shrink: 0; padding-top: 3px; }
    .row-text { min-width: 0; flex: 1; white-space: pre-wrap; overflow-wrap: anywhere; text-wrap: pretty; }
    .row-sub {
      color: var(--dim); font-size: 11px; margin-left: auto; font-family: var(--mono);
      flex-shrink: 0; align-self: center;
    }
    .agent {
      padding: 4px 24px; font-size: 13px; line-height: 1.4;
    }
    .agent-head { display: flex; align-items: center; gap: 6px; }
    .agent-name { color: var(--yellow); font-weight: 600; }
    .agent-file { color: var(--dim); font-size: 11px; font-family: var(--mono); }
    .agent-objective {
      color: var(--muted); font-size: 12px; margin-left: 14px; line-height: 1.4;
      white-space: pre-wrap; overflow-wrap: anywhere; text-wrap: pretty;
    }
    .status-bar {
      height: 22px; background: #007acc; color: #fff; display: flex; align-items: center;
      padding: 0 8px; font-size: 12px; gap: 12px; flex-shrink: 0;
      font-family: var(--mono);
    }
    .status-bar .tail { margin-left: auto; opacity: 0.85; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  </style>
</head>
<body>
  <div class="panel">
    <div class="header">
      <span>Repo Quest Log</span>
      <span class="branch">${escapeHtml(state.branch)}</span>
    </div>

    <div class="resume">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
        <div class="resume-label" style="margin-bottom:0;">Resume</div>
        <button class="copy-context-btn" data-copy-context="${escapeHtml(buildContextPrompt(state))}" aria-label="Copy context for agent" title="Copy context for agent" style="background:transparent; border:none; color:var(--muted); cursor:pointer; padding:0; display:flex; align-items:center;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
        </button>
      </div>
      <div class="resume-task">${escapeHtml(state.resumeNote.task)}</div>
      <div class="resume-thought">&ldquo;${escapeHtml(state.resumeNote.thought ?? "")}&rdquo;</div>
    </div>

    <div class="scroll">
      ${renderVSCodeSection("Now", state.now.length, "#0e639c", state.now.map((task) => renderVSCodeTaskRow(task, "◆", "#4ec9b0")))}
      ${renderVSCodeSection("Next", state.next.length, undefined, state.next.map((task) => renderVSCodeTaskRow(task, "○")))}
      ${renderVSCodeSection("Blocked", state.blocked.length, "#a1260d", state.blocked.map((task) => renderVSCodeBlockedRow(task)))}
      ${renderVSCodeSection("Agents", state.agents.length, undefined, state.agents.map((agent) => renderVSCodeAgent(agent)))}
      ${renderVSCodeSection("Recent changes", state.recentChanges.length, undefined, state.recentChanges.map((change) => renderVSCodeChangeRow(change)))}
    </div>

    <div class="status-bar">
      <span>⎇ ${escapeHtml(state.branch)}</span>
      <span>◉ watching ${state.scannedFiles.length}</span>
      <span class="tail">Quest Log · ${escapeHtml(state.lastScan)}</span>
    </div>
  </div>
  ${renderLiveBridge(options.liveBridge)}
</body>
</html>`;
}

function renderTaskTile(area: string, title: string, meta: string, tasks: Task[], showDoc: boolean, hot: boolean): string {
  return `<section class="tile ${area} ${hot ? "hot" : ""}">
    <div class="tile-header">
      <h3 class="tile-title">${escapeHtml(title)}</h3>
      <span class="tile-meta">${escapeHtml(meta)}</span>
    </div>
    <div class="tile-body">
      ${tasks.length === 0 ? `<div class="task-row"><span class="task-index">·</span>${renderAgentBadge(undefined)}<span class="task-text">No items yet</span><span class="task-doc"></span></div>` : tasks.map((task, index) => `
        <div class="task-row">
          <span class="task-index">${String(index + 1).padStart(2, "0")}</span>
          ${renderAgentBadge(task.agent)}
          <span class="task-text">${escapeHtml(task.text)}</span>
          <span class="task-doc">${showDoc ? escapeHtml(task.doc) : ""}</span>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function renderBlockedTile(tasks: BlockedTask[]): string {
  return `<section class="tile blocked">
    <div class="tile-header">
      <h3 class="tile-title">Blocked</h3>
      <span class="tile-meta">${tasks.length} waiting</span>
    </div>
    <div class="tile-body">
      ${tasks.length === 0 ? `<div class="blocked-item"><div class="blocked-title"><span class="index">·</span><span class="text">No blockers right now</span></div></div>` : tasks.map((task, index) => `
        <div class="blocked-item">
          <div class="blocked-title">
            <span class="index">${String(index + 1).padStart(2, "0")}</span>
            <span class="text">${escapeHtml(task.text)}</span>
          </div>
          <div class="blocked-reason">↳ ${escapeHtml(task.reason)} · ${escapeHtml(task.since)}</div>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function renderAgentsTile(agents: AgentProfile[]): string {
  return `<section class="tile agents">
    <div class="tile-header">
      <h3 class="tile-title">Agents</h3>
      <span class="tile-meta">${agents.length} registered</span>
    </div>
    <div class="tile-body">
      ${agents.length === 0 ? `<div class="agent-card"><div class="agent-objective">No agent profiles discovered.</div></div>` : agents.map((agent) => `
        <div class="agent-card">
          <div class="agent-head">
            ${renderAgentBadge(agent.id)}
            <span class="agent-name">${escapeHtml(agent.name)}</span>
            <span class="agent-role">· ${escapeHtml(agent.role)}</span>
            <span class="agent-status ${escapeHtml(agent.status)}"><span class="dot"></span>${escapeHtml(agent.status)}</span>
          </div>
          <div class="agent-objective">${escapeHtml(agent.objective)}</div>
          <div class="agent-meta">
            <span>↳ ${escapeHtml(agent.file)}</span>
            <span>· area: ${escapeHtml(agent.area)}</span>
          </div>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function renderChangesTile(changes: FileChange[]): string {
  return `<section class="tile changes">
    <div class="tile-header">
      <h3 class="tile-title">Recent changes</h3>
      <span class="tile-meta">file watcher</span>
    </div>
    <div class="tile-body">
      ${changes.length === 0 ? `<div class="change-row"><span class="change-file">No recent changes yet</span><span class="change-diff"></span><span class="change-age"></span></div>` : changes.map((change) => `
        <div class="change-row">
          <span class="change-file">${escapeHtml(change.file)}</span>
          <span class="change-diff">${escapeHtml(change.diff ?? "")}</span>
          <span class="change-age">${escapeHtml(change.at)}</span>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function renderVSCodeSection(title: string, count: number, accent: string | undefined, rows: string[]): string {
  return `<section class="section">
    <div class="section-head">
      <span class="chevron">▶</span>
      <span>${escapeHtml(title)}</span>
      <span class="badge"${accent ? ` style="background:${accent}"` : ""}>${count}</span>
    </div>
    <div class="section-body">
      ${rows.length === 0 ? `<div class="row"><span class="row-icon">·</span><span class="row-text">No items yet</span></div>` : rows.join("")}
    </div>
  </section>`;
}

function renderVSCodeTaskRow(task: Task, icon: string, color = "#858585"): string {
  const agent = task.agent ? `[${task.agent[0]?.toUpperCase() ?? "·"}]` : "";
  const clickAttr = task.doc ? ` data-open-doc="${escapeHtml(task.doc)}" data-line="${task.line || 1}" class="row clickable-row"` : ` class="row"`;
  return `<div${clickAttr}>
    <span class="row-icon" style="color:${color}">${escapeHtml(icon)}</span>
    <span class="row-text">${escapeHtml(task.text)}</span>
    <span class="row-sub">${escapeHtml(agent)}</span>
  </div>`;
}

function renderVSCodeBlockedRow(task: BlockedTask): string {
  return `<div class="row">
    <span class="row-icon" style="color:#f48771">✕</span>
    <span class="row-text">${escapeHtml(task.text)}</span>
    <span class="row-sub">${escapeHtml(task.since)}</span>
  </div>`;
}

function renderVSCodeAgent(agent: AgentProfile): string {
  const statusColor = agent.status === "working" ? "#4ec9b0" : agent.status === "active" ? "#569cd6" : "#6a6a6a";
  return `<div class="agent">
    <div class="agent-head">
      <span style="color:${statusColor}">●</span>
      <span class="agent-name">${escapeHtml(agent.name)}</span>
      <span class="agent-file">${escapeHtml(agent.file)}</span>
    </div>
    <div class="agent-objective">${escapeHtml(agent.objective)}</div>
  </div>`;
}

function renderVSCodeChangeRow(change: FileChange): string {
  return `<div class="row">
    <span class="row-icon" style="color:#dcdcaa">M</span>
    <span class="row-text">${escapeHtml(change.file)}</span>
    <span class="row-sub">${escapeHtml(change.at)}</span>
  </div>`;
}

function renderLiveBridge(mode: SurfaceHtmlOptions["liveBridge"]): string {
  if (!mode) {
    return "";
  }

  const desktopHook = mode === "desktop"
    ? `
      if (window.repologDesktop && typeof window.repologDesktop.onHtml === "function") {
        window.repologDesktop.onHtml(replaceHtml);
      }
    `
    : "";

  const vscodeHook = mode === "vscode"
    ? `
      var vscode = acquireVsCodeApi();
      document.addEventListener("click", function(event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var row = target.closest("[data-open-doc]");
        if (row) {
          var doc = row.getAttribute("data-open-doc");
          var line = parseInt(row.getAttribute("data-line") || "1", 10);
          vscode.postMessage({ type: "openDoc", doc: doc, line: line });
        }
      });
    `
    : "";

  return `<script>
    (function () {
      function replaceHtml(html) {
        if (typeof html !== "string" || html.length === 0) {
          return;
        }
        document.open();
        document.write(html);
        document.close();
      }

      ${desktopHook}
      ${vscodeHook}

      window.addEventListener("message", function (event) {
        var data = event && event.data;
        if (!data || data.type !== "repolog:replaceHtml") {
          return;
        }
        replaceHtml(data.html);
      });
    })();
  </script>`;
}

function renderSettingsScript(): string {
  return `<script>
    (function () {
      var KEY = "repolog-surface-settings";
      var defaults = { scale: 1.12, density: "spacious" };

      function read() {
        try {
          var parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
          return {
            scale: typeof parsed.scale === "number" ? parsed.scale : defaults.scale,
            density: parsed.density === "compact" ? "compact" : "spacious",
          };
        } catch (_) {
          return defaults;
        }
      }

      function save(next) {
        localStorage.setItem(KEY, JSON.stringify(next));
      }

      function apply() {
        var prefs = read();
        document.documentElement.dataset.density = prefs.density;
        document.body.style.zoom = String(prefs.scale);
        var scaleLabel = document.querySelector("[data-ui-scale-label]");
        if (scaleLabel) {
          scaleLabel.textContent = Math.round(prefs.scale * 100) + "%";
        }
      }

      function update(patch) {
        var current = read();
        var next = {
          scale: typeof patch.scale === "number" ? Math.min(1.4, Math.max(0.85, patch.scale)) : current.scale,
          density: patch.density || current.density,
        };
        save(next);
        apply();
      }

      document.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) {
          return;
        }
        var button = target.closest("[data-ui-action], [data-ui-density]");
        if (!button) {
          return;
        }
        if (button.hasAttribute("data-ui-action")) {
          var action = button.getAttribute("data-ui-action");
          var prefs = read();
          if (action === "smaller") {
            update({ scale: prefs.scale - 0.08 });
          }
          if (action === "larger") {
            update({ scale: prefs.scale + 0.08 });
          }
        }
        if (button.hasAttribute("data-ui-density")) {
          update({ density: button.getAttribute("data-ui-density") || "spacious" });
        }
        
        var copyBtn = target.closest("[data-copy-context]");
        if (copyBtn) {
          var text = copyBtn.getAttribute("data-copy-context");
          if (text) {
             navigator.clipboard.writeText(text).then(function() {
               var originalHtml = copyBtn.innerHTML;
               copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok, #4ec9b0)" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
               setTimeout(function() { copyBtn.innerHTML = originalHtml; }, 2000);
             });
          }
        }
      });

      document.addEventListener("keydown", function (event) {
        var prefs = read();
        if ((event.metaKey || event.ctrlKey) && (event.key === "+" || event.key === "=")) {
          event.preventDefault();
          update({ scale: prefs.scale + 0.08 });
        }
        if ((event.metaKey || event.ctrlKey) && event.key === "-") {
          event.preventDefault();
          update({ scale: prefs.scale - 0.08 });
        }
      });

      apply();
    })();
  </script>`;
}

function renderAgentBadge(agent: string | undefined): string {
  const key = agent ?? "default";
  const defaultEntry = { label: "·", className: "badge-default" };
  const map: Record<string, { label: string; className: string }> = {
    claude: { label: "C", className: "badge-claude" },
    codex: { label: "X", className: "badge-codex" },
    gemini: { label: "G", className: "badge-gemini" },
    default: defaultEntry,
  };
  const entry = map[key] ?? defaultEntry;
  return `<span class="agent-badge ${entry.className}">${entry.label}</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildContextPrompt(state: QuestState): string {
  return `I am resuming work. The active quest is "${state.activeQuest.title}". My current task is "${state.resumeNote.task}" in ${state.resumeNote.doc}. The last touched file was ${state.resumeNote.lastTouched}. Please read the last touched file and let's begin.`;
}
