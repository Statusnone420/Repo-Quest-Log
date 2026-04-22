import { buildContextPrompt, buildPromptPresets, type PromptPreset } from "../engine/prompts.js";
import type { AgentProfile, BlockedTask, Decision, FileChange, QuestState, Task } from "../engine/types.js";

export interface SurfaceHtmlOptions {
  liveBridge?: "desktop" | "vscode";
  presets?: PromptPreset[];
  appVersion?: string;
}

export function renderDesktopHtml(state: QuestState, options: SurfaceHtmlOptions = {}): string {
  const presets = options.presets ?? buildPromptPresets(state);
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
      --rql-density: 1.02;
      --pad-x: calc(15px * var(--rql-density));
      --pad-y: calc(11px * var(--rql-density));
      --tile-pad: calc(14px * var(--rql-density));
      --tile-gap: calc(12px * var(--rql-density));
      --row-gap: calc(6px * var(--rql-density));
      --body-size: calc(12.75px * var(--rql-density));
      --small-size: calc(11.5px * var(--rql-density));
      --tiny-size: calc(9.75px * var(--rql-density));
      --title-size: calc(13.75px * var(--rql-density));
      --headline-size: calc(15.5px * var(--rql-density));
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
      grid-template-rows: auto auto auto auto auto minmax(0, 1fr);
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
    .app-version {
      display: inline-flex; align-items: center;
      padding: 2px 7px; border-radius: 999px;
      font-family: var(--mono); font-size: var(--tiny-size);
      color: var(--muted); background: rgba(255,255,255,0.03);
      border: 1px solid var(--tile-border);
    }
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
    .window-controls {
      display: inline-flex; align-items: center; gap: 4px;
      margin-left: 4px;
    }
    .surface-controls button {
      appearance: none; border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02); color: var(--ink);
      border-radius: 5px; padding: 2px 7px; cursor: pointer;
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
    .surface-controls .label { color: var(--muted); letter-spacing: 0.8px; text-transform: uppercase; margin-left: 4px; }
    .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--ok); display: inline-block; }

    /* ---- SETTINGS RACK ---- */
    .settings-rack {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.9fr);
      gap: var(--tile-gap);
      padding: var(--pad-y) var(--pad-x) 0;
      min-width: 0;
    }
    .settings-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px;
      min-width: 0;
      border-radius: 10px;
      border: 1px solid var(--tile-border);
      background: rgba(18,22,28,0.72);
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
      background: rgba(255,255,255,0.02);
      color: var(--ink);
      border-radius: 7px;
      padding: 5px 9px;
      cursor: pointer;
      font: inherit;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .settings-actions button:hover {
      border-color: rgba(138,180,255,0.42);
      color: var(--accent);
    }
    .settings-actions button.primary {
      border-color: rgba(138,180,255,0.32);
      background: rgba(138,180,255,0.08);
    }
    .settings-actions button[data-ui-action="open-settings"] {
      border-color: rgba(138,180,255,0.24);
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

    /* ---- SETTINGS PANEL OVERLAY ---- */
    .settings-overlay {
      position: fixed;
      inset: 0;
      background: rgba(5,7,10,0.72);
      backdrop-filter: blur(6px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 6vh 18px 18px;
      z-index: 120;
    }
    .settings-overlay[data-open="true"] { display: flex; }
    .settings-panel {
      width: min(960px, 96vw);
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      padding: 0;
      border-radius: 16px;
      border: 1px solid var(--tile-border-hot);
      background: rgba(15,18,24,0.98);
      box-shadow: 0 34px 90px -18px rgba(0,0,0,0.72);
      overflow: hidden;
    }
    .settings-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 13px 16px 11px;
      border-bottom: 1px solid var(--tile-border);
      flex-shrink: 0;
    }
    .settings-panel-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .settings-panel-body::-webkit-scrollbar { width: 6px; }
    .settings-panel-body::-webkit-scrollbar-thumb { background: var(--faint); border-radius: 3px; }
    .settings-panel-body::-webkit-scrollbar-thumb:hover { background: var(--dim); }
    .settings-panel-title {
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-family: var(--mono);
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--muted);
      font-size: var(--tiny-size);
    }
    .settings-panel-title strong {
      color: var(--ink);
      font-size: var(--title-size);
      letter-spacing: 0;
      text-transform: none;
      font-family: var(--sans);
    }
    .settings-panel-close {
      appearance: none;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02);
      color: var(--ink);
      border-radius: 7px;
      padding: 4px 10px;
      cursor: pointer;
      font: inherit;
    }
    .settings-panel-close:hover { border-color: rgba(138,180,255,0.42); color: var(--accent); }
    .settings-panel-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .settings-panel-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02);
    }
    .settings-panel-card .head {
      display: flex;
      align-items: center;
      gap: 7px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .settings-panel-card .head .pill {
      padding: 0px 6px; border-radius: 999px;
      background: var(--faint); color: var(--ink);
      letter-spacing: 0.4px; font-size: 9px; text-transform: none;
    }
    .settings-panel-card .detail {
      font-family: var(--mono);
      font-size: var(--tiny-size);
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
      margin-top: 3px;
    }
    .settings-panel-card .actions button {
      appearance: none;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02);
      color: var(--muted);
      border-radius: 6px;
      padding: 3px 8px;
      cursor: pointer;
      font: inherit;
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .settings-panel-card .actions button:hover { border-color: rgba(138,180,255,0.42); color: var(--accent); }
    .repobot-setup {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--muted);
    }
    .repobot-label {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }
    .repobot-label span {
      white-space: nowrap;
      color: var(--dim);
    }
    .repobot-label select {
      appearance: none;
      width: 100%;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.03);
      color: var(--ink);
      border-radius: 6px;
      padding: 4px 8px;
      font: inherit;
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .repobot-input {
      min-height: 84px;
      width: 100%;
      resize: vertical;
      border: 1px solid var(--tile-border);
      background: rgba(0,0,0,0.22);
      color: var(--ink);
      border-radius: 8px;
      padding: 10px 12px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      line-height: 1.45;
    }
    .repobot-response {
      min-height: 92px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      line-height: 1.45;
      color: var(--muted);
    }
    .repobot-history {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 170px;
      overflow-y: auto;
      padding-right: 2px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
    }
    .repobot-history-item {
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02);
      border-radius: 8px;
      padding: 8px 10px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .repobot-history-item .role {
      display: block;
      margin-bottom: 4px;
      color: var(--dim);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 9px;
    }
    .settings-panel-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-family: var(--mono);
      font-size: var(--tiny-size);
      color: var(--dim);
      border-top: 1px solid var(--tile-border);
      padding: 10px 16px 12px;
      flex-shrink: 0;
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
      padding: 4px 0;
      border-left: 2px solid var(--faint);
      padding-left: 8px;
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
    @media (max-width: 980px) {
      .settings-panel-grid { grid-template-columns: 1fr; overflow-y: auto; }
      .settings-panel-legend { grid-template-columns: 1fr; }
    }

    /* ---- HEADER STRIP (mission + objective + resume in ONE row) ---- */
    .header-strip {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.96fr) minmax(0, 1.44fr);
      gap: calc(var(--tile-gap) * 0.85);
      padding: calc(var(--pad-y) * 0.42) var(--pad-x) 0;
      min-width: 0;
      align-items: start;
    }
    .strip-cell {
      position: relative;
      padding: calc(var(--tile-pad) * 0.56);
      background: var(--tile);
      border: 1px solid var(--tile-border);
      border-radius: 10px;
      min-height: 72px;
      min-width: 0;
      display: flex; flex-direction: column; gap: 1px;
      overflow: hidden;
      align-self: start;
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
      font-size: var(--headline-size); font-weight: 500; line-height: 1.14;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .strip-subline {
      font-family: var(--mono); font-size: var(--small-size); color: var(--muted);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .strip-why {
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim);
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
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

    .strip-cell.resume { min-height: 84px; }
    .strip-cell.resume.fresh {
      min-height: 74px;
      padding-top: calc(var(--tile-pad) * 0.6);
      background: rgba(233,185,115,0.03);
      border-color: rgba(233,185,115,0.18);
    }
    .resume-freshline {
      display: inline-flex; align-items: center; gap: 8px;
      font-family: var(--mono); font-size: var(--tiny-size);
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
      padding: calc(var(--pad-y) * 0.42) var(--pad-x);
      font-family: var(--mono); font-size: var(--small-size);
      color: var(--muted);
      border-bottom: 1px solid var(--tile-border);
    }
    .git-strip .git-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 2px 8px; border-radius: 999px;
      background: var(--faint); color: var(--ink);
    }
    .git-strip .git-chip.dirty { color: var(--warn); }
    .git-strip .git-chip.ahead { color: var(--accent); }
    .git-strip .git-chip.behind { color: var(--warn); }
    .git-strip .git-subject { color: var(--dim); flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .git-strip .git-sha { color: var(--muted); font-family: var(--mono); }

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
      margin: 2px 0 8px 26px;
      font-family: var(--mono); font-size: var(--tiny-size);
      color: var(--dim);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

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
    .col:nth-child(2) .tile[data-area="next"] {
      flex: 1.72 1 0;
    }
    .col:nth-child(2) .tile.tight[data-area="changes"] {
      flex: 0.48 1 0;
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
      display: flex; flex-direction: column; gap: calc(var(--row-gap) + 2px);
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
      grid-template-columns: 3px 16px 20px 20px minmax(0, 1fr) auto;
      gap: 8px; align-items: start;
      padding: 6px 0 6px 6px;
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
    .task-toggle {
      appearance: none;
      border: 1px solid var(--tile-border);
      background: rgba(255,255,255,0.02);
      color: var(--ink);
      border-radius: 5px;
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
    .item.p-now .bar { background: var(--accent); }
    .item.p-next .bar { background: var(--muted); opacity: 0.5; }
    .item.p-blocked .bar { background: var(--warn); }
    .item.p-change .bar { background: var(--dim); opacity: 0.4; }
    .item-num {
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim);
      text-align: right;
    }
    .sigil {
      font-family: var(--mono); font-size: var(--tiny-size);
      letter-spacing: 1px; width: 12px; display: inline-block;
      color: var(--dim); cursor: help;
    }
    .sigil .on { color: var(--muted); }
    .sigil .off { color: var(--dim); opacity: 0.4; }
    .item-text {
      min-width: 0;
      overflow: hidden; text-overflow: ellipsis;
      font-size: var(--body-size); line-height: 1.35;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .item-text.wrap { white-space: normal; overflow: visible; text-overflow: clip; }
    .item-aside {
      display: inline-flex; align-items: flex-start; gap: 6px;
      font-family: var(--mono); font-size: var(--tiny-size); color: var(--dim);
      padding-top: 1px;
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
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    /* ---- AGENT CARDS ---- */
    .agent-card {
      padding: 10px; background: rgba(255,255,255,0.02);
      border: 1px solid var(--faint); border-radius: 6px;
      display: flex; flex-direction: column; gap: 6px;
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
    .agent-status { position: relative; }
    .agent-status .dot {
      transition: opacity 400ms ease, filter 400ms ease, background 400ms ease;
    }
    .agent-status.active { color: var(--accent); }
    .agent-status.active .dot { background: var(--accent); }
    .agent-status.working { color: var(--ok); }
    .agent-status.working .dot { background: var(--ok); }
    .agent-status.idle { color: var(--dim); }
    .agent-status.idle .dot { background: var(--dim); filter: saturate(0.4); }
    .agent-status.working[data-pulse="true"] .dot {
      animation: rql-pulse 600ms ease-in-out 1;
    }
    @keyframes rql-pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .agent-status .dot { transition: none; }
      .agent-status[data-pulse="true"] .dot { animation: none; }
    }
    .agent-objective {
      font-size: var(--small-size); line-height: 1.35; color: var(--muted);
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
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
      ${options.appVersion ? `<span class="app-version">v${escapeHtml(options.appVersion)}</span>` : ""}
      <button type="button" class="kbd-hint" data-palette-open title="Copy a ready-to-paste resume prompt">
        <kbd>Ctrl</kbd><kbd>K</kbd><span>resume prompts</span>
      </button>
      <div class="watch-meta">
        <span class="dot"></span>
        <span>${state.scannedFiles.length} files</span>
        <span style="color: var(--dim)">· ${escapeHtml(state.lastScan)}</span>
      </div>
      <div class="surface-controls" aria-label="Display controls">
        <button type="button" data-ui-action="refresh" aria-label="Refresh desktop" title="Refresh desktop">↻</button>
        <span class="label">Size</span>
        <button type="button" data-ui-action="smaller" aria-label="Smaller">A-</button>
        <span data-ui-scale-label>100%</span>
        <button type="button" data-ui-action="larger" aria-label="Larger">A+</button>
        <span class="label">Density</span>
        <button type="button" data-ui-density="cozy">Cozy</button>
        <button type="button" data-ui-density="wide">Wide</button>
        <button type="button" data-ui-density="compact">Compact</button>
        <div class="window-controls" aria-label="Window controls">
          <button type="button" data-window-action="minimize" aria-label="Minimize window" title="Minimize">_</button>
          <button type="button" data-window-action="maximize" aria-label="Toggle maximize" title="Maximize or restore">□</button>
          <button type="button" data-window-action="close" aria-label="Close window" title="Close">×</button>
        </div>
      </div>
    </header>
    ${renderSettingsRack(state, options.liveBridge)}
    ${renderSettingsPanel(state, options.liveBridge)}
    ${isEmptyRepo(state) ? renderEmptyState(state) : `
    <section class="header-strip">
      <div class="strip-cell mission">
        <div class="kicker">Mission <span class="meta">source: PLAN.md / README.md</span></div>
        <div class="strip-headline">${escapeHtml(state.mission)}</div>
      </div>
        <div class="strip-cell objective">
          <div class="kicker">Objective <span class="meta">${state.activeQuest.progress.done}/${state.activeQuest.progress.total} · source: PLAN.md</span></div>
          <div class="strip-headline">${escapeHtml(state.activeQuest.title)}</div>
          <div class="strip-subline">${escapeHtml(state.activeQuest.doc)}${state.activeQuest.line ? `:${state.activeQuest.line}` : ""}</div>
          <div class="strip-why">Why now: ${escapeHtml(getWhyNowLine(state))}</div>
        </div>
        <div class="strip-cell resume${isResumeFresh(state.resumeNote.since) ? " fresh" : ""}">
        ${isResumeFresh(state.resumeNote.since) ? `<div class="resume-freshline"><span class="pulse"></span>fresh · last touch ${escapeHtml(state.resumeNote.lastTouched)} · ${escapeHtml(state.resumeNote.since)}</div>` : ""}
        <div class="strip-actions">
          <button type="button" class="icon-btn warn" data-copy-context="${escapeHtml(buildContextPrompt(state))}" title="Copy resume context to clipboard">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            copy
          </button>
          <button type="button" class="icon-btn" data-palette-open title="Open resume-prompt palette (Ctrl+K)">
            ⌘K
          </button>
        </div>
          <div class="kicker">Current focus <span class="meta">· idle ${escapeHtml(state.resumeNote.since)} · source: STATE.md resume note</span></div>
          <div class="strip-headline">${escapeHtml(state.resumeNote.task)}</div>
          <div class="strip-subline">↳ ${escapeHtml(state.resumeNote.lastTouched)} · ${escapeHtml(state.resumeNote.doc)}</div>
          <div class="strip-why">Why this matters: ${escapeHtml(state.resumeNote.thought ?? getWhyNowLine(state))}</div>
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

      ${renderGitStrip(state)}

      <section class="board">
      <div class="col">
        ${renderTaskTile("now", "Now", state.now.length, state.now, true, !!state.config?.writeback, options.liveBridge)}
        ${renderBlockedTile(state.blocked, !!state.config?.writeback, options.liveBridge)}
      </div>
      <div class="col">
        ${renderTaskTile("next", "Next", state.next.length, state.next, false, !!state.config?.writeback, options.liveBridge)}
        ${renderChangesTile(state.recentChanges)}
      </div>
      <div class="col">
          ${renderAgentsTile(state)}
          ${renderDecisionsTile(state.decisions)}
        </div>
      </section>
    `}
  </div>

  <div class="palette-overlay" data-palette data-open="false" role="dialog" aria-label="Resume-prompt palette">
    <div class="palette">
      <input class="palette-input" type="text" placeholder="Type to filter prompts — press Enter to copy one" data-palette-input />
      <div class="palette-list" data-palette-list></div>
      <div class="palette-footer">
        <span><kbd>↑↓</kbd>navigate</span>
        <span><kbd>Enter</kbd>copy prompt</span>
        <span><kbd>Esc</kbd>close</span>
      </div>
    </div>
  </div>

  <div class="toast" data-toast>copied</div>

  <script id="rql-presets" type="application/json">${escapeForScriptJson(JSON.stringify(presets))}</script>
  <script id="rql-state" type="application/json">${escapeForScriptJson(stateJson)}</script>

    ${renderLiveBridge(options.liveBridge)}
    ${renderSettingsScript()}
    ${renderRepoBotScript()}
    ${renderPaletteScript()}
    ${renderTaskNavScript()}
    ${renderWritebackScript()}
  ${renderAgentPulseScript()}
  ${renderDecisionToggleScript()}
  ${renderTuneupScript()}
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
      ${renderVSCodeSection("Blocked", state.blocked.length, "#a1260d", state.blocked.map((task) => renderVSCodeBlockedRow(task)))}
        ${renderVSCodeSection("Agents", state.agents.length, undefined, state.agents.map((agent) => renderVSCodeAgent(agent)))}${renderVSCodeActivitySection(state)}
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
      <span class="tile-meta">${count} ${area === "now" ? "active" : "queued"}</span>
    </div>
    <div class="tile-body">
      ${tasks.length === 0
        ? `<div class="item"><span class="bar"></span><span class="task-toggle disabled" aria-hidden="true">◌</span><span class="sigil"></span><span class="item-num">·</span><span class="item-text">No items yet</span><span class="item-aside"></span></div>`
        : tasks.map((task, index) => renderItemRow(task, index, priorityClass, area === "now", writebackEnabled, liveBridge)).join("")}
    </div>
  </section>`;
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
    const docChip = task.doc ? `<span class="chip doc">${escapeHtml(task.doc)}</span>` : "";
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

function renderBlockedTile(tasks: BlockedTask[], writebackEnabled: boolean, liveBridge?: SurfaceHtmlOptions["liveBridge"]): string {
  return `<section class="tile tight" data-area="blocked">
    <div class="tile-header">
      <h3 class="tile-title blocked"><span class="accent-bar"></span>Blocked</h3>
      <span class="tile-meta">${tasks.length} waiting</span>
    </div>
    <div class="tile-body">
        ${tasks.length === 0
          ? `<div class="item"><span class="bar"></span><span class="task-toggle disabled" aria-hidden="true">◌</span><span class="sigil"></span><span class="item-num">·</span><span class="item-text">No blockers right now</span><span class="item-aside"></span></div>`
          : tasks.map((task, index) => `
            <div class="item p-blocked clickable"${task.doc ? ` data-open-doc="${escapeHtml(task.doc)}" data-line="${task.line ?? 1}" role="button" tabindex="0"` : ""} title="${escapeHtml(task.text)}">
              <span class="bar"></span>
              ${renderTaskToggle(task, writebackEnabled, liveBridge)}
              ${renderConfidenceSigil(task.confidence)}
              <span class="item-num">${String(index + 1).padStart(2, "0")}</span>
              <span class="item-text">${escapeHtml(task.text)}</span>
              <span class="item-aside"><span class="chip doc">${escapeHtml(task.since)}</span></span>
            </div>
            <div class="blocked-reason">↳ ${escapeHtml(task.reason)}</div>
            ${task.thought && task.thought.trim() && task.thought.trim() !== task.text.trim() ? `<div class="task-note">${escapeHtml(task.thought)}</div>` : ""}
          `).join("")}
      </div>
    </section>`;
  }

  function renderAgentsTile(state: QuestState): string {
    const agents = state.agents;
    const activity = (state.agentActivity ?? []).slice(0, 4);
    return `<section class="tile" data-area="agents">
      <div class="tile-header">
        <h3 class="tile-title agents"><span class="accent-bar"></span>Agents</h3>
        <span class="tile-meta">${agents.length} registered · heuristic feed</span>
      </div>
    <div class="tile-body">
        ${activity.length > 0 ? `<div class="settings-copy">Recent activity is inferred from file mtimes and owned areas, not direct authorship.</div>` : ""}
        ${agents.length === 0 ? `<div class="agent-card"><div class="agent-objective">No agent profiles discovered.</div></div>` : agents.map((agent) => {
          const status = resolveAgentStatus(agent, activity);
          const pulse = isAgentActive(agent.id, activity);
          const lastTask = resolveAgentTask(agent, activity);
          return `
          <div class="agent-card">
            <div class="agent-head">
              ${renderAgentChip(agent.id)}
              <span class="agent-name">${escapeHtml(agent.name)}</span>
              <span class="agent-role">${escapeHtml(agent.role)}</span>
              <span class="agent-status ${escapeHtml(status)}" title="Heuristic status from file activity, not live presence" data-pulse="${pulse ? "true" : "false"}" data-agent-id="${escapeHtml(agent.id)}" data-last-task="${escapeHtml(lastTask)}"><span class="dot"></span>${escapeHtml(renderAgentStatusLabel(status))}</span>
            </div>
            <div class="agent-objective">${escapeHtml(agent.objective)}</div>
            <div class="agent-meta">${escapeHtml(agent.file)} · ${escapeHtml(agent.area)}</div>
          </div>
        `;}).join("")}
        ${activity.length > 0 ? `<div class="activity-list">${activity.map((entry) => `
          <div class="activity-row">
            <span class="file">Likely ${escapeHtml(entry.agent)} · ${escapeHtml(entry.file)}</span>
            <span class="ago">${escapeHtml(entry.at)} · ${renderConfidenceLabel(entry.confidence)}</span>
          </div>
        `).join("")}</div>` : ""}
      </div>
    </section>`;
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

    return `<section class="git-strip" aria-label="Git context">${chips}${commit}</section>`;
  }

function renderSettingsRack(state: QuestState, liveBridge?: SurfaceHtmlOptions["liveBridge"]): string {
  const writeback = state.config?.writeback ? "on" : "off";
  const openRepoButton = liveBridge === "desktop"
    ? `<button type="button" class="primary" data-ui-action="open-repo" title="Open a repo folder (Ctrl+O)">Open Repo <span class="kbd-inline"><kbd>Ctrl</kbd><kbd>O</kbd></span></button>`
    : "";
  const standupButton = `<button type="button" data-ui-action="standup-export" title="Copy today's standup export (Ctrl+Shift+C)">Standup <span class="kbd-inline"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>C</kbd></span></button>`;
  return `<section class="settings-rack" aria-label="Settings and shortcuts">
      <div class="settings-card">
        <div class="settings-head">Settings <span class="pill">${writeback}</span></div>
        <div class="settings-copy">Repo picker and shortcuts live here so the desktop shell stays discoverable without taking over the page.</div>
        <div class="settings-actions">
          <button type="button" data-ui-action="open-settings" title="Open the settings panel">Open Settings</button>
          ${openRepoButton}
          ${standupButton}
          <button type="button" data-ui-action="refresh" title="Refresh desktop (Ctrl+R)">Refresh <span class="kbd-inline"><kbd>Ctrl</kbd><kbd>R</kbd></span></button>
        </div>
        <div class="settings-chip-row" aria-label="Shortcut reminders">
          <span class="chiplet"><strong>Ctrl+K</strong> prompt</span>
          <span class="chiplet"><strong>Ctrl+O</strong> repo</span>
          <span class="chiplet"><strong>Ctrl+Shift+C</strong> standup</span>
          <span class="chiplet"><strong>Ctrl+R</strong> refresh</span>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-head">Write-back <span class="pill">${writeback}</span></div>
        <div class="settings-copy">${state.config?.writeback ? "Checkbox toggles are live in the task rows." : "Off by default. Add <strong>\"writeback\": true</strong> to <strong>.repolog.json</strong> to enable checkbox-only edits."}</div>
        <div class="settings-copy">Only checklist items in <strong>Now</strong>, <strong>Next</strong>, and <strong>Blocked</strong> can be edited.</div>
      </div>
    </section>`;
}

function renderSettingsPanel(state: QuestState, liveBridge?: SurfaceHtmlOptions["liveBridge"]): string {
  const wbStatus = state.config?.writeback ? "on" : "off";
  const promptDir = state.config?.prompts?.dir?.trim() || "~/.repolog/prompts";
  const repobotStatus = state.config?.llm?.provider ? `selected: ${escapeHtml(state.config.llm.provider)}` : "auto-select";
  const configButton = liveBridge === "desktop"
    ? `<button type="button" data-ui-action="open-config">Open .repolog.json</button>`
    : "";
  const doctorButton = liveBridge === "desktop"
    ? `<button type="button" data-ui-action="run-doctor">Run doctor</button>`
    : "";
  const repoButton = liveBridge === "desktop"
    ? `<button type="button" data-ui-action="open-repo">Open Repo</button>`
    : "";
  const standupButton = `<button type="button" data-ui-action="standup-export">Copy standup</button>`;

  return `<div class="settings-overlay" data-settings-panel data-open="false" role="dialog" aria-label="Settings panel">
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div class="settings-panel-title"><strong>Settings</strong></div>
        <button type="button" class="settings-panel-close" data-ui-action="close-settings">Close</button>
      </div>
      <div class="settings-panel-body">
        <div class="tuneup-card" data-tuneup-card>
          <div class="tuneup-head">
            <span>Tune this repo</span>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="tuneup-meter-wrap" data-tuneup-meter-wrap style="min-width:160px">
                <div class="tuneup-meter"><div class="tuneup-meter-fill" data-tuneup-fill style="width:0%"></div></div>
                <span class="tuneup-score" data-tuneup-score>—/100</span>
              </div>
              <button type="button" data-tuneup-action="generate" style="appearance:none;border:1px solid rgba(138,180,255,0.32);background:rgba(138,180,255,0.08);color:var(--accent);border-radius:7px;padding:4px 12px;cursor:pointer;font:inherit;font-family:var(--mono);font-size:var(--tiny-size)">Analyze</button>
            </div>
          </div>
          <div class="tuneup-placeholder" data-tuneup-placeholder style="font-family:var(--mono);font-size:var(--tiny-size);color:var(--dim)">
            Click <strong style="color:var(--muted)">Analyze</strong> to score this repo's RepoLog legibility and generate a targeted fix prompt for Claude, Codex, or Gemini.
          </div>
          <textarea class="tuneup-prompt-area" data-tuneup-prompt readonly aria-label="Tuneup prompt" spellcheck="false"></textarea>
          <div class="tuneup-gaps" data-tuneup-gaps aria-label="Gap list"></div>
          <div class="tuneup-actions" data-tuneup-actions hidden>
            <button type="button" data-tuneup-action="copy">Copy prompt</button>
            <button type="button" data-tuneup-action="write-charter">Write CHARTER.md</button>
            <button type="button" data-tuneup-action="preview-gaps">Preview gaps</button>
            <span class="sep"></span>
            <button type="button" data-tuneup-action="send-claude">→ Claude</button>
            <button type="button" data-tuneup-action="send-codex">→ Codex</button>
            <button type="button" data-tuneup-action="send-gemini">→ Gemini</button>
          </div>
        </div>
        <div class="settings-panel-grid">
          <div class="settings-panel-card repobot-card">
            <div class="head">RepoBot <span class="pill">${repobotStatus}</span></div>
            <div class="detail">Ask RepoBot to inspect the repo state, explain what is off, and draft targeted markdown fixes.</div>
            <div class="repobot-setup">
              <label class="repobot-label">
                <span>Provider</span>
                <select data-repobot-provider>
                  <option value="">Auto select</option>
                </select>
              </label>
            </div>
            <textarea class="repobot-input" data-repobot-prompt rows="4" placeholder="Ask RepoBot about this repo"></textarea>
            <div class="actions">
              <button type="button" data-repobot-action="ask" class="primary">Ask RepoBot</button>
              <button type="button" data-repobot-action="clear">Clear</button>
            </div>
            <div class="repobot-response" data-repobot-response>Questions and answers will appear here.</div>
            <div class="repobot-history" data-repobot-history></div>
          </div>
          <div class="settings-panel-card">
            <div class="head">Write-back <span class="pill">${wbStatus}</span></div>
            <div class="detail">${state.config?.writeback ? "Checkbox toggles are live." : "Add <strong>\"writeback\": true</strong> to <strong>.repolog.json</strong> to enable."}</div>
            <div class="actions">
              ${configButton}${doctorButton}${standupButton}
            </div>
          </div>
          <div class="settings-panel-card">
            <div class="head">Prompt dir</div>
            <div class="detail" title="${escapeHtml(promptDir)}">${escapeHtml(promptDir)}</div>
            <div class="actions">${repoButton}</div>
          </div>
          <div class="settings-panel-card">
            <div class="head">Startup</div>
            <div class="detail">Remembers last repo in Electron userData.</div>
            <div class="actions">
              <button type="button" data-ui-action="remember-startup-root">Remember</button>
              <button type="button" data-ui-action="forget-startup-root">Forget</button>
            </div>
          </div>
        </div>
        <pre class="settings-panel-report" data-doctor-report hidden></pre>
      </div>
      <div class="settings-panel-footer">
        <span><strong>Ctrl+O</strong> open repo</span>
        <span><strong>Ctrl+K</strong> prompt palette</span>
        <span><strong>Ctrl+Shift+C</strong> standup</span>
        <span><strong>Ctrl+R</strong> refresh</span>
      </div>
    </section>
  </div>`;
}

  function renderConfidenceLabel(confidence: number): string {
    const c = Math.max(0, Math.min(1, confidence));
    if (c >= 0.84) {
      return "high confidence";
    }
    if (c >= 0.5) {
      return "medium confidence";
    }
    return "low confidence";
  }

  function renderVSCodeActivitySection(state: QuestState): string {
    const activity = (state.agentActivity ?? []).slice(0, 4);
    if (activity.length === 0) {
      return "";
    }

    return renderVSCodeSection(
      "Agent activity",
      activity.length,
      undefined,
      activity.map((entry) => `<div class="row"><span class="row-icon">↳</span><span class="row-text">${escapeHtml(entry.agent)} ${escapeHtml(entry.file)}</span><span class="row-sub">${escapeHtml(entry.at)} · ${renderConfidenceLabel(entry.confidence)}</span></div>`),
    );
  }

function renderDecisionsTile(decisions: Decision[] | undefined): string {
  if (!decisions || decisions.length === 0) return "";
  const visible = decisions.slice(0, 5);
  const hidden = decisions.slice(5);
  const hiddenRows = hidden.map((d) => renderDecisionRow(d, true)).join("");
  return `<section class="tile tight" data-area="decisions" data-decisions-expanded="false">
    <div class="tile-header">
      <h3 class="tile-title changes"><span class="accent-bar"></span>Decisions</h3>
      <span class="tile-meta">${decisions.length} logged · from STATE.md</span>
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
          if (data && data.type === "repolog:toast" && window.__rqlToast && data.message) {
            window.__rqlToast(data.message);
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
      var defaults = { scale: 1.08, density: "cozy" };
      var settingsOverlay = document.querySelector("[data-settings-panel]");
      var doctorReport = document.querySelector("[data-doctor-report]");
      var vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;

      function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
      function normalizeDensity(value) {
        if (value === "wide" || value === "spacious") return "wide";
        if (value === "cozy") return "cozy";
        return "compact";
      }
      function densityMultiplier(value) {
        if (value === "wide") return 1.1;
        if (value === "cozy") return 1;
        return 0.9;
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
          return { scale: clamp(scale, 0.92, 1.24), density: normalizeDensity(parsed.density || defaults.density) };
        } catch (_) { return defaults; }
      }
      function save(next) { localStorage.setItem(KEY, JSON.stringify(next)); }
      function apply() {
        var prefs = read();
        var density = clamp(densityMultiplier(prefs.density) * prefs.scale * viewportMultiplier(), 0.9, 1.28);
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
          scale: typeof patch.scale === "number" ? clamp(patch.scale, 0.92, 1.24) : current.scale,
          density: patch.density ? normalizeDensity(patch.density) : current.density,
        };
        save(next);
        apply();
      }
      function openSettings() {
        if (settingsOverlay) settingsOverlay.setAttribute("data-open", "true");
      }
      function closeSettings() {
        if (settingsOverlay) settingsOverlay.setAttribute("data-open", "false");
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
          if (action === "refresh") {
            if (window.repologDesktop && typeof window.repologDesktop.requestRefresh === "function") {
              window.repologDesktop.requestRefresh();
            }
            return;
          }
          if (action === "open-settings") {
            openSettings();
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
          if (action === "run-doctor") {
            if (window.repologDesktop && typeof window.repologDesktop.runDoctor === "function") {
              window.repologDesktop.runDoctor().then(function (report) {
                if (!doctorReport) return;
                doctorReport.hidden = false;
                doctorReport.setAttribute("data-visible", "true");
                doctorReport.textContent = report && report.text ? report.text : "repolog doctor returned no output";
                if (window.__rqlToast) {
                  window.__rqlToast(report && report.hasWarn ? "doctor found warnings" : "doctor is clean");
                }
              }).catch(function () {
                if (window.__rqlToast) window.__rqlToast("doctor failed");
              });
            } else if (window.__rqlToast) {
              window.__rqlToast("doctor is only available in the desktop shell");
            }
            return;
          }
          if (action === "standup-export") {
            copyStandup();
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
        if (button.hasAttribute("data-ui-density")) {
          update({ density: button.getAttribute("data-ui-density") || "wide" });
        }
      });
      document.addEventListener("keydown", function (event) {
        var prefs = read();
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === "c" || event.key === "C")) {
          event.preventDefault();
          copyStandup();
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
          })
          .catch(function () {
            showToast("write-back failed");
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
        showToast._t = setTimeout(function () { toast.setAttribute("data-visible", "false"); }, 2000);
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

function renderAgentPulseScript(): string {
  return `<script>
    (function () {
      var KEY = "repolog-agent-last-task";
      var prev = {};
      try { prev = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { prev = {}; }
      var nodes = document.querySelectorAll('.agent-status[data-agent-id]');
      var next = {};
      nodes.forEach(function (node) {
        var id = node.getAttribute('data-agent-id');
        var task = node.getAttribute('data-last-task') || "";
        next[id] = task;
        var wasTask = prev[id];
        if (node.classList.contains('working') && wasTask !== undefined && wasTask !== task) {
          node.setAttribute('data-pulse', 'true');
          setTimeout(function () { node.removeAttribute('data-pulse'); }, 650);
        }
      });
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {}
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
  if (state.scannedFiles.length < 2) return true;
  if (!state.mission.trim() && state.now.length === 0) return true;
  return false;
}

  function renderEmptyState(state: QuestState): string {
  const expectedFiles = ["PLAN.md", "STATE.md", "AGENTS.md", "CLAUDE.md"];
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

  function isAgentActive(agentId: string, activity: readonly { agent: string; file: string; at: string; confidence: number }[]): boolean {
    const entry = latestAgentActivity(agentId, activity);
    return entry ? isResumeFresh(entry.at) : false;
  }

  function resolveAgentStatus(agent: AgentProfile, activity: readonly { agent: string; file: string; at: string; confidence: number }[]): string {
    const entry = latestAgentActivity(agent.id, activity);
    if (!entry) {
      return "idle";
    }

    const age = relativeMinutes(entry.at);
    if ((typeof age === "number" && age <= 8 && entry.confidence >= 0.84) || isResumeFresh(entry.at)) {
      return "working";
    }

    if (typeof age === "number" && age <= 25 && entry.confidence >= 0.72) {
      return "active";
    }

    return "idle";
  }

  function resolveAgentTask(agent: AgentProfile, activity: readonly { agent: string; file: string; at: string; confidence: number }[]): string {
    const entry = latestAgentActivity(agent.id, activity);
    return entry ? `${entry.file} · ${entry.at}` : (agent.lastTask ?? "");
  }

  function renderAgentStatusLabel(status: string): string {
    if (status === "working") return "likely working";
    if (status === "active") return "likely active";
    return "idle";
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

function renderRepoBotScript(): string {
  return `<script>
    (function () {
      var vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
      var promptInput = document.querySelector("[data-repobot-prompt]");
      var providerSelect = document.querySelector("[data-repobot-provider]");
      var responseEl = document.querySelector("[data-repobot-response]");
      var historyEl = document.querySelector("[data-repobot-history]");
      if (!promptInput || !providerSelect || !responseEl || !historyEl) return;

      var historyKey = "repolog-repobot-history";
      var state = { providers: [], selectedProvider: "" };
      var history = [];
      try { history = JSON.parse(localStorage.getItem(historyKey) || "[]"); } catch (_) { history = []; }

      function saveHistory() {
        try { localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 12))); } catch (_) {}
      }

      function esc(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function renderHistory() {
        if (!history.length) {
          historyEl.innerHTML = '<div class="repobot-history-item"><span class="role">History</span>No questions asked yet.</div>';
          return;
        }
        historyEl.innerHTML = history.map(function (entry) {
          return '<div class="repobot-history-item">'
            + '<span class="role">' + esc(entry.role || "entry") + '</span>'
            + esc(entry.text || "")
            + '</div>';
        }).join("");
      }

      function applyStatus(data) {
        state = data || state;
        var providers = Array.isArray(state.providers) ? state.providers : [];
        providerSelect.innerHTML = '<option value="">Auto select</option>' + providers.map(function (provider) {
          var selected = state.selectedProvider && state.selectedProvider === provider.name ? ' selected' : '';
          var label = provider.label || provider.name;
          var extra = provider.available ? '' : ' (missing)';
          return '<option value="' + esc(provider.name) + '"' + selected + '>' + esc(label + extra) + '</option>';
        }).join("");
        if (state.selectedProvider) {
          providerSelect.value = state.selectedProvider;
        }
      }

      function pushHistory(role, text) {
        history.unshift({ role: role, text: text });
        history = history.slice(0, 12);
        saveHistory();
        renderHistory();
      }

      function showResult(result) {
        if (!result || !result.ok) {
          var reason = result && result.reason ? result.reason : "RepoBot request failed";
          responseEl.textContent = reason;
          pushHistory("error", reason);
          if (window.__rqlToast) window.__rqlToast(reason);
          return;
        }

        var text = result.text || "";
        responseEl.textContent = text || "RepoBot returned no response.";
        pushHistory("user", promptInput.value.trim());
        pushHistory("assistant", text || "RepoBot returned no response.");
      }

      function requestStatus() {
        if (window.repologDesktop && typeof window.repologDesktop.getRepoBotStatus === "function") {
          Promise.resolve(window.repologDesktop.getRepoBotStatus()).then(applyStatus).catch(function () {});
          return;
        }
        if (vscode) {
          vscode.postMessage({ type: "repobotStatus" });
        }
      }

      function ask() {
        var prompt = promptInput.value.trim();
        if (!prompt) {
          if (window.__rqlToast) window.__rqlToast("enter a RepoBot question first");
          return;
        }
        responseEl.textContent = "Thinking...";
        if (window.repologDesktop && typeof window.repologDesktop.askRepoBot === "function") {
          Promise.resolve(window.repologDesktop.askRepoBot(prompt)).then(showResult).catch(function (error) {
            showResult({ ok: false, reason: String(error) });
          });
          return;
        }
        if (vscode) {
          vscode.postMessage({ type: "repobotAsk", prompt: prompt });
          return;
        }
        showResult({ ok: false, reason: "RepoBot is unavailable in this shell" });
      }

      function setProvider() {
        var provider = providerSelect.value;
        if (!provider) {
          return;
        }
        if (window.repologDesktop && typeof window.repologDesktop.setRepoBotProvider === "function") {
          Promise.resolve(window.repologDesktop.setRepoBotProvider(provider)).then(requestStatus).catch(function () {});
          return;
        }
        if (vscode) {
          vscode.postMessage({ type: "repobotSetProvider", provider: provider });
        }
      }

      document.addEventListener("click", function (event) {
        var button = event.target.closest && event.target.closest("[data-repobot-action]");
        if (!button) return;
        var action = button.getAttribute("data-repobot-action");
        if (action === "ask") {
          ask();
        }
        if (action === "clear") {
          promptInput.value = "";
          responseEl.textContent = "Questions and answers will appear here.";
        }
      });

      providerSelect.addEventListener("change", setProvider);

      window.addEventListener("message", function (event) {
        var msg = event.data;
        if (!msg) return;
        if (msg.type === "repolog:repobot-status") {
          applyStatus(msg.status);
          return;
        }
        if (msg.type === "repolog:repobot-result") {
          showResult(msg.result);
        }
      });

      renderHistory();
      requestStatus();
    })();
  </script>`;
}

function renderTuneupScript(): string {
  return `<script>
    (function () {
      var vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
      var card = document.querySelector("[data-tuneup-card]");
      if (!card) return;

      var meterWrap = card.querySelector("[data-tuneup-meter-wrap]");
      var fill = card.querySelector("[data-tuneup-fill]");
      var scoreEl = card.querySelector("[data-tuneup-score]");
      var placeholder = card.querySelector("[data-tuneup-placeholder]");
      var promptArea = card.querySelector("[data-tuneup-prompt]");
      var gapsEl = card.querySelector("[data-tuneup-gaps]");
      var actionsEl = card.querySelector("[data-tuneup-actions]");

      var tuneupData = null;

      function meterColor(score) {
        if (score >= 80) return "var(--accent)";
        if (score >= 50) return "var(--warn)";
        return "var(--danger)";
      }

      function renderGap(gap) {
        var sevClass = gap.severity === "high" ? "high" : gap.severity === "med" ? "med" : "low";
        return '<div class="tuneup-gap-row">'
          + '<span class="tuneup-gap-sev ' + sevClass + '">' + gap.severity + '</span>'
          + '<span><span class="tuneup-gap-text">' + escHtml(gap.id) + '</span> '
          + '<span class="tuneup-gap-file">(' + escHtml(gap.file) + ')</span> — '
          + escHtml(gap.fix) + '</span>'
          + '</div>';
      }

      function escHtml(s) {
        return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      }

      function applyResult(data) {
        tuneupData = data;
        if (placeholder) placeholder.hidden = true;
        if (meterWrap) meterWrap.hidden = false;
        if (fill) {
          fill.style.width = Math.max(0, Math.min(100, data.score)) + "%";
          fill.style.background = meterColor(data.score);
        }
        if (scoreEl) scoreEl.textContent = data.score + "/100";
        if (promptArea) {
          promptArea.value = data.prompt || "";
          promptArea.setAttribute("data-visible", "true");
        }
        if (actionsEl) actionsEl.hidden = false;
        if (gapsEl && data.gaps && data.gaps.length > 0) {
          gapsEl.innerHTML = data.gaps.map(renderGap).join("");
        } else if (gapsEl) {
          gapsEl.innerHTML = '<div class="tuneup-placeholder">No gaps — this repo is at 100%.</div>';
        }
      }

      window.addEventListener("message", function (event) {
        var msg = event.data;
        if (!msg || msg.type !== "repolog:tuneup") return;
        applyResult(msg.data);
      });

      card.addEventListener("click", function (event) {
        var btn = event.target.closest && event.target.closest("[data-tuneup-action]");
        if (!btn) return;
        var action = btn.getAttribute("data-tuneup-action");

        if (action === "generate") {
          btn.disabled = true;
          btn.textContent = "Analyzing…";
          if (window.repologDesktop && typeof window.repologDesktop.runTuneup === "function") {
            Promise.resolve(window.repologDesktop.runTuneup()).then(function (data) {
              applyResult(data);
              btn.disabled = false;
              btn.textContent = "Re-analyze";
            }).catch(function (err) {
              if (window.__rqlToast) window.__rqlToast("tuneup failed: " + String(err));
              btn.disabled = false;
              btn.textContent = "Analyze";
            });
          } else if (vscode) {
            vscode.postMessage({ type: "runTuneup" });
            btn.disabled = false;
            btn.textContent = "Re-analyze";
          } else {
            if (window.__rqlToast) window.__rqlToast("tuneup requires the desktop or VS Code shell");
            btn.disabled = false;
            btn.textContent = "Analyze";
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
            Promise.resolve(window.repologDesktop.writeTuneupCharter(tuneupData.charter)).then(function () {
              if (window.__rqlToast) window.__rqlToast("CHARTER.md written");
            }).catch(function () {
              if (window.__rqlToast) window.__rqlToast("failed to write CHARTER.md");
            });
          } else if (vscode) {
            vscode.postMessage({ type: "writeTuneupCharter", charter: tuneupData.charter });
          } else {
            if (window.__rqlToast) window.__rqlToast("write CHARTER.md requires the desktop or VS Code shell");
          }
          return;
        }

        if (action === "preview-gaps") {
          if (!gapsEl) return;
          var visible = gapsEl.getAttribute("data-visible") === "true";
          gapsEl.setAttribute("data-visible", visible ? "false" : "true");
          btn.textContent = visible ? "Preview gaps" : "Hide gaps";
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
