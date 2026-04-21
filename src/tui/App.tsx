import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdin } from "ink";

import { scanRepo } from "../engine/scan.js";
import { startWatcher } from "../engine/watcher.js";
import type { FileChange, QuestState } from "../engine/types.js";

const palette = {
  bg: "#0a0b0d",
  ink: "#d0d6de",
  dim: "#5f6670",
  accent: "#7fd3c4",
  blue: "#7a9ed8",
  yellow: "#d7c07a",
  red: "#d87878",
  green: "#8fbf87",
  violet: "#c397d8",
  amber: "#e9b973",
};

export interface WatchAppProps {
  rootDir: string;
}

export function formatStaticFrame(
  state: QuestState,
  options: { scanning?: boolean; error?: string | null; interactive?: boolean } = {},
): string {
  const width = 110;
  const topWidth = width - 4;
  const leftWidth = Math.max(34, Math.floor((topWidth - 3) / 2));
  const rightWidth = topWidth - leftWidth - 3;

  const footer = `watching ${state.scannedFiles.length} files · ${options.scanning ? "scanning..." : `last scan ${state.lastScan}`} · ${options.interactive ? "[q] quit [r] rescan" : "read-only output"}${options.error ? ` · error: ${options.error}` : ""}`;

  return [
    plainPanel("repo quest log", topWidth, [
      row("Mission", state.mission, topWidth - 2),
      row("Quest", `${state.activeQuest.title} [${state.activeQuest.progress.done}/${state.activeQuest.progress.total}]`, topWidth - 2),
    ], state.branch),
    "",
    plainPanel("resume", topWidth, [
      truncate(state.resumeNote.task, topWidth - 2),
      truncate(`"${state.resumeNote.thought ?? ""}"`, topWidth - 2),
      truncate(`↳ ${state.resumeNote.lastTouched} · idle ${state.resumeNote.since}`, topWidth - 2),
    ]),
    "",
    joinColumns(
      plainPanel("NOW", leftWidth, renderTasks(state.now, leftWidth)),
      plainPanel("NEXT", rightWidth, renderTasks(state.next, rightWidth, false)),
      leftWidth,
    ),
    "",
    joinColumns(
      plainPanel("BLOCKED", leftWidth, renderBlocked(state, leftWidth)),
      plainPanel("AGENTS", rightWidth, renderAgents(state, rightWidth)),
      leftWidth,
    ),
    "",
    plainPanel("RECENT CHANGES", topWidth, renderChanges(state, topWidth)),
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

    let handlePromise = startWatcher({
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

  if (error && !state) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={palette.red}>repolog failed</Text>
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
      {isRawModeSupported ? <InputController onQuit={exit} onRefresh={() => refreshRef.current()} /> : null}
      {renderFrame(state, scanning, error, isRawModeSupported)}
    </Box>
  );
}

function InputController(props: { onQuit: () => void; onRefresh: () => Promise<void> }) {
  useInput((input) => {
    if (input === "q") {
      props.onQuit();
      return;
    }

    if (input === "r") {
      void props.onRefresh();
    }
  });

  return null;
}

function renderFrame(
  state: QuestState,
  scanning: boolean,
  error: string | null,
  isRawModeSupported: boolean,
) {
  const width = Math.max(72, Math.min(process.stdout.columns || 110, 120));
  const topWidth = width - 4;
  const columnGap = 3;
  const leftWidth = Math.max(34, Math.floor((topWidth - columnGap) / 2));
  const rightWidth = topWidth - leftWidth - columnGap;

  const header = boxPanel({
    title: "repo quest log",
    color: palette.dim,
    width: topWidth,
    lines: [
      row("Mission", state.mission, topWidth - 2),
      row("Quest", `${state.activeQuest.title} [${state.activeQuest.progress.done}/${state.activeQuest.progress.total}]`, topWidth - 2),
    ],
    rightMeta: state.branch,
  });

  const resume = boxPanel({
    title: "resume",
    color: palette.yellow,
    width: topWidth,
    lines: [
      truncate(state.resumeNote.task, topWidth - 2),
      truncate(`"${state.resumeNote.thought ?? ""}"`, topWidth - 2),
      truncate(`↳ ${state.resumeNote.lastTouched} · idle ${state.resumeNote.since}`, topWidth - 2),
    ],
  });

  const now = boxPanel({
    title: "NOW",
    color: palette.accent,
    width: leftWidth,
    lines: renderTasks(state.now, leftWidth),
  });

  const next = boxPanel({
    title: "NEXT",
    color: palette.blue,
    width: rightWidth,
    lines: renderTasks(state.next, rightWidth, false),
  });

  const blocked = boxPanel({
    title: "BLOCKED",
    color: palette.red,
    width: leftWidth,
    lines: renderBlocked(state, leftWidth),
  });

  const agents = boxPanel({
    title: "AGENTS",
    color: palette.violet,
    width: rightWidth,
    lines: renderAgents(state, rightWidth),
  });

  const changes = boxPanel({
    title: "RECENT CHANGES",
    color: palette.green,
    width: topWidth,
    lines: renderChanges(state, topWidth),
  });

  const footer = `watching ${state.scannedFiles.length} files · ${scanning ? "scanning..." : `last scan ${state.lastScan}`} · ${isRawModeSupported ? "[q] quit [r] rescan" : "read-only output"}${error ? ` · error: ${error}` : ""}`;

  return (
    <>
      {header}
      <Spacer />
      {resume}
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

function boxPanel(params: {
  title: string;
  width: number;
  lines: string[];
  color: string;
  rightMeta?: string;
}) {
  const innerWidth = Math.max(10, params.width - 2);
  const top = panelTop(params.title, params.color, innerWidth, params.rightMeta);
  const bottom = `└${"─".repeat(innerWidth)}┘`;

  return (
    <Box flexDirection="column">
      <Text color={params.color}>{top}</Text>
      {params.lines.length > 0 ? params.lines.map((line, index) => (
        <Text key={`${params.title}-${index}`}>{`│${pad(line, innerWidth)}│`}</Text>
      )) : <Text>{`│${pad("", innerWidth)}│`}</Text>}
      <Text color={params.color}>{bottom}</Text>
    </Box>
  );
}

function plainPanel(title: string, width: number, lines: string[], rightMeta?: string): string {
  const innerWidth = Math.max(10, width - 2);
  const output = [panelTop(title, palette.dim, innerWidth, rightMeta)];
  for (const line of lines.length > 0 ? lines : [""]) {
    output.push(`│${pad(line, innerWidth)}│`);
  }
  output.push(`└${"─".repeat(innerWidth)}┘`);
  return output.join("\n");
}

function panelTop(title: string, color: string, innerWidth: number, rightMeta?: string): string {
  const left = `─ ${title} `;
  if (!rightMeta) {
    return `┌${left}${"─".repeat(Math.max(0, innerWidth - left.length))}┐`;
  }

  const meta = ` ${rightMeta} `;
  const filler = Math.max(0, innerWidth - left.length - meta.length);
  return `┌${left}${"─".repeat(filler)}${meta}┐`;
}

function renderTasks(tasks: QuestState["now"], width: number, showDoc = true): string[] {
  if (tasks.length === 0) {
    return [" no active tasks"];
  }

  return tasks.flatMap((task, index) => {
    const agent = task.agent ? `[${task.agent[0]?.toUpperCase() ?? "·"}]` : "[·]";
    const prefix = ` ${String(index + 1).padStart(2, "0")} ${agent} `;
    const lines = wrapWithPrefix(task.text, prefix, width - 2, " ".repeat(prefix.length));

    if (showDoc) {
      lines.push(...wrapWithPrefix(task.doc, "    · ", width - 2, "      "));
    }

    return lines;
  });
}

function renderBlocked(state: QuestState, width: number): string[] {
  if (state.blocked.length === 0) {
    return [" no blocked items"];
  }

  return state.blocked.flatMap((task, index) => [
    ...wrapWithPrefix(task.text, ` ${String(index + 1).padStart(2, "0")} ✕ `, width - 2, "      "),
    ...wrapWithPrefix(`${task.reason} · ${task.since}`, "    ↳ ", width - 2, "      "),
  ]);
}

function renderAgents(state: QuestState, width: number): string[] {
  if (state.agents.length === 0) {
    return [" no agent profiles"];
  }

  return state.agents.flatMap((agent) => [
    ...wrapWithPrefix(
      `${agent.name} · ${agent.status} · ${agent.objective}`,
      " ",
      width - 2,
      "   ",
    ),
    ...wrapWithPrefix(`${agent.file} · ${agent.area}`, "    ↳ ", width - 2, "      "),
  ]);
}

function renderChanges(state: QuestState, width: number): string[] {
  if (state.recentChanges.length === 0) {
    return [" no recent changes yet"];
  }

  return state.recentChanges.slice(0, 6).flatMap((change) => {
    const diff = change.diff ? ` ${change.diff}` : "";
    return wrapWithPrefix(`${change.file}${diff} · ${change.at}`, " ", width - 2, "   ");
  });
}

function row(label: string, value: string, width: number): string {
  const prefix = `${label.padEnd(8, " ")} `;
  return truncate(`${prefix}${value}`, width);
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

function wrapWithPrefix(text: string, prefix: string, width: number, continuationPrefix = prefix): string[] {
  const contentWidth = Math.max(8, width - prefix.length);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [prefix.trimEnd()];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= contentWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      const currentPrefix = lines.length === 0 ? prefix : continuationPrefix;
      lines.push(`${currentPrefix}${current}`);
      current = word;
      continue;
    }

    let remaining = word;
    while (remaining.length > contentWidth) {
      const currentPrefix = lines.length === 0 ? prefix : continuationPrefix;
      lines.push(`${currentPrefix}${remaining.slice(0, contentWidth)}`);
      remaining = remaining.slice(contentWidth);
    }
    current = remaining;
  }

  if (current) {
    const currentPrefix = lines.length === 0 ? prefix : continuationPrefix;
    lines.push(`${currentPrefix}${current}`);
  }

  return lines;
}

function mergeChanges(next: readonly FileChange[], previous: readonly FileChange[]): FileChange[] {
  const merged = new Map<string, FileChange>();

  for (const change of next) {
    merged.set(change.file, change);
  }

  for (const change of previous) {
    if (!merged.has(change.file)) {
      merged.set(change.file, change);
    }
  }

  return [...merged.values()].slice(0, 10);
}

function Spacer() {
  return <Text> </Text>;
}
