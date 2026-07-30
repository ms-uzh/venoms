import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "content");
const destination = path.join(root, "public", "content");

await syncDirectory(source, destination);

console.log(`Synced ${path.relative(root, source)} to ${path.relative(root, destination)}`);

async function syncDirectory(sourceDir, destinationDir) {
  await mkdir(destinationDir, { recursive: true });

  const sourceEntries = await readdir(sourceDir, { withFileTypes: true });
  const destinationEntries = await safeReadDir(destinationDir);
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name).filter((name) => name !== ".DS_Store"));

  for (const entry of sourceEntries) {
    if (entry.name === ".DS_Store") {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      await syncDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await cp(sourcePath, destinationPath);
    }
  }

  for (const entry of destinationEntries) {
    if (entry.name === ".DS_Store" || sourceNames.has(entry.name)) {
      continue;
    }
    await rm(path.join(destinationDir, entry.name), { recursive: true, force: true });
  }
}

async function safeReadDir(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}
