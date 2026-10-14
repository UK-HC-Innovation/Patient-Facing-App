#!/usr/bin/env node
// Dependency audit gate for CI. Runs `npm audit --json` and fails on any
// advisory at or above --audit-level (default high), except the advisories in
// EXCEPTIONS. An exception lapses on its `until` date, or as soon as npm reports
// a non-breaking fix for the package, whichever comes first. Fails closed if
// npm audit itself errors.
import { spawnSync } from "node:child_process";

const EXCEPTIONS = [
  {
    // Added 2026-10-14 with owner approval. braces 3.0.3 is the latest release
    // and the advisory lists no patched version. braces reaches the tree only
    // through dev tooling (tailwindcss 3 via chokidar, micromatch and fast-glob;
    // eslint-config-next via fast-glob) and only expands glob patterns from
    // this repo's own config, never request input.
    id: "GHSA-vfj7-8cjw-p6xm",
    package: "braces",
    until: "2026-11-13",
    reason: "no patched braces release; dev-only, repo-owned glob patterns"
  }
];

const LEVELS = ["info", "low", "moderate", "high", "critical"];
const levelArg = process.argv.find((arg) => arg.startsWith("--audit-level="));
const level = levelArg ? levelArg.slice("--audit-level=".length) : "high";
if (!LEVELS.includes(level)) {
  console.error(`Unknown --audit-level: ${level}`);
  process.exit(1);
}
const threshold = LEVELS.indexOf(level);

const run = spawnSync("npm audit --json", {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  shell: true
});

let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error("npm audit did not return JSON.");
  console.error(run.stderr || run.error?.message || "");
  process.exit(1);
}
if (report.error || !report.vulnerabilities) {
  console.error(`npm audit failed: ${JSON.stringify(report.error ?? report)}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const failures = [];
const excepted = [];
const seen = new Set();

for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
  for (const advisory of vulnerability.via) {
    // String entries point at another vulnerable package; its own advisories
    // are checked under that package's key.
    if (typeof advisory === "string") continue;
    if (LEVELS.indexOf(advisory.severity) < threshold) continue;
    const id = advisory.url.split("/").pop();
    if (seen.has(`${name} ${id}`)) continue;
    seen.add(`${name} ${id}`);

    const line = `${advisory.severity} ${name} ${advisory.range} ${id} ${advisory.title}`;
    const exception = EXCEPTIONS.find((entry) => entry.id === id && entry.package === name);
    if (!exception) failures.push(line);
    else if (today > exception.until) failures.push(`${line} [exception lapsed ${exception.until}]`);
    else if (vulnerability.fixAvailable === true) failures.push(`${line} [exception lapsed: npm now reports a fix]`);
    else excepted.push(`${line} [excepted until ${exception.until}: ${exception.reason}]`);
  }
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `npm audit: ${counts.total ?? "?"} vulnerable packages (critical ${counts.critical ?? 0}, high ${counts.high ?? 0}, moderate ${counts.moderate ?? 0}, low ${counts.low ?? 0}); gate level ${level}.`
);
for (const line of excepted) console.log(`EXCEPTED ${line}`);
for (const entry of EXCEPTIONS) {
  if (![...seen].includes(`${entry.package} ${entry.id}`)) {
    console.log(`NOTE exception ${entry.id} (${entry.package}) is no longer reported; remove it from scripts/audit-gate.mjs.`);
  }
}
for (const line of failures) console.log(`FAIL ${line}`);

if (failures.length > 0) {
  console.log(`Audit gate FAILED: ${failures.length} advisory(ies) at or above ${level}.`);
  process.exit(1);
}
console.log(`Audit gate passed at ${level}.`);
