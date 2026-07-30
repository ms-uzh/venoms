import type { SearchFacet, SearchResult } from "./html";

export type SearchParams = {
  q: string;
  term: string;
  family: string[];
  species: string[];
  formula: string[];
  level: string[];
  confidence: string[];
  mz: number | null;
  tol: number;
  sort: string;
};

const FACET_TYPES = ["family", "species", "formula", "level", "confidence"] as const;

type Tables = { pages: string; terms: string; fts: string };

let versionCache: { value: string; at: number } | null = null;
const VERSION_TTL_MS = 60_000;

/**
 * Resolve the active search version (a content hash) that the Worker should read
 * from `meta.active_version`, and derive the per-version table names. Cached
 * briefly per isolate so a promotion propagates within ~a minute. Throws if no
 * version is active — the caller falls back to the content-index search.
 */
async function activeTables(db: D1Database): Promise<Tables> {
  const now = Date.now();
  if (!versionCache || now - versionCache.at > VERSION_TTL_MS) {
    const row = await db.prepare("SELECT value FROM meta WHERE key = 'active_version'").first<{ value: string }>();
    const value = row?.value ?? "";
    if (!/^[0-9a-f]{6,64}$/.test(value)) {
      throw new Error("no active search version");
    }
    versionCache = { value, at: now };
  }
  const v = versionCache.value;
  return { pages: `pages_${v}`, terms: `page_terms_${v}`, fts: `pages_fts_${v}` };
}

export async function searchPages(db: D1Database, params: SearchParams): Promise<SearchResult[]> {
  const t = await activeTables(db);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  const match = ftsQuery(params.q);

  if (match) {
    clauses.push(`${t.fts} MATCH ?`);
    binds.push(match);
  }

  if (params.term) {
    clauses.push(`EXISTS (SELECT 1 FROM ${t.terms} tt WHERE tt.page_slug = p.slug AND tt.term_key = ?)`);
    binds.push(normalizeTermKey(params.term));
  }

  for (const type of FACET_TYPES) {
    const values = params[type];
    if (!values.length) continue;
    const placeholders = values.map(() => "?").join(", ");
    clauses.push(`EXISTS (SELECT 1 FROM ${t.terms} tt WHERE tt.page_slug = p.slug AND tt.term_type = ? AND tt.term_value IN (${placeholders}))`);
    binds.push(type, ...values);
  }

  if (params.mz !== null) {
    const lo = params.mz - params.tol;
    const hi = params.mz + params.tol;
    clauses.push("(p.precursor1 BETWEEN ? AND ? OR p.nominal_mass BETWEEN ? AND ?)");
    binds.push(lo, hi, lo, hi);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const snippetExpr = match
    ? `snippet(${t.fts}, 2, '<mark>', '</mark>', '...', 24)`
    : "p.description";
  const order = orderClause(params.sort, Boolean(match));

  const result = await db.prepare(
    `SELECT p.slug, p.title, p.kind, p.description, p.formula, p.level, p.confidence,
      p.precursor1 AS precursor1, p.nominal_mass AS nominalMass,
      ${snippetExpr} AS snippet
    FROM ${t.fts}
    JOIN ${t.pages} p ON p.slug = ${t.fts}.slug
    ${where}
    ORDER BY ${order}
    LIMIT 60`
  ).bind(...binds).all<SearchResult>();
  return result.results || [];
}

export async function loadFacets(db: D1Database): Promise<SearchFacet[]> {
  const t = await activeTables(db);
  const result = await db.prepare(
    `SELECT term_type AS type, term_value AS value, count(*) AS count
    FROM ${t.terms}
    WHERE term_type IN ('family', 'level', 'confidence')
    GROUP BY term_type, term_value
    ORDER BY count DESC, term_value
    LIMIT 80`
  ).all<SearchFacet>();
  return result.results || [];
}

function orderClause(sort: string, hasMatch: boolean): string {
  switch (sort) {
    case "mass":
      return "p.precursor1 IS NULL, p.precursor1 ASC";
    case "mass-d":
      return "p.precursor1 DESC";
    case "name":
      return "p.title COLLATE NOCASE ASC";
    case "level":
      return "p.level ASC, p.title COLLATE NOCASE ASC";
    default:
      return hasMatch ? "rank" : "p.kind, p.title COLLATE NOCASE";
  }
}

function ftsQuery(query: string): string {
  return [...query.matchAll(/[\p{L}\p{N}_]+/gu)]
    .map(([term]) => term.slice(0, 48))
    .filter(Boolean)
    .map((term) => `${term}*`)
    .join(" ");
}

export function normalizeTermKey(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[ßβ]/g, "b")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
