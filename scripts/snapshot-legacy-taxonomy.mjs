import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTermKey } from "./lib/terms.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ref = process.env.LEGACY_SITE_REF || "origin/gh-pages";
const contentIndexPath = path.join(root, "public", "data", "content-index.json");
const outputFile = path.join(root, "data", "legacy-taxonomy.json");

const { pages } = JSON.parse(await readFile(contentIndexPath, "utf8"));
const termsByType = {
  categories: new Set(pages.flatMap((page) => page.categories).map(normalizeTermKey)),
  tags: new Set(pages.flatMap((page) => page.tags).map(normalizeTermKey)),
};

const files = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", ref], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter((file) => /^(?:categories|tags)\/.+\/index\.html$/.test(file));

const rootTitles = new Map();
const routes = {};

for (const file of files) {
  const route = `/${file.replace(/\/index\.html$/, "")}`;
  const rootRoute = route.replace(/\/page\/\d+$/, "");
  if (rootRoute === "/categories" || rootRoute === "/tags") {
    continue;
  }
  let title = rootTitles.get(rootRoute);

  if (!title) {
    const htmlPath = `${rootRoute.slice(1)}/index.html`;
    const html = execFileSync("git", ["show", `${ref}:${htmlPath}`], {
      cwd: root,
      encoding: "utf8",
    });
    const match = [...html.matchAll(/<title>([^<]*?) :: venoMS<\/title>/gi)].at(-1);
    if (!match) {
      throw new Error(`Missing taxonomy title in ${ref}:${htmlPath}`);
    }
    title = decodeHtml(match[1]).trim();
    rootTitles.set(rootRoute, title);
  }

  const type = rootRoute.split("/")[1];
  if (!termsByType[type]?.has(normalizeTermKey(title))) {
    throw new Error(`Legacy taxonomy ${rootRoute} (${title}) has no current ${type} term`);
  }
  routes[route] = title;
}

const sourceCommit = execFileSync("git", ["rev-parse", ref], { cwd: root, encoding: "utf8" }).trim();
const payload = {
  sourceRef: ref,
  sourceCommit,
  routes: Object.fromEntries(Object.entries(routes).sort(([left], [right]) => left.localeCompare(right))),
};

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Snapshotted ${Object.keys(routes).length} legacy taxonomy routes from ${ref}`);

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replace(/&#39;|&apos;/g, "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
