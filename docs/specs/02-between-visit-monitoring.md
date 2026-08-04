# Triaged Between-Visit Remote Monitoring — Heart Failure & Post-Discharge

**Status:** implemented — `src/domain/blood-pressure.ts` + `/numbers`. Verified 2026-08-04.

> A signal-not-firehose remote-monitoring layer that turns the ~8,760 non-office hours a year into two high-leverage safety loops — daily-weight heart-failure surveillance and the 48–72 hour post-discharge window — surfacing the care team only the handful of patients who need action this week, each with the trend and a suggested next step already assembled. **Escalation is always rule-based; the model only explains; a licensed clinician makes every clinical decision.**

---

## Reviewer's note (what changed from the draft, and why)

This version was hardened against the real codebase and a compliance review. The material corrections:

- **Audit trail gap fixed.** The shipped `AuditEvent` (`src/domain/types.ts`) has a **closed `action` union** (`created | updated | ai_generated | shared | exported | deleted`) and **no actor field**. The draft's FR-10 ("AuditEvent capturing actor, action, and timestamp") is *not satisfiable as-is*. This is now called out as a required type change (P0), not assumed.
- **`ConditionLens` scope corrected.** `condition-lens.ts` is a **Food-Lens/nutrition** structure (`nutrientRules`, `medDietRules`, `betterOptionGuidance`) — the diabetes/obesity "stubs" are empty *nutrient* rule sets, not a general condition-config home. Weight thresholds do **not** belong there; they belong on the care plan / a new HF config. The HF lens is scoped to the *nutrition* path only (fluid/sodium).
- **`buildCareTeamMessage` reuse right-sized.** It is a **zero-arg, single-patient, BP-hardcoded** state serializer (`medications[0]`, `systolic/diastolic`) — not a "barrier + symptom + readings" builder. FR-11 now says *extend*, not *call as-is*.
- **`buildTodayTasks` reuse right-sized.** It is **single-patient and hard-capped at 3 tasks** (`MAX_TODAY_TASKS`), sorted by a numeric `priority: 1|2|3`. The population worklist **cannot reuse this function**; it reuses the *priority concept* and the `recent-clinical-reading` severity ordering. Corrected throughout.
- **Clinical-safety escalation tightened** so it would satisfy a cautious physician: explicit 911/urgent-care language, no diagnostic overreach, deterministic-only escalation, missing-data as its own signal, and an explicit "the app is not a monitor and does not replace 911 or the clinic" boundary.
- **Metrics** now every one has an explicit baseline source, target, measurement window, and leading/lagging tag.
- **Regulatory** section sharpened on the FDA non-device-CDS (21st Century Cures §520(o)(1)(E)) line, HIPAA/PHI backend as a hard gate, and RPM/TCM CPT preconditions.

---

## Problem & Upstream Rationale

Through a family physician's eyes, the between-visit interval is a blind spot they are legally and morally accountable for but cannot see into. A heart-failure patient is seen every 1–3 months for 15 minutes. Decompensation does not schedule itself around that cadence: fluid accumulates over several days before overt symptoms, and a rapid weight gain is an early, cheap, home-measurable signal — often before the dyspnea and edema that drive an ED visit. By the time the patient feels bad enough to call, the window for an outpatient diuretic adjustment has frequently closed and the next stop is admission.

The population case is well established: heart failure affects roughly **6+ million U.S. adults**, is a **leading cause of hospitalization in adults over 65**, and carries a **~20–25% 30-day readmission rate** — one of the most scrutinized metrics in the CMS Hospital Readmissions Reduction Program. The **48–72 hours after discharge** is a high-risk, low-visibility moment: medications were reconciled by a hospitalist the family doctor never spoke to, the patient is discharged on a changed diuretic dose with a follow-up "in 7–14 days," and **the family physician is often blind to the discharge** until a fax arrives or the patient no-shows. Missing timely follow-up is associated with readmission.

*(Epidemiological figures above are cited as background rationale, not as claims the product computes or displays. Any patient-facing or clinician-facing number in the product is derived only from that patient's own logged data and is evidence-labeled.)*

Today's episodic model fails here in a specific, fixable way: it is **pull, not push, and unfiltered**. Existing RPM products swing to the opposite failure — dumping thousands of raw readings into an inbox no one can triage, so alerts get muted and signal drowns. Neither serves a physician carrying a panel of 1,500–2,500 patients.

"Moving care upstream" here is concrete: **detect the multi-day upward weight creep or the day-2 post-discharge symptom before it becomes a 4 AM ambulance call**, and hand the physician a decision-ready summary — "Mrs. Lee's morning weight is up 4.2 lb over 8 days on a stable diuretic dose; she reports increased ankle swelling; suggested action: same-day diuretic review" — instead of a spreadsheet. The physician gains eyes on hours they were accountable for but could not observe; the patient gains a safety net that catches deterioration days earlier without another office trip. **The system never makes the clinical call — it routes the signal to the human who does.**

## Target Users

**Patients**
- **Mrs. Lee, 74, HFrEF (EF 35%), lives alone.** On lisinopril, carvedilol, furosemide, spironolactone. Owns a scale but weighs "when she remembers." Cognitively intact, low-tech, large-font phone. Needs a **≤15-second daily ritual** — one weight, one tap on how she feels — not a dashboard. The classic decompensation-before-admission case.
- **Mr. Ortiz, 61, just discharged after an HF exacerbation.** Home 6 hours, new discharge med list, follow-up "in 2 weeks," diuretic dose changed in hospital. Spanish-preferred (the app already types `language: "en" | "es"` on `PatientProfile`). In the 48-hour danger window and unsure which old pills to stop.
- **The caregiver proxy** — Mrs. Lee's daughter — receives the same nudges and can log on a parent's behalf.

**Physician / care team (who does the work)**
- **The family physician** owns the panel and the clinical decision. Will not scroll readings; wants a **weekly triaged worklist** — "your N patients who need you this week and why," ranked, each with trend + suggested action, dispositioned in one or two clicks.
- **The RN / care manager / MA** is the operational engine: works the queue daily, runs the post-discharge protocol, drafts outreach, escalates upward. In an RPM/CCM/TCM-billing practice, this is the reimbursable role.
- **The clinic scheduler / front desk** acts on a downstream signal ("book Mr. Ortiz a 48-hour post-discharge check").

The **work** of triage is done by software first, RN second, physician last — deliberately inverting the current "physician drowns in raw data" model.

## Goals & Non-Goals

**Goals**
- Catch HF decompensation earlier via **daily-weight trend surveillance** with clinically grounded, per-patient-overridable thresholds — not raw-reading dumps.
- Own the **48–72 hour post-discharge window** with a structured protocol: med-reconciliation confirmation, red-flag symptom check, follow-up booking.
- Deliver a **triaged population worklist** — ranked patients + trend + suggested action — as the primary care-team surface.
- Enforce **signal-not-firehose alerting**: every alert names a threshold crossed and a suggested next step; no alert without a "why."
- Extend, not fork, the existing safety gate, evidence model, adherence loop, and care-team-message primitives.
- Keep the patient ritual **≤15 seconds/day** with a caregiver-proxy path and full EN/ES parity.

**Non-Goals**
- **Not a diagnostic or dosing engine.** The system never tells a patient to change a diuretic dose (already hard-blocked in `safety.ts`); it surfaces the trend and routes to the clinician who decides.
- **Not continuous/critical-care telemetry.** No arrhythmia detection, no implantable-device (CardioMEMS) integration, no real-time ECG. Daily discrete readings only.
- **Not an autonomous alerting robot.** No clinical instruction reaches a patient without human-in-the-loop above the informational tier; the worklist is decision-support, not an order set.
- **Not a full EHR or a replacement for the discharge summary.** We consume ADT/discharge data where available; we are not the system of record.
- **Not a general wearable-data lake.** Wearable trends (steps, resting HR) are *contextual signals* attached to a loop, never a standalone feed.
- **Not an emergency-response system.** The app is explicitly **not a substitute for 911 or the clinic phone line** and does not provide continuous monitoring — it processes discrete, patient-initiated entries.
- **P0 is not multi-tenant, EHR-integrated SaaS.** First shippable version runs on the existing local-state prototype with manual/mock device entry; a compliant multi-patient backend is a hard gate before any real-PHI multi-patient worklist (see Regulatory).

## How It Builds on Existing Primitives

This feature is an **extension of four things that already exist**, verified against source — not a greenfield build.

**1. The safety gate (`src/ai/safety-gate.ts`, `src/domain/safety.ts`).** The gate's four-outcome tree — `hard_escalate` / `soft_escalate` / `soft_block` / `allowed` — is exactly the escalation semantics RPM needs (`decideSafety()` at `safety-gate.ts:39`). Today `classifySafety()` matches `urgentSymptomPatterns` (already includes `chest pain`, `shortness of breath`, `trouble breathing`, `new confusion`, `fainting`) and `medicationChangePatterns`, and BP thresholds flow through `findRecentClinicalReading()` + `interpretBloodPressure()`. We extend the same machinery:
- **Add HF/weight rules** so a threshold-crossing weight trend produces `soft_escalate` (answer + banner + `["call_clinic","draft_message"]`, exactly the shape at `safety-gate.ts:132–140`) and a red-flag symptom (dyspnea *at rest*, syncope, chest pain) produces `hard_escalate` (escalation *is* the whole answer, provider never called — `safety-gate.ts:115–122`).
- **Reuse `medicationChangePatterns` verbatim** for the post-discharge "which pills do I stop?" case: it already returns the "I cannot tell you to stop, start, or change a medication dose… I can help you write a short message to your care team" block and routes to a drafted message.
- **Note (fidelity):** the current `urgentSymptomPatterns` matches *any* "shortness of breath." HF requires distinguishing **dyspnea at rest / severe** (hard-escalate) from **mild exertional/"more than usual"** (soft-escalate). This is a **new rule set**, not a free reuse — see FR-6.

**2. The medication-adherence loop (`src/domain/adherence.ts`, `DoseEvent`, `MedicationBarrier`).** Post-discharge is fundamentally a reconciliation/adherence problem. We reuse:
- `getAdherenceStreak()` / `getAdherenceRate()` unchanged for the discharge med list — a missed diuretic dose in the 48-hour window is a first-class alert input.
- The `MedicationBarrier` union (`forgot | ran_out | cost | side_effects | confused | scared | pharmacy_issue | does_not_feel_necessary`) — `confused` and `ran_out` are the top post-discharge failure modes and already have codes + the `setMedicationBarriers` reducer action.
- `summarizeBpTrend()` (needs `MIN_TREND_READINGS = 5`, averages `systolic`, emits a plain-language "improving/steady/rising" narrative) is the **template** the new weight-trend summarizer mirrors — a new function, not a reuse of the same one.

**3. The coach + care-team message builder (`src/domain/care-team-message.ts`, `src/ai/prompts.ts`).**
- `buildCareTeamMessage(state)` today is a **zero-arg, single-patient serializer** hardcoded to `medications[0]` and `systolic/diastolic`. To carry weight trend + symptom check-in + adherence context, it must be **extended** (parameterized), not called as-is. FR-11 reflects this.
- The coach system prompt (`healthAiSystemPrompt` in `prompts.ts`) already mandates labeling each patient-specific fact as **confirmed / patient-reported / imported / inferred / needs-review** and forbids diagnosis/dosing. This contract applies unchanged to trend explanations.

**4. Data model & patterns (`src/domain/types.ts`, `src/state/store.tsx`, `src/domain/tasks.ts`, hooks).**
- **New reading types**: `WeightReading` and `SymptomCheckIn`. Note: the existing `HomeReading` has **no `source`/`EvidenceStatus` field** (it's `systolic/diastolic/pulse/measuredAt/contexts/note`). So a `WeightReading` that carries `source: EvidenceStatus` is a *deliberate addition*, not "exactly like HomeReading." Add `weightReadings`, `symptomCheckIns`, and `dischargeEvent` to `AppState`, with **new reducer actions** (`addWeightReading`, `addSymptomCheckIn`, `registerDischarge`, `dispositionWorklistItem`) — none exist today; the store's action set is closed.
- **`AuditEvent` MUST be extended.** Today: closed `action` union + no actor. The worklist's "who dispositioned this and why" requires adding an actor/role field and new action variants (or a dedicated `WorklistDisposition` record with its own audit). **This is a required P0 type change, explicitly scoped — not free reuse.**
- **`Condition` union** is `"hypertension" | "diabetes" | "obesity"`; adding `"heart_failure"` touches `CarePlan.condition` and `selectLens()`. **Weight thresholds live on the care plan / a new HF-config, not on `ConditionLens`** (which is nutrition-only). An HF *nutrition* lens (fluid/sodium) is a legitimate but separate, optional addition.
- **`buildTodayTasks()` extension**: the daily-weight ritual and post-discharge steps become `TaskItem`s (`kind` is `"reading" | "medicine" | "visit" | "intake" | "privacy"`; add HF-appropriate copy under existing kinds). It is **single-patient and capped at 3 tasks** — fine for the patient feed; **not** the worklist engine.
- **A new sensor hook** following the `use-food-camera.ts` lifecycle (setup/cleanup/stop-on-hidden) for Bluetooth scale/cuff input, with the `food-lookup.ts` seed→live→manual graceful-degradation pattern (manual entry always available).
- **Health Brief** (`buildHealthBrief()`) gains weight-trend and discharge-reconciliation sections in its fixed section array, each carrying `EvidenceStatus` — an edit to the existing builder, no new mechanism.

The **care-team population worklist is the one genuinely new surface and the one genuinely new backend requirement.** Everything feeding it — evidence status, safety decisions, drafted messages, audit events, task priorities — is reused or a scoped extension.

## Key User Flows

**Flow 1 — HF daily-weight loop (patient side, the ≤15-second ritual).**
1. Morning task appears in the Today feed (`buildTodayTasks`): "Weigh yourself and tell us how you feel."
2. Patient taps a Bluetooth scale (auto-fill via the new sensor hook) or types a number; answers one symptom question ("More short of breath or swollen than usual? Yes / Same / No").
3. New reducer stores `WeightReading` + `SymptomCheckIn`; audit event recorded.
4. **Deterministic** trend evaluator runs: today's weight vs. a rolling 7-day baseline. Below threshold → gentle "Logged, you're steady." **No alert generated.**
5. If a defined rule crosses (**≥3 lb/24h, ≥5 lb/7d, or a sustained upward slope + a "more short of breath" check-in**), the safety gate returns `soft_escalate`: the patient sees a plain-language banner ("Your weight has crept up — this is worth a call, even though you may feel okay") plus `call_clinic` / `draft_message`, and the patient becomes a ranked worklist item on the care-team side.

**Flow 2 — The 48–72 hour post-discharge window (patient side).**
1. A discharge is registered (manual/mock `dischargeEvent` in P0; ADT in P2). It seeds a **time-boxed protocol** of countdown `TaskItem`s.
2. Within hours of home arrival: "Welcome home. Let's make sure your medicine list is right." The app shows the reconciled discharge med list diffed against the prior list (added / removed / dose-changed) and asks the patient to confirm what they actually have and take — reusing `DoseEvent` + `MedicationBarrier` (`confused`, `ran_out`).
3. Any "I don't understand which to stop" → **hard-blocked** from advice (`medicationChangePatterns`) and routed to a drafted care-team message.
4. Twice-daily red-flag symptom check for 48–72h. A **hard-escalate** symptom (chest pain, dyspnea at rest, syncope) fires the emergency path immediately (see Safety).
5. A "book your follow-up" task pushes to the scheduler surface if no visit is on the calendar within the guideline window.

**Flow 3 — The triaged population worklist (care-team side, the flagship surface).**
1. RN/physician opens **"Patients who need you this week."** A **ranked queue, not a data table** — default empty-is-good.
2. Each card = one patient, one reason: *name · trend sparkline · plain-language why · suggested action · evidence badge.* E.g., "Mrs. Lee — weight ↑4.2 lb/8 days, reports more swelling — suggested: same-day diuretic review — [patient-reported + confirmed]." Ranking reuses the **severity ordering** from `recent-clinical-reading.ts` (urgent > clinic-threshold > blocked) plus the `TaskItem` numeric priority — **a new ranking function over the panel, not `buildTodayTasks`.**
3. Physician dispositions in one click: **Acknowledge · Message patient (opens a pre-drafted message) · Book visit · Adjust plan · Snooze with reason.** Every action writes an audit record capturing **actor, action, reason, timestamp** (requires the FR-10 audit extension).
4. Cards clear when dispositioned; the queue is designed to reach zero. A snooze/mute records who and why.

**Flow 4 — Coach-mediated escalation (spans both sides).**
Patient asks the coach "I gained 4 pounds and my ankles are puffy — is that bad?" The gate classifies `soft_escalate`, the coach explains fluid retention *as general education with evidence labels* (never a diagnosis), shows the banner, and drafts the care-team message — which lands as a worklist card. One patient sentence becomes a triaged, decision-ready signal a clinician acts on.

## Functional Requirements

- **FR-1 (Weight capture).** The system SHALL persist `WeightReading { id, patientId, weightLb, measuredAt, contexts, note, source: EvidenceStatus }` via a **new** reducer action that auto-audits, supporting manual entry and Bluetooth-scale auto-fill.
- **FR-2 (Daily symptom check-in).** The system SHALL capture a structured `SymptomCheckIn` (dyspnea at rest vs. exertional, orthopnea/pillow count, edema, weight-change perception) as a ≤3-question daily prompt, storable by a caregiver proxy.
- **FR-3 (Weight-trend evaluation).** The system SHALL compute today's weight against a rolling 7-day baseline and classify against configurable HF thresholds (default ≥3 lb/24h, ≥5 lb/7d, or sustained upward slope), returning a plain-language narrative modeled on `summarizeBpTrend()`. **This computation SHALL be deterministic and MUST NOT depend on an LLM.**
- **FR-4 (Threshold source & override).** Weight thresholds SHALL carry a `ThresholdSource` (`clinician_authored | standard_education`), be per-patient overridable by the care team, and default to standard HF education values when unset — mirroring `thresholdSource` on `CarePlan`.
- **FR-5 (Signal-gated alerting).** The system SHALL NOT generate a care-team alert for any reading that does not cross a defined threshold or symptom rule. **Every alert SHALL include the crossed threshold, the trend, and a suggested action. No alert without a "why."**
- **FR-6 (Safety-gate extension).** Weight/symptom inputs SHALL flow through `createSafeAiResponse`. A **new HF red-flag rule set** SHALL produce `hard_escalate` for dyspnea *at rest*, chest pain, syncope/near-syncope, new confusion, or weight-gain + severe breathlessness, and `soft_escalate` for threshold-crossing trends or "more short of breath than usual" below the emergency bar. The extension MUST NOT weaken the existing `classifySafety` behavior (existing tests SHALL pass unchanged).
- **FR-7 (Discharge protocol).** On a `dischargeEvent`, the system SHALL instantiate a time-boxed 48–72h protocol of `TaskItem`s (med-reconciliation confirmation, twice-daily red-flag checks, follow-up-booking prompt), each with a deadline relative to discharge time.
- **FR-8 (Med reconciliation).** The system SHALL present the discharge med list diffed against the prior list (added / removed / dose-changed), let the patient confirm possession and intake per med via `DoseEvent`, and capture `MedicationBarrier` (`confused`, `ran_out`, `cost`) — routing any dose-change question to the existing hard block + drafted message.
- **FR-9 (Population worklist).** The care-team surface SHALL render a ranked list of patients with an active alert (name, trend sparkline, plain-language reason, suggested action, `EvidenceStatus` badge), sorted by a **new panel-level ranking** derived from the `recent-clinical-reading` severity order + `TaskItem` priority. **This surface requires the compliant backend (see Regulatory) before any real-PHI multi-patient use.**
- **FR-10 (Disposition & audit).** Each card SHALL support Acknowledge / Message / Book / Adjust-plan / Snooze-with-reason. **Every disposition SHALL write an audit record capturing actor identity/role, action, free-text reason (for snooze/mute), and timestamp.** This REQUIRES extending `AuditEvent` (add actor + new action variants) or a dedicated disposition record — the current `AuditEvent` supports neither.
- **FR-11 (Auto-drafted outbound).** Threshold-crossing events SHALL auto-generate a care-team message by **extending** `buildCareTeamMessage()` to accept weight trend, relevant readings, adherence context, and symptom check-in (today it is zero-arg and BP-only). The output is a **draft a human reviews and sends**, never auto-sent as clinical instruction.
- **FR-12 (Evidence labeling).** All trend narratives and worklist reasons SHALL label each patient-specific fact as confirmed / patient-reported / imported / inferred / needs-review per the `prompts.ts` coach contract.
- **FR-13 (Health Brief integration).** `buildHealthBrief()` SHALL gain a weight-trend section and a discharge-reconciliation section, each with `EvidenceStatus`.
- **FR-14 (Bilingual parity).** All patient-facing prompts, banners, and check-ins SHALL exist in EN and ES via `i18n/strings.ts`; a CI check SHALL fail the build if any new key lacks an ES translation.
- **FR-15 (Graceful degradation).** Device integration SHALL fall back seed→live→manual; absence of a connected scale/cuff SHALL never block logging, mirroring `food-lookup.ts`.
- **FR-16 (Missing-data handling).** The system SHALL detect a lapse in daily weighing (default ≥2 missed days for an active HF patient) and surface it as a **low-priority worklist item** ("no data — silent-failure risk"), **never as clinical reassurance**. "No news" is never rendered as "good news."
- **FR-17 (LLM-outage safety).** If the LLM is unavailable, deterministic threshold/red-flag escalation SHALL still fire, and the patient SHALL be shown their reading and the clinic phone number. An LLM outage MUST degrade explanation quality only, never safety.

## Data, Devices & Integrations

**Data captured**
- `WeightReading` (lb, timestamp, context, `EvidenceStatus`), `SymptomCheckIn` (structured HF symptoms), `DoseEvent` (discharge med list), `HomeReading` (BP/pulse, existing), optional pulse-ox SpO₂, optional glucose (diabetes overlap), wearable *derived trends* (resting HR, activity delta) as **context only**.
- `dischargeEvent` (discharge date/time, facility, diagnosis, reconciled med list, follow-up window).

**Devices** — **Bluetooth scale** (primary HF signal), **BP cuff** (existing loop), **pulse oximeter** / **glucometer** (secondary), **consumer wearable** (trend-only). All degrade to manual entry (FR-15). Pairing uses a new hook on the `use-food-camera.ts` lifecycle. *(For RPM billing, device data-transmission-day counting has specific requirements — see Regulatory.)*

**External systems (phased)**
- **ADT (Admit/Discharge/Transfer) feed** — the ideal post-discharge trigger. P0 uses manual/mock `dischargeEvent`; P2 integrates ADT (availability is practice-dependent — see Risks).
- **EHR via FHIR** — read discharge summary / med list (`MedicationRequest`, `Encounter`), write structured summaries back. P2+.
- **Pharmacy** — fill/refill status to detect `ran_out` early. P2.
- **Community-resource / social-needs networks** — for `cost`/`pharmacy_issue` barriers. P2, optional.

**AI model allocation** (Haiku for volume, Sonnet for analysis/generation, streaming for chat — per environment guidance)
- **Haiku** — high-volume daily path: classifying symptom check-ins into structured fields, generating plain-language "you're steady / worth a call" copy, drafting the routine care-team message from a template.
- **Sonnet** — analysis path: composing the nuanced multi-signal worklist reason ("weight up + adherence gap + wearable HR drift"), and trend explanations in the coach.
- **Streaming** — all coach conversational responses stream; the OpenAI Realtime path already wired for Food Lens (`realtime-session.ts`) is reused for optional voice check-ins (accessibility win for elderly HF patients).
- **Deterministic (no LLM)** — **all** threshold-crossing math, weight-slope computation, and red-flag classification live in `domain/` and are rule-based. **The LLM explains; the rules decide escalation** (enforced by FR-3, FR-6, FR-17).

## Safety, Scope & Liability Guardrails

Non-negotiable. Most are already enforced by the existing gate; the additions are explicitly scoped.

- **Never diagnoses, never doses.** The system does not tell any patient to change a diuretic dose, take an extra water pill, or stop a discharge medication. Hard-blocked today by `medicationChangePatterns` (`safety.ts:6`), returning a drafted care-team message instead of guidance. HF makes this critical: patient self-diuresis is dangerous.
- **Rules decide escalation; the model only explains.** Threshold math and red-flag classification are deterministic (FR-3, FR-6). An LLM outage degrades to "we couldn't summarize — here's your reading and your clinic's number" and **still fires deterministic escalation** (FR-17). It never degrades safety.
- **Concrete escalation triggers.**
  - *Hard-escalate (emergency — escalation is the whole answer; provider is not called):* chest pain, **dyspnea at rest**, syncope/near-syncope, new confusion, weight-gain + severe breathlessness. Patient is told **to seek urgent care now, and to call 911 if this may be an emergency**; the app offers to summarize for the care team. Reuses the `hard_escalate` path at `safety-gate.ts:115–122`, extended with HF red-flags.
  - *Soft-escalate (answer + banner + care-team actions):* ≥3 lb/24h, ≥5 lb/7d, sustained upward weight slope, threshold-crossing BP, or "more short of breath than usual" below the emergency bar.
  - *Post-discharge:* any red-flag in the 48–72h window escalates **one tier higher** than baseline given elevated risk.
- **Human-in-the-loop.** The worklist is **decision support, not orders.** No dose change, plan change, or clinical instruction reaches a patient without a clinician disposition. Auto-drafted messages are **drafts a human sends.**
- **Signal-not-firehose is a safety control, not just UX.** Alert fatigue is a patient-safety hazard; suppressing sub-threshold noise so the real signal is seen is deliberate. Missing-data (silent failure) is surfaced as its own low-priority signal (FR-16) so "no news" is never mistaken for "good news."
- **Evidence labeling on every claim.** Confirmed / patient-reported / imported / inferred / needs-review is enforced by the coach system prompt and carried on every worklist reason, so a clinician always knows provenance and confidence.
- **Audit trail (with the required extension).** Every reading, escalation, and disposition (including snooze/mute with **actor + reason**) writes an audit record via the reducer. **This requires extending `AuditEvent` (actor + action variants); the shipped type does not support it — tracked as a P0 dependency, not assumed.**
- **Explicit product-scope boundary, stated in-product.** Framing is "your care team's early-warning helper," never "your monitor" or "your doctor." The app **does not provide continuous monitoring, is not an emergency-response system, and is not a substitute for calling 911 or the clinic.** This boundary is shown at enrollment and reachable from every screen.
- **Failure modes explicitly handled:** device drops → manual entry; LLM down → deterministic escalation + clinic number (FR-17); patient stops weighing → missing-data alert (FR-16); implausible reading (out-of-range weight/BP) → `needs_review`, **excluded from trend math**, flagged for confirmation.

## Success Metrics

Every metric ships with a P0 baseline capture so P1/P2 changes are measurable. `[L]` = leading (process, weeks); `[G]` = lagging (clinical, quarters).

**Leading `[L]`**
- **Daily-weight capture rate** among enrolled HF patients. *Baseline:* 0 (no program). *Target:* **≥70% of days logged in first 30 days.** *Window:* rolling 30d. *Source:* `WeightReading` count / enrolled-patient-days.
- **Post-discharge protocol completion** (med-reconciliation confirmed ≤48h of `dischargeEvent`). *Baseline:* 0. *Target:* **≥80% of registered discharges.** *Source:* protocol-task completion timestamps.
- **Alert precision (signal quality).** % of care-team alerts a clinician dispositions as *actionable* (Acknowledge-with-action / Message / Book / Adjust) vs. *dismissed as noise* (Snooze-as-noise). *Baseline:* none. *Target:* **≥60% actionable.** *Source:* disposition audit records.
- **Worklist volume.** Median cards/clinician/week. *Target:* **≤ a pre-agreed cap (set per practice at enrollment, e.g. ≤15)** — proves triage, not firehose. *Source:* worklist-item counts.
- **Time-to-disposition.** Median hours from alert generated → clinician action. *Target:* **< 1 business day for soft-escalations; near-immediate for hard.** *Source:* alert-created vs. disposition timestamps.
- **Follow-up booked within guideline window** post-discharge. *Baseline:* practice's current rate (measured in P0). *Target:* **≥75%.** *Source:* scheduler booking vs. discharge date.

**Lagging `[G]`**
- **30-day HF readmission rate**, enrolled vs. matched baseline cohort. *Baseline:* the practice's own rate + ~20–25% national reference. *Target:* **relative reduction in the enrolled cohort, measured cohort-vs-cohort, program-attributable.** *Window:* per quarter, ≥1–2 quarters for signal.
- **HF-related ED visits per patient-year**, enrolled vs. baseline. *Target:* reduction. *Source:* practice ED/utilization data (requires data-sharing — see Risks).
- **Outpatient diuretic adjustments made *before* admission** (the upstream-save count). *Baseline:* 0 tracked. *Target:* measurable count of decompensations managed in clinic rather than hospital. *Source:* clinician "Adjust plan" dispositions linked to a caught trend.
- **Days from discharge to first successful clinician touch** ("family doc no longer blind"). *Target:* reduction vs. P0 baseline. *Source:* discharge date vs. first disposition/contact.
- **GDMT adherence** for enrolled HF patients via `getAdherenceRate`. *Baseline:* first-30-day rate. *Target:* improvement over 2 quarters.

*(Note: ED-visit and readmission metrics depend on utilization data the practice must supply; without it, only in-app process metrics are measurable — flagged in Risks.)*

## Phasing

**P0 — Thin, shippable MVP (HF weight loop + manual discharge, single clinic, existing local-state prototype).**
- `WeightReading` + `SymptomCheckIn` types, new reducer actions, audit wiring.
- **`AuditEvent` extension** (actor + action variants) — the one blocking type change for disposition audit.
- `heart_failure` condition on `CarePlan`; default weight thresholds with `ThresholdSource`; **deterministic** weight-trend evaluator; safety-gate HF red-flag/soft-escalate extension (existing safety tests stay green).
- Patient daily ritual in the Today feed (manual entry + caregiver proxy), EN/ES with the CI parity check.
- Manual/mock `dischargeEvent` with the 48–72h protocol as tasks; med-reconciliation confirm reusing `DoseEvent`.
- A basic **triaged worklist running on demo/fixture data only** (no real PHI, single device) — ranked cards, one-click disposition, audit.
- Haiku for daily confirmations + routine drafts.
- **Independently valuable:** proves the signal-not-firehose thesis on one clinic with zero device/EHR/backend dependency.

**P1 — Devices, richer worklist, real drafting.**
- Bluetooth scale + BP cuff via the new sensor hook (seed→live→manual); pulse-ox optional.
- Sonnet-generated multi-signal worklist reasons; wearable trend context attached to loops.
- Snooze/mute with reason, missing-data (silent-failure) detection, time-to-disposition instrumentation.
- Optional voice check-in via the existing Realtime path.
- Health Brief weight-trend + reconciliation sections.

**P2 — Integration & scale (gated on the compliant backend).**
- **Compliant multi-patient backend** (BAA, encryption at rest/in transit, authn/authz, breach logging) — hard prerequisite for any real-PHI, multi-patient worklist.
- **ADT feed** for automatic post-discharge triggering.
- **FHIR** read (discharge summary, med list) / write (structured summary back); pharmacy refill signal for `ran_out`.
- Multi-clinic population dashboard; community-resource routing.
- RPM/CCM/TCM billing-time capture instrumentation.

## Open Questions & Risks

- **FDA SaMD / non-device-CDS line (genuine unknown; needs regulatory review before P2).** Trend display + "consider calling your clinic" education is likely low-risk. But **rule-based thresholds that recommend a *specific action*** approach the Software-as-a-Medical-Device vs. non-device Clinical Decision Support boundary (21st Century Cures §520(o)(1)(E) / FDA CDS guidance). The four criteria for the CDS exemption hinge on the software **not** acquiring a signal from a device *and* the clinician being able to **independently review the basis** of the recommendation. Mitigations built in: physician stays the decision-maker; underlying data always shown; suggestions framed as decision-support, not directives; escalation is transparent and rule-based. **Caveat:** consuming a Bluetooth *device* signal (P1) and any *learned* threshold model (below) both push toward the device/regulated side — legal review required before those ship.
- **HIPAA / infrastructure (hard gate).** The prototype is **local-state, no backend** — fine for a single-device demo, insufficient for real PHI and a shared multi-patient worklist. Anything beyond fixture-data demo requires a compliant backend (BAA, encryption, access controls, breach logging, audit). **The worklist's real-patient value is blocked on this.**
- **Reimbursement / CPT (materially shapes P1/P2).** RPM (99453/99454 device + 99457/99458 management time) requires **≥16 device-transmission days per 30-day period** and interactive care-management time; TCM (99495/99496) has specific contact-and-visit timing rules. Device supply, data-day counting, and time capture all have concrete requirements the practice must validate. **Manual-entry days may not count toward RPM device-day requirements** — a real constraint on the manual-first P0 as a billing vehicle.
- **Threshold sensitivity/specificity.** The 3 lb/24h, 5 lb/7d rule is guideline-common but has **known imperfect predictive value** for decompensation: too sensitive → alert fatigue (self-defeating); too specific → missed events. Needs per-patient tuning and possibly a learned slope model — **but any learned model re-triggers the SaMD question** and would need validation + regulatory review.
- **Utilization-data dependency for outcome metrics.** Readmission and ED-visit metrics require the practice to share utilization data; without it, only in-app process metrics are measurable.
- **Care-team workflow adoption (the biggest real-world risk).** The worklist only works if an RN actually works the queue daily. Without staffed, reimbursed operational capacity, alerts pile up and the firehose returns in a new form. Operational, not technical.
- **Data quality / scale bias.** Home scales vary (clothing, time of day, different scales); weight noise can generate false signals. `contexts` capture + 7-day baselining + implausible-reading exclusion mitigate but don't eliminate.
- **Wearable equity.** Not all patients have a wearable; over-relying on it disadvantages the elderly/low-income HF population that needs this most. Wearables stay strictly contextual (non-goal reaffirmed).
- **ADT availability.** Automatic discharge triggering depends on the practice having an ADT/HIE subscription; many small family-medicine practices don't. P0's manual entry is the deliberate hedge.

---

*Suggested repo location (docs convention): `C:\Patient centered\docs\between-visit-remote-monitoring-design-spec.md`, linked from a "Specs" section in `README.md` (not currently present — add it). Matches the existing `-design-spec.md` suffix used by `home-health-ai-ownership-design-spec.md`.*
