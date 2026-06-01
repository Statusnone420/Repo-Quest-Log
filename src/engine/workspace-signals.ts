import type { AgentProfile, RecentActivityEvent, Task, WorkspaceSignals } from "./types.js";

const EDIT_RATE_WINDOW_MS = 60_000;
const SCOPE_DRIFT_WINDOW_MS = 60_000;
const SPREAD_WINDOW_MS = 10 * 60_000;
const TREND_WINDOW_MS = 30 * 60_000;
const TREND_BUCKETS = 30;

export function computeWorkspaceSignals(
  events: readonly RecentActivityEvent[],
  scopeGlobs: readonly string[] = [],
  now = Date.now(),
): WorkspaceSignals {
  const scope = normalizeScope(scopeGlobs);
  const recent = events
    .filter((event) => Number.isFinite(event.ts) && event.ts <= now)
    .sort((left, right) => right.ts - left.ts);
  const withinMinute = recent.filter((event) => now - event.ts <= EDIT_RATE_WINDOW_MS);
  const withinSpread = recent.filter((event) => now - event.ts <= SPREAD_WINDOW_MS);
  const changeEvents = withinMinute.filter((event) => event.kind === "change");
  const repeated = repeatedEditFiles(changeEvents);
  const scopeActive = scope.length > 0;
  const scopeDriftCount = scopeActive
    ? new Set(recent
      .filter((event) => now - event.ts <= SCOPE_DRIFT_WINDOW_MS && isOutsideScope(event.file, scope))
      .map((event) => normalizePath(event.file).toLowerCase())).size
    : 0;
  const filesTouched = new Set(withinSpread.map((event) => normalizePath(event.file))).size;
  const thrashLevel = classifyThrash(changeEvents);

  return {
    state: classifyState(withinSpread.length, filesTouched, scopeDriftCount, thrashLevel),
    editRate: changeEvents.length,
    filesTouched,
    lastEditAge: formatAge(recent[0]?.ts, now),
    scopeDriftCount,
    thrashLevel,
    repeatedFiles: repeated,
    trend: buildTrend(recent, now),
    scopeActive,
  };
}

export function annotateRecentActivity(
  events: readonly RecentActivityEvent[],
  scopeGlobs: readonly string[] = [],
  now = Date.now(),
): RecentActivityEvent[] {
  const scope = normalizeScope(scopeGlobs);
  return events
    .filter((event) => Number.isFinite(event.ts) && event.ts <= now)
    .sort((left, right) => right.ts - left.ts)
    .map((event) => ({
      ...event,
      file: normalizePath(event.file),
      outsideScope: scope.length > 0 ? isOutsideScope(event.file, scope) : false,
    }));
}

export function deriveWorkspaceScope(
  nowTasks: readonly Task[],
  agents: readonly AgentProfile[],
): string[] {
  const scopeAgents = agents.filter((agent) => agent.status !== "archived");
  const byId = new Map(scopeAgents.map((agent) => [agent.id.toLowerCase(), agent]));
  const activeAgentIds = uniqueStrings(nowTasks
    .map((task) => task.agent?.trim().toLowerCase())
    .filter((agentId): agentId is string => !!agentId));
  const sourceAgents = activeAgentIds.length > 0
    ? activeAgentIds.map((agentId) => byId.get(agentId)).filter((agent): agent is AgentProfile => !!agent)
    : scopeAgents;

  return uniqueStrings(sourceAgents.flatMap((agent) => extractScopeTokens(agent.area)));
}

function repeatedEditFiles(events: readonly RecentActivityEvent[]): string[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const file = normalizePath(event.file);
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([file]) => file);
}

function classifyThrash(events: readonly RecentActivityEvent[]): WorkspaceSignals["thrashLevel"] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const file = normalizePath(event.file);
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }

  const max = Math.max(0, ...counts.values());
  if (max >= 5) return "High";
  if (max >= 3) return "Medium";
  if (max >= 2) return "Low";
  return "None";
}

function classifyState(
  eventCount: number,
  filesTouched: number,
  scopeDriftCount: number,
  thrashLevel: WorkspaceSignals["thrashLevel"],
): WorkspaceSignals["state"] {
  if (eventCount === 0) return "Quiet";
  if (thrashLevel === "High") return "High churn";
  if (scopeDriftCount >= 4 || filesTouched >= 9) return "Drifting";
  if (scopeDriftCount > 0) return "Review scope";
  return "Focused";
}

function buildTrend(events: readonly RecentActivityEvent[], now: number): number[] {
  const buckets = Array.from({ length: TREND_BUCKETS }, () => 0);
  const start = now - TREND_WINDOW_MS;
  const bucketMs = TREND_WINDOW_MS / TREND_BUCKETS;

  for (const event of events) {
    if (event.ts < start || event.ts > now) {
      continue;
    }
    const index = Math.min(TREND_BUCKETS - 1, Math.max(0, Math.floor((event.ts - start) / bucketMs)));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }

  return buckets;
}

function extractScopeTokens(area: string): string[] {
  return area
    .split(/[,;|·\n]+|\s+-\s+/)
    .map((part) => normalizeScopeToken(part))
    .filter((part): part is string => !!part);
}

function normalizeScopeToken(value: string): string | undefined {
  const token = normalizePath(value)
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^`([^`]+)`$/, "$1")
    .replace(/^owned areas?:?/i, "")
    .replace(/^area:?/i, "")
    .replace(/\*\*?\/?$/g, "")
    .replace(/\/\*\*?$/g, "")
    .replace(/^\.\//, "")
    .trim();

  if (!token || token === "general" || token === "repo" || token === "all" || token === "*") {
    return undefined;
  }

  if (/\s/.test(token)) {
    return undefined;
  }

  return token.replace(/\/+$/g, "");
}

function normalizeScope(scopeGlobs: readonly string[]): string[] {
  return uniqueStrings(scopeGlobs.map((scope) => normalizeScopeToken(scope)).filter((scope): scope is string => !!scope));
}

function isOutsideScope(file: string, scope: readonly string[]): boolean {
  const normalized = normalizePath(file);
  return !scope.some((entry) => normalized === entry || normalized.startsWith(`${entry}/`));
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }

  return result;
}

function formatAge(timestamp: number | undefined, now: number): string {
  if (!timestamp) {
    return "no activity";
  }

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
