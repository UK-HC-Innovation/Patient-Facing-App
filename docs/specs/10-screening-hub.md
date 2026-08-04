# Screening Hub — High-Yield Questionnaire Delivery Engine (Demo)

**Status:** implemented — 21 instruments + `registry.ts` in `src/domain/instruments/`, surfaced at `/checkin` and `/checkin/[instrumentId]`. SWYC electronic-administration agreement (TEAM UP Center) still pending. Verified 2026-08-04.

> One engine, many instruments. The app already proves it can deliver a validated questionnaire safely (PHQ-9 at `/checkin`, with item-9 crisis routing) — but every questionnaire so far is a **hand-rolled one-off** (PHQ-9, the 5-item social screen, the 8-item family screen are three divergent implementations of the same idea). The Screening Hub generalizes that proof into a **registry-driven screening engine**: instruments are data (bilingual items, scorer, bands, crisis rules, recurrence, eligibility), one generic runner renders them, and one widened `AssessmentEvent` records them. On top of the engine we ship the **highest-yield public-health screenings** a patient-facing Kentucky safety-net app can legally embed: a 2-minute front-door battery (PHQ-2 + GAD-2 + Hunger Vital Sign + tobacco + NIDA single question) with conditional expansion, KY-critical eligibility modules (lung LDCT — KY is #1 in the nation in lung cancer incidence AND mortality; colorectal — top-5; prediabetes for family members), a perinatal depression pathway, and caregiver-completed child/teen screenings (SWYC milestones + POSI, PSC-17, PHQ-A) that plug into the Family Navigator.
>
> **Demo posture (explicit scope decisions, 2026-07-20):** localStorage only, no server persistence, no real SMS, no provider dashboard. Instruments ship only if their license permits digital embedding in a non-commercial demo — permission-gated instruments (EPDS, M-CHAT-R/F, CRAFFT, Mini-Cog, PROMIS) get named registry slots but are NOT built until a permission letter exists. IPV screening is deliberately deferred (safe-UX prerequisites documented below). No new crisis pathway: every suicide-item positive lands on the existing, tested crisis panel.

## Problem & Rationale

Most high-yield public-health screenings never happen. The bottleneck is not clinical knowledge — USPSTF grades, cutoffs, and referral pathways are settled — it is **delivery**: nobody hands the patient the questionnaire at the right moment, in their language, with a safe place for the answer to land. That is precisely the gap a patient-owned app fills.

The yield calculus (impact × underscreening × access gap) is unusually extreme in Kentucky:

- **Lung cancer:** KY leads the US in both incidence and mortality (~1.5–2× national); LDCT uptake among eligible adults is under ~20%. A 4-item eligibility check behind a 1-item tobacco question is the single highest-mortality-impact module available to this app.
- **Colorectal cancer:** KY is top-5 in incidence, and KY's own history proves screening outreach works (the Kentucky Cancer Consortium push moved KY from ~49th to top-20 in screening rates). FIT-first outreach maps directly onto the DR nudge→book→recall loop we already built.
- **Depression/anxiety:** KY adult depression prevalence is among the highest in the US; rural KY is a severe mental-health HPSA. Depression halves diabetes self-care adherence. PHQ-2+GAD-2 is a 4-item, public-domain front door, and our crisis gate already exists to receive item-9 positives.
- **Perinatal depression:** ~1 in 7 birthing parents; the top complication of childbirth; USPSTF grade B. KY's postpartum Medicaid population is heavily under-screened. (The famous instrument, EPDS, is licensing-blocked for app embedding — PHQ-9 is the USPSTF-acceptable public-domain path; see Licensing.)
- **Developmental pediatrics:** the 0–3 early-intervention window is unforgiving and rural KY has long diagnostic waitlists. One free instrument (SWYC, Tufts) covers milestones + autism (POSI) + behavior, and the Family Navigator already knows the child's age and can route positives to KY First Steps.
- **Substance use / food insecurity:** KY is top-5 in overdose deaths; eastern-KY food insecurity (~15–20%) plus insulin is one of the most dangerous invisible combinations in safety-net diabetes care. Both screens are 1–2 public-domain items.

Three hand-rolled questionnaires and a fourth about to be written is the strongest generalization signal in the codebase. Build the engine once; after that, adding an instrument is a data file plus tests.

## Target Users

- **The index patient** (adult, diabetes-centered, en/es): the 2-minute check, DDS-2, AUDIT-C, eligibility modules, STEADI at 65+.
- **The postpartum caregiver** (via Family Navigator context): perinatal depression pathway anchored to the infant's age.
- **The caregiver answering about a child** (Family Navigator households): SWYC, PSC-17; PHQ-A for teens (self-report, handed to the teen).
- **Family members of the index patient:** CDC Prediabetes Risk Test — first-degree relatives are the highest-risk unscreened population reachable at zero acquisition cost.

## Goals & Non-Goals

**Goals**

- One registry-driven engine: adding instrument N+1 is a domain data file + tests, no new UI or storage code.
- Ship the legally-embeddable high-yield catalog (tiers below) with exact validated thresholds and honest, non-diagnostic result language.
- Every suicide/self-harm item converges on the **existing** crisis panel and `crisis_escalated` audit seam — zero new crisis pathways.
- Due-ness is derived, not scheduled: per-instrument recurrence + eligibility computed at render time, surfaced as quiet Today chips and Family Navigator stages.
- Results become provider-legible: a `screeningsSection` in the Health Brief with `patient_reported` provenance.

**Non-Goals**

- **Not a diagnosis tool.** Scores render with band language + "not a diagnosis" copy (the `severityBandSummary` idiom); Z-code-style suggestions stay `needs_review`.
- **Not an IPV screen (yet).** HARK / AHC-HRSN safety block / SWYC Family Questions are deferred until the safe-UX prerequisites exist: privacy pre-check ("Are you somewhere you can answer safely?"), quick-exit control, exclusion from every caregiver/family-visible surface, no notification content, no itemized persistence. The social screen deliberately excluded IPV items (file-head comment in `src/domain/social-screen.ts`); we keep that line until the prerequisites are built as their own sprint.
- **Not an ACEs screen.** PEARLS raises mandatory-reporter and score-determinism issues that a self-serve demo cannot handle responsibly.
- **Not a license violation.** EPDS (RCPsych written permission), M-CHAT-R/F (Robins electronic-use permission), CRAFFT (Boston Children's written approval), Mini-Cog (Borson permission + drawing capture), PROMIS (HealthMeasures tech-integration license), ASQ-3/PEDS (paid) are named, empty registry slots — not built.
- **No free-text input anywhere in the engine.** Structured choices and numbers only; therefore no LLM calls, no grounding surface, no new crisis-classifier rules needed.
- No server persistence, no real SMS, no provider dashboard, no gamification, no new npm dependencies.

## The Instrument Catalog (tiered; licensing verified 2026-07-20)

**Tier 0 — the 2-minute check (front-door battery, ~10 items; conditional expansion only on positives):**

| Instrument | Items | Positive rule | Expansion / action | License |
|---|---|---|---|---|
| PHQ-2 | 2 | ≥3 | → PHQ-9 | Public domain (Pfizer/phqscreeners) |
| GAD-2 | 2 | ≥3 | → GAD-7 | Public domain |
| Hunger Vital Sign | 2 | either item "often"/"sometimes" | → `/support` resources + insulin-hypoglycemia note | Free w/ attribution (Children's HealthWatch) |
| Tobacco use (BRFSS wording) | 1–2 | current use | → Quit Now Kentucky 1-800-QUIT-NOW; current OR former use unlocks lung module | Public domain (CDC) |
| NIDA single-question drug screen | 1 | ≥1 time past year | → care-team conversation card (+ privacy note) | Public domain (NIDA/NIH) |

**Tier 1 — expansions & adult mental health:** PHQ-9 (0–27; bands 5/10/15/20; **item 9 any nonzero → crisis panel regardless of total**), GAD-7 (5/10/15), AUDIT-C (≥4 M / ≥3 F; 10–12 adds a do-not-stop-abruptly withdrawal warning — a deliberately conservative house band, not an author-validated cutoff), DDS-2 diabetes distress (mean ≥3 → distress support content, explicitly distinct from depression).

**Tier 2 — KY eligibility modules (lung/CRC wording is homegrown operationalization of USPSTF criteria; the Prediabetes Risk Test and STEADI are CDC-distributed instruments, freely reproducible as US-government works with CDC/ADA attribution):** Lung LDCT eligibility (age 50–80 AND ≥20 pack-years AND current-or-quit-within-15y; app computes pack-years, never asks for them; symptom disclosures route to "contact your clinician now", not screening); CRC eligibility (45–75, no colonoscopy in 10y / FIT in 1y / no other recent modality such as stool-DNA in 3y; red-flag symptoms or first-degree family history → clinician-now, never FIT); CDC Prediabetes Risk Test (7 items, ≥5 of 10 high risk → NDPP referral content; BMI computed from height/weight); STEADI falls (65+; 3 key questions + conditional injury follow-up; any yes → at-risk card; fall-with-injury → urgent copy).

**Tier 3 — child, teen, perinatal (caregiver/teen audience, Family Navigator-aware):** Perinatal depression pathway = PHQ-2→PHQ-9 with perinatal framing copy around the unmodified instruments, cadence anchored to infant age (1/2/4/6-month checkpoints at month granularity; AAP Bright Futures alignment); SWYC Developmental Milestones + POSI at the 18mo and 30mo forms (free and unmodifiable; **the current steward is the TEAM UP Center — Tufts pages redirect there — and electronic administration requires contacting them**, so SWYC ships as a license-pending demo preview, excluded from nudges, until the no-cost agreement lands; we ship Milestones + POSI only because the Family Questions component contains IPV items that hit the deferred-IPV line; POSI offered from both age forms — it is validated 16–35 months); PSC-17 (public domain; ≥15 total OR any official subscale positive: internalizing items 2,6,9,11,15 ≥5, attention items 1,3,7,13,17 ≥7, externalizing items 4,5,8,10,12,14,16 ≥7 → discuss-with-clinician card); PHQ-A (public domain 13-item "PHQ-9 Modified for Adolescents": 9 scored items with the PHQ-9 bands, **item 9 = same crisis rule as PHQ-9**, plus 4 unscored supplemental items of which the past-month suicidal-ideation and lifetime-attempt items also route to the crisis panel — never render the official form with unwired suicide items).

**Deferred (named slots, not built):** EPDS, M-CHAT-R/F (POSI substitutes), CRAFFT, SCARED (free but 41 items — catalog-only for demo), Mini-Cog, PROMIS Global-10, HARK, AHC-HRSN, PEARLS. Rationale per instrument lives in the plan's non-goals.

**Wording integrity rule:** every instrument carries `wordingVerified: boolean`. Instruments whose verbatim item text the implementing agent cannot guarantee from authoritative sources ship `false` and render a visible "Draft wording — verify against the official form before clinical use" badge until a human verifies against the official PDF and flips the flag. Never paraphrase a validated instrument silently.

## How It Builds on Existing Primitives (ground truth, verified 2026-07-20 at eccdcd8)

- **PHQ-9 is the template.** `src/domain/assessment.ts` already models bilingual items (`{ id, en, es }`), shared response options, consent copy, pure scoring (`scorePhq9`), non-diagnostic band summaries, and the item-9 crisis predicate (`phq9Item9IsPositive` — any nonzero). `src/app/checkin/page.tsx` shows the full safe delivery loop: consent → items → score → `addAssessmentEvent` (+ `assessment_recorded` audit) → crisis panel + dispatched crisis `AiMessage` (`safety: "crisis"`, `CRISIS_ACTIONS`) when item 9 is positive.
- **The sharpest landmine is storage.** `isAssessmentEvent` in `src/state/storage.ts` (~line 328) is hardcoded to `instrumentId === "phq9"` and 0–3 responses, and `isValidCoreAppState` (~line 1004) runs `assessmentEvents.every(isAssessmentEvent)` BEFORE any sanitization — **any second instrument persisted today hard-resets the ENTIRE state to demo on reload.** Widening the type and guard registry-driven, moving the per-row check out of core validity so bad rows are filtered instead of nuking state, in the same commit as a regression test proving a pre-existing phq9 blob still loads, is the engine's first job.
- **Recurrence machinery exists.** `src/domain/tasks.ts` (`isCheckinDue`, 14-day cadence; 60-day quiet recall window) is the de facto scheduler — derivation-only, no cron. The engine generalizes this into per-instrument `recurrenceDays`.
- **Nudge machinery exists.** `src/domain/nudge-template.ts` renders only approved templates with a prohibited-term lint; `src/domain/family-stages.ts` derives now/next/later stages from the family profile's birth month (one child, month granularity). Screening invitations become two new approved templates (`checkin_nudge_v1`, `perinatal_check_nudge_v1`) + new stage rules — no new outreach machinery.
- **The crisis seam exists.** `classifyCrisis`/`classifySafety`/`screenSocialEmergency` (front door), the fixed `tSafety` crisis copy, `CRISIS_ACTIONS`, and the `crisis_escalated` audit path are all live and gate-tested (183 corpus cases at the 2026-07-19 gate run, since grown; recall 1.00, zero FP — `docs/ops/red-team-results/2026-07-19-crisis-gate.md`). The engine adds **no free-text surface**, so its only crisis obligations are: structured crisis items reuse the checkin pattern verbatim through one shared result seam, and new front-door route entries must not swallow crisis utterances (`front-door.ts:132` precedence handles this automatically; `crisis:gate` must stay green).
- **Resource routing exists.** `findKentuckyResources` (`src/domain/sdoh-resources.ts`) receives Hunger Vital Sign positives; Family Navigator's verified KY catalog receives SWYC/First Steps referrals.
- **Health Brief composition exists.** `buildHealthBrief` (`src/domain/health-brief.ts`) composes nullable provenance-labeled sections; `screeningsSection` follows `eyeScreeningSection`'s lens-reuse precedent.
- **i18n reality check:** all instrument content ships inline `{ en, es }` per the house pattern. The es `LanguageToggle` exists only on unmerged branch `claude/fervent-joliot-ffd33f` — on master, es renders only via persisted profile language. Spanish demo requires merging that branch or using the demo fixture; not this sprint's problem, but the parity tests are.

## Key User Flows

**Flow 1 — The 2-minute check.** `/checkin` hub shows "Quick health check — about 2 minutes." → consent → PHQ-2, GAD-2, HVS, tobacco, NIDA items with progress ("3 of 5 short checks") → all negative: honest all-clear ("Nothing you reported needs follow-up today. This is a check-in, not a diagnosis.") → any positive: the relevant expansion or action card, one at a time, never a wall of forms. Each completed instrument records its own `AssessmentEvent`.

**Flow 2 — Suicide-item positive (LOCKED).** PHQ-9 or PHQ-A item 9 > 0 → event still records → crisis `AiMessage` dispatched (audits `crisis_escalated`) → results screen replaces the severity summary with the existing crisis panel (988 call/text, 911, safety plan). Identical to today's `/checkin` behavior; the engine makes it declarative (`crisisOnPositive` on registry items) without changing what the patient sees.

**Flow 3 — Tobacco → lung eligibility.** Tobacco item = "every day" → Quit Now Kentucky card + "One more thing — 4 quick questions could tell you if a free lung scan is recommended for you." → packs/day + years smoked (+ quit year if former) → pack-years computed → eligible: LDCT recommendation card with shared-decision framing + "Add to visit prep" (Health Brief line). Symptom disclosure (coughing blood, unexplained weight loss) → "This changes the advice: contact your clinic now" — no screening scheduling.

**Flow 4 — Caregiver answers about a child.** Family Navigator stage says "18-month check-up window: a development check is due." → `/checkin/swyc_18mo` in caregiver voice ("Answer about your child") → milestones + POSI → below-cutoff or POSI ≥3: "Worth a conversation — here's how KY First Steps works" referral card (urgent-not-emergent framing) → brief line for the pediatric visit.

**Flow 5 — Postpartum checkpoint.** Family slice contains an infant → at 1/2/4/6 months a stage nudge invites the caregiver: perinatal-framed PHQ-2 → expansion to PHQ-9 on ≥3 → item-9 rule as Flow 2; band ≥10 adds "talk to your OB or pediatrician — they expect this conversation" copy.

## Data Model (widened `assessmentEvents` + instrument registry)

```ts
// src/domain/instruments/types.ts — the cross-cutting contract (exact TS in plan 12)
export type InstrumentId = string; // registry-validated; see INSTRUMENTS
export type ItemKind = "choice" | "number";
export type InstrumentItem = {
  id: string;
  kind: ItemKind;
  en: string; es: string;
  options?: ResponseOption[];   // choice items; omitted = instrument default options
  min?: number; max?: number;   // number items (packs/day, years, height, weight)
  crisisOnPositive?: boolean;   // any value > 0 → crisis flow (PHQ-9/PHQ-A item 9)
  conditionalOn?: { itemId: string; atLeast: number }; // conditional item (quit year, injury follow-up)
  notApplicableValue?: number;  // sentinel pre-filled when the condition is unmet — stored arrays stay fixed-length
};
export type ScreeningOutcome = { totalScore: number; band: string }; // bands per instrument, incl. "eligible" / "not_eligible" / "positive" / "see_clinician_now"
export type ScreeningInstrument = {
  id: InstrumentId;
  title: { en: string; es: string };
  audience: "self" | "caregiver";
  tier: 0 | 1 | 2 | 3;
  items: InstrumentItem[];
  defaultOptions?: ResponseOption[];
  score: (responses: number[]) => ScreeningOutcome;   // pure; reverse-scoring inside
  bands: string[];                                     // storage guard checks band ∈ bands
  bandSummaries: Record<string, { en: string; es: string }>; // non-diagnostic copy
  consent: ConsentCopy;
  recurrenceDays?: number;
  followUp?: { minScore: number; instrumentId: InstrumentId }; // PHQ-2→PHQ-9 chaining
  wordingVerified: boolean;
  licenseStatus: "clear" | "pending";                  // pending → demo-preview banner, excluded from nudges
  attribution: string;                                 // rendered under the form
};
```

`AssessmentEvent.instrumentId` widens from the literal `"phq9"` to registry-validated `InstrumentId`; `severityBand` widens to `string` validated against the instrument's `bands`. **Storage:** `isAssessmentEvent`/`sanitizeAssessmentEvents` become registry-driven (unknown instrumentId → row filtered, never reset-to-demo); missing-array defaulting unchanged; a regression test proves a pre-sprint phq9 blob loads intact. No new AppState arrays; no new audit verbs (`assessment_recorded` covers all instruments, label from registry title).

## Safety, Scope & Liability

- Crisis rules are structural, not textual: `crisisOnPositive` items reuse the existing crisis panel, fixed `tSafety` copy, `CRISIS_ACTIONS`, and `crisis_escalated` audit — verbatim the `/checkin` pattern. No model-generated crisis copy; no new pathway; `crisis:gate` green is a hard acceptance bar.
- AUDIT-C 10–12 renders the medically-supervised-withdrawal warning (never "stop drinking now"). Lung/CRC red-flag symptoms route to clinician-now bands. STEADI fall-with-injury renders urgent copy.
- Result language is band summaries + "not a diagnosis" suffixes throughout; eligibility modules recommend a conversation, never order a test.
- Declines and skips are respected: the battery is abandonable at any item; partial batteries record only completed instruments.
- NIDA/AUDIT-C screens carry a privacy note (locked copy in plan 12: "Your answers stay on this device. You choose if and when to share them.") — disclosure fear is the main false-negative driver.
- **Stepped-screening note:** the tier-0 battery administers item 9 only when PHQ-2 ≥ 3 or in a direct PHQ-9 run — stepped screening per USPSTF practice, but a real sensitivity change vs today's always-full PHQ-9 at `/checkin`. Mitigation: the standalone PHQ-9 stays due every 14 days and its chip takes priority over the battery chip when both are due.

## Functional Requirements

- **FR-1** Instrument registry `src/domain/instruments/`: one data file per instrument exporting a `ScreeningInstrument`; `INSTRUMENTS: Record<InstrumentId, ScreeningInstrument>`; every registered instrument has en/es parity and a vitest suite locking items, thresholds, and band copy verbatim.
- **FR-2** `AssessmentEvent` widened + registry-driven storage guards + pre-sprint-blob regression test, all in one commit (house atomic rule).
- **FR-3** Generic runner `src/components/instrument-runner.tsx`: consent → items (fieldset/legend radios or number inputs, 48px targets, sr-only labels) → outcome; renders any registry instrument; progress for batteries; `wordingVerified:false` badge.
- **FR-4** Crisis items: any `crisisOnPositive` response > 0 → record event, dispatch crisis `AiMessage`, render crisis panel — behavior-identical to current `/checkin`, implemented in ONE shared result component that every completing surface (`/checkin/[id]`, `/checkin/quick`, `/checkin/perinatal`) renders through; a crisis positive mid-battery terminates the battery into the crisis panel with all other action cards suppressed. RTL crisis tests exist for the standalone, battery, and perinatal surfaces.
- **FR-5** `/checkin` becomes the hub (due-now, quick-check, family, more); `/checkin/[instrumentId]` runs one instrument; existing PHQ-9 e2e, tasks.ts href, and front-door entries updated in the same phase.
- **FR-6** Tier-0 battery as a composite runner chaining 5 instruments with per-instrument events and conditional follow-up chaining (`followUp` rule).
- **FR-7** Eligibility modules compute derived values (pack-years, BMI) from raw inputs — the app never asks for a derived value.
- **FR-8 (P3)** Perinatal cadence: pure date-math checkpoints (1/2/4/6mo) at month granularity off the single family profile's `birthYear`+`birthMonth` (no checkpoints when `birthMonth` is absent, mirroring the year-only degradation in `family-stages.ts`), surfaced via `buildFamilyStages`-pattern stages + the `perinatal_check_nudge_v1` template; instruments unmodified, framing copy separate.
- **FR-9 (P4)** SWYC 18mo/30mo Milestones + POSI (both forms) with verbatim items, attribution line, `wordingVerified` gate AND `licenseStatus: "pending"` demo-preview banner until the TEAM UP Center electronic-use agreement lands, First Steps referral card on positive.
- **FR-10 (P5)** Due engine: per-instrument `recurrenceDays` + last-event derivation feeding `buildTodayTasks` (quiet, max-3-chips discipline preserved); approved nudge template `checkin_nudge_v1`; Health Brief `screeningsSection` with `patient_reported` provenance.
- **FR-11** Everything green with zero env vars; no LLM calls anywhere in the engine.

## Demo Script (the P0+P1 acceptance test)

1. Home → "Quick health check" chip → consent → answer the 5-instrument battery all-negative → honest all-clear in plain language.
2. Re-run; answer PHQ-2 = 3+ → PHQ-9 appears; set item 9 > 0 → crisis panel with 988 call/text (identical to today's `/checkin` crisis surface); audit trail shows `assessment_recorded` + `crisis_escalated`.
3. Re-run; tobacco = "every day" → Quit Now Kentucky card → lung module → 30 pack-years, age 62 → "a yearly low-dose CT scan is recommended for people like you" card → line appears in the Health Brief (P5).
4. Switch demo fixture to es → same flows in Spanish.
5. Reload the browser → all events survive (storage regression proven live).

## Success Criteria (demo-grade)

- `npm run check` (lint + vitest + build) green with zero env vars; `npm run crisis:gate` green (recall 1.00, zero FP — unchanged corpus); `npm run test:e2e` green including the updated `/checkin` crisis e2e.
- A pre-sprint localStorage blob loads without reset; a phq9 event recorded before the sprint renders in the hub's history.
- Every shipped instrument's thresholds match this spec's tables verbatim (tests lock them).
- No instrument with `wordingVerified:false` renders without its badge; no `licenseStatus:"pending"` instrument renders without its banner or appears in nudges.

## Phasing

**P0 — the engine (thin, shippable, safety-complete).** Registry types + PHQ-9 ported as the first registry instrument, widened storage atomically, generic runner, hub conversion, crisis behavior identical, all tests green.
**P1 — the 2-minute check.** Tier-0 battery + PHQ-9/GAD-7 expansion + result routing.
**P2 — KY eligibility modules.** Lung, CRC, prediabetes, AUDIT-C, DDS-2, STEADI-3.
**P3 — perinatal pathway.** Checkpoint stages + perinatal framing.
**P4 — child & teen.** SWYC 18/30mo, PSC-17, PHQ-A, caregiver runner voice, First Steps routing.
**P5 — surfacing.** Due chips, nudge template, Health Brief section, front-door/menu registration, e2e golden path.

## Open Questions & Risks

- **EPDS permission.** The perinatal pathway is USPSTF-compliant on PHQ-9, but EPDS is the standard of care; requesting RCPsych permission is cheap and could land before a real deployment. (Owner call; registry slot reserved either way.)
- **ASQ (NIMH suicide screener) as a second stage.** Clinically, a validated 4-item second stage behind item-9 positives beats a static panel — but it changes the crisis surface, which is gate-locked and red-teamed. Deliberately out; revisit as its own safety sprint with corpus updates. (Owner call, not cheap.)
- **SWYC electronic-use agreement + wording transcription.** SWYC's steward (the TEAM UP Center) requires contact before electronic administration — a no-cost agreement, but the same gate class as M-CHAT. P4 ships SWYC as a license-pending demo preview (banner, excluded from nudges) with `wordingVerified:false`; the owner emails the TEAM UP Center and verifies items against the official PDFs before any real use. Named acceptance steps, not silent risks. Some POSI items are multi-select on the official form — the single-select simplification, if needed, stays documented and badged.
- **Chip contention.** `/today` caps at 3 chips; screening chips are priority-ranked below crisis/referral work. Risk: screening nudges never surface in busy states — acceptable for demo, note for later.
- **DDS-2 commercial conversion.** Free non-commercial today; converts to paid if the app ever commercializes. Budget flag lives here.

---

Grounding: codebase claims verified 2026-07-20 against the working tree at `eccdcd8` (files: `src/domain/assessment.ts`, `src/app/checkin/page.tsx`, `src/components/phq9-check-in.tsx`, `src/state/storage.ts`, `src/state/store.tsx`, `src/domain/types.ts`, `src/domain/social-screen.ts`, `src/domain/family-screen.ts`, `src/domain/tasks.ts`, `src/domain/nudge-template.ts`, `src/domain/family-stages.ts`, `src/domain/health-brief.ts`, `src/domain/front-door.ts`, `src/ai/safety-gate.ts`, `src/domain/sdoh-resources.ts`, `docs/ops/red-team-results/2026-07-19-crisis-gate.md`); the `isAssessmentEvent` phq9-lock and crisis enforcement points were read directly, not inferred. Instrument scoring, USPSTF grades, and licensing terms compiled from phqscreeners.com, NIMH/NIDA/CDC/USPSTF materials, Tufts SWYC, mchatscreen.com, RCPsych EPDS terms, behavioraldiabetes.org, and NACHC PRAPARE FAQ, web-verified July 2026; re-verify permission workflows before any production launch.
