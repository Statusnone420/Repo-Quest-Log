import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdin } from "ink";

import { copyTextToClipboard } from "../engine/clipboard.js";
import { mergeChanges } from "../engine/changes.js";
import { runDoctor } from "../engine/doctor.js";
import { buildPromptPresets, loadPromptPresets, type PromptPreset } from "../engine/prompts.js";
import { buildStandupMarkdown } from "../engine/standup.js";
import { scanRepo } from "../engine/scan.js";
import { buildTuneup, type TuneupResult } from "../engine/tuneup.js";
import { startWatcher } from "../engine/watcher.js";
import type { FileChange, QuestState } from "../engine/types.js";

const palette = {
  bg: "#0b0d10",
  ink: "#e6ecf2",
  dim: "#7b8997",
  muted: "#9eacbc",
  accent: "#8ab4ff",
  warn: "#e9b973",
  danger: "#f48471",
  ok: "#8ad6a8",
};

const THREE_COLUMN_BREAKPOINT = 140;
const TOP_STRIP_BREAKPOINT = 110;
const AGENT_GLYPHS: Record<string, string> = {
  codex: "CX",
  claude: "CL",
  gemini: "GM",
};

export interface WatchAppProps {
  rootDir: string;
}

export function formatStaticFrame(
  state: QuestState,
  options: { scanning?: boolean; error?: string | null; interactive?: boolean; columns?: number; rows?: number } = {},
): string {
  const width = Math.max(80, options.columns ?? process.stdout.columns ?? 110);
  const rows = Math.max(24, options.rows ?? process.stdout.rows ?? 40);
  const topWidth = width - 4;
  const threeColumn = width >= THREE_COLUMN_BREAKPOINT;
  const changeLimit = Math.max(4, Math.min(8, rows > 0 ? Math.floor((rows - 24) / 3) : 4));
  const brand = renderTopbarLine(state, topWidth);
  const header = renderTopStripStatic(state, topWidth);

  const cockpit = plainPanel("COCKPIT", topWidth, [renderCockpitLine(state, topWidth - 2)]);

  const footer = `watching ${state.scannedFiles.length} files · ${options.scanning ? "scanning..." : `last scan ${state.lastScan}`} · ${options.interactive ? "[q] quit [r] rescan [t] tuneup [s] standup [ctrl+k] palette" : "read-only output"}${options.error ? ` · error: ${options.error}` : ""}`;

  if (threeColumn) {
    const board = computeThreeColumnWidths(topWidth);
    const col1 = stackPanels([
      plainPanel("NOW", board.first, renderTasks(state.now, board.first, "now")),
      plainPanel("BLOCKED", board.first, renderBlocked(state, board.first)),
    ]);
    const col2 = stackPanels([
      plainPanel("NEXT", board.second, renderTasks(state.next, board.second, "next")),
      plainPanel("RECENT CHANGES", board.second, renderChanges(state, board.second, changeLimit)),
    ]);
    const col3 = stackPanels([
      plainPanel("AGENTS", board.third, renderAgents(state, board.third)),
    ]);

    return [
      brand,
      "",
      header,
      "",
      cockpit,
      "",
      joinThreeColumns(col1, col2, col3, board.first, board.second),
      "",
      truncate(footer, width - 1),
    ].join("\n");
  }

  const columnGap = 3;
  const leftWidth = Math.max(34, Math.floor((topWidth - columnGap) / 2));
  const rightWidth = topWidth - leftWidth - columnGap;
  return [
    brand,
    "",
    header,
    "",
    cockpit,
    "",
    joinColumns(
      plainPanel("NOW", leftWidth, renderTasks(state.now, leftWidth, "now")),
      plainPanel("NEXT", rightWidth, renderTasks(state.next, rightWidth, "next")),
      leftWidth,
    ),
    "",
    joinColumns(
      plainPanel("BLOCKED", leftWidth, renderBlocked(state, leftWidth)),
      plainPanel("AGENTS", rightWidth, renderAgents(state, rightWidth)),
      leftWidth,
    ),
    "",
    plainPanel("RECENT CHANGES", topWidth, renderChanges(state, topWidth, changeLimit)),
    "",
    truncate(footer, width - 1),
  ].join("\n");
}

export function WatchApp({ rootDir }: WatchAppProps) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [state, setState] = useState<QuestState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [tuneupOpen, setTuneupOpen] = useState(false);
  const [tuneupResult, setTuneupResult] = useState<TuneupResult | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const recentChangesRef = useRef<FileChange[]>([]);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let mounted = true;

    const refresh = async (changes: readonly FileChange[] = []) => {
      setScanning(true);
      try {
        recentChangesRef.current = mergeChanges(changes, recentChangesRef.current);
        const nextState = await scanRepo(rootDir, {
          recentChanges: recentChangesRef.current,
          lastTouchedFile: recentChangesRef.current[0]?.file,
        });
        if (!mounted) {
          return;
        }
        setState(nextState);
        setError(null);
      } catch (scanError) {
        if (!mounted) {
          return;
        }
        setError(scanError instanceof Error ? scanError.message : String(scanError));
      } finally {
        if (mounted) {
          setScanning(false);
        }
      }
    };

    refreshRef.current = async () => refresh();

    const handlePromise = startWatcher({
      cwd: rootDir,
      onRefresh: (changes) => refresh(changes),
      onError: (watchError) => {
        if (!mounted) {
          return;
        }
        setError(watchError instanceof Error ? watchError.message : String(watchError));
      },
    });

    void refresh();

    return () => {
      mounted = false;
      void handlePromise.then((handle) => handle.close());
    };
  }, [rootDir]);

  const [externalPresets, setExternalPresets] = useState<PromptPreset[] | null>(null);

  useEffect(() => {
    if (!state) {
      return;
    }
    let mounted = true;
    loadPromptPresets(state, { rootDir })
      .then((loaded) => {
        if (mounted) setExternalPresets(loaded);
      })
      .catch(() => {
        if (mounted) setExternalPresets(null);
      });
    return () => {
      mounted = false;
    };
  }, [state, rootDir]);

  const presets = useMemo(() => {
    if (!state) {
      return [];
    }
    return externalPresets ?? buildPromptPresets(state);
  }, [state, externalPresets]);

  const filteredPresets = useMemo(
    () => filterPromptPresets(presets, paletteQuery),
    [presets, paletteQuery],
  );

  useEffect(() => {
    if (paletteIndex < filteredPresets.length) {
      return;
    }
    setPaletteIndex(0);
  }, [filteredPresets, paletteIndex]);

  useInput((input, key) => {
    if (!isRawModeSupported) {
      return;
    }

    if ((key.ctrl || key.meta) && input.toLowerCase() === "k") {
      setPaletteOpen((open) => {
        const next = !open;
        if (next) {
          setPaletteQuery("");
          setPaletteIndex(0);
        }
        return next;
      });
      return;
    }

    if (tuneupOpen) {
      if (key.escape || input === "q") {
        setTuneupOpen(false);
        return;
      }
      return;
    }

    if (paletteOpen) {
      if (key.escape) {
        setPaletteOpen(false);
        return;
      }
      if (key.upArrow) {
        setPaletteIndex((index) => {
          if (filteredPresets.length === 0) {
            return 0;
          }
          return (index - 1 + filteredPresets.length) % filteredPresets.length;
        });
        return;
      }
      if (key.downArrow) {
        setPaletteIndex((index) => {
          if (filteredPresets.length === 0) {
            return 0;
          }
          return (index + 1) % filteredPresets.length;
        });
        return;
      }
      if (key.return) {
        const preset = filteredPresets[paletteIndex];
        if (!preset) {
          return;
        }
        setPaletteOpen(false);
        setPaletteQuery("");
        void copyTextToClipboard(preset.body).then((copied) => {
          setStatusLine(copied ? `${preset.label} copied` : "Clipboard unavailable");
        });
        return;
      }
      if (key.backspace || key.delete) {
        setPaletteQuery((value) => value.slice(0, -1));
        return;
      }
      if (!key.ctrl && !key.meta && !key.tab && isPrintable(input)) {
        setPaletteQuery((value) => `${value}${input}`);
      }
      return;
    }

    if (input === "q") {
      exit();
      return;
    }

    if (input === "r") {
      setStatusLine("Rescanning...");
      void refreshRef.current();
      return;
    }

    if (input.toLowerCase() === "t") {
      if (!state) return;
      if (tuneupOpen) {
        setTuneupOpen(false);
        return;
      }
      setStatusLine("Analyzing repo…");
      void (async () => {
        try {
          const report = await runDoctor(rootDir);
          const result = buildTuneup(report.state, report);
          setTuneupResult(result);
          setTuneupOpen(true);
          setStatusLine(null);
        } catch (err) {
          setStatusLine(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    if (input.toLowerCase() === "s") {
      if (!state) {
        return;
      }
      setStatusLine("Copying standup export...");
      void (async () => {
        try {
          const markdown = await buildStandupMarkdown(rootDir, state);
          const copied = await copyTextToClipboard(markdown);
          setStatusLine(copied ? "Standup export copied" : "Clipboard unavailable");
        } catch (error) {
          setStatusLine(error instanceof Error ? error.message : String(error));
        }
      })();
    }
  });

  if (error && !state) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={palette.danger}>repolog failed</Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  if (!state) {
    return (
      <Box padding={1}>
        <Text color={palette.dim}>scanning {rootDir}...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {renderFrame(state, {
        scanning,
        error,
        isRawModeSupported,
        paletteOpen,
      })}
      {tuneupOpen && tuneupResult ? (
        <>
          <Spacer />
          <TuneupOverlay
            width={Math.max(80, (process.stdout.columns || 110) - 4)}
            result={tuneupResult}
          />
        </>
      ) : paletteOpen ? (
        <>
          <Spacer />
          <PaletteOverlay
            width={Math.max(80, (process.stdout.columns || 110) - 4)}
            query={paletteQuery}
            presets={filteredPresets}
            selectedIndex={paletteIndex}
          />
        </>
      ) : null}
      {statusLine ? (
        <>
          <Spacer />
          <Text color={palette.muted}>{truncate(statusLine, Math.max(40, (process.stdout.columns || 110) - 6))}</Text>
        </>
      ) : null}
    </Box>
  );
}

function renderFrame(
  state: QuestState,
  options: {
    scanning: boolean;
    error: string | null;
    isRawModeSupported: boolean;
    paletteOpen: boolean;
  },
) {
  const width = Math.max(80, process.stdout.columns || 110);
  const rows = Math.max(24, process.stdout.rows || 40);
  const topWidth = width - 4;
  const threeColumn = width >= THREE_COLUMN_BREAKPOINT;
  const changeLimit = Math.max(4, Math.min(8, Math.floor((rows - 24) / 3)));
  const brand = renderTopbar(state, topWidth);
  const header = renderTopStrip(state, topWidth);

  const cockpit = boxPanel({
    title: "COCKPIT",
    color: palette.accent,
    width: topWidth,
    lines: [renderCockpitLine(state, topWidth - 2)],
  });

  const footer = `watching ${state.scannedFiles.length} files · ${options.scanning ? "scanning..." : `last scan ${state.lastScan}`} · ${options.isRawModeSupported ? "[q] quit [r] rescan [t] tuneup [s] standup [ctrl+k] palette" : "read-only output"}${options.paletteOpen ? " · palette open" : ""}${options.error ? ` · error: ${options.error}` : ""}`;

  if (threeColumn) {
    const board = computeThreeColumnWidths(topWidth);
    const now = boxPanel({
      title: "NOW",
      color: palette.accent,
      width: board.first,
      lines: renderTasks(state.now, board.first, "now"),
    });
    const blocked = boxPanel({
      title: "BLOCKED",
      color: palette.warn,
      width: board.first,
      lines: renderBlocked(state, board.first),
    });
    const next = boxPanel({
      title: "NEXT",
      color: palette.muted,
      width: board.second,
      lines: renderTasks(state.next, board.second, "next"),
    });
    const changes = boxPanel({
      title: "RECENT CHANGES",
      color: palette.ok,
      width: board.second,
      lines: renderChanges(state, board.second, changeLimit),
    });
    const agents = boxPanel({
      title: "AGENTS",
      color: palette.ok,
      width: board.third,
      lines: renderAgents(state, board.third),
    });

    return (
      <>
        {brand}
        <Spacer />
        {header}
        <Spacer />
        {cockpit}
        <Spacer />
        <Box>
          <Box flexDirection="column" marginRight={1}>
            {now}
            <Spacer />
            {blocked}
          </Box>
          <Box flexDirection="column" marginX={1}>
            {next}
            <Spacer />
            {changes}
          </Box>
          <Box flexDirection="column" marginLeft={1}>
            {agents}
          </Box>
        </Box>
        <Spacer />
        <Text color={palette.dim}>{truncate(footer, width - 1)}</Text>
      </>
    );
  }

  const columnGap = 3;
  const leftWidth = Math.max(34, Math.floor((topWidth - columnGap) / 2));
  const rightWidth = topWidth - leftWidth - columnGap;

  const now = boxPanel({
    title: "NOW",
    color: palette.accent,
    width: leftWidth,
    lines: renderTasks(state.now, leftWidth, "now"),
  });
  const next = boxPanel({
    title: "NEXT",
    color: palette.muted,
    width: rightWidth,
    lines: renderTasks(state.next, rightWidth, "next"),
  });
  const blocked = boxPanel({
    title: "BLOCKED",
    color: palette.warn,
    width: leftWidth,
    lines: renderBlocked(state, leftWidth),
  });
  const agents = boxPanel({
    title: "AGENTS",
    color: palette.ok,
    width: rightWidth,
    lines: renderAgents(state, rightWidth),
  });
  const changes = boxPanel({
    title: "RECENT CHANGES",
    color: palette.ok,
    width: topWidth,
    lines: renderChanges(state, topWidth, changeLimit),
  });

  return (
    <>
      {brand}
      <Spacer />
      {header}
      <Spacer />
      {cockpit}
      <Spacer />
      <Box>
        <Box flexDirection="column" marginRight={1}>
          {now}
          <Spacer />
          {blocked}
        </Box>
        <Box flexDirection="column" marginLeft={1}>
          {next}
          <Spacer />
          {agents}
        </Box>
      </Box>
      <Spacer />
      {changes}
      <Spacer />
      <Text color={palette.dim}>{truncate(footer, width - 1)}</Text>
    </>
  );
}

function PaletteOverlay(params: {
  width: number;
  query: string;
  presets: PromptPreset[];
  selectedIndex: number;
}) {
  const lines = [
    ` search ${params.query || "…"}`,
    ...renderPaletteLines(params.presets, params.selectedIndex, params.width - 2),
    " enter copies prompt · esc closes · ↑↓ moves",
  ];
  return boxPanel({
    title: "RESUME PROMPTS",
    width: params.width,
    color: palette.warn,
    lines,
  });
}

function TuneupOverlay(params: { width: number; result: TuneupResult }) {
  const { score, gaps } = params.result;
  const bar = buildScoreBar(score, params.width - 18);
  const meterLine = `  score  ${bar} ${String(score).padStart(3)}/100`;
  const gapLines = gaps.length === 0
    ? ["  no gaps — this repo is at 100% legibility"]
    : gaps.slice(0, 12).map(
        (g) => truncate(`  [${g.severity.padEnd(4)}] ${g.file}: ${g.fix}`, params.width - 2),
      );
  const lines = [
    meterLine,
    "",
    ...gapLines,
    "",
    " q/esc close",
  ];
  return boxPanel({
    title: "TUNE THIS REPO",
    width: params.width,
    color: score >= 80 ? palette.accent : score >= 50 ? palette.warn : palette.danger,
    lines,
  });
}

function buildScoreBar(score: number, length: number): string {
  const filled = Math.round((score / 100) * length);
  const empty = length - filled;
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty));
}

function renderTopbarLine(state: QuestState, width: number): string {
  const left = "repo quest log";
  const middle = `${state.name} / ${state.branch}`;
  return truncate(`${left} · ${middle}`, width);
}

function renderTopbar(state: QuestState, width: number) {
  return (
    <Text color={palette.dim}>
      {truncate(renderTopbarLine(state, width), width)}
    </Text>
  );
}

function renderTopStripStatic(state: QuestState, width: number): string {
  const mission = plainPanel("MISSION", topStripWidth(width).first, [
    truncate(state.mission, topStripWidth(width).first - 2),
  ]);
  const objective = plainPanel("OBJECTIVE", topStripWidth(width).second, [
    truncate(formatObjectiveLine(state), topStripWidth(width).second - 2),
    truncate(`${state.activeQuest.doc}${state.activeQuest.line ? `:${state.activeQuest.line}` : ""}`, topStripWidth(width).second - 2),
  ]);
  const resume = plainPanel("RESUME", topStripWidth(width).third, [
    truncate(state.resumeNote.task, topStripWidth(width).third - 2),
    truncate(`${state.resumeNote.lastTouched} · idle ${state.resumeNote.since}`, topStripWidth(width).third - 2),
  ]);

  if (width >= TOP_STRIP_BREAKPOINT) {
    const dims = topStripWidth(width);
    return joinThreeColumns(mission, objective, resume, dims.first, dims.second);
  }

  return [mission, "", objective, "", resume].join("\n");
}

function renderTopStrip(state: QuestState, width: number) {
  const dims = topStripWidth(width);
  const mission = boxPanel({
    title: "MISSION",
    color: palette.accent,
    width: dims.first,
    lines: [truncate(state.mission, dims.first - 2)],
  });
  const objective = boxPanel({
    title: "OBJECTIVE",
    color: palette.ok,
    width: dims.second,
    lines: [
      truncate(formatObjectiveLine(state), dims.second - 2),
      truncate(`${state.activeQuest.doc}${state.activeQuest.line ? `:${state.activeQuest.line}` : ""}`, dims.second - 2),
    ],
  });
  const resume = boxPanel({
    title: "RESUME",
    color: palette.warn,
    width: dims.third,
    lines: [
      truncate(state.resumeNote.task, dims.third - 2),
      truncate(`${state.resumeNote.lastTouched} · idle ${state.resumeNote.since}`, dims.third - 2),
    ],
  });

  if (width >= TOP_STRIP_BREAKPOINT) {
    return (
      <Box>
        <Box marginRight={1}>{mission}</Box>
        <Box marginX={1}>{objective}</Box>
        <Box marginLeft={1}>{resume}</Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {mission}
      <Spacer />
      {objective}
      <Spacer />
      {resume}
    </Box>
  );
}

function formatObjectiveLine(state: QuestState): string {
  return `${state.activeQuest.title} [${state.activeQuest.progress.done}/${state.activeQuest.progress.total}]`;
}

function topStripWidth(totalWidth: number): { first: number; second: number; third: number } {
  if (totalWidth < TOP_STRIP_BREAKPOINT) {
    return { first: totalWidth, second: totalWidth, third: totalWidth };
  }

  const available = totalWidth - 4;
  const first = Math.max(24, Math.floor(available * 0.35));
  const second = Math.max(24, Math.floor(available * 0.25));
  const third = Math.max(24, available - first - second);
  return { first, second, third };
}

function boxPanel(params: {
  title: string;
  width: number;
  lines: string[];
  color: string;
  rightMeta?: string;
}) {
  const innerWidth = Math.max(10, params.width - 2);
  const top = panelTop(params.title, innerWidth, params.rightMeta);
  const bottom = `└${"─".repeat(innerWidth)}┘`;

  return (
    <Box flexDirection="column">
      <Text color={params.color}>{top}</Text>
      {(params.lines.length > 0 ? params.lines : [""]).map((line, index) => (
        <Text key={`${params.title}-${index}`}>{`│${pad(line, innerWidth)}│`}</Text>
      ))}
      <Text color={params.color}>{bottom}</Text>
    </Box>
  );
}

function plainPanel(title: string, width: number, lines: string[], rightMeta?: string): string {
  const innerWidth = Math.max(10, width - 2);
  const output = [panelTop(title, innerWidth, rightMeta)];
  for (const line of lines.length > 0 ? lines : [""]) {
    output.push(`│${pad(line, innerWidth)}│`);
  }
  output.push(`└${"─".repeat(innerWidth)}┘`);
  return output.join("\n");
}

function panelTop(title: string, innerWidth: number, rightMeta?: string): string {
  const left = `─ ${title} `;
  if (!rightMeta) {
    return `┌${left}${"─".repeat(Math.max(0, innerWidth - left.length))}┐`;
  }

  const meta = ` ${rightMeta} `;
  const filler = Math.max(0, innerWidth - left.length - meta.length);
  return `┌${left}${"─".repeat(filler)}${meta}┐`;
}

function renderTasks(tasks: QuestState["now"], width: number, lane: "now" | "next"): string[] {
  if (tasks.length === 0) {
    return [" · no active tasks"];
  }

  const bar = lane === "now" ? "▌" : "▍";
  return tasks.map((task, index) => {
    const agent = formatAgentGlyph(task.agent);
    const doc = task.doc ? ` ${task.doc}` : "";
    return truncate(
      `${bar} ${renderConfidenceDots(task.confidence)} ${String(index + 1).padStart(2, "0")} ${task.text} [${agent}]${doc}`,
      width - 2,
    );
  });
}

function renderBlocked(state: QuestState, width: number): string[] {
  if (state.blocked.length === 0) {
    return [" · no blocked items"];
  }

  return state.blocked.map((task, index) => truncate(
    `▌ ${renderConfidenceDots(task.confidence)} ${String(index + 1).padStart(2, "0")} ${task.text} · ${task.reason} · ${task.since}`,
    width - 2,
  ));
}

function renderAgents(state: QuestState, width: number): string[] {
  if (state.agents.length === 0) {
    return [" · no agent profiles"];
  }

  const lines = state.agents.map((agent) => truncate(
    `▍ ${formatAgentGlyph(agent.id)} ${agent.name} · ${agent.status.toUpperCase()} · ${agent.objective}`,
    width - 2,
  ));

  const activity = (state.agentActivity ?? []).slice(0, 3);
  if (activity.length > 0) {
    lines.push(" · recent activity");
    for (const entry of activity) {
      lines.push(truncate(`  ↳ ${entry.agent} ${entry.file} · ${entry.at} · ${formatConfidence(entry.confidence)}`, width - 2));
    }
  }

  return lines;
}

function renderChanges(state: QuestState, width: number, limit = 6): string[] {
  if (state.recentChanges.length === 0) {
    return [" · no recent changes yet"];
  }

  const visible = state.recentChanges.slice(0, limit);
  const lines = visible.map((change, index) => {
    const diff = change.diff ? ` ${change.diff}` : "";
    return truncate(`▍ ${String(index + 1).padStart(2, "0")} ${change.file}${diff} · ${change.at}`, width - 2);
  });

  const hiddenCount = state.recentChanges.length - visible.length;
  if (hiddenCount > 0) {
    lines.push(truncate(` · ${hiddenCount} more changes`, width - 2));
  }

  return lines;
}

function renderPaletteLines(presets: PromptPreset[], selectedIndex: number, width: number): string[] {
  if (presets.length === 0) {
    return [" · no matches"];
  }
  return presets.slice(0, 6).map((preset, index) => {
    const cursor = index === selectedIndex ? ">" : " ";
    return truncate(`${cursor} ${preset.glyph} ${preset.label} · ${preset.sub}`, width);
  });
}

function renderCockpitLine(state: QuestState, width: number): string {
  const git = state.gitContext;
  const value = [
    `● ${state.now.length} NOW`,
    `○ ${state.next.length} NEXT`,
    `⏸ ${state.blocked.length} BLOCKED`,
    `◉ ${state.agents.length} AGENTS`,
    `◌ ${state.scannedFiles.length} FILES`,
    `tail ${state.resumeNote.lastTouched}`,
    git ? `git ${git.branch}${git.dirtyFiles ? ` ${git.dirtyFiles} dirty` : ""}` : "",
  ].filter(Boolean).join(" · ");
  return truncate(value, width);
}

function formatConfidence(confidence: number): string {
  const c = Math.max(0, Math.min(1, confidence));
  if (c >= 0.84) {
    return "high";
  }
  if (c >= 0.5) {
    return "med";
  }
  return "low";
}

function truncate(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }
  if (value.length <= width) {
    return value;
  }
  if (width <= 1) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 1)}…`;
}

function pad(value: string, width: number): string {
  const clipped = truncate(value, width);
  return clipped.padEnd(width, " ");
}

function stackPanels(panels: string[]): string {
  return panels.join("\n\n");
}

function joinColumns(left: string, right: string, leftWidth: number): string {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const total = Math.max(leftLines.length, rightLines.length);
  const result: string[] = [];

  for (let index = 0; index < total; index += 1) {
    const leftLine = leftLines[index] ?? "";
    const rightLine = rightLines[index] ?? "";
    result.push(`${leftLine.padEnd(leftWidth, " ")}   ${rightLine}`);
  }

  return result.join("\n");
}

function joinThreeColumns(
  first: string,
  second: string,
  third: string,
  firstWidth: number,
  secondWidth: number,
): string {
  const firstLines = first.split("\n");
  const secondLines = second.split("\n");
  const thirdLines = third.split("\n");
  const total = Math.max(firstLines.length, secondLines.length, thirdLines.length);
  const out: string[] = [];

  for (let index = 0; index < total; index += 1) {
    const a = firstLines[index] ?? "";
    const b = secondLines[index] ?? "";
    const c = thirdLines[index] ?? "";
    out.push(`${a.padEnd(firstWidth, " ")}  ${b.padEnd(secondWidth, " ")}  ${c}`);
  }

  return out.join("\n");
}

function computeThreeColumnWidths(totalWidth: number): { first: number; second: number; third: number } {
  const available = totalWidth - 4;
  const first = Math.max(24, Math.floor(available / 3));
  const second = Math.max(24, Math.floor(available / 3));
  const third = Math.max(24, available - first - second);
  return { first, second, third };
}

function filterPromptPresets(presets: PromptPreset[], query: string): PromptPreset[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return presets;
  }
  return presets.filter((preset) => `${preset.label} ${preset.sub} ${preset.keywords}`.toLowerCase().includes(needle));
}

function renderConfidenceDots(confidence: number): string {
  const c = Math.max(0, Math.min(1, confidence));
  if (c >= 0.84) {
    return "•••";
  }
  if (c >= 0.5) {
    return "·••";
  }
  if (c >= 0.17) {
    return "··•";
  }
  return "···";
}

function formatAgentGlyph(agent?: string): string {
  if (!agent) {
    return "··";
  }

  return AGENT_GLYPHS[agent.toLowerCase()] ?? agent.slice(0, 2).toUpperCase();
}

function isPrintable(input: string): boolean {
  return /^[\x20-\x7e]$/.test(input);
}

function Spacer() {
  return <Text> </Text>;
}
