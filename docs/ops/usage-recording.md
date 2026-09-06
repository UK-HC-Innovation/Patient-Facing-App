# Usage recording

A record of how the app is being used, kept so we can check whether it gave the right answer
and find out where it broke. It is an operator's tool. It is not the patient-facing audit
trail in the privacy panel, and it never appears on any screen.

## What it records

Four kinds of event.

| Kind | What it says | Example |
| --- | --- | --- |
| `view` | someone opened a screen | `route: food_demo` |
| `action` | someone did something on it | `route: food_demo, action: scan_barcode` |
| `decision` | the app committed to an answer | `crisis_gate -> matched, via deterministic, rule self_harm_wake_up` |
| `problem` | something failed or dead-ended | `api.route.classify -> not_configured (no_provider)` |

`decision` is the one worth caring about. Each of these is a place where the app answers a
question a person then acts on, so a wrong answer there is the bug that matters:

`crisis_gate`, `route_classify`, `food_score`, `carb_range`, `plate_review`, `package_scan`,
`barcode_lookup`, `dr_triage`, `family_recommend`, `screening_extract`, `coach_reply`.

A decision carries the outcome, how it was reached, an optional confidence and latency, and
an `inputSignature`: a 32-bit hash of the input. The signature is what makes the report able
to say "this junction was handed the same input twice and answered differently".

## What it cannot record

The app is patient-facing, so the thing to prevent is a symptom description ending up in a
log line. That is prevented by the vocabulary rather than by scrubbing after the fact.

Every string in an event is either a closed literal union (`route`, `kind`, `decision`,
`source`, `problem`) or a bounded slug (`action`, `where`, `code`, `outcome`, `tags`). A slug
is lowercase, has no spaces, is at most 40 characters, contains at least one letter, and has
no run of four digits. A sentence cannot pass. Neither can a date of birth, a blood sugar
reading, a phone number or a record number.

`src/domain/usage-event-schema.test.ts` holds the proof: a corpus of the shapes a real leak
takes, asserted against every string field. Two of the rules in that schema exist because
that corpus caught them, not because anyone predicted them.

There is no cross-visit identifier anywhere. The session id lives in `sessionStorage`, so a
new tab is a new session and closing the browser ends it. No IP address, no user agent, and
no exact viewport size is recorded.

## Where it goes

One JSON line per event, on stdout, with `"log":"usage"` as the first key.

Both hosts already collect stdout, so there is nothing else to keep alive:

- Azure Container Apps ships it to the `log-hcinov-centralus` Log Analytics workspace named
  in `food-lens-azure-hosting-plan.md`.
- Vercel keeps it in runtime logs, with short retention.

Client events batch through `POST /api/usage`; server events are written directly by
`src/server/usage-log.ts`. Both land in the same feed and the report reads them together.

The sink always answers `204`, including when it rejects. The client has no retry queue and
nothing useful to do with an error, and a validation message in the response body would tell
an unknown caller how to shape a payload that lands in the operator's log. A rejected batch
is rejected whole and logged as a rejection, so a spike in rejections is itself a bug report:
it means a call site is emitting something the vocabulary does not cover.

## Reading it

```bash
npm run usage:report -- usage.jsonl
```

Or pipe a log straight in. The reader skips anything that is not a usage line and unwraps
the envelope a container platform puts around stdout, so raw output works:

```bash
az containerapp logs show -n ca-foodlens -g rg-hcinov-compliance-centralus --follow false | npm run usage:report
```

```bash
vercel logs <deployment> | npm run usage:report
```

`--since <iso-date>` scopes the report to one test run. `--json` gives the same findings as
data.

The report opens with the two sections that are findings rather than description:

**DISAGREEMENTS** is the correctness check. One junction, one input signature, more than one
answer. A junction is meant to be a function of its input, so two answers means it is not
deterministic, or state is leaking in, or the build changed underneath. The builds and
sessions behind each answer are printed next to it.

**PROBLEMS** and **DEAD ENDS** are the bug check. A dead end is a session whose last event
was a problem: someone hit a wall and left.

Below those: decision outcome distributions with p50 and p95 latency, screens, actions, and
the builds the data came from.

## Turning it off

`USAGE_TELEMETRY=0` at build time disables recording entirely. `BUILD_ID` should be set to
the git sha or image tag so the report can tell one build's answers from another's; without
it every line says `dev`.

## Adding a call site

```ts
// client
import { recordUsage } from "@/telemetry/recorder";
recordUsage({ kind: "problem", problem: "timeout", where: "barcode_scanner" });

// server
import { recordServerUsage } from "@/server/usage-log";
recordServerUsage({ kind: "problem", problem: "error", where: "api.food.plate", code: "http_502" });
```

Two rules. Pass a literal, never a variable holding user input. And when a route has several
paths that answer the caller identically, give each one its own line: `/api/route/classify`
returns the same `{ kind: "coach" }` whether the key is unset, the passcode failed, the model
timed out or it genuinely deferred, so without four distinct lines a route that has been
quietly degraded for days looks exactly like one that is working.

An event the vocabulary does not cover is dropped and logged as a rejection rather than
widening what can be recorded. If you need a new decision junction or problem kind, add it to
the closed union in `src/domain/usage-event.ts` and to the schema next to it; the parity
check in the schema test fails the build if you only do one.
