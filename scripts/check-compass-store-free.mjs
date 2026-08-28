/**
 * Proves that the public Food Lens door never reaches the patient store.
 *
 * Spec 24 owner decision 5 says /compass stays "stateless, store-free, and
 * input-shape-frozen". Until now that was a convention pinned by e2e assertions --
 * `e2e/compass.spec.ts` proving no text box renders and no patient words appear. Those
 * catch the symptom. This catches the cause, at build time, before a symptom exists:
 * if any value-import path from the public page ever reaches the store, `npm run check`
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
 * which is what lets AppState flow freely through @/domain/types), and treat anything else
 * as a value edge. Conservative in the safe direction.
 */

import { readFileSync, existsSync } from "node:fs";
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

/** The shared layer must also stay route-blind -- no capability may be inferred from the URL. */
const ROUTE_BLIND_FILES = [
  "src/components/food-lens-experience.tsx",
  "src/components/food-lens-shell.tsx",
  "src/hooks/use-food-lens-engine.ts"
];
const ROUTE_SNIFFING = /\busePathname\b|\blocation\s*\.\s*pathname\b|\bwindow\.location\.pathname\b/;

const IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)\s+([\s\S]*?)\s*from\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

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
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      try {
        readFileSync(candidate);
        return candidate;
      } catch {
        // a directory that exists but is not readable as a file -- keep trying
      }
    }
  }
  return null;
}

/**
 * Value-import edges out of one file.
 *
 * `import type { X } from "y"` is erased by the compiler and cannot pull a module into the
 * bundle, so it is skipped. A mixed clause (`import { type A, b } from "y"`) still pulls the
 * module in, so it counts -- only a whole-clause `type` modifier is safe to ignore.
 */
function valueImports(file) {
  const source = readFileSync(file, "utf8");
  const found = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const [, clause, staticSpecifier, dynamicSpecifier] = match;
    const specifier = staticSpecifier ?? dynamicSpecifier;
    if (!specifier) {
      continue;
    }
    if (staticSpecifier && /^\s*type\b/.test(clause ?? "")) {
      continue;
    }
    found.push(specifier);
  }
  return found;
}

/** Breadth-first, so the chain reported is the shortest one. */
function shortestPathToForbidden(entry) {
  const start = resolve(projectRoot, entry);
  const queue = [[start]];
  const seen = new Set([start]);
  const forbidden = new Set(FORBIDDEN.map((f) => resolve(projectRoot, f)));

  while (queue.length > 0) {
    const path = queue.shift();
    const file = path[path.length - 1];
    if (forbidden.has(file) && path.length > 1) {
      return path;
    }
    for (const specifier of valueImports(file)) {
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

const failures = [];

// 1. The property itself.
const leak = shortestPathToForbidden("src/app/compass/page.tsx");
if (leak) {
  failures.push(
    `The public Food Lens door reaches the patient store:\n    ${leak.map(toPosix).join("\n      -> ")}\n` +
      `  Personalization may only enter the shared layer as props the /food door supplies.`
  );
}

// 2. The negative fixture: if the walker cannot find the store from the page that genuinely
//    uses it, the walker is broken and check 1 above proves nothing.
if (!shortestPathToForbidden("src/app/food/page.tsx")) {
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
  `Food Lens store-free check passed: /compass reaches none of ${FORBIDDEN.join(", ")}; ` +
    `walker self-test green; ${ROUTE_BLIND_FILES.length} shared files route-blind.`
);
