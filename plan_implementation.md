# plan_implementation.md — v0.5 Agents + Theme Pass

**Owner:** AGENTS.md (Codex executes). Claude drafted spec.
**Gate:** `npm run build && npm run lint && npm test` must pass after every pass.
**Do not commit.** Human audits and commits.

---

## Objective

Three things wrong right now:

1. **Agents section lies.** Mtime heuristics say Gemini is working when Claude and Codex are. The "heuristic feed" rows are noise, not signal. Tear it out and replace with honest data from the actual .md files.
2. **Theme doesn't propagate into settings panel.** Hardcoded bg colors on palette/toast elements break the illusion. Also: user wants Light/Dark only (not Slate/Dim), a font picker, and font size that actually works past 126%.
3. **No LLM layer.** An on-demand "Digest" button should bundle all repo context → POST to OpenRouter (free model, user-supplied key) → display a 3-part summary in the agents panel. No auto-fire, no token churn, no chat.

---

## Pass 1 — Theme: Light/Dark, Font Picker, Size Fix

### 1a. Add Light theme + fix hardcoded colors

**File:** `src/web/render.ts`

**Add after existing `[data-theme="dim"]` block (after line ~78):**

```css
[data-theme="light"] {
  --bg: #f4f5f7;
  --tile: #ffffff;
  --tile-border: rgba(0,0,0,0.08);
  --accent: #0a5fd6;
  --accent-soft: rgba(10,95,214,0.09);
  --ink: #111318;
  --muted: rgba(0,0,0,0.54);
  --dim: rgba(0,0,0,0.36);
  --faint: rgba(0,0,0,0.08);
  --warn: #b45309;
  --bg-elevated: #ffffff;
  --dot-idle: rgba(0,0,0,0.22);
}
```

**Add `--bg-elevated` to existing dark/slate/dim themes (root and each data-theme block):**
- `:root` → add `--bg-elevated: #1a1d23;` and `--dot-idle: rgba(220,230,245,0.28);`
- `[data-theme="slate"]` → add `--bg-elevated: #161b22;`
- `[data-theme="dim"]` → add `--bg-elevated: #1c1a17;`

**Fix hardcoded colors (replace with CSS vars):**

| Location (approx line) | From | To |
|---|---|---|
| `.palette { background: #11141a }` (~1121) | `#11141a` | `var(--bg-elevated)` |
| `.toast { background: #11141a }` (~1170) | `#11141a` | `var(--bg-elevated)` |
| `.badge { background: #3f3f41 }` (~1388) | `#3f3f41` | `var(--faint)` |
| `.toast { border: ... rgba(255,255,255,0.07) }` (~1170) | `rgba(255,255,255,0.07)` | `var(--tile-border)` |
| `.palette { border: ... rgba(255,255,255,0.06) }` (~1121) | literal rgba | `var(--tile-border)` |

**Do NOT touch** `.status-bar { background: #007acc }` — that's VS Code chrome, intentional.

### 1b. Remove Slate/Dim from settings UI; add Light button

**File:** `src/web/render.ts` (~lines 1789–1797)

Replace the three theme buttons with two:

```html
<button type="button" data-ui-theme="dark" aria-pressed="false">
  <span class="theme-swatch" style="background:#0b0d10;border-color:#8ab4ff"></span>Dark
</button>
<button type="button" data-ui-theme="light" aria-pressed="false">
  <span class="theme-swatch" style="background:#f4f5f7;border-color:#0a5fd6"></span>Light
</button>
```

**Update theme normalization** in `renderSettingsScript()` (~line 2051):
```javascript
function normalizeTheme(t) {
  return (t === "light") ? "light" : "dark";
}
```
Existing stored values of "slate" or "dim" fall back to "dark" via this normalization.

### 1c. Fix font size cap (the 126% ceiling bug)

**File:** `src/web/render.ts` (~line 2078)

Change:
```javascript
var density = clamp(densityMultiplier(prefs.density) * prefs.scale * viewportMultiplier(), 0.9, 1.32);
```
To:
```javascript
var density = clamp(densityMultiplier(prefs.density) * prefs.scale * viewportMultiplier(), 0.9, 1.5);
```

That's the entire fix. The user scale already reaches 1.5 (150%) but the final density was clamped to 1.32 (~126%). Raising the ceiling to 1.5 lets the full scale range render.

### 1d. Add font picker

**File:** `src/web/render.ts`

**Add CSS variable to `:root`:**
```css
--rql-font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```
**Add to `body` style rule:**
```css
body { font-family: var(--rql-font); }
```

**Add font picker UI** in settings panel, in the DENSITY card or immediately after (~line 1798):

```html
<div class="settings-panel-card">
  <div class="head">Font</div>
  <div class="detail">Applied across the entire HUD.</div>
  <div class="btn-group">
    <button type="button" data-ui-font="system" aria-pressed="true">System</button>
    <button type="button" data-ui-font="mono" aria-pressed="false">Mono</button>
    <button type="button" data-ui-font="serif" aria-pressed="false">Serif</button>
  </div>
</div>
```

**Font stacks to use:**
- `system`: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- `mono`: `"Cascadia Code", "JetBrains Mono", "Consolas", monospace`
- `serif`: `Georgia, "Times New Roman", serif`

**Add to `apply()` function and `update()` handler in `renderSettingsScript()`:**
```javascript
var fontMap = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"Cascadia Code", "JetBrains Mono", "Consolas", monospace',
  serif: 'Georgia, "Times New Roman", serif'
};
document.documentElement.style.setProperty("--rql-font", fontMap[prefs.font] || fontMap.system);
// sync aria-pressed on [data-ui-font] buttons same pattern as theme buttons
```

**Persist in localStorage prefs** alongside theme/density/scale. Key: `font`.

---

## Pass 2 — Agents Section: Honest Roster

### 2a. Parse `## Current Task` and `## Last Task` from agent .md files

**File:** `src/engine/agents.ts`

Add two new fields to `AgentProfile` extraction (in `src/engine/types.ts` first).

**types.ts — add to `AgentProfile` interface:**
```typescript
currentTask?: string;   // parsed from ## Current Task section body (first non-empty paragraph)
lastTask?: string;      // parsed from ## Last Task section body
```

**agents.ts — in the parsing function, after extracting `objective`:**
```typescript
const currentTaskMatch = raw.match(/^##\s+Current Task\s*\n([\s\S]*?)(?=\n##|\s*$)/m);
agent.currentTask = currentTaskMatch
  ? currentTaskMatch[1].trim().split('\n').find(l => l.trim()) ?? undefined
  : undefined;

const lastTaskMatch = raw.match(/^##\s+Last Task\s*\n([\s\S]*?)(?=\n##|\s*$)/m);
agent.lastTask = lastTaskMatch
  ? lastTaskMatch[1].trim().split('\n').find(l => l.trim()) ?? undefined
  : undefined;
```

### 2b. Add DigestResult type and lastDigest to QuestState

**File:** `src/engine/types.ts`

```typescript
export interface DigestResult {
  summary: string;
  stuck: string;
  next: string;
  generatedAt: string;   // ISO timestamp
  model: string;
}
```

Add to `QuestState`:
```typescript
lastDigest?: DigestResult;
```

### 2c. Load persisted digest into scan

**File:** `src/engine/scan.ts`

After building QuestState, before returning:
```typescript
const digestPath = path.join(repoRoot, '.repolog', 'digest.json');
if (fs.existsSync(digestPath)) {
  try {
    state.lastDigest = JSON.parse(fs.readFileSync(digestPath, 'utf8')) as DigestResult;
  } catch { /* corrupt digest, ignore */ }
}
```

### 2d. Rewrite `renderAgentsTile()` in render.ts

**File:** `src/web/render.ts` — replace entire `renderAgentsTile()` function (~lines 1598–1632).

**New structure:**

```
— AGENTS                          3 registered   [✦ Digest]
─────────────────────────────────────────────────────────
 [CX]  Codex   Implementer of Backend Code...   • idle
       All 6 diamond gates closed. Ready for release.
       AGENTS.md · src/engine/** — parser, normalizer...
─────────────────────────────────────────────────────────
 [CL]  Claude  Planner + implementer (unlocked) • idle
       v0.4 diamond gates are closed and ready for human review.
       CLAUDE.md · PRD.md, PLAN.md, STATE.md...
─────────────────────────────────────────────────────────
 [GM]  Gemini  High-End Planner & Architect     • idle
       Architect the v0.4 implementation pass...
       GEMINI.md · System Architecture & Design...
─────────────────────────────────────────────────────────
 Last digest · 14m ago
 v0.4 gates are all closed. Repo is release-ready.
 Stuck: npm package needs npm org + CI secrets.
 Next: npm run desktop:build → smoke test → tag v0.4.0.
```

**Key rules for the new render function:**
- **Blurb text**: use `agent.currentTask` if present, else `agent.objective` (truncated to 120 chars). Never show a confidence score.
- **Status logic** (no mtime heuristics):
  - `"working"` — only when a digest API call is in flight (set via `data-digest-running` on the tile)
  - `"active"` — only when `lastDigest` exists and `generatedAt` is within last 60 minutes
  - `"idle"` — everything else
- **Tile header** right side: replace `"heuristic feed"` meta span with a Digest button:
  ```html
  <button class="digest-btn" data-action="run-digest" 
          title="${hasKey ? 'Run AI digest of current repo state' : 'Add OpenRouter key in Settings to enable'}">
    ✦ Digest
  </button>
  ```
  Button is visually dimmed (opacity 0.4, cursor not-allowed) when no API key. `hasKey` is passed as a render param — add `openrouterConfigured: boolean` to the render context (read from a global set at init time).
- **Digest result panel** (below agent cards): rendered only if `state.lastDigest` exists:
  ```html
  <div class="digest-panel">
    <span class="digest-label">Last digest · ${relativeTime(state.lastDigest.generatedAt)}</span>
    <p class="digest-summary">${escapeHtml(state.lastDigest.summary)}</p>
    <p class="digest-detail"><strong>Stuck:</strong> ${escapeHtml(state.lastDigest.stuck)}</p>
    <p class="digest-detail"><strong>Next:</strong> ${escapeHtml(state.lastDigest.next)}</p>
    <span class="digest-model">${escapeHtml(state.lastDigest.model)}</span>
  </div>
  ```
  If no digest: show `<p class="digest-empty">Press Digest for an AI summary · requires OpenRouter key in Settings</p>`.

- **Remove entirely:** the `activity` array render, confidence label rows ("Likely claude · PLAN.md · 10m · medium confidence"), and the description block ("Recent activity is inferred from file mtimes...").

### 2e. Remove `agentActivity` from the render pipeline

The `agentActivity` field in QuestState and `inferAgentActivity()` in `activity.ts` can stay in the engine (don't break the schema), but **do not render it**. The new agents tile does not consume `state.agentActivity`. This avoids breaking tests while killing the visible lie.

---

## Pass 3 — OpenRouter Integration

### 3a. Storage — API key goes in Electron userData, NOT `.repolog.json`

The `.repolog.json` file is repo-local and may be committed to git. API keys must never land there.

**Storage path:** `${app.getPath('userData')}/openrouter.json`
**Shape:** `{ key: string, model: string }`
**Default model:** `"nvidia/nemotron-3-super-120b-a12b:free"`

### 3b. New IPC handlers in `apps/desktop/main.cjs`

Add three handlers after the existing `repolog:run-tuneup` handler (~line 562):

**Handler 1 — save config:**
```javascript
ipcMain.handle("repolog:save-openrouter-config", async (_event, { key, model }) => {
  const orPath = path.join(app.getPath("userData"), "openrouter.json");
  fs.writeFileSync(orPath, JSON.stringify({ key: key ?? "", model: model ?? "nvidia/nemotron-3-super-120b-a12b:free" }, null, 2));
  openrouterConfig = { key: key ?? "", model: model ?? "nvidia/nemotron-3-super-120b-a12b:free" };
  return { success: true };
});
```

**Handler 2 — get config (key masked for security):**
```javascript
ipcMain.handle("repolog:get-openrouter-config", async () => {
  return {
    configured: !!(openrouterConfig?.key),
    model: openrouterConfig?.model ?? "nvidia/nemotron-3-super-120b-a12b:free",
    keyPreview: openrouterConfig?.key ? "sk-or-••••••" + openrouterConfig.key.slice(-4) : ""
  };
});
```

**Handler 3 — run digest:**
```javascript
ipcMain.handle("repolog:run-digest", async () => {
  if (!openrouterConfig?.key) return { error: "No OpenRouter API key configured." };
  if (!currentRepoRoot) return { error: "No repo open." };

  // Bundle context
  const read = (f) => { try { return fs.readFileSync(path.join(currentRepoRoot, f), "utf8"); } catch { return "(not found)"; } };
  const agentFiles = ["CLAUDE.md","AGENTS.md","GEMINI.md","CODEX.md"].map(f => {
    const c = read(f); return c !== "(not found)" ? `### ${f}\n${c}` : null;
  }).filter(Boolean).join("\n\n");

  // Recent changes via git log
  let gitLog = "";
  try {
    gitLog = require("child_process").execSync(
      "git log --oneline --since=7.days --format=\"%h %s (%ar)\" --max-count=20",
      { cwd: currentRepoRoot, encoding: "utf8", timeout: 8000 }
    );
  } catch { gitLog = "(git log unavailable)"; }

  const prompt = `You are analyzing a software repo's planning documents. Return ONLY valid JSON.

## PLAN.md
${read("PLAN.md")}

## STATE.md
${read("STATE.md")}

## Agent Files
${agentFiles}

## Recent git commits (last 7 days)
${gitLog || "(none)"}

Return this exact JSON shape, nothing else:
{
  "summary": "2-3 sentences on where things stand right now",
  "stuck": "what is actually blocked or needs attention (1 sentence, or 'Nothing blocked' if clean)",
  "next": "the single most logical next action (1 sentence)"
}`;

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterConfig.key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/statusnone420/repo-quest-log",
        "X-Title": "RepoLog"
      },
      body: JSON.stringify({
        model: openrouterConfig.model ?? "nvidia/nemotron-3-super-120b-a12b:free",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `OpenRouter error ${resp.status}: ${errText.slice(0, 200)}` };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    const result = {
      summary: parsed.summary ?? "No summary returned.",
      stuck: parsed.stuck ?? "Unknown.",
      next: parsed.next ?? "Unknown.",
      generatedAt: new Date().toISOString(),
      model: openrouterConfig.model ?? "nvidia/nemotron-3-super-120b-a12b:free"
    };

    // Persist to .repolog/digest.json
    const digestDir = path.join(currentRepoRoot, ".repolog");
    if (!fs.existsSync(digestDir)) fs.mkdirSync(digestDir, { recursive: true });
    fs.writeFileSync(path.join(digestDir, "digest.json"), JSON.stringify(result, null, 2));

    return { result };
  } catch (err) {
    return { error: `Digest failed: ${err.message}` };
  }
});
```

**Module-level setup in main.cjs** (add near top, after existing state vars):
```javascript
let openrouterConfig = { key: "", model: "nvidia/nemotron-3-super-120b-a12b:free" };
// Load on startup:
try {
  const orPath = path.join(app.getPath("userData"), "openrouter.json");
  if (fs.existsSync(orPath)) openrouterConfig = JSON.parse(fs.readFileSync(orPath, "utf8"));
} catch {}
```

**Pass `openrouterConfig.key` existence into the initial HTML payload** so the renderer knows whether the Digest button should be active. Add `openrouterConfigured: !!(openrouterConfig?.key)` to whatever context object is sent with the initial scan result.

### 3c. Preload bridge — `apps/desktop/preload.cjs`

Add to the `contextBridge.exposeInMainWorld("repologDesktop", { ... })` block:

```javascript
saveOpenRouterConfig(payload) {
  return ipcRenderer.invoke("repolog:save-openrouter-config", payload);
},
getOpenRouterConfig() {
  return ipcRenderer.invoke("repolog:get-openrouter-config");
},
runDigest() {
  return ipcRenderer.invoke("repolog:run-digest");
},
```

### 3d. Settings panel — OpenRouter fields

**File:** `src/web/render.ts`

Add a new card in the settings grid (after DENSITY card, ~line 1806):

```html
<div class="settings-panel-card" data-card="openrouter">
  <div class="head">OpenRouter <span class="pill">optional</span></div>
  <div class="detail">Powers the Digest button. Get a free key at openrouter.ai.</div>
  <div class="field">
    <label>API Key</label>
    <input type="password" data-or-field="key" placeholder="sk-or-..." 
           value="" autocomplete="off" spellcheck="false" />
  </div>
  <div class="field">
    <label>Model</label>
    <input type="text" data-or-field="model" 
           placeholder="nvidia/nemotron-3-super-120b-a12b:free"
           value="" spellcheck="false" />
  </div>
  <div class="actions">
    <button type="button" data-action="save-openrouter">Save key</button>
    <span class="or-status" data-or-status></span>
  </div>
</div>
```

**Script logic in `renderSettingsScript()`** — add OpenRouter init + save handler:

On settings open, call `window.repologDesktop.getOpenRouterConfig()` and populate:
- `[data-or-field="key"]` → show `keyPreview` (masked), or empty
- `[data-or-field="model"]` → show current model
- `[data-or-status]` → show "✓ Configured" (green) or "Not configured" (muted)

On `[data-action="save-openrouter"]` click:
- Read key and model field values
- Call `window.repologDesktop.saveOpenRouterConfig({ key, model })`
- Update `[data-or-status]` to "Saved ✓"
- Re-enable Digest button if key is non-empty (update `data-or-configured` on body or tile)

### 3e. Digest button interaction in renderer script

**File:** `src/web/render.ts` — in the event delegation section of `renderSettingsScript()`:

```javascript
if (action === "run-digest") {
  var btn = e.target.closest("[data-action='run-digest']");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "⏳ Running…";
  window.repologDesktop.runDigest().then(function(res) {
    btn.disabled = false;
    btn.textContent = "✦ Digest";
    if (res.error) {
      // show toast error
      showToast(res.error, "error");
    } else {
      // trigger a rescan so the digest panel re-renders with new data
      window.repologDesktop.requestRefresh();
    }
  }).catch(function(err) {
    btn.disabled = false;
    btn.textContent = "✦ Digest";
    showToast("Digest failed: " + err.message, "error");
  });
}
```

---

## Pass 4 — CSS: Agents Tile Styling

**File:** `src/web/render.ts` — add to the CSS section:

```css
.digest-panel {
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--faint);
  border-radius: 4px;
  border-left: 2px solid var(--accent);
}
.digest-label { font-size: var(--tiny-size); color: var(--dim); display: block; margin-bottom: 4px; }
.digest-summary { margin: 0 0 4px; font-size: var(--small-size); color: var(--ink); }
.digest-detail { margin: 0 0 2px; font-size: var(--small-size); color: var(--muted); }
.digest-model { font-size: var(--tiny-size); color: var(--dim); }
.digest-empty { font-size: var(--small-size); color: var(--dim); margin: 8px 0 0; }
.digest-btn {
  background: none;
  border: 1px solid var(--tile-border);
  border-radius: 4px;
  color: var(--accent);
  font-size: var(--tiny-size);
  padding: 2px 8px;
  cursor: pointer;
}
.digest-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.digest-btn:not(:disabled):hover { background: var(--accent-soft); }
```

---

## Build Gate (run after every pass)

```
npm run build && npm run lint && npm test
```

67 tests must still pass. No new test files required for this pass — but if you add the `currentTask`/`lastTask` parsing, add 2–3 cases to `tests/agents.test.ts` (or create it if it doesn't exist).

---

## Pass Order (strict — do not skip ahead)

1. Pass 1 (theme + font + size fix) — self-contained, no new types
2. Pass 2a–2b (types.ts: new fields) — prerequisite for 2c–2e
3. Pass 2c–2e (agents.ts parse, scan load, render rewrite)
4. Pass 3a–3b (main.cjs: OpenRouter storage + handlers)
5. Pass 3c (preload bridge)
6. Pass 3d–3e (settings fields + digest button script)
7. Pass 4 (CSS additions)
8. Build gate — full pass

---

## What NOT to do

- Do not add `openrouterKey` to `RepoConfig` or `.repolog.json`. Key lives in Electron userData only.
- Do not auto-fire the digest on startup or on file change. On-demand only.
- Do not add a chat interface or back-and-forth loop. One call, one result, done.
- Do not modify `AGENTS.md` content beyond updating `## Current Task` and `## Last Task` when this pass completes.
- Do not touch `docs/design/**`.
- Do not commit.
