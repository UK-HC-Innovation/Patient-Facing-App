# Silent-Killer Early Detection & Risk Stratification

**Status:** superseded 2026-08-04. The risk-stratification architecture described here was never built under these names; the capability shipped instead as the Screening Hub instrument registry (`src/domain/instruments/`, spec 10). Kept for the clinical rationale. Verified in [the 2026-08-04 coherence audit](../qa/2026-08-04-spec-coherence.md).

> A guideline-driven screening engine that turns a patient's passive data — labs, vitals, family history, wearables — into a personalized, ranked "what to catch next" list, surfacing the asymptomatic conditions (hypertension, prediabetes, CKD, hyperlipidemia, depression, sleep apnea, osteoporosis) and validated risk scores that family medicine catches too late today. It **flags who is due and who is at elevated risk, and hands that to a clinician** — it never diagnoses, orders, or treats.

## Problem & Upstream Rationale

Family medicine is defined by the conditions that hurt patients silently for years before anyone acts. Roughly **1 in 3 U.S. adults has hypertension, and about a third of them don't know it**; an estimated **~98 million American adults have prediabetes, and the large majority are undiagnosed**; **~9 in 10 of the ~35 million with chronic kidney disease are unaware they have it** (CDC estimates; specific figures to be locked to a cited, versioned source in the seeded rule set — see Open Questions). These conditions are asymptomatic by design — they announce themselves as the first heart attack, the first stroke, the fragility fracture, the dialysis referral. By then the upstream window is gone.

The 15-minute episodic visit is structurally incapable of continuously reconciling "this patient is 54, has a first-degree relative with diabetes, a BMI of 31, and a fasting glucose from 14 months ago of 104 — the ADA risk instrument says screen now, and the last A1c is overdue." That reconciliation is exactly what USPSTF and specialty guidelines codify, and exactly what falls through the cracks between visits. The information to act usually **already exists** — in a lab result the patient forgot about, a family-history field nobody revisited, a home BP log, a wearable's resting heart rate — but it is never assembled into a decision.

"Moving care upstream" here is concrete: **compute the screening a patient is due for and the risk they carry, before symptoms exist, and put it in front of both the patient and the care team as a ranked, actionable list.** "Access they've never had" is concrete too: patients today essentially never see their own **ASCVD 10-year risk, ADA/CDC diabetes risk score, or FRAX fracture risk** — these live in clinician workflows or nowhere. This is the natural spine off the existing hypertension/diabetes work implied by the medication-adherence and Food Lens features: the app already reasons about hypertension and diet; risk stratification is the layer that decides *which silent condition to chase next*.

## Target Users

**Patients**
- **Dolores, 54, "the busy parent with a family history"** — overweight, a parent had type 2 diabetes, hasn't had labs in over a year, feels fine. Never told she is at high diabetes risk. Highest-yield persona: undiagnosed prediabetes/hypertension.
- **Marcus, 61, "the fragmented-record patient"** — already on the app's hypertension plan, but his eGFR from a hospital visit two years ago was 58 and nobody followed up on possible CKD. Data scattered across systems; the app is the only place it gets reconciled.
- **Brent, 47, "the reluctant screener"** (mirrors the existing `brentState` fixture in `src/domain/fixtures.ts`) — skips visits, distrusts "more tests," but will act on a specific, plain-language reason.
- **Rosa, 58, Spanish-preferring (`language: "es"`)** — needs the ranked list and every risk explanation localized (`en`/`es` via `src/i18n/strings.ts`), not just UI chrome.

**Physician / care team**
- **Primary care physician** — receives the per-patient "who's due / who's high-risk" output via the Health Brief; owns every clinical decision and every order.
- **Care team / MA / population-health nurse** — does the operational work: confirming imported labs, ordering the screen, closing the loop. **Patients get the nudge; the care team does the clinical work.** Note: v0.1 has **no clinician-facing surface** — the only channel to the care team is the patient-initiated, one-way `buildCareTeamMessage()` draft and the printable Health Brief. A true clinician dashboard is out of scope until P2 (see Non-Goals).

## Goals & Non-Goals

**Goals**
- Surface, per patient, a **ranked list of overdue/indicated screenings** driven by USPSTF-based cadence (age, sex, risk factors, family history).
- Compute and **show patients validated risk scores they never see today** (ASCVD 10-yr / ADA-CDC prediabetes / FRAX-style), each with a plain-language explanation, evidence labels, and an honest confidence/limitation note.
- Convert passive data into **specific, low-friction next actions** ("ask for an A1c at your next visit").
- Route every recommendation into the **existing patient→care-team message path** (`buildCareTeamMessage()`) so a clinician confirms and orders — closing the loop, not just informing.
- Improve the **rate of appropriate, on-time screening** among app users vs. their own pre-app baseline.

**Non-Goals**
- **Not a diagnosis.** The app never says "you have CKD/diabetes." It says "you are due for / at elevated risk for — here is how to get checked."
- **Not a screening-order or lab-requisition system.** It recommends and drafts a care-team message; it never places orders, generates requisitions, or bypasses the physician. Ordering is a P2 EHR-integration consideration.
- **Not a clinician dashboard in v1.** The care-team side is the existing one-way message + printable Health Brief only. A bidirectional confirm/close surface is P2.
- **Not a replacement for clinician judgment on cadence.** A clinician-authored cadence (`thresholdSource: "clinician_authored"`) always overrides the guideline default.
- **Not genetic/hereditary risk modeling** (polygenic scores, BRCA). Family history is structured self-report only.
- **Not a cancer-screening deep dive in v1** (mammography/colonoscopy/lung CT logistics). v1 is the cardiometabolic/renal/bone/mental-health cluster; cancer screening is a P2 extension of the same engine.
- **Not a wearable diagnostic.** Wearable data is a risk *input* only, never an FDA-cleared measurement, and never used to assert or rule out sleep apnea.
- **Not a fully autonomous risk display.** No risk number renders without transparent inputs, a named guideline source, and a clinician-in-the-loop route — a deliberate design constraint to stay on the non-device side of the FDA CDS line (see Open Questions).

## How It Builds on Existing Primitives

This feature extends shipped patterns; where it needs genuinely new code, this section says so plainly rather than claiming free reuse.

**Evidence model (reuse as-is).** Every recommendation and every score input carries the existing `EvidenceStatus` (`confirmed | patient_reported | imported | inferred | needs_review`) from `src/domain/types.ts`, rendered via `evidenceStatusLabel()` in `src/domain/labels.ts`. An imported lab is `imported`; self-reported family history is `patient_reported`; a computed "you're overdue" inference is `inferred` until a clinician confirms. A score built on any `needs_review`/`inferred` input must visibly say so.

**Required type changes (new, and larger than the draft implied).**
- **`PatientProfile` must gain demographics.** The shipped `PatientProfile` (`types.ts`) has **no age, date of birth, sex, or race/ethnicity** — yet every USPSTF cadence rule and all three risk scores key on age and sex (and PCE on race). This is a **P0-blocking type addition** (`dateOfBirth`/`birthYear`, `sexAtBirth`, optional `raceEthnicity` with an explicit "prefer not to say" path), rippling into every fixture (`demoState`, `brentState`, `deletedDemoState`). It is the single largest fidelity gap and must be sequenced first.
- **`Condition` union widening.** `Condition` is `"hypertension" | "diabetes" | "obesity"`. Adding `prediabetes | ckd | hyperlipidemia | depression | sleep_apnea | osteoporosis` ripples through `CarePlan.condition`, fixtures, lenses, and `selectLens()`. Contained, but every `switch` on `Condition` must handle the new members before any surface renders them.
- **`TaskItem.kind` widening.** `kind` is `"reading" | "medicine" | "visit" | "intake" | "privacy"` — there is **no `"screening"` kind today**. Adding it is a real (small) type + reducer + UI change, not a free slot-in.

**Screening/risk rule layer (new, parallel to — not inside — the nutrition lens).** `src/domain/condition-lens.ts` defines a `ConditionLens` that is specifically a *nutrition* lens (nutrient rules + med-diet rules + model guidance). The screening engine adds a **separate `ScreeningRule` / `RiskModel` module** (e.g. `src/domain/screening.ts`) — deterministic cadence logic + risk-equation coefficients — reused in list generation and in AI explanation prompts. It mirrors the "define the rule once, reuse everywhere" spirit of the lens, but it is new code, not an extension of `ConditionLens`.

**Task generation (extend `buildTodayTasks`, with a hard ranking guard).** `src/domain/tasks.ts` returns a priority-sorted `TaskItem[]` and **slices to `MAX_TODAY_TASKS = 3`**. Screening recommendations become `kind: "screening"` tasks — but because of that slice, a screening card must **never be allowed to evict a priority-1 safety/threshold task**. Screening tasks are capped at priority 2–3 and are added only after the existing urgent/threshold/barrier tasks, so the slice can only ever drop a screening item, never a safety item. This ranking invariant is a functional requirement (FR-5), not a nicety.

**The coach + safety gate (reuse for explanation; extend for new bands).** Patients will ask "why do I need this test?" — the coach's existing `why`/`explain` modes (`AiMode` in `types.ts`, inference in `src/ai/intent.ts`) handle this, routed through `createSafeAiResponse()` in `src/ai/safety-gate.ts`, which already labels evidence, refuses to diagnose, and offers `call_clinic`/`draft_message`. **What is NOT free:** `classifySafety()` in `src/domain/safety.ts` today recognizes only **blood-pressure** danger bands and physical urgent-symptom / medication-change patterns. Soft-escalating on a "markedly abnormal imported eGFR/A1c/LDL" and hard-escalating on a **self-harm/suicidality** signal both require **new classifiers and new regex/threshold sets** added to `safety.ts` — this is net-new safety code, gated behind clinical review, not reuse of what ships.

**Care-team message builder (extend, not reuse-as-is).** `src/domain/care-team-message.ts`'s `buildCareTeamMessage(state)` currently takes only `state` and emits a fixed hypertension/BP/medication template. Producing "Marcus is due for an eGFR/ACR recheck; last eGFR 58 (imported, 22 months ago)" requires **extending the builder to accept a screening/risk payload** and render an evidence-labeled screening summary. Still one-way patient→care-team, matching shipped behavior — but a real extension.

**Health brief (extend sections).** `buildHealthBrief()` (`src/domain/health-brief.ts`) assembles hardcoded sections. Add a **"Screening & Risk"** section listing due screenings and current scores with each input's `EvidenceStatus` — the clinician's confirm-and-order worklist, following the existing section+status pattern.

**State + reducer + audit (extend).** New `AppState` fields — `familyHistory`, `importedLabs`, `screeningRecommendations`, `riskScores` — in `types.ts`, with new reducer actions (`addFamilyHistory`, `importLab`, `confirmScreening`) in `src/state/store.tsx`. Each reducer case calls `recordAuditEvent()`; note `AuditEvent.action` is a **closed enum** (`created | updated | ai_generated | shared | exported | deleted`) — new events reuse those actions with descriptive labels, no enum change needed.

**Offline-first seeding (reuse pattern).** Like `food-seed.ts`, USPSTF cadence tables and risk-equation coefficients ship as **local seeded, versioned data** so risk computation works with zero network and no PHI leaves the device in the mock path.

## Key User Flows

1. **Patient — "What to catch next" (primary).** On the Today feed, Dolores sees a `kind: "screening"` card: *"You may be due for a diabetes blood test."* Tapping it opens a plain-language screen: her ADA/CDC risk score, the specific reasons (age 54, family history, BMI), and a labeled evidence trail (family history = *patient-reported*; BMI = *confirmed*). One button: **"Ask my care team about this."** → the coach drafts a care-team message via the extended builder → she confirms send. Nothing is ordered automatically.

2. **Patient — filling the gap that unlocks a score.** Marcus opens the risk detail and sees ASCVD 10-yr marked *"needs review — we're missing your cholesterol."* The screen shows exactly what's missing and offers **"Add a past lab result"** (evidence = `imported`/`patient_reported`) or **"I don't have this."** Adding his LDL recomputes the score live and the reason changes from "incomplete" to a concrete number and recommendation.

3. **Patient — coach explains "why."** Rosa (Spanish) asks, *"¿Por qué necesito esta prueba?"* The coach (`why` mode) explains the USPSTF rationale in plain, localized language, labels each personal fact's evidence status, and appends the standard "this isn't a diagnosis; your care team decides" note. If any input reading crossed an urgent threshold, the **safety banner** fires and `call_clinic` surfaces.

4. **Care team — confirm and close the loop.** The clinic receives the patient-initiated message and, in the printed Health Brief, sees the **Screening & Risk** section: due screenings, computed scores, and every input's evidence status. The clinician confirms cadence (overriding the default where appropriate → `thresholdSource: "clinician_authored"`), orders the test in their own EHR, and the item flips from `inferred` to `confirmed`. The loop is closed by a human. (No in-app clinician action in v1 — this is the one-way brief.)

## Functional Requirements

- **FR-0 (Demographics capture — prerequisite).** `PatientProfile` gains `birthYear`/`dateOfBirth`, `sexAtBirth`, and optional `raceEthnicity` (with a first-class "prefer not to say"). No cadence rule or risk score computes without the demographics it requires; missing demographics render the dependent output as `needs_review` naming the missing field.
- **FR-1 (Family-history capture).** Structured first-degree family history for the v1 set (diabetes, premature ASCVD, CKD, osteoporosis/fracture, depression), stored `EvidenceStatus = "patient_reported"`, editable/removable.
- **FR-2 (Lab/vital import — manual v1).** Manual entry of past labs (A1c, fasting glucose, lipid panel/LDL/HDL, eGFR, urine ACR) and biometrics (height, weight→BMI, waist), stored `imported`/`patient_reported`, timestamped with the **result date** (not entry date).
- **FR-3 (Screening cadence engine).** Deterministic, unit-testable computation of due/overdue/not-yet-indicated per patient using seeded USPSTF-based rules keyed on age, sex, and risk factors. Fixtures must be extended with demographics so this is testable.
- **FR-4 (Risk stratification).** Compute ASCVD 10-yr (PCE), ADA/CDC prediabetes risk, and a FRAX-style fracture estimate **in deterministic code, never by the LLM**. Insufficient inputs → `needs_review` naming the missing input; **never a fabricated number**. Every score renders with a confidence/limitation note (see FR-13).
- **FR-5 (Ranked list, safety-first).** Recommendations render as `kind: "screening"` `TaskItem`s in the Today feed at priority ≥ 2, added after all safety/threshold/barrier tasks, so the `MAX_TODAY_TASKS` slice can only drop a screening item — **never a priority-1 safety task**.
- **FR-6 (Evidence transparency).** Every recommendation and score input shows its `EvidenceStatus` badge; a score from any `needs_review`/`inferred` input is visibly labeled provisional.
- **FR-7 (Coach explanation).** For any recommendation, the coach `why`/`explain` modes produce a plain-language, evidence-labeled rationale via `createSafeAiResponse()`, localized `en`/`es`.
- **FR-8 (Care-team routing, no auto-order).** Every recommendation offers a **"draft message to care team"** via the extended `care-team-message.ts`. The system never orders, generates a requisition, or marks a screen "done" without clinician confirmation.
- **FR-9 (Health Brief section).** `buildHealthBrief()` includes a "Screening & Risk" section with due screens, current scores, and evidence labels.
- **FR-10 (Clinician override).** A clinician-authored cadence overrides the guideline default and is marked `thresholdSource: "clinician_authored"`.
- **FR-11 (Audit).** Every family-history entry, lab import, score computation, recommendation surfaced, and care-team draft is recorded via `recordAuditEvent()` using existing action types.
- **FR-12 (Depression / self-harm hard-escalation — new safety code).** A PHQ-2/PHQ-9 pathway is **gated**: it is not surfaced as a routine screening card. Any positive self-harm/suicidality signal triggers **immediate crisis escalation with crisis-line resources** (988 in the U.S.), bypassing the routine "draft a message" path entirely. This requires **new patterns and a new crisis-escalation branch in `safety.ts`/`safety-gate.ts`** (today's `urgentSymptomPatterns` are physical-symptom only) and must not ship until clinically reviewed.
- **FR-13 (Honest uncertainty).** Each risk score displays a limitation note covering staleness (result date shown; a score built on a >12-month lab is flagged provisional) and known population/calibration caveats (e.g. PCE and FRAX performance differences across race/ethnicity) — never a false-precision single number without context.

## Data, Devices & Integrations

**Data captured**
- **Demographics** (birth year/DOB, sex at birth, optional race/ethnicity) — `confirmed`/`patient_reported`.
- Structured **family history** (condition, relation) — `patient_reported`.
- **Labs/vitals**: A1c, fasting glucose, lipid panel, eGFR, urine ACR, BP (already via `HomeReading`), BMI/waist — `imported`/`patient_reported`/`confirmed`.
- **Computed artifacts**: screening due-dates, risk scores, input provenance.

**Devices**
- **Home BP cuff** — already the backbone (`HomeReading` in `numbers/`); reused as a hypertension-screening and ASCVD input.
- **Scale / glucometer** — v1 via manual entry; the `useFoodCamera`/sensor-hook pattern (`src/hooks/`) is the template for a future paired-device hook.
- **Wearable** — resting HR, activity, sleep-duration proxies as *risk inputs only*; explicitly never a sleep-apnea diagnosis (can only raise "consider screening").

**External systems (phased, not v1)**
- **EHR / FHIR** import (`Observation`, `Condition`) to auto-populate FR-2 and mark `imported` — P1/P2.
- **ADT feeds** to re-run cadence after a hospital encounter — P2.
- **Pharmacy / community-resource networks** — out of scope for detection.

**AI model routing** (mirrors the mock/live provider abstraction in `src/ai/`)
- **Deterministic code, not an LLM, computes cadence and risk (FR-3/FR-4).** Clinical math is auditable and unit-tested; the LLM never invents a risk number.
- **Haiku (high-volume):** short per-recommendation "reason" strings and their `en`/`es` localization; normalizing manually entered lab text.
- **Sonnet (analysis/generation):** the coach `why`/`explain` narratives and Health Brief prose.
- **Streaming** for chat/coach via the existing `HealthAiProvider` interface; the mock provider remains the zero-key default.

## Safety, Scope & Liability Guardrails

**Scope of practice (non-negotiable).** The system **detects risk and screening gaps; it never diagnoses, orders, or prescribes.** Every output is phrased "you may be due for / at elevated risk for — here's how to get checked," reinforced by the shipped system prompt (`src/ai/prompts.ts`: "You do not diagnose, prescribe, change medication doses, or replace emergency care"). A risk score is framed as *an estimate to discuss with your care team*, never a verdict.

**Human-in-the-loop is mandatory.** No screening is ever marked complete, and no test ordered, without a clinician. Recommendations sit at `inferred` until a human confirms. The patient-facing action is always "ask your care team," via the one-way `buildCareTeamMessage()` builder.

**Escalation triggers (concrete; note what is reuse vs. new code).**
- **Hard escalate — reuse (already in `safety.ts`):** any input reading in the dangerous-vital band (SBP ≥180 / DBP ≥120, or SBP <90 / DBP <60) fires the existing emergency path; the provider is never called for a "screening reason."
- **Hard escalate — NEW code (FR-12):** a depression-screen pathway returning any self-harm/suicidality signal triggers immediate crisis escalation with crisis-line resources (988). This branch and its patterns do **not** exist today and must be built and clinically reviewed before the depression pathway ships.
- **Soft escalate — NEW classifiers:** a computed score in a high band (e.g. ASCVD ≥20%, or a markedly abnormal imported eGFR/A1c/LDL) renders the recommendation **with the safety banner** and prominent `call_clinic`/`draft_message`. `safety.ts` has no lab-value bands today; these thresholds are new, seeded, versioned, and clinically signed off.
- **Soft block — reuse:** if a patient reads a recommendation as license to self-manage ("so should I just start a statin?"), the existing medication-change soft-block (`medicationChangePatterns`) engages — answers, blocks guidance, offers a care-team draft.

**Failure modes handled explicitly.**
- **Insufficient data:** never fabricate a score — render `needs_review` and name the missing input (FR-4).
- **Missing demographics:** any score/cadence needing age/sex/race that is absent renders `needs_review` naming the field (FR-0) — never a defaulted or guessed value.
- **Stale data:** every input shows its result date; a score on a >12-month lab is labeled provisional (FR-13).
- **Wrong self-report:** `patient_reported`/`imported` labels warn the clinician not to treat unverified entries as truth; the clinician can reject any `inferred` item in the Brief.
- **Over-alarming:** copy is calibrated to prompt action, not fear; the banner is reserved for genuine thresholds; population/calibration limits are surfaced honestly, not hidden.

**Audit & privacy.** `recordAuditEvent()` logs every computation and message (FR-11). The mock path computes all scores **locally** with seeded coefficients — no PHI leaves the device without an explicit live-provider/EHR opt-in. Existing `privacy/` surfaces (export, delete, reset, audit log) cover the new state fields since they serialize through the same `AppState`. **Any live-provider inference or EHR/FHIR import moves PHI and is gated behind BAA + consent (see Open Questions) — it is not part of the mock-path MVP.**

## Success Metrics

Instrumentation note: all denominators below are computable from on-device state (`auditEvents`, `aiMessages`, `screeningRecommendations`, `riskScores`, `importedLabs`, `familyHistory`) so every metric is measurable in the mock path without a backend. "Baseline" is 0 for net-new events unless stated.

**Leading indicators (days–weeks)**
- **Family-history / lab completion rate:** % of active users entering ≥1 family-history item or ≥1 lab within 30 days. *Baseline 0 → target 40%.*
- **Recommendation engagement:** % of surfaced screening cards tapped (card-shown vs. card-tapped audit events). *Target 50%; stretch 65%.*
- **Care-team draft generation:** % of high-priority (soft-escalate-banner) recommendations that produce a drafted care-team message. *Baseline 0 → target 30%.*
- **Score visibility:** % of *eligible* users (those with sufficient inputs for ≥1 score) who view ≥1 computed score. *Target 60% of eligible.*
- **Provisional-score resolution:** % of `needs_review` scores completed by the user adding the missing input. *Baseline 0 → target 25%.*

**Lagging indicators (months; require a care-team feedback signal — see caveat)**
- **Screening completion (primary clinical outcome):** % of app-recommended screens confirmed done within 90 days, vs. the user's own pre-app cadence. *Target: measurable lift; stretch 2× the pre-app on-time rate for the highest-yield screens (A1c, lipid, BP-confirmation).* **Caveat:** "confirmed done" needs a return signal the one-way v1 channel does not provide — this metric is only measurable once a P2 clinician confirm/close surface or EHR read-back exists. Until then it is proxied by *self-reported completion* and clearly labeled as such.
- **New diagnoses surfaced upstream:** count of previously-undiagnosed conditions (prediabetes, HTN, CKD) confirmed after an app recommendation — the core mission metric (same P2 measurability caveat).
- **Retention / trust:** retention of users with ≥1 recommendation vs. those without; NPS change on "the app tells me things my doctor's office doesn't."
- **Care-team load (guardrail):** ratio of *actionable, correctly-evidenced* drafts to noise; target <10% of drafted messages rejected by the clinic as not clinically indicated (measurable only with the same return signal).

## Phasing

**P0 — Thin, shippable MVP (mock path, one condition family).** **Demographics on `PatientProfile` (FR-0) first** (blocks everything). Then family-history + manual lab entry (FR-1, FR-2); deterministic cadence + **one** risk score end-to-end — **diabetes/prediabetes (ADA/CDC risk)**, the natural spine off existing work; ranked `kind: "screening"` `TaskItem` with the safety-first ranking guard (FR-3, FR-5); evidence labels (FR-6); coach `why` explanation (FR-7); extended care-team draft (FR-8); Health Brief section (FR-9); uncertainty note (FR-13); audit (FR-11). Zero backend, seeded versioned rules, offline. **Explicitly out of P0:** any new lab-value soft-escalate bands, the depression/self-harm pathway (FR-12), ASCVD/FRAX, and wearables — P0 ships the ADA path with no new safety-classifier surface beyond what exists. Independently valuable: catches undiagnosed prediabetes for the highest-prevalence persona.

**P1 — Full silent-killer set + more scores + new safety code.** Hypertension-screen (leveraging `HomeReading`), hyperlipidemia + **ASCVD**, CKD (eGFR/ACR), osteoporosis/**FRAX**. **New `safety.ts` lab-value soft-escalate bands** and the **depression/self-harm hard-escalation (FR-12)**, both behind clinical sign-off. Clinician-override cadence (FR-10). Wearable resting-HR/sleep as risk inputs. Requires formal FDA CDS review before broad risk-score exposure (see Open Questions).

**P2 — Integration & clinician surface.** FHIR lab/problem-list import (auto-populate FR-2, mark `imported`); ADT-triggered recomputation; a **clinician-facing confirm/close surface** (unlocking the lagging clinical metrics); cancer-screening cadence as a same-engine extension; paired-device hooks (glucometer/scale). Everything here moves PHI and is gated on BAA + consent.

## Open Questions & Risks

- **FDA SaMD / CDS line (engineering + legal, blocking for P1).** Displaying validated risk scores and screening recommendations sits near the Clinical Decision Support boundary. Where does this fall relative to FDA CDS guidance / 21st Century Cures §3060 non-device criteria? The design (transparent inputs, cited sources, clinician-in-the-loop, no autonomous action, patient as intended user) is chosen to stay non-device, **but formal regulatory review is required before P1 exposes risk scores broadly.**
- **Guideline currency & governance (clinical, ongoing).** USPSTF grades and specialty thresholds change; PCE has known calibration critiques and newer equations exist (e.g. PREVENT). Who owns the guideline-update cadence, the versioning of seeded rules, and clinical sign-off? A stale rule is a patient-safety issue — the prevalence figures in the Problem section must be pinned to a cited, dated source in the rule set.
- **Risk-equation validity across populations (clinical + data + equity).** PCE and FRAX have documented performance differences across race/ethnicity. FR-13 surfaces limitations honestly, and race is optional with a "prefer not to say" path — but the team must decide whether to use race-based PCE at all vs. a race-free alternative, and how to avoid encoding bias.
- **HIPAA & the live path (legal + engineering, blocking for P2).** The mock path is local; any EHR/FHIR import or live-provider inference moves PHI. BAA coverage, consent flow, and the on-device/transmitted boundary need definition before P2.
- **Reimbursement / CPT alignment (product + stakeholder).** Does closing screening gaps map to payer/quality incentives (HEDIS gaps, Annual Wellness Visit, RPM/CCM codes; and for the depression pathway, behavioral-health screening/CoCM codes)? This shapes whether the care-team side has funded workflow to act — a real adoption dependency.
- **Care-team capacity & the one-way channel (product + clinical).** If the feature works, it generates screening demand into a channel (v1) that has **no return signal** — the clinic cannot confirm completion back to the app, so the primary clinical metric is unmeasurable until P2. Do partner clinics have workflow to absorb confirmed recommendations, or does it create unactioned nudges that erode trust? The <10%-rejection guardrail exists to catch this once a return path exists.
- **Type-change blast radius (engineering, P0-sequencing).** `PatientProfile` demographics (FR-0), the `Condition` widening, and the `TaskItem.kind` addition each touch fixtures, lenses, labels, reducer, and UI. Contained but must be sequenced (demographics → types → engine → surfaces) so no surface renders an unhandled condition or a score without its required demographic input.
