# Elevated Vision: Repo Quest Log as a "MUST HAVE" Tool

## Progress So Far
Phase 1 (Frictionless Distribution) is complete. The `.vsix` packaging configuration and `.vscodeignore` are set up in `extensions/vscode/`, and the Electron builder configuration lives in the root `package.json`.

Phase 2 is partially landed: the shared renderer now includes copy-context, VS Code click-to-open hooks, and recent-change diff sparklines. The packaged Windows desktop host is also resolving the real repo root again. The remaining work is mostly visual tightening and any follow-on host polish.

This document serves as the exact roadmap for the **next coding agent** to execute Phase 2.

## User Review Required

> [!IMPORTANT]
> The next agent should focus on visual tightening and host polish, not broader scope. Keep the shared renderer and the `QuestState` contract stable.

## Proposed Changes: Phase 2 - Deep IDE Synergy

The tool must feel alive and deeply connected to the developer's workflow. This phase focuses entirely on the shared HTML renderer.

### `src/web/render.ts` (Shared UI)

#### [MODIFY] `render.ts`
- **Copy Context:** Keep the "Copy Context" button next to the Resume Anchor. It should continue to copy a pre-formatted string to the clipboard:
  > *"I am resuming work. The active quest is [Quest]. My current task is [Task] in [Doc]. The last touched file was [File]. Please read [File] and let's begin."*
- **Git Context Visualization:** Keep rendering the `+3 -1` diff data in `change.diff` as subtle green/red sparklines next to recent changes.

### `extensions/vscode/extension.js`

#### [MODIFY] `extension.js`
- **Handle Click Events:** Keep the `view.webview.onDidReceiveMessage` pipeline opening the requested file and line when the renderer sends `openDoc`.

## Verification Plan

### Automated Tests
- Run `npm run lint && npm test` to ensure no core regressions.

### Manual Verification
- **Testing Click-to-Open:** Run the extension host (F5). Click a task line in the HUD. The IDE should instantly open the corresponding file and focus the line.
- **Testing Copy Context:** Click the "Copy Context" button in the HUD and paste into a scratchpad to verify the string is formatted perfectly for an LLM agent.
