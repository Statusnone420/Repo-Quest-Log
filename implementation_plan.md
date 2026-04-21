# Elevated Vision: Repo Quest Log as a "MUST HAVE" Tool

## Progress So Far
Phase 1 (Frictionless Distribution) is complete. The `.vsix` packaging configuration and `.vscodeignore` have been set up in `extensions/vscode/`, and the Electron builder configuration is inside the root `package.json`. 

This document serves as the exact roadmap for the **next coding agent** to execute Phase 2.

## User Review Required

> [!IMPORTANT]
> The next agent will implement Phase 2: Deep IDE Synergy. This is where the tool becomes a "MUST HAVE" by deeply integrating with the developer's environment. Review the proposed changes below.

## Proposed Changes: Phase 2 - Deep IDE Synergy

The tool must feel alive and deeply connected to the developer's workflow. This phase focuses entirely on the shared HTML renderer.

### `src/web/render.ts` (Shared UI)

#### [MODIFY] `render.ts`
- **Click-to-Open Links:** Transform task lines and file references into clickable entities. In the VS Code shell, clicking a task under "Now" should emit a message to the host to open the file (e.g., `PLAN.md`) and jump the cursor to that exact line. 
  - *Implementation details:* We have `task.doc` and `task.line` in the `QuestState`. Wrap the text in a subtle anchor or button that triggers an event (e.g., `<button data-open-doc="${task.doc}" data-line="${task.line}">`).
- **Agent Handoff Button:** Add a sleek "Copy Context" button next to the Resume Anchor. Clicking it copies a pre-formatted string to the clipboard:
  > *"I am resuming work. The active quest is [Quest]. My current task is [Task] in [Doc]. The last touched file was [File]. Please read [File] and let's begin."*
- **Git Context Visualization:** Parse the `+3 -1` diff data (if available in `change.diff`) and render it as subtle green/red sparklines next to recent changes.

### `extensions/vscode/extension.js`

#### [MODIFY] `extension.js`
- **Handle Click Events:** Add an event listener to the `view.webview.onDidReceiveMessage` pipeline. When the renderer sends an `openDoc` message, use `vscode.workspace.openTextDocument()` and `vscode.window.showTextDocument()` to open the file and navigate to the specified line.

## Verification Plan

### Automated Tests
- Run `npm run lint && npm test` to ensure no core regressions.

### Manual Verification
- **Testing Click-to-Open:** Run the extension host (F5). Click a task line in the HUD. The IDE should instantly open the corresponding file and focus the line.
- **Testing Copy Context:** Click the "Copy Context" button in the HUD and paste into a scratchpad to verify the string is formatted perfectly for an LLM agent.
