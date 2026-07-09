import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentIndexPath = path.join(root, "public", "data", "content-index.json");
const outputFile = path.join(root, "public", "data", "redirects.json");
const generatedFile = path.join(root, ".generated", "redirects.json");

const { pages } = JSON.parse(await readFile(contentIndexPath, "utf8"));
const slugs = new Set(pages.map((page) => page.slug));
const redirects = {};

for (const page of pages) {
  if (page.fallbackSlug && page.fallbackSlug !== page.slug) {
    redirects[`/${page.fallbackSlug}`] = `/${page.slug}`;
  }
}

for (const oldPath of listOldHtmlPaths()) {
  const clean = oldPath.replace(/\/index\.html$/, "").replace(/\/page\/\d+$/, "");
  if (!clean || slugs.has(clean)) {
    continue;
  }
  if (clean.startsWith("categories/")) {
    redirects[`/${clean}`] = `/search?term=${encodeURIComponent(clean.split("/").at(-1) || "")}`;
  } else if (clean.startsWith("tags/")) {
    redirects[`/${clean}`] = `/search?term=${encodeURIComponent(clean.split("/").at(-1) || "")}`;
  }
}

redirects["/calc/"] = "/calc";

await mkdir(path.dirname(outputFile), { recursive: true });
await mkdir(path.dirname(generatedFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), redirects }, null, 2)}\n`, "utf8");
await writeFile(generatedFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), redirects }, null, 2)}\n`, "utf8");

console.log(`Generated ${Object.keys(redirects).length} redirects`);

function listOldHtmlPaths() {
  try {
    return execFileSync("git", ["ls-tree", "-r", "--name-only", "origin/gh-pages"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .filter((line) => line.endsWith("/index.html"));
  } catch {
    return [];
  }
}
