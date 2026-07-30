import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function deployProduction(run = execFileSync) {
  const options = { cwd: root, stdio: "inherit" };
  run("npx", ["wrangler", "deploy"], options);
  run(process.execPath, ["scripts/seed-version.mjs", "--promote-only"], options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  deployProduction();
}
