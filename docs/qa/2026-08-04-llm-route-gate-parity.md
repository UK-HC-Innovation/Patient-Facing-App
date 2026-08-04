# LLM route gate-ladder parity matrix (spec 17 workstream C)

**Date:** 2026-08-04
**Reference ladder:** `/api/family/interview` (the route the others were cloned from)
**Scope:** the seven routes that reach a live model provider

## Summary

Seven routes, twelve ladder dimensions. **Six divergences classified as drift and fixed**;
**seven classified as intentional** and documented below. Two routes had no route tests at all
(`route/classify`, `screening/extract`); classify now has one.

The single material finding: **`/api/route/classify` had no `DEMO_PASSCODE` gate.** It is the
highest-volume LLM route in the app — reached on every home-composer submission, the app's front
door — and it was the only credit-spending route any visitor could drive on the public deploy.

## Matrix

Legend: ✅ present · ❌ absent · ⚠️ diverges from the reference ladder

| Dimension | coach/text | route/classify | food/vision | screening/extract | family/interview | family/recommend | realtime/token |
|---|---|---|---|---|---|---|---|
| Body parse | cast | cast | cast | cast | zod `.strict()` | zod `.strict()` | cast |
| Invalid body | 400 | ⚠️ coach | 400 | 400 | 400 | 400 | ⚠️ empty |
| Crisis gate | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 409 |
| Provider + key gate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Extra feature flag | ❌ | ❌ | ❌ | ✅ `SCREENING_LIVE_EXTRACT` | ❌ | ❌ | ❌ |
| **Passcode gate** | ✅ | **❌ → ✅ FIXED** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Safety identifier** | ✅ | **❌ → ✅ FIXED** | ✅ | ✅ | **❌ → ✅ FIXED** | **❌ → ✅ FIXED** | ✅ |
| Timeout | 15s | 4s | 15s | 15s | 15s | 15s | 10s |
| Timeout mechanism | `AbortSignal` | `AbortSignal` | `AbortSignal` | `AbortSignal` | `AbortController` | `AbortController` | `AbortSignal` |
| Upstream not-ok | 502 | coach | 502 | 502 | 502 | 502 | 502 |
| Off-shape reply | 502 | normalized | 502 | 502 | 200 `data:null` | 200 `data:null` | 502 |
| **`Cache-Control: no-store`** | ✅ | ❌ | ✅ | ✅ | **❌ → ✅ FIXED** | **❌ → ✅ FIXED** | **❌ → ✅ FIXED** |
| Gate order matches reference | ✅ | ✅ | ✅ | ✅ | — | **⚠️ → ✅ FIXED** | ✅ |

## Drift — fixed

| # | Route(s) | Divergence | Fix |
|---|---|---|---|
| D1 | `route/classify` | No `DEMO_PASSCODE` gate — any visitor could spend credits on every typed utterance on the public deploy | Added the gate, returning the route's existing `{kind:"coach", confidence:0}` graceful fallback. The deterministic and mock stages have already run client-side, so gating degrades rather than blocks. Passcode threaded from `route-classifier-client.ts` using the same `?k=` read as the other six callers. |
| D2 | `route/classify`, `family/interview`, `family/recommend` | No `OpenAI-Safety-Identifier` header — three routes sent provider traffic with no abuse-attribution signal at all | Added `buildVoiceSafetyIdentifier("anonymous")`, matching the exact fallback the other four routes already use when no `patientId` is present. |
| D3 | `family/interview`, `family/recommend` | Success responses carrying caregiver-derived content had no `Cache-Control: no-store` | Added, matching coach/vision/extract. |
| D4 | `realtime/token` | The live response carries a short-lived client secret and had **no** `no-store`, while less sensitive text responses had it | Added. |
| D5 | `family/recommend` | Candidate-id resolution ran **before** the provider and passcode gates, so an unconfigured deploy with all-unknown ids returned `{mode:"success"}` instead of `{mode:"unconfigured"}` — the client could not tell the two apart | Moved the filter after both gates. Both existing tests still pin their behavior; the previously untested combination now reports correctly. |
| D6 | `route/classify` | No route test existed | Added `route.test.ts` — 7 cases, including one that pins D1 (`fetchMock` is never called when `DEMO_PASSCODE` is set and the passcode is absent or wrong). |

## Intentional — documented, not changed

| # | Route(s) | Divergence | Why it stays |
|---|---|---|---|
| I1 | `route/classify` | Returns `{kind:"coach", confidence:0}` at every gate instead of an error envelope | By design: the route "fails closed to `coach` on any error, timeout, or missing model — safety never depends on this call." An error envelope would give the composer something to handle; the point is that it has nothing to handle. |
| I2 | `realtime/token` | Uses `{mode:"mock", reason}` where others use `{mode:"unconfigured"}` | It has a real mock voice path (Web Speech) to fall back to; `reason` distinguishes `provider_mock` / `no_api_key` / `locked` for the hardware-check flow. |
| I3 | `screening/extract` | Extra `SCREENING_LIVE_EXTRACT !== "1"` gate ahead of the provider check | Deliberate additive gate so the clinical extractor stays deterministic even on a deploy with a live provider configured for coach/food. |
| I4 | `route/classify` | 4s timeout vs 15s elsewhere | It sits in the interactive composer path and the client aborts at 4.5s; a 15s server timeout would outlive its own caller. |
| I5 | `realtime/token` | 10s timeout | Session mint is a handshake, not a completion. |
| I6 | `family/*` | Off-shape reply returns **200** `{mode:"success", data:null}` rather than 502 | Deliberate contract: the client falls back to deterministic ordering. `recommend` additionally logs the rejected zod field paths (never model text or caregiver words) so a broken contract cannot hide silently. |
| I7 | `family/*` | zod `.strict()` body parsing vs permissive casts | The family routes accept a structured child profile; the others accept free text with length clamps. Strict parsing is the stronger choice and the divergence runs in the safe direction. |

## Open findings — not fixed, owner call

1. **The crisis gate is client-attested on exactly one route.** `realtime/token` checks
   `body.crisisOpen` and 409s; the other six have no crisis check at all. This is consistent with the
   design (the front-door router holds the gate client-side, and the token route documents its check
   as "an attestation, not a server-verified guarantee"), but it means **no server-side route
   independently refuses to serve during an open crisis**. Worth an explicit decision rather than
   leaving it as an artifact of which route happened to get the check.
2. **`screening/extract` still has no route test** — the route that reads clinical grades off a
   printed sheet. Its `JSON.parse(content)` at line 99 sits inside the try block, so a malformed
   completion returns `extract_request_error` rather than the `off_shape_completion` message that
   was clearly intended for it. Behaviorally safe, misleading to debug.
3. **The `?k=` passcode read is duplicated across 7 call sites** with no shared helper. That
   duplication is the same class of rot this audit exists to catch — the classify client was simply
   the one that never got the line. A `readDemoPasscode()` helper would close it; deliberately left
   out of this pass to keep the commit drift-only.

## Verification

`npx vitest run src/app/api` — 6 files, 63 tests, all passing. Full `npm run check` and
`npm run crisis:gate` results recorded in the commit.
