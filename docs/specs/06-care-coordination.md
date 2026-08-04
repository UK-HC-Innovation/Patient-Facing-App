# Care-Coordination Quarterback — Transitions & Referral Loop-Closure

**Status:** implemented — `src/domain/care-team-message.ts` + `/visits`. Verified 2026-08-04.

> A care-team–facing coordination layer that ingests external events (ADT feeds, ER/hospital visits, specialist consults, outside labs), tracks every open referral to closure, and turns raw between-visit noise into pre-triaged, pre-drafted, evidence-labeled work items — extending the app's coach + safety-gate and adherence-loop primitives from "help this patient" to "close this loop." It coordinates; it never diagnoses, prescribes, changes a dose, or triages the acuity of an active symptom.

## Problem & Upstream Rationale

Family medicine is supposed to be the quarterback of a patient's care, but the quarterback is playing blind. The 15-minute visit is an episodic snapshot; the consequential events happen *between* touchpoints — the ED visit at 2am, the cardiology consult three weeks out, the referral that was faxed and never heard from again. The PCP typically learns of these late, incompletely, or never, and only if the patient remembers to mention them.

Two failure modes dominate:

1. **Referral leakage.** A large share of ambulatory referrals never close the loop — the specialist visit doesn't happen, or it happens and the consult note never returns to the PCP. Published estimates put the leaked fraction in the *ballpark of a quarter to half*; closing-the-referral-loop is an explicit ONC/CMS care-coordination quality concern. Each open loop is a potential diagnostic delay and a liability exposure. *(All prevalence figures in this spec are defensible ballparks for framing, not clinic-specific data — replace with the pilot panel's measured baselines before any business case. See Success Metrics.)*

2. **Transition blindness.** The 30-day window after an ED or inpatient discharge is the highest-risk period in ambulatory care. Roughly **1 in 5 Medicare discharges is followed by a 30-day readmission**, and timely PCP follow-up (a visit within ~7–14 days) is associated with reduced risk. But follow-up only happens if the PCP *knows the discharge occurred* — which today depends on an ADT feed nobody triages, a discharge summary buried in a fax queue, or the patient self-reporting.

"Moving care upstream" here is literal: surface the discharge before day 3 instead of at the next routine visit; close the referral before it becomes a nine-month diagnostic delay; get the hospitalist's medication change *in front of a clinician for reconciliation* before the patient double-doses. "Access they've never had" is the care team finally *seeing the field* — one reconciled view of what happened across every setting, with the coordination work already summarized, triaged, and pre-drafted rather than dumped as raw alerts.

The non-negotiable design constraint, learned from a decade of alert-fatigue literature: **this tool must reduce cognitive load, not add to it.** Raw ADT alerts and inbox dumps are the disease, not the cure. Every surface summarizes, pre-triages, and pre-drafts. The clinician's job becomes *approve / adjust / dismiss*, never *read 40 raw messages and figure out which matter*.

## Target Users

**Patient personas**

- **Ruth, 71, hypertension + heart failure, Medicare.** ED overnight for shortness of breath; observed and discharged at 4am with a new diuretic and a vague "follow up with your doctor." Her PCP finds out 5 weeks later. She is the readmission-risk archetype. *(Note: heart failure is NOT a condition the current app models — see "Fidelity & New-Build Callouts." Ruth's post-discharge monitoring rules require a new lens, not reuse of a shipped one.)*
- **Marcus, 54, hypertension + newly abnormal ECG.** Referred to cardiology by his PCP. The referral sat un-scheduled; Marcus assumed "no news is good news." Three months later he still hasn't been seen. He is the referral-leakage archetype. (Hypertension IS modeled today.)
- **Sofía, 63, Spanish-preferred, diabetes.** Seen at an urgent care while traveling; had labs drawn and a medication changed. She has the paperwork on her phone but doesn't know it matters to her home clinic. She is the fragmented-record archetype (the app already supports `language: "es"`; diabetes IS modeled today).

**Care-team side** (note: the app ships **no clinician-facing surface today** — the care-team queue is entirely new UI, see Fidelity callouts)

- **Family physician (the quarterback).** Benefits most, does the *least* new work by design: reviews a short, ranked "Coordination" queue of pre-triaged, pre-summarized items and approves the next action.
- **Panel RN / care coordinator / MA.** Primary operator of the loop-tracking workqueue: chases open referrals, schedules transition-of-care visits, works the "present these meds for reconciliation" and "obtain this consult note" tasks the system generates.
- **Clinic manager / value-based-care lead.** Cares about the aggregate: referral-loop-closure rate, 7-day post-discharge follow-up rate, TCM billing capture.

Who does the work: the *patient* confirms/contributes evidence (what the app already does well); the *system* does summarization, triage, and drafting; the *care team* does approve/adjust/act. The clinician is a reviewer and the sole clinical decision-maker, never a data-entry clerk and never replaced by inference.

## Goals & Non-Goals

**Goals**

- Detect external care events (ED/inpatient ADT, specialist consults, urgent-care visits, outside labs) and surface them to the panel within a clinically useful window (target: same or next business day for in-network, ADT-covered events).
- Track every referral as a stateful loop (`ordered → scheduled → seen → note_received → reconciled → closed`) and make un-closed loops impossible to lose.
- Manage transitions of care: flag discharges, prompt timely follow-up, and route medication changes to a human for reconciliation and TCM workflow.
- For each event, deliver a *pre-triaged, pre-summarized, pre-drafted* work item — never a raw alert.
- Reuse the existing `EvidenceStatus` model so every imported fact is labeled by trust and source.
- Give the patient a plain-language "what happened and what's next" view of their own transitions, in their language, that routes to care (never advises) whenever a clinical question arises.

**Non-Goals**

- **Not an HIE, EHR, or system of record.** It sits alongside the chart; no claim of being the authoritative clinical record.
- **Not a diagnostic or acuity-triage engine for the acute event.** It does not decide whether Ruth's shortness of breath was an emergency — the ED did that. It coordinates the *aftermath* and, for any *new* symptom a patient reports, routes to emergency care rather than assessing it.
- **Not a raw-alert firehose.** It deliberately *withholds* low-signal ADT events from the clinician surface and batches them.
- **Not autonomous action.** It never schedules, orders, reconciles, closes a loop, or messages a specialist without a human approving. No auto-close on inference.
- **Not a medication-interaction checker.** It *presents* home-med vs. event-changed-med lists side by side and labels each fact's provenance; it does **not** compute or assert drug–drug interactions, contraindications, or a reconciliation verdict — a clinician does. (This is the SaMD boundary; see Guardrails.)
- **Not v0.1's backend.** Ingestion pieces assume the app graduates from pure-localStorage to a server + real integrations; patient-facing surfaces can ship on the existing client stack first (see Phasing).
- **Not billing/coding automation.** It can *flag TCM eligibility* as an informational tag; it does not submit or code claims.

## How It Builds on Existing Primitives

This feature extends shipped primitives; it also requires honestly-named new build. See "Fidelity & New-Build Callouts" for what is reuse vs. net-new.

**1. The coach + safety gate become the coordination summarizer/router.**
The coach ingests a `HealthAiRequest` (`{ mode: AiMode; patientInput: string; state: AppState; image?; identifiedFood? }`) and returns a `HealthAiResponse` (`{ content; safety: "allowed"|"escalate"|"blocked"; sources: string[]; banner?; actions?: ("call_clinic"|"draft_message")[] }`) via `createSafeAiResponse()` (`src/ai/safety-gate.ts`, `src/ai/types.ts`). A coordination event is a new input class into the same pipeline:
- Add coordination values to the `AiMode` union in `src/domain/types.ts` (today: `"explain"|"today"|"why"|"ask"|"trouble"|"visit"|"summarize"|"food"`) — e.g. `"transition_summary"`, `"referral_status"` — and teach `inferAiMode()` (`src/ai/intent.ts`) to route to them.
- The gate's `decideSafety()` already resolves the highest-priority outcome (`hard_escalate` / `soft_escalate` / `soft_block` / `allowed`) and on hard-escalate **never calls the provider** — the escalation is the whole answer. Extend `classifySafety()` (`src/domain/safety.ts`) with post-discharge red-flag *phrasings* (e.g. worsening dyspnea/edema after a heart-failure discharge) so a patient asking about a transition triggers the same **banner + `call_clinic`/`draft_message`** path that exists today. **The red-flag path routes to emergency/clinic care; it does not assess severity.**
- The auto-draft builder is today `buildCareTeamMessage(state: AppState)` → a single patient→care-team draft (`src/domain/care-team-message.ts`). **New signatures** (`buildSpecialistNoteRequest`, `buildTransitionOutreach`) generalize the same templating to **PCP→specialist** and **PCP→patient** drafts. Framed as reuse-of-pattern, built as new functions.

**2. The medication-adherence loop is the template for the referral loop.**
The adherence loop is a stateful, date-based, barrier-tagged tracker: `getAdherenceStreak(doseEvents, medicationId, today)`, `getAdherenceRate(...)`, `summarizeBpTrend(readings)` (`src/domain/adherence.ts`), over `Medication`/`DoseEvent` with a `MedicationBarrier` union (`forgot | ran_out | cost | side_effects | confused | scared | pharmacy_issue | does_not_feel_necessary`). The referral loop is the same pattern at a different cadence:
- New `Referral` / `ReferralEvent` types mirroring `Medication`/`DoseEvent`, with a `ReferralBarrier` union (`not_scheduled | patient_declined | cost | transport | no_note_returned | specialist_no_capacity`) directly analogous to `MedicationBarrier`.
- New `getReferralAging(referral, today)` (days-in-current-state) mirroring `getAdherenceStreak`'s date math.
- `buildTodayTasks(state)` (`src/domain/tasks.ts`) already emits priority-ranked `TaskItem[]`. Extend it with transition and loop-closure task types, slotting them into the existing priority scheme (a day-2 post-discharge follow-up outranks routine prep, alongside dangerous-vitals urgency).

**3. Food Lens's capture → client-side flags → LLM-with-context pattern becomes discharge-document capture.**
Food Lens established: capture image + structured metadata, compute client-side "nurse-layer" flags *before* the LLM, then inject image+metadata+flags into the model (`src/app/food/page.tsx`, `src/ai/food-instructions.ts`, `src/domain/food-flags.ts`, `src/hooks/use-food-camera.ts`). Reuse this for **discharge-paper / after-visit-summary / consult-note capture**: patient photographs the sheet → extraction produces structured facts → client-side flags (new med, changed med, stated follow-up window) → those flags gate what the summarizer says. This mirrors the intake extraction path already in `src/app/intake/`. All extracted facts carry `EvidenceStatus = "imported"` / `"needs_review"` and require human confirmation before promotion to `"confirmed"`.

**4. Evidence status, condition lenses, health brief, audit trail — mostly reuse, some extend.**
- Every imported coordination fact carries `EvidenceStatus` (`"imported"` for ADT/consult data, `"needs_review"` until a human confirms) — the union exists in `src/domain/types.ts`, badges render via `src/domain/labels.ts`. **Direct reuse.**
- `ConditionLens` (`src/domain/condition-lens.ts`) ships lenses for `hypertension | diabetes | obesity` only (`selectLens()` switches over those three). **Heart failure is not modeled** — Ruth's daily-weight / diuretic-reconciliation monitoring requires a **new lens and an extension of the `Condition` union**, named as new work, not reuse.
- `buildHealthBrief(state)` (`src/domain/health-brief.ts`) gains a "Transitions & Open Loops" section following its existing evidence-labeled structure. **Extend.**
- The reducer + audit pattern (`src/state/store.tsx`, `recordAuditEvent(patientId, action, label)`) absorbs new `HealthAction` union cases (`importAdtEvent`, `advanceReferralState`, `reconcileMedication`, `dismissCoordinationItem`). **Caveat:** `AuditEvent.action` is today a fixed enum (`created | updated | ai_generated | shared | exported | deleted`) and `recordAuditEvent` takes **no actor argument**. New coordination actions map onto existing `action` kinds via the free-text `label`; a proper human-in-the-loop record (actor + reason) requires **extending `AuditEvent` with `actor` and optional `reason` fields** — named here as required new schema work, not a free reuse.

**New `AppState` fields:** `externalEvents: ExternalCareEvent[]`, `referrals: Referral[]`, `referralEvents: ReferralEvent[]`, `reconciliations: MedReconciliation[]`.

## Fidelity & New-Build Callouts

To keep engineering honest, this table separates true reuse from net-new work masquerading as reuse:

| Claim | Reality | Status |
|---|---|---|
| Safety gate branching (hard/soft escalate, soft block), thresholds SBP≥180/DBP≥120/SBP<90/DBP<60 | Exists exactly in `safety-gate.ts` + `safety.ts` | **Reuse** |
| `HealthAiResponse` shape, `call_clinic`/`draft_message` actions | Exists in `ai/types.ts` + `domain/types.ts` | **Reuse** |
| `MedicationBarrier` taxonomy, `EvidenceStatus`, `buildTodayTasks`, `buildHealthBrief` | Exist | **Reuse / extend** |
| "CHF lens reuses `ConditionLens`" | `Condition` = `hypertension\|diabetes\|obesity` only; no HF | **NEW** (extend `Condition`, author HF lens) |
| "Audit with actor and reason" | `recordAuditEvent` has no actor param; `action` is a fixed 6-value enum | **NEW** (extend `AuditEvent`) |
| "The existing `care-team-message` builder produces PCP→specialist drafts" | `buildCareTeamMessage(state)` is patient→care-team only | **NEW** functions, reused pattern |
| Care-team / Coordination queue UI | No clinician-facing surface ships today | **NEW** UI (all of P1) |
| ADT ingestion, patient-matching, server persistence | App is localStorage-only; no backend | **NEW** platform (P1 prerequisite) |
| Referral state machine, aging, barriers | Modeled on adherence loop, but all new types/logic | **NEW**, pattern reused |

## Key User Flows

**Flow 1 — Transition of care after an ED visit (system + care-team side).**
1. ADT "discharge" message for Ruth lands in the ingestion service; matched to her panel record (or quarantined if low-confidence).
2. The summarizer (`transition_summary` mode) produces a one-paragraph triaged summary: *"ED discharge 07/04 for dyspnea; discharge paperwork lists a new furosemide 20mg and 'follow up in 7 days.' Post-discharge lens flags for clinician review: confirm daily weights, present new diuretic alongside home lisinopril for reconciliation."* Every fact labeled `imported`/`needs_review`. **The summary presents; it does not recommend a med action.**
3. One ranked item appears in the care team's Coordination queue with pre-drafted actions: **"Schedule TCM follow-up visit,"** **"Send patient outreach message"** (pre-drafted, in Spanish where applicable), **"Present 1 changed med for reconciliation."**
4. RN clicks *approve* on outreach and scheduling; the med-reconciliation task routes to the physician. **Nothing was auto-sent.**
5. Actions logged to the (extended) audit trail with actor; the loop item stays open until the follow-up visit is recorded.

**Flow 2 — Referral loop-closure (system + care-team side).**
1. PCP orders a cardiology referral for Marcus → `Referral` created in state `ordered`.
2. System tracks aging via `getReferralAging`. At day 14 with no `scheduled` event, `buildTodayTasks()` surfaces a loop-closure task: *"Cardiology referral open 14 days, not scheduled."* with a barrier prompt.
3. Coordinator contacts patient, learns transport is the barrier → tags `ReferralBarrier: transport`, advances to `scheduled`.
4. Visit happens; no consult note returns by day +10 → system pre-drafts a **PCP → specialist** note request (`buildSpecialistNoteRequest`). Physician approves send.
5. Consult note captured (photo/upload → extraction) → facts labeled `imported`; physician confirms → loop advances to `note_received` → `reconciled` → `closed`. Loop-closure event recorded for the quality metric.

**Flow 3 — Patient sees their own transition (patient side).**
1. Ruth opens the app; the **Today** feed shows a plain-language card: *"You were seen in the ER on July 4. Your clinic knows. Next step: a check-in visit this week — we'll call you."* (Spanish for Sofía.)
2. Optional prompt to photograph her discharge paper to fill gaps → reuses Food Lens capture + extraction.
3. If she asks the coach *"should I keep taking my old water pill AND the new one?"*, `classifySafety()` matches a medication-change phrasing, the gate returns `soft_block`: it **gives no dosing guidance**, shows the safety banner, and offers `draft_message`/`call_clinic` — the existing behavior. If she instead reports *"I'm more short of breath since I got home,"* the gate **hard-escalates** to emergency/clinic contact and does not assess the symptom.

**Flow 4 — Physician's morning coordination review (care-team side).**
1. Physician opens the Coordination queue: a short, ranked list — high-signal transitions and aging loops on top, low-signal ADT events batched/collapsed below.
2. Each row is a summary + suggested action, not a raw feed. Approve / adjust / dismiss in seconds.
3. Dismiss requires a reason (feeds triage-quality tuning); dismissed items are audited, not deleted.

## Functional Requirements

- **FR-1.** The system SHALL ingest external care events from an ADT feed and/or manual entry, producing an `ExternalCareEvent` with type (`ed_visit | inpatient_admit | inpatient_discharge | specialist_consult | urgent_care | outside_lab`), timestamp, source facility, and `EvidenceStatus = "imported"`.
- **FR-2.** Each ingested event SHALL be matched to a patient panel record; unmatched or low-confidence matches SHALL be **quarantined for human matching, never silently dropped and never auto-attached**.
- **FR-3.** For every discharge event, the system SHALL generate a triaged transition summary (`transition_summary` mode) including reason, new/changed medications *as reported by the source document*, stated follow-up window, and lens-specific monitoring flags. The summary SHALL **present and label**, never recommend a clinical action.
- **FR-4.** The system SHALL model referrals as a state machine `ordered → scheduled → seen → note_received → reconciled → closed`, plus terminal `patient_declined` and `cancelled`, recording every transition as a `ReferralEvent` with actor and timestamp. **No state SHALL advance on inference alone; every advance requires a human action or a human-confirmed captured document.**
- **FR-5.** The system SHALL compute referral aging (days-in-current-state) and surface a loop-closure `TaskItem` when a referral exceeds a configurable per-state threshold (defaults: not scheduled >14d; no note >10d post-visit).
- **FR-6.** The system SHALL support a `ReferralBarrier` taxonomy and require a barrier tag when a loop is stalled or a patient declines.
- **FR-7.** For each actionable item the system SHALL pre-draft the relevant message (PCP→patient outreach, PCP→specialist note request, patient→care-team) via the new drafting functions; drafts SHALL be editable and SHALL NOT send without explicit human approval.
- **FR-8.** The Coordination surface SHALL rank items by clinical priority (using the `buildTodayTasks` priority scheme) and SHALL batch/collapse low-signal events rather than presenting a flat raw feed.
- **FR-9.** Medication reconciliation SHALL **display** home meds vs. event-changed meds side by side, label each fact's provenance, and require human confirmation to mark `reconciled`. The system SHALL NOT compute or assert drug–drug interactions, contraindications, or a reconciliation verdict, and SHALL NOT change a dose. Any surfaced "flag" (e.g. "two diuretics listed") SHALL be a neutral duplicate/overlap notice for clinician attention, not a clinical recommendation.
- **FR-10.** The patient-facing Today feed SHALL display a plain-language transition card in the patient's `language` when an external event is attached to their record.
- **FR-11.** When a patient asks the coach a question implicating a recent transition (medication reconciliation → `soft_block`; new/worsening post-discharge symptom → `hard_escalate`), the safety gate SHALL apply the existing escalation logic and surface the banner + `call_clinic`/`draft_message` actions. It SHALL NOT provide dosing guidance or symptom assessment.
- **FR-12.** Discharge/consult documents captured by photo SHALL be processed through the extraction pattern; extracted facts SHALL be labeled `imported`/`needs_review` and require confirmation before promotion to `confirmed`.
- **FR-13.** Every ingest, match, state transition, draft, send, dismiss (with reason), and reconciliation SHALL be written to the audit trail. This requires **extending `AuditEvent` with `actor` and optional `reason`** and adding the corresponding `HealthAction` reducer cases.
- **FR-14.** `buildHealthBrief` SHALL include a "Transitions & Open Loops" section listing recent external events and un-closed referrals with evidence labels.
- **FR-15.** TCM eligibility SHALL be flagged (discharge + follow-up-within-window + interactive-contact conditions) as an **informational tag only**; the system SHALL NOT auto-submit or code any claim.
- **FR-16.** A new `Condition` value and a `heartFailure` (or `postDischarge`) `ConditionLens` SHALL be authored before Ruth-class discharges can be lens-summarized; until then, HF discharges fall back to a generic, non-condition-specific transition summary that still routes med questions to a human.

## Data, Devices & Integrations

**Data captured/stored (new `AppState` fields):** `ExternalCareEvent[]`, `Referral[]` + `ReferralEvent[]`, `MedReconciliation[]` (home vs. changed meds, provenance labels, human-confirm status), extracted discharge/consult facts (existing `ExtractedFact` model), all carrying `EvidenceStatus`.

**Devices.** No new sensors required for the core loop. Existing capture patterns remain relevant: the camera is reused as a document scanner (`use-food-camera.ts`); the BP cuff path (`HomeReading`) supports post-discharge hypertension monitoring. A heart-failure lens *wants* daily weights — that is a **future** scale-ingestion hook (P2), not assumed in P0/P1.

**External systems (the integration surface — new backend work):**
- **ADT feeds / HL7v2 (A01/A03/A04/A08) or FHIR R4 (`Encounter`, `MedicationRequest`, `DocumentReference`)** for admit/discharge/transfer and consult events. Preferred modern path: FHIR + subscription notifications; realistic near-term path: a regional HIE or ADT-notification vendor delivering event webhooks.
- **EHR / referral system** for referral orders and consult-note return (`ServiceRequest`, `DocumentReference`); where no integration exists, manual entry + photo capture fills the gap.
- **Pharmacy / med history** for reconciliation *display* cross-check (future; RxNorm-coded list) — for presentation, still not for automated interaction-checking.
- **Community-resource network** (future) to act on `transport`/`cost` barriers.

**AI model routing (Haiku for high-volume, Sonnet for analysis/generation; streaming for chat):**
- **Haiku** — high-volume, low-stakes classification: ADT high-vs-low-signal triage, patient-match candidate scoring, referral-state inference *from returned documents* (surfaced for human confirmation, never auto-applied), batching decisions.
- **Sonnet** — analysis/generation where quality matters: transition summary, reconciliation *presentation* narrative (descriptive, not prescriptive), pre-drafted messages, the brief's "Transitions & Open Loops" section.
- **Streaming** — patient-facing coach conversation (existing) and any real-time care-team drafting UI; batch summaries need not stream.
- The `HealthAiProvider` interface is already abstract; these are new modes/prompts, not a new backend contract. The mock provider keeps the demo path working with seeded events (reuse offline-first seeding).

## Safety, Scope & Liability Guardrails

This is a clinical coordination tool; the guardrails are non-negotiable and are the acceptance bar for a cautious physician and a compliance reviewer.

**Scope of practice.** The system coordinates; it does not practice medicine. It **never diagnoses, never prescribes, never changes a dose, never triages the acuity of an active symptom, and never asserts a drug interaction or reconciliation verdict.** It reconciles *by presenting and labeling* — a licensed human makes every clinical decision. The shipped boundary language in `healthAiSystemPrompt` (`src/ai/prompts.ts`) applies unchanged and governs.

**Patient-facing symptom handling is escalate-only.** For any *new or worsening* symptom a patient reports (post-discharge dyspnea/edema, chest pain, etc.), the gate `hard_escalate`s: it returns the emergency/clinic-contact message, attaches `call_clinic`/`draft_message`, and **never calls the model to assess or reassure**. Existing dangerous-vitals thresholds are enforced by `hasDangerousBloodPressure()` (SBP≥180 or DBP≥120 or SBP<90 or DBP<60, on plausible readings) and urgent-symptom patterns in `classifySafety()`. New post-discharge red-flag *phrasings* extend that pattern set — they widen the escalate net, they do not add any answering behavior.

**Human-in-the-loop is mandatory.** No message is sent, no loop is closed, no medication is reconciled, and no follow-up is scheduled on inference alone. The system's role ends at *pre-drafted, ranked, one-click-to-approve*. Auto-close is prohibited (FR-4/FR-7/FR-9). This is both a safety and a liability stance: the system is an assistant to a licensed clinician, not an actor.

**Reconciliation is the SaMD boundary — treat it as such.** FR-9 constrains the reconciliation surface to *presentation + provenance labeling + neutral duplicate/overlap notices*. The moment copy would read as "these two drugs interact — hold X" or "recommend dose Y," it crosses from non-device CDS into device territory. **Every string in the reconciliation and transition-summary UI is subject to legal/regulatory copy review against current FDA CDS guidance before P1 ships.**

**Evidence labeling as a safety control.** Imported data is inherently lower-trust (wrong-patient ADT matches, OCR errors, stale notes). Every imported fact is labeled `imported`/`needs_review`, visually distinguished, and never presented as `confirmed` until a human confirms it (FR-12). Unmatched events are quarantined, not guessed (FR-2).

**The safety banner** (`banner` + `actions` on `HealthAiResponse`) is the visible surface of every escalation, carrying `call_clinic`/`draft_message` exactly as today.

**Audit trail as medico-legal backbone.** Every ingest, match, state transition, draft, send, dismiss (with reason), and reconciliation is recorded — requiring the `AuditEvent` extension (actor + reason) named in FR-13. Complete and exportable: who saw what, who decided what.

**Failure modes and handling.**
- *Missed/delayed ADT* → the system is a safety net, not the sole channel; patient self-report + document capture are independent paths, and a plain "we may not know about visits outside our network" limitation is stated to patients.
- *Wrong-patient match* → quarantine + human match; never auto-attach on low confidence (safety **and** privacy control).
- *OCR/extraction error* → `needs_review` + human confirmation before any downstream use.
- *Model wrong in a summary* → because summaries only *present source-reported facts with provenance* and never recommend, a wrong summary is a mislabeled fact caught at human confirmation, not a bad clinical instruction acted on autonomously.
- *Alert fatigue (the meta-failure)* → batching/collapsing (FR-8) and dismiss-with-reason feedback are first-class requirements.
- *Integration outage* → degrade to manual entry + capture (offline-first), surfacing a clear "external feeds unavailable" state.

## Success Metrics

Baselines are *measured in the pilot's first weeks*, not assumed; targets are set relative to that measured baseline.

**Leading indicators (process, weeks):**
- **Referral loop-closure rate** — % of referrals reaching `closed` with a confirmed consult note. *Baseline: measure current-state closed % on the pilot panel; Target: +15 absolute points within two quarters of P1.*
- **Time-to-transition-awareness** — median hours from discharge to the event appearing in the care-team queue. *Baseline: measure current (days-to-weeks via self-report); Target: <1 business day for in-network ADT-covered events.*
- **Coordination-item throughput** — % of surfaced items actioned (approved/adjusted/dismissed) within 2 business days. *Target: >80%.*
- **Triage precision** — % of clinician-surfaced items marked clinically relevant (1 − dismiss-as-noise rate). *Target: >85%. This is the alert-fatigue guardrail metric; if it falls below target the queue is failing regardless of integration quality.*
- **Draft acceptance rate** — % of pre-drafted messages sent with no/minor edits. *Target: >70% (proves the pre-draft saves work).*

**Lagging indicators (clinical outcome, months — tracked program-level, never feature-attributed):**
- **7-day post-discharge follow-up rate** — % of ED/inpatient discharges with a PCP contact/visit within 7 days. *Baseline: clinic-specific; Target: meaningful absolute improvement, benchmarked to the 7–14 day evidence window.*
- **30-day readmission rate** for the targeted panel (HTN/diabetes/HF discharges). *Baseline: clinic/CMS rate (~20% Medicare all-cause); Target: directional reduction. Attribution is confounded — track as program-level, do not claim feature causation.*
- **Diagnostic-delay events** attributable to un-closed referrals (chart-audit sampled). *Target: reduction.*
- **TCM billing capture rate** — % of eligible discharges where TCM criteria were met and flagged. *Target: increase (the unglamorous ROI).* 

**Physician-experience metric (survey):** self-reported coordination burden / inbox time for the panel. *Target: net reduction — the whole thesis is load down, not up.*

## Phasing

**P0 — Manual, patient-driven, ships on the current client stack (thin MVP).**
No backend, no ADT, **no clinician surface** — genuinely thin. Care events are entered manually or captured by photo (reuse Food Lens camera + intake extraction). Referral state machine, aging, barriers, and `buildTodayTasks` extensions ship as pure client logic with `AppState` additions and the reducer/audit pattern. Patient-facing transition card + the coach safety-gate extension (post-discharge red-flag escalate, reconciliation soft-block) ship here. `AuditEvent` gains `actor`/`reason`. Mock provider seeds demo events. **Independently valuable:** even manual, single-patient loop-tracking prevents leakage and demos end-to-end offline. *(HF-class summaries fall back to generic transition copy until the HF lens exists — FR-16.)*

**P1 — ADT ingestion + care-team Coordination queue (the real backend arrives).**
Server + ingestion service consuming an ADT/HIE feed (or one pilot facility's FHIR `Encounter`/`MedicationRequest` webhooks). Patient-matching with quarantine, Haiku triage/batching, Sonnet transition summaries, the **new** clinician Coordination queue with ranked pre-drafted actions, the reconciliation *presentation* UI (FR-9), TCM-eligibility flagging, and the HF/post-discharge lens. Requires the localStorage→server graduation. This is where cognitive-load reduction becomes real.

**P2 — Closed-loop specialist integration + resource routing + measurement.**
Bidirectional referral integration (consult-note return via `DocumentReference`), pharmacy med-history cross-check for reconciliation *display*, community-resource routing for `transport`/`cost` barriers, the analytics layer for loop-closure / follow-up / readmission / TCM metrics, and optional scale/wearable ingestion for HF daily-weight monitoring.

## Open Questions & Risks

**Regulatory / classification.**
- **SaMD line (FDA).** As long as the tool *displays, summarizes, and routes* clinician-actionable information — with the clinician independently able to review the basis and no treatment driven autonomously — it aims to sit within the non-device Clinical Decision Support carve-out (21st Century Cures / FDA CDS guidance). **The reconciliation and transition-summary copy is the boundary to watch (FR-9): it must present-and-flag for a human, never recommend a dose or a drug action.** *Open: legal/regulatory review of all reconciliation and summary UI strings against current CDS guidance before P1.*
- **CPT / reimbursement.** TCM (99495/99496), Chronic Care Management (99490 family), and Principal Care Management codes are the plausible reimbursement path and a real adoption driver. *Open: confirm the tool's documentation supports (not replaces) billing requirements, and that flagging eligibility creates no false-claim exposure.*

**Privacy / security.**
- **HIPAA.** The moment real ADT/EHR data flows, this is PHI at rest and in transit across systems, plus BAAs with every feed source and the LLM provider. **The current localStorage prototype is not a compliant substrate for P1** — the backend must be built to HIPAA standards (encryption, access control, the extended audit trail, minimum-necessary matching). *Open: hosting/BAA posture, and whether LLM calls on PHI use a compliant/enterprise tier with no training retention.*
- **Wrong-patient / cross-panel exposure** via mismatched ADT is both a safety and a privacy risk — the quarantine design (FR-2) is load-bearing.

**Clinical / workflow.**
- **Alert fatigue is make-or-break.** If triage precision (<85%) is poor, clinicians ignore the queue and the product fails regardless of integration quality. Tune batching + dismiss-feedback aggressively; consider a shadow period where the RN, not the physician, sees everything first.
- **HF is unmodeled today.** Ruth's persona depends on a new `Condition` value + lens (FR-16); until that lands, HF discharges get generic (still-safe) summaries. Don't demo an "HF lens" that doesn't exist.
- **Attribution.** Readmission/follow-up outcomes are confounded; the program must not over-claim feature-level causation.
- **Who operates the queue** varies (RN vs. MA vs. physician). Support role-based routing without forcing one workflow.

**Dependencies.**
- Requires the app to graduate from pure-client localStorage to a real backend for P1+ (P0 explicitly avoids this). **Decision to make: is that graduation *inside* this feature's P1 or a shared platform prerequisite tracked separately?** Recommendation: track it as a shared platform prerequisite — this feature is the first consumer but not the owner of "the app has a server."
- Requires at least one real ADT/HIE or FHIR feed partner for P1 — the single biggest external dependency and likely the critical-path item.
- Requires an enterprise/BAA-covered LLM tier before any PHI touches Haiku/Sonnet.

---

*Save location:* `C:\Patient centered\docs\care-coordination-quarterback-design-spec.md` (matches the repo's `docs/` root + `-design-spec.md` convention; no `docs/specs/` exists). Add a "Specs" section to `README.md` linking it and the existing `home-health-ai-ownership-design-spec.md`.

*Caveat retained:* all prevalence figures (referral leakage ~25–50%, ~20% Medicare 30-day readmission, 7–14 day follow-up window) are defensible ballparks for framing, not clinic-specific data — replace with the pilot panel's measured baselines before any business case.
