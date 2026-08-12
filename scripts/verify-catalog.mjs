#!/usr/bin/env node
/**
 * Mechanical re-verification of the family catalogs.
 *
 * Spec 20 F5b. Two questions, kept apart on purpose:
 *
 *   1. Is the source page still reachable?  (a fetch answers this)
 *   2. Does it still say what the entry claims?  (a fetch mostly cannot)
 *
 * So this never bumps a `verifiedAt` by itself (FR-6). It fetches every source
 * URL, and for each entry looks for a *content signal* in the page it got back:
 * a phone number the entry prints, or at least two meaningful terms from the
 * entry's own name. A signal found grounds the source identity or a displayed
 * phone, not every fact on the card; a missing signal is not evidence of
 * anything — plenty of these pages render their content in JavaScript, or are
 * PDFs. Both outcomes are reported, and the owner decides which dates move.
 *
 * A blocked response (403/429), or a timeout from a host known to refuse scripts
 * (kynect, ssa.gov, healthychildren.org — spec 09), is classified "needs human",
 * never "dead": a link checker that cries wolf teaches everyone to ignore it.
 *
 *   node scripts/verify-catalog.mjs --strict --out docs/ops/catalog-verification/<date>.md
 */
import "./ts-resolve-hooks.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), "..");

const AUTOMATION_BLOCKED = ["kynect.ky.gov", "ssa.gov", "www.ssa.gov", "healthychildren.org", "www.healthychildren.org"];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const STOPWORDS = new Set([
  "the", "and", "of", "for", "a", "an", "in", "on", "to", "with", "kentucky", "ky",
  "county", "program", "services", "service", "center", "centre", "support", "family",
  "families", "child", "children", "resources", "resource", "guide", "how", "your",
  "first", "steps", "parent", "developmental", "special", "education", "office",
  "community", "health", "central", "statewide", "waiver", "association", "department",
  "administration", "organization", "university"
]);

async function loadEntries() {
  const resources = await import("../src/domain/family-resources.ts");
  const guides = await import("../src/domain/family-guides.ts");
  const sdoh = await import("../src/domain/sdoh-resources.ts");

  return [
    ...resources.FAMILY_RESOURCE_CATALOG.map((entry) => ({
      catalog: "family-resources",
      id: entry.id,
      name: entry.name,
      contact: entry.contact,
      sourceUrl: entry.sourceUrl,
      verifiedAt: entry.verifiedAt,
      humanVerify: entry.humanVerify === true
    })),
    ...guides.FAMILY_GUIDE_CATALOG.map((entry) => ({
      catalog: "family-guides",
      id: entry.id,
      name: entry.title,
      contact: entry.contact ?? "",
      sourceUrl: entry.sourceUrl,
      verifiedAt: entry.verifiedAt,
      humanVerify: entry.humanVerify === true
    })),
    ...sdoh.KENTUCKY_SDOH_RESOURCE_CATALOG.map((entry) => ({
      catalog: "sdoh-resources",
      id: entry.id,
      name: entry.name,
      contact: entry.contact,
      sourceUrl: entry.sourceUrl,
      verifiedAt: entry.verifiedAt,
      humanVerify: false
    }))
  ];
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

/** What we would recognise on the page if the entry's claim still holds. */
export function signalsFor(entry) {
  const phones = [...(entry.contact ?? "").matchAll(/\b\d{3}-\d{3}-\d{4}\b/g)].map((match) => match[0]);
  const words = [
    ...new Set(
      entry.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 4 && !STOPWORDS.has(word))
    )
  ];
  return { phones, words };
}

export function findSignal(entry, body) {
  const { phones, words } = signalsFor(entry);
  const bodyDigits = digitsOnly(body);
  for (const phone of phones) {
    if (body.includes(phone) || bodyDigits.includes(digitsOnly(phone))) {
      return { kind: "phone", value: phone };
    }
  }
  const bodyWords = new Set(
    body
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
  const matched = words.filter((word) => bodyWords.has(word));
  if (matched.length >= 2) return { kind: "name_terms", value: matched.slice(0, 3).join(" + ") };
  return null;
}

const pageCache = new Map();

async function fetchPage(url) {
  if (pageCache.has(url)) return pageCache.get(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let result;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*" }
    });
    const finalUrl = response.url || url;
    const contentType = response.headers.get("content-type") ?? "";
    const textual = /text|json|xml/.test(contentType);
    const body = textual ? await response.text() : "";
    result = { code: response.status, finalUrl, body, contentType };
  } catch (error) {
    result = { code: 0, finalUrl: url, body: "", contentType: "", error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
  pageCache.set(url, result);
  return result;
}

export function classify(entry, page) {
  const blocked = AUTOMATION_BLOCKED.includes(hostOf(entry.sourceUrl));
  if (page.code === 403 || page.code === 429 || (blocked && page.code === 0)) {
    return { reach: "needs_human" };
  }
  if (page.code === 0) return { reach: "dead" };
  if (page.code < 200 || page.code >= 300) return { reach: "dead" };
  const normalize = (value) => value.replace(/\/$/, "").toLowerCase();
  return { reach: normalize(page.finalUrl) === normalize(entry.sourceUrl) ? "ok" : "moved" };
}

/** Mutually exclusive report groups: every result belongs to exactly one. */
export function groupResults(results) {
  return {
    confirmed: results.filter(
      (row) => row.reach === "ok" && row.signal !== null && !row.humanVerify
    ),
    unconfirmed: results.filter(
      (row) => row.reach === "ok" && row.signal === null && !row.humanVerify
    ),
    moved: results.filter((row) => row.reach === "moved"),
    needsHuman: results.filter(
      (row) => row.reach === "needs_human" || (row.reach === "ok" && row.humanVerify)
    ),
    dead: results.filter((row) => row.reach === "dead")
  };
}

function table(rows, columns) {
  if (rows.length === 0) return "_None._\n";
  const head = `| ${columns.map(({ label }) => label).join(" | ")} |`;
  const rule = `|${columns.map(() => "---").join("|")}|`;
  const body = rows.map((row) => `| ${columns.map(({ cell }) => cell(row)).join(" | ")} |`).join("\n");
  return `${head}\n${rule}\n${body}\n`;
}

async function main() {
  const outFlag = process.argv.indexOf("--out");
  const out =
    outFlag >= 0 && process.argv[outFlag + 1]
      ? process.argv[outFlag + 1]
      : "docs/ops/catalog-verification/report.md";
  const strict = process.argv.includes("--strict");

  const entries = await loadEntries();
  const urls = new Set(entries.map(({ sourceUrl }) => sourceUrl));
  process.stdout.write(`Checking ${entries.length} entries across ${urls.size} unique source URLs…\n`);

  const results = [];
  for (const entry of entries) {
    const page = await fetchPage(entry.sourceUrl);
    const { reach } = classify(entry, page);
    const signal = reach === "ok" || reach === "moved" ? findSignal(entry, page.body) : null;
    results.push({ ...entry, reach, code: page.code, finalUrl: page.finalUrl, contentType: page.contentType, signal, error: page.error });
    process.stdout.write(
      `  ${reach.padEnd(11)} ${String(page.code || "—").padEnd(3)} ${signal ? `[${signal.kind}]` : "[ - ]"}  ${entry.id}\n`
    );
  }

  const { confirmed, unconfirmed, moved, needsHuman, dead } = groupResults(results);
  const generatedAt = new Date().toISOString();

  const body = [
    "# Catalog source verification",
    "",
    `\`scripts/verify-catalog.mjs\`, ${entries.length} entries across ${urls.size} unique source URLs`,
    "(`family-resources`, `family-guides`, `sdoh-resources`).",
    `Generated: ${generatedAt}`,
    "",
    "**Reachability** is what a fetch can answer. **Content confirmed** means the page we got back",
    "still carries a strong signal from the entry itself — a phone number it prints, at least two",
    "meaningful name terms. A missing signal is *not* evidence the entry is wrong: several pages",
    "render in JavaScript or are PDFs. A signal only",
    "establishes source identity or a displayed phone; it does not validate every card claim and",
    "never bumps `verifiedAt` without a reviewer (FR-6).",
    "",
    `- reachable, content confirmed: **${confirmed.length}**`,
    `- reachable, content not machine-confirmable: **${unconfirmed.length}**`,
    `- moved (200, final URL differs): **${moved.length}**`,
    `- needs a human (catalog flag, blocked request, or known-blocked timeout): **${needsHuman.length}**`,
    `- dead: **${dead.length}**`,
    "",
    "## Reachable, content confirmed",
    "",
    table(confirmed, [
      { label: "id", cell: (row) => row.id },
      { label: "catalog", cell: (row) => row.catalog },
      { label: "signal", cell: (row) => `${row.signal.kind}: \`${row.signal.value}\`` },
      { label: "verifiedAt", cell: (row) => row.verifiedAt }
    ]),
    "## Reachable, content not machine-confirmable",
    "",
    table(unconfirmed, [
      { label: "id", cell: (row) => row.id },
      { label: "code", cell: (row) => row.code },
      { label: "content-type", cell: (row) => row.contentType.split(";")[0] || "—" },
      { label: "verifiedAt", cell: (row) => row.verifiedAt }
    ]),
    "## Moved",
    "",
    table(moved, [
      { label: "id", cell: (row) => row.id },
      { label: "from", cell: (row) => row.sourceUrl },
      { label: "to", cell: (row) => row.finalUrl }
    ]),
    "## Needs a human",
    "",
    table(needsHuman, [
      { label: "id", cell: (row) => row.id },
      { label: "url", cell: (row) => row.sourceUrl },
      { label: "code", cell: (row) => row.code || "—" },
      { label: "reason", cell: (row) => row.humanVerify ? "catalog humanVerify flag" : "request blocked" }
    ]),
    "## Dead",
    "",
    table(dead, [
      { label: "id", cell: (row) => row.id },
      { label: "url", cell: (row) => row.sourceUrl },
      { label: "code", cell: (row) => row.code || "—" },
      { label: "note", cell: (row) => row.error ?? "" }
    ])
  ].join("\n");

  const target = resolve(ROOT, out);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${body}\n`, "utf8");
  process.stdout.write(`\nWrote ${out}\n`);
  process.stdout.write(
    `confirmed=${confirmed.length} unconfirmed=${unconfirmed.length} moved=${moved.length} needsHuman=${needsHuman.length} dead=${dead.length}\n`
  );
  await writeFile(
    resolve(ROOT, "docs/ops/catalog-verification/.last-run.json"),
    `${JSON.stringify(
      {
        confirmedIds: confirmed.map(({ id }) => id),
        unconfirmedIds: unconfirmed.map(({ id }) => id),
        needsHumanIds: needsHuman.map(({ id }) => id),
        movedIds: moved.map(({ id }) => id),
        deadIds: dead.map(({ id }) => id)
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  if (strict && (dead.length > 0 || moved.length > 0)) {
    process.stderr.write("Strict verification failed: resolve dead or moved catalog sources.\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
