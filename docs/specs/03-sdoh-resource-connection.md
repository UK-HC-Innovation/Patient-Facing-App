# Social Determinants Screening & Resource Connection (Food-is-Medicine)

**Status:** implemented — `src/domain/coverage-logistics.ts`, `instruments/hunger-vital-sign.ts`, `/support`. Verified 2026-08-04.

> A validated social-needs screen (PRAPARE / Health Leads) built into the patient app that, instead of stopping at "we noticed you can't afford your medicine," closes the loop — routing patients to SNAP, food banks, produce prescriptions, transportation, and utility/housing help, and extending Food Lens from "is this food good for my blood pressure?" to "here is how to get food that is." **P0 screens only the material/logistical domains (food, housing, utilities, transport, financial); it deliberately does not screen for suicidality, self-harm, or interpersonal violence until a designed crisis pathway ships in P1 — because a patient app must never elicit a disclosure it cannot safely hold.**

## Problem & Upstream Rationale

A family physician sees it every clinic day: the patient's A1c or blood pressure is the last thing standing between them and a bad outcome, but the actual lever is somewhere the prescription pad can't reach. The insulin costs more than the electric bill. There's no working fridge to store it. The pharmacy is a two-bus transfer away and the second bus doesn't run on Sundays. The "eat more vegetables" advice lands on a household that runs out of food money by the third week of the month.

The widely cited framing is that clinical care accounts for only ~20% of what drives health outcomes, with the rest attributable to health behaviors, social and economic factors, and physical environment (County Health Rankings model, Robert Wood Johnson Foundation / University of Wisconsin). Concretely: roughly 1 in 8 U.S. households experiences food insecurity (USDA ERS), and food insecurity is associated with materially worse glycemic control and higher acute-care utilization in diabetes. Cost-driven non-adherence is common and directly downstream of these forces. (Statistics are cited as *context for prioritization*, not as claims the app makes to patients.)

Today's episodic, 15-minute visit model fails this in a specific, mechanical way. The doctor can *screen* — many clinics already do, because CMS and Joint Commission now push health-related social needs (HRSN) screening, and there are ICD-10 Z-codes (Z55–Z65) to document it. But screening without connection is a survey, not care. The clinic has no time inside the visit to run a SNAP application, no live inventory of which food bank is open, no way to book a ride, and no way to *know whether the referral ever closed*. The patient gets a printed list of phone numbers that is stale by the time they reach the parking lot.

"Moving care upstream" here means the app does the part the visit can't: it screens with a validated instrument, translates each identified *material* need into a specific local resource, initiates the connection with consent, and — critically — tracks whether the patient actually got connected, with a human confirming the outcome. This is a direct, honest extension of Food Lens: the app already tells you a food is high in sodium; now it can help you get food that isn't.

## Target Users

**Patients**

- **Rosa, 58, hypertension + prediabetes, fixed income.** Runs out of grocery money mid-month and buys shelf-stable, high-sodium food because it's cheap and doesn't spoil. Her home BP readings climb in the last week of every month — a pattern the app can already see in `readings` and `summarizeBpTrend`. She has never applied for SNAP because she assumed she wouldn't qualify.
- **Darnell, 44, type 2 diabetes, no car.** Misses appointments and pharmacy pickups because transportation is unreliable; his `doseEvents` show a `ran_out` barrier pattern. He needs a ride to the pharmacy and the clinic, not another lecture about adherence.
- **Maria, 67, Spanish-preferring, hypertension, ACE inhibitor.** Low health literacy, wary of government forms, worried that using benefits will affect her immigration status. Needs plain-language, `es`-localized guidance and explicit, dated reassurance about what a screen does and does not do.
- **James, 71, heart failure + hypertension, utility insecurity.** Can't always keep the heat/AC on; extreme-temperature months correlate with decompensation. Needs LIHEAP/utility-assistance connection and a physician-signed medical-necessity letter path.

**Physicians & care team**

- **The family physician** wants the material social barrier surfaced and *acted on* without adding work to the visit — and wants the resulting Z-code suggestions and closed-loop status in a form they can review, not chase.
- **The care coordinator / community health worker (CHW) / RN case manager** is the human in the loop. They review flags, approve produce-prescription eligibility, confirm referral outcomes, and follow up on ones that didn't close. **This role is a hard dependency: no clinic without a named human owner should be onboarded** (see Open Questions).
- **The clinic's population-health / value-based-care lead** cares about screen completion, Z-code capture, and closed-referral rates because they map to HEDIS, quality programs, and shared-savings contracts.

Who does the work: the *app* does screening and first-pass resource matching; the *patient* consents and confirms; the *CHW/coordinator* handles judgment calls, eligibility verification, and confirming outcomes. The physician stays informed and signs what needs signing.

## Goals & Non-Goals

**Goals**

- Administer a validated HRSN screen (PRAPARE core + Health Leads food/housing/transport/utilities/financial items) inside the app, in English and Spanish, with the same evidence-status and audit discipline the app already uses.
- Turn each identified *material* need into a *specific, current, local* resource with a consented, initiated connection — not a static PDF of phone numbers.
- Track referral status (`sent → contacted → enrolled/received` or `declined/lost`) with a human confirming terminal outcomes.
- Extend Food Lens from evaluation to procurement: produce prescriptions, food-bank matching, SNAP pre-screen — anchored to the patient's condition lens and readings, honoring the shipped `medDietRules` guard.
- Generate clean documentation: suggested HRSN Z-codes (Z55–Z65) and a care-team-reviewable summary that flows into the existing Health Brief.
- Keep every social intervention traceable to a clinical reason (a reading trend, a barrier, a care-plan goal).

**Non-Goals**

- **Not a benefits-eligibility determination system.** The app *pre-screens* and *initiates* SNAP/LIHEAP/Medicaid applications; it never adjudicates eligibility or guarantees benefits.
- **Not a mental-health, self-harm, or crisis-assessment tool.** P0 does not screen for suicidality, self-harm, or mood. It does not "detect depression" from any item. (The isolation/mood domain is deferred to P1 *only* behind a designed crisis pathway — see Safety.)
- **Not an interpersonal-violence screener in P0.** IPV/safety items are deferred to P1 for the same reason: eliciting an IPV disclosure without a safe, private, human-backed response pathway can endanger the patient.
- **Not a diagnosis or treatment tool.** It does not prescribe and does not change medication.
- **Not a legal or immigration advisor.** It surfaces plain-language, dated, source-cited "public charge" reassurance and routes questions to humans; it does not give legal advice.
- **Not building our own resource directory in P0.** We integrate one existing closed-loop referral network (findhelp *or* Unite Us).
- **Not a payments processor.** Produce-prescription value is issued via partner/voucher rails, never held or moved by us.
- **Not a real-time crisis service.** The app is not staffed 24/7 and must never present itself as a substitute for 911 or 988.

## How It Builds on Existing Primitives

This feature is mostly *composition* of primitives that already exist in `C:\Patient centered\src`. Ground-truth notes flag where a claimed reuse is actually a real type change.

- **Evidence model (`src/domain/types.ts`).** `EvidenceStatus` is exactly `"confirmed" | "patient_reported" | "imported" | "inferred" | "needs_review"` (verified line 1). A screen answer is `patient_reported`; a need inferred from a reading pattern is `inferred` and must be confirmed. Reuse the `ExtractedFact` shape (`label`, `value`, `confidence`, `status`, `sourceSnippet`, verified) verbatim for social-need facts.

- **Safety gate & banner (`src/ai/safety-gate.ts`, `src/domain/safety.ts`, `src/domain/care-team-message.ts`).** The screen runs *through* `createSafeAiResponse()`. Its internal `SafetyDecision` union already has `hard_escalate` / `soft_escalate` / `soft_block` (verified). New keyword patterns in `safety.ts` for *material* acute signals — "no food today / child hungry," "no insulin and out" — hard-escalate exactly like a dangerous vital: `safety: "escalate"`, a prominent `banner`, and the care-team actions.
  - **CRITICAL GROUND-TRUTH CORRECTION:** the shipped action set is `CARE_TEAM_ACTIONS = ["call_clinic","draft_message"]` (verified, `safety-gate.ts:7`). **There is no crisis-line, 988, or 911 action anywhere in the codebase.** Any escalation that could involve danger-to-life therefore *cannot* be handled by the current banner set. This is why SI/IPV screening is out of P0 (see Safety). Where the app must escalate a material emergency (e.g., a diabetic with no insulin), P0 hard-codes explicit "call 911 / call your clinic now" text into the `banner` string and does **not** rely on a chatty answer.

- **Medication-adherence loop (`src/domain/adherence.ts`, `src/app/medicines/page.tsx`, `MedicationBarrier`).** The barrier enum is verified to include `cost`, `ran_out`, `pharmacy_issue` (types.ts:35–43). When a patient logs a `cost` barrier on insulin, that triggers an offer of medication-assistance/SNAP and, if relevant, pharmacy transport. We add a parallel `SocialNeed` domain and wire barrier→need. `buildCareTeamMessage(state)` (verified signature) is reused to summarize the need for the CHW.

- **Food Lens (`src/app/food/page.tsx`, `src/ai/food-instructions.ts`, `src/domain/condition-lens.ts`).** The marquee reuse. Verified: `hypertensionLens` is fully built with real `medDietRules` including the ACE/ARB `suppressEncourage: "potassiumMg"` guard (line 114); `diabetesLens` and `obesityLens` are genuine stubs (`nutrientRules: []`, `medDietRules: []`, borrowing hypertension's `betterOptionGuidance`). Reuse `selectLens(condition)` and `NutrientRule.direction: "encourage"` (potassium, fiber) to bias produce-Rx recommendations. **In procurement mode, the `suppressEncourage` guard is non-negotiable** — a produce prescription must never push high-potassium produce at an ACE/ARB patient without a care-team check.

- **State reducer + audit (`src/state/store.tsx`, `AuditEvent`).** `AuditEvent.action` is verified to include `shared` (types.ts:130) — a referral leaving the app to a partner network is a `shared` event, satisfying the PHI-egress audit requirement. New reducer actions (`startScreen`, `recordScreenAnswer`, `flagSocialNeed`, `initiateReferral`, `updateReferralStatus`, `issueProduceRx`) each auto-audit via the existing `recordAuditEvent()` path.

- **Task generation & Health Brief (`src/domain/tasks.ts`, `src/domain/health-brief.ts`).**
  - **GROUND-TRUTH CORRECTION:** `TaskItem.kind` is `"reading" | "medicine" | "visit" | "intake" | "privacy"` (verified) — there is **no** `"barrier"`/`"prep"` kind, and adding `"social"` is a real union change, not a config tweak. `buildTodayTasks()` ranks by numeric `priority` (1/2/3) and — critically — **slices to `MAX_TODAY_TASKS = 3` (verified, tasks.ts:4/102).** A social task at priority 3 can be silently truncated out on a day with clinical items. FR-11 therefore requires either a dedicated social-task surface or an explicit cap adjustment; social work must not vanish because the array was sliced.
  - `buildHealthBrief()` gains a "Social needs & referrals" section with `EvidenceStatus` per item.

- **i18n (`src/i18n/strings.ts`).** All screen items, resource copy, and public-charge reassurance ship `en`/`es` from day one, matching `PatientProfile.language` (verified union `"en" | "es"`).

- **Provider abstraction (`src/ai/types.ts`, mock/live).** `AiMode` is verified as a closed union not including `"connect"` — adding `"connect"` is a real type change. The screen and resource narration flow through `HealthAiProvider` with the same `HealthAiResponse` shape (`content`, `safety`, `sources`, `banner`, `actions`).

## Key User Flows

**Flow 1 — Patient completes the material social screen (patient side).**
1. A `kind: "social"` task appears in `today`: "A few quick questions about things that affect your health." Framed as care, consent and purpose shown first, with dated, source-cited "this won't affect your immigration status or your care" reassurance (`en`/`es`).
2. Patient answers PRAPARE-core + Health Leads *material* items (food, housing, utilities, transport, financial strain). **No SI, self-harm, mood, or IPV items in P0.** Each answer stored as an `ExtractedFact`-style social fact, `status: "patient_reported"`.
3. On submit, the client computes flags deterministically (the "nurse layer" mirroring Food Lens) *before* any AI generation — e.g., food-insecure, transport-insecure. A material-emergency phrase ("no food today," "child has nothing to eat," "out of insulin with none left") routes through the safety gate and hard-escalates before any resource UI renders.
4. Patient sees a plain-language summary: "Here's what you told us, and here's what we can help with," each need tied to its clinical reason.

**Flow 2 — Need becomes a consented, tracked referral (patient + care team).**
1. For each flagged need, the app proposes a specific local resource (via the one integrated network) with hours, distance, and eligibility notes — never a stale phone list.
2. Patient taps "Connect me." App initiates a referral; status = `sent`, logged as an audit `shared` event with an explicit per-referral consent record.
3. A `kind: "social"` follow-up task is created ("We sent your food-bank referral — we'll check back Friday").
4. Status advances (`sent → contacted → enrolled/received` or `declined/lost`) from partner callbacks; **a CHW confirms any terminal "successful" state. Nothing is marked resolved by the app alone.**
5. If a referral goes cold past SLA, the follow-up re-surfaces and drafts a CHW nudge via `buildCareTeamMessage`.

**Flow 3 — Food-is-Medicine / produce prescription (Food Lens extension) — P1.**
1. Trigger: a food-insecurity flag, or an eligible condition + care-team approval, or repeated high-sodium/high-sugar shelf-stable scans in Food Lens.
2. A CHW/physician approves a produce prescription (human decision; `EvidenceStatus: confirmed`). The app issues voucher value via the partner rail and records an `issueProduceRx` event.
3. Food Lens "procurement mode" activates: the condition lens points to *specific* SNAP-eligible / produce-Rx-redeemable items and nearby redemption sites, still enforcing `medDietRules` (`suppressEncourage` potassium guard for ACE/ARB). The store-neutrality of `betterOptionGuidance` is overridden *only* inside an approved produce-Rx context, and that override is itself audited.
4. Redemptions logged to `mealLog`-adjacent state so "food prescription" adherence is trackable like dose adherence and correlatable with `summarizeBpTrend`.

**Flow 4 — Physician review at the visit (care-team side).**
1. `buildHealthBrief()` renders "Social needs & referrals": what was screened, what was flagged, referral statuses, produce-Rx status — each with `EvidenceStatus`.
2. The app *suggests* HRSN Z-codes (Z55–Z65); nothing is coded without physician confirmation.
3. Physician confirms/edits, signs any medical-necessity letter (utility shutoff protection, produce Rx), and the loop is documented.

## Functional Requirements

- **FR-1.** The app SHALL administer a configurable *material-needs* screen (PRAPARE core + Health Leads food/housing/utilities/transportation/financial items) fully localized to `en`/`es` per `PatientProfile.language`. **P0 SHALL NOT include suicidality, self-harm, mood, or interpersonal-violence items.**
- **FR-2.** Each screen answer SHALL be persisted as a social-need fact carrying `EvidenceStatus` (`patient_reported` for direct answers; `inferred` for needs derived from `readings`/`doseEvents` patterns), reusing the `ExtractedFact` field shape.
- **FR-3.** On submission, the app SHALL compute client-side need flags deterministically *before* any AI generation, and SHALL run material-emergency phrases through `createSafeAiResponse()`.
- **FR-4.** The safety gate SHALL hard-escalate — suppressing normal resource UI, showing a `banner`, and offering `["call_clinic","draft_message"]` — on: "no food today" / child-hunger, and imminent interruption of a critical med (e.g., insulin `ran_out` with none available). New patterns SHALL live in `src/domain/safety.ts`. **For any material emergency the banner text SHALL include explicit "if this is an emergency, call 911" language, since no crisis-line action exists in the current `AiMessageAction` enum.**
- **FR-5.** For each flagged need, the app SHALL retrieve a specific, currently-available local resource from the integrated network and display hours/distance/eligibility; it SHALL NOT present a static, uncurated list as the primary path.
- **FR-6.** The app SHALL initiate referrals only after explicit per-referral patient consent, and SHALL record each outbound referral as an audit `shared` event with a consent record. **Data minimization: only the fields a given partner requires SHALL be transmitted.**
- **FR-7.** The app SHALL track referral lifecycle status and SHALL NOT set a terminal "successful" status (`enrolled`/`received`) without a human (CHW/coordinator) confirmation.
- **FR-8.** A `cost`, `ran_out`, or `pharmacy_issue` medication barrier SHALL offer the corresponding social resource linked to that specific medication. *(P0.5 — see Phasing; not in the P0 thin slice.)*
- **FR-9.** Produce prescriptions SHALL require care-team approval (`EvidenceStatus: confirmed`) before issuance; the app SHALL NOT self-authorize a produce Rx. *(P1.)*
- **FR-10.** In produce-Rx/food-insecurity context, Food Lens SHALL enter procurement mode recommending specific redeemable items/sites, while still enforcing `condition-lens` `medDietRules` (ACE/ARB `suppressEncourage: "potassiumMg"` guard). *(P1.)*
- **FR-11.** The app SHALL surface social follow-ups as `kind: "social"` tasks and SHALL guarantee they are not silently dropped by the `MAX_TODAY_TASKS` slice — via a dedicated social surface or an explicit cap adjustment — and SHALL re-surface any referral exceeding its follow-up SLA.
- **FR-12.** `buildHealthBrief()` SHALL include a "Social needs & referrals" section with per-item `EvidenceStatus`, and SHALL *suggest* ICD-10 Z-codes (Z55–Z65) for physician confirmation without auto-coding.
- **FR-13.** All new state mutations SHALL flow through the reducer and be auto-audited via `recordAuditEvent()`; the audit trail SHALL be exportable/printable via the existing privacy surface.
- **FR-14.** The screen SHALL be skippable and re-entrant; a patient can decline any item without blocking the rest, and declining SHALL itself be recorded (not silently dropped).
- **FR-15.** The app SHALL display dated, source-cited reassurance about benefits use (including public-charge language from official guidance) and route any legal/eligibility question to a human, never answering it as advice.
- **FR-16 (P1 gate).** No SI/mood/IPV screen item SHALL ship until: (a) an approved crisis pathway exists (988/911 surfaced, a warm-handoff or same-session human contact defined), (b) the response is validated by clinical + legal review, and (c) 42 CFR Part 2 / sensitive-data handling for any resulting record is designed. Absent all three, these items remain out of scope.

## Data, Devices & Integrations

**Data captured**
- Screen responses across *material* HRSN domains (food, housing, utilities, transport, financial strain) as social-need facts with `EvidenceStatus`. *(Isolation/mood/IPV excluded until FR-16 is met.)*
- Referral records: resource id, network, consent timestamp, status timeline, CHW confirmation.
- Produce-Rx records (P1): approver, value issued, redemption events.
- Derived signals: end-of-month BP drift from `readings` (`summarizeBpTrend`), cost/ran-out barrier patterns from `doseEvents`.

**Devices** — Reuses existing inputs; no new hardware for the core. The BP cuff (`HomeReading`) and, for diabetes, a glucometer feed provide the clinical anchor. Food Lens camera/barcode (`useFoodCamera`, `useBarcodeScan`) is reused for produce-Rx procurement (P1). Wearable/scale data is *supporting*, never gating.

**External systems**
- **Closed-loop community referral network:** findhelp *or* Unite Us (P0 ships a single-network adapter) for directory + referral lifecycle callbacks.
- **Benefits pre-screen rails (P1):** SNAP pre-screen + application initiation; LIHEAP/utility assistance; Medicaid where relevant. Pre-screen only — no determination.
- **Produce-prescription partners (P1):** voucher issuance and redemption via partner-issued cards or retailer/food-bank vouchers. We initiate value; we do not move money.
- **Pharmacy & transport (P0.5/P1):** pharmacy delivery/pickup on `pharmacy_issue`/`ran_out`; NEMT partners or ride vouchers.
- **EHR / interoperability (P2, aspirational):** FHIR write-back of Z-codes and referral status via US Core / Gravity Project SDOH profiles (`Observation`, `Condition`, `ServiceRequest`, `Task`). This is per-EHR integration work and the slowest dependency; it is explicitly *not* promised before P2 and requires physician gating on every write-back.

**AI model assignment** (Haiku high-volume, Sonnet analysis/generation; streaming for chat)
- **Haiku:** localizing/adapting screen phrasing, first-pass flag narration, resource-card summarization, produce-Rx item suggestions, routine CHW-nudge drafts — via `HealthAiProvider` with a new `"connect"` `AiMode`.
- **Sonnet:** synthesizing screen + `readings` + barriers into the physician-facing brief, medical-necessity letter drafts, and the condition-anchored *why* for a referral. Streamed.
- **Deterministic (no model):** safety-gate classification (`safety.ts` regex), Z-code suggestion mapping, and eligibility pre-screen rules stay rule-based and auditable — **models never decide escalation or coding.**

## Safety, Scope & Liability Guardrails

**Non-negotiable framing.** The feature *screens for material needs and connects to resources.* It **never diagnoses, never prescribes, never determines benefit eligibility, and is not a substitute for care, emergency services, legal advice, or a case manager's judgment.** Stated explicitly in `en`/`es`.

**The crisis-pathway problem (why SI/IPV are out of P0).** The shipped escalation surface offers only `call_clinic` and `draft_message` (verified: `CARE_TEAM_ACTIONS`, no 988/911 action exists). Screening a patient for suicidal ideation or intimate-partner violence and then routing them to "call your clinic" — which may be closed, may take days, and in the IPV case may not be safe to call from home — is clinically inadequate and creates liability. Therefore:
- **P0 does not ask any SI, self-harm, mood, or IPV question.** You cannot create a disclosure you cannot safely hold.
- Before any such item ships (P1), FR-16 must be met: 988 Suicide & Crisis Lifeline and 911 surfaced directly (new `AiMessageAction` values or hard-coded banner numbers), a defined human warm-handoff, and clinical + legal sign-off. IPV additionally requires a "quick exit," no-history-trace option, and awareness that the device may be monitored by an abuser.

**Scope-of-practice boundaries.**
- SNAP/LIHEAP/Medicaid flows are **pre-screens and application initiations only**, with a clear "the agency decides" disclaimer.
- Produce prescriptions require a clinician's confirmed approval; the app cannot self-issue.
- Immigration/public-charge content is dated, source-cited reassurance plus route-to-human — explicitly not legal advice.
- The app makes no population statistic *about the patient*; cited prevalence figures live only in this internal spec.

**Escalation — concrete P0 triggers (hard-escalate, via `safety.ts` + `safety-gate.ts`).** "No food today" / child hunger / nothing to eat now; imminent interruption of a critical medication (insulin/anticoagulant `ran_out`, none on hand); utility shutoff affecting a medical necessity (refrigerated insulin, oxygen). On any of these: normal resource UI is suppressed, a prominent `banner` shows **with explicit "call 911 if this is an emergency" text**, `call_clinic`/`draft_message` are offered, and `buildCareTeamMessage` drafts a human summary. Dangerous vitals and medication-change requests continue to escalate exactly as they do today.

**Human-in-the-loop.** No referral reaches a terminal "enrolled/received" state without CHW/coordinator confirmation. Produce-Rx eligibility, medical-necessity letters, and Z-code assignment are human-signed. The app proposes; a person disposes.

**Audit trail & privacy.** Every screen answer, flag, consent, outbound referral (`shared`), and status change flows through the reducer and `recordAuditEvent()`, visible/exportable/deletable in the existing privacy surface. Sharing PHI to a partner network requires explicit, logged, per-referral consent with data minimization. **If P1 ever captures SI/SUD-adjacent data, it falls under 42 CFR Part 2 and must be segmented and separately consented — not merged into the general audit export.**

**Failure modes.**
- *Stale/unreachable resource:* the app says so and offers an alternative or CHW handoff — never a dead end presented as live.
- *Referral network outage:* screening and flagging work offline (seeded resources, Food Lens seed pattern); the connection step queues and is clearly marked "not yet sent."
- *Model unavailable:* deterministic screening, flagging, and safety gating are model-independent and continue to function.
- *False-negative screen:* a "no need" patient with a clinical/barrier signal is gently re-surfaced later; the screen is re-entrant.
- *Over-triage / stigma:* resource offers are framed as optional help, never requirements or judgments.

## Success Metrics

Denominator and window are defined for each. Baselines are honest: this feature does not exist in-app today, so in-app process baselines are 0% by construction and the meaningful comparison is trajectory + segmentation.

**Leading indicators (engagement / process)**
- **Screen completion rate** = completed screens / prompted patients, measured per 90-day cohort. Baseline 0% (new). Target ≥60% of prompted patients by day 90.
- **Need-to-referral conversion** = patients consenting to ≥1 referral / patients with ≥1 flagged need. Baseline 0%. Target ≥50%.
- **Time-to-connection** = median hours from flag to `sent` for in-app-initiated referrals. Target <24h. (Reported as median + IQR to expose the tail.)
- **Food Lens → procurement uptake (P1)** = food-insecurity-flagged patients who activate a food-bank match or produce Rx / all food-insecurity-flagged patients. Target ≥40%.
- **Z-code capture** = completed screens with a physician-confirmed Z55–Z65 code / positive screens. Baseline: current clinic Z-code rate (pull from EHR to set a real, non-zero baseline rather than assuming 0). Target ≥70% of positive screens.

**Lagging indicators (outcomes)**
- **Closed-loop rate** = `sent` referrals reaching human-confirmed `enrolled`/`received` within 30 days / all `sent` referrals. Baseline: not "industry ~<50%" hand-wave — set from *this* network's historical callback data during integration; if unavailable, first-quarter actuals are the baseline. Target ≥40% within 30 days, improving QoQ.
- **Cost-barrier adherence recovery** = change in `getAdherenceRate` over 60 days among patients who logged a `cost`/`ran_out` barrier and accepted a resource, vs. a matched barrier-but-not-connected group. Target: measurable positive delta. (Association, confounded.)
- **Clinical anchor movement** = change in mean home SBP (`summarizeBpTrend`) among food-connected hypertension patients over 90–180 days; A1c trend for diabetes once `diabetesLens` and a lab feed exist. Framed as association, not causal.
- **Utilization proxy** = self-reported skipped-med days (near-term stand-in before claims data).

All metrics segmented by `PatientProfile.language` to catch equity gaps (e.g., Spanish-preferring completion lag).

## Phasing

**P0 — Material-needs screen + connect, single network, offline-safe (thin, shippable).**
- PRAPARE-core + Health Leads *material* items only (food/housing/utilities/transport/financial), `en`/`es`, stored as `EvidenceStatus` social facts. **No SI/mood/IPV.**
- Deterministic client-side flagging + safety-gate hard-escalation on *material* emergencies only (new `safety.ts` patterns; banners carry explicit 911 text).
- One closed-loop referral network adapter (findhelp *or* Unite Us) with seeded fallback resources for offline/demo.
- `kind: "social"` tasks (with the `MAX_TODAY_TASKS` truncation handled) + "Social needs & referrals" section in the Health Brief with suggested Z-codes.
- Full audit + per-referral consent logging. Mock AI path works with zero API key.
- *Independently valuable:* a patient is screened and connected; a physician sees it documented.
- **Deliberately deferred out of P0** (was scope creep in the draft): the barrier→resource bridge, produce Rx, benefits pre-screen, and any acute-safety screening beyond material emergencies.

**P0.5 — Barrier bridge.**
- `cost`/`ran_out`/`pharmacy_issue` in the adherence loop offers the matching resource (FR-8). Small, isolated, high-value; kept out of P0 only to keep the first slice truly thin.

**P1 — Food-is-Medicine + benefits pre-screen + loop-closing + gated behavioral screen.**
- Produce-prescription workflow (care-team approval, voucher issuance, redemption logging) and Food Lens procurement mode honoring `medDietRules`.
- SNAP + LIHEAP pre-screen and application initiation.
- Referral lifecycle with CHW confirmation and SLA re-surfacing.
- Sonnet-generated physician brief + medical-necessity letter drafts.
- `diabetesLens` build-out (currently a verified stub) so Food-is-Medicine works beyond hypertension.
- **Only if FR-16 is fully satisfied:** isolation/mood and IPV items behind a designed 988/911 crisis pathway.

**P2 — Interoperability, proactive triggers, analytics.**
- FHIR write-back of Z-codes + referral `ServiceRequest`/`Task` (Gravity/US Core SDOH); physician-gated. (Aspirational; slowest dependency.)
- ADT-feed-triggered post-discharge follow-up.
- Multi-network federation; equity dashboard by language/geography.
- Closed-loop analytics tying outcomes to adherence and BP/A1c trends for value-based-care reporting.

## Open Questions & Risks

**Clinical / operational**
- **Who is the CHW?** Load-bearing for the entire design. If a partner clinic has no CHW/coordinator capacity, the loop cannot close — **do not onboard clinics without a named human owner.** Does the product supply a staffing model or only serve clinics that already have the role?
- **Screen fatigue & re-screen cadence.** No universal PRAPARE cadence standard; needs a defined re-screen interval that doesn't annoy patients or staff.
- **Stigma & trust.** Framing as care, not surveillance, is essential; wrong tone tanks completion, especially for immigrant/low-trust populations. Requires `es` user testing before launch.
- **The behavioral-screen temptation.** Product/clinical pressure to add mood/SI/IPV items early will be strong. The gate (FR-16) exists precisely to resist shipping them before the crisis pathway is real.

**Regulatory / legal**
- **HIPAA & consent for external sharing.** PHI to findhelp/Unite Us and agencies requires airtight per-referral consent, BAAs, and data minimization; counsel must review consent UX.
- **FDA SaMD line.** Screening + resource routing is non-device *as long as* it does not output a diagnosis or a treatment recommendation. The nearest edge is any inference that names a condition or triages mental health — which is why the mood/SI domain is gated. This boundary must be reviewed and held.
- **42 CFR Part 2 (Part 2).** Any future SI/SUD-adjacent data triggers heightened federal confidentiality rules and must be segmented from the general audit export — a P1 design constraint, not an afterthought.
- **TCPA / outbound contact.** Any SMS/automated reminder for follow-ups needs prior express consent; the current app has no push, so this is a new surface to get right before P1 reminders ship.
- **Public-charge / immigration accuracy.** Reassurance copy must be dated and sourced from current official guidance; policy shifts and stale reassurance is real harm.
- **Produce-Rx and money movement.** Issuing benefit value implicates program rules and possibly financial regulation depending on the rail; must not become a de facto payment processor.

**Reimbursement / sustainability**
- **CPT/coding & who pays.** Reimbursement exists — SDOH risk-assessment (G0136 / 96160-family), community-health-integration and principal-illness-navigation codes (G0019/G0022, G0023) — but capture needs the right documentation and clinician sign-off, and rules evolve. The product must generate supporting documentation without overclaiming. Sustainability likely hinges on value-based contracts as much as fee-for-service. **Note: these SDOH codes are distinct from RPM/CCM codes; do not conflate the produce-Rx/adherence work with RPM billing without a separate coding review.**

**Dependencies**
- One referral-network API + data-sharing agreement (findhelp/Unite Us).
- Produce-Rx partner and voucher rail (P1).
- Live availability/accuracy of resource inventory — a stale directory silently degrades the whole promise.
- `diabetesLens`/`obesityLens` are verified stubs; Food-is-Medicine beyond hypertension depends on building them.
- A named human owner per clinic (see above) — the hardest non-technical dependency.
- FHIR write-back requires per-EHR integration (P2, slowest).

---

Files referenced for grounding (all absolute, all verified against source): `C:\Patient centered\src\domain\types.ts`, `C:\Patient centered\src\domain\condition-lens.ts`, `C:\Patient centered\src\domain\safety.ts`, `C:\Patient centered\src\ai\safety-gate.ts`, `C:\Patient centered\src\domain\care-team-message.ts`, `C:\Patient centered\src\domain\adherence.ts`, `C:\Patient centered\src\domain\tasks.ts`, `C:\Patient centered\src\domain\health-brief.ts`, `C:\Patient centered\src\state\store.tsx`, `C:\Patient centered\src\app\food\page.tsx`, `C:\Patient centered\src\ai\food-instructions.ts`, `C:\Patient centered\src\i18n\strings.ts`.
