---
name: RepoLog
description: Local-first repo memory HUD for AI-assisted coding workflows.
colors:
  canvas-dark: "#070d12"
  chrome-dark: "#060b10"
  surface: "#10181d"
  surface-raised: "#141b20"
  surface-modal: "#0d141b"
  ink: "#e8edf2"
  muted: "#aeb8c2"
  dim: "#78828d"
  primary: "#58a6ff"
  primary-light: "#79c0ff"
  primary-action: "#2f7fdc"
  success: "#73df73"
  warning: "#e6bf45"
  danger: "#ff5555"
  canvas-light: "#f0f2f5"
  ink-light: "#111318"
typography:
  headline:
    fontFamily: "Inter, Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "0"
  title:
    fontFamily: "Inter, Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13.5px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Inter, Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0"
  label:
    fontFamily: "JetBrains Mono, SF Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.04em"
rounded:
  xs: "3px"
  sm: "6px"
  md: "7px"
  lg: "8px"
  modal: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
components:
  button-neutral:
    backgroundColor: "#1a2128"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  button-primary:
    backgroundColor: "{colors.primary-action}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0"
  signal-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
---

# Design System: RepoLog

## 1. Overview

**Creative North Star: "Local Flight Deck"**

RepoLog is a calm, high-density instrument panel for returning to coding work. It should feel local, direct, and task-first: a place to inspect the repo's current truth, not a place to perform productivity.

The design is a restrained dark product UI with crisp borders, low-contrast panel layering, small mono labels, and familiar controls. The system rejects fake agent presence, emotional status language, decorative drama, and gamification. It should stay open beside an editor without competing with the code.

**Key Characteristics:**
- Dense first viewport focused on Objective, Current Focus, Workspace Signals, Now, Next, Recent Activity, Agent Docs, and Prompt Palette.
- Flat panels with borders instead of decorative shadows.
- Blue accent used for selected state, primary action, focus, and links only.
- Mono text for metadata, paths, shortcut hints, event kinds, and timestamps.
- Settings are operational, not promotional.

## 2. Colors

RepoLog uses a dark restrained palette with one clear blue accent and semantic status colors for real repo state.

### Primary
- **Signal Blue** (#58a6ff): Primary accent for active selections, focus affordances, links, prompt glyphs, and current navigation.
- **Action Blue** (#2f7fdc): Filled primary actions in settings, especially Analyze and Save changes.
- **Slate Blue** (#79c0ff): Alternate theme accent for the slate mode.

### Secondary
- **Ready Green** (#73df73): Positive watcher state, success toasts, and valid readiness indicators.
- **Repair Amber** (#e6bf45): Warnings such as missing Now items, write-back off, scope drift, and cautionary settings copy.
- **Hard Red** (#ff5555): Blocked state, destructive or failed state, and serious validation errors.

### Neutral
- **Dark Canvas** (#070d12): Main desktop background.
- **Chrome Black** (#060b10): Top bar and shell chrome.
- **Panel Surface** (#10181d): Primary HUD tiles and signal cells.
- **Raised Surface** (#141b20): Header strip cards and elevated local panels.
- **Modal Surface** (#0d141b): Settings panel body.
- **Ink** (#e8edf2): Primary text.
- **Muted Text** (#aeb8c2): Secondary text converted from the runtime rgba token.
- **Dim Text** (#78828d): Tertiary metadata converted from the runtime rgba token.
- **Light Canvas** (#f0f2f5): Light theme background.
- **Light Ink** (#111318): Light theme text.

### Named Rules

**The One Accent Rule.** Blue is the only general accent. Green, amber, and red are reserved for semantic state.

**The Truth Color Rule.** Color may indicate repo state only when the underlying data is observable or document-derived.

## 3. Typography

**Display Font:** Inter with Segoe UI and system fallbacks.
**Body Font:** Inter with Segoe UI and system fallbacks.
**Label/Mono Font:** JetBrains Mono with SF Mono, ui-monospace, Menlo, and Consolas fallbacks.

**Character:** The type system is practical and compact. Inter carries readable product copy; JetBrains Mono carries filenames, timestamps, shortcuts, and scan metadata.

### Hierarchy

- **Headline** (700, 17px, 1.22): HUD tile titles, current objective, and compact section headings.
- **Title** (700, 13.5px, 1.35): Important row labels and dense panel titles.
- **Body** (400, 13px, 1.35): Standard task text, role descriptions, settings help text, and digest summary.
- **Small Body** (400, 11.5px, 1.35): Secondary panel copy, rows, and compact descriptions.
- **Label** (500, 10px, 0.04em when uppercase): Metadata labels, event kinds, keyboard hints, and chip text.

### Named Rules

**The No Display Drama Rule.** Product UI does not use oversized display type. Even hero-like settings sections must stay within operational scale.

**The Metadata Mono Rule.** Mono type means machine or workflow context: file paths, docs, shortcuts, event kinds, model names, and timestamps.

## 4. Elevation

RepoLog is flat by default. Depth comes from panel borders, tonal layering, and explicit modal overlays rather than soft card shadows. Shadows are reserved for overlays that must float above the HUD.

### Shadow Vocabulary

- **Settings Modal Lift** (`0 34px 120px -24px rgba(0,0,0,0.92), 0 0 0 1px rgba(8,18,30,0.85) inset`): The settings dialog only.
- **Palette Lift** (`0 30px 80px -10px rgba(0,0,0,0.7)`): Command/prompt palette overlay.
- **Toast Lift** (`0 10px 30px -5px rgba(0,0,0,0.6)`): Temporary feedback messages.

### Named Rules

**The Flat HUD Rule.** Regular HUD panels do not use drop shadows. They use a 1px border, 7-8px radius, and tonal surface changes.

## 5. Components

### Buttons

- **Shape:** 6-7px radius for normal buttons, 3-5px for keyboard chips, full pill only for tiny status chips.
- **Primary:** Action Blue background (#2f7fdc), white text, 7px radius, 11px 16px padding, 800 weight in settings.
- **Neutral:** Transparent or faint white background, 1px border, Ink or Muted text.
- **Hover / Focus:** Border shifts toward Signal Blue and text shifts to Signal Blue. Focus must be visible without relying on color alone.
- **Disabled:** Lower opacity and no pointer affordance.

### Chips

- **Style:** Small mono labels with 3-6px radius, faint fill, and restrained borders.
- **Document chips:** Green-tinted only when the chip points to a source document.
- **Shortcut chips:** Compact 1px border, dark fill, no extra decoration.

### Cards / Containers

- **Corner Style:** 7-8px for HUD tiles and signal cells, 12px for the settings modal.
- **Background:** Panel Surface for tiles, Raised Surface for top summary cards, Modal Surface for settings.
- **Shadow Strategy:** No shadows on regular HUD containers. Use elevation only for overlays.
- **Border:** 1px low-contrast border is the primary separator.
- **Internal Padding:** 10-14px for dense panels, 18-22px for settings hero blocks.

### Inputs / Fields

- **Style:** Dark field surface (#0a1015 or #0b1117), 1px subdued border, 7px radius, 10px 12px padding.
- **Focus:** 1px Signal Blue outline or border shift.
- **Error / Disabled:** Inline error banner for invalid config, disabled fields should dim and stay readable.

### Navigation

Settings navigation uses a left rail at desktop sizes, 52px row height, icon plus label plus small mono sublabel. Active state uses Signal Blue text, faint blue background, and an inset 3px selection marker. On narrow screens the sidebar collapses away and sections stack.

### Workspace Signals

Workspace Signals are the product signature strip. Each cell uses a label, a large value, and a compact note. The strip must show observable activity only: activity state, edits per minute, files touched, scope drift, thrash, and 30-minute trend.

### Prompt Palette

The prompt palette is an overlay for copy-ready resume prompts. It uses a centered panel, keyboard-first selection, mono glyphs, and concise labels. It should feel like a utility command surface, not a modal wizard.

## 6. Do's and Don'ts

### Do:

- **Do** make the first viewport answer what the user was doing, why it matters, what changed, and what to do next.
- **Do** use Signal Blue (#58a6ff) sparingly for active state, links, focus, and primary affordances.
- **Do** use Ready Green, Repair Amber, and Hard Red only for real semantic state.
- **Do** keep text at fixed product UI sizes. Use density controls and layout changes, not fluid viewport-scaled type.
- **Do** preserve the local-first, markdown-first source of truth in labels and repair actions.
- **Do** test the HUD at common laptop and desktop resolutions before claiming it is polished.

### Don't:

- **Don't** show fake agent liveness such as "Codex idle" unless a real integration supports that claim.
- **Don't** add gamification: no XP, streaks, timers, pomodoros, mascots, creature moods, or motivational nudges.
- **Don't** use "panicking" copy, LLM nudge bubbles, or emotional activity states.
- **Don't** turn RepoLog into cloud sync, team coordination, agent orchestration, or a separate agent-monitor product.
- **Don't** use nested card bloat, decorative dashboard drama, purple-blue gradient effects, glassmorphism, or sci-fi excess.
- **Don't** rely on horizontal scrolling for the main HUD.
- **Don't** bury settings actions behind scroll-heavy layouts when the user needs to inspect, analyze, save, or repair the repo.
