import type { AgentProfile, BlockedTask, FileChange, QuestState, Task } from "../engine/types.js";

export interface SurfaceHtmlOptions {
  liveBridge?: "desktop" | "vscode";
}

export function renderDesktopHtml(state: QuestState, options: SurfaceHtmlOptions = {}): string {
  const presets = buildPromptPresets(state);
  const stateJson = JSON.stringify({
    name: state.name,
    branch: state.branch,
    mission: state.mission,
    objective: state.activeQuest,
    resume: state.resumeNote,
    nowCount: state.now.length,
    nextCount: state.next.length,
    blockedCount: state.blocked.length,
    agentCount: state.agents.length,
    filesCount: state.scannedFiles.length,
  });

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
      --rql-density: 0.92;
      --pad-x: calc(14px * var(--rql-density));
      --pad-y: calc(10px * var(--rql-density));
      --tile-pad: calc(12px * var(--rql-density));
      --tile-gap: calc(10px * var(--rql-density));
      --row-gap: calc(5px * var(--rql-density));
      --body-size: calc(12px * var(--rql-density));
      --small-size: calc(10.5px * var(--rql-density));
      --tiny-size: calc(9px * var(--rql-density));
      --title-size: calc(13px * var(--rql-density));
      --headline-size: calc(14px * var(--rql-density));
      --tile: rgba(18,22,28,0.78);
      --tile-border: rgba(100,120,150,0.14);
      --tile-border-hot: rgba(140,170,220,0.32);
      --ink: #e6ecf2;
      --muted: rgba(220,230,245,0.52);
      --dim: rgba(220,230,245,0.34);
      --faint: rgba(220,230,245,0.14);
      --accent: #8ab4ff;
      --accent-soft: rgba(138,180,255,0.14);
      --warn: #e9b973;
      --warn-soft: rgba(233,185,115,0.12);
      --ok: #8ad6a8;
      --danger: #f48471;
      --mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      --sans: Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; background: var(--bg); color: var(--ink); overflow: hidden; }
    body {
      font-family: var(--sans);
      font-size: var(--body-size);
      line-height: 1.35;
      background:
        radial-gradient(circle at 20% 0%, rgba(138,180,255,0.06), transparent 45%),
        radial-gradient(circle at 80% 100%, rgba(217,119,87,0.04), transparent 45%),
        linear-gradient(var(--bg-grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px),
        var(--bg);
      background-size: auto, auto, 32px 32px, 32px 32px, auto;
    }

    .shell {
      width: 100vw; height: 100vh;
      display: grid;
      grid-template-rows: auto auto auto minmax(0, 1fr);
      overflow: hidden;
    }

    /* ---- TOP BAR ---- */
    .topbar {
      display: flex; align-items: center; gap: 14px;
      padding: var(--pad-y) var(--pad-x);
      border-bottom: 1px solid var(--tile-border);
      min-width: 0;
    }
    .brand {
      display: flex; align-items: center; gap: 8px;
      font-family: var(--mono); color: var(--muted);
      font-size: var(--small-size); letter-spacing: 0.4px; text-transform: lowercase;
    }
    .divider { width: 1px; height: 14px; background: var(--tile-border); }
    .repo-meta { display: flex; align-items: baseline; gap: 8px; font-family: var(--mono); font-size: var(--body-size); }
    .repo-meta .branch { color: var(--accent); }
    .kbd-hint {
      margin-left: auto;
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--mono); font-size: var(--tiny-size);
      color: var(--muted); cursor: pointer;
      padding: 3px 8px; border: 1px solid var(--tile-border); border-radius: 6px;
      background: rgba(255,255,255,0.02);
    }
    .kbd-hint:hover { border-color: rgba(138,180,255,0.42); color: var(--accent); }
    .kbd-hint kbd {
      font-family: var(--mono); font-size: var(--tiny-size);
      padding: 1px 5px; border: 1px solid var(--tile-border); border-radius: 3px;
      background: rgba(255,255,255,0.04); color: var(--ink);
    }
    .watch-meta {
      display: flex; align-items: center; gap: 6px;
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--muted);
    }
    .surface-controls {
      display: inline-flex; align-items: center; gap: 4px;
      font-family: var(--mono); font-size: var(--tiny-size);
    }
    .surface-controls button {
      appearance: none; border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02); color: var(--ink);
      border-radius: 5px; padding: 2px 7px; cursor: pointer;
      font: inherit;
    }
    .surface-controls button:hover { border-color: rgba(138,180,255,0.42); }
    .surface-controls button[aria-pressed="true"] {
      background: rgba(138,180,255,0.16);
      border-color: rgba(138,180,255,0.42);
      color: var(--accent);
    }
    .surface-controls .label { color: var(--muted); letter-spacing: 0.8px; text-transform: uppercase; margin-left: 4px; }
    .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--ok); display: inline-block; }

    /* ---- HEADER STRIP (mission + objective + resume in ONE row) ---- */
    .header-strip {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.6fr);
      gap: var(--tile-gap);
      padding: var(--pad-y) var(--pad-x) 0;
      min-width: 0;
    }
    .strip-cell {
      position: relative;
      padding: var(--tile-pad);
      background: var(--tile);
      border: 1px solid var(--tile-border);
      border-radius: 10px;
      min-width: 0;
      display: flex; flex-direction: column; gap: 4px;
      overflow: hidden;
    }
    .strip-cell.mission::before,
    .strip-cell.objective::before,
    .strip-cell.resume::before {
      content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    }
    .strip-cell.mission::before { background: var(--accent); }
    .strip-cell.objective::before { background: var(--ok); }
    .strip-cell.resume::before { background: var(--warn); }
    .kicker {
      font-family: var(--mono); font-size: var(--tiny-size); letter-spacing: 1.2px;
      text-transform: uppercase; color: var(--muted);
      display: flex; align-items: center; gap: 8px;
    }
    .kicker .meta { color: var(--dim); letter-spacing: 0.6px; }
    .strip-headline {
      font-size: var(--headline-size); font-weight: 500; line-height: 1.3;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .strip-subline {
      font-family: var(--mono); font-size: var(--small-size); color: var(--muted);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .strip-actions {
      position: absolute; top: 8px; right: 10px;
      display: flex; gap: 6px;
    }
    .icon-btn {
      appearance: none; background: transparent; border: 1px solid var(--tile-border);
      color: var(--muted); border-radius: 5px; padding: 3px 5px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px;
      font-family: var(--mono); font-size: var(--tiny-size);
    }
    .icon-btn:hover { color: var(--accent); border-color: rgba(138,180,255,0.42); }
    .icon-btn.warn:hover { color: var(--warn); border-color: rgba(233,185,115,0.4); }

    /* Resume tile collapses to a single 28px strip when activity is fresh (<2min idle).
       Grid area keeps min-height so neighbors don't reflow. */
    .strip-cell.resume { min-height: 92px; }
    .strip-cell.resume.fresh {
      min-height: 28px;
      padding: 0 12px;
      flex-direction: row; align-items: center; gap: 10px;
      background: rgba(233,185,115,0.03);
      border-color: rgba(233,185,115,0.18);
    }
    .strip-cell.resume.fresh .strip-headline,
    .strip-cell.resume.fresh .strip-subline,
    .strip-cell.resume.fresh .strip-actions { display: none; }
    .strip-cell.resume.fresh .kicker {
      color: var(--muted); opacity: 0.72;
      font-size: var(--tiny-size); letter-spacing: 1px;
      display: inline-flex; gap: 6px; align-items: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .strip-cell.resume.fresh .kicker .pulse {
      width: 6px; height: 6px; border-radius: 999px; background: var(--ok);
      display: inline-block;
    }

    /* ---- COCKPIT STAT BAR ---- */
    .cockpit {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
      padding: var(--pad-y) var(--pad-x);
      font-family: var(--mono); font-size: var(--small-size);
      color: var(--muted);
      border-bottom: 1px solid var(--tile-border);
      border-top: 1px solid var(--tile-border);
      margin-top: var(--pad-y);
    }
    .stat { display: inline-flex; align-items: center; gap: 6px; }
    .stat .num { color: var(--ink); font-weight: 600; font-size: var(--body-size); }
    .stat .pip { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
    .pip-now { background: var(--accent); }
    .pip-next { background: var(--dim); border: 1px solid var(--muted); background: transparent; }
    .pip-blocked { background: var(--warn); }
    .pip-agents { background: var(--ok); }
    .pip-files { background: var(--muted); }
    .cockpit .spacer { flex: 1; }
    .cockpit .tail { color: var(--dim); }

    /* ---- BOARD (3 cols, single row, fits viewport) ---- */
    .board {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      gap: var(--tile-gap);
      padding: var(--tile-gap) var(--pad-x) var(--pad-x);
      min-height: 0;
      overflow: hidden;
    }
    .col {
      display: flex; flex-direction: column; gap: var(--tile-gap);
      min-height: 0; min-width: 0;
    }

    .tile {
      background: var(--tile);
      border: 1px solid var(--tile-border);
      border-radius: 10px;
      padding: var(--tile-pad);
      display: flex; flex-direction: column; gap: 8px;
      min-height: 0; min-width: 0;
      backdrop-filter: blur(8px);
      box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 40px -20px rgba(0,0,0,0.6);
      flex: 1 1 0;
    }
    .tile.tight { flex: 0 1 auto; }
    .tile.hot { border-color: var(--tile-border-hot); }

    .tile-header {
      display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
      flex-shrink: 0;
    }
    .tile-title {
      margin: 0; font-family: var(--mono); font-size: var(--tiny-size); font-weight: 600;
      color: var(--ink); letter-spacing: 1.4px; text-transform: uppercase;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .tile-title .accent-bar {
      display: inline-block; width: 10px; height: 2px; border-radius: 1px;
    }
    .tile-title.now .accent-bar { background: var(--accent); }
    .tile-title.next .accent-bar { background: var(--muted); }
    .tile-title.blocked .accent-bar { background: var(--warn); }
    .tile-title.agents .accent-bar { background: var(--ok); }
    .tile-title.changes .accent-bar { background: var(--dim); }
    .tile-meta { font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim); }
    .tile-body {
      display: flex; flex-direction: column; gap: var(--row-gap);
      min-height: 0; min-width: 0;
      overflow-y: auto; overflow-x: hidden;
      scrollbar-gutter: stable;
    }
    .tile-body::-webkit-scrollbar { width: 6px; }
    .tile-body::-webkit-scrollbar-thumb { background: var(--faint); border-radius: 3px; }
    .tile-body::-webkit-scrollbar-thumb:hover { background: var(--dim); }

    /* ---- TASK ROWS (cockpit-style, not Word-doc) ---- */
    .item {
      display: grid;
      grid-template-columns: 3px 20px minmax(0, 1fr) auto;
      gap: 8px; align-items: center;
      padding: 4px 0 4px 6px;
      border-radius: 4px;
      min-width: 0;
      cursor: default;
    }
    .item { position: relative; outline: none; }
    .item.clickable { cursor: pointer; }
    .item.clickable:hover,
    .item.clickable:focus-visible {
      background: rgba(255,255,255,0.03);
    }
    .item.clickable:focus-visible {
      box-shadow: inset 2px 0 0 var(--accent);
      outline-offset: -1px;
    }
    .item.clickable:hover::after,
    .item.clickable:focus-visible::after {
      content: "→";
      position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
      color: var(--dim); font-family: var(--mono); font-size: var(--tiny-size);
      pointer-events: none;
    }
    .item .bar { width: 3px; align-self: stretch; border-radius: 2px; }
    .item.p-now .bar { background: var(--accent); }
    .item.p-next .bar { background: var(--muted); opacity: 0.5; }
    .item.p-blocked .bar { background: var(--warn); }
    .item.p-change .bar { background: var(--dim); opacity: 0.4; }
    .item-num {
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim);
      text-align: right;
    }
    .item-text {
      min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: var(--body-size);
    }
    .item-text.wrap { white-space: normal; overflow: visible; text-overflow: clip; }
    .item-aside {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim);
    }
    .chip {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 1px 6px; border-radius: 999px;
      font-family: var(--mono); font-size: var(--tiny-size);
      border: 1px solid var(--faint); background: rgba(255,255,255,0.02);
    }
    .chip.agent-codex { background: rgba(118,186,143,0.12); color: #8fd0a9; border-color: rgba(118,186,143,0.3); }
    .chip.agent-claude { background: rgba(217,119,87,0.12); color: #e6a888; border-color: rgba(217,119,87,0.3); }
    .chip.agent-gemini { background: rgba(138,180,255,0.12); color: #a8c3f0; border-color: rgba(138,180,255,0.3); }
    .chip.doc { color: var(--dim); border-color: transparent; background: transparent; padding: 0; }

    .blocked-reason {
      padding-left: 32px; font-family: var(--mono); font-size: var(--tiny-size); color: var(--muted);
      margin-top: -2px; margin-bottom: 4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ---- AGENT CARDS ---- */
    .agent-card {
      padding: 8px; background: rgba(255,255,255,0.02);
      border: 1px solid var(--faint); border-radius: 6px;
      display: flex; flex-direction: column; gap: 4px;
      min-width: 0;
    }
    .agent-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .agent-name { font-size: var(--body-size); font-weight: 600; }
    .agent-role {
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
    }
    .agent-status {
      margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
      font-family: var(--mono); font-size: var(--tiny-size); letter-spacing: 0.4px;
    }
    .agent-status.active { color: var(--accent); }
    .agent-status.working { color: var(--ok); }
    .agent-status.idle { color: var(--dim); }
    .agent-objective {
      font-size: var(--small-size); line-height: 1.35; color: var(--muted);
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .agent-meta {
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ---- CHANGE ROWS ---- */
    .change-row {
      display: grid; grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px; align-items: center; padding: 3px 0;
      font-size: var(--small-size);
    }
    .change-file {
      font-family: var(--mono);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .change-diff {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--ok); font-family: var(--mono); font-size: var(--tiny-size);
    }
    .change-spark { display: inline-flex; align-items: flex-end; gap: 1px; height: 8px; min-width: 10px; }
    .spark-add, .spark-del { display: inline-block; width: 2px; border-radius: 1px 1px 0 0; opacity: 0.85; }
    .spark-add { background: rgba(138,214,168,0.95); }
    .spark-del { background: rgba(248,132,113,0.92); }
    .change-age { color: var(--dim); font-family: var(--mono); font-size: var(--tiny-size); min-width: 34px; text-align: right; }

    /* ---- PALETTE OVERLAY (Ctrl+K) ---- */
    .palette-overlay {
      position: fixed; inset: 0;
      background: rgba(5,7,10,0.64);
      backdrop-filter: blur(4px);
      display: none;
      align-items: flex-start; justify-content: center;
      padding-top: 12vh;
      z-index: 100;
    }
    .palette-overlay[data-open="true"] { display: flex; }
    .palette {
      width: min(560px, 92vw);
      background: #11141a;
      border: 1px solid var(--tile-border-hot);
      border-radius: 12px;
      box-shadow: 0 30px 80px -10px rgba(0,0,0,0.7);
      overflow: hidden;
      display: flex; flex-direction: column;
      max-height: 70vh;
    }
    .palette-input {
      appearance: none; border: 0; outline: 0;
      background: transparent; color: var(--ink);
      font-family: var(--sans); font-size: 15px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--tile-border);
    }
    .palette-input::placeholder { color: var(--dim); }
    .palette-list { overflow-y: auto; padding: 6px; }
    .palette-item {
      display: grid; grid-template-columns: 24px 1fr auto;
      gap: 12px; align-items: center;
      padding: 10px 12px; border-radius: 6px;
      cursor: pointer; user-select: none;
    }
    .palette-item[aria-selected="true"] { background: var(--accent-soft); }
    .palette-item:hover { background: rgba(255,255,255,0.04); }
    .palette-item .glyph {
      font-family: var(--mono); font-size: 14px; color: var(--accent);
      text-align: center;
    }
    .palette-item .label { font-size: 13px; color: var(--ink); line-height: 1.3; }
    .palette-item .sub { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-top: 2px; }
    .palette-item .hint {
      font-family: var(--mono); font-size: 10px; color: var(--dim);
      opacity: 0; transition: opacity 0.1s;
    }
    .palette-item[aria-selected="true"] .hint { opacity: 1; }
    .palette-footer {
      display: flex; gap: 16px; justify-content: flex-end;
      padding: 8px 14px; border-top: 1px solid var(--tile-border);
      font-family: var(--mono); font-size: 10px; color: var(--dim);
    }
    .palette-footer kbd {
      padding: 1px 5px; border: 1px solid var(--tile-border); border-radius: 3px;
      background: rgba(255,255,255,0.04); color: var(--muted); margin-right: 4px;
    }

    /* ---- TOAST ---- */
    .toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #11141a; border: 1px solid var(--ok);
      color: var(--ok); font-family: var(--mono); font-size: 12px;
      padding: 10px 16px; border-radius: 8px;
      box-shadow: 0 10px 30px -5px rgba(0,0,0,0.6);
      opacity: 0; pointer-events: none;
      transition: opacity 0.18s, transform 0.18s;
      z-index: 200;
    }
    .toast[data-visible="true"] { opacity: 1; transform: translateX(-50%) translateY(-4px); }

    /* ---- RESPONSIVE: narrow screens collapse to stacked ---- */
    @media (max-width: 1099px) {
      .header-strip { grid-template-columns: 1fr; }
      .board {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
      }
    }
    @media (max-width: 820px) {
      .topbar { flex-wrap: wrap; }
      .kbd-hint { margin-left: 0; }
    }
    @media (max-height: 600px) {
      .cockpit { display: none; }
      .header-strip { padding-top: calc(var(--pad-y) * 0.6); }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
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
      <button type="button" class="kbd-hint" data-palette-open title="Resume-prompt palette">
        <kbd>Ctrl</kbd><kbd>K</kbd><span>resume prompt</span>
      </button>
      <div class="watch-meta">
        <span class="dot"></span>
        <span>${state.scannedFiles.length} files</span>
        <span style="color: var(--dim)">· ${escapeHtml(state.lastScan)}</span>
      </div>
      <div class="surface-controls" aria-label="Display controls">
        <span class="label">Scale</span>
        <button type="button" data-ui-action="smaller" aria-label="Smaller">A-</button>
        <span data-ui-scale-label>100%</span>
        <button type="button" data-ui-action="larger" aria-label="Larger">A+</button>
        <span class="label">Density</span>
        <button type="button" data-ui-density="wide">Wide</button>
        <button type="button" data-ui-density="compact">Compact</button>
      </div>
    </header>

    <section class="header-strip">
      <div class="strip-cell mission">
        <div class="kicker">Mission</div>
        <div class="strip-headline">${escapeHtml(state.mission)}</div>
      </div>
      <div class="strip-cell objective">
        <div class="kicker">Objective <span class="meta">${state.activeQuest.progress.done}/${state.activeQuest.progress.total}</span></div>
        <div class="strip-headline">${escapeHtml(state.activeQuest.title)}</div>
        <div class="strip-subline">${escapeHtml(state.activeQuest.doc)}${state.activeQuest.line ? `:${state.activeQuest.line}` : ""}</div>
      </div>
      <div class="strip-cell resume${isResumeFresh(state.resumeNote.since) ? " fresh" : ""}">
        ${isResumeFresh(state.resumeNote.since) ? `<div class="kicker"><span class="pulse"></span>fresh · last touch ${escapeHtml(state.resumeNote.lastTouched)} · ${escapeHtml(state.resumeNote.since)}</div>` : ""}
        <div class="strip-actions">
          <button type="button" class="icon-btn warn" data-copy-context="${escapeHtml(buildContextPrompt(state))}" title="Copy resume context to clipboard">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            copy
          </button>
          <button type="button" class="icon-btn" data-palette-open title="Open resume-prompt palette (Ctrl+K)">
            ⌘K
          </button>
        </div>
        <div class="kicker">Resume where you left off <span class="meta">· idle ${escapeHtml(state.resumeNote.since)}</span></div>
        <div class="strip-headline">${escapeHtml(state.resumeNote.task)}</div>
        <div class="strip-subline">↳ ${escapeHtml(state.resumeNote.lastTouched)} · ${escapeHtml(state.resumeNote.doc)}</div>
      </div>
    </section>

    <nav class="cockpit" aria-label="Status cockpit">
      <span class="stat"><span class="pip pip-now"></span><span class="num">${state.now.length}</span> now</span>
      <span class="stat"><span class="pip pip-next"></span><span class="num">${state.next.length}</span> next</span>
      <span class="stat"><span class="pip pip-blocked"></span><span class="num">${state.blocked.length}</span> blocked</span>
      <span class="stat"><span class="pip pip-agents"></span><span class="num">${state.agents.length}</span> agents</span>
      <span class="stat"><span class="pip pip-files"></span><span class="num">${state.scannedFiles.length}</span> files watched</span>
      <span class="spacer"></span>
      <span class="tail">${escapeHtml(state.activeQuest.doc)} · ${escapeHtml(state.resumeNote.lastTouched)}</span>
    </nav>

    <section class="board">
      <div class="col">
        ${renderTaskTile("now", "Now", state.now.length, state.now, true)}
        ${renderBlockedTile(state.blocked)}
      </div>
      <div class="col">
        ${renderTaskTile("next", "Next", state.next.length, state.next, false)}
        ${renderChangesTile(state.recentChanges)}
      </div>
      <div class="col">
        ${renderAgentsTile(state.agents)}
      </div>
    </section>
  </div>

  <div class="palette-overlay" data-palette data-open="false" role="dialog" aria-label="Resume-prompt palette">
    <div class="palette">
      <input class="palette-input" type="text" placeholder="Type to filter — or press Enter to copy the top option" data-palette-input />
      <div class="palette-list" data-palette-list></div>
      <div class="palette-footer">
        <span><kbd>↑↓</kbd>navigate</span>
        <span><kbd>Enter</kbd>copy to clipboard</span>
        <span><kbd>Esc</kbd>close</span>
      </div>
    </div>
  </div>

  <div class="toast" data-toast>copied</div>

  <script id="rql-presets" type="application/json">${escapeForScriptJson(JSON.stringify(presets))}</script>
  <script id="rql-state" type="application/json">${escapeForScriptJson(stateJson)}</script>

  ${renderLiveBridge(options.liveBridge)}
  ${renderSettingsScript()}
  ${renderPaletteScript()}
  ${renderTaskNavScript()}
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
    html, body { margin: 0; width: 100%; height: 100%; background: var(--bg); color: var(--ink); overflow: hidden; }
    body { font-family: var(--sans); overflow: hidden; }

    .panel {
      width: 100vw; height: 100vh; background: var(--bg);
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
    .change-diff {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--accent); font-family: var(--mono); font-size: 10px;
    }
    .change-diff-value { white-space: nowrap; }
    .change-spark { display: inline-flex; align-items: flex-end; gap: 1px; height: 8px; min-width: 10px; }
    .spark-add, .spark-del {
      display: inline-block; width: 3px; border-radius: 2px 2px 0 0; opacity: 0.88;
    }
    .spark-add { background: rgba(78,201,176,0.95); }
    .spark-del { background: rgba(244,135,113,0.92); }
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

    @media (max-width: 480px) {
      .header { padding: 0 8px; gap: 6px; }
      .header .branch { max-width: 44%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .resume { padding: 8px 10px; }
      .resume-task { font-size: 12px; }
      .resume-thought { font-size: 10px; }
      .section-head { padding: 4px 6px; }
      .row, .agent { padding-left: 16px; padding-right: 16px; }
      .row { font-size: 12px; }
      .agent-objective { font-size: 11px; }
      .status-bar { padding: 0 6px; gap: 8px; font-size: 11px; }
      .status-bar .tail { max-width: 42%; }
    }
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
        <button type="button" class="copy-context-btn" data-copy-context="${escapeHtml(buildContextPrompt(state))}" aria-label="Copy context for agent" title="Copy context for agent" style="background:transparent; border:none; color:var(--muted); cursor:pointer; padding:0; display:flex; align-items:center;">
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

function renderTaskTile(area: string, title: string, count: number, tasks: Task[], hot: boolean): string {
  const priorityClass = area === "now" ? "p-now" : "p-next";
  return `<section class="tile ${hot ? "hot" : ""}" data-area="${area}">
    <div class="tile-header">
      <h3 class="tile-title ${area}"><span class="accent-bar"></span>${escapeHtml(title)}</h3>
      <span class="tile-meta">${count} ${area === "now" ? "active" : "queued"}</span>
    </div>
    <div class="tile-body">
      ${tasks.length === 0
        ? `<div class="item"><span class="bar"></span><span class="item-num">·</span><span class="item-text">No items yet</span><span class="item-aside"></span></div>`
        : tasks.map((task, index) => renderItemRow(task, index, priorityClass, area === "now")).join("")}
    </div>
  </section>`;
}

function renderItemRow(task: Task, index: number, priorityClass: string, showAgent: boolean): string {
  const clickable = task.doc ? "clickable" : "";
  const openAttrs = task.doc ? ` data-open-doc="${escapeHtml(task.doc)}" data-line="${task.line ?? 1}" role="button" tabindex="0"` : "";
  const agentChip = showAgent && task.agent ? renderAgentChip(task.agent) : "";
  const docChip = task.doc ? `<span class="chip doc">${escapeHtml(task.doc)}</span>` : "";
  return `<div class="item ${priorityClass} ${clickable}"${openAttrs} title="${escapeHtml(task.text)}">
    <span class="bar"></span>
    <span class="item-num">${String(index + 1).padStart(2, "0")}</span>
    <span class="item-text">${escapeHtml(task.text)}</span>
    <span class="item-aside">${agentChip}${docChip}</span>
  </div>`;
}

function renderAgentChip(agent: string): string {
  const key = agent.toLowerCase();
  const known: Record<string, string> = { codex: "X", claude: "C", gemini: "G" };
  const label = known[key] ?? agent[0]?.toUpperCase() ?? "·";
  const cls = known[key] ? `agent-${key}` : "";
  return `<span class="chip ${cls}">${escapeHtml(label)}</span>`;
}

function renderBlockedTile(tasks: BlockedTask[]): string {
  return `<section class="tile tight" data-area="blocked">
    <div class="tile-header">
      <h3 class="tile-title blocked"><span class="accent-bar"></span>Blocked</h3>
      <span class="tile-meta">${tasks.length} waiting</span>
    </div>
    <div class="tile-body">
      ${tasks.length === 0
        ? `<div class="item"><span class="bar"></span><span class="item-num">·</span><span class="item-text">No blockers right now</span><span class="item-aside"></span></div>`
        : tasks.map((task, index) => `
          <div class="item p-blocked" title="${escapeHtml(task.text)}">
            <span class="bar"></span>
            <span class="item-num">${String(index + 1).padStart(2, "0")}</span>
            <span class="item-text">${escapeHtml(task.text)}</span>
            <span class="item-aside"><span class="chip doc">${escapeHtml(task.since)}</span></span>
          </div>
          <div class="blocked-reason">↳ ${escapeHtml(task.reason)}</div>
        `).join("")}
    </div>
  </section>`;
}

function renderAgentsTile(agents: AgentProfile[]): string {
  return `<section class="tile" data-area="agents">
    <div class="tile-header">
      <h3 class="tile-title agents"><span class="accent-bar"></span>Agents</h3>
      <span class="tile-meta">${agents.length} registered</span>
    </div>
    <div class="tile-body">
      ${agents.length === 0 ? `<div class="agent-card"><div class="agent-objective">No agent profiles discovered.</div></div>` : agents.map((agent) => `
        <div class="agent-card">
          <div class="agent-head">
            ${renderAgentChip(agent.id)}
            <span class="agent-name">${escapeHtml(agent.name)}</span>
            <span class="agent-role">${escapeHtml(agent.role)}</span>
            <span class="agent-status ${escapeHtml(agent.status)}"><span class="dot"></span>${escapeHtml(agent.status)}</span>
          </div>
          <div class="agent-objective">${escapeHtml(agent.objective)}</div>
          <div class="agent-meta">${escapeHtml(agent.file)} · ${escapeHtml(agent.area)}</div>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function renderChangesTile(changes: FileChange[]): string {
  return `<section class="tile tight" data-area="changes">
    <div class="tile-header">
      <h3 class="tile-title changes"><span class="accent-bar"></span>Recent changes</h3>
      <span class="tile-meta">file watcher</span>
    </div>
    <div class="tile-body">
      ${changes.length === 0 ? `<div class="change-row"><span class="change-file">No recent changes yet</span><span class="change-diff"></span><span class="change-age"></span></div>` : changes.map((change) => `
        <div class="change-row">
          <span class="change-file">${escapeHtml(change.file)}</span>
          ${renderChangeDiff(change.diff)}
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
  const clickAttr = task.doc ? ` data-open-doc="${escapeHtml(task.doc)}" data-line="${task.line || 1}" class="row clickable-row" role="button" tabindex="0"` : ` class="row"`;
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
    <span class="row-sub">${renderChangeDiff(change.diff)} <span>${escapeHtml(change.at)}</span></span>
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
      function openDoc(row) {
        if (!row) return;
        var doc = row.getAttribute("data-open-doc");
        var line = parseInt(row.getAttribute("data-line") || "1", 10);
        vscode.postMessage({ type: "openDoc", doc: doc, line: line });
      }
      document.addEventListener("click", function(event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var row = target.closest("[data-open-doc]");
        if (row) {
          openDoc(row);
        }
      });
      document.addEventListener("keydown", function(event) {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        var target = event.target;
        if (!target || !target.closest) return;
        var row = target.closest("[data-open-doc]");
        if (row) {
          event.preventDefault();
          openDoc(row);
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
      var defaults = { scale: 1, density: "compact" };

      function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
      function normalizeDensity(value) {
        if (value === "wide" || value === "spacious") return "wide";
        if (value === "cozy") return "cozy";
        return "compact";
      }
      function densityMultiplier(value) {
        if (value === "wide") return 1.08;
        if (value === "cozy") return 1;
        return 0.92;
      }
      function viewportMultiplier() {
        var width = window.innerWidth || 0;
        var height = window.innerHeight || 0;
        var widthFit = width >= 1600 ? 1 : width >= 1100 ? 0.96 : 0.88;
        var heightFit = height >= 900 ? 1 : height >= 700 ? 0.96 : height >= 600 ? 0.88 : 0.8;
        return Math.min(widthFit, heightFit);
      }
      function read() {
        try {
          var parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
          var scale = typeof parsed.scale === "number" ? parsed.scale : defaults.scale;
          return { scale: clamp(scale, 0.84, 1.16), density: normalizeDensity(parsed.density) };
        } catch (_) { return defaults; }
      }
      function save(next) { localStorage.setItem(KEY, JSON.stringify(next)); }
      function apply() {
        var prefs = read();
        var density = clamp(densityMultiplier(prefs.density) * prefs.scale * viewportMultiplier(), 0.76, 1.2);
        document.documentElement.dataset.density = prefs.density;
        document.documentElement.style.setProperty("--rql-density", density.toFixed(3));
        var scaleLabel = document.querySelector("[data-ui-scale-label]");
        if (scaleLabel) scaleLabel.textContent = Math.round(prefs.scale * 100) + "%";
        var densityButtons = document.querySelectorAll("[data-ui-density]");
        for (var i = 0; i < densityButtons.length; i += 1) {
          var button = densityButtons[i];
          button.setAttribute("aria-pressed", button.getAttribute("data-ui-density") === prefs.density ? "true" : "false");
        }
      }
      function update(patch) {
        var current = read();
        var next = {
          scale: typeof patch.scale === "number" ? clamp(patch.scale, 0.84, 1.16) : current.scale,
          density: patch.density ? normalizeDensity(patch.density) : current.density,
        };
        save(next);
        apply();
      }
      document.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var copyBtn = target.closest("[data-copy-context]");
        if (copyBtn) {
          var text = copyBtn.getAttribute("data-copy-context");
          if (text && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
              if (window.__rqlToast) window.__rqlToast("resume context copied");
            }).catch(function () {});
          }
        }
        var openRow = target.closest("[data-open-doc]");
        if (openRow && window.repologDesktop && typeof window.repologDesktop.openDoc === "function") {
          var doc = openRow.getAttribute("data-open-doc");
          var line = parseInt(openRow.getAttribute("data-line") || "1", 10);
          window.repologDesktop.openDoc(doc, line);
        }
        var button = target.closest("[data-ui-action], [data-ui-density]");
        if (!button) return;
        if (button.hasAttribute("data-ui-action")) {
          var action = button.getAttribute("data-ui-action");
          var prefs = read();
          if (action === "smaller") update({ scale: prefs.scale - 0.08 });
          if (action === "larger") update({ scale: prefs.scale + 0.08 });
        }
        if (button.hasAttribute("data-ui-density")) {
          update({ density: button.getAttribute("data-ui-density") || "wide" });
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
      window.addEventListener("resize", apply);
    })();
  </script>`;
}

function renderPaletteScript(): string {
  return `<script>
    (function () {
      var overlay = document.querySelector("[data-palette]");
      var input = document.querySelector("[data-palette-input]");
      var list = document.querySelector("[data-palette-list]");
      var toast = document.querySelector("[data-toast]");
      var presetsEl = document.getElementById("rql-presets");
      if (!overlay || !input || !list || !presetsEl) return;

      var presets = [];
      try { presets = JSON.parse(presetsEl.textContent || "[]"); } catch (_) { presets = []; }

      var selectedIndex = 0;
      var filtered = presets.slice();

      function open() {
        overlay.setAttribute("data-open", "true");
        input.value = "";
        filtered = presets.slice();
        selectedIndex = 0;
        renderList();
        setTimeout(function () { input.focus(); }, 10);
      }
      function close() { overlay.setAttribute("data-open", "false"); }
      function renderList() {
        var html = filtered.map(function (p, i) {
          return '<div class="palette-item" role="option" data-index="' + i + '" aria-selected="' + (i === selectedIndex ? "true" : "false") + '">' +
            '<span class="glyph">' + escapeHtml(p.glyph || "→") + '</span>' +
            '<div><div class="label">' + escapeHtml(p.label) + '</div><div class="sub">' + escapeHtml(p.sub || "") + '</div></div>' +
            '<span class="hint">↵</span>' +
          '</div>';
        }).join("");
        list.innerHTML = html || '<div class="palette-item"><span class="glyph">·</span><div class="label">No matches</div><span class="hint"></span></div>';
      }
      function filter(q) {
        var needle = q.toLowerCase().trim();
        filtered = presets.filter(function (p) {
          if (!needle) return true;
          return (p.label + " " + (p.sub || "") + " " + (p.keywords || "")).toLowerCase().indexOf(needle) !== -1;
        });
        selectedIndex = 0;
        renderList();
      }
      function move(delta) {
        if (filtered.length === 0) return;
        selectedIndex = (selectedIndex + delta + filtered.length) % filtered.length;
        renderList();
      }
      function commit() {
        var p = filtered[selectedIndex];
        if (!p) return;
        var text = p.body || "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast(p.label + " copied");
          }).catch(function () { showToast("copy failed"); });
        } else {
          showToast("clipboard unavailable");
        }
        close();
      }
      function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.setAttribute("data-visible", "true");
        clearTimeout(showToast._t);
        showToast._t = setTimeout(function () { toast.setAttribute("data-visible", "false"); }, 1800);
      }
      window.__rqlToast = showToast;
      function escapeHtml(v) {
        return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      }

      document.addEventListener("keydown", function (event) {
        var open = overlay.getAttribute("data-open") === "true";
        if ((event.ctrlKey || event.metaKey) && (event.key === "k" || event.key === "K")) {
          event.preventDefault();
          if (open) close(); else { openPalette(); }
          return;
        }
        if (!open) return;
        if (event.key === "Escape") { event.preventDefault(); close(); return; }
        if (event.key === "ArrowDown") { event.preventDefault(); move(1); return; }
        if (event.key === "ArrowUp") { event.preventDefault(); move(-1); return; }
        if (event.key === "Enter") { event.preventDefault(); commit(); return; }
      });
      function openPalette() { open(); }

      document.addEventListener("click", function (event) {
        var trigger = event.target.closest && event.target.closest("[data-palette-open]");
        if (trigger) { event.preventDefault(); openPalette(); return; }
        if (event.target === overlay) { close(); return; }
        var item = event.target.closest && event.target.closest(".palette-item");
        if (item && item.hasAttribute("data-index")) {
          selectedIndex = parseInt(item.getAttribute("data-index"), 10) || 0;
          commit();
        }
      });
      input.addEventListener("input", function () { filter(input.value); });
    })();
  </script>`;
}

function renderTaskNavScript(): string {
  return `<script>
    (function () {
      var AREAS = ["now", "next", "blocked"];
      function tilesByArea() {
        var map = {};
        AREAS.forEach(function (a) {
          map[a] = document.querySelector('[data-area="' + a + '"]');
        });
        return map;
      }
      function focusablesIn(tile) {
        if (!tile) return [];
        return [].slice.call(tile.querySelectorAll('.item.clickable'));
      }
      function activeTile() {
        var el = document.activeElement;
        if (!el || !el.closest) return null;
        return el.closest('[data-area]');
      }
      function jumpTo(area) {
        var tile = document.querySelector('[data-area="' + area + '"]');
        if (!tile) return;
        var items = focusablesIn(tile);
        if (items.length > 0) items[0].focus();
      }
      function move(delta) {
        var tile = activeTile();
        if (!tile) return;
        var items = focusablesIn(tile);
        var idx = items.indexOf(document.activeElement);
        if (idx === -1) return;
        var next = items[Math.max(0, Math.min(items.length - 1, idx + delta))];
        if (next) next.focus();
      }
      function fireOpen(el) {
        if (!el) return;
        var doc = el.getAttribute('data-open-doc');
        if (!doc) return;
        var line = parseInt(el.getAttribute('data-line') || '1', 10);
        if (window.repologDesktop && typeof window.repologDesktop.openDoc === 'function') {
          window.repologDesktop.openDoc(doc, line);
        } else {
          el.dispatchEvent(new CustomEvent('rql:open', { bubbles: true, detail: { doc: doc, line: line } }));
        }
      }
      document.addEventListener('keydown', function (event) {
        var palette = document.querySelector('[data-palette]');
        if (palette && palette.getAttribute('data-open') === 'true') return;
        var target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (event.key === 'j') { event.preventDefault(); move(1); return; }
        if (event.key === 'k') { event.preventDefault(); move(-1); return; }
        if (event.key === '1') { event.preventDefault(); jumpTo('now'); return; }
        if (event.key === '2') { event.preventDefault(); jumpTo('next'); return; }
        if (event.key === '3') { event.preventDefault(); jumpTo('blocked'); return; }
        if (event.key === 'Enter') {
          var t = activeTile();
          if (t && document.activeElement && document.activeElement.classList.contains('item')) {
            event.preventDefault();
            fireOpen(document.activeElement);
          }
        }
      });
    })();
  </script>`;
}

function renderChangeDiff(diff?: string): string {
  if (!diff) {
    return `<span class="change-diff"></span>`;
  }

  const match = /^\+(\d+)\s+-?(\d+)?$/.exec(diff.trim()) || /^(\d+)\s+(\d+)$/.exec(diff.trim());
  if (!match) {
    return `<span class="change-diff"><span class="change-diff-value">${escapeHtml(diff)}</span></span>`;
  }

  const added = Number(match[1]);
  const deleted = Number(match[2] ?? "0");
  const scale = Math.max(added, deleted, 1);
  const addHeight = Math.min(8, Math.max(2, Math.round((added / scale) * 8)));
  const delHeight = Math.min(8, Math.max(2, Math.round((deleted / scale) * 8)));

  return `<span class="change-diff">
    <span class="change-diff-value">${escapeHtml(diff)}</span>
    <span class="change-spark" aria-hidden="true">
      <span class="spark-add" style="height:${addHeight}px"></span>
      <span class="spark-del" style="height:${delHeight}px"></span>
    </span>
  </span>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isResumeFresh(since: string): boolean {
  if (!since) return false;
  const s = since.trim().toLowerCase();
  if (s === "just now" || s === "now") return true;
  const m = /^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)/i.exec(s);
  if (!m) return false;
  const n = Number(m[1] ?? "0");
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("s")) return true;
  if (unit.startsWith("m") && !unit.startsWith("h")) return n < 2;
  return false;
}

function escapeForScriptJson(value: string): string {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function buildContextPrompt(state: QuestState): string {
  return `I am resuming work on ${state.name} (branch: ${state.branch}).
Mission: ${state.mission}
Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total} · ${state.activeQuest.doc}${state.activeQuest.line ? `:${state.activeQuest.line}` : ""})
Current task: ${state.resumeNote.task}
Last touched: ${state.resumeNote.lastTouched} · idle ${state.resumeNote.since}
Please read ${state.resumeNote.lastTouched} and let's continue.`;
}

interface PromptPreset {
  id: string;
  glyph: string;
  label: string;
  sub: string;
  keywords: string;
  body: string;
}

function buildPromptPresets(state: QuestState): PromptPreset[] {
  const nowList = state.now.slice(0, 5).map((t, i) => `${i + 1}. ${t.text}${t.doc ? ` (${t.doc})` : ""}`).join("\n");
  const nextList = state.next.slice(0, 5).map((t, i) => `${i + 1}. ${t.text}`).join("\n");
  const blockedList = state.blocked.map((t, i) => `${i + 1}. ${t.text} — waiting on ${t.reason} (${t.since})`).join("\n");
  const agentList = state.agents.map((a) => `- ${a.name} (${a.role}): ${a.objective}`).join("\n");

  const resumeCore = `Repo: ${state.name} (branch: ${state.branch})
Mission: ${state.mission}
Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total})
Current task: ${state.resumeNote.task}
Last touched: ${state.resumeNote.lastTouched} · idle ${state.resumeNote.since}`;

  return [
    {
      id: "resume-claude",
      glyph: "C",
      label: "Resume for Claude Code",
      sub: "Paste into Claude with full context",
      keywords: "claude resume planner",
      body: `I'm resuming our Claude Code session.
${resumeCore}

Now:
${nowList || "(none)"}

Please read PLAN.md and STATE.md, then continue from "${state.resumeNote.task}".`,
    },
    {
      id: "resume-codex",
      glyph: "X",
      label: "Resume for Codex",
      sub: "Paste into Codex — implementer mode",
      keywords: "codex resume implementer",
      body: `Resuming Codex implementer session.
${resumeCore}

Read AGENTS.md for your instructions, then pick up the Now task:
${nowList || "(none)"}

Run npm run lint && npm test before committing.`,
    },
    {
      id: "resume-gemini",
      glyph: "G",
      label: "Resume for Gemini",
      sub: "Paste into Gemini — reviewer mode",
      keywords: "gemini resume reviewer",
      body: `Resuming Gemini reviewer session.
${resumeCore}

Read GEMINI.md for your scope. Recent work touches: ${state.resumeNote.lastTouched}.
Please review the latest diff against AGENTS.md constraints.`,
    },
    {
      id: "standup",
      glyph: "☀",
      label: "Daily standup",
      sub: "What's in flight + what's next",
      keywords: "standup daily update",
      body: `Standup — ${state.name} (${state.branch})

Objective: ${state.activeQuest.title} (${state.activeQuest.progress.done}/${state.activeQuest.progress.total})

In flight:
${nowList || "(none)"}

Up next:
${nextList || "(none)"}

Blocked:
${blockedList || "(none)"}`,
    },
    {
      id: "blocker-summary",
      glyph: "⏸",
      label: "Blocker summary",
      sub: "For a human or agent to unblock",
      keywords: "blocker blocked waiting",
      body: `Blocker summary — ${state.name}

${blockedList || "No active blockers."}

Context: objective is "${state.activeQuest.title}". Resolving these unblocks: ${state.resumeNote.task}.`,
    },
    {
      id: "briefing",
      glyph: "📖",
      label: "Repo intent briefing",
      sub: "Onboard a fresh agent session",
      keywords: "briefing intent onboard fresh",
      body: `Briefing: ${state.name}

Mission: ${state.mission}
Current objective: ${state.activeQuest.title}
Branch: ${state.branch}

Now (${state.now.length}):
${nowList || "(none)"}

Next (${state.next.length}):
${nextList || "(none)"}

Agents in this repo:
${agentList || "(none configured)"}

Start by reading PRD.md, PLAN.md, STATE.md. Then ask me what the current priority is before writing code.`,
    },
  ];
}
