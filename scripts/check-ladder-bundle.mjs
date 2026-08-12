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

console.log(
  [
    `Ladder bundle budget passed:`,
    `first-load ${(firstLoad.gzip / kib).toFixed(1)} KiB gzip`,
    `route-only ${(routeOnly.gzip / kib).toFixed(1)} KiB gzip`,
    `page entry ${(pageEntryRaw / kib).toFixed(1)} KiB raw`,
    `${requiredSplits.length} deferred surfaces verified`
  ].join(" ")
);
