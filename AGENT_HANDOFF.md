# Handoff for Next Agent (Codex / GPT / Claude)

## Your Task

**Fix the v0.4 handler regression.** Three event handlers were removed due to an uncaught error. You must re-add them with proper error handling.

**Effort:** 20 minutes  
**Complexity:** Straightforward (all code provided)  
**Risk:** Low (isolated code, existing tests validate)

---

## What to Do

1. **Read these files FIRST:**
   - `FIX_V0.4_HANDLERS.md` — exact spec with all code to add
   - `STATE.md` — current status
   - `AGENTS.md` — your role

2. **Implement the fix in `src/web/render.ts`:**
   - Add three handler blocks (lines ~2165)
   - Add two support functions (lines ~2070)
   - **Wrap EVERYTHING in try-catch blocks** (this is why the previous attempt failed)
   - See `FIX_V0.4_HANDLERS.md` for exact code

3. **Test before submitting:**
   ```bash
   npm run build && npm run lint && npm test
   ```
   - All 49+ tests must pass
   - No TypeScript errors
   - No ESLint warnings

4. **Manual verification:**
   - Open desktop app: `npm run desktop:build` → `release/Repo Quest Log 0.0.4.exe`
   - Click "Create PLAN.md" button → should show toast
   - Click "Save settings" button → should show success/failure toast
   - Ctrl+K should still work (keyboard shortcut, separate from click handler)

5. **Update STATE.md:**
   - Add a "Last Session" entry (date 2026-04-22) describing what you fixed
   - Include: functions added, tests run, build verified

6. **Do NOT commit.** The user will commit after review.

---

## Key Constraints

- ✅ **Do wrap every new handler in try-catch.** If a handler throws, it kills the entire click listener.
- ✅ **Check for function existence before calling.** `typeof window.repologDesktop.initTemplate === "function"` is mandatory.
- ✅ **Handle vscode being undefined.** Don't assume `vscode` exists; check `vscode && typeof vscode.postMessage === "function"`.
- ✅ **All 42 existing tests must still pass.** Don't break v0.3 features.
- ❌ **Don't add new dependencies.** Use what exists.
- ❌ **Don't skip the error handling.** That's why the previous attempt failed.

---

## Success Criteria (You're Done When)

- [ ] `npm run build` succeeds
- [ ] `npm run lint` succeeds
- [ ] `npm test` passes all 49+ tests
- [ ] Desktop app responds to clicks (buttons work)
- [ ] Toast messages appear when buttons clicked (both success and error cases)
- [ ] Wizard shows on `noisy` fixture (PLAN.md missing)
- [ ] Wizard does NOT show on `healthy` fixture (PLAN.md exists)
- [ ] Desktop build produces exe without errors
- [ ] No regressions: Ctrl+K still works, all v0.3 features intact

---

## If You Get Stuck

1. Check `FIX_V0.4_HANDLERS.md` — all code is provided; just copy it
2. If a test fails, DON'T work around it; fix the root cause
3. If `window.repologDesktop` is undefined, check `apps/desktop/preload.cjs` (it's already correct; verify preload functions are exposed)
4. If `vscode` is undefined in desktop context, that's expected; handle gracefully (code already does)

---

## What Not to Do

- ❌ Don't rewrite the entire click listener
- ❌ Don't add new features beyond the three handlers
- ❌ Don't skip the build/lint/test gate
- ❌ Don't assume error handling will happen elsewhere
- ❌ Don't commit to git

---

## Files You'll Touch

- `src/web/render.ts` — add handlers + support functions
- `STATE.md` — update resume note (when done)
- No other files need changes

---

## Your Starting Point

```
cd "D:\Repo Quest Log"
git status  # You'll see src/web/render.ts is modified (handlers removed)
```

**Ready? Start with FIX_V0.4_HANDLERS.md. Follow it exactly.**
