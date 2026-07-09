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
