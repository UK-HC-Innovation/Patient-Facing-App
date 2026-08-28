import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const nextRoot = resolve(projectRoot, ".next");
const appManifest = JSON.parse(
  readFileSync(resolve(nextRoot, "app-build-manifest.json"), "utf8")
);
const dynamicManifest = JSON.parse(
  readFileSync(resolve(nextRoot, "react-loadable-manifest.json"), "utf8")
);

const kib = 1024;
const budgets = {
  firstLoadGzip: 315 * kib,
  routeOnlyGzip: 100 * kib,
  pageEntryRaw: 240 * kib
};

function javascriptFiles(route) {
  const files = appManifest.pages[route];
  if (!Array.isArray(files)) throw new Error(`Missing ${route} in app-build-manifest.json`);
  return files.filter((file) => file.endsWith(".js"));
}

function byteTotals(files) {
  return files.reduce(
    (totals, file) => {
      const bytes = readFileSync(resolve(nextRoot, file));
      totals.raw += bytes.length;
      totals.gzip += gzipSync(bytes).length;
      return totals;
    },
    { raw: 0, gzip: 0 }
  );
}

function assertBudget(label, actual, maximum) {
  if (actual > maximum) {
    throw new Error(
      `${label} is ${(actual / kib).toFixed(1)} KiB; budget is ${(maximum / kib).toFixed(1)} KiB.`
    );
  }
}

const layoutFiles = new Set(javascriptFiles("/layout"));
const ladderFiles = javascriptFiles("/ladder/page");
const routeOnlyFiles = ladderFiles.filter((file) => !layoutFiles.has(file));
const firstLoad = byteTotals(ladderFiles);
const routeOnly = byteTotals(routeOnlyFiles);
const pageEntry = ladderFiles.find((file) => /static\/chunks\/app\/ladder\/page-.*\.js$/.test(file));
if (!pageEntry) throw new Error("Could not identify the Ladder page entry chunk.");
const pageEntryRaw = statSync(resolve(nextRoot, pageEntry)).size;

const requiredSplits = [
  "@/components/ladder/ladder-notes-surface",
  "@/components/ladder/ladder-visit-surface"
];
for (const request of requiredSplits) {
  const split = Object.entries(dynamicManifest).find(([key]) => key.endsWith(` -> ${request}`));
  if (!split || split[1].files.length === 0) {
    throw new Error(`Expected an independent dynamic chunk for ${request}.`);
  }
  if (split[1].files.some((file) => ladderFiles.includes(file))) {
    throw new Error(`${request} leaked back into Ladder's initial page manifest.`);
  }
}

assertBudget("Ladder first-load JavaScript (gzip sum)", firstLoad.gzip, budgets.firstLoadGzip);
assertBudget("Ladder route-only JavaScript (gzip sum)", routeOnly.gzip, budgets.routeOnlyGzip);
assertBudget("Ladder page entry (raw)", pageEntryRaw, budgets.pageEntryRaw);

// --- spec 23: the Food Compass lookup assets are ~5 MB and must never reach a client ---
// A budget on the two routes that render scores is the enforcement: if src/data/food-compass
// is ever imported from a client component, these numbers move by megabytes, not kilobytes.
const compassBudgets = {
  // The public door is /food/demo since spec 26 P6; /compass is a permanent redirect to it.
  // Measured after spec 23: /compass 162.6 KiB, /food 273.9 KiB gzip. Re-measured after the
  // Food Lens shell rebuild, which cost both routes about 6 KiB of scroll shell, status
  // strip, pinned voice bar and the strings they speak: /compass 186.6 KiB, /food 297.3 KiB.
  // Headroom for normal growth, and still orders of magnitude below the ~1.6 MB a leaked
  // fcs2-foods.json would add -- which is the thing these numbers exist to catch.
  "/food/demo/page": 192 * kib,
  "/food/page": 303 * kib
};

const compassReport = [];
for (const [route, budget] of Object.entries(compassBudgets)) {
  const files = javascriptFiles(route);
  const totals = byteTotals(files);
  assertBudget(`${route} first-load JavaScript (gzip sum)`, totals.gzip, budget);
  compassReport.push(`${route} ${(totals.gzip / kib).toFixed(1)} KiB gzip`);

  // A data asset would land as a huge single chunk; catch it directly as well.
  for (const file of files) {
    const size = statSync(resolve(nextRoot, file)).size;
    if (size > 900 * kib) {
      throw new Error(
        `${route} pulls ${file} at ${(size / kib).toFixed(0)} KiB raw — a Food Compass data asset has leaked into the client bundle.`
      );
    }
  }
}

console.log(`Food Compass route budgets passed: ${compassReport.join(", ")}`);

console.log(
  [
    `Ladder bundle budget passed:`,
    `first-load ${(firstLoad.gzip / kib).toFixed(1)} KiB gzip`,
    `route-only ${(routeOnly.gzip / kib).toFixed(1)} KiB gzip`,
    `page entry ${(pageEntryRaw / kib).toFixed(1)} KiB raw`,
    `${requiredSplits.length} deferred surfaces verified`
  ].join(" ")
);
