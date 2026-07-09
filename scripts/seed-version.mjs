// Versioned D1 search seed with atomic promotion.
//
// Each content hash gets its own tables (pages_<v>, page_terms_<v>, pages_fts_<v>).
// Seeding only ever CREATEs a new version — it never touches the live tables — so
// production search is never emptied. The Worker reads `meta.active_version`;
// promotion is a single atomic UPDATE of that pointer, done only for production
// builds. Previews seed their own version but never promote. Usage:
//   node scripts/seed-version.mjs                # remote, promote if prod branch / local-manual
//   node scripts/seed-version.mjs --local        # local dev D1
//   node scripts/seed-version.mjs --promote      # force promotion
//   node scripts/seed-version.mjs --no-promote   # force preview behaviour

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB = process.env.D1_NAME || "venoms-search";
const PROD_BRANCH = process.env.PROD_BRANCH || "master";
const KEEP_RECENT = 3; // versions kept besides the active one (for rollback / in-flight previews)

const scope = process.argv.includes("--local") ? "--local" : "--remote";
const version = readFileSync(path.join(root, ".generated", "search-version.txt"), "utf8").trim();
const seedFile = path.join(root, ".generated", "search-seed.sql");
const now = new Date().toISOString();

const P = `pages_${version}`;
const Tt = `page_terms_${version}`;
const F = `pages_fts_${version}`;

function wrangler(args, capture = false) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
}

function query(sql) {
  const out = wrangler(["d1", "execute", DB, scope, "--json", "--command", sql], true);
  try {
    return JSON.parse(out)?.[0]?.results ?? [];
  } catch {
    return [];
  }
}

function shouldPromote() {
  if (process.argv.includes("--no-promote")) return false;
  if (process.argv.includes("--promote") || process.env.PROMOTE === "1") return true;
  const ciBranch = process.env.WORKERS_CI_BRANCH; // set by Cloudflare Workers Builds
  if (ciBranch !== undefined) return ciBranch === PROD_BRANCH; // CI: only the production branch promotes
  return true; // local / manual deploy is always a production promote
}

query("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");

// Seed this version's tables only if they don't already exist and populated.
const existing = query(`SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='${P}'`)[0]?.c ?? 0;
const populated = existing ? (query(`SELECT count(*) AS c FROM ${P}`)[0]?.c ?? 0) : 0;

if (populated > 0) {
  console.log(`Version ${version} already present (${populated} pages) — skipping seed.`);
} else {
  console.log(`Seeding search version ${version}...`);
  wrangler(["d1", "execute", DB, scope, "--file", seedFile]);
  query(`INSERT OR REPLACE INTO meta (key, value) VALUES ('created:${version}', '${now}')`);
  console.log(`Version ${version} seeded.`);
}

if (shouldPromote()) {
  query(`INSERT OR REPLACE INTO meta (key, value) VALUES ('active_version', '${version}')`);
  console.log(`Promoted ${version} to active.`);
  garbageCollect();
} else {
  console.log(`Preview build — left active_version untouched (production keeps its version).`);
}

function garbageCollect() {
  const active = query("SELECT value FROM meta WHERE key = 'active_version'")[0]?.value;
  const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'pages\\_%' ESCAPE '\\'")
    .map((row) => row.name.slice("pages_".length))
    .filter((v) => /^[0-9a-f]{6,64}$/.test(v));
  const created = new Map(
    query("SELECT key, value FROM meta WHERE key LIKE 'created:%'").map((row) => [row.key.slice("created:".length), row.value]),
  );
  const keep = new Set([active]);
  tables
    .filter((v) => v !== active)
    .sort((a, b) => String(created.get(b) || "").localeCompare(String(created.get(a) || "")))
    .slice(0, KEEP_RECENT)
    .forEach((v) => keep.add(v));

  const drop = tables.filter((v) => !keep.has(v));
  for (const v of drop) {
    query(`DROP TABLE IF EXISTS pages_${v}; DROP TABLE IF EXISTS page_terms_${v}; DROP TABLE IF EXISTS pages_fts_${v}; DELETE FROM meta WHERE key = 'created:${v}';`);
  }
  console.log(drop.length ? `GC: dropped ${drop.length} stale version(s): ${drop.join(", ")}` : "GC: nothing to drop.");
}
