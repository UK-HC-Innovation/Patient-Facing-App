#!/usr/bin/env node
/**
 * Thin wrapper over the two Python extractors that build src/data/food-compass/*.json.
 *
 * Usage:
 *   node scripts/data/build-food-compass-assets.mjs "<source dir>"
 *
 * The source dir must contain "Food Compass 2.0 Supplement.pdf" and
 * "Copy of compass test 9.26.22.xlsx". Sources are read-only and never committed.
 * Requires Python with pypdf + openpyxl (no npm dependency is added for this).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error("usage: node scripts/data/build-food-compass-assets.mjs \"<source dir>\"");
  process.exit(2);
}

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const steps = [
  ["extract_fcs2.py", path.join(sourceDir, "Food Compass 2.0 Supplement.pdf")],
  ["extract_fndds.py", path.join(sourceDir, "Copy of compass test 9.26.22.xlsx")],
];

for (const [script, source] of steps) {
  console.log(`\n=== ${script}`);
  const run = spawnSync("python", [path.join(here, script), source], { stdio: "inherit" });
  if (run.status !== 0) {
    console.error(`${script} failed`);
    process.exit(run.status ?? 1);
  }
}
console.log("\nfood-compass assets rebuilt");
