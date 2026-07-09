import { Hono } from "hono";
import type { Context } from "hono";
import { marked } from "marked";
import { fetchTextAsset, loadCalcConfig, loadContentIndex, loadRedirectIndex } from "./assets";
import { calculate, defaultInput, inputFromForm } from "./calc/calculate";
import { canonicalPath, parseCompoundRecord, parseMarkdownDocument } from "./content";
import { calcPage, compoundPage, guidePage, homePage, layout, searchPage, sectionBrowsePage, subclassBrowsePage, type SearchFacet, type SearchResult } from "./html";
import { loadFacets, searchPages, type SearchParams } from "./search";
import type { ContentIndex, PageIndexEntry } from "./types";

type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

type AppEnv = {
  Bindings: Bindings;
};

type AppContext = Context<AppEnv, string, any>;

const app = new Hono<AppEnv>();

marked.setOptions({
  gfm: true,
  breaks: false,
});

app.get("/", async (c) => {
  const index = await loadContentIndex(c.env.ASSETS, c.req.raw);
  return html(c, "venoMS", homePage(index.pages), "Spider venom metabolite database.", index.pages, cacheHeaders("page"));
});

app.get("/search", async (c) => {
  const params = searchParams(c.req.url);
  const index = await loadContentIndex(c.env.ASSETS, c.req.raw);
  let results: SearchResult[];
  let facets: SearchFacet[];

  try {
    [results, facets] = await Promise.all([
      searchPages(c.env.DB, params),
      loadFacets(c.env.DB),
    ]);
  } catch {
    results = fallbackSearch(index, params);
    facets = fallbackFacets(index);
  }

  const filtered = params.q || params.mz !== null || params.family.length || params.species.length || params.formula.length || params.level.length || params.confidence.length;
  const title = filtered ? "Search results" : "Search";
  const body = searchPage(params, results, facets);
  return html(c, title, body, "Search venoMS compounds, species, formulae, and guide pages.", index.pages, cacheHeaders("search"));
});

app.get("/calc", async (c) => {
  const [index, config] = await Promise.all([
    loadContentIndex(c.env.ASSETS, c.req.raw),
    loadCalcConfig(c.env.ASSETS, c.req.raw),
  ]);
  const input = defaultInput(config);
  const result = calculate(config, input);
  return html(c, "FRIOC Calculator", calcPage(config, input, result), "FRIOC calculator for acylpolyamine names, formulae, masses, and fragments.", index.pages, cacheHeaders("page"));
});

app.post("/calc", async (c) => {
  const [index, config] = await Promise.all([
    loadContentIndex(c.env.ASSETS, c.req.raw),
    loadCalcConfig(c.env.ASSETS, c.req.raw),
  ]);
  const form = await c.req.formData();
  const input = inputFromForm(form, config);
  const result = calculate(config, input);
  return html(c, "FRIOC Calculator", calcPage(config, input, result), "FRIOC calculator result.", index.pages, cacheHeaders("private"));
});

app.get("*", async (c) => {
  const requestUrl = new URL(c.req.url);
  const pathname = requestUrl.pathname;

  if (isStaticAsset(pathname)) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  const canonical = canonicalPath(pathname.replace(/\/index\.html$/i, ""));
  if (canonical !== pathname && pathname !== "/") {
    requestUrl.pathname = canonical;
    requestUrl.search = "";
    return c.redirect(requestUrl.toString(), 301);
  }

  const [index, redirects] = await Promise.all([
    loadContentIndex(c.env.ASSETS, c.req.raw),
    loadRedirectIndex(c.env.ASSETS, c.req.raw),
  ]);
  const redirect = redirects.redirects[canonical] || redirects.redirects[`${canonical}/`];
  if (redirect) {
    return c.redirect(redirect, 301);
  }

  const browse = browseResponse(c, canonical, index);
  if (browse) {
    return browse;
  }

  const page = index.pages.find((entry) => `/${entry.slug}` === canonical || (!entry.slug && canonical === "/"));
  if (!page) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return cachedHtml(c, canonical, async () => {
    const raw = await fetchTextAsset(c.env.ASSETS, c.req.raw, `/${page.sourcePath}`);
    if (!raw) {
      return c.notFound();
    }
    const document = parseMarkdownDocument(raw);
    let body: string;
    if (page.kind === "compound") {
      const record = parseCompoundRecord(document.body);
      const restHtml = await marked.parse(record.restMarkdown);
      body = compoundPage(page, record, restHtml, index.pages);
    } else {
      const rendered = await marked.parse(document.body);
      body = guidePage(page, rendered);
    }
    return html(c, page.title, body, page.description, index.pages, cacheHeaders("page"));
  });
});

app.onError(async (error, c) => {
  console.error(error);
  const body = `<section class="content"><h1>Something went wrong</h1><p class="muted">The request could not be completed.</p></section>`;
  return html(c, "Error", body, "venoMS error page.", [], cacheHeaders("private"), 500);
});

export default app;

function html(
  c: AppContext,
  title: string,
  body: string,
  description: string,
  navPages: PageIndexEntry[],
  cacheControl: string,
  status = 200,
): Response {
  const currentPath = new URL(c.req.url).pathname;
  return new Response(layout({ title, body, description, navPages, currentPath }), {
    status,
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

async function cachedHtml(
  c: AppContext,
  cachePath: string,
  render: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(c.req.url);
  url.pathname = cachePath;
  url.search = "";
  const key = new Request(url.toString(), c.req.raw);
  const cached = await caches.default.match(key);
  if (cached) {
    return cached;
  }

  const response = await render();
  if (response.ok && response.headers.get("Cache-Control")?.includes("public")) {
    c.executionCtx.waitUntil(caches.default.put(key, response.clone()));
  }
  return response;
}

const BROWSE_TOPS: Record<string, { title: string; base: string }> = {
  alkaloids: { title: "Acylpolyamines", base: "/alkaloids" },
  "small-compounds": { title: "Small compounds", base: "/small-compounds" },
};

function browseResponse(c: AppContext, canonical: string, index: ContentIndex): Response | null {
  const segments = canonical.split("/").filter(Boolean);
  const top = segments[0];
  const meta = top ? BROWSE_TOPS[top] : undefined;
  if (!meta) {
    return null;
  }
  if (segments.length === 1) {
    const body = sectionBrowsePage(index.pages, meta.base);
    return html(c, meta.title, body, `Browse ${meta.title} in venoMS.`, index.pages, cacheHeaders("page"));
  }
  if (segments.length === 2) {
    const body = subclassBrowsePage(index.pages, top, segments[1], meta.title, meta.base);
    return html(c, meta.title, body, `Browse ${meta.title} compounds in venoMS.`, index.pages, cacheHeaders("page"));
  }
  return null;
}

export function searchParams(url: string): SearchParams {
  const params = new URL(url).searchParams;
  const values = (key: string): string[] =>
    params.getAll(key).map((value) => value.trim()).filter(Boolean);
  const mzRaw = (params.get("mz") || "").trim();
  const mz = mzRaw && Number.isFinite(Number(mzRaw)) ? Number(mzRaw) : null;
  const tolValue = Number((params.get("tol") || "").trim());
  const tol = Number.isFinite(tolValue) && tolValue > 0 ? tolValue : 0.02;
  return {
    q: String(params.get("q") || "").trim(),
    term: String(params.get("term") || "").trim(),
    family: values("family"),
    species: values("species"),
    formula: values("formula"),
    level: values("level"),
    confidence: values("confidence"),
    mz,
    tol,
    sort: String(params.get("sort") || "").trim(),
  };
}

function isStaticAsset(pathname: string): boolean {
  return [
    "/img/",
    "/img_MSMS/",
    "/img_Rules/",
    "/pdf/",
    "/csv/",
    "/theme-flex/",
    "/data/",
    "/site.css",
    "/favicon",
  ].some((prefix) => pathname.startsWith(prefix));
}

function cacheHeaders(kind: "page" | "search" | "private"): string {
  if (kind === "private") {
    return "private, no-store";
  }
  if (kind === "search") {
    return "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";
  }
  return "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
}

export function fallbackSearch(index: ContentIndex, params: SearchParams): SearchResult[] {
  const needle = params.q.toLowerCase();
  const lo = params.mz !== null ? params.mz - params.tol : 0;
  const hi = params.mz !== null ? params.mz + params.tol : 0;
  return index.pages
    .filter((page) => {
      if (params.term && !pageTerms(page).includes(params.term)) return false;
      if (params.family.length && !params.family.some((value) => page.family.includes(value))) return false;
      if (params.species.length && !params.species.some((value) => page.species.includes(value))) return false;
      if (params.formula.length && !params.formula.includes(page.formula)) return false;
      if (params.level.length && !params.level.includes(page.level)) return false;
      if (params.confidence.length && !params.confidence.includes(page.confidence)) return false;
      if (params.mz !== null) {
        const inRange = (value: number | null) => value !== null && value >= lo && value <= hi;
        if (!inRange(page.precursor1) && !inRange(page.nominalMass)) return false;
      }
      if (!needle) return true;
      return [page.title, page.description, page.bodyText, page.formula, ...page.categories, ...page.tags, ...page.family, ...page.species]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort(fallbackSort(params.sort))
    .slice(0, 60)
    .map((page) => ({
      slug: page.slug,
      title: page.title,
      kind: page.kind,
      description: page.description,
      formula: page.formula,
      level: page.level,
      confidence: page.confidence,
      snippet: page.description,
      precursor1: page.precursor1,
      nominalMass: page.nominalMass,
    }));
}

function fallbackSort(sort: string): (a: PageIndexEntry, b: PageIndexEntry) => number {
  switch (sort) {
    case "mass":
      return (a, b) => (a.precursor1 ?? Infinity) - (b.precursor1 ?? Infinity);
    case "mass-d":
      return (a, b) => (b.precursor1 ?? -Infinity) - (a.precursor1 ?? -Infinity);
    case "name":
      return (a, b) => a.title.localeCompare(b.title);
    case "level":
      return (a, b) => a.level.localeCompare(b.level) || a.title.localeCompare(b.title);
    default:
      return (a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title);
  }
}

function fallbackFacets(index: ContentIndex): SearchFacet[] {
  const counts = new Map<string, SearchFacet>();
  for (const page of index.pages) {
    for (const [type, values] of [
      ["family", page.family],
      ["level", page.level ? [page.level] : []],
      ["confidence", page.confidence ? [page.confidence] : []],
    ] as const) {
      for (const value of values) {
        const key = `${type}:${value}`;
        const facet = counts.get(key) || { type, value, count: 0 };
        facet.count += 1;
        counts.set(key, facet);
      }
    }
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.value.localeCompare(right.value)).slice(0, 60);
}

function pageTerms(page: PageIndexEntry): string[] {
  return [
    ...page.categories,
    ...page.tags,
    ...page.family,
    ...page.species,
    page.formula,
    page.level,
    page.confidence,
  ].filter(Boolean);
}
