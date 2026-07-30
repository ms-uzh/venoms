import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFullContentIndex } from "./lib/content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = path.join(root, "public", "data", "suggest.json");

const { pages } = await readFullContentIndex(root);

// Lightweight type-ahead index: only the fields the omnibox matches/renders,
// with short keys to keep the payload small (loaded once, client-side).
const entries = pages
  .filter((page) => page.kind === "compound" && page.slug)
  .map((page) => ({
    s: page.slug,
    t: page.title,
    f: page.formula || "",
    m: page.precursor1 ?? page.nominalMass ?? null,
    g: page.family[0] || "",
  }));

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(entries), "utf8");

console.log(`Generated suggest index for ${entries.length} compounds at ${path.relative(root, outputFile)}`);
