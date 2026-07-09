import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findMarkdownFiles, readMarkdownPage } from "./lib/content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const publicDir = path.join(root, "public");
const publicContentDir = path.join(publicDir, "content");
const indexPath = path.join(publicDir, "data", "content-index.json");
const knownMissingAssetsPath = path.join(root, "data", "validation", "legacy-missing-assets.json");
const assetCountLimit = 100_000;
const assetSizeLimit = 25 * 1024 * 1024;
const errors = [];
const warnings = [];

const markdownFiles = await findMarkdownFiles(contentDir);
const parsedPages = [];

for (const file of markdownFiles) {
  try {
    parsedPages.push(await readMarkdownPage(root, file, new Map()));
  } catch (error) {
    errors.push(`Markdown parse failed for ${path.relative(root, file)}: ${error.message}`);
  }
}

await validateIndex(parsedPages);
await validateContentSync();
await validateAssetReferences(markdownFiles);
await validateAssetLimits();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(warnings.map((warning) => `- ${warning}`).join("\n"));
}
console.log(`Validated ${markdownFiles.length} Markdown pages and Workers asset limits.`);

async function validateIndex(parsed) {
  let index;
  try {
    index = JSON.parse(await readFile(indexPath, "utf8"));
  } catch (error) {
    errors.push(`Missing or invalid ${path.relative(root, indexPath)}: ${error.message}`);
    return;
  }

  if (index.pages.length !== parsed.length) {
    errors.push(`Content index has ${index.pages.length} pages but parsed ${parsed.length} Markdown pages.`);
  }

  const duplicates = findDuplicates(index.pages.map((page) => page.slug));
  for (const duplicate of duplicates) {
    errors.push(`Duplicate slug in generated index: ${duplicate || "(root)"}`);
  }
}

async function validateContentSync() {
  const sourceFiles = await listFiles(contentDir);
  const syncedFiles = await listFiles(publicContentDir);
  const sourceSet = new Set(sourceFiles);
  const syncedSet = new Set(syncedFiles);

  for (const relative of sourceFiles) {
    if (!syncedSet.has(relative)) {
      errors.push(`Missing synced content file: public/content/${relative}`);
      continue;
    }
    const [source, synced] = await Promise.all([
      readFile(path.join(contentDir, relative)),
      readFile(path.join(publicContentDir, relative)),
    ]);
    if (!source.equals(synced)) {
      errors.push(`Synced content differs: ${relative}`);
    }
  }

  for (const relative of syncedFiles) {
    if (!sourceSet.has(relative)) {
      errors.push(`Unexpected synced content file: public/content/${relative}`);
    }
  }
}

async function validateAssetReferences(files) {
  const missing = new Map();

  for (const file of files) {
    const raw = await readFile(file, "utf8");
    for (const reference of extractAssetReferences(raw)) {
      if (!await publicAssetExists(reference)) {
        const list = missing.get(reference) || [];
        list.push(path.relative(root, file));
        missing.set(reference, list);
      }
    }
  }

  if (process.env.UPDATE_ASSET_ALLOWLIST === "1") {
    await writeKnownMissingAssets(missing);
    warnings.push(`Updated ${path.relative(root, knownMissingAssetsPath)} with ${missing.size} legacy missing asset references.`);
    return;
  }

  const knownMissing = await readKnownMissingAssets();
  const knownMissingRefs = new Set(knownMissing.map((entry) => entry.reference));

  for (const [reference, filesWithReference] of missing) {
    if (knownMissingRefs.has(reference)) {
      continue;
    }
    errors.push(`Missing asset ${reference} referenced by ${filesWithReference.slice(0, 5).join(", ")}`);
  }

  for (const reference of knownMissingRefs) {
    if (!missing.has(reference)) {
      errors.push(`Stale legacy missing asset allowlist entry: ${reference}`);
    }
  }

  if (missing.size > 0) {
    warnings.push(`${missing.size} legacy missing asset references are explicitly tracked in ${path.relative(root, knownMissingAssetsPath)}.`);
  }
}

async function readKnownMissingAssets() {
  try {
    const payload = JSON.parse(await readFile(knownMissingAssetsPath, "utf8"));
    return Array.isArray(payload.assets) ? payload.assets : [];
  } catch {
    return [];
  }
}

async function writeKnownMissingAssets(missing) {
  const assets = [...missing.entries()]
    .map(([reference, files]) => ({
      reference,
      files: files.sort(),
    }))
    .sort((left, right) => left.reference.localeCompare(right.reference));
  const payload = {
    note: "Legacy content references that were already missing when the Workers migration validator was introduced. New missing assets fail validation.",
    assets,
  };
  await mkdir(path.dirname(knownMissingAssetsPath), { recursive: true });
  await writeFile(knownMissingAssetsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function validateAssetLimits() {
  const files = await listFiles(publicDir);
  if (files.length > assetCountLimit) {
    errors.push(`Workers Static Assets count ${files.length} exceeds ${assetCountLimit}.`);
  }

  for (const relative of files) {
    const stats = await stat(path.join(publicDir, relative));
    if (stats.size > assetSizeLimit) {
      errors.push(`Workers Static Assets file exceeds 25 MiB: ${relative} (${stats.size} bytes)`);
    }
  }
}

function extractAssetReferences(markdown) {
  const references = new Set();

  let searchFrom = 0;
  while (searchFrom < markdown.length) {
    const start = markdown.indexOf("](", searchFrom);
    if (start === -1) {
      break;
    }
    const destination = readMarkdownDestination(markdown, start + 2);
    if (!destination) {
      searchFrom = start + 2;
      continue;
    }
    if (isLocalAsset(destination.value)) {
      references.add(destination.value);
    }
    searchFrom = destination.end + 1;
  }

  const htmlAttributePattern = /\b(?:src|href)=["'](\/(?:img|img_MSMS|img_Rules|pdf|csv)\/[^"']+)["']/g;
  for (const match of markdown.matchAll(htmlAttributePattern)) {
    references.add(match[1]);
  }

  return references;
}

function readMarkdownDestination(markdown, start) {
  let depth = 0;
  for (let index = start; index < markdown.length; index++) {
    const char = markdown[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      if (depth === 0) {
        return {
          value: markdown.slice(start, index).trim(),
          end: index,
        };
      }
      depth -= 1;
    } else if (char === "\n") {
      return null;
    }
  }
  return null;
}

function isLocalAsset(value) {
  return /^\/(?:img|img_MSMS|img_Rules|pdf|csv)\//.test(value);
}

async function publicAssetExists(reference) {
  const withoutQuery = reference.split(/[?#]/)[0].replace(/^\/+/, "");
  const candidates = [withoutQuery];
  try {
    candidates.push(decodeURIComponent(withoutQuery));
  } catch {
    // Keep the raw candidate when a filename contains a literal percent sign.
  }

  for (const candidate of candidates) {
    let current = candidate;
    while (current.length > 0) {
      if (await existsInsidePublic(current)) {
        return true;
      }
      const trimmed = current.replace(/[)]+$/g, "");
      if (trimmed === current) {
        break;
      }
      current = trimmed;
    }
  }
  return false;
}

async function existsInsidePublic(relative) {
  const fullPath = path.resolve(publicDir, relative);
  if (!fullPath.startsWith(`${publicDir}${path.sep}`)) {
    return false;
  }
  try {
    await access(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(fullPath);
      files.push(...nested.map((relative) => path.join(entry.name, relative)));
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files.sort().map((file) => file.replaceAll(path.sep, "/"));
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
