import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputDir = path.join(root, "data", "calc");
const output = path.join(inputDir, "config.json");
const publicOutput = path.join(root, "public", "data", "calc", "config.json");

const [heads, polyamines, tails, spiders, app] = await Promise.all([
  readYaml("head.yaml"),
  readYaml("polyamine.yaml"),
  readYaml("tail.yaml"),
  readYaml("spider.yaml"),
  readYaml("app.yaml"),
]);

const payload = {
  heads: normalizeUnits(heads),
  polyamines: normalizeUnits(polyamines),
  tails: normalizeUnits(tails),
  spiders: spiders.map((spider) => ({
    species: String(spider.Species || ""),
    family: String(spider.Family || ""),
  })),
  app: {
    maxPolyamineSelectors: Number(app.MaxPolyamineSelectors || 10),
  },
};

await mkdir(path.dirname(output), { recursive: true });
await mkdir(path.dirname(publicOutput), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(publicOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Generated calculator data with ${payload.heads.length} heads, ${payload.polyamines.length} polyamines, ${payload.tails.length} tails`);

async function readYaml(name) {
  return YAML.parse(await readFile(path.join(inputDir, name), "utf8"));
}

function normalizeUnits(units) {
  return units.map((unit) => ({
    name: String(unit.Name ?? ""),
    formula: Array.isArray(unit.Formula) ? unit.Formula.map(String) : [],
    mass: Number(unit.Mass || 0),
    hdx: Number(unit.HDX || 0),
    quaternary: Number(unit.Quaternary || 0),
    sub: unit.Sub ? {
      name: String(unit.Sub.Name || ""),
      mass: Number(unit.Sub.Mass || 0),
    } : { name: "", mass: 0 },
  }));
}
