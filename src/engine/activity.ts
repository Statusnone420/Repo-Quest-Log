import type { AgentActivity, AgentId, AgentProfile, FileChange } from "./types.js";

export function inferAgentActivity(
  agents: readonly AgentProfile[],
  recentChanges: readonly FileChange[],
  limit = 6,
): AgentActivity[] {
  if (agents.length === 0 || recentChanges.length === 0) {
    return [];
  }

  const globs = agents.map((agent) => ({
    agent: agent.id,
    patterns: extractAreaGlobs(agent.area),
  }));

  const results: AgentActivity[] = [];

  for (const change of recentChanges.slice(0, limit * 2)) {
    let best: { agent: AgentId; confidence: number } | undefined;

    for (const { agent, patterns } of globs) {
      const match = patterns.reduce((max, pattern) => {
        const score = matchScore(change.file, pattern);
        return score > max ? score : max;
      }, 0);

      if (match === 0) {
        continue;
      }

      const confidence = roundConfidence(match * freshnessBoost(change.at));
      if (!best || confidence > best.confidence) {
        best = { agent, confidence };
      }
    }

    if (best) {
      results.push({
        agent: best.agent,
        file: change.file,
        at: change.at,
        confidence: best.confidence,
      });
    }
  }

  return results.slice(0, limit);
}

function extractAreaGlobs(area: string): string[] {
  if (!area || /unavailable/i.test(area)) {
    return [];
  }
  return area
    .split(/[,·\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !/^[.*/\\]+$/.test(token));
}

function matchScore(file: string, pattern: string): number {
  const normalized = file.replace(/\\/g, "/").toLowerCase();
  const needle = pattern.replace(/\\/g, "/").toLowerCase().replace(/\*+/g, "");
  if (!needle) return 0;
  if (normalized.includes(`/${needle}/`) || normalized.startsWith(`${needle}/`)) return 0.8;
  if (normalized.includes(needle)) return 0.55;
  return 0;
}

function freshnessBoost(at: string): number {
  const age = parseRelativeAge(at);
  if (age === undefined) {
    return 0.5;
  }
  if (age < 1) return 1;
  if (age < 60) return 0.95;
  if (age < 24 * 60) return 0.85;
  if (age < 7 * 24 * 60) return 0.7;
  return 0.5;
}

function parseRelativeAge(at: string): number | undefined {
  const normalized = at.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "just now" || normalized.includes("second")) {
    return 0;
  }

  const shorthand = normalized.match(/^(\d+)\s*([mhd])$/);
  if (shorthand) {
    const value = Number(shorthand[1]);
    if (!Number.isFinite(value)) {
      return undefined;
    }
    const unit = shorthand[2];
    if (unit === "m") return value;
    if (unit === "h") return value * 60;
    if (unit === "d") return value * 24 * 60;
  }

  const word = normalized.match(/^(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)\b/);
  if (!word) {
    return undefined;
  }

  const value = Number(word[1]);
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const unit = word[2] ?? "";
  if (unit.startsWith("min")) return value;
  if (unit.startsWith("hour")) return value * 60;
  if (unit.startsWith("day")) return value * 24 * 60;
  return undefined;
}

function roundConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}
