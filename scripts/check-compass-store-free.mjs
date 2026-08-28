/**
 * Proves that the public Food Lens door never reaches the patient store.
 *
 * Spec 24 owner decision 5 says /compass stays "stateless, store-free, and
 * input-shape-frozen". Until this script that was a convention pinned by e2e assertions --
 * `e2e/compass.spec.ts` proving no text box renders and no patient words appear. Those
 * catch the symptom. This catches the cause, at build time, before a symptom exists:
 * if any value-import path from the public route ever reaches the store, `npm run check`
 * fails and prints the exact chain.
 *
 * Why a source-graph walk rather than the two obvious alternatives:
 *
 *  - A bundle-string scan for the storage key false-positives on day one. The root layout
 *    (src/app/layout.tsx) wraps everything in HealthStateProvider, so the storage-key
 *    literal is already -- correctly -- in the shared layout chunks that /compass loads.
 *  - A per-chunk scan is blind to webpack dedup: a module can be referenced across chunk
 *    boundaries without its bytes landing in the route's own files.
 *
 * So: walk the real TypeScript import graph, skip `import type` (erased at compile time,
 * which is what lets AppState flow freely through @/domain/types), and treat everything
 * else as a value edge. Conservative in the safe direction.
 *
 * A guard that reports "passed" on a case it cannot see is worse than a documented
 * convention, so `--self-test` asserts that every import form this file claims to catch is
 * actually caught, and `npm run compass:storefree` runs it before the real check.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const srcRoot = resolve(projectRoot, "src");

/**
 * Modules that would put the patient's persisted record on the public surface.
 * `src/state/selectors.ts` is deliberately NOT here: it is pure (its only import is
 * `import type { AppState }`), it carries no storage access, and the shared voice-session
 * hook already reaches it on the /compass path to refuse a session during a crisis.
 */
const FORBIDDEN = [
  "src/state/store.tsx",
  "src/state/storage.ts",
  "src/components/app-shell.tsx"
];

/**
 * Every file the public route ships, not just its page. A layout is the canonical App
 * Router place someone would add a provider wrapper, and seeding from the page alone would
 * never walk it.
 */
const PUBLIC_ROUTE_DIR = "src/app/compass";

/** The shared layer must also stay route-blind -- no capability may be inferred from the URL. */
const ROUTE_BLIND_FILES = [
  "src/components/food-lens-experience.tsx",
  "src/components/food-lens-shell.tsx",
  "src/components/food-lens-blocks.tsx",
  "src/components/food-lens-voice-bar.tsx",
  "src/hooks/use-food-lens-engine.ts",
  "src/hooks/use-viewfinder-visibility.ts",
  "src/hooks/use-why-score.ts",
  "src/hooks/use-passcode.ts",
  "src/hooks/use-page-hide-teardown.ts"
];
const ROUTE_SNIFFING = /\busePathname\b|\blocation\s*\.\s*pathname\b|\bwindow\.location\.pathname\b/;

/**
 * Value-import edges out of one source text.
 *
 * Four forms, because a walker that misses one reports "passed" on a real leak:
 *   import x from "y" / export … from "y"   -- but not `import type … from`
 *   import "y"                              -- bare side effect, binds nothing, still bundles
 *   import("y")                             -- including a leading webpackChunkName comment
 *   require("y")                            -- lint forbids it, the walker does not rely on that
 */
export function valueImports(source) {
  const found = [];

  // `import type { A } from "y"` is erased by the compiler and cannot pull a module in.
  // A mixed clause (`import { type A, b }`) still does, so only a whole-clause modifier
  // is safe to skip.
  for (const match of source.matchAll(
    /(?:^|[\n;])\s*(?:import|export)\s+(?!type\s)([\s\S]*?)\s+from\s*["']([^"']+)["']/g
  )) {
    found.push(match[2]);
  }
  for (const match of source.matchAll(/(?:^|[\n;])\s*import\s*["']([^"']+)["']/g)) {
    found.push(match[1]);
  }
  for (const match of source.matchAll(
    /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*["']([^"']+)["']/g
  )) {
    found.push(match[1]);
  }
  for (const match of source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    found.push(match[1]);
  }

  return found;
}

function toPosix(absolutePath) {
  return relative(projectRoot, absolutePath).split("\\").join("/");
}

/** Resolve a module specifier to a file inside src/, or null for anything external. */
function resolveSpecifier(specifier, fromFile) {
  let base;
  if (specifier.startsWith("@/")) {
    base = join(srcRoot, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null; // node_modules, node: builtins, next/*
  }
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx")
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/** Breadth-first from every entry, so the chain reported is the shortest one. */
function shortestPathToForbidden(entries) {
  const forbidden = new Set(FORBIDDEN.map((f) => resolve(projectRoot, f)));
  const queue = entries.map((entry) => [resolve(projectRoot, entry)]);
  const seen = new Set(queue.map((path) => path[0]));

  while (queue.length > 0) {
    const path = queue.shift();
    const file = path[path.length - 1];
    if (forbidden.has(file) && path.length > 1) {
      return path;
    }
    for (const specifier of valueImports(readFileSync(file, "utf8"))) {
      const next = resolveSpecifier(specifier, file);
      if (!next || seen.has(next)) {
        continue;
      }
      seen.add(next);
      queue.push([...path, next]);
    }
  }
  return null;
}

function routeFiles(dir) {
  const absolute = resolve(projectRoot, dir);
  return readdirSync(absolute)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .filter((name) => !name.includes(".test."))
    .map((name) => `${dir}/${name}`);
}

// --- the walker's own self-test: every form it claims to catch, actually caught ---
if (process.argv.includes("--self-test")) {
  const cases = [
    ['import { useHealthState } from "@/state/store";', "named"],
    ['import "@/state/store";', "bare side effect"],
    ['const m = await import(/* webpackChunkName: "s" */ "@/state/store");', "dynamic with comment"],
    ['const m = await import("@/state/store");', "dynamic"],
    ['export { x } from "@/state/store";', "re-export"],
    ['const m = require("@/state/store");', "require"],
    ['import * as s from "@/state/store";', "namespace"],
    ['import { type A, b } from "@/state/store";', "mixed type clause"]
  ];
  const missed = cases.filter(([source]) => !valueImports(source).includes("@/state/store"));
  // The one form that must NOT be an edge: it is erased before a bundler ever sees it.
  const overreach = valueImports('import type { AppState } from "@/state/store";').includes("@/state/store")
    ? ["type-only import counted as a value edge"]
    : [];
  const problems = [...missed.map(([, name]) => `misses ${name}`), ...overreach];
  if (problems.length > 0) {
    console.error(`\nWalker self-test FAILED:\n  ${problems.join("\n  ")}\n`);
    process.exit(1);
  }
  console.log(`Walker self-test passed: ${cases.length} import forms caught, type-only ignored.`);
  process.exit(0);
}

const failures = [];

// 1. The property itself, from every file the public route ships.
const entries = routeFiles(PUBLIC_ROUTE_DIR);
const leak = shortestPathToForbidden(entries);
if (leak) {
  failures.push(
    `The public Food Lens door reaches the patient store:\n    ${leak.map(toPosix).join("\n      -> ")}\n` +
      `  Personalization may only enter the shared layer as props the /food door supplies.`
  );
}

// 2. The negative fixture: if the walker cannot find the store from the page that genuinely
//    uses it, the walker is broken and check 1 above proves nothing.
if (!shortestPathToForbidden(["src/app/food/page.tsx"])) {
  failures.push(
    "Self-test failed: no path from src/app/food/page.tsx to the store. The import walker is " +
      "not working, so the /compass result above is meaningless."
  );
}

// 3. Route blindness: every mount difference is a capability prop, never a URL check.
for (const file of ROUTE_BLIND_FILES) {
  const absolute = resolve(projectRoot, file);
  if (!existsSync(absolute)) {
    continue; // not every shared file exists in every phase of the migration
  }
  if (ROUTE_SNIFFING.test(readFileSync(absolute, "utf8"))) {
    failures.push(
      `${file} reads the route. Every difference between the two doors is a capability prop; ` +
        "a pathname check is the mode enum this layer exists to avoid."
    );
  }
}

if (failures.length > 0) {
  console.error(`\nFood Lens store-free check FAILED\n\n  ${failures.join("\n\n  ")}\n`);
  process.exit(1);
}

console.log(
  `Food Lens store-free check passed: ${entries.length} public-route entry files reach none of ` +
    `${FORBIDDEN.join(", ")}; walker self-test green; ${ROUTE_BLIND_FILES.length} shared files route-blind.`
);
