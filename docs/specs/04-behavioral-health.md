# Integrated Behavioral Health & Crisis Escalation

**Status:** implemented — `src/domain/crisis-red-flags.ts`, PHQ/GAD instruments, `/checkin`. Verified 2026-08-04.

> A between-visits behavioral health layer — guided CBT/behavioral-activation skills practice, validated symptom tracking (PHQ-9/GAD-7/AUDIT-C), and substance-use and loneliness coaching — that turns a family doctor's under-resourced mental health caseload into a monitored, escalation-safe program. Built as an *extension* of the app's existing coach, safety gate, and adherence loop, with a deterministic, provider-independent, exhaustively tested suicidality guardrail that outranks every other safety branch.

---

## Reviewer's note (why this rewrite exists)

The original draft was directionally strong and mostly faithful to the codebase, but it had four defects a cautious physician or compliance reviewer would catch:

1. **Ordering imprecision that would have shipped a bug.** The draft said `crisis_escalate` must rank "above every existing branch." But in the real `decideSafety()` (`src/ai/safety-gate.ts`), dangerous-vitals hard-escalations derived from **stored readings** are evaluated *before* free-text `inputSafety` (lines 48–86). "Above existing branches" is ambiguous. The correct, testable requirement is: crisis is evaluated **at the very top of `decideSafety()`, before the `recentClinicalReading` block** — this is now stated precisely and made a test.
2. **Scope overreach in the escalation rules.** "Not responding after 4–6 weeks → escalate" and "deterioration → escalate" are *measurement-based-care* prompts, which is fine — but the draft's framing drifted toward the app *recommending a treatment action*, which crosses the FDA CDS/SaMD line. Tightened so the app **surfaces the trend and routes to a human**; it never recommends a specific clinical action.
3. **Metrics that couldn't be measured in a localStorage prototype.** "Depression response/remission by 12–16 weeks vs. matched comparison" requires a cohort, a backend, and a comparator this product does not have at P0. Split honestly into *what P0 can actually measure on-device* vs. *what requires the P1/P2 backend*.
4. **A crisis-detection claim that oversells.** Free-text pattern matching cannot reliably catch obfuscated ideation or negation ("I would *never* hurt myself"). The spec now treats free-text matching as a **second net behind the structured item-9 signal**, states the residual false-negative risk plainly, and forbids marketing from claiming detection completeness.

Everything below is written against verified code. Load-bearing files: `src/ai/safety-gate.ts`, `src/domain/safety.ts`, `src/domain/types.ts`, `src/domain/adherence.ts`, `src/domain/condition-lens.ts`, `src/domain/care-team-message.ts`, `src/domain/tasks.ts`, `src/ai/prompts.ts`, `src/state/store.tsx`.

---

## Problem & Upstream Rationale

Primary care is the de facto mental health system in America. Roughly half of all mental health care is delivered in primary care settings, family physicians write the majority of first antidepressant prescriptions, and depression and anxiety are among the most common presentations in a family medicine clinic. Meanwhile the median wait for a new outpatient psychiatry appointment runs weeks to months in most markets, and much of the country lives in a designated mental health professional shortage area. The realistic clinical picture: a family doctor diagnoses depression in a 15-minute visit, starts an SSRI, and says "come back in 4–6 weeks." Nothing structured happens in the interval that decides whether the patient improves, quits the medication from side effects, or deteriorates toward crisis.

That interval is where care fails today. The episodic visit model cannot deliver the two things behavioral health actually requires: **measurement over time** and **skills practice between sessions.** Guideline-concordant depression care is measurement-based — repeat a PHQ-9, read the trend, and the *clinician* adjusts at 4–8 weeks if the patient is not responding — but in a busy panel it is done inconsistently and the score often lives only on paper. CBT and behavioral activation work, but they are homework-driven and there is no homework surface. Alcohol and tobacco are the two largest modifiable drivers of the chronic disease this app already manages, yet AUDIT-C screening and brief intervention rarely get sustained follow-through. And social isolation — a mortality risk the U.S. Surgeon General's 2023 advisory placed on the order of smoking — is almost never screened, coded, or acted on.

"Moving care upstream" here is concrete: **surface the non-responder at week 4 instead of month 4, surface the deteriorating patient before the ED, and give every patient structured skills and monitoring they would otherwise only get from a therapist they cannot get an appointment with.** The access this creates is real: a patient on a psychiatry waitlist gets guided behavioral activation, weekly symptom tracking their doctor actually sees, and a tested path to crisis resources — none of which they have today.

This is also the highest-liability feature the app will ship. Behavioral health means suicidality, and suicidality means the escalation logic cannot be "best effort." The existing coach already refuses to change doses, escalates dangerous vitals, and routes to care through a safety banner — and critically, on a hard escalation **the AI provider is never called** (`createSafeAiResponse`, `src/ai/safety-gate.ts:115`). That "the model never gets to answer over a red flag" property is exactly what a suicidality path requires. We extend and harden it.

## Target Users

**Patients**

- **Maria, 47, new to sertraline for major depressive disorder.** Started two weeks ago; psychiatry referral is 3 months out. She needs to know whether the medication is working, whether early side effects are normal, and something to *do* on the days she can barely get out of bed. Not in crisis, but a bad week could become one.
- **Darnell, 34, generalized anxiety plus escalating drinking.** GAD-7 moderate; AUDIT-C flags hazardous use. He would never call his doctor "just to talk," but he'll answer a check-in at 11pm. Needs anxiety skills and non-judgmental alcohol coaching in one place.
- **Eleanor, 71, hypertension (already a Patient Centered user), recently widowed, isolated.** Screens positive for loneliness and mild depression. Already logs BP daily via the existing `HomeReading` flow. Her isolation is a cardiovascular and mortality risk her cuff can't measure.
- **Sam, 19, first depressive episode, discloses passive suicidal ideation** in a check-in. This user is the reason the guardrails exist. The system's single most important job for Sam is to route correctly, fast, every time, and to make it impossible to bury a disclosure under a chatbot answer.

**Physician / care team (who does the clinical work)**

- **Family physician** — owns diagnosis, prescribing, and the treatment plan. Wants the trend, not the noise: a PHQ-9 trajectory, adherence correlation, and a flag when a patient meets a "not responding" or "deteriorating" *rule*, in a visit-ready brief. Does *not* want 40 raw check-ins in an inbox.
- **Behavioral health care manager / Collaborative Care (CoCM) manager**, where the practice has one — the natural human-in-the-loop for review queues and outreach, and the role that makes CoCM CPT billing (99492–99494, 99484) real. **P1+ only** (requires the backend that does not exist at P0).
- **Front-desk / triage RN** — receives structured escalation messages and the "needs outreach" list. **P1+.**

The patient does the daily skills and check-ins; the app measures, detects patterns, and routes; the clinician diagnoses, prescribes, and makes every clinical decision the app is forbidden to make.

## Goals & Non-Goals

**Goals**

- Deliver validated, repeatable symptom tracking (PHQ-9, GAD-7, AUDIT-C, and a brief loneliness measure) with **trend-based, guideline-aligned escalation that surfaces data to a human** — not autonomous clinical recommendation.
- Provide guided, structured **CBT / behavioral-activation** and brief substance-use and loneliness coaching between visits, grounded in the clinician's plan and labeled as skills practice, not therapy.
- Make **crisis routing the highest-priority, hardest-tested path in the product** — deterministic, provider-independent, ordered above every other safety branch, and impossible to suppress behind a normal answer.
- Produce a **visit-ready behavioral health brief** (trends, adherence correlation, PHQ-9 item-9 history, flags) that plugs into the existing Health Brief with per-section `EvidenceStatus`.
- Reuse the existing coach, safety gate, adherence loop, evidence model, and audit trail rather than building a parallel system.

**Non-Goals**

- **Not a diagnostic instrument.** PHQ-9/GAD-7/AUDIT-C are screening/severity measures; the app never converts a score into a diagnosis and never displays a diagnosis. Diagnosis stays with the clinician.
- **Not a treatment-recommendation engine.** The app never tells the patient or clinician *what to do* clinically (no "your SSRI isn't working, you need a switch"). It surfaces the score, the trend, and a flag, and routes to a human. This is the FDA CDS boundary and it is a hard line.
- **Not a crisis service and not a substitute for emergency care.** The app routes to 988 / emergency care and the care team; it does not provide live crisis counseling and never tells a user in crisis to "wait for your appointment."
- **Not autonomous medication management.** No starting, stopping, dose changes, or adjustment guidance for any medication, psychotropic included — the existing `medicationChangePatterns` block (`src/domain/safety.ts:6`) stays in force.
- **Not a replacement for a therapist.** Guided modules are psychoeducation and skills practice; the app says so at the consent gate and in-module.
- **No passive/covert monitoring** — no microphone sentiment analysis, no keystroke mood inference, no location tracking. Monitoring is limited to what the patient explicitly logs.
- **P0 ships no push notifications** — the app has no push infrastructure today; check-ins surface in the existing Today feed until P1.
- **P0 ships no care-team review queue and no backend** — the prototype is localStorage-only. Any clinician-facing queue, outreach workflow, or EHR write-back is P1/P2 and gated on a HIPAA-compliant backend.
- **No involuntary intervention.** The app never contacts a third party or authority on the user's behalf without the user's explicit action; it equips and routes the user.

## How It Builds on Existing Primitives

This feature is an *extension* of shipped primitives, not a new stack. File references below are verified against the current tree.

**1. The coach + safety gate is the crisis backbone.** `decideSafety()` in `src/ai/safety-gate.ts` returns a `SafetyDecision` union — today exactly `hard_escalate | soft_escalate | soft_block | allowed` (lines 9–13) — and `createSafeAiResponse()` short-circuits on `hard_escalate` so **the provider is never called** (lines 115–122), returning `actions: ["call_clinic", "draft_message"]`. We extend it:

- Add a **crisis pattern group** to `classifySafety()` in `src/domain/safety.ts` (a new array alongside `urgentSymptomPatterns` and `medicationChangePatterns`), returning a new classification the gate can read.
- Add a **structured, non-text signal**: PHQ-9 **item 9 > 0** flows into `decideSafety()` from the `AssessmentEvent` on the request, so crisis detection does **not** depend on free-text matching.
- Add a new decision kind, `crisis_escalate`, and evaluate it **as the first check inside `decideSafety()`, before the `recentClinicalReading` block at line 48.** This is the precise fix for "crisis outranks dangerous vitals": because stored-reading hard-escalations are currently evaluated before free-text `inputSafety` (lines 48–86), simply putting crisis "before other branches" is not enough — it must be the literal first branch. A co-occurring hypertensive reading can then never demote a suicidality disclosure.
- Extend `AiMessageAction` in `src/domain/types.ts` (currently `"call_clinic" | "draft_message"`, line 102) with `"crisis_call_988" | "crisis_text_988" | "call_emergency" | "safety_plan"`.
- Extend the `HealthAiResponse` handling so a crisis decision returns a **fixed, human-authored constant string** (not `providerResponse.content`), mirroring the existing `hard_escalate` short-circuit.

**2. The medication-adherence loop is the tracking-loop template.** `getAdherenceRate()` and `getAdherenceStreak()` in `src/domain/adherence.ts` compute dated, patient-reported metrics. A PHQ-9 completion is structurally a `DoseEvent`-like record (`src/domain/types.ts:171`): a dated, patient-reported measurement with an evidence status. We add an `AssessmentEvent` record and a `computeTrend()` analog to `getAdherenceRate()`. The `MedicationBarrier` enum (`types.ts:35`) is the template for **engagement barriers** (`no_energy`, `no_time`, `did_not_help`, `too_anxious`) so the escalation wiring already understands "patient hit a barrier."

**3. The condition-lens pattern gives us behavioral-health lenses.** `src/domain/condition-lens.ts` groups persona focus + rules + model guidance per `Condition`. Today `Condition = "hypertension" | "diabetes" | "obesity"` (`types.ts:19`). We add a parallel `BehavioralCondition` union (keeping behavioral lenses separate from the BP-oriented `Condition` to avoid polluting the food/vitals code paths) and author `depressionLens` / `anxietyLens` / `alcoholLens` / `isolationLens` with module content and coaching guidance, exactly as `hypertensionLens` drives food guidance today.

**4. Care-team messaging and the brief already exist.** `buildCareTeamMessage()` in `src/domain/care-team-message.ts` composes a plain-text summary from on-device state and **sends nothing** — we add a behavioral variant (recent PHQ-9/GAD-7/AUDIT-C, trend direction, item-9 status, barriers). `buildTodayTasks()` in `src/domain/tasks.ts` already ranks urgent > threshold > barrier > prep; we add behavioral task kinds into that same ranked feed (extending the `TaskItem.kind` union, `types.ts:77`). The Health Brief (`HealthBrief`, `types.ts:116`) gains a behavioral section reusing its `EvidenceStatus`-per-section shape.

**5. The system prompt and evidence model carry over unchanged in spirit.** `healthAiSystemPrompt` in `src/ai/prompts.ts` already forbids diagnosing, prescribing, and changing doses, and requires evidence labels (`confirmed` / `patient-reported` / `imported` / `inferred` / `needs review`, per `EvidenceStatus`, `types.ts:1`). Behavioral guidance is authored against the same contract; screening scores are always labeled `patient_reported`, never `confirmed` and never rendered as a diagnosis.

**6. Everything persists through the existing reducer + audit trail.** New `AppState` fields (`types.ts:181`) flow through `src/state/store.tsx`, auto-audited via `recordAuditEvent()`. Note: `AuditEvent.action` today is `"created" | "updated" | "ai_generated" | "shared" | "exported" | "deleted"` (`types.ts:130`) — it has **no escalation type**, so we add `"crisis_escalated"` (and `"assessment_recorded"`, `"escalation_raised"`) to that union. Privacy/export/delete inherit from the existing `/privacy` surface.

## Key User Flows

**Flow 1 — Weekly check-in and measurement-based escalation (patient → care team).**
1. A behavioral check-in appears in the Today feed via `buildTodayTasks()`. Maria taps it.
2. She completes a PHQ-9 (9 items + functional-impact item). The app computes the score in **plain code** (no model), stores an `AssessmentEvent` (`status: "patient_reported"`), and compares against her prior scores via `computeTrend()`.
3. Outcome branches:
   - **Improving / stable + minimal:** encouraging message, next check-in scheduled, no escalation.
   - **"Not responding" rule met** (configurable; e.g., <50% reduction from baseline after a treatment interval): `soft_escalate` — banner + `draft_message` prefilled with the **trend data only**. The banner says "your scores haven't improved as much as we'd hope — worth talking with your care team," never "your medication needs changing."
   - **"Deterioration" rule met** (severity-band worsening, or entry into moderately-severe/severe): `soft_escalate` with a stronger banner and a "share today" task.
   - **Item 9 > 0 (any self-harm thoughts):** `crisis_escalate` — see Flow 3, regardless of total score.
4. The clinician sees the trajectory and flag in the behavioral brief at the next visit (P0) or in the review queue (P1).

**Flow 2 — Guided behavioral activation between visits (patient side).**
1. Maria opens the `depressionLens` behavioral-activation module. The coach (Sonnet, streaming) walks her through scheduling one small values-based activity, grounded in her plan summary.
2. She commits and logs completion the next day; if she skips, she picks an engagement barrier (`no_energy`, `did_not_help`, …).
3. Repeated `did_not_help`/no-completion barriers feed the trend engine; persistent non-engagement **plus** a flat or worsening PHQ-9 raises a `soft_escalate` ("skills practice isn't landing — worth a clinician touch").
4. Every coach turn passes through `createSafeAiResponse()`, so a crisis disclosure mid-exercise instantly overrides the module.

**Flow 3 — Crisis disclosure and warm handoff (the non-negotiable path).**
1. Sam types "I don't want to be here anymore," **or** answers PHQ-9 item 9 above zero.
2. `decideSafety()` returns `crisis_escalate` **as its first branch, before any provider call and before the reading/vitals checks.** The response is a **fixed, human-reviewed constant** — never model-generated free text — presenting: 988 Suicide & Crisis Lifeline (call and text), emergency services, the patient's own clinic contact from `PatientProfile.primaryClinicPhone`, and an optional grounding safety-plan view. Rendered in `PatientProfile.language` (`en`/`es`).
3. The event is recorded to the audit trail as a distinct `crisis_escalated` type and (P1) placed at the top of the care-team review queue as "urgent — behavioral."
4. The coach does **not** resume normal conversation until the user acknowledges the crisis resources; it will not answer an unrelated question that turn.

**Flow 4 — Clinician review and visit prep (care-team side).**
1. Before Maria's visit (P0: at the visit, via the printed/exported Health Brief; P1: in the CoCM review queue) the clinician opens the behavioral brief: PHQ-9/GAD-7/AUDIT-C trajectories with dates, item-9 history, medication-adherence correlation, engagement/barriers, and escalation events — each carrying an `EvidenceStatus`.
2. The clinician acts (adjust treatment, add referral, schedule). Their decision is entered as a `confirmed` fact; the app pre-fills only the data, never the clinical decision.

## Functional Requirements

- **FR-1 — Validated instruments.** The app shall administer PHQ-9, GAD-7, AUDIT-C, and a brief loneliness measure (UCLA-3 or De Jong Gierveld — see FR-18) using standard, **unmodified** item wording and standard scoring. Each completion is stored as an `AssessmentEvent { instrumentId, itemResponses, totalScore, severityBand, status: "patient_reported", recordedAt }`.
- **FR-2 — Trend computation (deterministic).** The app shall compute, per instrument, current score, baseline (first score), change from baseline, severity band, and direction (improving/stable/worsening) via a pure `computeTrend()` function analogous to `getAdherenceRate()` in `src/domain/adherence.ts`. No model is involved.
- **FR-3 — Measurement-based escalation rules (surface, don't prescribe).** The app shall raise a `soft_escalate` when a **configurable** "not responding" rule or "deterioration" rule is met, attaching a banner and a prefilled care-team **draft containing trend data only**. The banner and draft shall never recommend a specific medication or treatment action.
- **FR-4 — Crisis detection (dual-source).** The app shall trigger `crisis_escalate` when **either** (a) PHQ-9 item 9 response > 0, **or** (b) free-text input matches the crisis pattern group in `classifySafety()`. Item-9 detection shall not depend on free-text matching. (b) is a supplementary net, not a completeness guarantee — see the residual-risk note in Safety.
- **FR-5 — Crisis ordered first.** In `decideSafety()`, `crisis_escalate` shall be the **first branch evaluated, before the `recentClinicalReading` block (currently line 48)** and therefore before dangerous-vitals `hard_escalate`, urgent-symptom, and medication branches. A crisis signal can never be demoted or suppressed by any co-occurring signal. This ordering is enforced by an explicit unit test (see Testing bar).
- **FR-6 — Provider bypass on crisis.** On `crisis_escalate`, the AI provider shall not be called. The returned `content` shall be a fixed, human-reviewed constant string, with crisis actions (`crisis_call_988`, `crisis_text_988`, `call_emergency`, `safety_plan`) and the patient's clinic contact — mirroring the existing `hard_escalate` short-circuit at `safety-gate.ts:115`.
- **FR-7 — Crisis resource surface.** The crisis response shall present 988 (call and text), emergency services (`tel:` dialer), the patient's own clinic phone from `PatientProfile.primaryClinicPhone`, and an optional safety-plan view, localized to `PatientProfile.language`. Deep links must function without a network round-trip (offline-to-dialer).
- **FR-8 — No suppression / no burial.** The coach shall not return a normal answer in the same turn as a crisis escalation, and shall require explicit acknowledgment of crisis resources before resuming normal conversation.
- **FR-9 — Guided modules.** The app shall provide guided CBT/behavioral-activation, alcohol brief-intervention, and social-connection modules driven by behavioral-health lenses (`depressionLens`, `anxietyLens`, `alcoholLens`, `isolationLens`) extending the `ConditionLens` pattern in `src/domain/condition-lens.ts`.
- **FR-10 — Engagement barriers.** Skipping a skill/activity shall prompt a barrier selection reusing the `MedicationBarrier` taxonomy pattern; persistent non-engagement plus a flat/worsening trend shall raise a `soft_escalate`.
- **FR-11 — Medication scope preserved.** All existing `medicationChangePatterns` blocks (`src/domain/safety.ts:6`) shall remain in force, including for psychotropics; the app shall never advise starting, stopping, or adjusting any medication.
- **FR-12 — Behavioral care-team message.** The app shall generate an on-device behavioral summary (recent scores, trend, item-9 status, barriers) via a variant of `buildCareTeamMessage()`; it shall send nothing automatically.
- **FR-13 — Behavioral brief.** The Health Brief shall gain a behavioral section with per-item `EvidenceStatus`, showing trajectories, adherence correlation, and escalation history.
- **FR-14 — Today feed integration.** Behavioral check-ins and skills tasks shall surface through `buildTodayTasks()` and respect its existing priority ranking.
- **FR-15 — Full audit.** Every assessment, escalation (especially crisis), module completion, and care-team draft shall be recorded via the existing audit trail (new `AuditEvent.action` values `assessment_recorded`, `escalation_raised`, `crisis_escalated`) and inherit `/privacy` export/delete.
- **FR-16 — Consent + disclaimer gate.** First entry into behavioral health shall require an explicit acknowledgment that the feature is not a crisis service, not therapy, and not a substitute for care, with 988 always one tap away thereafter.
- **FR-17 — Fail-safe defaults.** If trend computation, provider, or storage fails, the app shall degrade toward *more* escalation, never less. Crisis patterns and item-9 detection are evaluated client-side and independent of the provider, so a provider outage cannot disable crisis routing.
- **FR-18 — Instrument licensing gate.** Before shipping the exact item wording of any instrument, licensing shall be confirmed. PHQ-9/GAD-7/AUDIT-C are freely usable; the chosen loneliness measure's license shall be verified (De Jong Gierveld and UCLA-3 have differing terms). Ship no unlicensed wording.

## Data, Devices & Integrations

**Data captured (all patient-entered; no passive sensing):** instrument responses and scores (`AssessmentEvent`), module completions and engagement barriers (`ModuleProgress`), coach transcripts (existing `aiMessages`), crisis-escalation events, and behavioral care-team drafts. Baseline = first score per instrument.

**New/extended `AppState`** (via `src/domain/types.ts` + `src/state/store.tsx` reducer): `assessmentEvents: AssessmentEvent[]`, `behavioralModules: ModuleProgress[]`; extend `AiMessageAction`, `AuditEvent.action`, `TaskItem.kind`; add a `BehavioralCondition` union and lenses. Persisted through the existing localStorage path in the prototype.

**Devices:** No new hardware. The differentiator versus the rest of the app is that behavioral health is self-report, not sensor-driven. Where the same patient uses the BP cuff (`HomeReading`), the brief may correlate mood trend with cardiovascular readings and adherence, but no wearable, actigraphy, or passive signal is used. Explicitly out of scope: microphone/voice sentiment, phone-usage inference.

**External systems (phased; none required for P0):**
- **988 Suicide & Crisis Lifeline** — deep links to call/text (`tel:988`, SMS to 988). No API dependency; must work offline-to-dialer. **P0.**
- **EHR / FHIR** — write PHQ-9/GAD-7 as FHIR `Observation`/`QuestionnaireResponse` back to the clinician's system (**P2**). Enables the CoCM registry and clinician review at the source of truth.
- **Community-resource networks** (211 / Unite Us / Findhelp) — local social/community referrals for the isolation lens (**P2**).
- **Pharmacy** — reuse the existing adherence loop for psychotropic fills; no new integration in P0.

**AI model assignment** (favor Haiku high-volume, Sonnet analysis/generation; stream chat):
- **Deterministic, non-AI** — instrument scoring, crisis pattern matching, item-9 detection, and trend rules are **plain code**. Crisis routing must never depend on an LLM decision.
- **Haiku** — high-volume, low-stakes copy: check-in nudges, barrier prompts, short encouragement, routine module summarization.
- **Sonnet (streaming)** — the coaching conversation: behavioral-activation guidance, CBT reframes, alcohol brief intervention, behavioral-brief narrative. Every Sonnet turn still passes through `createSafeAiResponse()`.
- **Realtime (voice)** — the existing WebRTC voice path may later carry spoken check-ins for low-literacy/low-vision users; crisis detection still runs on the transcript client-side.

## Safety, Scope & Liability Guardrails

This section is non-negotiable and drives the test suite.

**Scope-of-practice boundary.** The app **screens, tracks, coaches, and routes.** It does **not** diagnose, does not assign or interpret a diagnosis from a score, does not prescribe or adjust medication, does not recommend a specific treatment action, and does not provide psychotherapy or live crisis counseling. `healthAiSystemPrompt` (`src/ai/prompts.ts`) already encodes "do not diagnose, prescribe, change medication doses, or replace emergency care"; behavioral content is authored against that same contract, and instrument outputs are labeled screening severity, never diagnosis.

**The FDA CDS / SaMD line (design constraint, not just a risk).** Trend-based escalation is engineered to stay on the **non-device Clinical Decision Support** side of the line: the app surfaces the patient-entered data and the trend to a *human* who can independently review the basis, and it does **not** issue a specific, directive, time-critical treatment recommendation the clinician is expected to follow without independent review. Every escalation is a *draft + flag for a human*, never an autonomous clinical directive. Any change that makes the app recommend a specific clinical action would move it toward regulated SaMD and requires regulatory review first.

**Crisis escalation triggers (concrete).**
- PHQ-9 **item 9 > 0** (any nonzero response) → `crisis_escalate`, always, regardless of total score.
- Free-text crisis language matched by the new pattern group in `classifySafety()` (ideation, intent, plan, self-harm) → `crisis_escalate`.
- Crisis is the **first branch in `decideSafety()`**, outranking dangerous-vitals, urgent-symptom, and medication branches.

**Crisis behavior (hard guarantees, mirroring the existing "provider is never called" property).**
- On crisis the provider is bypassed and a **fixed, human-reviewed constant** is returned — no model free-text in a crisis turn (FR-6).
- The message presents 988 call/text, emergency services, the patient's own clinic contact, and a safety-plan view (FR-7), localized.
- The coach cannot answer a normal question in a crisis turn and cannot be "talked past" until resources are acknowledged (FR-8).
- Crisis routing is **client-side and provider-independent**, so an API outage, a mock↔live provider swap, or a network failure cannot disable it (FR-17).

**Residual false-negative risk (stated plainly, not marketed away).** Free-text pattern matching will miss obfuscated, indirect, coded, or negated ideation ("I would *never* hurt myself," "I'm just tired of everything"). Item-9 is the primary structured net; free-text is a supplementary net. The system biases toward escalation when uncertain, but **detection is not complete**, and product/marketing copy must never claim it is. This residual risk is disclosed in the consent gate.

**Human-in-the-loop.** The app never makes a clinical decision. Escalations produce **drafts and flags** for a human — the patient chooses to send, the clinician chooses to act. Where a practice runs CoCM, the care manager owns the review queue (P1). The app never contacts a third party or authority without the user's explicit action.

**Safety banner reuse.** The existing prominent `banner` + `actions` pattern on `HealthAiResponse` is the interaction language for every behavioral escalation, so the crisis surface is consistent with what patients already trust in the coach.

**Audit trail.** Every assessment, module, escalation, and especially every crisis event is written through the existing audit trail with a distinct action type and is exportable/deletable via `/privacy` — supporting patient transparency and clinical/legal defensibility.

**Failure modes explicitly handled.**
- Provider down → crisis + scoring still work (deterministic, client-side); coaching degrades to static psychoeducation with the banner intact.
- Ambiguous free text the classifier misses → item-9 structured signal is the second independent net; when uncertain, escalate (bias toward safety).
- Score entered but network lost → event stored locally, escalation fires locally, care-team draft still generated.
- User dismisses crisis resources → resources remain one tap away and the event is still audited; the app does not "forget" the disclosure that session.

**Testing bar (crisis path = highest coverage in the repo).**
- Unit tests over the `classifySafety()` crisis patterns, including obfuscated/indirect phrasing and **negation traps** ("I would never hurt myself" must not misfire *and* real ideation must fire).
- A unit test asserting **item-9 > 0 always yields `crisis_escalate` independent of total score.**
- An **ordering test** asserting `crisis_escalate` is returned even when a dangerous-vitals stored reading is present — proving crisis is the first branch in `decideSafety()`, ahead of the `recentClinicalReading` block.
- A **provider-bypass test** asserting the provider is never invoked on a crisis turn and `content` equals the fixed constant.
- A **no-burial test** asserting a crisis turn never returns a normal answer even when the input also contains an unrelated question.
- A Playwright E2E asserting the crisis surface renders 988 (call + text) and cannot be dismissed into a normal answer.
- All of the above run in `npm run check` (lint + test + build) and block merge.

## Success Metrics

Split into what P0 can measure **on-device**, and what requires the **P1/P2 backend** — the original draft conflated the two.

**Guardrail metrics (safety — continuous, never traded for growth):**
- **Crisis-routing correctness (test + CI):** 100% of item-9 > 0 cases and the curated true-positive crisis-phrasing corpus produce `crisis_escalate` in the test suite. Baseline: n/a (new). Target: 100%; any regression is a Sev-1 that blocks merge. *Measurable at P0 in CI.*
- **Crisis provider-bypass (test + CI):** 100% of crisis turns bypass the provider. Target: 100%. *Measurable at P0 in CI.*
- **False-negative clinical audit (P1, needs backend):** periodic clinician review of a transcript sample for missed disclosures; target trend toward zero. *Requires the review backend — P1.*

**Leading indicators — measurable on-device at P0 (from `AppState`, per-patient, no backend):**
- **Check-in completion rate** — completed vs. scheduled check-ins in the local record. Baseline: 0 (new). Target P1 cohort: ≥50% of enrolled patients complete ≥1 check-in every 2 weeks.
- **Measurement-based-care coverage** — % of enrolled patients with ≥2 dated `AssessmentEvent`s per instrument (vs. the paper-visit baseline of typically one). Target: ≥70%.
- **Module engagement** — % starting and % completing ≥1 behavioral module. Target: ≥40% start, ≥25% complete.
- **Escalation-surfaced volume** — count of `soft_escalate` and `crisis_escalate` events generated. Directional at P0; becomes actionable when a review queue exists.

**Lagging indicators — require the P1/P2 backend + cohort (explicitly deferred):**
- **Time-to-escalation-surfaced** — median days from a rule firing to the clinician seeing it. *Needs the review queue (P1).* Target: same week.
- **Depression response/remission** — % of treated patients with ≥50% PHQ-9 reduction (response) and PHQ-9 <5 (remission) by ~12–16 weeks, in-panel cohort vs. matched comparison. *Needs a backend, a cohort, and a comparator — P2 analytics, not P0.* This is the outcome the feature ultimately exists to move.
- **Anxiety improvement / hazardous-drinking reduction / isolation improvement** — clinically meaningful GAD-7 / AUDIT-C / loneliness-score change at follow-up. *P2.*
- **Treatment-adjustment timeliness** — median weeks from "not responding" to a documented clinician change vs. historical interval. *P2, needs EHR write-back.*
- **Behavioral-related ED utilization (exploratory, confounded)** — directional only; interpreted cautiously. *P2.*

## Phasing

**P0 — Thin, shippable MVP (measurement + crisis backbone; localStorage-only, no backend).**
- PHQ-9 and GAD-7 check-ins as `AssessmentEvent`s; deterministic scoring + severity bands.
- `computeTrend()` and the "not responding" / "deterioration" `soft_escalate` rules (surface-and-route only).
- **Full crisis path:** `crisis_escalate` as the first branch in `decideSafety()`, item-9 + free-text dual detection, provider bypass, fixed 988/emergency/clinic surface, no-burial guarantee, complete test suite in `npm run check`. *(Crisis ships in P0 — it is the backbone, not a later add-on.)*
- Behavioral section in the Health Brief; behavioral variant of `buildCareTeamMessage()`; check-ins in the Today feed; consent/disclaimer gate; audit + `/privacy` coverage.
- **Explicitly NOT in P0:** AUDIT-C/alcohol module, loneliness measure/`isolationLens`, guided CBT coaching modules, push notifications, care-team review queue, any backend, any EHR write-back.
- Independently valuable: a family doctor gets real measurement-based-care tracking and a tested crisis path with zero new infrastructure.

**P1 — Coaching + care-team workflow (first backend dependency).**
- `depressionLens` / `anxietyLens` guided CBT/behavioral-activation modules (Sonnet, streaming) with engagement-barrier tracking.
- AUDIT-C + alcohol brief intervention; loneliness measure (licensed) + `isolationLens`.
- Push/notification reminders (new infra) replacing Today-feed-only nudges.
- Care-manager **review queue** (crisis + not-responding at top) — the human-in-the-loop surface for CoCM. **Requires a HIPAA-compliant backend with a BAA, encryption, and access controls.**
- Independently valuable: closes the coaching loop and gives practices a workflow to act on flags.

**P2 — Integration + reimbursement.**
- FHIR write-back of PHQ-9/GAD-7 (`Observation`/`QuestionnaireResponse`) into the EHR; CoCM registry export.
- Community-resource referrals (211/Findhelp) for the isolation lens; pharmacy loop for psychotropic fills.
- Reporting to support CoCM CPT billing (99492–99494, 99484) and BHI.
- Lagging-indicator outcome analytics (response/remission cohort vs. comparison).
- Independently valuable: makes the feature billable and embeds it in the clinician's system of record.

## Open Questions & Risks

- **Regulatory / SaMD line (top gating risk).** Screening + patient-entered tracking + education + routing likely sits in lower-risk / non-device CDS territory, but **trend-based escalation rules that prompt clinician action edge toward regulated SaMD.** Requires regulatory/clinical review before P0 ships. Design intent is to stay firmly on the "surface data + route to a human, no autonomous directive" side of the FDA CDS boundary; that intent is now encoded in FR-3 and the Safety section but must be legally confirmed.
- **HIPAA / persistence / 42 CFR Part 2.** The prototype is localStorage-only. Behavioral health data is especially sensitive, and substance-use data may implicate **42 CFR Part 2**, which imposes stricter consent-to-disclose rules than baseline HIPAA. Any backend, review queue, or EHR write-back requires a BAA, encryption at rest and in transit, access controls, and a Part 2-aware consent design. **What is the persistence and hosting plan beyond the prototype, and does it segregate Part 2 data?** This gates all of P1/P2.
- **Crisis liability + duty to warn.** The app equips and routes but does not intervene. Where a jurisdiction imposes duty-to-warn obligations, does surfacing item-9 to the care team create obligations, and how fast must the review queue respond? Legal review required. **`PatientProfile.primaryClinicPhone` must be current or the "call your clinic" action misfires** — a stale number is a safety defect; add a validation/verification step for it.
- **Reimbursement.** CoCM/BHI CPT codes require a defined care-manager role, a treatment plan, and registry tracking. Which target practices actually run CoCM, and does the review-queue design satisfy the required documentation?
- **Instrument licensing.** PHQ-9/GAD-7/AUDIT-C are freely usable; the loneliness measure's licensing must be confirmed before shipping its exact wording (FR-18).
- **False-negative and false-reassurance risk.** Free-text detection is incomplete; a patient improving on paper while functionally deteriorating, or under-reporting item 9, is a residual risk the functional-impact item and free-text net only partially mitigate. Marketing must never overstate safety or detection completeness.
- **Clinician alert fatigue.** Over-sensitive rules flood the queue and bury real signal. Escalation thresholds must be clinician-tunable and validated against real panels before P1 scale-out.
- **Dependencies.** Push notifications (P1) and any care-team surface require infrastructure the prototype lacks; FHIR write-back (P2) depends on per-EHR integration and partner practices.

---

*Two load-bearing engineering decisions to preserve if implemented: (1) the crisis-path test bar in `npm run check`, and (2) `crisis_escalate` evaluated as the **literal first branch** of `decideSafety()`, ahead of the `recentClinicalReading` block — so a co-occurring dangerous reading can never demote a suicidality disclosure.*
