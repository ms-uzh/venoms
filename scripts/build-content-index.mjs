import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findMarkdownFiles, readMarkdownPage } from "./lib/content.mjs";
import { stripUriToSlug } from "./lib/slugs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const outputDir = path.join(root, "public", "data");
const generatedDir = path.join(root, ".generated");
const outputFile = path.join(outputDir, "content-index.json");
const generatedFile = path.join(generatedDir, "content-index.json");

const oldSlugByTitle = loadOldSlugByTitle();
const files = await findMarkdownFiles(contentDir);
const pages = [];

for (const file of files) {
  pages.push(await readMarkdownPage(root, file, oldSlugByTitle));
}

const duplicates = findDuplicates(pages.map((page) => page.slug));
if (duplicates.length > 0) {
  throw new Error(`Duplicate slugs: ${duplicates.join(", ")}`);
}

const payload = {
  generatedAt: new Date().toISOString(),
  pages,
};

await mkdir(outputDir, { recursive: true });
await mkdir(generatedDir, { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(generatedFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Indexed ${pages.length} Markdown pages into ${path.relative(root, outputFile)}`);

function loadOldSlugByTitle() {
  try {
    const raw = execFileSync("git", ["show", "origin/gh-pages:index.json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const rows = JSON.parse(raw);
    const grouped = new Map();
    for (const row of rows) {
      const title = String(row.title || "").trim();
      const slug = stripUriToSlug(row.uri || "");
      if (!title || !slug) {
        continue;
      }
      grouped.set(title, [...(grouped.get(title) || []), slug]);
    }
    const unique = new Map();
    for (const [title, slugs] of grouped) {
      if (slugs.length === 1) {
        unique.set(title, slugs[0]);
      }
    }
    return unique;
  } catch {
    return new Map();
  }
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}
