import type { SearchFacet, SearchResult } from "./html";

export type SearchParams = {
  q: string;
  term: string;
  family: string;
  species: string;
  formula: string;
  level: string;
  confidence: string;
};

export async function searchPages(db: D1Database, params: SearchParams): Promise<SearchResult[]> {
  const clauses: string[] = [];
  const binds: string[] = [];
  const match = ftsQuery(params.q);

  if (match) {
    clauses.push("pages_fts MATCH ?");
    binds.push(match);
  }

  if (params.term) {
    clauses.push("EXISTS (SELECT 1 FROM page_terms t WHERE t.page_slug = p.slug AND t.term_value = ?)");
    binds.push(params.term);
  }

  for (const [type, value] of filters(params)) {
    clauses.push("EXISTS (SELECT 1 FROM page_terms t WHERE t.page_slug = p.slug AND t.term_type = ? AND t.term_value = ?)");
    binds.push(type, value);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const snippetExpr = match
    ? "snippet(pages_fts, 2, '<mark>', '</mark>', '...', 24)"
    : "p.description";
  const order = match ? "rank" : "p.kind, p.title";

  const result = await db.prepare(
    `SELECT p.slug, p.title, p.kind, p.description, p.formula, p.level, p.confidence,
      ${snippetExpr} AS snippet
    FROM pages_fts
    JOIN pages p ON p.slug = pages_fts.slug
    ${where}
    ORDER BY ${order}
    LIMIT 40`
  ).bind(...binds).all<SearchResult>();
  return result.results || [];
}

export async function loadFacets(db: D1Database): Promise<SearchFacet[]> {
  const result = await db.prepare(
    `SELECT term_type AS type, term_value AS value, count(*) AS count
    FROM page_terms
    WHERE term_type IN ('family', 'species', 'formula', 'level', 'confidence')
    GROUP BY term_type, term_value
    ORDER BY count DESC, term_value
    LIMIT 60`
  ).all<SearchFacet>();
  return result.results || [];
}

function filters(params: SearchParams): Array<[string, string]> {
  const list: Array<[string, string]> = [];
  if (params.family) list.push(["family", params.family]);
  if (params.species) list.push(["species", params.species]);
  if (params.formula) list.push(["formula", params.formula]);
  if (params.level) list.push(["level", params.level]);
  if (params.confidence) list.push(["confidence", params.confidence]);
  return list;
}

function ftsQuery(query: string): string {
  return [...query.matchAll(/[\p{L}\p{N}_]+/gu)]
    .map(([term]) => term.slice(0, 48))
    .filter(Boolean)
    .map((term) => `${term}*`)
    .join(" ");
}
