import { scoreContextUsefulness } from "./repo-context.js";
import type { QuestState, RepoContext, RepoReadinessScores } from "./types.js";

export function assessRepoReadiness(state: QuestState, context?: RepoContext): RepoReadinessScores {
  const repoLogStructureScore = scoreRepoLogStructure(state);
  const contextUsefulnessScore = scoreContextUsefulness(context);
  const agentReadinessScore = Math.round((repoLogStructureScore * 0.65) + (contextUsefulnessScore * 0.35));

  return {
    repoLogStructureScore,
    contextUsefulnessScore,
    agentReadinessScore,
    summary: summarizeReadiness(repoLogStructureScore, contextUsefulnessScore),
  };
}

export function scoreRepoLogStructure(state: QuestState): number {
  let score = 0;
  const scanned = new Set(state.scannedFiles.map((file) => file.toLowerCase()));
  const hasPlan = scanned.has("plan.md");
  const hasState = scanned.has("state.md");
  const hasAgentDoc = ["agents.md", "claude.md", "gemini.md"].some((file) => scanned.has(file));

  if (hasPlan && state.mission.trim()) score += 15;
  if (hasPlan && state.activeQuest.title.trim()) score += 15;
  if (hasPlan && state.now.length > 0) score += 15;
  if (hasState && state.resumeNote.task.trim()) score += 10;
  if (hasPlan && state.next.length > 0) score += 10;
  if (hasAgentDoc && state.agents.some((agent) => agent.area.trim())) score += 10;
  if (state.config?.charterPresent) score += 15;
  if (state.config?.hasFrontmatter) score += 10;

  return Math.min(100, score);
}

function summarizeReadiness(structureScore: number, contextScore: number): string {
  if (structureScore >= 70 && contextScore >= 50) {
    return "Agent-ready structure with enough repo context.";
  }
  if (contextScore >= 60 && structureScore < 70) {
    return "Good raw context, missing agent-ready structure.";
  }
  if (contextScore < 40 && structureScore < 70) {
    return "Low raw context and missing agent-ready structure.";
  }
  return "Some structure exists, but the repair path needs clearer docs.";
}
