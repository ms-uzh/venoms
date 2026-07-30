import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import { fallbackSlugFromSourcePath } from "./slugs.mjs";

/**
 * Read the full content index written by scripts/build-content-index.mjs.
 *
 * Build steps must use this rather than public/data/content-index.json: the public
 * copy is the slimmed runtime payload and omits build-only fields (bodyText,
 * fallbackSlug). `prepare:assets` runs content:index first, so the file exists.
 */
export async function readFullContentIndex(root) {
  const fullIndexPath = path.join(root, ".generated", "content-index.json");
  try {
    return JSON.parse(await readFile(fullIndexPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot read ${path.relative(root, fullIndexPath)} (${error.message}). Run "npm run content:index" first.`,
    );
  }
}

export async function findMarkdownFiles(contentDir) {
  const entries = await readdir(contentDir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const fullPath = path.join(contentDir, entry.name);
    if (entry.isDirectory()) {
      result.push(...await findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "_header.md" && entry.name !== "_footer.md") {
      result.push(fullPath);
    }
  }
  return result.sort();
}

export async function readMarkdownPage(root, filePath, oldSlugByTitle) {
  const raw = await readFile(filePath, "utf8");
  const parsed = parseMarkdownDocument(raw);
  const sourcePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  const title = String(parsed.frontmatter.title || titleFromSourcePath(sourcePath));
  const fallbackSlug = fallbackSlugFromSourcePath(sourcePath);
  const oldSlug = oldSlugByTitle.get(title);
  const slug = oldSlug || fallbackSlug;
  const categories = asStrings(parsed.frontmatter.categories);
  const tags = asStrings(parsed.frontmatter.tags);
  const bodyText = markdownToPlainText(parsed.body);
  const tableFacts = extractTableFacts(parsed.body);
  const family = unique([
    ...categories.filter((term) => /idae$/i.test(term)),
    ...tableFacts.family,
  ]);
  const species = unique([
    ...tags.filter((term) => !/^S-\d/i.test(term) && !/^C-\d/i.test(term)),
    ...tableFacts.species,
  ]);
  const level = tags.find((term) => /^S-\d/i.test(term)) || tableFacts.level || "";
  const confidence = tags.find((term) => /^C-\d/i.test(term)) || tableFacts.confidence || "";
  const formula = tableFacts.formula || categories.find((term) => /^C\d/i.test(term)) || "";
  const nominalMass = Number((categories.find((term) => /^P\d+(\.\d+)?$/i.test(term)) || "").slice(1)) || null;
  const speciesFamily = extractSpeciesFamily(parsed.body);

  return {
    slug,
    fallbackSlug,
    sourcePath,
    title,
    kind: inferKind(sourcePath, categories, tags),
    description: firstSentence(bodyText),
    categories,
    tags,
    bodyText,
    formula,
    nominalMass,
    precursor1: tableFacts.precursor1,
    family,
    species,
    speciesFamily,
    level,
    confidence,
  };
}

// Parse the "## Spider species" table into [species, family] pairs. The two flat
// `family` / `species` lists lose the pairing (a compound found in several venoms
// mixes families and species), so the taxonomy tree needs the row-level pairs.
function extractSpeciesFamily(markdown) {
  const pairs = [];
  let inTable = false;
  for (const line of markdown.split("\n")) {
    if (!line.includes("|")) { inTable = false; continue; }
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    if (cells.length < 2) continue;
    const head0 = cells[0].toLowerCase();
    if (head0 === "spider species" && cells[1].toLowerCase() === "family") { inTable = true; continue; }
    if (!inTable) continue;
    if (/^:?-+:?$/.test(cells[0])) continue; // separator row
    const species = cells[0];
    const family = cells[1];
    if (species && family) pairs.push([species, family]);
  }
  return pairs;
}

export function parseMarkdownDocument(raw) {
  if (!raw.startsWith("+++")) {
    return { frontmatter: {}, body: raw };
  }

  const end = raw.indexOf("\n+++", 3);
  if (end === -1) {
    return { frontmatter: {}, body: raw };
  }

  const toml = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  return { frontmatter: parseToml(toml), body };
}

export function markdownToPlainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|:-]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function asStrings(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean);
}

function extractTableFacts(markdown) {
  const facts = {
    formula: "",
    level: "",
    confidence: "",
    precursor1: null,
    family: [],
    species: [],
  };
  const lines = markdown.split("\n");

  for (const line of lines) {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    if (cells.length < 2) {
      continue;
    }

    const key = cells[0].toLowerCase();
    const value = cells[1].trim();

    if (key === "level") {
      const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
      facts.level = parts.find((part) => /^S-\d/i.test(part)) || facts.level;
      facts.confidence = parts.find((part) => /^C-\d/i.test(part)) || facts.confidence;
    } else if (key === "molecular formula") {
      facts.formula = value.replaceAll("₀", "0").replaceAll("₁", "1").replaceAll("₂", "2").replaceAll("₃", "3").replaceAll("₄", "4").replaceAll("₅", "5").replaceAll("₆", "6").replaceAll("₇", "7").replaceAll("₈", "8").replaceAll("₉", "9");
    } else if (key.startsWith("precursor 1")) {
      facts.precursor1 = Number(value) || null;
    }
    // Species/family pairs come from extractSpeciesFamily (row-level), not here —
    // the old "spider species" branch only ever leaked mis-typed header cells.
  }

  return {
    ...facts,
    family: unique(facts.family),
    species: unique(facts.species),
  };
}

function inferKind(sourcePath, categories, tags) {
  if (sourcePath.includes("/Alkaloids/") || sourcePath.includes("/Small Compounds/")) {
    return "compound";
  }
  if (tags.some((tag) => /^S-\d/i.test(tag)) || categories.some((category) => /^C\d/i.test(category))) {
    return "compound";
  }
  return "guide";
}

function firstSentence(text) {
  const compact = text.slice(0, 280);
  const match = compact.match(/^(.{80,220}?[.!?])\s/);
  return (match ? match[1] : compact).trim();
}

function titleFromSourcePath(sourcePath) {
  return path.basename(sourcePath, ".md").replaceAll("-", " ");
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
