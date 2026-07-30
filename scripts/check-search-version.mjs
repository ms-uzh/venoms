// Verify the deployed search index matches the built content.
//
// Promotion is deliberately decoupled from seeding: `deploy:build` seeds an inactive
// version and only `npm run deploy:production` flips `meta.active_version`. If the
// Workers Builds production deploy command is left at the default `npx wrangler deploy`,
// the pointer never advances and search silently serves stale results forever — pages
// keep rendering correctly because they come from static assets, not D1. This check
// turns that silent drift into a loud failure. Usage:
//   node scripts/check-search-version.mjs           # remote (production)
//   node scripts/check-search-version.mjs --local   # local dev D1

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB = process.env.D1_NAME || "venoms-search";
const scope = process.argv.includes("--local") ? "--local" : "--remote";
const versionFile = path.join(root, ".generated", "search-version.txt");

let expected;
try {
  expected = readFileSync(versionFile, "utf8").trim();
} catch (error) {
  console.error(`Cannot read ${path.relative(root, versionFile)} (${error.message}). Run "npm run search:index" first.`);
  process.exit(1);
}

const out = execFileSync("npx", ["wrangler", "d1", "execute", DB, scope, "--json", "--command", "SELECT value FROM meta WHERE key = 'active_version'"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

let active = "";
try {
  active = JSON.parse(out)?.[0]?.results?.[0]?.value ?? "";
} catch {
  active = "";
}

if (active === expected) {
  console.log(`Search index is current: ${expected} (${scope.replace("--", "")}).`);
  process.exit(0);
}

console.error(`Search index is stale.
  built content version : ${expected}
  active in D1          : ${active || "(none)"}

The Worker is serving search results from an older content version. Most likely the
production deploy command is not "npm run deploy:production" (which promotes the seeded
version after a successful Worker upload) — check the Workers Builds project settings.
To promote the built version now: npm run seed:version -- --promote-only`);
process.exit(1);
