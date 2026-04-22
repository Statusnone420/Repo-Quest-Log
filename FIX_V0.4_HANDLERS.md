# v0.4 Handler Implementation Fix

**Status:** Critical bug fix required  
**Branch:** main  
**Previous attempt:** 65825c9 — added handlers but caused click event regression  
**Current state:** Handlers removed, UI stable, features disabled  

---

## The Problem

In commit 65825c9, three event handlers were added to `src/web/render.ts`:
1. `init-plan` / `init-state` / `init-config` (wizard buttons)
2. `dismiss-wizard` (skip setup)
3. `save-config` (settings form save)

**Result:** One of these handlers threw an uncaught error in the click event listener (line 2110), which silenced the ENTIRE listener. No buttons worked except Ctrl+K (keyboard handler separate).

**Root cause candidates:**
- `window.repologDesktop.initTemplate()` doesn't exist or throws
- `window.repologDesktop.writeConfig()` doesn't exist or throws
- `window.repologDesktop.dismissWizard()` doesn't exist or throws
- `vscode` object is undefined and code tries to call it
- `collectConfig()` throws when DOM elements aren't found

---

## What You Must Do

### Part 1: Re-implement the Three Handlers (50 lines total)

**Location:** `src/web/render.ts` line ~2165 (in the main click listener, inside the `if (button.hasAttribute("data-ui-action"))` block)

**Handler 1: Init templates (init-plan, init-state, init-config)**
```javascript
if (action === "init-plan" || action === "init-state" || action === "init-config") {
  try {
    var target = action === "init-plan" ? "plan" : action === "init-state" ? "state" : "config";
    if (window.repologDesktop && typeof window.repologDesktop.initTemplate === "function") {
      window.repologDesktop.initTemplate(target).then(function () {
        if (window.__rqlToast) window.__rqlToast(target.toUpperCase() + " created ✓");
      }).catch(function (error) {
        if (window.__rqlToast) window.__rqlToast("Failed to create " + target + ": " + String(error).slice(0, 50));
      });
    } else if (vscode && typeof vscode.postMessage === "function") {
      vscode.postMessage({ type: "initTemplate", target: target });
      if (window.__rqlToast) window.__rqlToast("Creating " + target + "…");
    } else {
      if (window.__rqlToast) window.__rqlToast("Init not available in this shell");
    }
  } catch (e) {
    if (window.__rqlToast) window.__rqlToast("Error: " + String(e).slice(0, 50));
  }
  return;
}
```

**Handler 2: Dismiss wizard**
```javascript
if (action === "dismiss-wizard") {
  try {
    if (window.repologDesktop && typeof window.repologDesktop.dismissWizard === "function") {
      window.repologDesktop.dismissWizard();
    }
    closeSettings();
  } catch (e) {
    if (window.__rqlToast) window.__rqlToast("Error dismissing wizard: " + String(e).slice(0, 50));
  }
  return;
}
```

**Handler 3: Save config**
```javascript
if (action === "save-config") {
  try {
    saveConfig();
  } catch (e) {
    if (window.__rqlToast) window.__rqlToast("Error saving config: " + String(e).slice(0, 50));
  }
  return;
}
```

### Part 2: Re-add Support Functions (25 lines)

**Location:** `src/web/render.ts` line ~2070 (before the click listener)

```javascript
function collectConfig() {
  try {
    function valueFor(field) {
      var node = document.querySelector('[data-config-field="' + field + '"]');
      return node;
    }
    var excludesNode = valueFor("excludes");
    var promptsNode = valueFor("promptsDir");
    var debounceNode = valueFor("watchDebounce");
    var writebackNode = valueFor("writeback");
    var reportNode = valueFor("reportFileChanges");
    var excludes = [];
    if (excludesNode && typeof excludesNode.value === "string") {
      excludes = excludesNode.value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    }
    return {
      excludes: excludes,
      writeback: !!(writebackNode && writebackNode.checked),
      prompts: { dir: promptsNode && typeof promptsNode.value === "string" ? promptsNode.value.trim() : "" },
      watch: {
        debounce: Math.max(100, Math.min(10000, parseInt(debounceNode && debounceNode.value ? debounceNode.value : "500", 10) || 500)),
        reportFileChanges: !!(reportNode && reportNode.checked),
      },
    };
  } catch (e) {
    if (window.__rqlToast) window.__rqlToast("Error reading config: " + String(e).slice(0, 50));
    return { excludes: [], writeback: false, prompts: { dir: "" }, watch: { debounce: 500, reportFileChanges: true } };
  }
}

function saveConfig() {
  try {
    var payload = collectConfig();
    if (window.repologDesktop && typeof window.repologDesktop.writeConfig === "function") {
      return Promise.resolve(window.repologDesktop.writeConfig(payload)).then(function (result) {
        if (window.__rqlToast) {
          window.__rqlToast(result && result.success ? "Settings saved ✓" : "Settings save failed");
        }
      }).catch(function (error) {
        if (window.__rqlToast) window.__rqlToast("Save failed: " + String(error).slice(0, 50));
      });
    }
    if (vscode && typeof vscode.postMessage === "function") {
      vscode.postMessage({ type: "writeConfig", payload: payload });
      if (window.__rqlToast) window.__rqlToast("Settings sent to editor");
      return Promise.resolve();
    }
    if (window.__rqlToast) window.__rqlToast("Settings save unavailable");
    return Promise.resolve();
  } catch (e) {
    if (window.__rqlToast) window.__rqlToast("Save error: " + String(e).slice(0, 50));
    return Promise.resolve();
  }
}
```

### Part 3: Verify & Test

**Build gate (MUST PASS before done):**
```bash
npm run build && npm run lint && npm test
```

**Functional test (on both fixture repos):**
1. `tests/fixtures/healthy/` (PLAN.md exists, wizard should NOT show)
2. `tests/fixtures/noisy/` (PLAN.md missing, wizard should show)

**Manual testing:**
- [ ] Open desktop app
- [ ] Click "Open Settings" — opens settings panel
- [ ] Try to click "Open Repo" — should work
- [ ] Try "Create PLAN.md" button — should show toast
- [ ] Try "Save settings" button — should show success/failure toast
- [ ] Ctrl+K still works (verify no regression)

**Desktop build check:**
```bash
npm run desktop:build
# Should produce: release/Repo Quest Log 0.0.4.exe (no errors)
```

---

## Key Requirements

1. **All changes wrapped in try-catch blocks.** Do not let errors bubble up and kill the listener.
2. **Check for function existence before calling.** `typeof window.repologDesktop.initTemplate === "function"` is not enough if the function throws; assume it might fail.
3. **Graceful fallback for vscode.** If `vscode` is undefined, catch it. Don't assume `vscode.postMessage` exists.
4. **Error toasts are brief** (max 50 chars) so they don't spam or confuse the user.
5. **No new dependencies.** Use what's already imported.
6. **All 42 existing tests must still pass.** Don't break other functionality.

---

## Success Criteria

- [ ] `npm run build` succeeds (TypeScript clean)
- [ ] `npm run lint` succeeds (no ESLint errors)
- [ ] `npm test` passes all 49+ tests
- [ ] Desktop app opens and responds to clicks (wizard buttons work)
- [ ] Settings save button works (no errors, shows success toast)
- [ ] Wizard shows when PLAN.md is missing (on `noisy` fixture)
- [ ] Desktop build produces exe without errors
- [ ] No regressions: Ctrl+K still works, all v0.3 features intact

---

## Handoff Notes

- **Do not skip try-catch.** The previous agent's code was missing error handling.
- **Test on noisy fixture first.** It's easier to verify wizard shows when files are missing.
- **If tests fail, don't commit.** Fix the root cause, don't work around it.
- **Check preload.cjs.** Make sure `window.repologDesktop.initTemplate`, `writeConfig`, and `dismissWizard` are all exposed (they are in current code, but verify).

---

**Owner:** Next agent (AGENTS.md)  
**Status:** Ready for implementation  
**Estimated effort:** 15–20 minutes + 10 min testing
