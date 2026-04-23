import { AGENT_FILES } from "./fileset.js";
import type { AgentProfile, ParsedDoc, ParsedSection } from "./types.js";

const AGENT_FILE_BY_NAME = new Map(
  AGENT_FILES.map((entry) => [entry.file.toLowerCase(), entry]),
);

export function extractAgentProfiles(docs: readonly ParsedDoc[]): AgentProfile[] {
  const profiles: AgentProfile[] = [];

  for (const doc of docs) {
    const agentMeta = AGENT_FILE_BY_NAME.get(fileName(doc.file).toLowerCase());
    if (!agentMeta) {
      continue;
    }

    const frontmatter = doc.frontmatter ?? {};
    const id = normalizeId(String(frontmatter.owner ?? agentMeta.id));

    profiles.push({
      id,
      name: String(frontmatter.name ?? titleCase(agentMeta.id)),
      file: doc.file,
      role: String(frontmatter.role ?? sectionSummary(doc.sections, /role/i) ?? "Role unavailable"),
      area: String(frontmatter.area ?? sectionSummary(doc.sections, /owned areas?|area/i) ?? "Area unavailable"),
      objective: String(
        frontmatter.objective ?? sectionSummary(doc.sections, /current objective|objective/i) ?? "Objective unavailable",
      ),
      constraints: collectChecklistTexts(findSectionByHeading(doc.sections, /^(do not|constraints)$/i)),
      status: normalizeAgentStatus(frontmatter.status, agentMeta.id),
      currentTask: String(frontmatter.currentTask ?? sectionSummary(doc.sections, /current task/i) ?? "") || undefined,
      lastTask: String(frontmatter.lastTask ?? sectionSummary(doc.sections, /last task/i) ?? "") || undefined,
    });
  }

  return profiles;
}

function collectChecklistTexts(section: ParsedSection | undefined): string[] {
  if (!section) {
    return [];
  }

  return collectChecklistItems(section).map((item) => item.text);
}

function collectChecklistItems(section: ParsedSection): ParsedSection["checklistItems"] {
  const items = [...section.checklistItems];
  for (const child of section.children) {
    items.push(...collectChecklistItems(child));
  }
  return items;
}

function sectionSummary(sections: readonly ParsedSection[], pattern: RegExp): string | undefined {
  const section = findSectionByHeading(sections, pattern);
  if (!section) {
    return undefined;
  }

  const paragraph = section.paragraphs.find((item) => item.trim().length > 0)?.trim();
  if (paragraph) {
    return paragraph;
  }

  const checklist = collectChecklistItems(section).map((item) => item.text);
  if (checklist.length > 0) {
    return checklist.join(" · ");
  }

  return undefined;
}

function findSectionByHeading(
  sections: readonly ParsedSection[],
  pattern: RegExp,
): ParsedSection | undefined {
  for (const section of sections) {
    if (pattern.test(section.heading)) {
      return section;
    }

    const child = findSectionByHeading(section.children, pattern);
    if (child) {
      return child;
    }
  }

  return undefined;
}

function normalizeAgentStatus(
  status: unknown,
  agentId: string,
): "active" | "working" | "idle" {
  if (status === "active" || status === "working" || status === "idle") {
    return status;
  }

  if (agentId === "claude") {
    return "active";
  }
  if (agentId === "codex") {
    return "working";
  }
  return "idle";
}

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function fileName(file: string): string {
  return file.replace(/\\/g, "/").split("/").pop() ?? file;
}
