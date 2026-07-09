import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import { fallbackSlugFromSourcePath } from "./slugs.mjs";

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
    level,
    confidence,
  };
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
    } else if (key === "spider species" && cells[1] && cells[1].toLowerCase() !== "family") {
      facts.species.push(cells[0]);
      if (cells[1]) {
        facts.family.push(cells[1]);
      }
    }
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
