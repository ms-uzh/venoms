import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTermKey } from "./lib/terms.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentIndexPath = path.join(root, "public", "data", "content-index.json");
const legacyTaxonomyPath = path.join(root, "data", "legacy-taxonomy.json");
const outputFile = path.join(root, "public", "data", "redirects.json");
const generatedFile = path.join(root, ".generated", "redirects.json");

const { pages } = JSON.parse(await readFile(contentIndexPath, "utf8"));
const { routes: legacyTaxonomyRoutes } = JSON.parse(await readFile(legacyTaxonomyPath, "utf8"));
const termsByType = {
  categories: new Set(pages.flatMap((page) => page.categories).map(normalizeTermKey)),
  tags: new Set(pages.flatMap((page) => page.tags).map(normalizeTermKey)),
};
const redirects = {};

for (const page of pages) {
  if (page.fallbackSlug && page.fallbackSlug !== page.slug) {
    redirects[`/${page.fallbackSlug}`] = `/${page.slug}`;
  }
}

for (const [oldPath, term] of Object.entries(legacyTaxonomyRoutes)) {
  const type = oldPath.split("/")[1];
  if (!termsByType[type]?.has(normalizeTermKey(term))) {
    throw new Error(`Legacy taxonomy redirect ${oldPath} has no current ${type} term for ${term}`);
  }
  redirects[oldPath] = `/search?term=${encodeURIComponent(term)}`;
}

redirects["/calc/"] = "/calc";

await mkdir(path.dirname(outputFile), { recursive: true });
await mkdir(path.dirname(generatedFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), redirects }, null, 2)}\n`, "utf8");
await writeFile(generatedFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), redirects }, null, 2)}\n`, "utf8");

console.log(`Generated ${Object.keys(redirects).length} redirects`);
