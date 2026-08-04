# Spec ↔ code coherence audit (spec 17 workstream B)

**Date:** 2026-08-04
**Scope:** specs 01–16 against the tree at `codex/security-ci-wave3` (5 commits ahead of `master`, 0 behind)
**Mode:** report-only — no code or doc was changed by this pass

## Depth statement

This is a **deliverable-level** audit: for each spec, does its headline deliverable exist, is it
wired into a surface, and does the spec's own status text match the tree. It is **not** a
clause-level audit — a spec marked clean here can still have an unimplemented sub-clause. Clause-level
verification of specs 13–16 (which carry the most detailed contracts) remains open work.

Every spec below was opened and checked. "Clean" is a checked claim, not an unread spec.

## Verdicts

| Spec | Verdict | Evidence |
|---|---|---|
| 01 Early detection & risk stratification | **Drifted (superseded)** | No `riskTier` / `stratif*` symbol exists anywhere in `src`. The capability shipped instead as the Screening Hub instrument registry (`src/domain/instruments/`, 21 instruments incl. `prediabetes-risk`, `crc-eligibility`, `lung-ldct-eligibility`, `steadi3`). The spec still describes an architecture that was replaced. |
| 02 Between-visit monitoring | Clean | `src/domain/blood-pressure.ts` + `/numbers` |
| 03 SDOH & resource connection | Clean | `src/domain/coverage-logistics.ts`, `instruments/hunger-vital-sign.ts`, `/support` |
| 04 Behavioral health & crisis escalation | Clean | `src/domain/crisis-red-flags.ts`, `instruments/{phq2,phq9,phq-a,gad2,gad7}`, `/checkin` |
| 05 Chronic loops + deprescribing & cost transparency | **Drifted (partial)** | Chronic loops shipped (`adherence.ts`, `adherence-support.ts`, `/medicines`). **Deprescribing and cost transparency did not** — no `deprescrib*` or `cost*Transparency` symbol exists. Cost surfaced narrowly through `coverage-logistics.ts` and `medication-fills.ts` instead. The spec title still promises both. |
| 06 Care coordination | Clean | `src/domain/care-team-message.ts`, `/visits` |
| 07 Access equity (voice, multilingual, low-literacy) | Clean | `src/voice/*` (9 modules), `src/i18n/*`, `src/domain/accessibility.ts` |
| 08 Diabetes first-class | Clean | `src/domain/blood-glucose.ts`, `/glucose` |
| 09 Family Navigator | Clean | `/ladder`, `src/domain/family-*` |
| 10 Screening Hub | **Stale doc** | Fully built — `src/domain/instruments/registry.ts` + 21 instruments + `/checkin/[instrumentId]`. The spec carries no status header, and project memory still records it as "UNCOMMITTED awaiting Codex" (2026-07-20). |
| 11 Rank-and-justify | Clean | `/api/family/recommend`, `src/ai/family-rank-prompt.ts`, `src/domain/family-rank.ts` |
| 12 Voice-first infrastructure | **Stale doc — materially** | **P0–P6 are built and wired.** See the phase table below. Spec 12 reads as a forward-looking plan; project memory records "P0–P7 build not started"; spec 17 §D was written on that premise and is wrong. |
| 13 Ladder waitlist companion | Clean | Status text matches; `family-journal.tsx`, `family-checkin.tsx`, `family-appointment-card.tsx` present |
| 14 Ladder narrative integrity (Wave 1) | Clean | Status text matches |
| 15 Ladder Wave 2 | Clean | Status text matches |
| 16 Ladder Wave 3 | Clean | Status text matches; validation report present |

## Finding 1 (material): spec 12 is built, not pending

Every phase artifact exists **and is wired to a surface**:

| Phase | Deliverable | Evidence |
|---|---|---|
| P0 | `useDictation`, TTS util, indicator, consent, `tVoice`, language toggle | `src/voice/{use-dictation,tts,voice-indicator,voice-consent}.ts*`, `src/i18n/voice-strings.ts`, `src/components/language-toggle.tsx` (wired in `/today`, `/privacy`, `src/state/store.tsx`) |
| P1 | Family interview voice-complete | `src/components/family-follow-up-turn.tsx` uses dictation + read-aloud |
| P2 | Front-door spoken echo-confirm + spoken `clarify` | `src/components/home-composer.tsx:184` speaks `tVoice(..., "takingYouTo", ...)`; `clarify` handled at `:147`, `:197`, `:244` |
| P2.5 | `<ReadAloud>` | Wired in `/plan`, `conversation-panel`, `health-brief-card`, `phq9-check-in`, `retinopathy-learn` |
| P3 | Voice capture + number parser | `src/voice/number-parse.ts`, `voice-capture-card.tsx` wired in `/glucose` and `/numbers` |
| P4 | Talk-to-draft `DraftPanel` | `src/voice/draft-panel.tsx` wired in `/plan` |
| P5 | `/chat` live voice | `src/hooks/use-chat-voice-session.ts` |
| P6 | Verification + fix the stale `food-lens-demo.md` "gate deferred" note | Note is fixed — the doc now reads "The voice safety gate is active" |

**Consequence:** spec 17 workstream D ("execute the already-designed P0–P7 voice build") has no build to
execute. It should be re-scoped to a verification-and-gap pass, or dropped. The one item this audit
could not confirm from the tree is the real-phone hardware pass that spec 12 P5 leaves explicitly
pending — that remains genuinely open and needs a device, not a code change.

## Finding 2 (material): the Ladder's safety entry point is outside the crisis gate

`src/domain/family-safety.ts` documents itself as *"The one safety read for the family thread"* and is
imported by `family-crisis-banner.tsx`, `family-experience.tsx`, `family-interview.tsx`,
`family-orientation-interview.tsx`, `family-journey.ts`, and `family-vignette-runner.ts`.

- It has **no test file**.
- `screenFamilySafety` appears in **zero** test files anywhere in `src`.
- `scripts/crisis-gate.mjs` runs six suites — `crisis-red-flags`, `safety-gate`, `front-door`,
  `safety`, `voice-gate-corpus`, `output-guard`. **None of them covers `family-safety.ts`.**

The classifiers it composes (`classifyCrisis`, `classifySafety`, `screenSocialEmergency`) *are* gated.
What is ungated is the composition: the crisis→tier mapping, `createFamilySafetyEvent`,
`pendingFamilySafetyEvent`, and `domainsAfterSafety`. A regression in the tier mapping — sending a
`crisis` disclosure down the `emergency` branch or vice versa — would pass `npm run crisis:gate`.

For an app whose CI gate is its central safety claim, a safety module the gate does not see is the
highest-severity structural finding in this report.

## Finding 3: fifteen of ninety domain/ai modules have no test file

```
src/domain/audit.ts                    src/ai/coach-provider.ts
src/domain/family-safety.ts            src/ai/coach-voice-instructions.ts
src/domain/family-vignette-runner.ts   src/ai/family-rank-prompt.ts
src/domain/food-seed.ts                src/ai/family-recommend-provider.ts
src/domain/types.ts                    src/ai/local-coach-session.ts
src/state/selectors.ts                 src/ai/route-classifier-client.ts
                                       src/ai/screening-extract-provider.ts
                                       src/ai/types.ts
                                       src/ai/voice-safety-identifier.ts
```

Most are type-only or thin prompt builders and are fine. Three are not:
`family-safety.ts` (Finding 2), `screening-extract-provider.ts` (parses clinical DR grades — its route
also has no test, per workstream C), and `voice-safety-identifier.ts` (now on all seven provider
routes after workstream C; only indirectly asserted through route tests).

## Finding 4: specs 01–07 and 09–12 carry no status header

Specs 08 and 13–16 open with a `**Status:**` line. Specs 01–07 and 09–12 do not, so the document
cannot tell a reader whether it describes shipped behavior or an intention. That is the mechanism
behind Findings 1 and the spec-10 row: two fully-built specs read as pending because nothing in the
document says otherwise. A one-line status header on each is the cheapest fix in this report.

## In-tree vs deployed

All findings above are **in-tree** on `codex/security-ci-wave3`. That branch is 5 commits ahead of
`master` and 0 behind. Deployment state was not verified against the live URL and is out of scope for
a report-only pass — note that this repo has no GitHub auto-deploy, so `master` being current does not
imply production is current.

## Recommended order

1. Finding 2 — put `family-safety.ts` under test and add it to `scripts/crisis-gate.mjs`.
2. Finding 1 — re-scope spec 17 §D and correct the project-memory entry for spec 12.
3. Finding 4 — add status headers to specs 01–07, 09–12.
4. Findings 1/5 doc drift — mark spec 01 superseded by spec 10; correct spec 05's scope to what shipped.
5. Finding 3 — tests for `screening-extract-provider.ts` and `voice-safety-identifier.ts`.
