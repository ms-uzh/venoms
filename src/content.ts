import { parse as parseToml } from "smol-toml";

export type PageDocument = {
  frontmatter: {
    title?: string;
    categories?: string[];
    tags?: string[];
  };
  body: string;
};

export function parseMarkdownDocument(raw: string): PageDocument {
  if (!raw.startsWith("+++")) {
    return { frontmatter: {}, body: raw };
  }

  const end = raw.indexOf("\n+++", 3);
  if (end === -1) {
    return { frontmatter: {}, body: raw };
  }

  const toml = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  return { frontmatter: parseToml(toml) as PageDocument["frontmatter"], body };
}

export function normalizeTerms(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean);
}

export function canonicalPath(pathname: string): string {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  return clean ? `/${clean}` : "/";
}

export type CompoundRecord = {
  imageSrc: string;
  facts: Record<string, string>;
  fragmentSection: string;
  restMarkdown: string;
};

// Capture up to the image extension so filenames containing parens — e.g.
// /img/2-4-OH2-PhAcAsn3(Me)43.png — are not truncated at the first ")".
const IMAGE_RE = /!\[[^\]]*]\((.+?\.(?:png|jpe?g|gif|svg|webp))\)/i;

/**
 * Split a compound Markdown body into a structured record: the leading structure
 * image, the General Description key/value table (as `facts`), the "Calculated
 * MS/MS fragments" section, and the remaining sections as Markdown to render.
 * Tolerant of missing sections and blank separator rows.
 */
export function parseCompoundRecord(body: string): CompoundRecord {
  const imageMatch = body.match(IMAGE_RE);
  const imageSrc = imageMatch ? imageMatch[1].trim() : "";

  const sections = splitSections(body);
  const facts: Record<string, string> = {};
  let fragmentSection = "";
  const rest: string[] = [];

  for (const section of sections) {
    const heading = section.heading.toLowerCase();
    if (/general description/.test(heading)) {
      Object.assign(facts, parseKeyValueTable(section.content));
    } else if (/calculated ms\/ms fragments/.test(heading)) {
      fragmentSection = section.content.trim();
    } else if (heading) {
      rest.push(`## ${section.heading}\n\n${section.content.trim()}`);
    }
  }

  return { imageSrc, facts, fragmentSection, restMarkdown: rest.join("\n\n").trim() };
}

function splitSections(body: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  let current: { heading: string; content: string } | null = null;
  for (const line of body.split("\n")) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1], content: "" };
    } else if (current) {
      current.content += `${line}\n`;
    }
  }
  if (current) sections.push(current);
  return sections;
}

function parseKeyValueTable(markdown: string): Record<string, string> {
  const facts: Record<string, string> = {};
  for (const line of markdown.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    // Table rows have a leading/trailing pipe, so cells[0]/last are empty.
    const filled = cells.filter((cell, index) => index > 0 && index < cells.length - 1);
    if (filled.length < 2) continue;
    const key = filled[0];
    const value = filled[1];
    if (!key || /^-+$/.test(key) || key.toLowerCase() === "name") continue;
    const clean = value.replace(/`/g, "").trim();
    if (clean) facts[key] = clean;
  }
  return facts;
}

/** Look up a fact by a case-insensitive key prefix. */
export function fact(facts: Record<string, string>, ...prefixes: string[]): string {
  for (const [key, value] of Object.entries(facts)) {
    const lower = key.toLowerCase();
    if (prefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()))) {
      return value;
    }
  }
  return "";
}
