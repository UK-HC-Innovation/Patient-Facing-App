#!/usr/bin/env node
// Crisis red-flag ops gate. Runs the deterministic crisis suite (which enforces
// the >= 0.95 recall floor AND zero false positives on the maintained corpus)
// and writes a dated red-team result file. No new dependencies.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

// family-safety.test.ts joined the gate on 2026-08-04 (spec 17 workstream B,
// Finding 2): it is the single safety read for the Ladder/family thread, and its
// crisis-to-tier mapping was previously ungated even though the classifiers it
// composes were not.
const COMMAND =
  "npx vitest run src/domain/crisis-red-flags.test.ts src/ai/safety-gate.test.ts src/domain/front-door.test.ts src/domain/safety.test.ts src/ai/voice-gate-corpus.test.ts src/ai/output-guard.test.ts src/domain/family-safety.test.ts";

let output = "";
let result = "PASS";
try {
  output = execSync(COMMAND, { encoding: "utf8", stdio: "pipe" });
} catch (error) {
  result = "FAIL";
  output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
}

const date = new Date().toISOString().slice(0, 10);
const dir = "docs/ops/red-team-results";
mkdirSync(dir, { recursive: true });
const file = `${dir}/${date}-crisis-gate.md`;

// A PASS means the corpus test's `expect(report.falseNegatives).toEqual([])` and
// `expect(report.falsePositives).toEqual([])` both held, so recall is exactly
// 1.00 with zero trap false positives.
const recallLine =
  result === "PASS"
    ? "Deterministic recall = 1.00 (all corpus positives detected); false positives = 0. Floor of 0.95 met."
    : "Gate FAILED — recall floor and/or zero-false-positive assertion did not hold. See output.";

// Strip ANSI color codes so the committed report is plain text.
const plainOutput = output.replace(/\[[0-9;]*m/g, "");
const trimmedOutput = plainOutput.trim().split("\n").slice(-40).join("\n");

const markdown = `# Crisis gate red-team result

## Date

${date}

## Command

\`\`\`
${COMMAND}
\`\`\`

## Result

${result}

## Output

\`\`\`
${trimmedOutput}
\`\`\`

## Interpretation

${recallLine}

The crisis classifier (\`src/domain/crisis-red-flags.ts\`, exported as
\`classifyCrisis\` in \`src/domain/safety.ts\`) is the F4 gate. Self-harm
disclosures route to the crisis tier (988/911/safety-plan) and the provider is
never called; sudden vision loss and acute danger route to the emergency tier.
Negation is handled by stripping negated self-harm spans before scanning, so
"I would never hurt myself" clears while "I want to die" still fires. This gate
is advisory-biased toward escalation, which spec 04 accepts.

The gate also runs the front-door routing invariant (\`src/domain/front-door.ts\`):
for every crisis-corpus positive, \`decideFrontDoor\` must return a Coach outcome
and must NEVER route the utterance to a feature screen. This makes "the router
sent a crisis to the BP form" a build-breaking failure, not a silent UX
regression, and confirms the front door can only navigate or defer — never write.
`;

writeFileSync(file, markdown);
console.log(`Crisis gate ${result}. Wrote ${file}`);
process.exit(result === "PASS" ? 0 : 1);
