import type { CalcConfig, PageIndexEntry } from "./types";
import type { CalculationInput, CalculationResult } from "./calc/calculate";
import { fact, type CompoundRecord } from "./content";
import type { SearchParams } from "./search";

export type LayoutOptions = {
  title: string;
  body: string;
  description?: string;
  navPages?: PageIndexEntry[];
  currentPath?: string;
  headExtra?: string;
  analyticsToken?: string;
};

export function layout({ title, body, description, navPages = [], currentPath = "/", headExtra = "", analyticsToken = "" }: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} :: venoMS</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  <link rel="stylesheet" href="/site.css">
  ${headExtra}
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="sidebar-head">
        <a class="brand" href="/"><span>veno</span>MS</a>
        <div class="sidebar-tagline">Low-molecular-mass compounds of spider venoms · &lt; 1000 Da</div>
      </div>
      ${buildSidebar(navPages, currentPath)}
      <div class="rail-foot">
        <div class="lbl">External resources</div>
        <a href="https://spider.rootd.ch">FRIOC calculator <span>&#8599;</span></a>
        <a href="http://www.arachnoserver.org">ArachnoServer <span>&#8599;</span></a>
        <a href="https://wsc.nmbe.ch">World Spider Catalog <span>&#8599;</span></a>
      </div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="omni">
          <form class="omni-input" action="/search" method="get" role="search">
            ${searchIcon}
            <input id="omni" name="q" type="search" placeholder="Search name, formula, m/z, or spider…" autocomplete="off" aria-label="Search compounds">
            <kbd>&#8984;K</kbd>
          </form>
          <div class="omni-pop" id="omniPop" role="listbox" aria-label="Suggestions"></div>
        </div>
        <div class="topbar-links">
          <a href="/search">Advanced search</a>
          <a href="/calc">FRIOC</a>
          <a href="/csv/venoms_table.csv">CSV table &#8595;</a>
        </div>
      </div>
      ${body}
    </main>
  </div>
  ${omniScript}
  ${analyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${escapeHtml(analyticsToken)}"}'></script>` : ""}
</body>
</html>`;
}

const omniScript = `<script>
(function(){
  var boxes=[].slice.call(document.querySelectorAll('.omni'));
  if(!boxes.length) return;
  var data=null;
  function load(){ if(data) return Promise.resolve(); return fetch('/data/suggest.json').then(function(r){return r.json();}).then(function(j){data=j;}).catch(function(){data=[];}); }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function sub(f){ return f.replace(/([A-Za-z)\\]])(\\d+)/g,'$1<sub>$2</sub>'); }
  function setup(box){
    var input=box.querySelector('input[type=search]'), pop=box.querySelector('.omni-pop');
    if(!input||!pop) return;
    var cur=-1, rows=[];
    function close(){ pop.classList.remove('show'); pop.innerHTML=''; cur=-1; rows=[]; }
    function search(q){
      q=(q||'').trim(); if(!q||!data){ close(); return; }
      var lower=q.toLowerCase(); var num=parseFloat(q); var isNum=!isNaN(num)&&/^[0-9.]+$/.test(q);
      var hits=[];
      for(var i=0;i<data.length && hits.length<8;i++){ var d=data[i];
        if(d.t.toLowerCase().indexOf(lower)>=0 || (d.f&&d.f.toLowerCase().indexOf(lower)>=0) || (d.g&&d.g.toLowerCase().indexOf(lower)>=0) || (isNum&&d.m!=null&&Math.abs(d.m-num)<=0.5)) hits.push(d);
      }
      if(!hits.length){ close(); return; }
      rows=hits; cur=-1;
      var html='<div class="sec">'+(isNum?'Mass matches':'Compounds')+'</div>';
      for(var k=0;k<hits.length;k++){ var h=hits[k];
        html+='<a class="omni-row" href="/'+esc(h.s)+'"><span class="nm">'+esc(h.t)+'</span><span class="fo">'+sub(esc(h.f))+'</span>'+(h.g?'<span class="kindtag">'+esc(h.g)+'</span>':'')+'<span class="ms">'+(h.m!=null?h.m.toFixed(4):'')+'</span></a>';
      }
      pop.innerHTML=html; pop.classList.add('show');
    }
    function highlight(){ var els=pop.querySelectorAll('.omni-row'); for(var i=0;i<els.length;i++) els[i].classList.toggle('cur', i===cur); if(cur>=0&&els[cur]) els[cur].scrollIntoView({block:'nearest'}); }
    input.addEventListener('focus', function(){ load().then(function(){ if(input.value) search(input.value); }); });
    input.addEventListener('input', function(){ if(data) search(input.value); else load().then(function(){ search(input.value); }); });
    input.addEventListener('keydown', function(e){
      var els=pop.querySelectorAll('.omni-row');
      if(e.key==='ArrowDown'){ if(!els.length) return; e.preventDefault(); cur=(cur+1)%els.length; highlight(); }
      else if(e.key==='ArrowUp'){ if(!els.length) return; e.preventDefault(); cur=(cur-1+els.length)%els.length; highlight(); }
      else if(e.key==='Enter'){ if(cur>=0&&rows[cur]){ e.preventDefault(); location.href='/'+rows[cur].s; } }
      else if(e.key==='Escape'){ close(); }
    });
    box._omniClose=close;
  }
  boxes.forEach(setup);
  document.addEventListener('click', function(e){ boxes.forEach(function(b){ if(!b.contains(e.target) && b._omniClose) b._omniClose(); }); });
  document.addEventListener('keydown', function(e){ if((e.metaKey||e.ctrlKey)&&(e.key==='k'||e.key==='K')){ e.preventDefault(); var i=boxes[0].querySelector('input[type=search]'); if(i) i.focus(); } });
})();
</script>`;

const searchIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`;

export function homePage(pages: PageIndexEntry[]): string {
  const model = buildNavModel(pages);
  const compoundCount = pages.filter((page) => page.kind === "compound").length;
  const acyl = model.structure.find((section) => section.base === "/alkaloids");
  const small = model.structure.find((section) => section.base === "/small-compounds");
  const featured = pages.filter((page) => page.kind === "compound" && page.precursor1).slice(0, 8);

  return `<section class="content">
    <div style="border-bottom:1px solid var(--line);padding-bottom:28px;margin-bottom:28px">
      <div class="eyebrow">Spider venom metabolite database</div>
      <h1 style="font-size:2.6rem">The reference for low-mass spider-venom metabolites.</h1>
      <p class="lead">Fast access to ESI-MS/MS spectra, fragment-ion annotation, and the literature behind the
        structure elucidation, synthesis, and activity of &lt; 1000 Da venom compounds.</p>
      <div class="omni" style="max-width:600px">
        <form class="hero-search" action="/search" method="get" role="search">
          ${searchIcon}
          <input name="q" type="search" placeholder="Serotonin · C23H40N6O5 · 481.31 · Agelenidae" autocomplete="off" aria-label="Search compounds">
        </form>
        <div class="omni-pop" role="listbox" aria-label="Suggestions"></div>
      </div>
      <div class="actions"><a class="btn" href="/calc">Open FRIOC calculator &#8599;</a></div>
    </div>

    <div class="stats">
      <div class="stat"><b>${compoundCount}</b><span>Compounds</span></div>
      <div class="stat"><b>${acyl ? acyl.total : 0}</b><span>Acylpolyamines</span></div>
      <div class="stat"><b>${small ? small.total : 0}</b><span>Small compounds</span></div>
      <div class="stat"><b>${model.spider.length}</b><span>Spider families</span></div>
    </div>

    <div class="lanes">
      <a class="lane" href="/alkaloids">
        <h3>Browse by structure</h3>
        <p>Drill the chemical tree — acyl head groups, polyamine backbones, and small-compound classes.</p>
        <span class="go">Acylpolyamines · Small compounds &#8594;</span>
      </a>
      <a class="lane" href="/search">
        <h3>Browse by spider</h3>
        <p>Start from the taxonomy — family and species down to every metabolite detected in that venom.</p>
        <span class="go">${model.spider.slice(0, 2).map((f) => escapeHtml(f.name)).join(" · ")} · more &#8594;</span>
      </a>
      <a class="lane tool" href="/search">
        <h3>Identify by mass</h3>
        <p>Enter a precursor m/z with a tolerance window and match it against every recorded ion.</p>
        <span class="go">Mass lookup &#8594;</span>
      </a>
      <a class="lane tool" href="/calc">
        <h3>FRIOC calculator</h3>
        <p>Build a polyamine from head, backbone, and tail — get names, formula, mass, and fragment ions.</p>
        <span class="go">Open calculator &#8594;</span>
      </a>
    </div>

    <div class="section-head"><h2>Featured compounds</h2><a href="/search">See all compounds &#8594;</a></div>
    ${compoundTable(featured, "family")}
  </section>`;
}

export function sectionBrowsePage(pages: PageIndexEntry[], base: string): string {
  const model = buildNavModel(pages);
  const section = model.structure.find((entry) => entry.base === base);
  if (!section) {
    return `<section class="content"><h1>Not found</h1></section>`;
  }
  const cards = section.subs.map((sub) => `<a class="subcard" href="${escapeHtml(sub.href)}">
    <span class="t">${escapeHtml(sub.label)}</span>
    <span class="c">${sub.count} compound${sub.count === 1 ? "" : "s"} &#8594;</span>
  </a>`).join("");
  const intro = base === "/alkaloids"
    ? "Alkaloidal spider toxins built from an acyl head group, a polyamine backbone, and optional amino-acid residues. Choose a subclass by its acyl head."
    : "Amino acids, biogenic amines, nucleosides, quaternary amines, and organic acids detected across spider venoms.";

  return `<section class="content">
    <div class="crumbs"><a href="/">Home</a> &rsaquo; ${escapeHtml(section.title)}</div>
    <div class="eyebrow">${section.total} compounds &middot; ${section.subs.length} subclasses</div>
    <h1>${escapeHtml(section.title)}</h1>
    <p class="lead">${escapeHtml(intro)}</p>
    <div class="subgrid" style="margin-top:22px">${cards}</div>
  </section>`;
}

export function subclassBrowsePage(pages: PageIndexEntry[], top: string, subSlug: string, sectionTitle: string, sectionBase: string): string | null {
  const prefix = `${top}/${subSlug}/`;
  const compounds = pages
    .filter((page) => page.kind === "compound" && page.slug.startsWith(prefix))
    .sort((a, b) => (a.precursor1 || a.nominalMass || 0) - (b.precursor1 || b.nominalMass || 0));
  if (compounds.length === 0) {
    return null;
  }
  const label = subclassLabel(compounds[0].sourcePath, subSlug);

  return `<section class="content">
    <div class="crumbs"><a href="/">Home</a> &rsaquo; <a href="${escapeHtml(sectionBase)}">${escapeHtml(sectionTitle)}</a> &rsaquo; ${escapeHtml(label)}</div>
    <div class="eyebrow">${compounds.length} compound${compounds.length === 1 ? "" : "s"}</div>
    <h1>${escapeHtml(label)}</h1>
    ${compoundTable(compounds, "family")}
  </section>`;
}

function compoundTable(pages: PageIndexEntry[], secondary: "family" | "backbone"): string {
  const rows = pages.map((page) => compoundRow(page)).join("");
  const secondaryHead = secondary === "family" ? "Spider family" : "Backbone";
  return `<div class="tbl-wrap"><table class="data">
    <thead><tr><th>Compound</th><th>Formula</th><th class="mono">[M+H]&#8314;</th><th>${secondaryHead}</th><th>Level</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function compoundRow(page: PageIndexEntry): string {
  const href = `/${page.slug}`;
  const mass = page.precursor1 ? page.precursor1.toFixed(5) : (page.nominalMass ? String(page.nominalMass) : "—");
  const family = page.family.length
    ? `${escapeHtml(page.family[0])}${page.family.length > 1 ? ` <span class="muted">+${page.family.length - 1}</span>` : ""}`
    : `<span style="color:var(--ink-3)">—</span>`;
  return `<tr onclick="location.href='${escapeHtml(href)}'">
    <td class="name"><a href="${escapeHtml(href)}">${escapeHtml(page.title)}</a></td>
    <td class="mono fo">${formatFormula(page.formula)}</td>
    <td class="mono">${mass}</td>
    <td>${family}</td>
    <td>${levelBadge(page.level)}</td>
  </tr>`;
}

export function formatFormula(formula: string): string {
  if (!formula) return "—";
  return escapeHtml(formula).replace(/([A-Za-z\)\]])(\d+)/g, "$1<sub>$2</sub>");
}

export function levelBadge(level: string): string {
  if (!level) return "";
  const match = level.match(/(\d)/);
  const cls = match ? `lv${match[1]}` : "";
  return `<span class="badge ${cls}"><span class="dot"></span>${escapeHtml(level)}</span>`;
}

export function guidePage(page: PageIndexEntry, renderedMarkdown: string): string {
  return `<article class="content">
    <h1>${escapeHtml(page.title)}</h1>
    ${renderedMarkdown}
  </article>`;
}

export function compoundPage(
  page: PageIndexEntry,
  record: CompoundRecord,
  restHtml: string,
  pages: PageIndexEntry[],
): string {
  const { facts } = record;
  const synonym = fact(facts, "synonym");
  const precursor1 = fact(facts, "precursor 1") || (page.precursor1 ? page.precursor1.toFixed(5) : "");
  const precursor2 = fact(facts, "precursor 2");
  const hdx = fact(facts, "hdx");
  const rt = factExact(facts, "rt");
  const discovered = fact(facts, "discovered");
  const smiles = fact(facts, "smiles");
  const inchi = fact(facts, "inchi");
  const cas = fact(facts, "cas");

  const badges = [
    levelBadge(page.level),
    page.confidence ? `<span class="badge">${escapeHtml(page.confidence)} confidence</span>` : "",
    ...page.family.slice(0, 3).map((f) => `<a class="chip" href="/search?family=${encodeURIComponent(f)}">${escapeHtml(f)}</a>`),
  ].filter(Boolean).join("");

  const cells = [
    precursor1 && factCell("[M+H]&#8314;", precursor1),
    precursor2 && factCell("[M+2H]&#178;&#8314;", precursor2),
    hdx && factCell("HDX", `${escapeHtml(hdx)} <small>exch.</small>`),
    rt && factCell("Retention t&#7523;", `${escapeHtml(rt)} <small>min</small>`),
    discovered && factCell("Discovered", escapeHtml(discovered), true),
    page.nominalMass && factCell("Nominal mass", String(page.nominalMass)),
  ].filter(Boolean) as string[];
  while (cells.length % 3 !== 0) cells.push(`<div class="fact"></div>`);
  const facts_cells = cells.join("");

  const structKv = [
    smiles && `<dt>SMILES</dt><dd>${escapeHtml(smiles)}</dd>`,
    inchi && `<dt>InChI</dt><dd>${escapeHtml(inchi)}</dd>`,
    cas && cas !== "---" && `<dt>CAS</dt><dd>${escapeHtml(cas)}</dd>`,
  ].filter(Boolean).join("");
  const structSection = (record.imageSrc || structKv) ? `<div class="rec-sec" id="structure">
    <h2>Structure</h2>
    <div class="struct">
      ${record.imageSrc ? `<div class="mol"><img src="${escapeHtml(record.imageSrc)}" alt="Structure of ${escapeHtml(page.title)}"></div>` : "<div></div>"}
      ${structKv ? `<dl class="kv">${structKv}</dl>` : "<div></div>"}
    </div>
  </div>` : "";

  const fragSection = record.fragmentSection ? `<div class="rec-sec" id="fragments">
    <h2>Calculated MS/MS fragments</h2>
    ${renderFragmentTable(record.fragmentSection)}
  </div>` : "";

  return `<article class="content">
    <div class="rec-layout">
      <div>
        <div class="crumbs">${breadcrumb(page)}</div>
        <div class="rec-head">
          ${badges ? `<div class="over">${badges}</div>` : ""}
          <h1>${escapeHtml(page.title)}</h1>
          <div class="rec-formula">${formatFormula(page.formula)}${synonym ? ` &middot; synonym ${escapeHtml(synonym)}` : ""}</div>
          ${facts_cells ? `<div class="factgrid">${facts_cells}</div>` : ""}
        </div>
        ${structSection}
        ${fragSection}
        ${restHtml}
      </div>
      <aside class="rail">
        <div class="card frioc">
          <h4>FRIOC</h4>
          <p style="margin:0 0 12px;font-size:.83rem;color:var(--ink-2)">Recompute this backbone or explore variants in the fragment-ion calculator.</p>
          <a class="btn sm" href="/calc">Open FRIOC &#8594;</a>
        </div>
        ${relatedCard(page, pages)}
      </aside>
    </div>
  </article>`;
}

function factCell(label: string, value: string, text = false): string {
  return `<div class="fact"><div class="k">${label}</div><div class="v${text ? " text" : ""}">${value}</div></div>`;
}

function factExact(facts: Record<string, string>, key: string): string {
  for (const [factKey, value] of Object.entries(facts)) {
    if (factKey.toLowerCase() === key.toLowerCase()) return value;
  }
  return "";
}

function breadcrumb(page: PageIndexEntry): string {
  const segs = page.slug.split("/");
  const top = segs[0];
  const meta = top === "alkaloids"
    ? { title: "Acylpolyamines", base: "/alkaloids" }
    : top === "small-compounds"
      ? { title: "Small compounds", base: "/small-compounds" }
      : null;
  if (!meta || segs.length < 3) {
    return `<a href="/">Home</a>`;
  }
  const subLabel = subclassLabel(page.sourcePath, segs[1]);
  return `<a href="/">Home</a> &rsaquo; <a href="${meta.base}">${escapeHtml(meta.title)}</a> &rsaquo; <a href="${meta.base}/${escapeHtml(segs[1])}">${escapeHtml(subLabel)}</a>`;
}

function relatedCard(page: PageIndexEntry, pages: PageIndexEntry[]): string {
  const segs = page.slug.split("/");
  const prefix = segs.length >= 3 ? `${segs[0]}/${segs[1]}/` : "";
  const family = page.family[0];
  const related = pages
    .filter((entry) => entry.slug !== page.slug && entry.kind === "compound")
    .filter((entry) => (prefix && entry.slug.startsWith(prefix)) || (family && entry.family.includes(family)))
    .sort((a, b) => Math.abs((a.precursor1 || 0) - (page.precursor1 || 0)) - Math.abs((b.precursor1 || 0) - (page.precursor1 || 0)))
    .slice(0, 6);
  if (related.length === 0) return "";
  const title = prefix ? "Related · same subclass" : "Related compounds";
  const rows = related.map((entry) => `<a href="/${escapeHtml(entry.slug)}">
    <span class="rt">${escapeHtml(entry.title)}</span>
    <span class="rm">${entry.precursor1 ? entry.precursor1.toFixed(2) : ""}</span>
  </a>`).join("");
  return `<div class="card related"><h4>${title}</h4>${rows}</div>`;
}

function renderFragmentTable(markdown: string): string {
  const rows = markdown.split("\n")
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .map((cells) => cells.filter((cell, index) => index > 0 && index < cells.length - 1))
    .filter((cells) => cells.length > 1 && !cells.every((cell) => /^-*$/.test(cell)));
  if (rows.length < 2) return "";
  const [head, ...body] = rows;
  const headHtml = head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
  const bodyHtml = body.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<div class="msms-scroll"><table class="msms"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
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
  precursor1?: number | null;
  nominalMass?: number | null;
};

export type SearchFacet = {
  type: string;
  value: string;
  count: number;
};

const FACET_TYPES = ["family", "species", "formula", "level", "confidence"] as const;

export function searchPage(params: SearchParams, results: SearchResult[], facets: SearchFacet[]): string {
  const families = facets.filter((facet) => facet.type === "family").slice(0, 14);
  const levels = facets.filter((facet) => facet.type === "level").sort((a, b) => a.value.localeCompare(b.value));
  const confidences = facets.filter((facet) => facet.type === "confidence").sort((a, b) => a.value.localeCompare(b.value));

  const resultRows = results.map((result) => searchResultRow(result)).join("");
  const activeChips = activeFilterChips(params);
  const hasFilters = Boolean(params.term) || FACET_TYPES.some((type) => params[type].length) || params.mz !== null;

  return `<section class="content">
    <div class="eyebrow">Search &amp; filter</div>
    <h1 style="font-size:2rem;margin:0 0 20px">Find a compound</h1>
    <div class="omni" style="max-width:640px;margin-bottom:24px">
      <form class="omni-input" action="/search" method="get" role="search">
        ${searchIcon}
        <input name="q" type="search" value="${escapeHtml(params.q)}" placeholder="Name, formula, species, family" autocomplete="off" aria-label="Search">
        ${hiddenParams(params, ["q"])}
      </form>
      <div class="omni-pop" role="listbox" aria-label="Suggestions"></div>
    </div>
    <div class="search-layout">
      <aside class="filters">
        <form class="masslookup" action="/search" method="get">
          <div class="flabel">Mass lookup</div>
          <div class="row">
            <input name="mz" inputmode="decimal" value="${params.mz ?? ""}" placeholder="m/z e.g. 481.31" aria-label="m/z">
            <input name="tol" class="tol" inputmode="decimal" value="${params.mz !== null ? params.tol : ""}" placeholder="± 0.02" aria-label="tolerance">
          </div>
          <div class="hint">Matches recorded precursor ions within tolerance.</div>
          ${hiddenParams(params, ["mz", "tol"])}
        </form>
        ${facetGroup("Spider family", "family", families, params)}
        ${facetGroup("Structure level", "level", levels, params)}
        ${facetGroup("Confidence", "confidence", confidences, params)}
      </aside>
      <div>
        <div class="results-head">
          <span class="count"><b>${results.length}</b> result${results.length === 1 ? "" : "s"}${results.length === 60 ? "+" : ""}${params.q ? ` for &ldquo;${escapeHtml(params.q)}&rdquo;` : ""}</span>
          <span style="display:flex;gap:4px;font-size:.78rem">${sortLinks(params)}</span>
        </div>
        ${activeChips ? `<div class="active-filters">${activeChips}</div>` : ""}
        ${resultRows
          ? `<div class="tbl-wrap"><table class="data"><thead>
              <tr><th>Compound</th><th>Formula</th><th class="mono">[M+H]&#8314;</th><th>Level</th></tr></thead>
              <tbody>${resultRows}</tbody></table></div>`
          : `<p class="muted" style="padding:30px 0">No compounds match ${hasFilters || params.q ? "these criteria" : "yet — type a query or pick a filter"}.</p>`}
      </div>
    </div>
  </section>`;
}

function searchResultRow(result: SearchResult): string {
  const href = `/${result.slug}`;
  const mass = result.precursor1 ? result.precursor1.toFixed(5) : (result.nominalMass ? String(result.nominalMass) : "—");
  const snippet = result.snippet && result.snippet !== result.description
    ? `<div class="muted" style="font-weight:400;font-size:.79rem;margin-top:2px">${formatSnippet(result.snippet)}</div>`
    : "";
  return `<tr onclick="location.href='${escapeHtml(href)}'">
    <td class="name"><a href="${escapeHtml(href)}">${escapeHtml(result.title)}</a>${snippet}</td>
    <td class="mono fo">${formatFormula(result.formula)}</td>
    <td class="mono">${mass}</td>
    <td>${levelBadge(result.level)}</td>
  </tr>`;
}

function facetGroup(label: string, type: (typeof FACET_TYPES)[number], facets: SearchFacet[], params: SearchParams): string {
  if (!facets.length) return "";
  const chips = facets.map((facet) => {
    const active = params[type].includes(facet.value);
    return `<a class="fchip" aria-pressed="${active}" href="${escapeHtml(toggleUrl(params, type, facet.value))}">${escapeHtml(facet.value)}<span class="n">${facet.count}</span></a>`;
  }).join("");
  return `<div class="fgroup"><div class="flabel">${escapeHtml(label)}</div><div class="fchips">${chips}</div></div>`;
}

function activeFilterChips(params: SearchParams): string {
  const chips: string[] = [];
  if (params.term) {
    chips.push(`<a class="af" href="${escapeHtml(searchUrl(params, (sp) => sp.delete("term")))}">${escapeHtml(params.term)} &times;</a>`);
  }
  for (const type of FACET_TYPES) {
    for (const value of params[type]) {
      chips.push(`<a class="af" href="${escapeHtml(toggleUrl(params, type, value))}">${escapeHtml(value)} &times;</a>`);
    }
  }
  if (params.mz !== null) {
    chips.push(`<a class="af" href="${escapeHtml(searchUrl(params, (sp) => { sp.delete("mz"); sp.delete("tol"); }))}">m/z ${params.mz} &plusmn; ${params.tol} &times;</a>`);
  }
  return chips.join("");
}

function sortLinks(params: SearchParams): string {
  const options: Array<[string, string]> = [
    ["", "Relevance"],
    ["mass", "Mass &uarr;"],
    ["mass-d", "Mass &darr;"],
    ["name", "Name"],
    ["level", "Level"],
  ];
  return options.map(([value, label]) => {
    const active = (params.sort || "") === value;
    const href = searchUrl(params, (sp) => { value ? sp.set("sort", value) : sp.delete("sort"); });
    return `<a href="${escapeHtml(href)}" style="text-decoration:none;padding:4px 8px;border-radius:6px;${active ? "background:var(--accent-wash);color:var(--accent-deep);font-weight:600" : "color:var(--ink-2)"}">${label}</a>`;
  }).join("");
}

function searchUrl(params: SearchParams, mutate: (sp: URLSearchParams) => void): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.term) sp.set("term", params.term);
  for (const type of FACET_TYPES) {
    for (const value of params[type]) sp.append(type, value);
  }
  if (params.mz !== null) { sp.set("mz", String(params.mz)); sp.set("tol", String(params.tol)); }
  if (params.sort) sp.set("sort", params.sort);
  mutate(sp);
  const query = sp.toString();
  return query ? `/search?${query}` : "/search";
}

function toggleUrl(params: SearchParams, type: (typeof FACET_TYPES)[number], value: string): string {
  return searchUrl(params, (sp) => {
    const current = sp.getAll(type);
    sp.delete(type);
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    for (const entry of next) sp.append(type, entry);
  });
}

function hiddenParams(params: SearchParams, exclude: string[]): string {
  const inputs: string[] = [];
  if (!exclude.includes("q") && params.q) inputs.push(hidden("q", params.q));
  if (!exclude.includes("term") && params.term) inputs.push(hidden("term", params.term));
  for (const type of FACET_TYPES) {
    if (exclude.includes(type)) continue;
    for (const value of params[type]) inputs.push(hidden(type, value));
  }
  if (!exclude.includes("mz") && params.mz !== null) {
    inputs.push(hidden("mz", String(params.mz)));
    inputs.push(hidden("tol", String(params.tol)));
  }
  if (!exclude.includes("sort") && params.sort) inputs.push(hidden("sort", params.sort));
  return inputs.join("");
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
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
    <div class="eyebrow">Fragment-ion calculator</div>
    <h1 style="font-size:2rem;margin:0 0 8px">FRIOC</h1>
    <p class="lead">Assemble a polyamine from a head group, backbone selectors, and a tail — venoMS returns
      the generic name, molecular formula, mass, precursor ions, HDX, and the full a/b/c/z/y fragment series.</p>
    <form class="card" action="/calc" method="post" style="margin:22px 0 8px">
      <div class="calc-form" style="margin:0">
        ${select("head", "Head", config.heads.map((item) => item.name), input.head)}
        ${polySelects}
        ${select("tail", "Tail", config.tails.map((item) => item.name), input.tail)}
        ${spiderSelects}
      </div>
      <div style="margin-top:16px"><button type="submit">Calculate</button></div>
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

  return `<div class="rec-sec">
    <h2>Resulting characteristics</h2>
    <div class="factgrid">
      ${calcFact("Generic name", result.genericName, true)}
      ${calcFact("Molecular formula", result.chemicalFormulaHtml, true)}
      ${calcFact("Molecular mass", formatNumber(result.molecularMass))}
      ${calcFact("Charge", String(result.quaternary))}
      ${calcFact("HDX", String(result.hdx))}
      ${calcFact("[M+H]&#8314;", formatNumber(result.precursor1))}
      ${calcFact("[M+2H]&#178;&#8314;", formatNumber(result.precursor2))}
      ${calcFact("HDX [M+H]&#8314;", formatNumber(result.precursorHdx1))}
      ${calcFact("HDX [M+2H]&#178;&#8314;", formatNumber(result.precursorHdx2))}
    </div>
  </div>
  <div class="rec-sec">
    <h2>Fragment ions</h2>
    <div class="msms-scroll"><table class="msms">
      <thead><tr><th>#</th><th>a</th><th>b</th><th>c</th><th>ta</th><th>z</th><th>y</th><th>tz</th></tr></thead>
      <tbody>${fragmentRows}</tbody>
    </table></div>
  </div>
  <div class="rec-sec">
    <h2>Markdown entry</h2>
    <textarea class="markdown-output" readonly>${escapeHtml(result.markdown)}</textarea>
  </div>`;
}

function select(name: string, label: string, values: string[], selected: string): string {
  const options = values.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value || "(empty)")}</option>`).join("");
  return `<label>${escapeHtml(label)}<select name="${escapeHtml(name)}">${options}</select></label>`;
}

function calcFact(label: string, value: string, text = false): string {
  return `<div class="fact"><div class="k">${label}</div><div class="v${text ? " text" : ""}">${value}</div></div>`;
}

type NavSubclass = { slug: string; label: string; href: string; count: number };
type NavStructureSection = { title: string; base: string; total: number; subs: NavSubclass[] };
type NavFamily = { name: string; count: number; species: string[] };
type NavModel = {
  structure: NavStructureSection[];
  guides: Array<{ href: string; label: string }>;
  spider: NavFamily[];
};

const STRUCTURE_TOPS: Array<{ top: string; title: string; base: string }> = [
  { top: "alkaloids", title: "Acylpolyamines", base: "/alkaloids" },
  { top: "small-compounds", title: "Small compounds", base: "/small-compounds" },
];

// Real spider family names end in -idae; this filters out header/typo artefacts
// ("Family", "familiy") and genus-level values ("Cupiennius") from the taxonomy tree.
function isSpiderFamily(value: string): boolean {
  return /idae$/i.test(value);
}

export function buildNavModel(pages: PageIndexEntry[]): NavModel {
  const subMap = new Map<string, NavSubclass>();
  const familyMap = new Map<string, { count: number; species: Set<string> }>();

  for (const page of pages) {
    if (page.kind !== "compound") continue;
    const segs = page.slug.split("/");
    const top = segs[0];
    const subSlug = segs[1];
    if (top && subSlug) {
      const key = `${top}/${subSlug}`;
      const existing = subMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        subMap.set(key, {
          slug: subSlug,
          label: subclassLabel(page.sourcePath, subSlug),
          href: `/${top}/${subSlug}`,
          count: 1,
        });
      }
    }
    for (const family of page.family) {
      if (!isSpiderFamily(family)) continue;
      const fm = familyMap.get(family) || { count: 0, species: new Set<string>() };
      fm.count += 1;
      familyMap.set(family, fm);
    }
    // Add each species only under the family it is actually paired with in the
    // compound's spider-species table (not every family the compound appears in).
    for (const [sp, fam] of page.speciesFamily ?? []) {
      if (!isSpiderFamily(fam)) continue;
      const fm = familyMap.get(fam);
      if (fm) fm.species.add(sp);
    }
  }

  const structure: NavStructureSection[] = STRUCTURE_TOPS.map(({ top, title, base }) => {
    const subs = [...subMap.entries()]
      .filter(([key]) => key.startsWith(`${top}/`))
      .map(([, value]) => value)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { title, base, total: subs.reduce((sum, sub) => sum + sub.count, 0), subs };
  }).filter((section) => section.subs.length > 0);

  const guides = pages
    .filter((page) => page.kind === "guide" && page.slug && !page.slug.startsWith("small") && page.slug !== "alkaloids")
    .filter((page) => /structure|fragment|method|characteristic/i.test(page.slug))
    .map((page) => ({ href: `/${page.slug}`, label: page.title }));

  const spider: NavFamily[] = [...familyMap.entries()]
    .map(([name, value]) => ({
      name,
      count: value.count,
      species: [...value.species].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { structure, guides, spider };
}

function subclassLabel(sourcePath: string, fallback: string): string {
  const segs = sourcePath.split("/");
  return (segs.length >= 3 ? segs[2] : fallback) || fallback;
}

function buildSidebar(pages: PageIndexEntry[], currentPath: string): string {
  const model = buildNavModel(pages);
  const compoundCount = model.structure.reduce((sum, section) => sum + section.total, 0);
  const spiderActive = currentPath.startsWith("/search");
  return `<input type="radio" name="nav-axis" id="axis-structure" class="axis-radio"${spiderActive ? "" : " checked"}>
    <input type="radio" name="nav-axis" id="axis-spider" class="axis-radio"${spiderActive ? " checked" : ""}>
    <div class="axis-toggle" role="tablist" aria-label="Browse axis">
      <label for="axis-structure">By structure</label>
      <label for="axis-spider">By spider</label>
    </div>
    <nav class="nav" aria-label="Primary">
      <div class="nav-axis" data-axis="structure">
        <div class="axis-note">Chemical classification &middot; ${compoundCount} compounds</div>
        ${model.structure.map((section) => structureGroup(section, currentPath)).join("")}
        ${model.guides.length ? navGroup("Analytical tools", model.guides.length, model.guides.map((guide) =>
          navChild(guide.href, guide.label, "", currentPath)).join(""), currentPath.startsWith("/structure") || currentPath.startsWith("/contact")) : ""}
      </div>
      <div class="nav-axis" data-axis="spider">
        <div class="axis-note">Spider taxonomy &middot; ${model.spider.length} families</div>
        ${model.spider.map((family) => spiderGroup(family)).join("")}
      </div>
    </nav>`;
}

function structureGroup(section: NavStructureSection, currentPath: string): string {
  const open = currentPath === section.base || currentPath.startsWith(`${section.base}/`) || section.base === "/alkaloids" && currentPath === "/";
  const kids = section.subs.map((sub) => navChild(sub.href, sub.label, String(sub.count), currentPath)).join("");
  return navGroup(section.title, section.total, kids, open);
}

function spiderGroup(family: NavFamily): string {
  const shown = family.species.slice(0, 14);
  const rest = family.species.length - shown.length;
  const familyLink = `<a href="/search?family=${encodeURIComponent(family.name)}"><strong>All ${escapeHtml(family.name)}</strong></a>`;
  const speciesLinks = shown.map((sp) =>
    `<a class="species" href="/search?species=${encodeURIComponent(sp)}">${escapeHtml(sp)}</a>`).join("");
  const more = rest > 0 ? `<a href="/search?family=${encodeURIComponent(family.name)}" style="color:var(--ink-3)">+ ${rest} more species…</a>` : "";
  return `<details class="nav-group" data-species>
    <summary><em>${escapeHtml(family.name)}</em><span class="n">${family.count}</span></summary>
    <div class="nav-kids">${familyLink}${speciesLinks}${more}</div>
  </details>`;
}

function navGroup(title: string, count: number, kids: string, open: boolean): string {
  return `<details class="nav-group"${open ? " open" : ""}>
    <summary>${escapeHtml(title)}<span class="n">${count}</span></summary>
    <div class="nav-kids">${kids}</div>
  </details>`;
}

function navChild(href: string, label: string, count: string, currentPath: string): string {
  const active = currentPath === href || currentPath.startsWith(`${href}/`);
  return `<a class="${active ? "is-active" : ""}" href="${escapeHtml(href)}">${escapeHtml(label)}${count ? `<span class="n">${escapeHtml(count)}</span>` : ""}</a>`;
}

function formatSnippet(value: string): string {
  return escapeHtml(value)
    .replaceAll("&lt;mark&gt;", "<mark>")
    .replaceAll("&lt;/mark&gt;", "</mark>");
}

function formatNumber(value: number): string {
  return value === -1 ? "-" : value.toFixed(5);
}

export function sitemapXml(pages: PageIndexEntry[], origin: string): string {
  const paths = ["", "alkaloids", "small-compounds", "structure-elucidation", "calc", "search"];
  const slugs = pages.filter((page) => page.slug).map((page) => page.slug);
  const all = [...new Set([...paths, ...slugs])];
  const urls = all
    .map((path) => `  <url><loc>${escapeXml(`${origin}/${path}`)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function llmsTxt(pages: PageIndexEntry[], origin: string): string {
  const compounds = pages.filter((page) => page.kind === "compound");
  const lines = compounds.map((page) => {
    const meta = [page.formula, page.precursor1 ? `[M+H]+ ${page.precursor1.toFixed(4)}` : "", ...page.family.slice(0, 1)]
      .filter(Boolean).join(", ");
    return `- [${page.title}](${origin}/${page.slug})${meta ? `: ${meta}` : ""}`;
  }).join("\n");
  return `# venoMS

> A free database of low-molecular-mass compounds (< 1000 Da) found in spider venoms. Provides ESI-MS/MS spectra, fragment-ion annotation, and literature on the structure elucidation, synthesis, and biological activity of venom metabolites. Spider taxonomy follows the World Spider Catalog.

## Browse
- [Acylpolyamines](${origin}/alkaloids): alkaloidal toxins by acyl head group and polyamine backbone
- [Small compounds](${origin}/small-compounds): amino acids, biogenic amines, nucleosides, quaternary amines, organic acids
- [Analytical tools](${origin}/structure-elucidation): fragmentation rules, characteristic fragment ions, method

## Tools
- [Search](${origin}/search): full-text, faceted (family/level/confidence), and precursor-mass lookup
- [FRIOC calculator](${origin}/calc): fragment-ion calculator for acylpolyamines

## Compounds
${lines}
`;
}

export function websiteJsonLd(origin: string): string {
  return jsonLdScript({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "venoMS",
    description: "Database of low-molecular-mass spider venom metabolites.",
    url: `${origin}/`,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/search?q={query}` },
      "query-input": "required name=query",
    },
  });
}

export function compoundJsonLd(page: PageIndexEntry, facts: Record<string, string>, origin: string): string {
  const smiles = fact(facts, "smiles");
  const inchi = fact(facts, "inchi");
  const properties = [
    page.formula && { "@type": "PropertyValue", name: "Molecular formula", value: page.formula },
    page.precursor1 && { "@type": "PropertyValue", name: "[M+H]+", value: page.precursor1, unitText: "m/z" },
    page.level && { "@type": "PropertyValue", name: "Structure level", value: page.level },
    smiles && { "@type": "PropertyValue", name: "SMILES", value: smiles },
    inchi && { "@type": "PropertyValue", name: "InChI", value: inchi },
  ].filter(Boolean);
  const description = [
    `${page.title}${page.formula ? ` (${page.formula})` : ""}, a low-molecular-mass spider venom metabolite`,
    page.family.length ? ` detected in ${page.family.slice(0, 6).join(", ")}` : "",
    ". Data in the venoMS database.",
  ].join("");
  return jsonLdScript({
    "@context": "https://schema.org",
    "@type": "ChemicalSubstance",
    name: page.title,
    url: `${origin}/${page.slug}`,
    description,
    ...(page.family.length ? { keywords: page.family.join(", ") } : {}),
    isPartOf: { "@type": "Dataset", name: "venoMS", url: `${origin}/` },
    additionalProperty: properties,
  });
}

function jsonLdScript(data: unknown): string {
  // Escape "<" so the JSON can never terminate the <script> element early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function escapeXml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
