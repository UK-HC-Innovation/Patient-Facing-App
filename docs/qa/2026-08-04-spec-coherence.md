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
| 12 Voice-first infrastructure | **Clean — the audit was wrong first time** | P0–P7 are built, and **the spec says so itself**: a lifecycle blockquote at line 3 records "software complete", `1b17ef0` on 2026-07-20, production `4cbe8c7` on 2026-07-21, and "must not be re-executed." The first pass of this audit mislabelled it "stale doc" because the status grep only looked for a `**Status:**` marker. See Finding 1. |
| 13 Ladder waitlist companion | Clean | Status text matches; `family-journal.tsx`, `family-checkin.tsx`, `family-appointment-card.tsx` present |
| 14 Ladder narrative integrity (Wave 1) | Clean | Status text matches |
| 15 Ladder Wave 2 | Clean | Status text matches |
| 16 Ladder Wave 3 | Clean | Status text matches; validation report present |

## Finding 1 (material): spec 17 §D was authored from stale memory — spec 12 was never wrong

**Corrected 2026-08-04, after the first version of this report got it backwards.** The first pass
called spec 12 a stale doc. It is not. Line 3 of the spec is a lifecycle blockquote reading
*"software complete, external validation pending… landed in `1b17ef0` on 2026-07-20 and shipped in
production `4cbe8c7` on 2026-07-21… This brief preserves the pre-build architecture and must not be
re-executed."* That is accurate, current, and explicitly warns against exactly the mistake spec 17 §D
made.

The real defect was upstream of the repo: a project-memory entry still said "P0–P7 build not
started," spec 17 §D was written from that memory without opening spec 12's header, and this audit's
first pass then compounded it by grepping only for a literal `**Status:**` marker — which spec 12
does not use. Three layers of not reading the document.

The build is real either way; the phase-by-phase verification below stands:

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

**Consequence:** spec 17 workstream D ("execute the already-designed P0–P7 voice build") has no build
to execute and has been re-scoped. Spec 12's own lifecycle note already names what is left, and it is
not code: real-device mic, WebRTC, echo-cancellation and TTS checks are unrecorded, and clinical/legal
review plus a BAA-backed production voice posture remain external release gates. None of those can be
closed by an agent.

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

Specs 08 and 13–16 opened with a `**Status:**` line; specs 01–07 and 09–11 had none, so the document
could not tell a reader whether it described shipped behavior or an intention. Spec 12 is the
instructive case: it *did* record its status, but as a `> **Lifecycle —` blockquote rather than the
`**Status:**` marker, and a status sweep that greps for one marker silently misses the other. That
inconsistency is what let this audit's first pass mislabel a correct document.

**Fixed 2026-08-04:** a `**Status:**` line was added to specs 01–07 and 09–11. Spec 12 was left alone —
its lifecycle blockquote is more informative than a one-liner would be. The lesson for future sweeps
is to read the head of each spec rather than grep for a single marker.

## In-tree vs deployed

Findings above were read from the tree on `codex/security-ci-wave3`. Deployment state was **not**
verified against the live URL and is out of scope for a report-only pass — this repo has no GitHub
auto-deploy, so `master` being current does not imply production is current.

One correction to the first version of this section, which framed everything as in-tree only: spec 12
records voice as **shipped in production `4cbe8c7` on 2026-07-21**. That is the spec's own claim, not
something this audit confirmed against the live URL, but it means the voice work is not merely
in-tree. Treat any "built but undeployed" reading of spec 12 as wrong.

## Recommended order

1. Finding 2 — put `family-safety.ts` under test and add it to `scripts/crisis-gate.mjs`.
2. Finding 1 — re-scope spec 17 §D and correct the project-memory entry for spec 12.
3. Finding 4 — add status headers to specs 01–07, 09–12.
4. Findings 1/5 doc drift — mark spec 01 superseded by spec 10; correct spec 05's scope to what shipped.
5. Finding 3 — tests for `screening-extract-provider.ts` and `voice-safety-identifier.ts`.
