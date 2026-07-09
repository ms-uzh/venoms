import type { CalcConfig, PageIndexEntry } from "./types";
import type { CalculationInput, CalculationResult } from "./calc/calculate";

export type LayoutOptions = {
  title: string;
  body: string;
  description?: string;
  navPages?: PageIndexEntry[];
  currentPath?: string;
};

export function layout({ title, body, description, currentPath = "/" }: LayoutOptions): string {
  const nav = buildNav(currentPath);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} :: venoMS</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  <link rel="stylesheet" href="/site.css">
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="sidebar-head">
        <a class="brand" href="/"><span>veno</span>MS</a>
        <div class="sidebar-tagline">Spider venom metabolite database</div>
      </div>
      ${nav}
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="topbar-title">${escapeHtml(title)}</div>
        <form class="search" action="/search" method="get">
          <input name="q" type="search" placeholder="Search compounds, species, formulae" aria-label="Search">
          <button type="submit">Search</button>
        </form>
      </div>
      ${body}
    </main>
  </div>
</body>
</html>`;
}

export function homePage(pages: PageIndexEntry[]): string {
  const compounds = pages.filter((page) => page.kind === "compound").slice(0, 12);
  const cards = compounds.map(pageCard).join("");

  return `<section class="content">
    <h1>venoMS</h1>
    <p class="lead">A database for low molecular weight compounds found in spider venoms, now served from one Cloudflare Worker app.</p>
    <form class="hero-search" action="/search" method="get">
      <input name="q" type="search" placeholder="Serotonin, Agelenidae, C17H39N7O, Prop3334Gu">
      <button type="submit">Search</button>
    </form>
    <div class="actions">
      <a class="button" href="/calc">Open FRIOC calculator</a>
      <a class="button secondary" href="/structure-elucidation/fragmentation-rules">Fragmentation rules</a>
    </div>
    <h2>Sample compounds</h2>
    <div class="grid">${cards}</div>
  </section>`;
}

export function pageChrome(page: PageIndexEntry, renderedMarkdown: string): string {
  const terms = [
    ...(page.formula ? [page.formula] : []),
    ...page.family.slice(0, 5),
    ...page.species.slice(0, 5),
    page.level,
    page.confidence,
  ]
    .filter(Boolean)
    .map((term) => `<a class="pill" href="/search?term=${encodeURIComponent(term)}">${escapeHtml(term)}</a>`)
    .join("");

  return `<article class="content">
    <h1>${escapeHtml(page.title)}</h1>
    ${terms ? `<div class="meta">${terms}</div>` : ""}
    ${renderedMarkdown}
  </article>`;
}

export type SearchResult = {
  slug: string;
  title: string;
  kind: string;
  description: string;
  formula: string;
  level: string;
  confidence: string;
  snippet: string;
};

export type SearchFacet = {
  type: string;
  value: string;
  count: number;
};

export function searchPage(query: string, term: string, activeFilters: string[], results: SearchResult[], facets: SearchFacet[]): string {
  const resultList = results.map((result) => `<article class="card">
    <h2><a href="/${escapeHtml(result.slug)}">${escapeHtml(result.title)}</a></h2>
    <div class="meta">${[result.formula, result.level, result.confidence].filter(Boolean).map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("")}</div>
    <p>${formatSnippet(result.snippet || result.description)}</p>
  </article>`).join("");
  const facetList = facets.map((facet) => `<a class="pill" href="/search?${encodeURIComponent(facet.type)}=${encodeURIComponent(facet.value)}">${escapeHtml(facet.type)}: ${escapeHtml(facet.value)} (${facet.count})</a>`).join("");
  const filterText = [...(term ? [term] : []), ...activeFilters];

  return `<section class="content">
    <h1>Search</h1>
    <form class="hero-search compact" action="/search" method="get">
      <input name="q" type="search" value="${escapeHtml(query)}" placeholder="Compound, formula, species, family">
      <input name="term" type="search" value="${escapeHtml(term)}" placeholder="Facet term">
      <button type="submit">Search</button>
    </form>
    ${facetList ? `<div class="meta">${facetList}</div>` : ""}
    <p class="muted">${results.length} result${results.length === 1 ? "" : "s"}${query ? ` for "${escapeHtml(query)}"` : ""}${filterText.length ? ` filtered by "${escapeHtml(filterText.join(", "))}"` : ""}.</p>
    <div class="grid">${resultList}</div>
  </section>`;
}

export function calcPage(config: CalcConfig, input: CalculationInput, result: CalculationResult | null): string {
  const max = config.app.maxPolyamineSelectors || 10;
  const polySelects = Array.from({ length: max }, (_, index) =>
    select(`polyamine${index + 1}`, `Polyamine ${index + 1}`, config.polyamines.map((item) => item.name), input.polyamines[index] ?? "-")
  ).join("");
  const spiderSelects = Array.from({ length: 3 }, (_, index) =>
    select(`spider${index + 1}`, `Spider ${index + 1}`, ["-", ...config.spiders.map((item) => item.species)], input.spiders[index] ?? "-")
  ).join("");

  return `<section class="content">
    <h1>FRIOC Calculator</h1>
    <p class="muted">Calculate generic names, formulas, masses, precursors, HDX, quaternary charge, MS/MS fragments, and starter Markdown entries.</p>
    <form class="calc-form" action="/calc" method="post">
      ${select("head", "Head", config.heads.map((item) => item.name), input.head)}
      ${polySelects}
      ${select("tail", "Tail", config.tails.map((item) => item.name), input.tail)}
      ${spiderSelects}
      <div><button type="submit">Calculate</button></div>
    </form>
    ${result ? calcResult(result) : ""}
  </section>`;
}

function calcResult(result: CalculationResult): string {
  const fragmentRows = result.fragments.map((fragment, index) => `<tr>
    <td>${index + 1}</td>
    <td>${formatNumber(fragment.a)}</td>
    <td>${formatNumber(fragment.b)}</td>
    <td>${formatNumber(fragment.c)}</td>
    <td>${formatNumber(fragment.ta)}</td>
    <td>${formatNumber(fragment.z)}</td>
    <td>${formatNumber(fragment.y)}</td>
    <td>${formatNumber(fragment.tz)}</td>
  </tr>`).join("");

  return `<section>
    <h2>Resulting Characteristics</h2>
    <div class="result-grid">
      ${metric("Generic name", result.genericName)}
      ${metric("Molecular mass", formatNumber(result.molecularMass))}
      ${metric("Molecular formula", result.chemicalFormulaHtml)}
      ${metric("Charge", String(result.quaternary))}
      ${metric("HDX", String(result.hdx))}
      ${metric("Precursor 1", formatNumber(result.precursor1))}
      ${metric("Precursor 2", formatNumber(result.precursor2))}
      ${metric("Precursor HDX 1", formatNumber(result.precursorHdx1))}
      ${metric("Precursor HDX 2", formatNumber(result.precursorHdx2))}
    </div>
    <h2>Fragment Ions</h2>
    <table>
      <thead><tr><th>#</th><th>a</th><th>b</th><th>c</th><th>ta</th><th>z</th><th>y</th><th>tz</th></tr></thead>
      <tbody>${fragmentRows}</tbody>
    </table>
    <h2>Markdown Entry</h2>
    <textarea class="markdown-output" readonly>${escapeHtml(result.markdown)}</textarea>
  </section>`;
}

function select(name: string, label: string, values: string[], selected: string): string {
  const options = values.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value || "(empty)")}</option>`).join("");
  return `<label>${escapeHtml(label)}<select name="${escapeHtml(name)}">${options}</select></label>`;
}

function metric(label: string, value: string): string {
  return `<div class="metric"><strong>${value}</strong><span class="muted">${escapeHtml(label)}</span></div>`;
}

function pageCard(page: PageIndexEntry): string {
  return `<article class="card">
    <h2><a href="/${escapeHtml(page.slug)}">${escapeHtml(page.title)}</a></h2>
    <div class="meta">${[page.formula, page.level, page.confidence].filter(Boolean).map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("")}</div>
    <p>${escapeHtml(page.description || "Indexed from Markdown content.")}</p>
  </article>`;
}

type NavSection = {
  title: string;
  items: Array<{
    href: string;
    label: string;
    detail: string;
  }>;
};

function buildNav(currentPath: string): string {
  const sections: NavSection[] = [
    {
      title: "Browse",
      items: [
        { href: "/alkaloids", label: "Acylpolyamines", detail: "Alkaloids" },
        { href: "/small-compounds", label: "Small compounds", detail: "Amines, acids, nucleosides" },
        { href: "/structure-elucidation", label: "Analytical tools", detail: "Methods and fragmentation" },
      ],
    },
    {
      title: "Tools",
      items: [
        { href: "/search", label: "Search index", detail: "Full text and facets" },
        { href: "/calc", label: "FRIOC calculator", detail: "Formulae and fragments" },
        { href: "/contact", label: "Contact", detail: "Corrections and literature" },
      ],
    },
  ];

  return `<nav class="nav" aria-label="Primary">${sections.map((section) => `<section class="nav-section">
    <div class="nav-title">${escapeHtml(section.title)}</div>
    <div class="nav-links">${section.items.map((item) => navLink(item, currentPath)).join("")}</div>
  </section>`).join("")}</nav>`;
}

function navLink(item: NavSection["items"][number], currentPath: string): string {
  const active = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(`${item.href}/`));
  return `<a class="nav-link${active ? " is-active" : ""}" href="${escapeHtml(item.href)}">
    <span>${escapeHtml(item.label)}</span>
    <small>${escapeHtml(item.detail)}</small>
  </a>`;
}

function formatSnippet(value: string): string {
  return escapeHtml(value)
    .replaceAll("&lt;mark&gt;", "<mark>")
    .replaceAll("&lt;/mark&gt;", "</mark>");
}

function formatNumber(value: number): string {
  return value === -1 ? "-" : value.toFixed(5);
}

export function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
