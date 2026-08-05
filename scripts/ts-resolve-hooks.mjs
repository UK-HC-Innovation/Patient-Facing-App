/**
 * Lets a plain Node script import the app's TypeScript domain modules directly,
 * so a report about the catalog reads the catalog itself rather than a regex's
 * guess at it. Node strips the types; this only teaches its resolver the two
 * conventions the app uses that bare ESM does not: extension-less relative
 * imports, and the "@/" alias for src/.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function firstExisting(base) {
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const aliased = specifier.startsWith("@/") ? resolve(SRC, specifier.slice(2)) : null;
    if (aliased) {
      const url = firstExisting(aliased);
      if (url) return { url, shortCircuit: true };
    }

    if (specifier.startsWith(".") && context.parentURL) {
      const base = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      const url = firstExisting(base);
      if (url) return { url, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  }
});
