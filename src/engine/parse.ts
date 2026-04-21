import { readFile, readdir, stat } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Blockquote, Content, Heading, List, ListItem, Paragraph, Root } from "mdast";
import { toString } from "mdast-util-to-string";

import { matchesScannedFile, shouldIgnoreDir } from "./fileset.js";
import { isExcludedPath, readRepoConfig } from "./config.js";
import type { ParsedChecklistItem, ParsedDoc, ParsedSection } from "./types.js";

const parser = unified().use(remarkParse);

export async function parseRepo(rootDir: string): Promise<ParsedDoc[]> {
  const config = await readRepoConfig(rootDir);
  const files = await findScannedFiles(rootDir, config.excludes);
  const docs = await Promise.all(files.map((file) => parseMarkdownFile(rootDir, file)));
  return docs.sort((left, right) => left.file.localeCompare(right.file));
}

export async function parseMarkdownFile(rootDir: string, absoluteFile: string): Promise<ParsedDoc> {
  const raw = await readFile(absoluteFile, "utf8");
  const info = await stat(absoluteFile);
  const parsed = matter(raw);
  const tree = parser.parse(parsed.content) as Root;

  return {
    file: relative(rootDir, absoluteFile).replace(/\\/g, "/"),
    modifiedAt: info.mtime.toISOString(),
    frontmatter: parsed.data as Record<string, unknown>,
    sections: buildSections(tree),
  };
}

export async function findScannedFiles(rootDir: string, excludes: readonly string[] = []): Promise<string[]> {
  const found: string[] = [];
  await walk(rootDir, found, rootDir, excludes);
  return found.sort((left, right) => left.localeCompare(right));
}

function buildSections(tree: Root): ParsedSection[] {
  const root: ParsedSection = {
    heading: "__root__",
    depth: 0,
    paragraphs: [],
    checklistItems: [],
    children: [],
  };

  const stack: ParsedSection[] = [root];

  for (const node of tree.children) {
    if (node.type === "heading") {
      const heading = createSection(node);
      while (stack.length > node.depth) {
        stack.pop();
      }
      stack[stack.length - 1]?.children.push(heading);
      stack.push(heading);
      continue;
    }

    const target = stack[stack.length - 1] ?? root;
    appendNode(target, node);
  }

  if (root.paragraphs.length > 0 || root.checklistItems.length > 0) {
    root.children.unshift({
      heading: "",
      line: 1,
      depth: 1,
      paragraphs: root.paragraphs,
      checklistItems: root.checklistItems,
      children: [],
    });
  }

  return root.children;
}

function createSection(node: Heading): ParsedSection {
  return {
    heading: toString(node).trim(),
    line: node.position?.start.line,
    depth: node.depth,
    paragraphs: [],
    checklistItems: [],
    children: [],
  };
}

function appendNode(section: ParsedSection, node: Content): void {
  if (node.type === "paragraph" || node.type === "blockquote") {
    const text = paragraphText(node);
    if (text) {
      section.paragraphs.push(text);
    }
    return;
  }

  if (node.type === "list") {
    section.checklistItems.push(...extractChecklistItems(node));
  }
}

function paragraphText(node: Paragraph | Blockquote): string {
  return toString(node).trim();
}

function extractChecklistItems(list: List): ParsedChecklistItem[] {
  return list.children.flatMap((item) => extractChecklistItem(item));
}

function extractChecklistItem(item: ListItem): ParsedChecklistItem[] {
  const ownText = item.children
    .filter((child) => child.type === "paragraph")
    .map((child) => toString(child).trim())
    .find(Boolean);

  const items: ParsedChecklistItem[] = [];
  if (ownText) {
    const parsed = parseChecklistText(ownText);
    items.push({
      text: parsed.text,
      checked: item.checked === true || parsed.checked,
      line: item.position?.start.line,
    });
  }

  for (const child of item.children) {
    if (child.type === "list") {
      items.push(...extractChecklistItems(child));
    }
  }

  return items;
}

function parseChecklistText(text: string): { text: string; checked: boolean } {
  const match = text.match(/^\[( |x|X)\]\s+(.*)$/);
  if (!match) {
    return { text, checked: false };
  }

  const marker = match[1] ?? " ";
  const content = match[2] ?? text;

  return {
    text: content,
    checked: marker.toLowerCase() === "x",
  };
}

async function walk(dir: string, found: string[], rootDir: string, excludes: readonly string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = resolve(dir, entry.name);
    const relativePath = relative(rootDir, absolute).replace(/\\/g, "/");

    if (isExcludedPath(relativePath, { excludes: [...excludes] })) {
      continue;
    }

    if (entry.isDirectory()) {
      if (dir.replace(/\\/g, "/").endsWith("/tests") && entry.name === "fixtures") {
        continue;
      }
      if (shouldIgnoreDir(entry.name)) {
        continue;
      }
      await walk(absolute, found, rootDir, excludes);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (matchesScannedFile(basename(entry.name))) {
      found.push(absolute);
    }
  }
}
