import { buildContextPrompt, buildPromptPresets, type PromptPreset } from "../engine/prompts.js";
import type { AgentProfile, BlockedTask, Decision, FileChange, HandoffProviderProfile, HandoffSettings, QuestState, RecentActivityEvent, Task, WorkspaceMode, WorkspaceSignals, WorkspaceTimelineWindow } from "../engine/types.js";

export interface SurfaceHtmlOptions {
  liveBridge?: "desktop" | "vscode";
  presets?: PromptPreset[];
  appVersion?: string;
  openrouterConfigured?: boolean;
  handoffSettings?: HandoffSettings;
}

export function renderDesktopHtml(state: QuestState, options: SurfaceHtmlOptions = {}): string {
  const handoffSettings = normalizeHandoffSettings(options.handoffSettings);
  const presets = options.presets ?? buildPromptPresets(state, handoffSettings);
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
       --bg: #070d12;
       --chrome: #060b10;
       --bg-grid: rgba(120,140,180,0.02);
       --rql-density: 1.02;
      --pad-x: calc(14px * var(--rql-density));
      --pad-y: calc(8px * var(--rql-density));
      --tile-pad: calc(11px * var(--rql-density));
      --tile-gap: calc(8px * var(--rql-density));
       --row-gap: calc(4px * var(--rql-density));
       --body-size: calc(13px * var(--rql-density));
       --small-size: calc(11.5px * var(--rql-density));
       --tiny-size: calc(10px * var(--rql-density));
       --title-size: calc(13.5px * var(--rql-density));
       --headline-size: calc(17px * var(--rql-density));
       --tile: #10181d;
       --tile-2: #141b20;
       --tile-border: rgba(120,135,150,0.18);
       --tile-border-hot: rgba(76,152,255,0.36);
       --ink: #e8edf2;
       --muted: rgba(226,234,242,0.68);
       --dim: rgba(226,234,242,0.42);
       --faint: rgba(226,234,242,0.12);
       --accent: #58a6ff;
       --accent-soft: rgba(88,166,255,0.14);
       --warn: #e6bf45;
       --warn-soft: rgba(230,191,69,0.12);
       --ok: #73df73;
       --danger: #ff5555;
       --bg-elevated: #141a1f;
       --mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
       --sans: Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
       --rql-font: Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
     }
     [data-theme="slate"] {
       --bg: #0d1117;
       --bg-grid: rgba(100,130,180,0.03);
       --tile: rgba(22,27,34,0.85);
       --tile-border: rgba(80,110,150,0.18);
       --accent: #79c0ff;
       --accent-soft: rgba(121,192,255,0.13);
       --bg-elevated: #161b22;
     }
     [data-theme="dim"] {
       --bg: #12110f;
       --bg-grid: rgba(180,150,100,0.03);
       --tile: rgba(26,22,18,0.85);
       --tile-border: rgba(150,120,80,0.16);
       --accent: #d2a679;
       --accent-soft: rgba(210,166,121,0.13);
       --warn: #c9a85c;
       --bg-elevated: #1c1a17;
     }
     [data-theme="light"] {
       --bg: #f0f2f5;
       --bg-grid: rgba(0,0,0,0.04);
       --tile: #ffffff;
       --tile-border: rgba(0,0,0,0.09);
       --tile-border-hot: rgba(10,95,214,0.4);
       --accent: #0a5fd6;
       --accent-soft: rgba(10,95,214,0.09);
       --ink: #111318;
       --muted: rgba(0,0,0,0.55);
       --dim: rgba(0,0,0,0.38);
       --faint: rgba(0,0,0,0.06);
       --warn: #b45309;
       --warn-soft: rgba(180,83,9,0.1);
       --ok: #1a7f4b;
       --danger: #c0392b;
       --bg-elevated: #ffffff;
     }

    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; background: var(--bg); color: var(--ink); overflow: hidden; }
    body {
      font-family: var(--rql-font);
      font-size: var(--body-size);
      line-height: 1.35;
      background: var(--bg);
    }

    .shell {
      width: 100vw; height: 100vh;
      display: grid;
      grid-template-rows: auto auto auto minmax(0, 1fr) auto;
      overflow: hidden;
      border: 1px solid rgba(88,166,255,0.18);
      background: var(--bg);
    }

    /* ---- TOP BAR ---- */
    .topbar {
      display: flex; align-items: center; gap: 14px;
      min-height: 60px;
      padding: 0 var(--pad-x);
      border-bottom: 1px solid var(--tile-border);
      min-width: 0;
      background: var(--chrome);
    }
    .brand {
      display: flex; align-items: center; gap: 10px;
      color: var(--ink);
      font-size: calc(17px * var(--rql-density));
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
    }
    .brand svg {
      width: 32px;
      height: 32px;
      padding: 6px;
      border-radius: 3px;
      background: rgba(88,166,255,0.08);
      border: 1px solid rgba(88,166,255,0.7);
    }
    .divider { width: 1px; height: 14px; background: var(--tile-border); }
    .repo-meta { display: flex; align-items: center; gap: 14px; font-size: var(--body-size); color: var(--muted); min-width: 0; }
    .repo-meta .repo-path { max-width: 28vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .repo-meta .repo-path::before { content: "▭"; color: var(--muted); margin-right: 8px; font-family: var(--mono); }
    .repo-meta .branch { color: var(--ink); display: inline-flex; align-items: center; gap: 7px; }
    .repo-meta .branch::before { content: "⎇"; color: var(--muted); font-family: var(--mono); }
    .repo-meta .branch::after { content: "⌄"; color: var(--dim); font-family: var(--mono); font-size: var(--tiny-size); }
    .app-version {
      display: inline-flex; align-items: center;
      margin-left: 0;
      font-family: var(--mono); font-size: var(--small-size);
      color: var(--muted);
    }
    .kbd-hint {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--sans); font-size: var(--small-size);
      color: var(--muted); cursor: pointer;
      padding: 8px 13px; border: 1px solid var(--tile-border); border-radius: 8px;
      background: rgba(255,255,255,0.055);
    }
    .kbd-hint:hover { border-color: rgba(138,180,255,0.42); color: var(--accent); }
    .kbd-hint kbd {
      font-family: var(--mono); font-size: var(--tiny-size);
      padding: 1px 5px; border: 1px solid rgba(88,166,255,0.35); border-radius: 4px;
      background: rgba(255,255,255,0.04); color: var(--ink);
    }
    .watch-meta {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--small-size); color: var(--ok);
      white-space: nowrap;
    }
    .topbar-spacer { flex: 1 1 auto; min-width: 12px; }
    .surface-controls {
      display: inline-flex; align-items: center; gap: 4px;
      font-family: var(--mono); font-size: var(--small-size);
    }
    .window-controls {
      display: inline-flex; align-items: center; gap: 4px;
      margin-left: 4px;
    }
    .surface-controls button {
      appearance: none; border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02); color: var(--ink);
      border-radius: 6px; padding: 6px 8px; cursor: pointer;
      font: inherit;
    }
    .surface-controls button:hover { border-color: rgba(138,180,255,0.42); }
    .surface-controls button[data-ui-action="refresh"] {
      color: var(--warn);
      border-color: rgba(233,185,115,0.2);
    }
    .surface-controls button[data-ui-action="refresh"]:hover {
      color: var(--ink);
      border-color: rgba(233,185,115,0.55);
    }
    .surface-controls button[aria-pressed="true"] {
      background: rgba(138,180,255,0.16);
      border-color: rgba(138,180,255,0.42);
      color: var(--accent);
    }
    .window-controls button[data-window-action="close"] {
      color: var(--danger);
      border-color: rgba(244,132,113,0.22);
    }
    .window-controls button[data-window-action="close"]:hover {
      color: var(--ink);
      border-color: rgba(244,132,113,0.45);
    }
    .surface-controls .label { display: none; }
    .surface-controls [data-ui-scale-label] {
      min-width: 42px;
      text-align: center;
      color: var(--ink);
      font-weight: 700;
    }
    .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--ok); display: inline-block; }
    .topbar-action {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
      cursor: pointer;
      white-space: nowrap;
    }
    .topbar-action:hover {
      color: var(--accent);
      border-color: var(--tile-border);
      background: rgba(255,255,255,0.035);
    }
     .topbar-action.settings { color: var(--ink); }
     .topbar-action.repo-switch {
       color: var(--ink);
       border-color: var(--tile-border);
       background: rgba(88,166,255,0.07);
     }
      .topbar-action.repo-switch:hover {
        color: var(--accent);
        border-color: rgba(88,166,255,0.42);
        background: rgba(88,166,255,0.12);
      }
    .timeline-tabs button,
    .diff-action {
      appearance: none;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.025);
      color: var(--muted);
      border-radius: 5px;
      padding: 4px 7px;
      font: inherit;
      font-size: var(--tiny-size);
      cursor: pointer;
    }
    .timeline-tabs button[aria-pressed="true"] {
      color: var(--accent);
      border-color: rgba(138,180,255,0.52);
      background: rgba(88,166,255,0.12);
    }
    .timeline-tabs button:hover,
    .diff-action:hover {
      color: var(--ink);
      border-color: rgba(138,180,255,0.42);
    }
     .topbar-action .kbd-inline {
       display: inline-flex;
       align-items: center;
       gap: 2px;
       margin-left: 2px;
       font-family: var(--mono);
       font-size: var(--tiny-size);
       color: var(--muted);
     }
     .topbar-action kbd {
       font-family: var(--mono);
       font-size: var(--tiny-size);
       padding: 1px 5px;
       border: 1px solid var(--tile-border);
       border-radius: 3px;
       background: rgba(255,255,255,0.04);
       color: var(--ink);
     }

    /* ---- SETTINGS RACK ---- */
    .settings-rack {
      display: none;
      grid-template-columns: auto auto auto minmax(0, 1fr);
      gap: 8px;
      padding: 8px var(--pad-x);
      min-width: 0;
      border-bottom: 1px solid var(--tile-border);
      background: #0b1217;
    }
    .settings-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      padding: 0;
      min-width: 0;
      border: 0;
      background: transparent;
    }
    .settings-head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--muted);
      display: none;
    }
    .settings-head .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--faint);
      color: var(--ink);
      letter-spacing: 0.5px;
    }
    .settings-copy {
      font-family: var(--mono);
      font-size: var(--small-size);
      color: var(--muted);
      line-height: 1.28;
      display: none;
    }
    .settings-copy strong { color: var(--ink); font-weight: 600; }
    .settings-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .settings-actions button {
      appearance: none;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.055);
      color: var(--ink);
      border-radius: 7px;
      padding: 10px 14px;
      cursor: pointer;
      font: inherit;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 38px;
    }
    .settings-actions button:hover {
      border-color: rgba(138,180,255,0.42);
      color: var(--accent);
    }
    .settings-actions button.primary {
      border-color: var(--tile-border);
      background: rgba(255,255,255,0.055);
    }
    .settings-actions button[data-ui-action="open-settings"] {
      border-color: var(--tile-border);
    }
    .settings-actions button[data-ui-action="writeback-status"] {
      color: var(--warn);
      border-color: rgba(230,191,69,0.22);
      background: rgba(230,191,69,0.08);
      pointer-events: none;
    }
    .settings-actions button .kbd-inline {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--muted);
    }
    .settings-actions button kbd,
    .settings-copy kbd {
      font-family: var(--mono);
      font-size: var(--tiny-size);
      padding: 1px 5px;
      border: 1px solid var(--tile-border);
      border-radius: 3px;
      background: rgba(255,255,255,0.04);
      color: var(--ink);
    }
    .settings-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--dim);
    }
    .settings-chip-row .chiplet {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--faint);
      color: var(--ink);
    }
    .theme-swatch {
      display: inline-block;
      width: 10px; height: 10px;
      border-radius: 3px;
      border: 1px solid transparent;
      flex-shrink: 0;
    }
    .theme-picker button[aria-pressed="true"] {
      background: rgba(138,180,255,0.14);
      border-color: rgba(138,180,255,0.5);
      color: var(--accent);
    }

    /* ---- SETTINGS PANEL OVERLAY ---- */
    .settings-overlay {
      position: fixed;
      inset: 0;
      background: rgba(2,6,10,0.74);
      backdrop-filter: blur(9px) saturate(0.8);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 32px 18px 22px;
      z-index: 120;
    }
    .settings-overlay[data-open="true"] { display: flex; }
    .settings-panel {
      width: min(1300px, 92vw);
      height: min(1030px, 91vh);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      padding: 0;
      border-radius: 10px;
      border: 1px solid rgba(88,166,255,0.36);
      background: #0d151d;
      color: var(--ink);
      box-shadow: 0 34px 110px -24px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.55) inset;
      overflow: hidden;
    }
    .settings-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 20px 24px 18px;
      background: #0b131b;
      border-bottom: 1px solid rgba(160,180,205,0.14);
      flex-shrink: 0;
    }
    .settings-panel-shell {
      display: grid;
      grid-template-columns: 230px minmax(0, 1fr);
      min-height: 0;
      overflow: hidden;
    }
    .settings-sidebar {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 18px 14px;
      border-right: 1px solid rgba(160,180,205,0.12);
      background: #091017;
      min-height: 0;
    }
    .settings-nav {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .settings-nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 54px;
      padding: 0 14px;
      border-radius: 7px;
      color: var(--muted);
      font-size: 15px;
      border: 1px solid transparent;
      background: transparent;
    }
    .settings-nav-item.active {
      color: var(--accent);
      background: rgba(88,166,255,0.16);
      border-color: rgba(88,166,255,0.2);
      box-shadow: inset 3px 0 0 var(--accent);
    }
    .settings-nav-icon {
      width: 20px;
      color: currentColor;
      font-family: var(--mono);
      text-align: center;
      font-size: 18px;
    }
    .settings-sidebar-divider {
      height: 1px;
      background: rgba(160,180,205,0.16);
      margin: 10px 8px;
    }
    .settings-sidebar-status {
      margin-top: auto;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.025);
      border-radius: 7px;
      padding: 13px 14px;
      color: var(--muted);
      font-size: var(--small-size);
      line-height: 1.45;
    }
    .settings-sidebar-status .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--ok);
      display: inline-block;
      margin-right: 8px;
    }
    .settings-panel-body {
      min-height: 0;
      overflow-y: auto;
      padding: 18px 22px 22px;
      display: grid;
      grid-template-columns: minmax(0, 1.55fr) minmax(330px, 0.9fr);
      grid-auto-rows: min-content;
      gap: 16px;
      background: #0d151d;
    }
    .settings-panel-body::-webkit-scrollbar { width: 6px; }
    .settings-panel-body::-webkit-scrollbar-thumb { background: var(--faint); border-radius: 3px; }
    .settings-panel-body::-webkit-scrollbar-thumb:hover { background: var(--dim); }
    .settings-panel-title {
      display: flex;
      align-items: baseline;
      gap: 16px;
      font-family: var(--sans);
      text-transform: none;
      letter-spacing: 0;
      color: var(--muted);
      font-size: 15px;
    }
    .settings-panel-title strong {
      color: var(--ink);
      font-size: 24px;
      letter-spacing: 0;
      text-transform: none;
      font-family: var(--sans);
    }
    .settings-panel-title .title-divider {
      width: 1px;
      height: 22px;
      background: rgba(160,180,205,0.18);
    }
    .settings-panel-title .branch-link { color: var(--accent); font-family: var(--mono); }
    .settings-panel-close {
      appearance: none;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.05);
      color: var(--ink);
      border-radius: 7px;
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font: inherit;
      font-size: 24px;
      line-height: 1;
    }
    .settings-panel-close:hover { border-color: rgba(138,180,255,0.42); color: var(--accent); }
    .settings-panel-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      grid-column: 1 / -1;
    }
    .settings-panel-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding: 18px 20px;
      border-radius: 9px;
      border: 1px solid var(--tile-border);
      background: #121a22;
    }
    .settings-panel-card.large { min-height: 315px; }
    .settings-panel-card.appearance-card { grid-column: 1 / -1; }
    .settings-panel-card.utility-card { min-height: 145px; }
    .settings-panel-card .head {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--sans);
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      color: var(--muted);
    }
    .settings-panel-card .head-icon {
      color: var(--dim);
      font-family: var(--mono);
      font-size: 20px;
      line-height: 1;
    }
    .settings-panel-card .head .pill {
      padding: 0px 6px; border-radius: 999px;
      background: var(--faint); color: var(--ink);
      letter-spacing: 0.4px; font-size: 9px; text-transform: none;
    }
    .settings-panel-card .detail {
      font-family: var(--mono);
      font-size: var(--small-size);
      line-height: 1.4;
      color: var(--dim);
      overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap;
    }
    .settings-panel-card .detail strong { color: var(--muted); font-weight: 500; }
    .settings-panel-card .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: auto;
    }
    .settings-panel-card .actions button {
      appearance: none;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.045);
      color: var(--muted);
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
      font: inherit;
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .settings-panel-card .actions button:hover { border-color: rgba(138,180,255,0.42); color: var(--accent); }
    .settings-config {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 0.52fr);
      gap: 18px 26px;
      margin-top: 0;
    }
    .settings-config .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }
    .settings-config label {
      font-family: var(--mono);
      font-family: var(--sans);
      font-size: var(--body-size);
      color: var(--ink);
      letter-spacing: 0;
    }
    .settings-config textarea,
    .settings-config input[type="text"],
    .settings-config input[type="number"] {
      width: 100%;
      border: 1px solid var(--tile-border);
      border-radius: 7px;
      background: #0b1117;
      color: var(--ink);
      font: inherit;
      font-family: var(--mono);
      font-size: var(--body-size);
      padding: 10px 12px;
    }
    .settings-config textarea {
      min-height: 92px;
      resize: vertical;
    }
    .settings-config .span-2 {
      grid-column: 1 / -1;
    }
    .settings-config .toggle-row {
      display: flex;
      flex-direction: column;
      gap: 24px;
      align-items: stretch;
      font-family: var(--sans);
      font-size: var(--small-size);
      color: var(--muted);
    }
    .settings-config .toggle-row label {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 14px;
      color: var(--ink);
      text-transform: none;
      letter-spacing: 0;
    }
    .settings-config .toggle-row label span {
      display: block;
      color: var(--dim);
      font-size: var(--small-size);
      line-height: 1.45;
      margin-top: 4px;
    }
    .settings-config input[type="checkbox"],
    .settings-toggle {
      appearance: none;
      width: 48px;
      height: 28px;
      border-radius: 999px;
      border: 1px solid rgba(88,166,255,0.36);
      background: rgba(88,166,255,0.18);
      position: relative;
      cursor: pointer;
    }
    .settings-config input[type="checkbox"]::after,
    .settings-toggle::after {
      content: "";
      position: absolute;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      right: 2px;
      top: 2px;
      background: #e8f1ff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .settings-config input[type="checkbox"]:not(:checked) {
      background: rgba(255,255,255,0.05);
      border-color: var(--tile-border);
    }
    .settings-config input[type="checkbox"]:not(:checked)::after {
      right: 22px;
      background: var(--dim);
    }
    .settings-panel-footer {
      display: flex;
      align-items: center;
      gap: 14px;
      font-family: var(--sans);
      font-size: var(--small-size);
      color: var(--dim);
      border-top: 1px solid var(--tile-border);
      padding: 12px 18px;
      background: #0b131b;
      flex-shrink: 0;
    }
    .settings-panel-footer .footer-spacer { flex: 1; }
    .settings-panel-footer kbd {
      font-family: var(--mono);
      padding: 4px 9px;
      border-radius: 5px;
      background: rgba(255,255,255,0.055);
      border: 1px solid var(--tile-border);
      color: var(--ink);
      margin-right: 6px;
    }
    .settings-footer-save {
      appearance: none;
      border: 1px solid rgba(88,166,255,0.55);
      background: #2d7bd7;
      color: white;
      border-radius: 7px;
      padding: 10px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .settings-panel-report {
      margin: 0;
      display: none;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      line-height: 1.45;
      color: var(--muted);
      max-height: 18vh;
      overflow: auto;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02);
    }
    .settings-panel-report[data-visible="true"] { display: block; }

    /* ---- TUNEUP CARD ---- */
    .tuneup-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid rgba(138,180,255,0.16);
      background: rgba(138,180,255,0.03);
      min-width: 0;
    }
    .tuneup-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .tuneup-meter-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .tuneup-meter {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.06);
      overflow: hidden;
    }
    .tuneup-meter-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.4s ease, background 0.3s;
    }
    .tuneup-score {
      font-family: var(--mono);
      font-size: var(--small-size);
      color: var(--ink);
      white-space: nowrap;
      min-width: 52px;
      text-align: right;
    }
    .tuneup-prompt-area {
      font-family: var(--mono);
      font-size: var(--tiny-size);
      line-height: 1.55;
      color: var(--ink);
      background: rgba(0,0,0,0.28);
      border: 1px solid var(--tile-border);
      border-radius: 8px;
      padding: 12px 14px;
      height: 28vh;
      min-height: 140px;
      overflow-y: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      resize: vertical;
      width: 100%;
      display: none;
    }
    .tuneup-prompt-area[data-visible="true"] { display: block; }
    .handoff-guide-area {
      display: block;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      line-height: 1.5;
      color: var(--ink);
      background: rgba(0,0,0,0.28);
      border: 1px solid var(--tile-border);
      border-radius: 8px;
      padding: 10px 12px;
      min-height: 150px;
      max-height: 280px;
      overflow-y: auto;
      resize: vertical;
      width: 100%;
    }
    .handoff-setting-note {
      margin: 4px 0 0;
      color: var(--dim);
      font-size: var(--tiny-size);
      font-family: var(--mono);
    }
    .tuneup-gaps {
      display: none;
      flex-direction: column;
      gap: 6px;
    }
    .tuneup-gaps[data-visible="true"] { display: flex; }
    .tuneup-gap-row {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 8px;
      align-items: baseline;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--muted);
      padding: 6px 8px;
      border: 1px solid var(--faint);
      border-radius: 6px;
    }
    .tuneup-gap-sev { font-weight: 600; }
    .tuneup-gap-sev.high { color: var(--danger); }
    .tuneup-gap-sev.med { color: var(--warn); }
    .tuneup-gap-sev.low { color: var(--dim); }
    .tuneup-gap-text { color: var(--ink); }
    .tuneup-gap-file { color: var(--muted); }
    .tuneup-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .tuneup-actions button {
      appearance: none;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02);
      color: var(--ink);
      border-radius: 7px;
      padding: 5px 10px;
      cursor: pointer;
      font: inherit;
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .tuneup-actions button:hover { border-color: rgba(138,180,255,0.42); color: var(--accent); }
    .tuneup-actions button.primary {
      border-color: rgba(138,180,255,0.32);
      background: rgba(138,180,255,0.08);
    }
    .tuneup-actions .sep {
      width: 1px; height: 18px;
      background: var(--tile-border);
      display: inline-block;
    }
    .tuneup-placeholder {
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--dim);
    }
    .settings-panel-legend {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 14px;
      padding: 12px 0 2px;
      font-family: var(--mono);
      font-size: var(--small-size);
      color: var(--muted);
      line-height: 1.4;
    }
    .settings-panel-legend strong { color: var(--ink); font-weight: 600; }

    /* ---- SETTINGS MOCKUP FIDELITY PASS ---- */
    .settings-panel {
      width: min(1248px, calc(100vw - 72px));
      height: min(980px, calc(100vh - 48px));
      border-radius: 12px;
      border-color: rgba(72, 142, 219, 0.48);
      background: #0d141b;
      box-shadow: 0 34px 120px -24px rgba(0,0,0,0.92), 0 0 0 1px rgba(8,18,30,0.85) inset;
    }
    .settings-panel-head {
      min-height: 78px;
      padding: 0 22px 0 24px;
      background: #0b1219;
    }
    .settings-panel-title {
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: var(--dim);
    }
    .settings-panel-title strong {
      font-size: 22px;
      font-weight: 800;
    }
    .settings-panel-title .title-divider {
      height: 18px;
    }
    .settings-panel-close {
      width: 42px;
      height: 42px;
      font-size: 26px;
      background: rgba(255,255,255,0.045);
      border-color: rgba(151,170,190,0.18);
    }
    .settings-layout-body {
      display: block;
      padding: 0;
      overflow: hidden;
      background: #0d141b;
    }
    .settings-panel-shell {
      height: 100%;
      grid-template-columns: 236px minmax(0, 1fr);
    }
    .settings-sidebar {
      gap: 12px;
      padding: 18px 14px 16px;
      background: #090f15;
    }
    .settings-nav-item {
      appearance: none;
      width: 100%;
      min-height: 52px;
      cursor: pointer;
      font: inherit;
      text-align: left;
      color: #8995a4;
    }
    .settings-nav-label {
      display: flex;
      flex-direction: column;
      gap: 3px;
      line-height: 1.15;
    }
    .settings-nav-label small {
      color: var(--dim);
      font-size: 11px;
      font-family: var(--mono);
    }
    .settings-nav-item.active small { color: rgba(174,205,255,0.78); }
    .settings-sidebar-status {
      padding: 14px;
      background: rgba(18,26,34,0.9);
    }
    .settings-main {
      min-width: 0;
      min-height: 0;
      overflow-y: auto;
      padding: 18px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .settings-main::-webkit-scrollbar { width: 6px; }
    .settings-main::-webkit-scrollbar-thumb { background: var(--faint); border-radius: 3px; }
    [hidden],
    .settings-section[hidden] {
      display: none !important;
    }
    .settings-section[data-section-focus="true"] {
      outline: 1px solid rgba(88,166,255,0.52);
      outline-offset: 2px;
    }
    .settings-tuneup-wrap {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    .settings-hero {
      min-height: 170px;
      padding: 18px 22px;
      border-radius: 9px;
      border-color: rgba(88,166,255,0.25);
      background: linear-gradient(135deg, rgba(88,166,255,0.08), rgba(34,197,94,0.035)), #111923;
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) auto;
      gap: 18px;
      align-items: center;
    }
    .score-ring {
      width: 92px;
      height: 92px;
      border-radius: 999px;
      position: relative;
      flex: 0 0 92px;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at center, #111923 0 56%, transparent 57%),
        conic-gradient(var(--ok) 0 92%, rgba(255,255,255,0.08) 92% 100%);
      box-shadow: 0 0 24px rgba(34,197,94,0.1);
    }
    .score-ring > div {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      line-height: 1;
      text-align: center;
    }
    .score-ring strong {
      color: #dff8ea;
      font-family: var(--mono);
      font-size: 28px;
      line-height: 0.95;
    }
    .score-ring span {
      display: block;
      margin-top: 4px;
      color: var(--dim);
      font-family: var(--mono);
      font-size: 9px;
      text-align: center;
    }
    .settings-card.settings-tuneup-results {
      display: none;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      padding: 12px 14px;
    }
    .settings-card.settings-tuneup-results[data-visible="true"] {
      display: grid;
    }
    .settings-tuneup-results .tuneup-prompt-area {
      height: 150px;
      min-height: 118px;
      max-height: 220px;
      margin: 0;
    }
    .settings-tuneup-results[data-visible="true"] .tuneup-prompt-area[data-visible="true"] {
      display: block;
    }
    .settings-tuneup-results .tuneup-gaps {
      max-height: 210px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .settings-tuneup-results[data-visible="true"] .tuneup-gaps[data-visible="true"] {
      display: flex;
    }
    .settings-tuneup-results .tuneup-actions {
      justify-content: flex-start;
    }
    .tuneup-prompt-label {
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--muted);
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .settings-hero-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }
    .settings-kicker {
      font-family: var(--mono);
      color: var(--muted);
      font-size: var(--tiny-size);
      letter-spacing: 1.3px;
      text-transform: uppercase;
    }
    .settings-hero-title {
      margin: 0;
      font-size: 26px;
      line-height: 1.12;
      letter-spacing: 0;
      color: var(--ink);
    }
    .settings-hero-copy p {
      margin: 0;
      max-width: 690px;
      color: var(--muted);
      line-height: 1.45;
      font-size: 14px;
    }
    .settings-hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--dim);
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .settings-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: max-content;
      padding: 5px 9px;
      border-radius: 999px;
      border: 1px solid rgba(34,197,94,0.26);
      background: rgba(34,197,94,0.08);
      color: #9be6ad;
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .settings-status-pill::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--ok);
    }
    .settings-hero-actions {
      width: 210px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      align-items: stretch;
    }
    .settings-primary-button,
    .settings-footer-save {
      appearance: none;
      border: 1px solid rgba(88,166,255,0.62);
      background: linear-gradient(180deg, #2f7fdc, #1f63b7);
      color: white;
      border-radius: 7px;
      padding: 11px 16px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 10px 24px -16px rgba(88,166,255,0.9);
    }
    .settings-subtle-copy {
      margin: 0;
      color: var(--dim);
      font-size: 12px;
      line-height: 1.35;
    }
    .settings-core {
      display: grid;
      grid-template-columns: minmax(0, 1.28fr) minmax(320px, 0.72fr);
      gap: 12px;
      align-items: start;
    }
    .settings-card {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      padding: 16px 18px;
      border-radius: 9px;
      border: 1px solid rgba(151,170,190,0.16);
      background: #111820;
      min-width: 0;
    }
    .settings-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .settings-card-head.compact {
      margin-bottom: 2px;
    }
    .settings-card-title {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      color: var(--ink);
    }
    .settings-card-detail {
      margin: -7px 0 14px;
      color: var(--dim);
      font-size: 12px;
      line-height: 1.45;
    }
    .settings-write-note {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: -4px 0 14px;
    }
    .settings-write-note span {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border: 1px solid var(--tile-border);
      border-radius: 7px;
      background: rgba(255,255,255,0.025);
      color: var(--muted);
      font-size: var(--small-size);
      line-height: 1.35;
    }
    .settings-write-note strong {
      color: var(--ink);
      font-weight: 700;
    }
    .settings-write-note code,
    .settings-card-detail code {
      color: var(--accent);
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .settings-config {
      width: 100%;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 10px 18px;
    }
    .settings-config.single-column {
      grid-template-columns: minmax(0, 1fr);
    }
    .settings-config label,
    .settings-card label {
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--muted);
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .settings-config textarea,
    .settings-config input[type="text"],
    .settings-config input[type="number"],
    .settings-card input[type="password"],
    .settings-card select {
      background: #0a1015;
      border-color: rgba(151,170,190,0.14);
      border-radius: 7px;
      color: var(--ink);
      min-height: 42px;
      padding: 10px 12px;
    }
    .settings-config textarea {
      min-height: 86px;
    }
    .input-with-action,
    .input-with-unit {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }
    .input-unit {
      color: var(--dim);
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .settings-icon-button {
      appearance: none;
      width: 42px;
      height: 42px;
      display: inline-grid;
      place-items: center;
      border-radius: 7px;
      border: 1px solid rgba(151,170,190,0.16);
      background: rgba(255,255,255,0.035);
      color: var(--muted);
      cursor: pointer;
    }
    .settings-switch-column {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 4px;
    }
    .settings-switch-field {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
    }
    .settings-switch-field strong {
      display: block;
      color: var(--ink);
      font-size: 14px;
      margin-bottom: 3px;
    }
    .settings-switch-field span {
      display: block;
      color: var(--dim);
      font-size: 12px;
      line-height: 1.35;
    }
    .settings-config .toggle-row {
      display: contents;
    }
    .settings-config .toggle-row label {
      display: contents;
    }
    .settings-utility-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .settings-utility-card {
      min-height: 124px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .settings-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: auto;
    }
    .settings-card-actions button,
    .settings-utility-card .actions button,
    .tuneup-actions button {
      appearance: none;
      border: 1px solid rgba(151,170,190,0.16);
      background: rgba(255,255,255,0.04);
      color: var(--muted);
      border-radius: 7px;
      padding: 8px 11px;
      cursor: pointer;
      font: inherit;
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .settings-card-actions button:hover,
    .settings-utility-card .actions button:hover,
    .tuneup-actions button:hover {
      border-color: rgba(88,166,255,0.45);
      color: var(--accent);
    }
    .settings-rack .settings-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      padding: 0;
      min-width: 0;
      border: 0;
      background: transparent;
    }
    .settings-digest-card {
      display: flex;
      flex-direction: column;
      gap: 13px;
    }
    .settings-secret-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 42px;
      gap: 8px;
      align-items: end;
    }
    .settings-digest-card .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .settings-panel-footer {
      min-height: 58px;
      padding: 0 20px 0 22px;
      background: #0b1219;
    }
    .settings-panel-footer .footer-spacer {
      flex: 1;
    }
    .keyboard-hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      color: var(--dim);
    }
    .keyboard-hint kbd {
      margin: 0;
      padding: 3px 7px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 980px) {
      .settings-panel { width: min(100vw - 24px, 1248px); height: min(100vh - 24px, 940px); }
      .settings-panel-shell { grid-template-columns: 1fr; }
      .settings-sidebar { display: none; }
      .settings-hero,
      .settings-core,
      .settings-utility-grid,
      .settings-config { grid-template-columns: 1fr; }
      .settings-hero-actions { width: auto; }
      .settings-panel-grid { grid-template-columns: 1fr; overflow-y: auto; }
      .settings-panel-legend { grid-template-columns: 1fr; }
      .settings-panel-footer { overflow-x: auto; }
    }

    /* ---- HEADER STRIP (current focus + objective + agent docs) ---- */
    .header-strip {
      display: grid;
      grid-template-columns: minmax(420px, 1.42fr) minmax(300px, 0.88fr) minmax(360px, 1.04fr);
      gap: 14px;
      padding: 18px var(--pad-x) 12px;
      min-width: 0;
      align-items: stretch;
    }
    .strip-cell {
      position: relative;
      padding: 18px 20px;
      background: var(--tile-2);
      border: 1px solid var(--tile-border);
      border-radius: 7px;
      min-height: 166px;
      min-width: 0;
      display: flex; flex-direction: column; gap: 10px;
      overflow: hidden;
      justify-content: flex-start;
    }
    .strip-cell.objective,
    .strip-cell.focus {
      background: #0f1a22;
      border-color: rgba(88,166,255,0.3);
    }
    .strip-cell::before { content: none; }
    .kicker {
      font-family: var(--sans); font-size: calc(18px * var(--rql-density)); letter-spacing: 0;
      text-transform: none; color: var(--muted);
      display: flex; align-items: center; gap: 8px;
      padding-left: 0;
      font-weight: 750;
    }
    .strip-cell.focus .kicker,
    .strip-cell.objective .kicker { color: var(--accent); }
    .strip-link {
      margin-left: auto;
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-size: var(--small-size);
      cursor: pointer;
      padding: 0;
    }
    .kicker .meta { display: none; }
    .strip-headline {
      font-size: calc(18px * var(--rql-density)); font-weight: 750; line-height: 1.36;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      padding-left: 0;
    }
    .strip-cell.objective .strip-headline {
      font-size: calc(14px * var(--rql-density));
      font-weight: 450;
      color: var(--ink);
      line-height: 1.55;
      -webkit-line-clamp: 4;
    }
    .strip-subline {
      font-family: var(--sans); font-size: calc(14px * var(--rql-density)); color: var(--ink);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      padding-left: 0;
    }
    .strip-why {
      font-family: var(--sans); font-size: var(--small-size); color: var(--muted);
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      padding-left: 0;
      line-height: 1.45;
    }
    .strip-why strong { color: var(--accent); font-weight: 650; }
    .strip-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      padding-left: 0;
      margin-top: 7px;
    }
    .strip-tag {
      display: inline-flex;
      align-items: center;
      padding: 4px 9px;
      border: 1px solid rgba(88,166,255,0.42);
      color: var(--accent);
      background: rgba(88,166,255,0.08);
      border-radius: 7px;
      font-family: var(--mono);
      font-size: var(--small-size);
      white-space: nowrap;
    }
    .progress-line {
      width: min(100%, 280px);
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(88,166,255,0.14);
      margin-top: auto;
    }
    .progress-line span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--ok), color-mix(in srgb, var(--ok) 72%, var(--accent)));
    }
    .strip-actions {
      position: absolute; right: 20px; bottom: 18px;
      display: flex; gap: 6px;
    }
    .icon-btn {
      appearance: none; background: transparent; border: 1px solid var(--tile-border);
      color: var(--muted); border-radius: 7px; padding: 8px 12px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px;
      font-family: var(--mono); font-size: var(--tiny-size);
    }
    .icon-btn:hover { color: var(--accent); border-color: rgba(138,180,255,0.42); }
    .icon-btn.warn {
      color: #fff;
      background: #0d5db3;
      border-color: rgba(88,166,255,0.65);
    }
    .icon-btn.warn:hover { color: #fff; border-color: rgba(88,166,255,0.9); }

    .resume-freshline {
      display: inline-flex; align-items: center; gap: 8px;
      font-family: var(--sans); font-size: var(--small-size);
      color: var(--muted); letter-spacing: 0.8px; text-transform: uppercase;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .resume-freshline .pulse {
      width: 6px; height: 6px; border-radius: 999px; background: var(--ok);
      display: inline-block;
    }

    /* ---- COCKPIT STAT BAR ---- */
    .cockpit {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
      padding: calc(var(--pad-y) * 0.4) var(--pad-x);
      font-family: var(--mono); font-size: var(--small-size);
      color: var(--muted);
      border-bottom: 1px solid var(--tile-border);
      border-top: 1px solid var(--tile-border);
      margin-top: calc(var(--pad-y) * 0.26);
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

    /* ---- GIT STRIP ---- */
    .git-strip {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
      margin: 0 var(--pad-x);
      padding: 8px 12px;
      font-family: var(--mono); font-size: var(--small-size);
      color: var(--muted);
      border: 1px solid var(--tile-border);
      border-radius: 7px;
      background: var(--tile-2);
    }
    .git-strip .git-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 0; border-radius: 0;
      background: transparent; color: var(--muted);
    }
    .git-strip .git-chip.branch::before {
      content: "Git";
      color: var(--ink);
      font-family: var(--sans);
      font-size: var(--body-size);
      margin-right: 10px;
    }
    .git-strip .git-chip.dirty { color: var(--dim); }
    .git-strip .git-chip.ahead { color: var(--ok); }
    .git-strip .git-chip.behind { color: var(--warn); }
    .git-strip .git-subject { color: var(--dim); flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .git-strip .git-sha { color: var(--muted); font-family: var(--mono); }
    .git-health {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      white-space: nowrap;
    }
    .git-health .ok-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--ok);
      box-shadow: 0 0 0 2px rgba(115,223,115,0.1);
    }

    /* ---- WRITE-BACK BANNER ---- */
    .wb-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 6px var(--pad-x);
      background: linear-gradient(90deg, rgba(233,185,115,0.14), rgba(233,185,115,0.06));
      border-bottom: 1px solid rgba(233,185,115,0.35);
      color: var(--warn);
      font-family: var(--mono); font-size: var(--small-size);
    }
    .wb-banner .wb-left { display: inline-flex; align-items: center; gap: 8px; }
    .wb-banner .wb-dot {
      width: 8px; height: 8px; border-radius: 999px; background: var(--warn);
      box-shadow: 0 0 0 3px rgba(233,185,115,0.2);
      animation: wb-pulse 1.6s ease-in-out infinite;
    }
    @keyframes wb-pulse {
      0%,100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .wb-banner .wb-hint { color: var(--dim); }

    /* ---- AGENT ACTIVITY BADGE ---- */
    .activity-list { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
    .activity-row {
      display: flex; gap: 8px; align-items: center;
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--muted);
    }
    .activity-row .file { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
    .activity-row .ago { color: var(--dim); }
    .task-note {
      margin: -2px 0 8px 32px;
      font-family: var(--sans); font-size: var(--small-size); font-style: italic;
      color: var(--dim);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* ---- BOARD (3 cols, single row, fits viewport) ---- */
    .board {
      display: grid;
      grid-template-columns: minmax(320px, 0.86fr) minmax(470px, 1.08fr) minmax(360px, 0.96fr);
      grid-template-rows: minmax(0, 1fr);
      gap: 12px;
      padding: 12px var(--pad-x) 14px;
      min-height: 0;
      overflow: hidden;
    }
    .col {
      display: flex; flex-direction: column; gap: var(--tile-gap);
      min-height: 0; min-width: 0;
    }
    .col:nth-child(1) .tile[data-area="now"] {
      flex: 0 0 226px;
      min-height: 206px;
    }
    .col:nth-child(1) .tile[data-area="blocked"] {
      flex: 1 1 190px;
    }
    .col:nth-child(2) .tile[data-area="activity"] { flex: 1 1 0; }
    .col:nth-child(3) .tile[data-area="prompts"] {
      flex: 0 0 auto;
      min-height: 210px;
    }
    .col:nth-child(3) .tile[data-area="digest"] {
      flex: 1 1 0;
      min-height: 170px;
    }
    .support-data { display: none; }

    .tile {
      background: var(--tile);
      border: 1px solid var(--tile-border);
      border-radius: 7px;
      padding: 0;
      display: flex; flex-direction: column; gap: 8px;
      min-height: 0; min-width: 0;
      box-shadow: none;
      flex: 1 1 0;
    }
    .tile.tight { flex: 0 1 auto; }
    .tile.hot { border-color: var(--tile-border-hot); }
    .header-strip > .tile {
      min-height: 166px;
      flex: 0 0 auto;
      background: #0f1a22;
      border-color: rgba(120,135,150,0.22);
    }
    .header-strip > .tile .tile-body {
      padding: 10px 18px 12px;
      gap: 0;
    }
    .header-strip > .tile .tile-header {
      min-height: 48px;
      padding: 12px 18px;
    }

    .tile-header {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      flex-shrink: 0;
      min-height: 40px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--tile-border);
    }
    .tile-title {
      margin: 0; font-family: var(--sans); font-size: calc(17px * var(--rql-density)); font-weight: 700;
      color: var(--ink); letter-spacing: 0; text-transform: none;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .tile-title .accent-bar {
      display: inline-block; width: 10px; height: 10px; border-radius: 999px;
    }
    .tile-title.now .accent-bar { background: var(--ok); }
    .tile-title.next .accent-bar { background: var(--accent); }
    .tile-title.blocked .accent-bar { background: var(--danger); }
    .tile-title.agents .accent-bar { background: var(--ok); }
    .tile-title.changes .accent-bar { background: var(--dim); }
    .tile-meta {
      font-family: var(--mono); font-size: var(--small-size); color: var(--muted);
      min-width: 28px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
      padding: 0 8px; border: 1px solid var(--tile-border); border-radius: 6px; background: rgba(255,255,255,0.04);
    }
    .tile-body {
      display: flex; flex-direction: column; gap: calc(var(--row-gap) + 2px);
      min-height: 0; min-width: 0;
      overflow-y: auto; overflow-x: hidden;
      scrollbar-gutter: stable;
      padding: 8px 10px;
    }
    .tile-body::-webkit-scrollbar { width: 6px; }
    .tile-body::-webkit-scrollbar-thumb { background: var(--faint); border-radius: 3px; }
    .tile-body::-webkit-scrollbar-thumb:hover { background: var(--dim); }

    /* ---- TASK ROWS (cockpit-style, not Word-doc) ---- */
    .item {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr) auto;
      gap: 10px; align-items: start;
      padding: 6px 5px;
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
      content: none;
    }
    .item .bar,
    .item-num,
    .sigil { display: none; }
    .task-toggle {
      appearance: none;
      border: 2px solid rgba(226,234,242,0.55);
      background: transparent;
      color: var(--ok);
      border-radius: 4px;
      width: 16px;
      height: 16px;
      padding: 0;
      line-height: 14px;
      font-family: var(--mono);
      font-size: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
      cursor: pointer;
    }
    .task-toggle.enabled:hover { border-color: rgba(138,180,255,0.42); color: var(--accent); }
    .task-toggle.disabled {
      cursor: not-allowed;
      color: var(--dim);
      border-color: var(--tile-border);
      opacity: 0.7;
    }
    .item.p-now .bar { background: var(--ok); }
    .item.p-next .bar { background: var(--muted); opacity: 0.5; }
    .item.p-blocked .bar { background: var(--warn); }
    .item.p-change .bar { background: var(--dim); opacity: 0.4; }
    .item-text {
      min-width: 0;
      overflow: hidden; text-overflow: ellipsis;
      font-size: var(--body-size); line-height: 1.35; color: var(--ink);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .item-text.wrap { white-space: normal; overflow: visible; text-overflow: clip; }
    .item-aside {
      display: inline-flex; align-items: flex-start; gap: 6px;
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim);
      padding-top: 0;
    }
    .chip {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 3px 8px; border-radius: 6px;
      font-family: var(--mono); font-size: var(--tiny-size);
      border: 1px solid var(--faint); background: rgba(255,255,255,0.02);
    }
    .chip.agent-codex { background: rgba(118,186,143,0.12); color: #8fd0a9; border-color: rgba(118,186,143,0.3); }
    .chip.agent-claude { background: rgba(217,119,87,0.12); color: #e6a888; border-color: rgba(217,119,87,0.3); }
    .chip.agent-gemini { background: rgba(138,180,255,0.12); color: #a8c3f0; border-color: rgba(138,180,255,0.3); }
    .chip.doc {
      color: #a8d5b5;
      border-color: rgba(115,223,115,0.18);
      background: rgba(115,223,115,0.07);
      padding: 3px 8px;
      white-space: nowrap;
    }
    .chip.doc::after {
      content: "↗";
      color: var(--dim);
      margin-left: 5px;
    }

    .blocked-reason {
      padding-left: 32px; font-family: var(--sans); font-style: italic; font-size: var(--small-size); color: var(--dim);
      margin-top: -2px; margin-bottom: 4px;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    /* ---- AGENT CARDS ---- */
    .agent-card {
      padding: 15px 14px; background: transparent;
      border: 1px solid var(--faint); border-radius: 7px;
      display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 12px;
      min-width: 0;
    }
    .agent-avatar {
      width: 58px; height: 58px; border-radius: 999px;
      display: inline-flex; align-items: center; justify-content: center;
      background: #05090c; color: var(--ink);
      border: 1px solid rgba(255,255,255,0.08);
      font-size: 22px; font-weight: 800; letter-spacing: 0;
    }
    .agent-avatar.claude { background: #c97855; color: #141414; }
    .agent-avatar.gemini { background: #f4f7ff; color: #5f82ff; }
    .agent-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .agent-main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .agent-name { font-size: calc(15px * var(--rql-density)); font-weight: 700; }
    .agent-role {
      font-family: var(--sans); font-size: var(--small-size); color: var(--muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
    }
    .agent-objective {
      font-size: var(--small-size); line-height: 1.35; color: var(--muted); font-style: italic;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    }
    .agent-meta {
      font-family: var(--sans); font-size: var(--small-size); color: var(--dim); font-style: italic;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .agent-docs {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-end;
      min-width: 120px;
    }
    .agent-docs .chip.doc {
      color: var(--muted);
      background: rgba(255,255,255,0.04);
      border-color: var(--tile-border);
    }
    .agent-doc-table {
      display: grid;
      gap: 0;
    }
    .agent-doc-row {
      display: grid;
      grid-template-columns: minmax(92px, 0.5fr) minmax(84px, 0.32fr) minmax(150px, 0.9fr) minmax(180px, 1.18fr);
      gap: 14px;
      align-items: start;
      padding: 11px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: var(--small-size);
    }
    .agent-doc-row.head {
      padding-top: 0;
      color: var(--dim);
      font-family: var(--mono);
      font-size: var(--tiny-size);
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .agent-doc-row:last-child { border-bottom: 0; }
    .agent-doc-file { font-family: var(--mono); color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
    .agent-doc-status {
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--muted);
      border: 1px solid var(--tile-border);
      border-radius: 999px;
      padding: 2px 7px;
      width: fit-content;
      background: rgba(255,255,255,0.035);
    }
    .agent-doc-status.archived {
      color: var(--warn);
      border-color: rgba(230,191,69,0.28);
      background: rgba(230,191,69,0.08);
    }
    .agent-doc-role, .agent-doc-task {
      color: var(--muted);
      line-height: 1.35;
      overflow-wrap: anywhere;
      max-width: 72ch;
    }
    .digest-btn {
      background: rgba(255,255,255,0.04); border: 1px solid var(--tile-border); border-radius: 7px;
      color: var(--ink); font-size: var(--body-size); padding: 7px 12px;
      cursor: pointer; flex-shrink: 0;
    }
    .digest-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .digest-btn:not(:disabled):hover { background: var(--accent-soft); }
    .digest-panel {
      margin-top: 8px; padding: 12px 14px;
      background: rgba(255,255,255,0.035); border-radius: 7px; border: 1px solid rgba(230,191,69,0.16);
    }
    .digest-label { font-size: var(--small-size); color: var(--muted); display: block; margin-bottom: 8px; }
    .digest-summary { margin: 0 0 4px; font-size: var(--small-size); color: var(--ink); }
    .digest-detail { margin: 0 0 2px; font-size: var(--small-size); color: var(--muted); }
    .digest-model { font-size: var(--tiny-size); color: var(--dim); }
    .digest-empty { font-size: var(--small-size); color: var(--dim); margin: 8px 0 0; font-style: italic; }
    .pill {
      display: inline-block; font-size: var(--tiny-size); padding: 1px 5px;
      background: var(--faint); border-radius: 3px; color: var(--muted);
      vertical-align: middle; margin-left: 4px;
    }
    .card-info {
      position: relative; display: inline-flex; align-items: center;
      vertical-align: middle; margin-left: 4px; cursor: help;
    }
    .card-info-icon {
      width: 12px; height: 12px; color: var(--dim);
      opacity: 0.7; flex-shrink: 0; display: inline-block;
      vertical-align: middle; user-select: none; pointer-events: none;
    }
    .card-info-tip {
      display: none; position: absolute;
      bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
      background: var(--bg-elevated); border: 1px solid var(--tile-border);
      border-radius: 6px; padding: 7px 9px;
      font-size: var(--tiny-size); color: var(--muted);
      width: 190px; text-align: left; z-index: 200;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      line-height: 1.45; pointer-events: none; white-space: normal;
    }
    .card-info:hover .card-info-tip { display: block; }
    .settings-panel-card select {
      background: var(--faint); border: 1px solid var(--tile-border);
      color: var(--ink); border-radius: 4px; padding: 4px 6px;
      font-size: var(--small-size); font-family: var(--rql-font);
      appearance: none; -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 8px center;
      padding-right: 24px; cursor: pointer;
    }
    .settings-panel-card select:focus { outline: 1px solid var(--accent); }
    .settings-panel-card select option { background-color: #18182a; color: #dddde8; }
    [data-theme="light"] .settings-panel-card select option { background-color: #f5f5fa; color: #18181e; }

    /* ---- CHANGE ROWS ---- */
    .change-row {
      display: grid; grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px; align-items: center; padding: 3px 0;
      font-size: var(--small-size);
    }
    .change-file {
      font-family: var(--mono);
      overflow: hidden; text-overflow: ellipsis; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
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
    .signals-strip {
      margin: 0 var(--pad-x);
      display: grid;
      grid-template-rows: auto minmax(82px, auto);
      border: 1px solid var(--tile-border);
      border-radius: 7px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)),
        var(--tile);
      overflow: hidden;
    }
    .signals-head {
      display: flex;
      align-items: center;
      gap: 18px;
      min-height: 42px;
      padding: 0 20px;
      border-bottom: 1px solid var(--tile-border);
    }
    .signals-title {
      color: var(--ink);
      font-size: calc(17px * var(--rql-density));
      font-weight: 750;
    }
    .signals-help {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--accent);
      padding: 0;
      font: inherit;
      font-size: var(--small-size);
      cursor: pointer;
    }
    .signals-grid {
      display: grid;
      grid-template-columns:
        minmax(180px, 0.9fr)
        minmax(210px, 1fr)
        minmax(140px, 0.68fr)
        minmax(150px, 0.72fr)
        minmax(150px, 0.72fr)
        minmax(150px, 0.72fr)
        minmax(230px, 1.12fr);
      align-items: stretch;
      min-width: 0;
    }
    .signal-cell {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      padding: 14px 22px;
      border-left: 1px solid var(--tile-border);
    }
    .signal-cell:first-child { border-left: 0; }
    .signal-overview {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
    }
    .signal-wave {
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ok);
    }
    .signal-wave svg {
      width: 34px;
      height: 34px;
      filter: drop-shadow(0 0 10px rgba(138,214,168,0.22));
    }
    .signal-label {
      color: var(--muted);
      font-family: var(--sans);
      font-size: var(--small-size);
      text-transform: none;
      letter-spacing: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .signal-value {
      color: var(--ok);
      font-size: calc(19px * var(--rql-density));
      line-height: 1.05;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .signal-value.warn { color: var(--warn); }
    .signal-note {
      color: var(--muted);
      font-size: var(--tiny-size);
      font-family: var(--sans);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .signal-unit {
      margin-left: 6px;
      color: var(--muted);
      font-size: var(--tiny-size);
      font-family: var(--sans);
      font-weight: 500;
    }
    .signal-number {
      color: var(--ok);
      font-size: calc(22px * var(--rql-density));
      line-height: 1.02;
      font-weight: 800;
      font-family: var(--sans);
      white-space: nowrap;
    }
    .signal-number.warn { color: var(--warn); }
    .signal-spark {
      display: inline-flex;
      align-items: end;
      gap: 3px;
      height: 18px;
      min-width: 98px;
      margin-left: 10px;
      vertical-align: middle;
    }
    .signal-spark span,
    .signal-trend span {
      display: inline-block;
      width: 4px;
      border-radius: 3px 3px 0 0;
      background: rgba(138,214,168,0.84);
    }
    .signal-trend-wrap {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
    }
    .signal-trend {
      display: inline-flex;
      align-items: end;
      gap: 3px;
      height: 28px;
      min-width: 0;
      overflow: hidden;
    }
    .signal-trend span.quiet { background: rgba(138,180,255,0.24); }
    .signal-trend span.warn { background: rgba(233,185,115,0.86); }
    .signal-trend span.hot { background: rgba(248,132,113,0.86); }
    .signal-chevron {
      color: var(--dim);
      font-size: 26px;
      line-height: 1;
    }
    @keyframes rqlPulse {
      0% { transform: scaleY(1); filter: brightness(1); }
      35% { transform: scaleY(1.18); filter: brightness(1.35); }
      100% { transform: scaleY(1); filter: brightness(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .timeline-bucket.pulse { animation: none; }
    }
    .activity-toolbar {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .activity-live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--ok);
      font-size: var(--small-size);
    }
    .activity-control {
      appearance: none;
      border: 1px solid var(--tile-border);
      border-radius: 5px;
      background: rgba(255,255,255,0.025);
      color: var(--ink);
      padding: 5px 10px;
      font: inherit;
      font-size: var(--small-size);
    }
    .activity-ledger {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      gap: 0;
      min-height: 0;
      padding: 0;
    }
    .activity-head,
    .activity-row {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) 84px 72px minmax(96px, 0.56fr) 54px;
      gap: 10px;
      align-items: center;
    }
    .activity-head {
      padding: 8px 18px;
      color: var(--muted);
      font-size: var(--small-size);
      border-bottom: 1px solid var(--tile-border);
    }
    .activity-rows {
      min-height: 0;
      overflow: auto;
    }
    .activity-row {
      min-height: 38px;
      padding: 0 18px;
      border-bottom: 1px solid var(--faint);
      font-size: var(--small-size);
    }
    .activity-kind {
      justify-self: start;
      min-width: 24px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(138,214,168,0.36);
      border-radius: 5px;
      color: var(--ok);
      background: rgba(138,214,168,0.08);
      font-family: var(--mono);
      font-size: var(--tiny-size);
      text-transform: uppercase;
    }
    .activity-file {
      min-width: 0;
      font-family: var(--mono);
      color: var(--ink);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .activity-file.outside { color: var(--ink); }
    .activity-age { color: var(--muted); font-size: var(--small-size); }
    .activity-scope {
      color: transparent;
      font-size: var(--small-size);
      white-space: nowrap;
    }
    .activity-scope.outside { color: var(--warn); }
    .activity-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 38px;
      padding: 0 18px;
      color: var(--muted);
      font-size: var(--small-size);
      border-top: 1px solid var(--tile-border);
    }
    .scope-map {
      display: grid;
      gap: 8px;
    }
    .scope-lane {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr) 28px;
      gap: 8px;
      align-items: center;
      font-size: var(--small-size);
    }
    .scope-lane-label {
      color: var(--muted);
      font-family: var(--mono);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .scope-lane-track {
      height: 7px;
      border-radius: 999px;
      background: rgba(138,180,255,0.12);
      overflow: hidden;
    }
    .scope-lane-fill {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: inherit;
      background: rgba(138,180,255,0.58);
    }
    .scope-lane.outside .scope-lane-fill { background: rgba(233,185,115,0.72); }
    .scope-lane-count { color: var(--dim); font-family: var(--mono); font-size: var(--tiny-size); text-align: right; }
    .agent-health-rail {
      display: inline-block;
      width: 3px;
      height: 18px;
      margin-right: 7px;
      border-radius: 99px;
      vertical-align: middle;
      background: var(--ok);
      box-shadow: 0 0 12px rgba(138,214,168,0.22);
    }
    .agent-health-rail.reference { background: var(--muted); box-shadow: none; }
    .agent-health-rail.stale { background: var(--warn); box-shadow: 0 0 12px rgba(233,185,115,0.16); }
    .readiness-meters {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin: 9px 0;
    }
    .readiness-meter {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .readiness-meter-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: var(--muted);
      font-size: var(--tiny-size);
    }
    .readiness-track {
      height: 6px;
      border-radius: 99px;
      background: rgba(138,180,255,0.12);
      overflow: hidden;
    }
    .readiness-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }
    .readiness-fill.warn { background: var(--warn); }
    .readiness-fill.danger { background: var(--danger); }
    .diff-drawer {
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: min(760px, calc(100vw - 32px));
      max-height: min(72vh, 720px);
      display: none;
      grid-template-rows: auto minmax(0, 1fr);
      border: 1px solid rgba(138,180,255,0.28);
      border-radius: 8px;
      background: var(--bg-elevated);
      box-shadow: 0 22px 70px rgba(0,0,0,0.45);
      z-index: 80;
      overflow: hidden;
    }
    .diff-drawer[data-open="true"] { display: grid; }
    .diff-drawer-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--tile-border);
    }
    .diff-drawer-title {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--mono);
      color: var(--ink);
    }
    .diff-drawer-close {
      appearance: none;
      border: 1px solid var(--tile-border);
      border-radius: 5px;
      background: rgba(255,255,255,0.025);
      color: var(--muted);
      cursor: pointer;
      padding: 4px 8px;
    }
    .diff-drawer-body {
      margin: 0;
      padding: 12px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: var(--ink);
      font-family: var(--mono);
      font-size: var(--tiny-size);
      line-height: 1.55;
    }
    .prompt-row {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr) 30px;
      gap: 12px;
      align-items: center;
      min-height: 58px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--faint);
      font-size: var(--small-size);
    }
    .prompt-row:last-child { border-bottom: 0; }
    .prompt-glyph {
      width: 42px;
      height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--tile-border);
      border-radius: 5px;
      color: var(--accent);
      background: rgba(138,180,255,0.08);
    }
    .prompt-glyph svg { width: 30px; height: 30px; }
    .prompt-glyph.claude {
      color: #d7b98f;
      border-color: rgba(215,185,143,0.28);
      background: rgba(215,185,143,0.08);
    }
    .prompt-glyph.anthropic {
      color: #d7b98f;
      border-color: rgba(215,185,143,0.28);
      background: rgba(215,185,143,0.08);
    }
    .prompt-glyph.openai {
      color: #86e0bb;
      border-color: rgba(134,224,187,0.28);
      background: rgba(134,224,187,0.08);
    }
    .prompt-glyph.gemini {
      color: #a78bfa;
      border-color: rgba(167,139,250,0.3);
      background: rgba(167,139,250,0.1);
    }
    .prompt-label { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .prompt-sub { color: var(--dim); font-family: var(--mono); font-size: var(--tiny-size); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .prompt-copy {
      appearance: none;
      border: 1px solid var(--tile-border);
      border-radius: 5px;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--muted);
      padding: 0;
      font: inherit;
      cursor: pointer;
    }
    .prompt-copy:hover { background: var(--accent-soft); color: var(--accent); }
    .handoff-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--faint);
    }
    .handoff-provider-row,
    .handoff-source-row {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      flex-wrap: wrap;
    }
    .handoff-provider {
      appearance: none;
      border: 1px solid var(--tile-border);
      border-radius: 6px;
      background: rgba(255,255,255,0.025);
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 36px;
      padding: 4px 8px 4px 4px;
      cursor: pointer;
      font: inherit;
      font-size: var(--tiny-size);
    }
    .handoff-provider[aria-pressed="true"] {
      color: var(--ink);
      border-color: var(--tile-border-hot);
      background: var(--accent-soft);
    }
    .handoff-provider .prompt-glyph {
      width: 30px;
      height: 30px;
    }
    .handoff-provider .prompt-glyph svg {
      width: 23px;
      height: 23px;
    }
    .handoff-source {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--muted);
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .handoff-source input { accent-color: var(--accent); }
    .handoff-guide-link {
      margin-left: auto;
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--accent);
      cursor: pointer;
      font: inherit;
      font-size: var(--tiny-size);
      padding: 2px 0;
    }
    .handoff-intent-row .prompt-label {
      font-weight: 650;
    }
    .handoff-intent-row {
      grid-template-columns: minmax(0, 1fr) 30px;
      min-height: 46px;
      padding-top: 7px;
      padding-bottom: 7px;
    }
    .now-empty {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid rgba(230,191,69,0.22);
      border-radius: 8px;
      background: rgba(230,191,69,0.07);
    }
    .now-empty-title { color: var(--warn); font-weight: 750; }
    .now-empty-copy { color: var(--muted); font-size: var(--small-size); line-height: 1.4; }
    .now-empty-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .now-empty-actions button {
      appearance: none;
      border: 1px solid var(--tile-border);
      border-radius: 6px;
      background: rgba(255,255,255,0.04);
      color: var(--ink);
      padding: 6px 9px;
      font: inherit;
      font-size: var(--small-size);
      cursor: pointer;
    }
    .now-empty-actions button:hover { background: var(--accent-soft); color: var(--accent); }
    .desktop-footer {
      min-height: 38px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.72fr) minmax(0, 0.72fr) auto;
      border-top: 1px solid var(--tile-border);
      color: var(--muted);
      font-size: var(--small-size);
      background: var(--chrome);
    }
    .desktop-footer > span {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 0 18px;
      border-left: 1px solid var(--tile-border);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .desktop-footer > span:first-child { border-left: 0; }
    .desktop-footer .version {
      justify-content: flex-end;
      font-family: var(--mono);
      color: var(--muted);
    }

    /* ---- EMPTY STATE ---- */
    .empty-state {
      flex: 1; min-height: 0;
      display: flex; flex-direction: column; gap: var(--tile-gap);
      padding: var(--pad-y) var(--pad-x) var(--pad-x);
      overflow-y: auto;
    }
    .empty-banner {
      padding: var(--tile-pad);
      background: var(--tile); border: 1px dashed var(--tile-border);
      border-radius: 10px;
      color: var(--faint);
    }
    .empty-banner .kicker { color: var(--dim); }
    .empty-banner .ghost { font-size: var(--headline-size); color: var(--faint); font-style: italic; }
    .empty-grid {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--tile-gap);
    }
    .empty-tile {
      padding: var(--tile-pad); background: var(--tile);
      border: 1px dashed var(--tile-border); border-radius: 10px;
      display: flex; flex-direction: column; gap: 8px;
      color: var(--faint);
    }
    .empty-tile pre {
      margin: 0; padding: 8px 10px; background: rgba(255,255,255,0.02);
      border-radius: 6px; font-family: var(--mono); font-size: var(--tiny-size);
      color: var(--dim); white-space: pre-wrap; overflow-wrap: anywhere;
    }
    .empty-missing {
      display: flex; gap: 12px; flex-wrap: wrap; padding: 10px var(--tile-pad);
      font-family: var(--mono); font-size: var(--small-size); color: var(--faint);
      border-top: 1px solid var(--tile-border);
    }
    .empty-missing .slot { display: inline-flex; align-items: center; gap: 6px; }
    .empty-missing .slot.present { color: var(--muted); }
    .empty-missing .slot .mark { font-weight: 600; }
    @media (max-width: 1099px) { .empty-grid { grid-template-columns: 1fr; } }

    .onboarding-docs { display: flex; flex-wrap: wrap; gap: 6px; }
    .onboarding-docs span { border: 1px solid var(--tile-border); border-radius: 6px; padding: 4px 6px; color: var(--muted); font-size: var(--tiny-size); }
    .onboarding-docs .missing { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); }
    .repo-context-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .repo-context-summary {
      color: var(--ink);
      font-size: var(--small-size);
      line-height: 1.42;
      margin: 0;
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    .repo-context-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
    .repo-context-row {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 8px;
      align-items: baseline;
      color: var(--muted);
      font-size: var(--small-size);
      min-width: 0;
    }
    .repo-context-row span:first-child {
      color: var(--dim);
      font-family: var(--mono);
      font-size: var(--tiny-size);
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .repo-context-row code {
      color: var(--ink);
      font-family: var(--mono);
      font-size: var(--tiny-size);
      overflow-wrap: anywhere;
    }
    .repo-context-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .repo-context-actions button {
      appearance: none;
      border: 1px solid var(--tile-border);
      border-radius: 6px;
      background: var(--accent-soft);
      color: var(--accent);
      padding: 6px 8px;
      font: inherit;
      font-size: var(--tiny-size);
      cursor: pointer;
    }
    .repo-context-actions button:hover {
      border-color: rgba(138,180,255,0.42);
      color: var(--ink);
    }
    .repo-context-actions button.primary {
      background: var(--accent);
      color: #071019;
      border-color: transparent;
      font-weight: 700;
    }
    .repo-context-preview {
      width: 100%;
      min-height: 110px;
      border: 1px solid var(--tile-border);
      border-radius: 6px;
      background: rgba(255,255,255,0.025);
      color: var(--ink);
      font: inherit;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      line-height: 1.45;
      padding: 8px;
      resize: vertical;
    }

    /* ---- DECISIONS ---- */
    .decision-row {
      display: grid; grid-template-columns: 84px minmax(0, 1fr);
      gap: 10px; align-items: baseline; padding: 3px 0;
      border-left: 1px solid var(--faint); padding-left: 10px; margin-left: 4px;
    }
    .decision-date { font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim); }
    .decision-text {
      font-size: 13px; color: var(--ink); line-height: 1.35;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .decision-toggle {
      appearance: none; background: transparent; border: 0;
      color: var(--muted); font-family: var(--mono); font-size: var(--tiny-size);
      cursor: pointer; padding: 6px 0 2px; text-align: left;
    }
    .decision-toggle:hover { color: var(--accent); }
    [data-decisions-expanded="true"] .decision-hidden { display: block !important; }

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
       background: var(--bg-elevated);
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
      display: grid; grid-template-columns: 46px 1fr auto;
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
    .palette-item .prompt-glyph {
      font-family: inherit;
      font-size: inherit;
      color: var(--accent);
    }
    .palette-item .prompt-glyph {
      width: 38px;
      height: 38px;
    }
    .palette-item .prompt-glyph svg { width: 28px; height: 28px; }
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
       background: var(--bg-elevated); border: 1px solid var(--tile-border);
       color: var(--ok); font-family: var(--mono); font-size: 12px;
       padding: 10px 16px; border-radius: 8px;
      box-shadow: 0 10px 30px -5px rgba(0,0,0,0.6);
      opacity: 0; pointer-events: none;
      transition: opacity 0.18s, transform 0.18s;
      z-index: 200;
    }
    .toast[data-visible="true"] { opacity: 1; transform: translateX(-50%) translateY(-4px); }

    /* ---- RESPONSIVE: narrow screens collapse to stacked ---- */
    @media (max-width: 1180px) {
      .shell {
        --pad-x: 12px;
        --pad-y: 7px;
        --tile-pad: 10px;
        --tile-gap: 7px;
      }
      .topbar { min-height: 50px; gap: 10px; }
      .brand { font-size: 18px; }
      .brand svg { width: 28px; height: 28px; padding: 6px; }
      .app-version,
      .watch-meta span:last-child { display: none; }
      .settings-rack { padding: 7px var(--pad-x); }
      .header-strip {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px;
        padding: 8px var(--pad-x) 7px;
      }
      .strip-cell { min-height: 86px; padding: 10px 13px; }
      .header-strip > .tile { min-height: 86px; }
      .strip-headline { -webkit-line-clamp: 2; }
      .strip-tags { margin-top: 5px; gap: 5px; }
      .signals-strip {
        grid-template-rows: auto auto;
      }
      .signals-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .board {
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr) minmax(360px, 1.05fr);
      }
      .signal-cell {
        padding: 10px 12px;
      }
    }
    @media (min-width: 1560px) {
      .board {
        grid-template-columns: minmax(360px, 0.86fr) minmax(430px, 0.98fr) minmax(560px, 1.32fr);
      }
    }
    @media (max-width: 920px) {
      .board {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
        overflow-y: auto;
      }
      .col:nth-child(1) .tile[data-area="now"],
      .col:nth-child(2) .tile.tight[data-area="changes"],
      .col:nth-child(3) .tile[data-area="repo-context"] {
        flex: 0 0 auto;
      }
    }
    @media (max-width: 820px) {
      .topbar { flex-wrap: wrap; }
      .kbd-hint { margin-left: 0; }
      .header-strip,
      .signals-strip,
      .signals-grid,
      .col,
      .col:nth-child(1) { grid-template-columns: minmax(0, 1fr); }
      .signals-grid { display: grid; }
      .signal-cell {
        border-left: 0;
        border-top: 1px solid var(--tile-border);
      }
      .signal-cell:first-child { border-top: 0; }
    }
    @media (max-height: 780px) {
      .shell {
        --pad-y: 6px;
        --tile-gap: 7px;
      }
      .topbar { min-height: 48px; }
      .settings-rack { padding-top: 5px; padding-bottom: 5px; }
      .settings-actions button {
        min-height: 34px;
        padding-top: 7px;
        padding-bottom: 7px;
      }
      .header-strip {
        padding-top: 7px;
        grid-template-columns: minmax(330px, 1.34fr) minmax(250px, 0.82fr) minmax(310px, 1fr);
      }
      .strip-cell,
      .header-strip > .tile { min-height: 138px; }
      .strip-cell { padding: 12px 14px; }
      .strip-cell.objective .strip-headline { -webkit-line-clamp: 3; }
      .strip-cell.focus .strip-why { -webkit-line-clamp: 1; }
      .strip-tags { margin-top: 5px; }
      .signal-cell { padding-top: 8px; padding-bottom: 8px; }
      .tile-header { min-height: 38px; }
      .tile-body { padding-top: 7px; padding-bottom: 7px; }
      .prompt-sub { display: none; }
    }
    @media (max-height: 640px) {
      .header-strip { grid-template-columns: minmax(0, 1fr); }
      .signals-strip { grid-template-columns: minmax(0, 1fr); }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand" aria-label="repo quest log">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="#8ab4ff" stroke-width="1.3"></rect>
          <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#8ab4ff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span>RepoLog</span>
      </div>
      <span class="divider"></span>
      <div class="repo-meta">
        <span class="repo-path">${escapeHtml(state.name)}</span>
        <span class="branch">${escapeHtml(state.branch)}</span>
      </div>
      ${options.liveBridge === "desktop" ? `<button type="button" class="topbar-action repo-switch" data-ui-action="open-repo" data-role="topbar-switch-repo" title="Switch repo folder (Ctrl+O)">Switch Repo <span class="kbd-inline"><kbd>Ctrl</kbd><kbd>O</kbd></span></button>` : ""}
      <div class="topbar-spacer"></div>
      <button type="button" class="topbar-action" data-ui-action="refresh" title="Refresh (Ctrl+R)">↻ Rescan <span style="color:var(--dim)">(${escapeHtml(state.lastScan)})</span></button>
      <button type="button" class="topbar-action settings" data-ui-action="open-settings" title="Open settings">⚙ Settings</button>
      <div class="watch-meta">
        <span class="dot"></span>
        <span>Watcher: Active</span>
      </div>
      ${options.appVersion ? `<span class="app-version">v${escapeHtml(options.appVersion)}</span>` : ""}
      <div class="surface-controls" aria-label="Display controls">
        <span class="label">Size</span>
        <button type="button" data-ui-action="smaller" aria-label="Smaller">A-</button>
        <span data-ui-scale-label>100%</span>
        <button type="button" data-ui-action="larger" aria-label="Larger">A+</button>
      </div>
    </header>
    ${renderSettingsRack(state, options.liveBridge)}
    ${renderSettingsPanel(state, options.liveBridge, handoffSettings)}
    ${isEmptyRepo(state) ? renderEmptyState(state) : `
    <section class="header-strip">
        <div class="strip-cell focus${isResumeFresh(state.resumeNote.since) ? " fresh" : ""}">
          <div class="kicker">Current Focus <button type="button" class="strip-link" data-palette-open>Why this task?</button></div>
          <span class="sr-only">Current focus</span>
          <span class="sr-only">${escapeHtml(resolveResumeSource(state))}</span>
          <div class="strip-headline">${escapeHtml(resolveResumeText(state))}</div>
          <div class="strip-subline">${escapeHtml(resolveMissionText(state))}</div>
          <div class="strip-why"><strong>Why this task?</strong> <span class="sr-only">Why this matters</span>${escapeHtml(state.resumeNote.thought ?? getWhyNowLine(state))}</div>
          <div class="strip-tags">
            ${renderSourceDocTags(state)}
          </div>
          <div class="strip-actions">
            <button type="button" class="icon-btn warn" data-copy-context="${escapeHtml(buildContextPrompt(state))}" title="Copy resume context to clipboard">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              Copy Resume Prompt
            </button>
          </div>
        </div>
        <div class="strip-cell objective">
          <div class="kicker">Objective <button type="button" class="strip-link" data-palette-open>Why this exists?</button></div>
          <span class="sr-only">${escapeHtml(resolveObjectiveSource(state))}</span>
          <div class="strip-headline">${escapeHtml(resolveObjectiveText(state))}</div>
          <div class="progress-line" aria-label="Objective progress">
            <span style="width:${objectiveProgressPercent(state)}%"></span>
          </div>
          <div class="strip-tags">
            <span class="strip-tag">${state.activeQuest.progress.done}/${state.activeQuest.progress.total} complete</span>
            <span class="strip-tag">${state.now.length} Now</span>
            <span class="strip-tag">${state.next.length} Next</span>
          </div>
        </div>
        ${renderAgentDocsTile(state)}
    </section>

      ${renderWorkspaceSignalsStrip(state)}

      <section class="board">
      <div class="col">
        ${renderTaskTile("now", "Now", state.now.length, state.now, true, !!state.config?.writeback, options.liveBridge)}
        ${renderBlockedTile(state.blocked, !!state.config?.writeback, options.liveBridge)}
      </div>
      <div class="col">
        ${renderRecentActivityTile(state.recentActivity ?? [])}
      </div>
      <div class="col">
        ${renderAgentHandoffTile(state, presets, handoffSettings)}
        ${renderDigestTile(state, options.openrouterConfigured ?? false)}
      </div>
      <div class="support-data" aria-hidden="true">
        ${renderRepoContextTile(state)}
        ${renderChangesTile(state.recentChanges)}
      </div>
      </section>
      ${renderDesktopFooter(state, options.appVersion)}
    `}
  </div>

  <div class="palette-overlay" data-palette data-open="false" role="dialog" aria-label="Agent handoff palette">
    <div class="palette">
      <input class="palette-input" type="text" placeholder="Type to filter handoffs — press Enter to copy one" data-palette-input />
      <div class="palette-list" data-palette-list></div>
      <div class="palette-footer">
        <span><kbd>↑↓</kbd>navigate</span>
        <span><kbd>Enter</kbd>copy prompt</span>
        <span><kbd>Esc</kbd>close</span>
      </div>
    </div>
  </div>
  <section class="diff-drawer" data-diff-drawer data-open="false" aria-label="Diff preview">
    <div class="diff-drawer-head">
      <div class="diff-drawer-title" data-diff-title>Diff preview</div>
      <button type="button" class="diff-drawer-close" data-ui-action="close-diff" aria-label="Close diff">Close</button>
    </div>
    <pre class="diff-drawer-body" data-diff-body>Choose a changed file to preview its diff.</pre>
  </section>

  <div class="toast" data-toast>copied</div>

  <script id="rql-presets" type="application/json">${escapeForScriptJson(JSON.stringify(presets))}</script>
  <script id="rql-state" type="application/json">${escapeForScriptJson(stateJson)}</script>

  ${renderLiveBridge(options.liveBridge)}
  ${renderSettingsScript()}
  ${renderPaletteScript()}
  ${renderTaskNavScript()}
  ${renderWritebackScript()}
  ${renderDecisionToggleScript()}
  ${renderTuneupScript()}
</body>
  </html>`;
}

function defaultHandoffProviders(): HandoffProviderProfile[] {
  return [
    { id: "openai-codex", label: "OpenAI / Codex", icon: "openai", enabled: true },
    { id: "anthropic-claude", label: "Anthropic / Claude", icon: "anthropic", enabled: true },
    { id: "google-gemini", label: "Gemini", icon: "gemini", enabled: true },
    { id: "custom", label: "Custom provider", icon: "custom", enabled: true },
  ];
}

function normalizeHandoffSettings(settings: HandoffSettings | undefined): Required<HandoffSettings> {
  const defaults: Required<HandoffSettings> = {
    personalAgentGuide: "",
    providers: defaultHandoffProviders(),
    lastProviderId: "openai-codex",
    lastIntentId: "resume-current-work",
    instructionSourceSelection: ["repo-agent-docs", "recent-activity"],
    includePersonalGuideDefault: false,
    includeRepoAgentDocsDefault: true,
    includeRecentActivityDefault: true,
  };
  if (!settings) {
    return defaults;
  }

  return {
    personalAgentGuide: settings.personalAgentGuide ?? defaults.personalAgentGuide,
    providers: settings.providers?.length ? settings.providers : defaults.providers,
    lastProviderId: settings.lastProviderId ?? defaults.lastProviderId,
    lastIntentId: settings.lastIntentId ?? defaults.lastIntentId,
    instructionSourceSelection: settings.instructionSourceSelection ?? defaults.instructionSourceSelection,
    includePersonalGuideDefault: settings.includePersonalGuideDefault ?? defaults.includePersonalGuideDefault,
    includeRepoAgentDocsDefault: settings.includeRepoAgentDocsDefault ?? defaults.includeRepoAgentDocsDefault,
    includeRecentActivityDefault: settings.includeRecentActivityDefault ?? defaults.includeRecentActivityDefault,
  };
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
       margin-left: 6px; background: var(--faint); color: #fff; font-size: 10px;
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
        <div style="display:flex; align-items:center; gap: 8px;">
          <button type="button" class="copy-context-btn" data-copy-context="${escapeHtml(buildContextPrompt(state))}" aria-label="Copy context for agent" title="Copy context for agent" style="background:transparent; border:none; color:var(--muted); cursor:pointer; padding:0; display:flex; align-items:center;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
          </button>
        </div>
      </div>
      <div class="resume-task">${escapeHtml(state.resumeNote.task)}</div>
      <div class="resume-thought">&ldquo;${escapeHtml(state.resumeNote.thought ?? "")}&rdquo;</div>
    </div>

    <div class="scroll">
      ${renderVSCodeSection("Now", state.now.length, "#0e639c", state.now.map((task) => renderVSCodeTaskRow(task, "◆", "#4ec9b0")))}
      ${renderVSCodeSection("Next", state.next.length, undefined, state.next.map((task) => renderVSCodeTaskRow(task, "○")))}
      ${renderVSCodeSection("Blocked", state.blocked.filter((task) => !isNoneBlocker(task)).length, "#a1260d", state.blocked.filter((task) => !isNoneBlocker(task)).map((task) => renderVSCodeBlockedRow(task)))}
        ${renderVSCodeSection("Agent Docs", state.agents.length, undefined, state.agents.map((agent) => renderVSCodeAgent(agent)))}
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

function resolveMissionText(state: QuestState): string {
  const mission = state.mission.trim();
  if (mission) return mission;
  const context = state.repoContext;
  const readme = summarizeReadme(context?.readmePreview);
  if (readme) return readme;
  if (context?.packageDescription) return context.packageDescription;
  return "No mission found yet. RepoLog will keep showing repo activity while you add planning docs.";
}

function resolveMissionSource(state: QuestState): string {
  if (state.mission.trim()) return "source: PLAN.md / README.md";
  if (state.repoContext?.readmePreview || state.repoContext?.packageDescription) return "source: README / package context";
  return "add PLAN.md for a stronger mission";
}

function resolveObjectiveText(state: QuestState): string {
  const title = state.activeQuest.title.trim();
  if (title) return title;
  return "No objective set yet";
}

function resolveObjectiveSource(state: QuestState): string {
  if (state.activeQuest.title.trim()) {
    return `${state.activeQuest.progress.done}/${state.activeQuest.progress.total} · source: PLAN.md`;
  }
  return "add PLAN.md when you want RepoLog to track a clear objective";
}

function resolveResumeText(state: QuestState): string {
  const task = state.resumeNote.task.trim();
  if (task) return task;
  return "No resume note yet";
}

function resolveResumeSource(state: QuestState): string {
  if (state.resumeNote.task.trim()) {
    return `· last touch ${state.resumeNote.since} · source: STATE.md resume note`;
  }
  return "add STATE.md to preserve the next handoff";
}

function objectiveProgressPercent(state: QuestState): number {
  const total = state.activeQuest.progress.total;
  if (!Number.isFinite(total) || total <= 0) return 0;
  const done = Math.max(0, Math.min(total, state.activeQuest.progress.done));
  return Math.round((done / total) * 100);
}

function renderSourceDocTags(state: QuestState): string {
  const scannedFiles = new Set(state.scannedFiles.map((file) => file.toLowerCase()));
  const docs = uniqueStrings([
    state.resumeNote.doc,
    state.activeQuest.doc,
    "AGENTS.md",
  ].filter((doc) => doc && scannedFiles.has(doc.toLowerCase())));
  if (docs.length === 0) {
    return `<span class="strip-tag">No source docs yet</span>`;
  }
  return docs.slice(0, 4).map((doc) => `<span class="strip-tag">${escapeHtml(doc)}</span>`).join("");
}

function renderDesktopFooter(state: QuestState, appVersion?: string): string {
  const cacheHint = state.config?.prompts?.dir ? `prompts: ${state.config.prompts.dir}` : "prompts: built-in";
  const activityCount = state.recentActivity?.length ?? 0;
  return `<footer class="desktop-footer" aria-label="Repository status">
    <span>▭ Repo: ${escapeHtml(state.name)}</span>
    <span><span class="dot"></span>${escapeHtml(cacheHint)}</span>
    <span>Events: ${activityCount} (${escapeHtml(state.lastScan)})</span>
    <span class="version">${appVersion ? `v${escapeHtml(appVersion)}` : ""}</span>
  </footer>`;
}

function renderTaskTile(
  area: string,
  title: string,
  count: number,
  tasks: Task[],
  hot: boolean,
  writebackEnabled: boolean,
  liveBridge?: SurfaceHtmlOptions["liveBridge"],
): string {
  const priorityClass = area === "now" ? "p-now" : "p-next";
  return `<section class="tile ${hot ? "hot" : ""}" data-area="${area}">
    <div class="tile-header">
      <h3 class="tile-title ${area}"><span class="accent-bar"></span>${escapeHtml(title)}</h3>
      <span class="tile-meta">${count}</span>
    </div>
    <div class="tile-body">
      ${tasks.length === 0
        ? area === "now"
          ? renderNoCurrentTaskWarning()
          : `<div class="item"><span class="bar"></span><span class="task-toggle disabled" aria-hidden="true">◌</span><span class="sigil"></span><span class="item-num">·</span><span class="item-text">No items yet</span><span class="item-aside"></span></div>`
        : tasks.map((task, index) => renderItemRow(task, index, priorityClass, area === "now", writebackEnabled, liveBridge)).join("")}
    </div>
  </section>`;
}

function renderNoCurrentTaskWarning(): string {
  const prompt = "RepoLog found no current task. Add a ## Now section to PLAN.md or STATE.md with one unchecked task, why it matters, and the file area or agent that owns it. Use this shape:\n\n## Now\n- [ ] Fix the thing you are doing next";
  return `<div class="now-empty">
    <div class="now-empty-title">No current task set</div>
    <div class="now-empty-copy">RepoLog can show objective and history, but it cannot tell you what to do next until the repo has one current task.</div>
    <div class="now-empty-copy"><strong>Add a short ## Now section:</strong> <code>- [ ] Fix the thing you are doing next</code></div>
    <div class="now-empty-actions">
      <button type="button" data-copy-context="${escapeHtml(prompt)}">Copy repair prompt</button>
      <button type="button" data-open-doc="PLAN.md" data-line="1">Open PLAN.md</button>
    </div>
  </div>`;
}

function renderConfidenceSigil(confidence: number | undefined): string {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return `<span class="sigil" aria-hidden="true"></span>`;
  }
  const c = Math.max(0, Math.min(1, confidence));
  const lit = c >= 0.84 ? 3 : c >= 0.5 ? 2 : c >= 0.17 ? 1 : 0;
  const dots: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const on = i >= 3 - lit;
    dots.push(`<span class="${on ? "on" : "off"}">●</span>`);
  }
  return `<span class="sigil" title="heuristic confidence: ${c.toFixed(2)}">${dots.join("")}</span>`;
}

  function renderItemRow(
    task: Task,
    index: number,
    priorityClass: string,
    showAgent: boolean,
    writebackEnabled: boolean,
    liveBridge?: SurfaceHtmlOptions["liveBridge"],
  ): string {
    const clickable = task.doc ? "clickable" : "";
    const openAttrs = task.doc ? ` data-open-doc="${escapeHtml(task.doc)}" data-line="${task.line ?? 1}" role="button" tabindex="0"` : "";
    const agentChip = showAgent && task.agent ? renderAgentChip(task.agent) : "";
    const docChip = renderDocChip(task.doc, task.line);
    const toggle = renderTaskToggle(task, writebackEnabled, liveBridge);
    const note = task.thought && task.thought.trim() && task.thought.trim() !== task.text.trim()
      ? `<div class="task-note">${escapeHtml(task.thought)}</div>`
      : "";
    return `<div class="item ${priorityClass} ${clickable}"${openAttrs} title="${escapeHtml(task.text)}">
      <span class="bar"></span>
      ${toggle}
      ${renderConfidenceSigil(task.confidence)}
      <span class="item-num">${String(index + 1).padStart(2, "0")}</span>
      <span class="item-text">${escapeHtml(task.text)}</span>
      <span class="item-aside">${agentChip}${docChip}</span>
    </div>${note}`;
  }

function renderTaskToggle(
  task: Task,
  writebackEnabled: boolean,
  liveBridge?: SurfaceHtmlOptions["liveBridge"],
): string {
  const checked = (task as Task & { checked?: boolean }).checked === true;
  const canToggle = writebackEnabled && liveBridge === "desktop" && !!task.doc && typeof task.line === "number" && task.line > 0;
  const title = canToggle
    ? checked ? "Mark incomplete" : "Toggle checkbox"
    : writebackEnabled
      ? "Checkbox line unavailable"
      : "Write-back disabled";
  return `<button type="button" class="task-toggle ${canToggle ? "enabled" : "disabled"}" data-writeback-toggle data-doc="${escapeHtml(task.doc ?? "")}" data-line="${task.line ?? 1}" data-text="${escapeHtml(task.text)}" data-checked="${checked ? "true" : "false"}" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}"${canToggle ? "" : " disabled"}>${canToggle ? (checked ? "☑" : "☐") : "◌"}</button>`;
}

function renderAgentChip(agent: string): string {
  const key = agent.toLowerCase();
  const known: Record<string, string> = { codex: "CX", claude: "CL", gemini: "GM" };
  const label = known[key] ?? agent[0]?.toUpperCase() ?? "·";
  const cls = known[key] ? `agent-${key}` : "";
  return `<span class="chip ${cls}">${escapeHtml(label)}</span>`;
}

function renderDocChip(doc: string | undefined, line?: number): string {
  if (!doc) {
    return "";
  }
  const suffix = typeof line === "number" && line > 0 ? `:${line}` : "";
  return `<span class="chip doc">${escapeHtml(doc)}${escapeHtml(suffix)}</span>`;
}

function renderBlockedTile(tasks: BlockedTask[], writebackEnabled: boolean, liveBridge?: SurfaceHtmlOptions["liveBridge"]): string {
  const visibleTasks = tasks.filter((task) => !isNoneBlocker(task));
  return `<section class="tile tight" data-area="blocked">
    <div class="tile-header">
      <h3 class="tile-title blocked"><span class="accent-bar"></span>Blocked</h3>
      <span class="tile-meta">${visibleTasks.length}</span>
    </div>
    <div class="tile-body">
        ${visibleTasks.length === 0
          ? `<div class="item"><span class="bar"></span><span class="task-toggle disabled" aria-hidden="true">◌</span><span class="sigil"></span><span class="item-num">·</span><span class="item-text">No blockers right now</span><span class="item-aside"></span></div>`
          : visibleTasks.map((task, index) => `
            <div class="item p-blocked clickable"${task.doc ? ` data-open-doc="${escapeHtml(task.doc)}" data-line="${task.line ?? 1}" role="button" tabindex="0"` : ""} title="${escapeHtml(task.text)}">
              <span class="bar"></span>
              ${renderTaskToggle(task, writebackEnabled, liveBridge)}
              ${renderConfidenceSigil(task.confidence)}
              <span class="item-num">${String(index + 1).padStart(2, "0")}</span>
              <span class="item-text">${escapeHtml(task.text)}</span>
              <span class="item-aside">${renderDocChip(task.doc || task.since, task.line)}</span>
            </div>
            <div class="blocked-reason">↳ ${escapeHtml(task.reason)}</div>
            ${task.thought && task.thought.trim() && task.thought.trim() !== task.text.trim() ? `<div class="task-note">${escapeHtml(task.thought)}</div>` : ""}
          `).join("")}
      </div>
    </section>`;
  }

function isNoneBlocker(task: BlockedTask): boolean {
  const text = `${task.text} ${task.reason}`.replace(/\s+/g, " ").trim().toLowerCase();
  return text === "none none" || text === "none" || text === "blocked: none none" || /^none\b/.test(text);
}

function renderAgentDocsTile(state: QuestState): string {
  const agents = state.agents;
  return `<section class="tile" data-area="agents">
    <div class="tile-header">
      <h3 class="tile-title agents"><span class="accent-bar"></span>Agent Docs</h3>
      <span class="tile-meta">${agents.length}</span>
    </div>
  <div class="tile-body">
    ${agents.length === 0 ? `<div class="agent-doc-task">No agent docs discovered. Add AGENTS.md, CLAUDE.md, GEMINI.md, or CODEX.md when a repo needs explicit ownership.</div>` : `
      <div class="agent-doc-table">
        <div class="agent-doc-row head">
          <span>Document</span>
          <span>Status</span>
          <span>Declared role</span>
          <span>Last written task</span>
        </div>
        ${agents.map((agent) => `
          <div class="agent-doc-row">
            <span class="agent-doc-file"><span class="agent-health-rail ${agent.status === "archived" ? "reference" : agent.lastTask || agent.currentTask ? "" : "stale"}"></span>${escapeHtml(agent.file)}</span>
            <span class="agent-doc-status ${agent.status === "archived" ? "archived" : ""}">${escapeHtml(agent.status === "archived" ? "Reference" : "Active")}</span>
            <span class="agent-doc-role">${escapeHtml(agent.role || agent.area || "Unspecified")}</span>
            <span class="agent-doc-task">${escapeHtml(resolveAgentTask(agent, state.agentActivity) || agent.currentTask || agent.lastTask || agent.objective || "No task declared")}</span>
          </div>
        `).join("")}
      </div>
    `}
  </div>
  </section>`;
}

function renderDigestTile(state: QuestState, hasKey: boolean): string {
  const digestBtnDisabled = !hasKey ? ' title="Add OpenRouter key in Settings to enable"' : ' title="Run AI digest of current repo state"';
  return `<section class="tile tight" data-area="digest">
    <div class="tile-header">
      <h3 class="tile-title changes"><span class="accent-bar"></span>Digest</h3>
      <button class="digest-btn" data-ui-action="run-digest"${digestBtnDisabled}${!hasKey ? ' disabled' : ""}>Latest</button>
    </div>
    <div class="tile-body">
      ${state.lastDigest ? `
        <div class="digest-panel inline">
          <span class="digest-label">Last digest · ${digestAge(state.lastDigest.generatedAt)}</span>
          <p class="digest-summary">${escapeHtml(state.lastDigest.summary)}</p>
          <p class="digest-detail"><strong>Stuck:</strong> ${escapeHtml(state.lastDigest.stuck)}</p>
          <p class="digest-detail"><strong>Next:</strong> ${escapeHtml(state.lastDigest.next)}</p>
          <span class="digest-model">${escapeHtml(state.lastDigest.model)}</span>
        </div>
      ` : `
        <div class="digest-panel inline">
          <p class="digest-summary">${escapeHtml(buildDigestFallback(state))}</p>
          <p class="digest-detail">Outside scope: ${escapeHtml(state.workspaceSignals?.scopeActive ? String(state.workspaceSignals.scopeDriftCount) : "not declared")}</p>
          <p class="digest-detail">Recent activity: ${state.recentActivity?.length ?? 0} watcher events</p>
          <span class="digest-model">Add OpenRouter key in Settings for AI digest</span>
        </div>
      `}
    </div>
  </section>`;
}

function buildDigestFallback(state: QuestState): string {
  const now = state.now[0]?.text || "No current task set.";
  const change = state.recentChanges[0]?.file || state.recentActivity?.[0]?.file;
  if (change) {
    return `${now} Latest local change: ${change}.`;
  }
  return `${now} RepoLog is watching local activity.`;
}

function renderAgentAvatar(agent: AgentProfile): string {
  const key = agent.id.toLowerCase();
  const label = key.includes("claude") ? "AI" : key.includes("gemini") ? "✦" : key.includes("codex") ? "CX" : (agent.name.slice(0, 2).toUpperCase() || "AI");
  const cls = key.includes("claude") ? "claude" : key.includes("gemini") ? "gemini" : "";
  return `<span class="agent-avatar ${cls}" aria-hidden="true">${escapeHtml(label)}</span>`;
}

function renderAgentDocs(agent: AgentProfile, state: QuestState): string {
  const docs = uniqueStrings([
    state.activeQuest.doc,
    state.resumeNote.doc,
    agent.file,
    "AGENTS.md",
  ]).slice(0, 4);
  return docs.map((doc) => renderDocChip(doc, doc === state.activeQuest.doc ? state.activeQuest.line : undefined)).join("");
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractHealthLine(state: QuestState): string {
  const searchable = [
    state.mission,
    state.activeQuest.title,
    state.resumeNote.task,
    state.resumeNote.thought ?? "",
    ...state.now.map((task) => `${task.text} ${task.thought ?? ""}`),
    ...state.next.map((task) => `${task.text} ${task.thought ?? ""}`),
    ...state.decisions.map((decision) => decision.text),
  ].join(" ");
  const match = searchable.match(/\b(\d+\s+tests?\s+green)\b/i);
  return match?.[1] ?? `${state.scannedFiles.length} files watched`;
}

  function renderGitStrip(state: QuestState): string {
    const git = state.gitContext;
    if (!git) {
      return "";
    }

    const chips = [
      `<span class="git-chip branch">branch ${escapeHtml(git.branch)}</span>`,
      git.ahead > 0 ? `<span class="git-chip ahead">ahead ${git.ahead}</span>` : "",
      git.behind > 0 ? `<span class="git-chip behind">behind ${git.behind}</span>` : "",
      `<span class="git-chip dirty">dirty ${git.dirtyFiles}</span>`,
    ].filter(Boolean).join("");

    const commit = git.lastCommit
      ? `<span class="git-subject">${escapeHtml(git.lastCommit.subject)} <span class="git-sha">${escapeHtml(git.lastCommit.sha)}</span> · ${escapeHtml(git.lastCommit.at)}</span>`
      : `<span class="git-subject">No commits available</span>`;

    const health = extractHealthLine(state);

    return `<section class="git-strip" aria-label="Git context">${chips}${commit}<span class="git-health"><span class="ok-dot"></span>${escapeHtml(health)}<span style="color:var(--dim)">|</span><span>Workspace ${git.dirtyFiles > 0 ? "active" : "clean"}</span></span></section>`;
  }

function renderSettingsRack(state: QuestState, liveBridge?: SurfaceHtmlOptions["liveBridge"]): string {
  const writeback = state.config?.writeback ? "on" : "off";
  const openRepoButton = liveBridge === "desktop"
    ? `<button type="button" class="primary" data-ui-action="open-repo" title="Open a repo folder (Ctrl+O)">▭ Open Repo <span class="kbd-inline"><kbd>Ctrl</kbd><kbd>O</kbd></span></button>`
    : "";
  return `<section class="settings-rack" aria-label="Settings and shortcuts">
      <div class="settings-card">
        <div class="settings-head">Settings <span class="pill">${writeback}</span></div>
        <div class="settings-actions">
          <button type="button" data-ui-action="open-settings" title="Open the settings panel">⚙ Open Settings</button>
          ${openRepoButton}
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-head">Write-back <span class="pill">${writeback}</span></div>
        <div class="settings-actions">
          <button type="button" data-ui-action="writeback-status">▣ Write-back ${writeback}</button>
        </div>
        <div class="settings-copy">${state.config?.writeback ? "Checkbox toggles are live in the task rows." : "Off by default. Add <strong>\"writeback\": true</strong> to <strong>.repolog.json</strong> to enable checkbox-only edits."}</div>
        <div class="settings-copy">Only checklist items in <strong>Now</strong>, <strong>Next</strong>, and <strong>Blocked</strong> can be edited.</div>
      </div>
    </section>`;
}

function renderInfoIcon(text: string): string {
  return `<span class="card-info"><svg class="card-info-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg><span class="card-info-tip">${escapeHtml(text)}</span></span>`;
}

function renderSettingsPanel(state: QuestState, liveBridge: SurfaceHtmlOptions["liveBridge"] | undefined, handoffSettings: Required<HandoffSettings>): string {
  const wbStatus = state.config?.writeback ? "on" : "off";
  const promptDir = state.config?.prompts?.dir?.trim() || "~/.repolog/prompts";
  const hasPlan = state.scannedFiles.some((file) => /PLAN\.md$/i.test(file));
  const setupNeeded = !hasPlan;
  const configButton = liveBridge === "desktop"
    ? `<button type="button" data-ui-action="open-config">Open .repolog.json</button>`
    : "";
  const repoButton = liveBridge === "desktop"
    ? `<button type="button" data-ui-action="open-repo">Open Repo</button>`
    : "";
  const branch = state.branch?.trim() || "main";

  return `<div class="settings-overlay" data-settings-panel data-open="false" role="dialog" aria-label="Settings panel">
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div class="settings-panel-title"><strong>Settings</strong><span class="title-divider"></span><span>Repo Quest Log</span><span>·</span><span class="branch-link">${escapeHtml(branch)}</span></div>
        <button type="button" class="settings-panel-close" data-ui-action="close-settings" aria-label="Close settings">×</button>
      </div>
      <div class="settings-panel-body settings-layout-body">
        <div class="settings-panel-shell">
          <aside class="settings-sidebar" aria-label="Settings sections">
            <nav class="settings-nav">
              <button type="button" class="settings-nav-item active" data-settings-tab="overview" aria-pressed="true"><span class="settings-nav-icon">◇</span><span class="settings-nav-label">Overview<small>Analyze</small></span></button>
              <button type="button" class="settings-nav-item" data-settings-tab="repo" aria-pressed="false"><span class="settings-nav-icon">▣</span><span class="settings-nav-label">Repo config<small>Watcher and write-back</small></span></button>
              <button type="button" class="settings-nav-item" data-settings-tab="prompts" aria-pressed="false"><span class="settings-nav-icon">⌘</span><span class="settings-nav-label">Handoff<small>Agent copy</small></span></button>
              <span class="settings-sidebar-divider"></span>
              <button type="button" class="settings-nav-item" data-settings-tab="appearance" aria-pressed="false"><span class="settings-nav-icon">◐</span><span class="settings-nav-label">Appearance<small>Theme, density, font</small></span></button>
              <button type="button" class="settings-nav-item" data-settings-tab="digest" aria-pressed="false"><span class="settings-nav-icon">✦</span><span class="settings-nav-label">Digest<small>OpenRouter</small></span></button>
            </nav>
            <div class="settings-sidebar-status">
              <div><span class="status-dot"></span><strong>File watcher: Active</strong></div>
              <div>Last scan: ${escapeHtml(state.lastScan || "just now")}</div>
            </div>
          </aside>
          <main class="settings-main">
            <div class="settings-tuneup-wrap settings-section" data-settings-section="overview" data-tuneup-card>
              <div class="tuneup-card settings-hero">
                <div class="score-ring" aria-label="RepoLog legibility score">
                  <div><strong data-tuneup-score>92</strong><span>Legibility</span></div>
                </div>
                <div class="settings-hero-copy">
                  <span class="settings-kicker">Tune this repo</span>
                  <h2 class="settings-hero-title">Analyze whether this repo is ready to resume.</h2>
                  <p data-tuneup-placeholder>Run a local scan of the planning docs, then get the highest-impact fixes and a paste-ready repair prompt.</p>
                  <span class="settings-status-pill">Ready</span>
                  <div class="settings-hero-meta"><span>Last analyzed: just now</span><span>Source: PLAN.md, STATE.md</span></div>
                  <div class="tuneup-meter-wrap sr-only" data-tuneup-meter-wrap><div class="tuneup-meter"><div class="tuneup-meter-fill" data-tuneup-fill style="width:92%"></div></div></div>
                </div>
                <div class="settings-hero-actions">
                  <button type="button" class="settings-primary-button" data-tuneup-action="generate">Analyze repo</button>
                  <p class="settings-subtle-copy">No network call. This reads repo context locally and builds a repair prompt.</p>
                </div>
              </div>
              <div class="settings-card settings-tuneup-results" data-tuneup-results>
                <div class="settings-card-head compact"><h3 class="settings-card-title">Top fixes first</h3><span class="pill" data-tuneup-gap-count>0</span></div>
                <p class="settings-card-detail"><strong>Optional repo guide:</strong> RepoLog can create <code>.repolog/CHARTER.md</code>, a plain markdown guide for agents. It is not needed for switching repos, scanning, or daily use.</p>
                <div class="tuneup-gaps" data-tuneup-gaps aria-label="Top fixes"></div>
                <label class="tuneup-prompt-label" for="rql-tuneup-prompt">Generated repair prompt</label>
                <textarea id="rql-tuneup-prompt" class="tuneup-prompt-area" data-tuneup-prompt readonly aria-label="Generated repair prompt" spellcheck="false"></textarea>
                <div class="tuneup-actions" data-tuneup-actions hidden>
                  <button type="button" data-tuneup-action="copy">Copy repair prompt</button>
                  <button type="button" data-tuneup-action="write-charter" title="Writes .repolog/CHARTER.md in this repo">Create repo guide</button>
                  <button type="button" data-tuneup-action="preview-docs">Preview generated docs</button>
                  <button type="button" data-tuneup-action="apply-docs">Apply generated docs</button>
                  <button type="button" data-tuneup-action="preview-gaps">Hide fixes</button>
                  <span class="sep"></span>
                  <button type="button" data-tuneup-action="send-claude">→ Claude</button>
                  <button type="button" data-tuneup-action="send-codex">→ Codex</button>
                  <button type="button" data-tuneup-action="send-gemini">→ Gemini</button>
                </div>
              </div>
            </div>
            ${setupNeeded ? `
            <!-- <div class="settings-panel-card" data-setup-card> -->
            <div class="settings-panel-card settings-section" data-setup-card data-settings-section="repo">
              <div class="settings-card-head"><h3 class="settings-card-title">Setup <span class="pill">first run</span></h3></div>
              <p class="settings-card-detail">Welcome to RepoLog: a calm memory layer for repos using AI agents.</p>
              <pre class="settings-panel-report" data-doctor-report data-visible="false"></pre>
              <div class="settings-card-actions">
                <button type="button" data-ui-action="init-plan" class="primary">Create PLAN.md</button>
                <button type="button" data-ui-action="init-state">Create STATE.md</button>
                <button type="button" data-ui-action="init-config">Create .repolog.json</button>
                <button type="button" data-ui-action="run-doctor-again" data-run-doctor-again hidden>Run Doctor Again?</button>
                <button type="button" data-ui-action="dismiss-wizard">Skip for now</button>
              </div>
            </div>` : ""}
            <div class="settings-core settings-section" data-settings-section="repo">
              <section class="settings-card settings-config-card" data-settings-section="repo">
                <div class="settings-card-head">
                  <h3 class="settings-card-title">Repo config <span class="pill">write-back ${wbStatus}</span></h3>
                  ${renderInfoIcon("Save repo config writes .repolog.json in this repo. Appearance, window state, last-opened repo, digest cache, and OpenRouter key stay in app storage.")}
                </div>
                <p class="settings-card-detail">These settings are repo-local. Saving creates or updates <code>.repolog.json</code> so this repo can keep its excludes, watcher behavior, and write-back preference.</p>
                <div class="settings-write-note" aria-label="Settings write locations">
                  <span><strong>Writes .repolog.json in this repo.</strong><code>excludes, watcher, write-back</code></span>
                  <span><strong>App-only settings stay outside the repo.</strong><code>theme, scale, startup root, API key</code></span>
                </div>
                <div class="settings-panel-report" data-config-error data-visible="false"></div>
                <div class="settings-config" data-config-form>
                  <div class="field span-2">
                    <label for="rql-config-excludes">Excludes</label>
                    <textarea id="rql-config-excludes" data-config-field="excludes" spellcheck="false">${escapeHtml((state.config?.excludes ?? []).join("\n"))}</textarea>
                  </div>
                  <div class="field">
                    <label for="rql-config-debounce">Watch debounce</label>
                    <div class="input-with-unit">
                      <input id="rql-config-debounce" data-config-field="watchDebounce" type="number" min="100" max="10000" step="50" value="${String(state.config?.watch?.debounce ?? 500)}" />
                      <span class="input-unit">ms</span>
                    </div>
                  </div>
                  <div class="field settings-switch-column">
                    <div class="toggle-row">
                      <label class="settings-switch-field">
                        <span><strong>Write-back</strong><span>Allow checkbox-only task edits in source markdown.</span></span>
                        <input data-config-field="writeback" type="checkbox"${state.config?.writeback ? " checked" : ""} />
                      </label>
                      <label class="settings-switch-field">
                        <span><strong>Report file changes</strong><span>Surface watcher updates in the Recent changes panel.</span></span>
                        <input data-config-field="reportFileChanges" type="checkbox"${state.config?.watch?.reportFileChanges !== false ? " checked" : ""} />
                      </label>
                    </div>
                  </div>
                </div>
              </section>
              <section class="settings-card settings-utility-card">
                <div class="settings-card-head"><h3 class="settings-card-title">Startup and files</h3>${renderInfoIcon("Remember opens this repo automatically on next launch. Open config edits this repo's .repolog.json.")}</div>
                <div class="settings-card-actions">
                  <button type="button" data-ui-action="remember-startup-root">Remember startup root</button>
                  <button type="button" data-ui-action="forget-startup-root">Forget startup root</button>
                  ${configButton}${repoButton}
                </div>
              </section>
            </div>
            <section class="settings-card settings-config-card settings-section" data-settings-section="prompts">
              <div class="settings-card-head">
                <h3 class="settings-card-title">Agent Handoff</h3>
                ${renderInfoIcon("App-level handoff settings stay outside the repo. Prompt files in this folder still appear in the Ctrl+K handoff palette.")}
              </div>
              <p class="settings-card-detail">Configure what RepoLog includes when you copy an agent handoff. This stays in app storage, not in this repo.</p>
              <div class="field span-2">
                <label for="rql-handoff-guide">Personal Agent Guide</label>
                <textarea id="rql-handoff-guide" class="handoff-guide-area" data-handoff-field="personalAgentGuide" placeholder="Paste your reusable agent instructions here. Example: think before coding, keep changes surgical, state assumptions, verify before handoff." spellcheck="false">${escapeHtml(handoffSettings.personalAgentGuide)}</textarea>
                <p class="handoff-setting-note">Included only when the Personal Agent Guide checkbox is enabled.</p>
              </div>
              <div class="settings-card-actions theme-picker">
                <label class="handoff-source"><input type="checkbox" data-handoff-field="includePersonalGuideDefault"${handoffSettings.includePersonalGuideDefault ? " checked" : ""} />Include Personal Agent Guide</label>
                <label class="handoff-source"><input type="checkbox" data-handoff-field="includeRepoAgentDocsDefault"${handoffSettings.includeRepoAgentDocsDefault ? " checked" : ""} />Include repo agent docs</label>
                <label class="handoff-source"><input type="checkbox" data-handoff-field="includeRecentActivityDefault"${handoffSettings.includeRecentActivityDefault ? " checked" : ""} />Include recent activity</label>
              </div>
              <div class="settings-config single-column" data-config-form>
                <div class="field span-2">
                  <label for="rql-config-prompts">Prompts dir</label>
                  <div class="input-with-action">
                    <input id="rql-config-prompts" data-config-field="promptsDir" type="text" value="${escapeHtml(promptDir)}" />
                    <button type="button" class="settings-icon-button" data-ui-action="open-repo" aria-label="Open repo">▭</button>
                  </div>
                </div>
              </div>
              <div class="settings-card-actions">
                <button type="button" data-ui-action="save-handoff-settings">Save Agent Handoff</button>
                <button type="button" data-ui-action="standup-export">Copy standup <span class="kbd-inline"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>C</kbd></span></button>
              </div>
            </section>
            <section class="settings-card settings-digest-card settings-section" data-settings-section="digest" data-card="openrouter">
                <div class="settings-card-head">
                  <h3 class="settings-card-title">Digest <span class="pill">optional AI</span></h3>
                  ${renderInfoIcon("Powers the Digest button. Key is stored locally in the desktop shell, never in the repo.")}
                </div>
              <p class="settings-card-detail">Digest summarizes the current repo state with your OpenRouter key. It is optional: the HUD, signals, and Agent Handoff work without it.</p>
                <div class="field">
                  <label>API Key</label>
                  <div class="settings-secret-row">
                    <input type="password" data-or-field="key" placeholder="sk-or-..." autocomplete="off" spellcheck="false" />
                    <button type="button" class="settings-icon-button" aria-label="Reveal API key">◉</button>
                  </div>
                  <span data-or-status style="font-size:var(--tiny-size);color:var(--ok);display:block;margin-top:3px"></span>
                </div>
                <div class="field">
                  <label>Model</label>
                  <select data-or-field="model">
                    <option value="deepseek/deepseek-r1:free">DeepSeek R1 (free) - reasoning</option>
                    <option value="deepseek/deepseek-chat-v3-0324:free">DeepSeek V3 (free) - fast &amp; capable</option>
                    <option value="nvidia/nemotron-3-super-120b-a12b:free">Nemotron 3 Super 120B (free)</option>
                    <option value="google/gemma-3-27b-it:free">Gemma 3 27B (free)</option>
                    <option value="meta-llama/llama-4-scout:free">Llama 4 Scout (free)</option>
                    <option value="qwen/qwen3-14b:free">Qwen3 14B (free)</option>
                    <option value="qwen/qwen3-235b-a22b:free">Qwen3 235B (free) - large</option>
                  </select>
                  <p class="settings-subtle-copy">Free OpenRouter models usually have small daily limits. Add credits on OpenRouter for higher limits; RepoLog never stores the key in the repo.</p>
                </div>
                <div class="settings-card-actions">
                  <button type="button" data-ui-action="save-openrouter">Save</button>
                </div>
              </section>
            <div class="settings-utility-grid settings-section" data-settings-section="appearance">
              <section class="settings-card settings-utility-card">
                <div class="settings-card-head"><h3 class="settings-card-title">Appearance</h3></div>
                <div class="settings-card-actions theme-picker">
                  <button type="button" data-ui-theme="dark" aria-pressed="false"><span class="theme-swatch" style="background:#0b0d10;border-color:#8ab4ff"></span>Dark</button>
                  <button type="button" data-ui-theme="light" aria-pressed="false"><span class="theme-swatch" style="background:#f4f5f7;border-color:#0a5fd6"></span>Light</button>
                  <button type="button" data-ui-font="system" aria-pressed="true">System</button>
                  <button type="button" data-ui-font="mono" aria-pressed="false">Mono</button>
                  <button type="button" data-ui-font="serif" aria-pressed="false">Serif</button>
                </div>
              </section>
              <section class="settings-card settings-utility-card">
                <div class="settings-card-head"><h3 class="settings-card-title">Density</h3>${renderInfoIcon("Controls spacing and font size. Wide gives more breathing room; compact fits more on screen.")}</div>
                <div class="settings-card-actions">
                  <button type="button" data-ui-density="cozy" aria-pressed="false">Cozy</button>
                  <button type="button" data-ui-density="wide" aria-pressed="false">Wide</button>
                  <button type="button" data-ui-density="compact" aria-pressed="false">Compact</button>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
      <div class="settings-panel-footer">
        <span class="sr-only">Ctrl+O Ctrl+K Ctrl+Shift+C Prompt dir Save repo config Startup Theme</span>
        <span class="keyboard-hint"><kbd>Ctrl+S</kbd> Save repo config</span>
        <span class="keyboard-hint"><kbd>Esc</kbd> Close</span>
        <span class="keyboard-hint"><kbd>Ctrl+R</kbd> Analyze repo</span>
        <span class="footer-spacer"></span>
        <button type="button" class="settings-footer-save" data-ui-action="save-config">Save repo config<span class="sr-only">Writes .repolog.json in this repo</span></button>
      </div>
    </section>
  </div>`;


}

function renderWorkspaceSignalsStrip(state: QuestState): string {
  const data = state.workspaceSignals ?? {
    state: "Quiet",
    editRate: 0,
    filesTouched: 0,
    lastEditAge: "no activity",
    scopeDriftCount: 0,
    thrashLevel: "None",
    repeatedFiles: [],
    trend: Array.from({ length: 30 }, () => 0),
    timelineWindows: defaultTimelineWindows(),
    scopeActive: false,
  } satisfies WorkspaceSignals;
  const resolvedMode = resolveWorkspaceMode(data, state);
  const activeLine = workspaceModeEvidence(resolvedMode, data, state);
  const latestFile = state.recentActivity?.[0]?.file ?? state.recentChanges[0]?.file ?? "none";
  const trend = data.trend.length ? data.trend : timelineFromTrend(data.trend).find((window) => window.minutes === 30)?.buckets ?? [];
  const scopeValue = data.scopeActive ? String(data.scopeDriftCount) : "off";
  const scopeNote = data.scopeActive ? "outside declared scope" : "no declared areas";
  const churnNote = data.repeatedFiles[0] ?? latestFile;
  const editSpark = data.trend.slice(-12);

  return `<section class="signals-strip" aria-label="Workspace Signals">
    <div class="signals-head">
      <div class="signals-title">Workspace Signals</div>
      <button type="button" class="signals-help" data-palette-open>What's this?</button>
    </div>
    <div class="signals-grid">
      <div class="signal-cell signal-overview">
        <span class="signal-wave" aria-hidden="true">${renderSignalWave()}</span>
        <div>
          <div class="signal-label">Repo active</div>
          <div class="signal-value${resolvedMode === "Idle" ? " warn" : ""}">${escapeHtml(resolvedMode)}</div>
          <div class="signal-note">${escapeHtml(data.state)} · ${escapeHtml(activeLine)}</div>
          <span class="sr-only">${escapeHtml(`${resolvedMode} inferred from watcher and Git evidence`)}</span>
        </div>
      </div>
      <div class="signal-cell">
        <div class="signal-label">Edits/min</div>
        <div><span class="signal-number">${data.editRate}</span>${renderSignalSpark(editSpark)}<span class="signal-unit">(5m avg)</span></div>
      </div>
      <div class="signal-cell">
        <div class="signal-label">Files touched</div>
        <div><span class="signal-number">${data.filesTouched}</span><span class="signal-unit">(last 10m)</span></div>
      </div>
      <div class="signal-cell">
        <div class="signal-label">Last edit</div>
        <div class="signal-value">${escapeHtml(data.lastEditAge)}</div>
      </div>
      <div class="signal-cell">
        <div class="signal-label">Scope drift</div>
        <div class="signal-number${data.scopeActive && data.scopeDriftCount > 0 ? " warn" : ""}">${escapeHtml(scopeValue)}</div>
        <div class="signal-note">${escapeHtml(scopeNote)}</div>
      </div>
      <div class="signal-cell">
        <div class="signal-label">Thrash</div>
        <div class="signal-value${data.thrashLevel !== "None" ? " warn" : ""}">${escapeHtml(data.thrashLevel)}</div>
        <div class="signal-note">${escapeHtml(churnNote)}</div>
      </div>
      <div class="signal-cell">
        <div class="signal-label">Signal trend (30m)</div>
        <div class="signal-trend-wrap">
          ${renderSignalTrend(trend)}
          <span class="signal-chevron" aria-hidden="true">›</span>
        </div>
      </div>
    </div>
  </section>`;
}

function resolveWorkspaceMode(signals: WorkspaceSignals, state: QuestState): WorkspaceMode {
  if (signals.editRate > 0) {
    return "Building";
  }

  if ((state.gitContext?.dirtyFiles ?? 0) > 0) {
    return "Reviewing";
  }

  if (hasFreshDocContextActivity(state)) {
    return "Researching";
  }

  if (hasRecentWorkspaceActivity(state)) {
    return "Building";
  }

  return "Idle";
}

function hasRecentWorkspaceActivity(state: QuestState): boolean {
  const cutoff = Date.now() - 90_000;
  return (state.recentActivity ?? []).some((event) => Number.isFinite(event.ts) && event.ts >= cutoff);
}

function hasFreshDocContextActivity(state: QuestState): boolean {
  if ((state.workspaceSignals?.editRate ?? 0) > 0 || (state.gitContext?.dirtyFiles ?? 0) > 0) {
    return false;
  }
  const cutoff = Date.now() - 90_000;
  return (state.recentActivity ?? []).some((event) =>
    Number.isFinite(event.ts) &&
    event.ts >= cutoff &&
    isAgentContextFile(event.file)
  );
}

function isAgentContextFile(file: string): boolean {
  const normalized = file.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  return normalized === "agents.md" ||
    normalized === "plan.md" ||
    normalized === "state.md" ||
    normalized === "claude.md" ||
    normalized === "gemini.md" ||
    normalized === "codex.md";
}

function workspaceModeEvidence(mode: WorkspaceMode, signals: WorkspaceSignals, state: QuestState): string {
  const latestFile = state.recentActivity?.[0]?.file ?? state.recentChanges[0]?.file;
  if (mode === "Building") {
    return signals.filesTouched > 0
      ? `Agent work is changing ${signals.filesTouched} file${signals.filesTouched === 1 ? "" : "s"} at ${signals.editRate} edits/min.`
      : "Ready for implementation; no file edits have landed in this activity window.";
  }
  if (mode === "Reviewing") {
    const dirtyFiles = state.gitContext?.dirtyFiles ?? state.recentChanges.length;
    return dirtyFiles > 0
      ? `Reviewing ${dirtyFiles} changed file${dirtyFiles === 1 ? "" : "s"}; open a Diff from Recent changes.`
      : "Reviewing is inferred, but there are no changed files to inspect yet.";
  }
  if (mode === "Researching") {
    return latestFile
      ? `Researching context around ${latestFile}; file activity is only shown when it happens.`
      : "Researching is inferred from task context before edits.";
  }
  return signals.lastEditAge === "no activity"
    ? "No active agent work yet."
    : `Idle now; last file activity was ${signals.lastEditAge}.`;
}

function renderSignalWave(): string {
  return `<svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
    <path d="M3 24h5l3-9 5 22 6-30 5 17h4l3-8 4 8h3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;
}

function renderSignalSpark(values: readonly number[]): string {
  const buckets = values.length ? values : Array.from({ length: 12 }, () => 0);
  const max = Math.max(1, ...buckets);
  return `<span class="signal-spark" aria-hidden="true">${buckets.map((value) => {
    const height = value > 0 ? Math.max(5, Math.round((value / max) * 17)) : 4;
    return `<span style="height:${height}px"></span>`;
  }).join("")}</span>`;
}

function renderSignalTrend(values: readonly number[]): string {
  const buckets = values.length ? values.slice(-30) : Array.from({ length: 30 }, () => 0);
  const max = Math.max(1, ...buckets);
  return `<div class="signal-trend" aria-hidden="true">${buckets.map((value, index) => {
    const height = value > 0 ? Math.max(6, Math.round((value / max) * 28)) : 7;
    const hotIndex = index >= buckets.length - 6;
    const classes = value === 0 ? "quiet" : hotIndex && value >= max ? "hot" : hotIndex ? "warn" : "";
    return `<span class="${classes}" style="height:${height}px"></span>`;
  }).join("")}</div>`;
}

function renderTimeline(windows: readonly WorkspaceTimelineWindow[]): string {
  const ordered = [5, 15, 30].map((minutes) => windows.find((window) => window.minutes === minutes)).filter((window): window is WorkspaceTimelineWindow => !!window);
  const defaultWindow = ordered.find((window) => window.minutes === 15) ?? ordered[0] ?? defaultTimelineWindows()[1]!;
  return `<div class="timeline-panel" data-timeline>
    <span class="timeline-summary" data-timeline-summary>${escapeHtml(timelineSummary(defaultWindow))}</span>
    <div class="timeline-tabs" aria-label="Activity timeline window">
      ${ordered.map((window) => `<button type="button" data-timeline-window="${window.minutes}" aria-pressed="${window.minutes === defaultWindow.minutes ? "true" : "false"}">${window.minutes}m</button>`).join("")}
    </div>
    ${ordered.map((window) => renderTimelineWindow(window, window.minutes === defaultWindow.minutes)).join("")}
  </div>`;
}

function renderTimelineWindow(window: WorkspaceTimelineWindow, visible: boolean): string {
  const max = Math.max(1, ...window.buckets);
  const activeIndexes = window.buckets.map((value, index) => value > 0 ? index : -1).filter((index) => index >= 0);
  const latestActive = activeIndexes[activeIndexes.length - 1];
  const bars = window.buckets.map((value, index) => {
    const height = value > 0 ? Math.max(4, Math.round((value / max) * 24)) : 3;
    const classes = [
      "timeline-bucket",
      value > 0 ? "active" : "",
      value >= max && value > 0 ? "hot" : "",
      index === latestActive ? "latest pulse" : "",
    ].filter(Boolean).join(" ");
    return `<span class="${classes}" style="height:${height}px" title="${value} event${value === 1 ? "" : "s"}"></span>`;
  }).join("");
  const isEmpty = window.buckets.every((value) => value === 0);
  return `<div class="timeline-window" data-timeline-panel="${window.minutes}" data-visible="${visible ? "true" : "false"}" data-summary="${escapeHtml(timelineSummary(window))}">
    ${isEmpty ? `<div class="timeline-empty">No file activity in this window.</div>` : `<div class="timeline-bars">${bars}</div>`}
  </div>`;
}

function timelineSummary(window: WorkspaceTimelineWindow): string {
  if (window.intensity === "Quiet") {
    return `${window.minutes}m window: Quiet`;
  }
  return `${window.minutes}m window: ${window.intensity} · latest ${window.latestFile ?? "workspace"} ${window.latestAge}`;
}

function defaultTimelineWindows(): WorkspaceTimelineWindow[] {
  return [5, 15, 30].map((minutes) => ({
    minutes: minutes as 5 | 15 | 30,
    buckets: Array.from({ length: minutes === 5 ? 10 : minutes }, () => 0),
    latestAge: "no activity",
    intensity: "Quiet",
  }));
}

function timelineFromTrend(trend: readonly number[]): WorkspaceTimelineWindow[] {
  const thirty = {
    minutes: 30 as const,
    buckets: [...trend],
    latestAge: "no activity",
    intensity: trend.some((value) => value > 0) ? "Active" as const : "Quiet" as const,
  };
  return [
    { minutes: 5, buckets: trend.slice(-5), latestAge: thirty.latestAge, intensity: thirty.intensity },
    { minutes: 15, buckets: trend.slice(-15), latestAge: thirty.latestAge, intensity: thirty.intensity },
    thirty,
  ];
}

function renderRecentActivityTile(activity: readonly RecentActivityEvent[]): string {
  const rows = activity.slice(0, 8);
  return `<section class="tile tight" data-area="activity">
    <div class="tile-header">
      <h3 class="tile-title changes"><span class="accent-bar"></span>Recent Activity</h3>
      <div class="activity-toolbar">
        <span class="activity-live"><span class="dot"></span>Live</span>
        <button type="button" class="activity-control" disabled>Pause</button>
        <button type="button" class="activity-control" disabled>Filters⌄</button>
      </div>
    </div>
    <div class="tile-body activity-ledger" data-activity-ledger>
      <div class="activity-head" aria-hidden="true">
        <span>File</span>
        <span>Event</span>
        <span>Age</span>
        <span></span>
        <span></span>
      </div>
      ${rows.length === 0
        ? `<div class="activity-rows"><div class="activity-row"><span class="activity-file">No workspace activity yet</span><span class="activity-kind">none</span><span class="activity-age"></span><span class="activity-scope"></span><span></span></div></div>`
        : `<div class="activity-rows">${rows.map((event) => `
          <div class="activity-row">
            <span class="activity-file${event.outsideScope ? " outside" : ""}">${escapeHtml(event.file)}</span>
            <span class="activity-kind event-badge">${escapeHtml(activityEventLabel(event.kind))}</span>
            <span class="activity-age">${escapeHtml(formatActivityAge(event.ts))}</span>
            <span class="activity-scope${event.outsideScope ? " outside" : ""}">${event.outsideScope ? "Outside scope" : ""}</span>
            <button type="button" class="diff-action" data-ui-action="open-diff" data-diff-file="${escapeHtml(event.file)}">Diff</button>
          </div>
        `).join("")}</div>`}
      <div class="activity-footer">
        <span>Watching local workspace</span>
        <span>${activity.length} event${activity.length === 1 ? "" : "s"} shown</span>
      </div>
    </div>
  </section>`;
}

function activityEventLabel(kind: RecentActivityEvent["kind"]): string {
  if (kind === "add") return "add";
  if (kind === "unlink") return "unlink";
  return "modify";
}

function renderScopeMapTile(activity: readonly RecentActivityEvent[]): string {
  const lanes = buildScopeLanes(activity);
  const max = Math.max(1, ...lanes.map((lane) => lane.count));
  return `<section class="tile tight" data-area="scope-map">
    <div class="tile-header">
      <h3 class="tile-title changes"><span class="accent-bar"></span>Scope map</h3>
      <span class="tile-meta">${lanes.reduce((sum, lane) => sum + lane.count, 0)}</span>
    </div>
    <div class="tile-body scope-map">
      ${lanes.length === 0 ? `<div class="activity-row"><span class="activity-kind">none</span><span class="activity-file">No scoped activity yet</span><span></span><span></span></div>` : lanes.map((lane) => `
        <div class="scope-lane${lane.outside ? " outside" : ""}">
          <span class="scope-lane-label">${escapeHtml(lane.label)}</span>
          <span class="scope-lane-track"><span class="scope-lane-fill" style="width:${Math.max(8, Math.round((lane.count / max) * 100))}%"></span></span>
          <span class="scope-lane-count">${lane.count}</span>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function buildScopeLanes(activity: readonly RecentActivityEvent[]): Array<{ label: string; count: number; outside: boolean }> {
  const lanes = new Map<string, { label: string; count: number; outside: boolean }>();
  for (const event of activity) {
    const label = scopeLaneLabel(event.file);
    const existing = lanes.get(label) ?? { label, count: 0, outside: false };
    existing.count += 1;
    existing.outside = existing.outside || !!event.outsideScope;
    lanes.set(label, existing);
  }

  return [...lanes.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 6);
}

function scopeLaneLabel(file: string): string {
  const normalized = file.replace(/\\/g, "/");
  if (/^docs?\//i.test(normalized) || /\.md$/i.test(normalized)) return "docs";
  if (/^tests?\//i.test(normalized) || /\.test\./i.test(normalized)) return "tests";
  if (/^src\/([^/]+)/i.test(normalized)) return normalized.split("/").slice(0, 2).join("/");
  if (/package\.json|tsconfig|vite|eslint|postcss|tailwind/i.test(normalized)) return "config";
  return normalized.split("/")[0] || "root";
}

function renderAgentHandoffTile(state: QuestState, presets: readonly PromptPreset[], settings: Required<HandoffSettings>): string {
  const rows = presets.filter((preset) => preset.id !== "standup").slice(0, 3);
  const providers = settings.providers.filter((provider) => provider.enabled !== false).slice(0, 4);
  return `<section class="tile tight" data-area="prompts">
    <div class="tile-header">
      <h3 class="tile-title changes"><span class="accent-bar"></span>Agent Handoff</h3>
      <button type="button" class="strip-link" data-palette-open>See all</button>
    </div>
    <div class="tile-body">
      <div class="handoff-controls">
        <div class="handoff-provider-row" aria-label="Provider copy targets">
          ${providers.map((provider) => `
            <button type="button" class="handoff-provider" data-handoff-provider="${escapeHtml(provider.id)}" aria-pressed="${provider.id === settings.lastProviderId ? "true" : "false"}">
              ${renderProviderIcon(provider)}
              <span>${escapeHtml(provider.label)}</span>
            </button>
          `).join("")}
        </div>
        <div class="handoff-source-row" aria-label="Instruction sources">
          ${renderHandoffSource("personal-agent-guide", "Personal Agent Guide", settings.includePersonalGuideDefault)}
          ${renderHandoffSource("repo-agent-docs", "Repo agent docs", settings.includeRepoAgentDocsDefault)}
          ${renderHandoffSource("recent-activity", "Recent activity", settings.includeRecentActivityDefault)}
          <button type="button" class="handoff-guide-link" data-ui-action="open-handoff-settings">Settings</button>
        </div>
      </div>
      ${rows.map((preset) => `
        <div class="prompt-row handoff-intent-row" data-handoff-intent="${escapeHtml(preset.intentId ?? preset.id)}" data-selected="${(preset.intentId ?? preset.id) === settings.lastIntentId ? "true" : "false"}">
          <span>
            <span class="prompt-label">${escapeHtml(preset.label)}</span>
            <span class="prompt-sub">${escapeHtml(preset.sub)}</span>
          </span>
          <button type="button" class="prompt-copy" data-copy-context="${escapeHtml(preset.body)}"${handoffContextMapAttribute(state, preset, settings)} aria-label="Copy ${escapeHtml(preset.label)} prompt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function renderHandoffSource(id: string, label: string, checked: boolean): string {
  return `<label class="handoff-source"><input type="checkbox" data-handoff-source="${escapeHtml(id)}"${checked ? " checked" : ""} />${escapeHtml(label)}</label>`;
}

function handoffContextMapAttribute(state: QuestState, preset: PromptPreset, settings: Required<HandoffSettings>): string {
  if (preset.source && preset.source !== "builtin") {
    return "";
  }
  return ` data-copy-context-map="${escapeHtml(JSON.stringify(handoffContextMap(state, preset.id, settings)))}"`;
}

function handoffContextMap(state: QuestState, presetId: string, settings: Required<HandoffSettings>): Record<string, string> {
  const sources = ["personal-agent-guide", "repo-agent-docs", "recent-activity"];
  const variants: Record<string, string> = {};
  for (let mask = 0; mask < 8; mask += 1) {
    const selected = sources.filter((_, index) => (mask & (1 << index)) !== 0);
    const preset = buildPromptPresets(state, {
      ...settings,
      instructionSourceSelection: selected,
      includePersonalGuideDefault: selected.includes("personal-agent-guide"),
      includeRepoAgentDocsDefault: selected.includes("repo-agent-docs"),
      includeRecentActivityDefault: selected.includes("recent-activity"),
    }).find((candidate) => candidate.id === presetId);
    variants[selected.join("|")] = preset?.body ?? "";
  }
  return variants;
}

function renderProviderIcon(provider: HandoffProviderProfile): string {
  const icon = provider.icon === "anthropic" ? "anthropic" : provider.icon === "openai" ? "openai" : provider.icon === "gemini" ? "gemini" : "custom";
  return `<span class="prompt-glyph ${icon}" aria-hidden="true">${promptProviderSvg(icon, "")}</span>`;
}

type PromptProvider = "claude" | "anthropic" | "openai" | "gemini" | "custom";

function renderPromptIcon(preset: PromptPreset): string {
  const provider = promptProvider(preset);
  return `<span class="prompt-glyph ${provider}" aria-hidden="true">${promptProviderSvg(provider, preset.glyph)}</span>`;
}

function promptProvider(preset: PromptPreset): PromptProvider {
  const text = `${preset.id} ${preset.label} ${preset.sub} ${preset.keywords}`.toLowerCase();
  if (text.includes("claude")) return "claude";
  if (text.includes("anthropic")) return "anthropic";
  if (text.includes("codex") || text.includes("openai")) return "openai";
  if (text.includes("gemini") || text.includes("google")) return "gemini";
  return "custom";
}

function promptProviderSvg(provider: PromptProvider, fallbackGlyph: string): string {
  if (provider === "claude") {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"></path>
    </svg>`;
  }
  if (provider === "anthropic") {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"></path>
    </svg>`;
  }
  if (provider === "openai") {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"></path>
    </svg>`;
  }
  if (provider === "gemini") {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"></path>
    </svg>`;
  }
  if (provider === "custom") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 7H7a5 5 0 0 0 0 10h2"></path>
      <path d="M15 7h2a5 5 0 0 1 0 10h-2"></path>
      <path d="M8 12h8"></path>
    </svg>`;
  }
  return escapeHtml(fallbackGlyph || "*");
}

function renderRepoContextTile(state: QuestState): string {
  const context = state.repoContext;
  const readiness = state.readiness;
  const repoType = context?.repoType ?? "unknown";
  const manifest = context?.manifestType
    ? `${context.manifestType}${context.packageName ? ` / ${context.packageName}` : ""}${context.packageVersion ? ` v${context.packageVersion}` : ""}`
    : "No package manifest found";
  const summary = context?.packageDescription || summarizeReadme(context?.readmePreview) || state.mission || "RepoLog can show local repo activity while planning docs are added.";
  const git = state.gitContext
    ? `${state.gitContext.branch} / ${state.gitContext.dirtyFiles} dirty file${state.gitContext.dirtyFiles === 1 ? "" : "s"}`
    : context?.recentCommits[0] ?? "Git status unavailable";
  const docs = context?.docsFound.length ? context.docsFound.slice(0, 8) : state.scannedFiles.slice(0, 8);
  const source = context?.sourceTree.slice(0, 5).join(" / ") || "No source tree summary found.";
  const scanned = new Set(state.scannedFiles.map((file) => file.split(/[\\/]/).pop()?.toLowerCase() ?? file.toLowerCase()));
  const missingDocs = ["PLAN.md", "STATE.md", "AGENTS.md"].filter((file) => !scanned.has(file.toLowerCase()));
  const docsHtml = docs.length
    ? docs.map((file) => `<span>${escapeHtml(file)}</span>`).join("")
    : `<span class="missing">No docs found</span>`;
  const missingText = missingDocs.length ? missingDocs.join(", ") : "None";
  const helpCopy = readiness && readiness.agentReadinessScore < 70
    ? `${readiness.summary} Add planning docs when you want better resume prompts.`
    : "RepoLog has enough planning structure for daily resume prompts.";

  return `<section class="tile tight repo-context-card" data-area="repo-context">
    <div class="tile-header">
      <h3 class="tile-title"><span class="accent-bar"></span>Repo Context</h3>
      <span class="tile-meta">${escapeHtml(repoType)}</span>
    </div>
    <div class="tile-body repo-context-card">
      <p class="repo-context-summary">${escapeHtml(summary)}</p>
      <div class="repo-context-grid">
        <div class="repo-context-row"><span>Manifest</span><code>${escapeHtml(manifest)}</code></div>
        <div class="repo-context-row"><span>Git</span><code>${escapeHtml(git)}</code></div>
        <div class="repo-context-row"><span>Missing</span><code>${escapeHtml(missingText)}</code></div>
        <div class="repo-context-row"><span>Source</span><code>${escapeHtml(source)}</code></div>
      </div>
      ${renderReadinessMeters(readiness)}
      <div class="onboarding-docs" aria-label="Detected docs">${docsHtml}</div>
      <p class="repo-context-summary">${escapeHtml(helpCopy)}</p>
      <div class="repo-context-actions">
        <button type="button" class="primary" data-tuneup-action="generate" data-tuneup-complete-label="Refresh setup prompt" data-tuneup-fallback-label="Generate setup prompt">Generate setup prompt</button>
        <button type="button" data-tuneup-action="copy">Copy prompt</button>
        <button type="button" data-tuneup-action="preview-docs">Preview docs</button>
        <button type="button" data-tuneup-action="apply-docs">Write docs</button>
      </div>
      <textarea class="repo-context-preview" data-onboarding-prompt readonly hidden aria-label="Generated setup prompt"></textarea>
    </div>
  </section>`;
}

function renderReadinessMeters(readiness: QuestState["readiness"]): string {
  if (!readiness) {
    return "";
  }

  const meters = [
    ["Structure", readiness.repoLogStructureScore],
    ["Context", readiness.contextUsefulnessScore],
    ["Agent ready", readiness.agentReadinessScore],
  ] as const;

  return `<div class="readiness-meters" aria-label="Repo readiness">
    ${meters.map(([label, score]) => {
      const severity = score < 50 ? "danger" : score < 70 ? "warn" : "";
      return `<div class="readiness-meter">
        <div class="readiness-meter-head"><span>${escapeHtml(label)}</span><span>${score}</span></div>
        <div class="readiness-track"><span class="readiness-fill ${severity}" style="width:${Math.max(0, Math.min(100, score))}%"></span></div>
      </div>`;
    }).join("")}
  </div>`;
}

function renderDecisionsTile(decisions: Decision[] | undefined): string {
  if (!decisions || decisions.length === 0) return "";
  const visible = decisions.slice(0, 5);
  const hidden = decisions.slice(5);
  const hiddenRows = hidden.map((d) => renderDecisionRow(d, true)).join("");
  return `<section class="tile tight" data-area="decisions" data-decisions-expanded="false">
    <div class="tile-header">
      <h3 class="tile-title changes"><span class="accent-bar"></span>Decisions</h3>
      <span class="tile-meta">${decisions.length}</span>
    </div>
    <div class="tile-body">
      ${visible.map((d) => renderDecisionRow(d, false)).join("")}
      ${hidden.length > 0 ? `<div class="decision-hidden" data-decisions-hidden hidden>${hiddenRows}</div>
      <button type="button" class="decision-toggle" data-decisions-toggle>show all (${hidden.length} more)</button>` : ""}
    </div>
  </section>`;
}

function renderDecisionRow(d: Decision, hidden: boolean): string {
  return `<div class="decision-row"${hidden ? " data-hidden=\"true\"" : ""}>
    <span class="decision-date">${escapeHtml(d.at)}</span>
    <span class="decision-text">${escapeHtml(d.text)}</span>
  </div>`;
}

function renderChangesTile(changes: FileChange[]): string {
  return `<section class="tile tight" data-area="changes">
    <div class="tile-header">
      <h3 class="tile-title changes"><span class="accent-bar"></span>Recent changes</h3>
      <span class="tile-meta">${changes.length}</span>
    </div>
    <div class="tile-body">
      ${changes.length === 0 ? `<div class="change-row"><span class="change-file">No recent changes yet</span><span class="change-diff"></span><span class="change-age"></span></div>` : changes.map((change) => `
        <div class="change-row">
          <span class="change-file">${escapeHtml(change.file)}</span>
          ${renderChangeDiff(change.diff)}
          <span class="change-age">${escapeHtml(change.at)} <button type="button" class="diff-action" data-ui-action="open-diff" data-diff-file="${escapeHtml(change.file)}">Diff</button></span>
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
    const note = task.thought && task.thought.trim() && task.thought.trim() !== task.text.trim()
      ? `<div class="task-note">${escapeHtml(task.thought)}</div>`
      : "";
    return `<div${clickAttr}>
      <span class="row-icon" style="color:${color}">${escapeHtml(icon)}</span>
      <span class="row-text">${escapeHtml(task.text)}</span>
      <span class="row-sub">${escapeHtml(agent)}</span>
    </div>${note}`;
  }

function renderVSCodeBlockedRow(task: BlockedTask): string {
  return `<div class="row">
    <span class="row-icon" style="color:#f48771">✕</span>
    <span class="row-text">${escapeHtml(task.text)}</span>
    <span class="row-sub">${escapeHtml(task.since)}</span>
  </div>`;
}

function renderVSCodeAgent(agent: AgentProfile): string {
  return `<div class="agent">
    <div class="agent-head">
      <span class="agent-name">${escapeHtml(agent.name)}</span>
      <span class="agent-file">${escapeHtml(agent.file)}</span>
    </div>
    <div class="agent-objective">${escapeHtml(agent.role || agent.objective)}</div>
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
      if (window.repologDesktop && typeof window.repologDesktop.onToast === "function") {
        window.repologDesktop.onToast(function (message) {
          if (window.__rqlToast) window.__rqlToast(message);
        });
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
          if (data && data.type === "repolog:toast" && window.__rqlToast && data.message) {
            window.__rqlToast(data.message);
          }
          if (data && data.type === "configSaved" && window.__rqlToast) {
            var configOk = document.querySelector("[data-config-error]");
            if (configOk) { configOk.textContent = ""; configOk.setAttribute("data-visible", "false"); }
            window.__rqlToast("Settings saved ✓");
          }
          if (data && data.type === "error" && data.message) {
            var configErr = document.querySelector("[data-config-error]");
            if (configErr) { configErr.textContent = data.message; configErr.setAttribute("data-visible", "true"); }
            if (window.__rqlToast) window.__rqlToast(data.message);
          }
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
      var defaults = { scale: 1.08, density: "cozy", theme: "dark", font: "system" };
      var settingsOverlay = document.querySelector("[data-settings-panel]");
      var vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
      var setupCard = document.querySelector("[data-setup-card]");
      if (setupCard && window.repologDesktop && typeof window.repologDesktop.firstRunCheck === "function") {
        Promise.resolve(window.repologDesktop.firstRunCheck()).then(function (result) {
          if (!result || result.hasPlanMd !== false || result.lastWizardRun) {
            setupCard.remove();
          }
        }).catch(function () {});
      }

      function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
      function normalizeDensity(value) {
        if (value === "wide" || value === "spacious") return "wide";
        if (value === "cozy") return "cozy";
        return "compact";
      }
      function normalizeTheme(value) {
        return (value === "light") ? "light" : "dark";
      }
      function normalizeFont(value) {
        if (value === "mono") return "mono";
        if (value === "serif") return "serif";
        return "system";
      }
      var fontMap = {
        system: 'Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
        mono: '"Cascadia Code", "JetBrains Mono", "Consolas", monospace',
        serif: 'Georgia, "Times New Roman", serif'
      };
      function densityMultiplier(value) {
        if (value === "wide") return 1.22;
        if (value === "cozy") return 1;
        return 0.8;
      }
      function viewportMultiplier() {
        var width = window.innerWidth || 0;
        var height = window.innerHeight || 0;
        var widthFit = width >= 1600 ? 1 : width >= 1100 ? 0.985 : 0.93;
        var heightFit = height >= 900 ? 1 : height >= 700 ? 0.97 : height >= 600 ? 0.92 : 0.86;
        return Math.min(widthFit, heightFit);
      }
      function read() {
        try {
          var parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
          var scale = typeof parsed.scale === "number" ? parsed.scale : defaults.scale;
          return { scale: clamp(scale, 0.92, 1.5), density: normalizeDensity(parsed.density || defaults.density), theme: normalizeTheme(parsed.theme), font: normalizeFont(parsed.font) };
        } catch (_) { return defaults; }
      }
      function save(next) { localStorage.setItem(KEY, JSON.stringify(next)); }
      function apply() {
        var prefs = read();
        var density = clamp(densityMultiplier(prefs.density) * prefs.scale * viewportMultiplier(), 0.9, 1.5);
        document.documentElement.dataset.density = prefs.density;
        document.documentElement.style.setProperty("--rql-density", density.toFixed(3));
        document.documentElement.dataset.theme = prefs.theme || "dark";
        document.documentElement.style.setProperty("--rql-font", fontMap[prefs.font] || fontMap.system);
        var scaleLabel = document.querySelector("[data-ui-scale-label]");
        if (scaleLabel) scaleLabel.textContent = Math.round(prefs.scale * 100) + "%";
        var densityButtons = document.querySelectorAll("[data-ui-density]");
        for (var i = 0; i < densityButtons.length; i += 1) {
          var btn = densityButtons[i];
          btn.setAttribute("aria-pressed", btn.getAttribute("data-ui-density") === prefs.density ? "true" : "false");
        }
        var themeButtons = document.querySelectorAll("[data-ui-theme]");
        for (var j = 0; j < themeButtons.length; j += 1) {
          var tbtn = themeButtons[j];
          tbtn.setAttribute("aria-pressed", tbtn.getAttribute("data-ui-theme") === (prefs.theme || "dark") ? "true" : "false");
        }
        var fontButtons = document.querySelectorAll("[data-ui-font]");
        for (var k = 0; k < fontButtons.length; k += 1) {
          var fbtn = fontButtons[k];
          fbtn.setAttribute("aria-pressed", fbtn.getAttribute("data-ui-font") === (prefs.font || "system") ? "true" : "false");
        }
      }
      function update(patch) {
        var current = read();
        var next = {
          scale: typeof patch.scale === "number" ? clamp(patch.scale, 0.92, 1.5) : current.scale,
          density: patch.density ? normalizeDensity(patch.density) : current.density,
          theme: patch.theme ? normalizeTheme(patch.theme) : (current.theme || "dark"),
          font: patch.font ? normalizeFont(patch.font) : (current.font || "system"),
        };
        save(next);
        apply();
      }
      function openSettings() {
        if (settingsOverlay) settingsOverlay.setAttribute("data-open", "true");
        selectSettingsTab("overview", false);
        if (window.repologDesktop && typeof window.repologDesktop.getOpenRouterConfig === "function") {
          window.repologDesktop.getOpenRouterConfig().then(function(cfg) {
            // Key field: always empty so user types a real key; status label shows config state
            var keyField = document.querySelector("[data-or-field='key']");
            var modelField = document.querySelector("[data-or-field='model']");
            var orStatus = document.querySelector("[data-or-status]");
            if (keyField) keyField.value = ""; // never pre-fill with masked preview
            if (modelField) modelField.value = cfg.model || "nvidia/nemotron-3-super-120b-a12b:free";
            if (orStatus) orStatus.textContent = cfg.configured ? "✓ Key saved" : "No key saved";
            if (orStatus) orStatus.style.color = cfg.configured ? "var(--ok)" : "var(--dim)";
          }).catch(function() {});
        }
        loadHandoffSettings();
      }
      function applyHandoffSettingsToForm(settings) {
        if (!settings || typeof settings !== "object") return;
        var guide = document.querySelector("[data-handoff-field='personalAgentGuide']");
        if (guide && typeof settings.personalAgentGuide === "string") {
          guide.value = settings.personalAgentGuide;
        }
        setChecked("includePersonalGuideDefault", settings.includePersonalGuideDefault === true);
        setChecked("includeRepoAgentDocsDefault", settings.includeRepoAgentDocsDefault !== false);
        setChecked("includeRecentActivityDefault", settings.includeRecentActivityDefault !== false);
      }
      function setChecked(field, checked) {
        var node = document.querySelector("[data-handoff-field='" + field + "']");
        if (node) node.checked = !!checked;
      }
      function loadHandoffSettings() {
        if (window.repologDesktop && typeof window.repologDesktop.getHandoffSettings === "function") {
          window.repologDesktop.getHandoffSettings().then(applyHandoffSettingsToForm).catch(function () {});
        }
      }
      function collectHandoffSettings() {
        var guide = document.querySelector("[data-handoff-field='personalAgentGuide']");
        var personal = document.querySelector("[data-handoff-field='includePersonalGuideDefault']");
        var docs = document.querySelector("[data-handoff-field='includeRepoAgentDocsDefault']");
        var activity = document.querySelector("[data-handoff-field='includeRecentActivityDefault']");
        var selectedProvider = document.querySelector("[data-handoff-provider][aria-pressed='true']");
        var selectedIntent = document.querySelector("[data-handoff-intent][data-selected='true']");
        return {
          personalAgentGuide: guide && typeof guide.value === "string" ? guide.value : "",
          lastProviderId: selectedProvider ? selectedProvider.getAttribute("data-handoff-provider") : "openai-codex",
          lastIntentId: selectedIntent ? selectedIntent.getAttribute("data-handoff-intent") : "resume-current-work",
          instructionSourceSelection: selectedSourcesFromSettings(personal, docs, activity),
          includePersonalGuideDefault: !!(personal && personal.checked),
          includeRepoAgentDocsDefault: !docs || docs.checked,
          includeRecentActivityDefault: !activity || activity.checked,
        };
      }
      function selectedSources() {
        var nodes = document.querySelectorAll("[data-handoff-source]");
        var out = [];
        for (var i = 0; i < nodes.length; i += 1) {
          if (nodes[i].checked) out.push(nodes[i].getAttribute("data-handoff-source"));
        }
        return out;
      }
      function selectedSourceKey() {
        return selectedSources().join("|");
      }
      function selectedSourcesFromSettings(personal, docs, activity) {
        var out = [];
        if (personal && personal.checked) out.push("personal-agent-guide");
        if (docs && docs.checked) out.push("repo-agent-docs");
        if (activity && activity.checked) out.push("recent-activity");
        return out;
      }
      function setSelected(selector, selected) {
        var nodes = document.querySelectorAll(selector);
        for (var i = 0; i < nodes.length; i += 1) {
          nodes[i].setAttribute("data-selected", nodes[i] === selected ? "true" : "false");
        }
      }
      function saveHandoffSettings(button) {
        if (!window.repologDesktop || typeof window.repologDesktop.saveHandoffSettings !== "function") {
          if (window.__rqlToast) window.__rqlToast("Agent Handoff settings are only available in the desktop shell");
          return;
        }
        setBusy(button, true);
        window.repologDesktop.saveHandoffSettings(collectHandoffSettings()).then(function () {
          if (window.__rqlToast) window.__rqlToast("Agent Handoff saved");
        }).catch(function (error) {
          if (window.__rqlToast) window.__rqlToast("Agent Handoff save failed: " + humanError(error));
        }).finally(function () {
          setBusy(button, false);
        });
      }
      function closeSettings() {
        if (settingsOverlay) settingsOverlay.setAttribute("data-open", "false");
      }
      function selectSettingsTab(tab, shouldScroll) {
        var name = tab || "overview";
        var tabs = document.querySelectorAll("[data-settings-tab]");
        for (var i = 0; i < tabs.length; i++) {
          var active = tabs[i].getAttribute("data-settings-tab") === name;
          tabs[i].classList.toggle("active", active);
          tabs[i].setAttribute("aria-pressed", active ? "true" : "false");
        }
        var sections = document.querySelectorAll("[data-settings-section]");
        var first = null;
        for (var s = 0; s < sections.length; s++) {
          var values = (sections[s].getAttribute("data-settings-section") || "").split(/\\s+/);
          var match = values.indexOf(name) !== -1;
          sections[s].hidden = !match;
          sections[s].setAttribute("data-section-focus", match && name !== "overview" ? "true" : "false");
          if (match && !first) first = sections[s];
        }
        if (shouldScroll && first && typeof first.scrollIntoView === "function") {
          first.scrollIntoView({ block: "start", behavior: "smooth" });
        }
        if (first) {
          clearTimeout(selectSettingsTab._t);
          selectSettingsTab._t = setTimeout(function () {
            var focused = document.querySelectorAll('[data-section-focus="true"]');
            for (var f = 0; f < focused.length; f++) focused[f].setAttribute("data-section-focus", "false");
          }, 900);
        }
      }
      function copyStandup() {
        if (window.repologDesktop && typeof window.repologDesktop.copyStandup === "function") {
          Promise.resolve(window.repologDesktop.copyStandup()).then(function (result) {
            if (!window.__rqlToast) return;
            if (result && result.ok) {
              window.__rqlToast("standup export copied");
            } else {
              window.__rqlToast((result && result.reason) ? result.reason : "standup export failed");
            }
          }).catch(function () {
            if (window.__rqlToast) window.__rqlToast("standup export failed");
          });
          return;
        }
        if (vscode) {
          vscode.postMessage({ type: "copyStandup" });
          return;
        }
        if (window.__rqlToast) window.__rqlToast("standup export is unavailable");
      }
      function humanError(error) {
        var raw = error && error.message ? error.message : String(error || "Unknown error");
        raw = raw.replace(/^Error:\\s*/i, "").replace(/\\s+/g, " ").trim();
        if (!raw || raw === "[object Object]") return "Something went wrong. Please try again.";
        return raw.split("\\n")[0].slice(0, 120);
      }
      function setConfigError(message) {
        var node = document.querySelector("[data-config-error]");
        if (!node) return;
        node.textContent = message || "";
        node.setAttribute("data-visible", message ? "true" : "false");
      }
      function setBusy(button, busy) {
        if (!button) return;
        if (busy) {
          button.setAttribute("data-label", button.textContent || "");
          button.disabled = true;
          button.textContent = "Working...";
        } else {
          button.disabled = false;
          button.textContent = button.getAttribute("data-label") || button.textContent || "";
          button.removeAttribute("data-label");
        }
      }
      function showDoctorAgain() {
        var btn = document.querySelector("[data-run-doctor-again]");
        if (btn) btn.hidden = false;
      }
      function runDoctorInPlace(button) {
        var report = document.querySelector("[data-doctor-report]");
        setBusy(button, true);
        if (window.repologDesktop && typeof window.repologDesktop.runDoctor === "function") {
          return Promise.resolve(window.repologDesktop.runDoctor()).then(function (result) {
            if (report) {
              report.textContent = result && result.text ? result.text : "Doctor finished.";
              report.setAttribute("data-visible", "true");
            }
          }).catch(function (error) {
            var msg = "Doctor failed: " + humanError(error);
            if (report) {
              report.textContent = msg;
              report.setAttribute("data-visible", "true");
            }
            if (window.__rqlToast) window.__rqlToast(msg);
          }).finally(function () {
            setBusy(button, false);
          });
        }
        if (window.__rqlToast) window.__rqlToast("Doctor is only available in the desktop shell");
        setBusy(button, false);
        return Promise.resolve();
      }
      function collectConfig() {
        try {
          function valueFor(field) {
            return document.querySelector('[data-config-field="' + field + '"]');
          }
          var excludesNode = valueFor("excludes");
          var promptsNode = valueFor("promptsDir");
          var debounceNode = valueFor("watchDebounce");
          var writebackNode = valueFor("writeback");
          var reportNode = valueFor("reportFileChanges");
          var excludes = [];
          if (excludesNode && typeof excludesNode.value === "string") {
            excludes = excludesNode.value.split(/\\r?\\n/).map(function (line) { return line.trim(); }).filter(Boolean);
          }
          var debounceRaw = debounceNode && debounceNode.value ? String(debounceNode.value).trim() : "500";
          var debounce = Number(debounceRaw);
          if (!Number.isFinite(debounce) || debounce < 100 || debounce > 10000) {
            throw new Error("Watch debounce must be a number from 100 to 10000.");
          }
          return {
            excludes: excludes,
            writeback: !!(writebackNode && writebackNode.checked),
            prompts: { dir: promptsNode && typeof promptsNode.value === "string" ? promptsNode.value.trim() : "" },
            watch: {
              debounce: debounce,
              reportFileChanges: !!(reportNode && reportNode.checked),
            },
          };
        } catch (error) {
          throw error;
        }
      }
      function saveConfig(button) {
        try {
          setConfigError("");
          var payload = collectConfig();
          setBusy(button, true);
          if (window.repologDesktop && typeof window.repologDesktop.writeConfig === "function") {
            return Promise.resolve(window.repologDesktop.writeConfig(payload)).then(function (result) {
              if (window.__rqlToast) {
                window.__rqlToast(result && result.success
                  ? "Settings saved ✓" + (result.files ? " " + result.files.join(", ") : "")
                  : "Settings save failed");
              }
            }).catch(function (error) {
              var msg = "Settings save failed: " + humanError(error);
              setConfigError(msg);
              if (window.__rqlToast) window.__rqlToast(msg);
            }).finally(function () {
              setBusy(button, false);
            });
          }
          if (vscode && typeof vscode.postMessage === "function") {
            vscode.postMessage({ type: "writeConfig", payload: payload });
            if (window.__rqlToast) window.__rqlToast("Settings sent to editor");
            setBusy(button, false);
            return Promise.resolve();
          }
          setBusy(button, false);
          if (window.__rqlToast) window.__rqlToast("Settings save unavailable");
          return Promise.resolve();
        } catch (error) {
          setBusy(button, false);
          setConfigError(humanError(error));
          return Promise.resolve();
        }
      }
      function copyContextText(text, label) {
        var copied = false;
        function done() {
          if (window.__rqlToast) window.__rqlToast((label || "prompt") + " copied");
        }
        function failed(error) {
          if (window.__rqlToast) window.__rqlToast("copy failed" + (error ? ": " + humanError(error) : ""));
        }
        if (text && navigator.clipboard && navigator.clipboard.writeText) {
          copied = true;
          return navigator.clipboard.writeText(text).then(done).catch(function () {
            if (window.repologDesktop && typeof window.repologDesktop.copyText === "function") {
              return window.repologDesktop.copyText(text).then(done).catch(failed);
            }
            failed();
            return null;
          });
        }
        if (text && window.repologDesktop && typeof window.repologDesktop.copyText === "function") {
          copied = true;
          return window.repologDesktop.copyText(text).then(done).catch(failed);
        }
        if (!copied) failed();
        return Promise.resolve();
      }
      window.__rqlCopyText = copyContextText;
      document.addEventListener("click", function (event) {
        try {
          var target = event.target;
          if (!target || !target.closest) return;
          var copyBtn = target.closest("[data-copy-context]");
          if (copyBtn) {
            var text = copyBtn.getAttribute("data-copy-context");
            var contextMap = copyBtn.getAttribute("data-copy-context-map");
            if (contextMap) {
              try {
                var mapped = JSON.parse(contextMap);
                var key = selectedSourceKey();
                if (mapped && Object.prototype.hasOwnProperty.call(mapped, key)) {
                  text = mapped[key];
                }
              } catch (_) {}
            }
            copyContextText(text, copyBtn.getAttribute("aria-label") || "prompt");
            return;
          }
          var desktopButton = target.closest("[data-window-action]");
          if (desktopButton && window.repologDesktop && typeof window.repologDesktop.windowAction === "function") {
            window.repologDesktop.windowAction(desktopButton.getAttribute("data-window-action"));
            return;
          }
          if (settingsOverlay && target === settingsOverlay) {
            closeSettings();
            return;
          }
          if (target.closest && target.closest("[data-writeback-toggle]")) {
            return;
          }
          var timelineButton = target.closest("[data-timeline-window]");
          if (timelineButton) {
            var minutes = timelineButton.getAttribute("data-timeline-window");
            var timeline = timelineButton.closest("[data-timeline]");
            if (timeline) {
              var buttons = timeline.querySelectorAll("[data-timeline-window]");
              for (var tb = 0; tb < buttons.length; tb++) {
                buttons[tb].setAttribute("aria-pressed", buttons[tb] === timelineButton ? "true" : "false");
              }
              var panels = timeline.querySelectorAll("[data-timeline-panel]");
              for (var tp = 0; tp < panels.length; tp++) {
                var active = panels[tp].getAttribute("data-timeline-panel") === minutes;
                panels[tp].setAttribute("data-visible", active ? "true" : "false");
                if (active) {
                  var summary = timeline.querySelector("[data-timeline-summary]");
                  if (summary) summary.textContent = panels[tp].getAttribute("data-summary") || "";
                }
              }
              try { window.localStorage.setItem("repolog-timeline-window", minutes || "15"); } catch (_) {}
            }
            return;
          }
          var openRow = target.closest("[data-open-doc]");
          if (openRow && window.repologDesktop && typeof window.repologDesktop.openDoc === "function") {
            var doc = openRow.getAttribute("data-open-doc");
            var line = parseInt(openRow.getAttribute("data-line") || "1", 10);
            window.repologDesktop.openDoc(doc, line);
          }
          var button = target.closest("[data-ui-action], [data-ui-density], [data-ui-theme], [data-ui-font], [data-settings-tab], [data-handoff-provider], [data-handoff-intent]");
          if (!button) return;
          if (button.hasAttribute("data-settings-tab")) {
            selectSettingsTab(button.getAttribute("data-settings-tab"), true);
            return;
          }
          if (button.hasAttribute("data-ui-action")) {
            var action = button.getAttribute("data-ui-action");
            var prefs = read();
            if (action === "refresh") {
              if (window.repologDesktop && typeof window.repologDesktop.requestRefresh === "function") {
                window.repologDesktop.requestRefresh();
              }
              return;
            }
            if (action === "open-diff") {
              var diffFile = button.getAttribute("data-diff-file") || "";
              var drawer = document.querySelector("[data-diff-drawer]");
              var title = document.querySelector("[data-diff-title]");
              var body = document.querySelector("[data-diff-body]");
              if (drawer) drawer.setAttribute("data-open", "true");
              if (title) title.textContent = diffFile || "Diff preview";
              if (body) body.textContent = "Loading diff...";
              if (window.repologDesktop && typeof window.repologDesktop.getFileDiff === "function") {
                Promise.resolve(window.repologDesktop.getFileDiff(diffFile)).then(function (result) {
                  if (title) title.textContent = result && result.file ? result.file : diffFile;
                  if (body) body.textContent = result && result.ok
                    ? (result.text + (result.truncated ? "\\n\\n--- Diff truncated ---" : ""))
                    : ("Diff unavailable: " + ((result && result.reason) || "no diff"));
                }).catch(function (error) {
                  if (body) body.textContent = "Diff failed: " + humanError(error);
                });
              } else if (body) {
                body.textContent = "Diff preview is available in the desktop shell.";
              }
              return;
            }
            if (action === "close-diff") {
              var closeDrawer = document.querySelector("[data-diff-drawer]");
              if (closeDrawer) closeDrawer.setAttribute("data-open", "false");
              return;
            }
            if (action === "open-settings") {
              openSettings();
              return;
            }
            if (action === "open-handoff-settings") {
              openSettings();
              selectSettingsTab("prompts", true);
              return;
            }
            if (action === "close-settings") {
              closeSettings();
              return;
            }
            if (action === "open-repo") {
              if (window.repologDesktop && typeof window.repologDesktop.openRepoPicker === "function") {
                window.repologDesktop.openRepoPicker();
              } else if (window.__rqlToast) {
                window.__rqlToast("open repo is only available in the desktop shell");
              }
              return;
            }
            if (action === "open-config") {
              if (window.repologDesktop && typeof window.repologDesktop.openConfigFile === "function") {
                window.repologDesktop.openConfigFile();
              } else if (window.repologDesktop && typeof window.repologDesktop.openDoc === "function") {
                window.repologDesktop.openDoc(".repolog.json", 1);
              } else if (window.__rqlToast) {
                window.__rqlToast("settings config is only available in the desktop shell");
              }
              return;
            }
            if (action === "init-plan" || action === "init-state" || action === "init-config") {
              try {
                var targetDoc = action === "init-plan" ? "plan" : action === "init-state" ? "state" : "config";
                setBusy(button, true);
                if (window.repologDesktop && typeof window.repologDesktop.initTemplate === "function") {
                  Promise.resolve(window.repologDesktop.initTemplate(targetDoc)).then(function (result) {
                    if (window.__rqlToast) window.__rqlToast(targetDoc.toUpperCase() + " created ✓" + (result && result.files ? " " + result.files.join(", ") : ""));
                    showDoctorAgain();
                  }).catch(function (error) {
                    if (window.__rqlToast) window.__rqlToast("Failed to create " + targetDoc + ": " + humanError(error));
                  }).finally(function () {
                    setBusy(button, false);
                  });
                } else if (vscode && typeof vscode.postMessage === "function") {
                  vscode.postMessage({ type: "initTemplate", target: targetDoc });
                  if (window.__rqlToast) window.__rqlToast("Creating " + targetDoc + "…");
                  showDoctorAgain();
                  setBusy(button, false);
                } else {
                  if (window.__rqlToast) window.__rqlToast("Init not available in this shell");
                  setBusy(button, false);
                }
              } catch (error) {
                setBusy(button, false);
                if (window.__rqlToast) window.__rqlToast("Error: " + humanError(error));
              }
              return;
            }
            if (action === "run-doctor-again") {
              runDoctorInPlace(button);
              return;
            }
            if (action === "standup-export") {
              copyStandup();
              return;
            }
            if (action === "dismiss-wizard") {
              try {
                if (window.repologDesktop && typeof window.repologDesktop.dismissWizard === "function") {
                  Promise.resolve(window.repologDesktop.dismissWizard()).then(function () {
                    closeSettings();
                  }).catch(function (error) {
                    if (window.__rqlToast) window.__rqlToast("Error dismissing wizard: " + String(error).slice(0, 50));
                  });
                } else {
                  closeSettings();
                }
              } catch (error) {
                if (window.__rqlToast) window.__rqlToast("Error dismissing wizard: " + String(error).slice(0, 50));
              }
              return;
            }
            if (action === "save-config") {
              try {
                saveConfig(button);
              } catch (error) {
                setConfigError(humanError(error));
              }
              return;
            }
            if (action === "save-handoff-settings") {
              saveHandoffSettings(button);
              return;
            }
            if (action === "remember-startup-root") {
              if (window.repologDesktop && typeof window.repologDesktop.rememberStartupRoot === "function") {
                window.repologDesktop.rememberStartupRoot();
                if (window.__rqlToast) window.__rqlToast("startup memory saved");
              } else if (window.__rqlToast) {
                window.__rqlToast("startup memory is only available in the desktop shell");
              }
              return;
            }
            if (action === "forget-startup-root") {
              if (window.repologDesktop && typeof window.repologDesktop.forgetStartupRoot === "function") {
                window.repologDesktop.forgetStartupRoot();
                if (window.__rqlToast) window.__rqlToast("startup memory cleared");
              } else if (window.__rqlToast) {
                window.__rqlToast("startup memory is only available in the desktop shell");
              }
              return;
            }
            if (action === "smaller") update({ scale: prefs.scale - 0.08 });
            if (action === "larger") update({ scale: prefs.scale + 0.08 });
          }
          if (button.hasAttribute("data-handoff-provider")) {
            var providerButtons = document.querySelectorAll("[data-handoff-provider]");
            for (var hp = 0; hp < providerButtons.length; hp += 1) {
              providerButtons[hp].setAttribute("aria-pressed", providerButtons[hp] === button ? "true" : "false");
            }
          }
          if (button.hasAttribute("data-handoff-intent")) {
            setSelected("[data-handoff-intent]", button);
          }
          if (button.hasAttribute("data-ui-density")) {
            update({ density: button.getAttribute("data-ui-density") || "cozy" });
          }
          if (button.hasAttribute("data-ui-theme")) {
            update({ theme: button.getAttribute("data-ui-theme") || "dark" });
          }
          if (button.hasAttribute("data-ui-font")) {
            update({ font: button.getAttribute("data-ui-font") || "system" });
          }
          if (action === "save-openrouter") {
            var keyField = document.querySelector("[data-or-field='key']");
            var modelSel = document.querySelector("[data-or-field='model']");
            var orStatus = document.querySelector("[data-or-status]");
            var newKey = keyField ? keyField.value.trim() : "";
            var model = (modelSel ? modelSel.value.trim() : "") || "nvidia/nemotron-3-super-120b-a12b:free";
            // If key field is blank, only save the model (preserve existing key)
            if (window.repologDesktop && typeof window.repologDesktop.saveOpenRouterConfig === "function") {
              var payload = newKey ? { key: newKey, model: model } : { model: model };
              window.repologDesktop.saveOpenRouterConfig(payload).then(function() {
                if (orStatus) { orStatus.textContent = newKey ? "✓ Key saved" : "✓ Model saved"; orStatus.style.color = "var(--ok)"; }
                if (keyField) keyField.value = ""; // clear after save
                var digestBtns = document.querySelectorAll("[data-ui-action='run-digest']");
                for (var d = 0; d < digestBtns.length; d++) {
                  if (newKey) { digestBtns[d].disabled = false; digestBtns[d].title = "Run AI digest of current repo state"; }
                }
              }).catch(function(err) {
                if (orStatus) { orStatus.textContent = "Error: " + String(err).slice(0, 40); orStatus.style.color = "var(--danger)"; }
              });
            } else {
              if (orStatus) { orStatus.textContent = "Only available in desktop shell"; orStatus.style.color = "var(--dim)"; }
            }
          }
          if (action === "run-digest") {
            var digestBtn = button;
            if (!digestBtn || digestBtn.disabled) return;
            digestBtn.disabled = true;
            digestBtn.textContent = "⏳ Running…";
            if (window.repologDesktop && typeof window.repologDesktop.runDigest === "function") {
              window.repologDesktop.runDigest().then(function(res) {
                digestBtn.disabled = false;
                digestBtn.textContent = "✦ Digest";
                if (res && res.error) {
                  if (window.__rqlToast) window.__rqlToast(res.error);
                  // Also show inline so it's readable after the toast fades
                  var emptyEl = document.querySelector(".digest-empty");
                  if (emptyEl) { emptyEl.textContent = "⚠ " + res.error; emptyEl.style.color = "var(--warn)"; }
                } else {
                  window.repologDesktop.requestRefresh();
                }
              }).catch(function(err) {
                digestBtn.disabled = false;
                digestBtn.textContent = "✦ Digest";
                var msg = "Digest failed: " + String(err).slice(0, 80);
                if (window.__rqlToast) window.__rqlToast(msg);
                var emptyEl = document.querySelector(".digest-empty");
                if (emptyEl) { emptyEl.textContent = "⚠ " + msg; emptyEl.style.color = "var(--warn)"; }
              });
            } else {
              digestBtn.disabled = false;
              digestBtn.textContent = "✦ Digest";
              if (window.__rqlToast) window.__rqlToast("Digest is only available in the desktop shell");
            }
          }
        } catch (error) {
          if (window.__rqlToast) window.__rqlToast("Click handler error: " + String(error).slice(0, 50));
        }
      });
      document.addEventListener("keydown", function (event) {
        var prefs = read();
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === "c" || event.key === "C")) {
          event.preventDefault();
          copyStandup();
          return;
        }
        if (settingsOverlay && settingsOverlay.getAttribute("data-open") === "true" && (event.metaKey || event.ctrlKey) && (event.key === "s" || event.key === "S")) {
          event.preventDefault();
          var saveBtn = document.querySelector("[data-ui-action='save-config']");
          if (saveBtn) saveConfig(saveBtn);
          return;
        }
        if (settingsOverlay && settingsOverlay.getAttribute("data-open") === "true" && (event.metaKey || event.ctrlKey) && (event.key === "r" || event.key === "R")) {
          event.preventDefault();
          var analyzeBtn = document.querySelector("[data-tuneup-action='generate']");
          if (analyzeBtn && typeof analyzeBtn.click === "function") analyzeBtn.click();
          return;
        }
        if ((event.metaKey || event.ctrlKey) && (event.key === "+" || event.key === "=")) {
          event.preventDefault();
          update({ scale: prefs.scale + 0.08 });
        }
        if ((event.metaKey || event.ctrlKey) && event.key === "-") {
          event.preventDefault();
          update({ scale: prefs.scale - 0.08 });
        }
        if (event.key === "Escape" && settingsOverlay && settingsOverlay.getAttribute("data-open") === "true") {
          event.preventDefault();
          closeSettings();
        }
      });
      apply();
      window.addEventListener("resize", apply);
    })();
  </script>`;
}

function renderWritebackScript(): string {
  return `<script>
    (function () {
      function showToast(message) {
        if (window.__rqlToast) window.__rqlToast(message);
      }

      document.addEventListener("click", function (event) {
        var button = event.target.closest && event.target.closest("[data-writeback-toggle]");
        if (!button) return;
        if (!window.repologDesktop || typeof window.repologDesktop.toggleChecklist !== "function") {
          showToast("write-back is only available in the desktop shell");
          return;
        }
        if (button.disabled) {
          showToast("write-back is off");
          return;
        }
        event.preventDefault();
        event.stopPropagation();

        var doc = button.getAttribute("data-doc") || "";
        var line = parseInt(button.getAttribute("data-line") || "0", 10);
        var text = button.getAttribute("data-text") || "";
        var checked = button.getAttribute("data-checked") === "true";
        button.disabled = true;

        Promise.resolve(window.repologDesktop.toggleChecklist(doc, line, text, !checked))
          .then(function (result) {
            if (result && result.ok && result.changed) {
              showToast(result.checked ? "task marked complete" : "task reopened");
              return;
            }
            showToast((result && result.reason) ? result.reason : "write-back skipped");
            if (window.repologDesktop && typeof window.repologDesktop.requestRefresh === "function") {
              window.repologDesktop.requestRefresh();
            }
          })
          .catch(function () {
            showToast("Failed to update task. Re-scanning...");
            if (window.repologDesktop && typeof window.repologDesktop.requestRefresh === "function") {
              window.repologDesktop.requestRefresh();
            }
          })
          .finally(function () {
            button.disabled = false;
          });
      });
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
            promptIconHtml(p) +
            '<div><div class="label">' + escapeHtml(p.label) + '</div><div class="sub">' + escapeHtml(p.sub || "") + '</div></div>' +
            '<span class="hint">↵</span>' +
          '</div>';
        }).join("");
        list.innerHTML = html || '<div class="palette-item"><span class="glyph">·</span><div class="label">No matches</div><span class="hint"></span></div>';
      }
      function promptProvider(p) {
        var text = String((p.id || "") + " " + (p.label || "") + " " + (p.sub || "") + " " + (p.keywords || "")).toLowerCase();
        if (text.indexOf("claude") !== -1) return "claude";
        if (text.indexOf("anthropic") !== -1) return "anthropic";
        if (text.indexOf("codex") !== -1 || text.indexOf("openai") !== -1) return "openai";
        if (text.indexOf("gemini") !== -1 || text.indexOf("google") !== -1) return "gemini";
        return "custom";
      }
      function promptIconHtml(p) {
        var provider = promptProvider(p);
        var svg = "";
        if (provider === "claude") {
          svg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"></path></svg>';
        } else if (provider === "anthropic") {
          svg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"></path></svg>';
        } else if (provider === "openai") {
          svg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"></path></svg>';
        } else if (provider === "gemini") {
          svg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"></path></svg>';
        } else {
          svg = escapeHtml(p.glyph || "*");
        }
        return '<span class="glyph prompt-glyph ' + provider + '" aria-hidden="true">' + svg + '</span>';
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
        if (window.__rqlCopyText) {
          window.__rqlCopyText(text, p.label + " prompt");
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast(p.label + " prompt copied");
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
        var duration = Math.min(Math.max(2500, msg.length * 55), 8000);
        showToast._t = setTimeout(function () { toast.setAttribute("data-visible", "false"); }, duration);
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

function renderDecisionToggleScript(): string {
  return `<script>
    (function () {
      document.addEventListener('click', function (event) {
        var btn = event.target.closest && event.target.closest('[data-decisions-toggle]');
        if (!btn) return;
        var tile = btn.closest('[data-decisions-expanded]');
        if (!tile) return;
        var expanded = tile.getAttribute('data-decisions-expanded') === 'true';
        tile.setAttribute('data-decisions-expanded', expanded ? 'false' : 'true');
        var hidden = tile.querySelector('[data-decisions-hidden]');
        if (hidden) hidden.hidden = expanded;
        btn.textContent = expanded ? btn.textContent.replace(/^hide all/, 'show all') : btn.textContent.replace(/^show all \\(([^)]+)\\)/, 'hide all ($1)');
      });
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

function isEmptyRepo(state: QuestState): boolean {
  const context = state.repoContext;
  const hasDetectedContext = !!context && (
    context.rootFiles.length > 0 ||
    context.sourceTree.length > 0 ||
    !!context.manifestType ||
    !!context.packageName ||
    !!context.readmePreview
  );
  return state.scannedFiles.length === 0 && !hasDetectedContext;
}

function summarizeReadme(readme?: string): string {
  if (!readme) return "";
  const line = readme
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#") && !item.startsWith("[![") && !item.startsWith("<"));
  return line ?? "";
}

function renderEmptyState(state: QuestState): string {
  const expectedFiles = ["PLAN.md", "STATE.md", "AGENTS.md"];
  const scanned = new Set(state.scannedFiles.map((f) => f.split(/[\\/]/).pop()?.toUpperCase()));
  const slots = expectedFiles.map((f) => {
    const present = scanned.has(f.toUpperCase());
    return `<span class="slot ${present ? "present" : ""}"><span class="mark">${present ? "✓" : "+"}</span>${escapeHtml(f)}</span>`;
  }).join("");
  const now = "## Now\n- [ ] your current task here\n- [ ] second task (optional)";
  const next = "## Next\n- [ ] queued task\n- [ ] another queued task";
  const blocked = "## Blocked\n- [ ] thing waiting on X";
  return `<div class="empty-state">
    <div class="empty-banner">
      <div class="kicker">Mission</div>
      <div class="ghost">Your repo's mission appears here — write one sentence in PLAN.md under \`## Mission\`.</div>
    </div>
    <div class="empty-grid">
      <div class="empty-tile">
        <div class="kicker">Now</div>
        <pre>${escapeHtml(now)}</pre>
      </div>
      <div class="empty-tile">
        <div class="kicker">Next</div>
        <pre>${escapeHtml(next)}</pre>
      </div>
      <div class="empty-tile">
        <div class="kicker">Blocked</div>
        <pre>${escapeHtml(blocked)}</pre>
      </div>
    </div>
      <div class="empty-missing">${slots}</div>
    </div>`;
  }

  function getWhyNowLine(state: QuestState): string {
    const candidate = state.now[0] ?? state.next[0] ?? state.blocked[0];
    const raw = candidate?.thought?.trim() || candidate?.text.trim() || state.mission.trim() || "No additional context available.";
    return raw.replace(/\s+/g, " ").slice(0, 180);
  }

  function latestAgentActivity(
    agentId: string,
    activity: readonly { agent: string; file: string; at: string; confidence: number }[],
  ): { agent: string; file: string; at: string; confidence: number } | undefined {
    return activity.find((entry) => entry.agent.toLowerCase() === agentId.toLowerCase());
  }

  function resolveAgentTask(agent: AgentProfile, activity: readonly { agent: string; file: string; at: string; confidence: number }[]): string {
    const entry = latestAgentActivity(agent.id, activity);
    return entry ? `${entry.file} · ${entry.at}` : (agent.lastTask ?? "");
  }

  function digestAge(iso: string): string {
    try {
      const ms = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(ms / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch { return "unknown"; }
  }

  function formatActivityAge(timestamp: number): string {
    if (!Number.isFinite(timestamp)) {
      return "";
    }
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
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

  function isOlderThan(since: string, minutes: number): boolean {
    const age = relativeMinutes(since);
    return typeof age === "number" ? age > minutes : true;
  }

  function relativeMinutes(since: string): number | undefined {
    const s = since.trim().toLowerCase();
    if (!s) return undefined;
    if (s === "just now" || s === "now") return 0;
    const shorthand = /^(\d+)\s*([mhd])/.exec(s);
    if (shorthand) {
      const n = Number(shorthand[1]);
      const unit = shorthand[2];
      if (unit === "m") return n;
      if (unit === "h") return n * 60;
      if (unit === "d") return n * 24 * 60;
    }
    const word = /^(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)\b/.exec(s);
    if (!word) return undefined;
    const n = Number(word[1]);
    const unit = word[2] ?? "";
    if (unit.startsWith("min")) return n;
    if (unit.startsWith("hour")) return n * 60;
    if (unit.startsWith("day")) return n * 24 * 60;
    return undefined;
  }

function escapeForScriptJson(value: string): string {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function renderTuneupScript(): string {
  return `<script>
    (function () {
      var vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
      var card = document.querySelector("[data-tuneup-card]");

      var meterWrap = card && card.querySelector("[data-tuneup-meter-wrap]");
      var fill = card && card.querySelector("[data-tuneup-fill]");
      var scoreEl = card && card.querySelector("[data-tuneup-score]");
      var placeholder = card && card.querySelector("[data-tuneup-placeholder]");
      var promptArea = card && card.querySelector("[data-tuneup-prompt]");
      var onboardingPrompt = document.querySelector("[data-onboarding-prompt]");
      var gapsEl = card && card.querySelector("[data-tuneup-gaps]");
      var gapCountEl = card && card.querySelector("[data-tuneup-gap-count]");
      var actionsEl = card && card.querySelector("[data-tuneup-actions]");
      var resultsEl = card && card.querySelector("[data-tuneup-results]");

      var tuneupData = null;

      function meterColor(score) {
        if (score >= 80) return "var(--accent)";
        if (score >= 50) return "var(--warn)";
        return "var(--danger)";
      }

      function renderGap(gap) {
        var severity = gap.severity || "low";
        var sevClass = severity === "high" ? "high" : severity === "med" ? "med" : "low";
        var label = gap.id || gap.title || gap.text || "gap";
        var file = gap.file || gap.doc || "repo";
        var fix = gap.fix || gap.example || gap.why || gap.text || "";
        var isContent = gap.currentContent !== undefined;
        var badge = isContent ? ' <span style="font-size:0.75em;opacity:0.6;border:1px solid currentColor;border-radius:3px;padding:0 3px">content</span>' : '';
        var current = isContent && gap.currentContent
          ? '<div style="margin-top:3px;font-size:0.8em;opacity:0.65;font-style:italic;padding-left:8px">was: ' + escHtml(gap.currentContent.slice(0, 80)) + (gap.currentContent.length > 80 ? "…" : "") + '</div>'
          : '';
        return '<div class="tuneup-gap-row">'
          + '<span class="tuneup-gap-sev ' + sevClass + '">' + escHtml(severity) + '</span>'
          + '<span><span class="tuneup-gap-text">' + escHtml(label) + '</span>' + badge + ' '
          + '<span class="tuneup-gap-file">(' + escHtml(file) + ')</span>' + (fix ? ' - ' + escHtml(fix) : '') + current + '</span>'
          + '</div>';
      }

      function escHtml(s) {
        return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      }

      function applyResult(data) {
        tuneupData = data;
        var contentScore = typeof data.contentScore === "number" ? data.contentScore : 100;
        var displayScore = Math.floor((data.score + contentScore) / 2);
        if (placeholder) placeholder.hidden = false;
        if (resultsEl) resultsEl.setAttribute("data-visible", "true");
        if (meterWrap) meterWrap.hidden = false;
        if (fill) {
          fill.style.width = Math.max(0, Math.min(100, displayScore)) + "%";
          fill.style.background = meterColor(displayScore);
        }
        if (scoreEl) {
          scoreEl.textContent = String(displayScore);
          scoreEl.title = contentScore < 100 ? displayScore + "/100 (struct " + data.score + " · content " + contentScore + ")" : data.score + "/100";
        }
        if (promptArea) {
          promptArea.value = data.prompt || "";
          promptArea.setAttribute("data-visible", "true");
        }
        if (onboardingPrompt) {
          onboardingPrompt.hidden = false;
          onboardingPrompt.value = data.prompt || "";
        }
        if (actionsEl) actionsEl.hidden = false;
        var allGaps = (data.gaps || []).concat(data.contentGaps || []);
        if (gapCountEl) gapCountEl.textContent = String(allGaps.length);
        if (gapsEl && allGaps.length > 0) {
          gapsEl.innerHTML = allGaps.map(renderGap).join("");
          gapsEl.setAttribute("data-visible", "true");
        } else if (gapsEl) {
          gapsEl.innerHTML = '<div class="tuneup-placeholder">No fixes needed. Structural and content scores are both 100.</div>';
          gapsEl.setAttribute("data-visible", "true");
        }
      }

      window.addEventListener("message", function (event) {
        var msg = event.data;
        if (!msg || msg.type !== "repolog:tuneup") return;
        applyResult(msg.data);
      });

      document.addEventListener("click", function (event) {
        var btn = event.target.closest && event.target.closest("[data-tuneup-action]");
        if (!btn) return;
        var action = btn.getAttribute("data-tuneup-action");

        if (action === "generate") {
          var completeLabel = btn.getAttribute("data-tuneup-complete-label") || "Re-analyze repo";
          var fallbackLabel = btn.getAttribute("data-tuneup-fallback-label") || "Analyze repo";
          btn.disabled = true;
          btn.textContent = "Analyzing…";
          if (window.repologDesktop && typeof window.repologDesktop.runTuneup === "function") {
            Promise.resolve(window.repologDesktop.runTuneup()).then(function (data) {
              applyResult(data);
              btn.disabled = false;
              btn.textContent = completeLabel;
            }).catch(function (err) {
              if (window.__rqlToast) window.__rqlToast("tuneup failed: " + String(err));
              btn.disabled = false;
              btn.textContent = fallbackLabel;
            });
          } else if (vscode) {
            vscode.postMessage({ type: "runTuneup" });
            btn.disabled = false;
            btn.textContent = completeLabel;
          } else {
            if (window.__rqlToast) window.__rqlToast("tuneup requires the desktop or VS Code shell");
            btn.disabled = false;
            btn.textContent = fallbackLabel;
          }
          return;
        }

        if (!tuneupData) return;

        if (action === "copy") {
          var text = tuneupData.prompt || "";
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
              if (window.__rqlToast) window.__rqlToast("tuneup prompt copied");
            }).catch(function () {});
          } else if (window.repologDesktop && typeof window.repologDesktop.copyText === "function") {
            window.repologDesktop.copyText(text);
            if (window.__rqlToast) window.__rqlToast("tuneup prompt copied");
          }
          return;
        }

         if (action === "write-charter") {
           if (window.repologDesktop && typeof window.repologDesktop.writeTuneupCharter === "function") {
             Promise.resolve(window.repologDesktop.writeTuneupCharter(tuneupData.charter)).then(function (result) {
              if (window.__rqlToast) window.__rqlToast(result && result.files ? "created repo guide: " + result.files.join(", ") : "repo guide created");
             }).catch(function () {
              if (window.__rqlToast) window.__rqlToast("failed to create repo guide");
             });
           } else if (vscode) {
             vscode.postMessage({ type: "writeTuneupCharter", charter: tuneupData.charter });
           } else {
            if (window.__rqlToast) window.__rqlToast("creating a repo guide requires the desktop or VS Code shell");
           }
           return;
         }

        if (action === "preview-gaps") {
          if (!gapsEl) return;
          var visible = gapsEl.getAttribute("data-visible") === "true";
          gapsEl.setAttribute("data-visible", visible ? "false" : "true");
          btn.textContent = visible ? "Show fixes" : "Hide fixes";
          return;
        }

        if (action === "preview-docs") {
          if (!onboardingPrompt || !tuneupData) return;
          var docs = tuneupData.generatedDocs || {};
          onboardingPrompt.hidden = false;
          onboardingPrompt.value = Object.keys(docs).map(function (file) {
            return "## " + file + "\\n\\n" + docs[file];
          }).join("\\n\\n");
          return;
        }

        if (action === "apply-docs") {
          if (!tuneupData || !tuneupData.generatedDocs) return;
          var files = Object.keys(tuneupData.generatedDocs);
          var ok = window.confirm ? window.confirm("Write these repo files now?\\n\\n" + files.join("\\n")) : false;
          if (!ok) return;
          if (window.repologDesktop && typeof window.repologDesktop.applyGeneratedDocs === "function") {
            Promise.resolve(window.repologDesktop.applyGeneratedDocs(tuneupData.generatedDocs)).then(function (result) {
              if (window.__rqlToast) window.__rqlToast(result && result.files ? "wrote " + result.files.join(", ") : "generated docs written");
            }).catch(function (err) {
              if (window.__rqlToast) window.__rqlToast("generated docs write failed: " + String(err));
            });
          } else if (vscode) {
            vscode.postMessage({ type: "applyGeneratedDocs", docs: tuneupData.generatedDocs });
          } else if (window.__rqlToast) {
            window.__rqlToast("applying docs requires the desktop or VS Code shell");
          }
          return;
        }

        var agentMap = { "send-claude": "claude", "send-codex": "codex", "send-gemini": "gemini" };
        var agentId = agentMap[action];
        if (agentId) {
          var agentPrompt = (tuneupData.perAgent && tuneupData.perAgent[agentId]) || tuneupData.prompt;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(agentPrompt).then(function () {
              if (window.__rqlToast) window.__rqlToast("tuneup prompt for " + agentId + " copied");
            }).catch(function () {});
          }
          return;
        }
      });
    })();
  </script>`;
}
