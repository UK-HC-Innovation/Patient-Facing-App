# Chronic-Disease Self-Management Loops + Deprescribing & Cost Transparency

**Status:** partially implemented, corrected 2026-08-04. The chronic self-management loops shipped (`src/domain/adherence.ts`, `adherence-support.ts`, `/medicines`). **Deprescribing and cost transparency did not** — no module exists under those names; cost surfaces narrowly through `coverage-logistics.ts` and `medication-fills.ts`. Treat the deprescribing half of this spec as unbuilt. Verified in [the 2026-08-04 coherence audit](../qa/2026-08-04-spec-coherence.md).

> A reusable condition-loop engine that generalizes the existing medication-adherence loop into protocol-referenced self-management for hypertension and diabetes (with COPD/asthma deferred), paired with a questions-only deprescribing/polypharmacy review and estimate-labeled cost transparency — so patients get continuous, plain-language guidance between visits and physicians see home data and true out-of-pocket cost they've never had. Every clinical decision stays with a licensed clinician; the app prepares decisions, it never makes them.

## Problem & Upstream Rationale

Through a family physician's eyes, the 15-minute visit is a thin sampling of a chronic disease that lives 24/7 in the patient's home. We titrate a blood-pressure medicine off a single cuff reading taken in a noisy hallway, then don't see the patient for three months — during which their home average is what actually determines stroke and MI risk. We prescribe a second-line diabetes agent and never learn the patient stopped it in week two because it cost $340 and they were too embarrassed to say so. We hand an 82-year-old a tenth medication without anyone asking "should you still be on the first one?"

The epidemiology makes the case (CDC / ACC-AHA / ADA figures): roughly **half of US adults have hypertension and only about 1 in 4 have it controlled**; home BP monitoring plus a feedback loop is among the best-evidenced interventions to close that gap. **~38 million Americans have diabetes**, and self-management support — a Standard of Care in ADA guidance — is unavailable to most between visits. **Polypharmacy** (commonly ≥5 chronic medications) affects a large share of adults over 65 and is a leading driver of adverse drug events; deprescribing is guideline-endorsed (Beers, STOPP/START) but rarely happens because no one has time to review the whole list. And **cost is a silent adherence barrier** — a substantial fraction of patients report not filling a prescription because of price, while the prescriber has no visibility into the counter price.

"Moving care upstream" here is concrete: catch the uncontrolled home-BP trend in week 3 instead of month 3; surface the cost barrier at the moment of prescribing; flag the drug-drug interaction and the "no longer indicated" medication before it causes a fall. "Access they've never had" is a patient getting protocol-referenced, plain-language coaching every day — and a physician getting a home-data + cost + polypharmacy summary that makes the next visit a decision instead of a data-gathering exercise.

**A note on honesty of grounding:** the shipped app is a **single-user, localStorage-backed prototype** with a deterministic-first coach, a med-adherence loop, and Food Lens. This feature extends those primitives but requires genuinely new data types and — for anything multi-user, clinician-shared, or outcome-measuring — a backend that does not exist yet. Where the spec depends on net-new infrastructure, it says so rather than implying reuse.

## Target Users

**Patients**

- **Rosa, 58, hypertension + prediabetes, Spanish-preferred.** Has a pharmacy cuff but no idea what her numbers mean or when they matter. Needs plain-language bilingual coaching and a clear "call the clinic" line.
- **Darnell, 47, type 2 diabetes on metformin + a GLP-1.** Juggling glucose checks, meals (already uses Food Lens), and an injectable he sometimes skips. Needs one loop tying glucose, food, meds, and activity together.
- **Eleanor, 82, on 11 medications across three prescribers.** Recurrent dizziness. Nobody has looked at the whole list. Needs a deprescribing review framed as questions *for her doctor*, never as instructions to stop.
- **Marcus, 63, COPD with asthma overlap and a rescue inhaler** *(P2 persona — COPD loop is deferred; included to bound future scope).* Doesn't know "worse than usual" from "go to the ER."
- **Cost-squeezed patients across all of the above** who silently don't fill prescriptions and never tell the doctor.

**Physician / care team**

- **Family physician (primary owner).** Authors the care plan and any titration boundaries; receives home-data summaries, cost-barrier flags, and a pre-built deprescribing worklist. Makes every clinical decision.
- **Clinical pharmacist / PharmD** (where available): the natural reviewer for polypharmacy/deprescribing and interaction checks.
- **RN / MA care coordinator:** triages escalations, actions drafted messages, closes the loop on refills and cost.
- **Front-desk / refill staff:** benefit from cost transparency reducing "the pharmacy says it's $X" callbacks.

The app never makes the clinical decision — it prepares it. Patients log readings and answer plain check-ins; the app runs protocol logic and drafts; a licensed clinician approves or acts.

## Goals & Non-Goals

**Goals**

- Generalize the med-adherence loop into a **reusable `SelfManagementLoop` engine** (event → interpret → prompt → track streak/rate → escalate) that any condition can instantiate, keeping `DoseEvent` as the first instance.
- Ship two condition loops in scope: **hypertension** (home-BP monitoring, trend, drafted care-team message) and **full diabetes** (glucose + Food Lens + meds + activity). **COPD/asthma is explicitly deferred to P2** (zero code exists for it today; it is the least-grounded loop).
- Add a **deprescribing / polypharmacy review** for older adults: interaction surfacing + Beers/STOPP-style "still indicated?" flags — always as *questions for the care team*, every item `needs_review`.
- Add **cost transparency**: generic/therapeutic-alternative and estimated cash-price surfacing, explicitly estimate-labeled, framed as a care-team conversation.
- Make **teach-back and plain language** first-class: every recommendation carries a plain-language "why," and the coach can confirm understanding.
- Preserve the existing safety architecture: everything routes through `createSafeAiResponse()` and the deterministic safety layer, with the banner and `call_clinic`/`draft_message` actions reused verbatim.

**Non-Goals**

- **Not autonomous prescribing or dose changes.** No code path outputs "stop taking X" or "increase to Y mg" as a patient instruction.
- **Titration is NOT in P0.** A protocol-bounded titration *prompt* is a candidate FDA device function and depends on a clinician-authoring surface that does not exist. P0's hypertension loop is **monitoring + trend + drafted message only.** The titration-band prompt is gated behind a regulatory read and the authoring UX (P1+).
- **Not a substitute for the deprescribing decision.** The app builds the worklist; a licensed prescriber/pharmacist decides.
- **Not a PBM or real-time adjudicated price.** Cost is *estimated* cash price + alternatives, labeled as an estimate, never a guaranteed copay.
- **Not a diagnostic device.** No arrhythmia detection, no CGM-style alerting, no COPD severity scoring driving autonomous action.
- **Not an EHR replacement**; no bidirectional EHR write in P0/P1. Summaries are patient-owned export first.
- **No new backend persistence in P0.** The localStorage single-user model is carried as a hard constraint — it makes any *multi-user, clinician-shared, or outcome-measured* capability out of scope until a HIPAA-eligible backend exists (P2).
- **Not CGM/ABPM-grade continuous monitoring** — home spot readings and patient-entered data only.

## How It Builds on Existing Primitives

This is an *extension*, verified against the real tree. Where a primitive needs real rework (not a gentle add), it is called out — the draft's original "everything just slots in" framing was too generous.

**The loop engine (generalize adherence — real abstraction, not a freebie).** `src/domain/adherence.ts` today is **medication-specific**: `getAdherenceStreak(doseEvents, medicationId, today)` and `getAdherenceRate(...)` are keyed to a `medicationId`, and `summarizeBpTrend(readings)` splits BP readings in half and compares **systolic-only** averages (needs ≥5 readings). We lift the shared shape — *event stream → interpret → prompt → track → escalate* — into a `SelfManagementLoop` abstraction. **New event types are genuinely new:** `HomeReading` in `src/domain/types.ts` is hardcoded to `systolic`/`diastolic`/`pulse`, so `GlucoseReading`, `SymptomCheckIn`, `RescueUseEvent`, and `ActivityEvent` are net-new types, not variants that already exist. The `MedicationBarrier` enum and `barrierLabel` in `src/domain/labels.ts` generalize to loop barriers (diet, activity), and the care-team escalation is already wired to barriers.

**Safety gate + banner (reuse the architecture; extend the classifier carefully).** All new prompts flow through `createSafeAiResponse()` in `src/ai/safety-gate.ts`, which today classifies **free-text `patientInput` and reading `note` strings** via regex in `src/domain/safety.ts`, plus **structured numeric BP** via `findRecentClinicalReading` (`hasDangerousBloodPressure`: SBP ≥180 or ≤ threshold, DBP ≥120, SBP <90, DBP <60). Two honest consequences: (1) there is **no structured-numeric glucose or symptom path today** — hypo/hyperglycemia detection is a *new deterministic classifier over structured values*, not a regex line; (2) the `HealthAiResponse` shape (`content`/`safety`/`sources`/`banner`/`actions`) and the `"call_clinic" | "draft_message"` actions are reused verbatim, and the existing **medication-change soft-block** in `classifySafety` (patterns like `/stop taking/i`, `/change my dose/i`) already covers "should I stop this medicine?" — the exact deprescribing guardrail.

**The coach (extend modes; teach-back is new interaction logic).** `src/ai/intent.ts` runs `explain/why/visit/ask/trouble` (no `teach-back` mode exists today). We add loop-aware context and build teach-back as an extension of `explain` (restate → confirm/correct is new logic, not an existing mode). `healthAiSystemPrompt` in `src/ai/prompts.ts` already states *"You do not diagnose, prescribe, change medication doses, or replace emergency care"* (verified) and drives evidence labeling — reused unchanged.

**Condition lenses (fill the real stubs).** `src/domain/condition-lens.ts` has `hypertensionLens` fully built (sodium/saturated-fat/added-sugar/potassium/fiber rules + the `ace_arb_potassium` `MedDietRule`) and **`diabetesLens`/`obesityLens` stubbed with empty `nutrientRules`/`medDietRules`** (confirmed). This feature fills `diabetesLens` (carb/added-sugar/fiber rules; glucose-med diet rules using the same `MedDietRule` mechanism). **`Condition` is `"hypertension" | "diabetes" | "obesity"` — there is no `"copd"`**; adding it (for the deferred P2 loop) means extending that union and `selectLens`. Note `obesity` already has a lens + fixtures; the spec keeps it rather than silently dropping it.

**Food Lens (wire into diabetes — consumes as-is).** The diabetes loop reuses `src/app/food/page.tsx`, the camera/barcode hooks, `food-flags.ts`, and `MealLogEntry`. Diabetes food flags come from filling `diabetesLens.nutrientRules`; the multimodal injection pattern (image + facts + flags → LLM) is unchanged.

**Evidence model + brief + audit (real edits, not just "gains sections").** `buildHealthBrief()` in `src/domain/health-brief.ts` is a fixed six-section array hardcoded to BP readings and meds; adding loop-summary / deprescribing-worklist / cost-flag sections is a real edit. `buildCareTeamMessage()` in `care-team-message.ts` today reads **only `state.medications[0]` and formats `systolic/diastolic`** — deprescribing needs the *full* med list, so this function is rewritten/parameterized, not lightly extended. **Auditing is NOT automatic in the reducer:** `recordAuditEvent()` in `src/domain/audit.ts` is called manually at call sites (`privacy/page.tsx`, `visits/page.tsx`) and the reducer has a separate `addAuditEvent` case; new actions (`logGlucose`, `logSymptomCheckIn`, `logRescueUse`, `flagDeprescribeCandidate`, `flagCostBarrier`) must each dispatch an audit event explicitly — the original claim of "auto-audited" was false and is corrected here.

**Realtime voice (reuse).** `connectRealtimeSession()` and `reduceRealtimeEvent()` in `src/ai/realtime-session.ts` are real and reused for spoken check-ins/teach-back where hands-free helps.

## Key User Flows

**1. Hypertension monitoring loop — P0 (patient → summary → physician).**
Rosa logs morning/evening BP (`HomeReading`). The loop computes a rolling home average and trend (extending `summarizeBpTrend`, which today is systolic-only and split-half — the rolling-window-vs-goal-band computation is new). When her average sits above her clinician-recorded goal for the configured number of readings, the loop surfaces a plain-language observation — *"Your morning average has been about 148/92 for 10 days; your clinic's goal is 135/85"* — and drafts a care-team message via `draft_message`. **It does not tell her to change a dose and does not propose a titration step in P0.** If any reading is ≥180/120 (or <90/60), the **existing hard-escalate** fires first (provider never called; `call_clinic` shown).

**2. Full diabetes loop — P1 (multimodal, one thread).**
Darnell's day: a fasting `GlucoseReading`, a lunch scanned through Food Lens (carb + added-sugar flags now live from the filled diabetes lens), a logged GLP-1 dose (or a skip with a barrier), and an `ActivityEvent`. The loop ties them into one narrative — *"Your fasting numbers run higher on days you skip the evening walk and eat >60g carbs at dinner"* — and confirms understanding via teach-back. A **structured** hypo value (<70, or <54 hard) or symptomatic hypoglycemia triggers the deterministic diabetes threshold and shows **clinician-authored, pre-written** "low-sugar" safety education (see Guardrails) plus escalation framing — never a model-generated dose or treatment instruction.

**3. Deprescribing / polypharmacy review — P0/P1 (older adult → pharmacist/physician).**
Eleanor's full med list runs against a **seeded, dated** interaction + Beers/STOPP-style ruleset. The app produces a **worklist of questions**, not actions: *"You take [med] and [med] together — a combination your care team may want to review," "[med] is on a list of medicines that can be riskier over 65 — worth asking if you still need it."* Every item is `needs_review`, phrased as a question, and bundled into one drafted care-team message that iterates the **whole** list. The physician/PharmD dispositions each item (keep / taper / stop / discuss); **capturing that disposition and writing it back requires the P2 clinician surface** — in P0 the output is a patient-owned export. The patient is never told to stop anything.

**4. Cost transparency — P0/P1 (patient ↔ care team).**
A `cost` barrier is logged (existing `MedicationBarrier`). The loop surfaces an estimated cash price and generic/therapeutic-class alternatives from a **seeded, dated** table, with an explicit "estimate, not your guaranteed price" label, and drafts: *"Patient reports a cost barrier on [drug]; lower-cost alternatives in the same class exist — please review."* Nothing changes the prescription automatically.

## Functional Requirements

- **FR-1.** The system SHALL provide a `SelfManagementLoop` engine that, given a condition and its event stream, computes interpretation, a next-action prompt, streak/rate metrics, and an escalation decision — generalizing the adherence primitives (which are currently `medicationId`-keyed).
- **FR-2.** The system SHALL support event types `HomeReading` (BP, existing), and net-new `GlucoseReading`, `SymptomCheckIn`, `RescueUseEvent`, `ActivityEvent`, and `DoseEvent` (existing), each logged via a reducer action that **explicitly dispatches a matching audit event** (the reducer does not auto-audit).
- **FR-3.** The hypertension **monitoring** loop SHALL compute a rolling home-BP average (systolic and diastolic) and trend over a configured window and, when the average is outside the clinician-recorded goal for the configured number of readings, surface a plain-language observation and draft a care-team message. **It SHALL NOT propose a specific titration step in P0.** Any future titration prompt SHALL be protocol-bounded, require a human approval step, and SHALL NOT ship until the regulatory read (FR-15) and clinician-authoring surface exist.
- **FR-4.** The diabetes loop (P1) SHALL integrate glucose readings, Food Lens meal flags (from a populated `diabetesLens`), dose events, and activity into one daily summary with at least one plain-language correlation statement.
- **FR-5.** *(Deferred to P2.)* The COPD/asthma loop SHALL map symptom check-ins and rescue-inhaler use to clinician-defined green/yellow/red zones and present the matching action-plan step; red-zone entry SHALL escalate. This requires extending `Condition` with `"copd"` and net-new zone authoring.
- **FR-6.** The deprescribing module SHALL evaluate the **full** medication list for (a) known drug-drug interactions and (b) Beers/STOPP-style "potentially inappropriate / possibly no-longer-indicated" flags from a **seeded, versioned, dated** ruleset, producing a worklist where every item is `needs_review` and phrased as a question for the care team.
- **FR-7.** The system SHALL NEVER instruct a patient to stop, reduce, start, or change a medication; all deprescribing/titration/cost output SHALL render only `draft_message` / `call_clinic` actions, reusing the existing medication-change soft-block in `classifySafety`.
- **FR-8.** The cost module SHALL, for a medication, surface an estimated cash price and generic/therapeutic-class alternatives from a **dated, sourced** table, each labeled an estimate and not a guaranteed copay, and SHALL draft a care-team message rather than change any prescription.
- **FR-9.** Every recommendation SHALL include a plain-language "why" (target readability ~6th–8th grade, **validated by readability testing and clinical review**, not asserted by prompt), and the coach SHALL support a **teach-back** interaction (new logic extending `explain`) that asks the patient to restate guidance and confirms/corrects.
- **FR-10.** All loops SHALL flow through `createSafeAiResponse()`. New **deterministic** thresholds — structured-value hypo/hyperglycemia (new numeric classifier, not regex), and (P2) COPD red flags — SHALL be added to the safety layer, run **before** any model call, and be unit-tested with boundary and malformed-input cases (e.g., "7.0" vs "70" mmol/mg unit confusion).
- **FR-11.** `buildHealthBrief()` SHALL be extended (its section list is currently fixed and BP-hardcoded) to include loop summaries, the deprescribing worklist, and cost flags, each carrying its `EvidenceStatus`.
- **FR-12.** All new data SHALL be exportable, printable, deletable, and resettable through the existing privacy surface with no new data type exempt.
- **FR-13.** Every loop SHALL be bilingual (en/es) by adding keys to the typed string union in `src/i18n/strings.ts` (the pattern used for `flagBpTrend`), including plain-language explanations and teach-back prompts.
- **FR-14.** The system SHALL degrade gracefully offline: seeded interaction/cost tables and lens rules SHALL function with zero network, mirroring the food-lookup fallback chain (seed → live → "not found").
- **FR-15.** Before any titration prompt or any interaction/Beers flag ships to patients, the feature SHALL have a documented **regulatory determination** (FDA CDS / SaMD) and **clinical + legal sign-off** on framing and ruleset provenance recorded in the repo.

## Data, Devices & Integrations

**Data captured:** home BP (SBP/DBP/pulse, existing), glucose (fasting/pre-/post-prandial with context tag and **explicit unit**), symptom check-ins (COPD/asthma questionnaire items — P2), rescue-inhaler count (P2), activity (minutes/steps, patient-entered or wearable export), dose events + barriers (existing), meal logs + flags (existing), medication list with prescriber attribution, patient-reported cost barriers.

**Devices:** home BP cuff (patient-entered P0; BLE later), glucometer (manual entry P1; BLE/CGM export later), scale (manual/BLE later), consumer wearable (patient entry or read-only export). No device is treated as a diagnostic sensor; all readings carry `patient_reported` evidence unless clinician-confirmed. **Unit handling is a safety requirement, not a convenience:** glucose entry SHALL force a unit (mg/dL vs mmol/L) to prevent the classic 70 mg/dL vs 7.0 mmol/L confusion.

**External systems (phased):** discount/cash-price source for cost estimates (P1) with an offline seed table (P0); a curated, licensed, dated drug-drug interaction + Beers/STOPP ruleset (seeded/offline; not a live PBM); EHR/FHIR summary export and later ADT feeds / community-resource referrals (P2). All external calls follow the existing seed → live → "not found" degradation.

**AI model assignment (Haiku for high-volume, Sonnet for judgment, streaming for chat):**
- **Haiku** — per-event, latency-sensitive: daily plain-language loop summary, teach-back rephrasings, individual flag explanations, i18n plain-language rendering.
- **Sonnet** — analysis requiring judgment, low volume: deprescribing worklist reasoning over the med list + ruleset, trend narratives, cost-alternative framing, visit-brief synthesis.
- **Realtime (voice)** — the existing OpenAI Realtime path (`connectRealtimeSession`) reused for spoken check-ins/teach-back.
- **Deterministic first, always.** `safety.ts`, the new numeric thresholds, protocol bands, and interaction rules run **before** any model call — the "nurse layer." The model never gates or overrides an escalation; it can only add plain-language explanation after the deterministic layer has decided.

## Safety, Scope & Liability Guardrails

Non-negotiable. This is a clinical product; every capability is designed to stay inside scope-of-practice, and the draft's guardrails are tightened here to satisfy a cautious physician and a compliance reviewer.

- **Never diagnoses, prescribes, or changes a dose.** `healthAiSystemPrompt` forbids this (verified); deprescribing/titration/cost modules are built as *question-drafters*. There is no code path emitting "stop taking X" or "increase to Y mg" as a patient instruction.
- **Deterministic safety layer runs first, over structured values.** `createSafeAiResponse()` classifies every input before any model call. **Hard-escalate** (provider never called; emergency framing + `call_clinic`): BP ≥180/120 or SBP <90 / DBP <60 (existing); glucose <54 mg/dL or symptomatic hypoglycemia; (P2) COPD red flags (rescue use above the plan threshold, "can't speak in full sentences," blue lips); any existing urgent-symptom pattern. New numeric thresholds SHALL be unit-aware and reject implausible/malformed values as `needs_review` rather than acting on them.
- **Emergency guidance is pre-written and clinician-authored, never model-generated.** For hypoglycemia and any hard-escalate, the patient sees a **fixed, clinician-reviewed** plain-language card (the standard "treat a low, recheck, seek help if not improving" education) plus escalation to call — not a free-text model response. This removes the risk of a wrong model output at the most dangerous moment, and keeps the app on the education (not treatment) side of the line even though the copy is guideline-standard.
- **Titration is out of P0 and gated.** A protocol-bounded titration prompt is treated as a candidate FDA device function and does not ship until FR-15's regulatory determination and the clinician-authoring surface exist. P0 is monitoring + trend + draft-message only.
- **Soft-escalate (answers, but banner + care-team actions):** home averages persistently out of goal, rising trend + missed doses, a logged cost barrier, any deprescribing/interaction flag. The existing safety banner renders on all of these.
- **Medication-change soft-block reused for deprescribing.** Any patient request to stop/change a medicine (including "should I still be on this?") hits the existing soft-block: decline to instruct, offer `draft_message`.
- **Human-in-the-loop is mandatory** for every titration step (future), deprescribing disposition, and prescription/cost change. Patient-facing output is always a drafted question or a logged reading; a licensed clinician acts.
- **Cost estimates are labeled and dated.** Every price renders as "estimate, not your guaranteed price," carries the source and date, and alternatives are "worth asking your care team about," never "switch to this."
- **Evidence labeling everywhere.** Confirmed/patient-reported/imported/inferred/needs-review shown on every fact; deprescribing candidates default to `needs_review`.
- **Audit trail is explicit.** Every reading, flag, draft, and disposition dispatches `recordAuditEvent()` and appears in the privacy export. (Corrected: the reducer does not audit automatically; each new action wires this itself.)
- **Ruleset provenance.** Interaction/Beers rules carry a version + date and a visible "not exhaustive; defers to your pharmacist" disclaimer; a named owner maintains updates (open question below).
- **Failure modes.** Model/network down → deterministic safety + seeded rules still fire; coach degrades to templated plain-language guidance (mock-provider pattern). Stale/implausible/wrong-unit reading → `needs_review`, not acted on. Missing clinician goal/protocol → no titration or goal-band prompt; only "share this with your clinic" remains. Interaction-ruleset gap → module states it is not exhaustive and defers to the pharmacist.

## Success Metrics

Split into what is **actually measurable in the shipped prototype** vs. what requires the P2 backend. The single-user localStorage app can instrument on-device engagement but **cannot measure cohort clinical outcomes** — those are labeled aspirational until backend + consent + a study design exist.

**Leading indicators (measurable on-device in P0/P1):**
- Loop check-in completion rate — target ≥60% of expected daily events at 30 days. Baseline: current adherence-loop logging rate (instrument the current rate first; do not assume 0).
- Home-BP readings per hypertensive user per week — target ≥5. Baseline: measured pre-feature logging rate (not "~0" — actually count it).
- Teach-back confirmation rate — target ≥70% restated correctly within two attempts. Baseline: n/a (new; report from first cohort).
- Time from a logged `cost` barrier to a drafted care-team message — target <24h for ≥80% of cost barriers. Baseline: today the barrier never generates a draft (measurable 0).
- Deprescribing worklists generated for ≥90% of enrolled users on ≥5 chronic meds. Baseline: 0 (feature is new).

**Lagging indicators (clinical outcomes — REQUIRE the P2 backend, consent, and a study design; NOT measurable in P0/P1):**
- Hypertension control (home avg <135/85 or clinic <130/80 per goal): target +10–15 absolute points vs. matched controls at 6 months.
- Diabetes: median time-in-range improvement or A1c reduction ≥0.5% at 6 months among engaged users.
- COPD/asthma (P2): reduction in rescue-inhaler overuse episodes and unplanned exacerbation visits.
- Deprescribing: ≥1 potentially-inappropriate medication reviewed-and-actioned per eligible older adult per 6 months.
- Cost: reduction in primary non-adherence attributable to a surfaced lower-cost alternative.

All lagging targets are baseline→target on engaged cohorts vs. matched controls, none asserted as guarantees, and none claimable until instrumentation exists.

## Phasing

**P0 — Thin, genuinely shippable MVP (loop engine + hypertension monitoring + deprescribing worklist v1 + cost seed).**
- Generalize adherence into the `SelfManagementLoop` engine; instantiate the **hypertension monitoring loop** end-to-end (rolling home-BP average/trend → drafted care-team message), reusing the safety gate and banner. **No titration prompt.**
- **Deprescribing worklist v1** from a *seeded, dated* interaction + Beers/STOPP ruleset, output as `needs_review` questions over the full med list; patient-owned export (no clinician write-back).
- **Cost transparency v1** from a *seeded, dated* price/alternatives table, estimate-labeled, draft-message only.
- Fill `diabetesLens` rules (used by Food Lens now, by the diabetes loop in P1); teach-back v1 extending `explain`; new deterministic thresholds + tests; brief/export/audit extended; en/es strings. Still localStorage-backed, single-user. Independently valuable: a physician gets home-BP monitoring support, a polypharmacy worklist, and cost visibility with zero new infra — and nothing here is a plausible FDA device function.

**P1 — Full diabetes loop + titration (post-regulatory) + live data sources.**
- Complete the **full diabetes loop** (glucose + Food Lens + meds + activity, unit-aware hypo/hyper safety).
- Ship the **hypertension titration prompt** *only after* FR-15's regulatory determination and a clinician goal/protocol-authoring surface exist.
- Swap seeded cost table for a **licensed live price source**; swap seeded interaction set for a maintained, versioned dataset.
- BLE BP cuff and glucometer ingestion; begin FHIR summary export.

**P2 — COPD/asthma loop, clinician surface, backend, EHR round-trip.**
- Ship the **COPD/asthma zoned action-plan loop** (extends `Condition`, adds zone authoring).
- **HIPAA-eligible backend replacing localStorage** — the precondition for multi-user, clinician dashboards, disposition write-back, and any cohort outcome measurement.
- Clinician-facing worklist/dashboard with disposition capture and plan write-back; bidirectional EHR/FHIR + ADT-triggered post-discharge check-ins; community-resource referral.

## Open Questions & Risks

- **FDA SaMD / CDS line (gating).** A protocol-driven titration prompt likely fails the 21st Century Cures CDS-exemption criteria (notably the "independent review of the basis" prong — a patient cannot independently review the clinical rationale), pushing it toward a regulated dosing-CDS function. This is why titration is out of P0 and gated behind FR-15. Pure monitoring/logging/education sits in the non-device education space. A formal regulatory read is required before P1 titration.
- **Deprescribing liability.** Even as questions, an interaction/Beers flag creates a duty-to-act problem if a clinician ignores it and harm follows. Needs legal + clinical governance sign-off on framing and on ruleset provenance/maintenance before it reaches patients.
- **Interaction/Beers ruleset maintenance & licensing.** A stale or incomplete clinical ruleset is a patient-safety issue. Who owns updates, on what cadence, and how is "not exhaustive" enforced in the UI? A licensed dataset (with its terms) is likely required — a home-grown table is a liability.
- **Cost-data accuracy & source terms.** Estimated cash prices vary by pharmacy and change frequently; a wrong estimate that drives a decision is a real risk. Requires a licensed, dated, clearly-labeled source (GoodRx-style data has its own terms) and prominent "estimate only" treatment.
- **HIPAA / persistence.** The localStorage prototype has no BAA-covered backend. Any multi-user, clinician-shared, or EHR-connected step (P1/P2) requires a HIPAA-compliant architecture and a security review — and cohort outcome measurement is impossible until then.
- **Reimbursement / CPT.** Sustainability likely depends on RPM (99453/99454/99457/99458) and/or **RTM (98975–98978)** and CCM codes; device-sourced vs. patient-entered data and the 16-days-of-data rules affect eligibility. Patient-entered-only P0 data may not qualify for device-based RPM — an open business-model dependency.
- **Health-literacy validation.** "6th–8th grade" needs real readability testing and clinical review of teach-back copy in English and Spanish, not a prompt instruction — especially the fixed emergency cards.
- **Glucose unit safety.** mg/dL vs mmol/L confusion can invert a hypo/hyper decision; the forced-unit entry and unit-aware thresholds (FR-10, Data section) must be tested at boundaries before the diabetes loop ships.
- **Dependency on clinician-authored goals/protocols.** The monitoring goal band, and any future titration/COPD zones, require clinician configuration; adoption stalls if authoring is heavy. The authoring UX is an unscoped dependency for anything past P0 monitoring.
