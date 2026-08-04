# Reaching the Unreached — Voice-First, Multilingual, Low-Literacy Access

**Status:** implemented — `src/voice/*`, `src/i18n/*`, `src/domain/accessibility.ts`. Verified 2026-08-04.

> A cross-cutting access layer that lets patients use the whole Patient Centered app by voice, in their language, at a low-literacy reading level, with an SMS/phone fallback for people who can't or won't type — generalizing the Food Lens voice+camera pattern into universal access for rural, uninsured, low-literacy, LEP, elderly, and vision-impaired patients. **The load-bearing safety property is that every new channel is a new *renderer* of the one deterministic escalation decision — never a new path around it.**

*Date: 2026-07-05 · Status: product design record (draft PRD for review) · Suggested path: `C:\Patient centered\docs\reaching-the-unreached-access-design-spec.md`*

## Problem & Upstream Rationale

The patients who benefit most from upstream chronic-disease management are systematically the ones who never engage a portal. In a family-medicine panel, the patient with uncontrolled hypertension who no-shows is disproportionately the one with a 6th-grade reading level, limited English proficiency (LEP), no reliable broadband, or age-related vision loss. Tooling built for the motivated, English-literate, smartphone-fluent patient actively selects *against* them.

The scale is not marginal. In the U.S., roughly 36% of adults have basic or below-basic health literacy (2003 National Assessment of Adult Literacy — dated, but the most-cited national figure), about 8% of the population is LEP (U.S. Census / ACS), and a large share of older adults live with vision impairment that makes small-type interfaces hard to use. Hypertension is the most prevalent modifiable cardiovascular risk factor (~47% of adults by the 2017 ACC/AHA threshold), and control rates sit near 1 in 4 among those diagnosed — worse in exactly the under-reached groups above. LEP patients have measurably worse glycemic and blood-pressure control and higher rates of communication-linked adverse events. *(All prevalence figures are directional context for prioritization, not clinical claims made to patients; none are surfaced in-product.)*

The episodic 15-minute visit fails these patients twice. First, the visit is compressed and often mediated by an ad-hoc interpreter (or none), so teach-back and plan comprehension are shallow. Second, everything that determines outcomes — daily BP measurement, taking the ACE inhibitor, reading a food label, knowing when a symptom means "get help now" — happens in the ~8,700 hours a year the patient is *not* in the room, on tools they can't read or type into. "Moving care upstream" here means the between-visit surface (Coach, the medication loop, home readings) must reach the patient through the channel they actually have: their voice, their language, a spoken prompt instead of a typed one, and — when the smartphone or data plan isn't there — a text or a phone call.

Food Lens already proved the primitive: voice + camera, no typing, condition-aware coaching, with a live/mock split (`src/hooks/use-food-voice-session.ts`, `src/ai/realtime-session.ts`). This feature generalizes that asset. For this population, voice-first *is* the access, not an accessibility nicety. "Access they've never had" is concrete: a Spanish-speaking grandmother with a 4th-grade reading level, a low-end Android on prepaid data, and cataracts can log a blood pressure, hear why her lisinopril matters, and — when a reading is dangerous — hear in Spanish a clear instruction to get urgent help, without reading or typing a word.

## Target Users

**Patients (primary personas):**
- **Rosa, 68, Spanish-speaking, LEP, low-literacy.** Type 2 diabetes + hypertension. Smartphone her daughter set up but never uses the portal. Speaks to a phone; cannot comfortably read a paragraph or type. Needs the app in Spanish, spoken, at a plain-language level.
- **Earl, 74, English, vision-impaired, rural.** Post-MI, four medications, intermittent 3G. Uses a screen reader inconsistently; struggles with small tap targets. Needs large-type, screen-reader-clean UI, offline tolerance, and an SMS/phone path when data drops.
- **Dawn, 41, English, low-literacy, uninsured, unstable housing.** Newly diagnosed hypertension at a free clinic. No home BP cuff, shares a prepaid phone. Reachable mainly by SMS. Needs the plan and reminders as texts and to reply to a check-in by text.
- **Minh, 55, Vietnamese-speaking, LEP.** Represents the long tail beyond the two seeded languages (en/es). Needs the architecture to add languages without re-architecting.

**Care team (who does the work):**
- **Family physician / PCP** — authors the care plan and call thresholds everything keys off; reviews the Health Brief; receives escalations. Wants trustworthy, source-labeled patient-reported data and fewer avoidable acute visits — not a new inbox to babysit.
- **Clinic RN / MA / care coordinator / CHW** — the human on the other end of `call_clinic` / `draft_message`; runs outreach for patients who escalate or go quiet. Benefits from structured, translated summaries so the language barrier lands on the tool, not on an interpreter scramble.
- **Clinic interpreter / language services** — today pulled into every LEP touchpoint; benefits from the app carrying routine coaching in-language so scarce interpreter time is reserved for clinical decisions.

## Goals & Non-Goals

**Goals**
- Make the core loops of every existing surface (Today, Coach/chat, Medicines, Numbers, Food) operable **voice-first**: a patient can complete them by speaking and listening, without typing.
- Ship **multilingual** — `PatientProfile.language` drives UI strings, TTS/STT locale, Coach responses, and safety banners; extend beyond en/es without re-architecting.
- Enforce **low-literacy plain language**: target ~5th–6th grade reading level for patient-facing copy.
- Provide **offline / low-bandwidth tolerance** for the safety-critical loops (log a reading, log a dose, read the cached plan, hear the local safety banner), degrading gracefully.
- Provide an **SMS/phone fallback** for reminders, one-question check-ins, and escalation for patients without a usable smartphone/data plan.
- Meet **WCAG 2.1 AA** on the patient surfaces that carry the core loops.
- **Preserve the existing deterministic safety gate and escalation semantics on every channel — voice and SMS must escalate exactly as typed text does today, with no channel able to reach the patient without passing through `createSafeAiResponse()`.**

**Non-Goals**
- **Not** a real-time human interpreter service and **not** a replacement for certified medical interpreters in clinical encounters.
- **Not** diagnosing, prescribing, or changing doses in any language or channel — the scope-of-practice boundary is unchanged and enforced deterministically, not just by prompt.
- **Not** a translation-memory / CAT pipeline; P0 uses vetted static strings + LLM translation of dynamic content, with human review of the **safety-critical subset only**.
- **Not** guaranteeing every language at P0; the architecture must *accept* new languages, but only en/es (P0) and 2–3 more (P1) are committed.
- **Not** a full IVR phone tree carrying the app — the phone path is a narrow fallback (reminders, one-question check-ins, an escalation instruction to call the clinic/urgent care), not a parallel product.
- **Not** a new clinician dashboard — care-team interaction stays the existing one-way message + `call_clinic` model through P1.
- **Not** promoting `i18n/strings.ts` from a Food-Lens dictionary to app-wide coverage *in one step* — see the fidelity note; full-app string extraction is scoped explicitly, not assumed done.

## How It Builds on Existing Primitives

This is deliberately an *extension layer*, not a new vertical. **A fidelity note up front, because it changes scope:** two of the primitives the naive plan leans on are narrower than they look, and the spec treats closing that gap as real work, not a rename.

- **The deterministic safety gate is the escalation spine — and today the live voice path does not go through it.** Typed Coach turns route through `createSafeAiResponse()` (`src/ai/safety-gate.ts`) → `classifySafety()` (`src/domain/safety.ts`), whose decision tree is: **hard escalate** (urgent-symptom phrases; dangerous vitals SBP ≥180 / DBP ≥120 / SBP <90 / DBP <60 via `hasDangerousBloodPressure`; an active `side_effects` barrier plus a side-effect mention) → *the escalation is the whole answer and the provider is never called*; **soft escalate** (a reading at/above the care plan's `callThreshold`, via `findRecentClinicalReading`) → answer **plus** banner + actions; **soft block** (medication-change patterns) → answer, but decline the change and offer `draft_message`. **But** the live realtime path (`connectRealtimeSession`) streams model audio **directly from OpenAI to the patient's browser over WebRTC** (client secret minted at `src/app/api/realtime/token/route.ts`); its `injectContext()` pushes context as a user message and the model's spoken reply never passes back through `classifySafety()`. **Bringing voice to safety parity is therefore a first-class requirement (FR-6a), not an assumed property.** The gate stays the single source of truth; each channel becomes a new *renderer* of its `banner` + `actions`.
- **Food Lens voice+camera as the reference implementation — with a real generalization cost.** The session-handle contract (`sendUserText()`, `updateInstructions()`, `close()`, `getStatus()`) and the event reducer (`reduceRealtimeEvent()`) are genuinely surface-agnostic and lift cleanly into a `useVoiceSession()` hook. The **injected context is not**: `injectContext()` and `buildFoodLensInstructions()` are food-coupled (`identifiedFood`, `flagTexts`, camera frame). Generalizing means parameterizing the instruction builder and the context payload per surface (Coach / Numbers / Medicines), not just renaming the hook.
- **Medication-adherence loop becomes a voice/SMS loop.** The barrier taxonomy (`MedicationBarrier`), `DoseEvent`, `logDose`, `getAdherenceStreak` / `getAdherenceRate` / `summarizeBpTrend` (`src/domain/adherence.ts`) are unchanged. We add spoken and SMS ways to answer "did you take your morning medicine?" and name a barrier.
- **Care-team draft exists but is English-only today.** `buildCareTeamMessage(state)` (`src/domain/care-team-message.ts`) takes **no language argument** and hardcodes English phrasing. "Rendered in the clinic's language while the patient interacts in theirs" requires extending its signature (`buildCareTeamMessage(state, clinicLocale)`); the patient-facing side is separate. This is scoped, not assumed.
- **i18n foundation is Food-Lens-scoped, not app-wide.** `src/i18n/strings.ts` today defines only `FoodLensStringKey` (a Food Lens dictionary) with `t(language, key, vars)` and en/es maps. Promoting it to the source of truth for **all** static copy means extracting strings from every patient surface into keyed entries — a real, sized workstream, not a switch flip. `PatientProfile.language` is currently typed `"en" | "es"`; widening it to a locale string is a one-line type change plus every consumer.
- **Plain-language + evidence labeling already in the DNA.** `healthAiSystemPrompt` (`src/ai/prompts.ts`) already forbids diagnosis/prescribing and mandates evidence labels (confirmed / patient-reported / imported / inferred / needs-review). `summarizeBpTrend` already appends "This is general education, not a diagnosis." We add a plain-language + target-language directive to the **same** prompt string; `CarePlan.plainLanguageSummary` is the low-literacy template.
- **Offline-first is already a pattern to extend.** Food barcode lookup degrades seed → OpenFoodFacts → USDA → not-found (`src/domain/food-lookup.ts`); all state is localStorage-backed (`src/state/storage.ts`). We extend this to cache TTS audio and translated static strings and to queue dose/reading logs for replay. **Crucially, `classifySafety()` and the threshold checks are pure functions over local state, so the hard/soft escalation banner already fires with no network — this is verified in the code, not aspirational.**
- **State, tasks, brief, audit — extend, don't fork.** New reducer actions (`setLocale`, `logDoseByVoice`, `logDoseBySms`) follow the single-reducer + `recordAuditEvent()` pattern (`src/state/store.tsx`). `buildTodayTasks()` (`src/domain/tasks.ts`) — which already emits distinct "Seek urgent help now" vs. "Share this reading with your care team" tasks — gains channel-aware rendering; `buildHealthBrief()` (`src/domain/health-brief.ts`) gains language + preferred-channel fields.

## Key User Flows

**Flow 1 — Rosa logs a dangerous blood pressure by voice, in Spanish (patient side). *[Corrected for fidelity to the real gate.]***
1. UI is in Spanish because `PatientProfile.language = "es"`. Rosa taps one large "Hablar" button and says "Mi presión es 182 sobre 96."
2. STT (Spanish locale) parses SBP 182 / DBP 96 into a candidate `HomeReading`, shown large-type and read back: "182 sobre 96. ¿Correcto?" She says "Sí." **Read-back gates only the *committed value*, never the safety banner (see FR-3).**
3. On commit, `classifySafety` sees SBP ≥180 → **hard escalate**. This is an **emergency-framed** outcome, not a "call the clinic when convenient" one: the spoken + large-type banner is the Spanish rendering of the gate's urgent message — "Esto puede necesitar ayuda urgente. Si es una emergencia, busque ayuda de inmediato." The **primary** action is get-urgent-help; `call_clinic` (tap-to-call the clinic) and `draft_message` (auto-drafted care-team summary, in the clinic's English) are secondary. *(This corrects the original draft, which routed 182 to a "call_clinic" button; the code emits the emergency message for dangerous vitals, and conflating "very high, call clinic" with "get urgent help now" is a clinical-safety error.)*
4. Because thresholds are local, step 3 fires **even offline**; the reading is queued for replay. An audit event records channel = voice, language = es.

**Flow 2 — Earl answers a medication check-in over SMS, offline-tolerant (patient + care-team side).**
1. Earl's `preferredChannel = "sms"`. The "Take evening medicine" task generates an outbound SMS at his scheduled time (English, his language).
2. SMS: "Did you take your evening heart medicine? Reply 1 = yes, 2 = no." Earl replies "2." System: "Why? 1 forgot, 2 cost, 3 side effects, 4 other." He replies "2" (cost).
3. Inbound webhook maps to `logDose({ status: "skipped", barrier: "cost" })`. **The reply text also passes through `classifySafety()`** before any auto-reply, so a free-text SMS like "chest hurts" still hard-escalates (FR-6). Persistent cost barrier + dropping adherence → `buildCareTeamMessage(state, clinicLocale)` drafts a summary and flags the coordinator.
4. **Care-team side:** the RN sees the structured draft (adherence rate, barrier = cost, recent BP trend from `summarizeBpTrend`) and calls Earl — the cost barrier routes toward a 90-day generic / assistance-program conversation (the real upstream intervention; the pharmacy integration that closes it is P2).

**Flow 3 — Any patient asks the Coach a question by voice and gets a safe, in-language answer (patient side).**
1. Patient speaks a question on the Coach surface (e.g. "¿Por qué tomo la pastilla de agua?"). `useVoiceSession()` opens a session.
2. **The turn's transcript is classified by `classifySafety()` before the spoken answer is delivered** (FR-6a). For a medication-change request ("¿debería dejar la pastilla de agua?"), the existing **soft block** fires: the Coach declines the change, explains why in plain + target language, and offers `draft_message`. For a hard-escalate phrase, the model's audio answer is **suppressed** in favor of the deterministic escalation banner.
3. Allowed answers are generated with the plain-language + language directive, evidence-labeled, spoken and shown as large-type simultaneously, and captured to `aiMessages` for audit.

**Flow 4 — Vision-impaired patient runs Today with a screen reader (patient side).**
1. Earl opens Today with VoiceOver/TalkBack; every task is a labeled, focus-ordered element with a ≥44px primary action. TTS defers to an active screen reader (no double-speaking).
2. He completes "Log morning BP" and "Take morning medicine" by voice, never needing to see the screen; each completion is announced by the screen reader.

## Functional Requirements

- **FR-1 (Voice input, core loops).** By speech alone, a patient can (a) log a home BP reading, (b) log a dose taken/skipped and name a barrier, and (c) ask the Coach a question — without typing.
- **FR-2 (Voice output).** Every patient-facing message renderable as text — Coach answers, confirmations, and especially safety `banner`s — can be spoken (TTS) in the patient's language, with play/replay/stop, never auto-playing over an active screen reader.
- **FR-3 (Read-back gates the value, not the alarm).** Voice-captured numeric data (BP, later glucose/weight) is read back and confirmed before it is **committed to state**. **The safety banner for a dangerous value is not suppressed pending confirmation** — if STT yields a plausibly dangerous reading, the "get help / call" guidance is surfaced immediately and the read-back corrects the stored number, so a misheard-but-still-high value never silences the alarm.
- **FR-4 (Language).** All static UI copy on core-loop surfaces resolves through the i18n layer in `PatientProfile.language`; dynamic Coach/Food/care content is generated or translated into that language; STT/TTS use the matching locale. No English-only dead-end on a core loop. *(Non-core surfaces are extracted on the P0→P1 schedule, not all at once — see Phasing.)*
- **FR-5 (Plain-language standard).** Patient-facing static strings and generated content target ~5th–6th grade reading level; a CI lint (Flesch-Kincaid heuristic) flags **static** strings above threshold. Generated content is steered by the prompt directive, not lint-gated at runtime.
- **FR-6 (Safety parity across channels).** Every voice and SMS turn — including inbound SMS free text and voice transcripts — passes through `classifySafety()` / `createSafeAiResponse()`. Hard-escalate, soft-escalate, and soft-block outcomes fire identically regardless of channel; `banner` and `actions` are always delivered (spoken, texted, and/or displayed).
- **FR-6a (Live-voice gate interception — the non-negotiable one).** The live realtime voice path MUST NOT deliver a model-generated spoken answer to the patient without the turn transcript having been classified. Implementation options (either acceptable): (i) classify the user transcript before issuing `response.create` and, on hard-escalate, suppress the model response and speak the deterministic banner instead; or (ii) run turns through the same `createSafeAiResponse()` server path rather than direct browser↔OpenAI streaming for any turn that could trigger escalation. **Shipping voice without this is shipping an ungated clinical channel and is blocked at release.**
- **FR-7 (Offline core loops).** With no network a patient can log a reading, log a dose, read the cached care plan, and hear cached education. Local safety thresholds still evaluate and still surface the spoken/visual banner (already true in code). Queued mutations replay on reconnect.
- **FR-8 (SMS reminder + reply loop).** The task engine delivers reminders and one-question check-ins by SMS and ingests numeric quick-replies into `logDose` / reading capture for `preferredChannel = "sms"` patients. Requires patient consent to the SMS channel and content minimization (see Regulatory).
- **FR-9 (Escalation for SMS/phone-only patients).** On a hard escalation for an SMS/phone-only patient, the system delivers a texted/spoken instruction consistent with the gate's urgency level (urgent-symptom/dangerous-vital → get urgent help; threshold → contact the clinic), surfaces `call_clinic`, and generates the coordinator draft. **The app does not itself dial emergency services** (see Safety).
- **FR-10 (Accessibility AA on core-loop surfaces).** Patient surfaces carrying the core loops meet WCAG 2.1 AA: landmarks/labels, logical focus order, ≥4.5:1 text contrast, large-type mode, ≥44×44px primary targets. Automated a11y checks run in CI on those surfaces.
- **FR-11 (Channel/locale in the record).** `PatientProfile` carries `language` (widened) and `preferredChannel`; `buildHealthBrief()` surfaces both so the physician knows how and in what language the patient is reached.
- **FR-12 (Human review of safety-critical translations).** The finite safety-critical string set (escalation banners at each urgency level, "get help / call now" copy, medication-change refusals) is human-reviewed per language before release. The clinical + legal boundary of "safety-critical" is signed off, not left to engineering judgment.
- **FR-13 (Auditability).** Every voice/SMS interaction and every channel/locale change writes an `AuditEvent` via the existing reducer path, including channel and language.

## Data, Devices & Integrations

**Data captured (extends existing types):** `HomeReading` (BP; later glucose/weight) capturable by voice/SMS with a `captureChannel` tag; `DoseEvent` with channel and barrier; `PatientProfile.language` widened from `"en" | "es"` to a locale string, plus `preferredChannel: "app" | "sms" | "phone"`; cached TTS audio + translated string bundles in local storage; an outbound/inbound SMS event log. New PII beyond current state: **patient mobile number** and **channel-consent record** for SMS.

**Devices:** Home **BP cuff** (manual voice entry P0; Bluetooth ingestion P2). **Glucometer** and **scale** follow the same voice/manual pattern via the sensor-hook convention (`useFoodCamera` is the template) at P2. **Wearables** out of scope. **Camera** stays the Food Lens asset. Target hardware explicitly includes low-end Android and intermittent connectivity — offline tolerance (FR-7) is a device requirement, not just a network one.

**External systems:** **SMS/voice gateway** (Twilio-class) for FR-8/FR-9 — **none exists in the codebase today**; the only server routes are `realtime/token` and `food/lookup`, and all state is localStorage-only. SMS/phone therefore implies the **first real server-side store** (for inbound webhooks, delivery state, and cross-device continuity) and a BAA — a genuine architectural first, called out honestly. **EHR/FHIR** (pull clinician plans, push patient-reported observations respecting `EvidenceStatus`) and **ADT feeds** (post-discharge outreach) are P2+, named for architectural awareness only. **Community-resource / pharmacy** routing is the downstream of the cost-barrier flow, P2. Existing `USDA_FDC_API_KEY` / OpenFoodFacts integrations are unchanged.

**AI model routing (streaming for all chat/voice):**
- **Realtime voice** (STT `gpt-4o-mini-transcribe` + reasoning + TTS, barge-in) for spoken Coach and Food Lens: OpenAI Realtime path already wired (`realtime-session.ts`), with the **mock/Web-Speech** fallback for offline/no-key — **but gated per FR-6a**.
- **Haiku for high-volume, low-stakes generation:** static-string translation drafts, plain-language rewriting of templated copy, SMS quick-reply parsing, reading-level checks.
- **Sonnet for analysis/generation that matters:** the care-team draft, Health Brief narrative, nuanced Coach explanations where clinical fidelity and safety-label discipline are worth the cost.
- **Deterministic, non-AI for the load-bearing safety layer:** `classifySafety()` stays regex/threshold code, never a model call, so escalation is auditable and does not depend on an LLM being right — in any language.

## Safety, Scope & Liability Guardrails

**Non-negotiable scope-of-practice boundary.** The product **never diagnoses, prescribes, or changes doses**, in any language or channel. Enforced at the prompt (`healthAiSystemPrompt`) **and, decisively, at the deterministic gate**: medication-change requests trigger a **soft block** (`medicationChangePatterns` in `src/domain/safety.ts`) that declines and offers `draft_message`. Translating the app does not translate this away — every language ships the same refusal, and those exact strings are human-reviewed (FR-12).

**Escalation is deterministic, channel-independent, and comes in two distinct urgencies — do not conflate them.**
- **Hard escalate (emergency framing; provider never called):** urgent-symptom phrases (chest pain, can't breathe, severe headache, weakness on one side, new confusion, fainting…); dangerous vitals SBP ≥180 / DBP ≥120 / SBP <90 / DBP <60; active `side_effects` barrier + a side-effect mention. Message is the "if this may be an emergency, seek urgent help now" family — **not** "call your clinic." This is the single most important distinction the design must preserve: a dangerous vital or a stroke-symptom phrase must not be softened into a routine clinic callback.
- **Soft escalate (answer + prominent banner + care-team actions):** a reading at/above the care plan's `callThreshold` (`findRecentClinicalReading`). Message is "share this / call your clinic."
- **Soft block:** medication-change requests.

Because these are local pure functions, **escalation fires offline** (verified in code, not aspirational).

**The app routes toward care; it does not dial emergency services, and it does not hardcode a country's emergency number.** The gate says "seek urgent help now" rather than "call 911" — deliberately, because the app is going multilingual/multi-region and a hardcoded 911 would be wrong outside the US and could delay a patient who should call a local number. **Open item flagged to clinical + legal:** whether, for US-locale hard escalations, the spoken banner should name 911 explicitly, and how the emergency-number string is localized per region (this is a per-locale entry in the safety-critical reviewed set, FR-12). No automated dialing of emergency services is in scope — a human decides.

**The safety banner is delivered in every modality.** `HealthAiResponse.banner` renders as large-type text, as in-language TTS, and — for SMS/phone patients — as an SMS carrying the urgency-appropriate instruction. Designed to be impossible to miss for a low-literacy or vision-impaired user: spoken, high-contrast, single clear action. **Read-back never suppresses it (FR-3).**

**Live-voice gate (restated because it is the highest-severity design risk).** Per FR-6a, the live WebRTC path today streams model audio to the patient without re-entering `classifySafety()`. Until interception ships, live voice for Coach/symptom-adjacent turns is **not releasable**; the mock/Web-Speech path (which routes through the same code) and read-back-gated numeric capture are releasable because they do not stream ungated model audio about symptoms.

**Human-in-the-loop.** Every escalation produces a structured clinician-facing draft (`buildCareTeamMessage`, extended to the clinic's language). A human clinician makes every clinical decision; the app never closes the loop autonomously.

**Translation safety.** Machine translation is acceptable for low-stakes copy, **not** for the safety-critical set (FR-12). STT error on clinical numbers is bounded by read-back (FR-3). Generated content carries evidence labels via `labels.ts`. A machine-translated string that is not in the reviewed set is presented with a correctable path and is never the sole carrier of an escalation instruction.

**Failure modes → handling.** STT mishears a BP → read-back corrects the value; a plausibly-dangerous mishearing still surfaces the alarm (FR-3). No network → offline queue + local safety eval (FR-7). Translation missing for a language → fall back to a supported language with a clear spoken notice, never a silent English dump. Realtime voice unavailable/no key → Web-Speech mock (already gated). SMS gateway down → reminders degrade to in-app tasks; escalation still surfaces `call_clinic`. Screen-reader vs. TTS collision → TTS defers.

**Audit trail.** Every mutation, voice/SMS turn, and channel/locale change writes an `AuditEvent` (`recordAuditEvent()`) including channel and language, feeding the existing export/delete/reset privacy surface.

## Success Metrics

*All targets are pilot hypotheses to be validated against each site's own baseline, not committed OKRs; the metric that matters most is the equity gap closing, not any single aggregate.*

**Leading indicators (engagement / access, weeks):**
- **Reach of the under-served:** % of enrolled LEP and low-literacy patients completing ≥1 core loop (reading, dose, or Coach question) in a week. *Baseline: measure the enrolled cohort's actual pre-pilot portal engagement per site (commonly single digits) rather than assume; target a large relative lift, e.g. ≥40% weekly-active in the non-English / voice-first cohort by end of a 12-week pilot.*
- **Voice adoption:** share of core-loop completions done by voice vs. typing, among patients who have used voice ≥once. *Target: ≥50%.*
- **SMS reachability:** % of enrolled no-smartphone/no-data patients who reply to an SMS check-in within 24h. *Target: ≥60% reply rate.*
- **Comprehension proxy (honest framing):** rate at which patients confirm "yes, that makes sense" to a Coach teach-back prompt. *This measures self-reported understanding, not true comprehension; treat as a directional signal, not evidence of health-literacy gain. Target: ≥85% confirm-understood, tracked alongside a periodic clinician spot-check.*
- **Accessibility conformance:** automated WCAG 2.1 AA checks on core-loop surfaces. *Target: 0 critical a11y defects at release; 100% of in-scope surfaces passing automated checks.*
- **Reading level:** Flesch-Kincaid of shipped **static** patient copy. *Target: ≤6.0 grade on ≥95% of static strings.*
- **Safety-gate parity (release gate, not a KPI):** a test suite proves hard/soft escalation fires identically across typed, voice-transcript, and SMS inputs, and that no live-voice turn delivers an ungated answer on a symptom/dangerous-value input. *Target: 100% pass; this blocks release.*

**Lagging indicators (clinical outcomes, months — attributed cautiously):**
- **BP control:** % of enrolled hypertensive patients at goal (<130/80 per 2017 ACC/AHA) at 6 months, vs. the cohort's own baseline and a matched comparison group. Target a clinically meaningful absolute improvement; do not claim causation from an uncontrolled pilot.
- **Medication adherence:** proportion-of-days-covered proxy from `DoseEvent` history, and reduction in cost-barrier-flagged patients still non-adherent after coordinator contact.
- **Home-reading capture rate:** average readings/week among enrolled patients (the upstream signal that makes control possible).
- **Avoidable acute utilization (exploratory):** ED/urgent-care visits for hypertensive urgency in the enrolled cohort vs. baseline. Attribution is hard; directional only.
- **Equity gap (north star):** the *difference* in the above between the under-reached cohort and the general panel. Success is this gap **shrinking**, not aggregate improvement alone.

## Phasing

**P0 — Voice-first + Spanish + accessibility on the core-loop surfaces, gate-safe (thin, shippable).**
- Reusable `useVoiceSession()` (lifting the handle contract + `reduceRealtimeEvent`); **voice BP logging with read-back** (FR-1, FR-3) and **voice dose logging** (FR-1).
- **Spoken Coach only where the gate covers it (FR-6a):** ship the mock/Web-Speech Coach path (routes through `createSafeAiResponse()`) at P0; live WebRTC Coach ships only once transcript interception lands. Numeric capture (read-back-gated) ships either way.
- **es** on the **core-loop surfaces** (Today, Numbers, Medicines, Coach) as a hard contract via the i18n layer; TTS/STT locale from `PatientProfile.language`; **spoken safety banner in-language, at the correct urgency level** (FR-2, FR-4, FR-6). Widen `PatientProfile.language` to a locale string.
- **WCAG 2.1 AA** on those surfaces + large-type mode + a11y CI checks (FR-10); plain-language lint on static strings (FR-5).
- Offline: local safety eval (already true) + queued reading/dose logs (FR-7).
- **Explicitly deferred out of P0:** full-app string extraction beyond core-loop surfaces; SMS; more languages; live-voice Coach if FR-6a isn't ready.
- *Independently valuable:* a Spanish-speaking, low-literacy, or vision-impaired patient runs the core loops by voice, with escalation intact, on the existing localStorage app — no backend required.

**P1 — SMS/phone fallback + more languages + care-team rendering (first backend).**
- **SMS reminder + reply loop** with consent capture and content minimization, and **phone escalation instruction** via a gateway + BAA (FR-8, FR-9); `preferredChannel` in `PatientProfile` and Health Brief (FR-11). This introduces the first server-side store.
- **2–3 languages** beyond en/es; human-review workflow for the safety-critical set (FR-12); extend string extraction to remaining surfaces.
- Extend `buildCareTeamMessage(state, clinicLocale)` and the Health Brief to the clinic's language while the patient interacts in theirs.
- *Independently valuable:* reaches the no-smartphone/no-data segment (Dawn, Earl) P0 misses.

**P2 — Device ingestion + EHR/FHIR + resource routing.**
- **Bluetooth BP cuff / glucometer / scale** via the sensor-hook pattern; glucose/weight loops.
- **FHIR** import of clinician plans + push of patient-reported observations with `EvidenceStatus`; **ADT-triggered** post-discharge outreach.
- **Community-resource / pharmacy** routing for the cost barrier — closing the upstream loop the adherence data opens.

## Open Questions & Risks

- **Live-voice safety gate (highest severity).** Until FR-6a interception ships, the realtime path can speak an ungated model answer to a symptom or dangerous-value utterance. This is an engineering-and-release gate, not a research question: **no live-voice Coach at release without it.** *Open: option (i) transcript-classify-then-suppress vs. option (ii) route-through-server — decide and test.*
- **Regulatory / SaMD line.** Coaching, reminders, and routing-to-care sit on the education side of the FDA SaMD line; the deterministic threshold/urgency banner is defensible as decision *support* keyed to clinician-authored care-plan thresholds, not autonomous diagnosis. *Open: does spoken threshold/urgency guidance in a non-English language, delivered by voice, change the SaMD analysis or the "clinical decision the user can independently review" reasoning under FDA's clinical-decision-support guidance? Needs a regulatory read before scaling languages.*
- **Emergency-number localization.** "Seek urgent help now" is intentionally not "call 911." *Open (clinical + legal): should US-locale hard escalations name 911, and how is the emergency-number string localized and reviewed per region?*
- **HIPAA across channels.** SMS is not encrypted; outbound health content by text needs a minimum-necessary/content-minimization policy, explicit patient consent to the channel, and a BAA with the gateway. Introducing the first server-side store also expands the compliance surface (encryption at rest, access control, breach exposure) beyond today's on-device-only model. *Open: consent-capture flow and content-minimization rules for SMS.*
- **Translation liability.** Who owns a clinically consequential mistranslation? P0 mitigates by human-reviewing the safety-critical set, but the boundary of "safety-critical" needs clinical + legal sign-off, and the machine-translated remainder needs a disclaimed, correctable path.
- **Reimbursement.** Between-visit work maps loosely to RPM/RTM and CCM CPT families, but voice/SMS-first, device-optional workflows don't cleanly satisfy RPM's device-supplied-data requirements. *Open: which pathway (RTM/CCM/none) funds the care-coordinator time this creates — otherwise the added workload is unfunded.*
- **Care-team load.** Reaching more patients generates more escalations; without coordinator capacity this creates alerts no one answers — itself a safety risk. Escalation volume must be modeled and staffed before scaling enrollment.
- **STT accuracy for accented / low-resource languages.** Read-back bounds the numeric case; free-text symptom capture in long-tail languages is riskier and depends on realtime STT quality per language — a hard dependency before committing a language.
- **Dependencies:** OpenAI Realtime (+ mock fallback); an SMS/voice gateway + BAA + first server-side store; per-language human reviewers; and (P2) FHIR/ADT connectivity the codebase does not have today.

---

**Files referenced for grounding (all verified real in this codebase):** `src/ai/safety-gate.ts`, `src/domain/safety.ts`, `src/domain/recent-clinical-reading.ts`, `src/ai/prompts.ts`, `src/ai/intent.ts`, `src/hooks/use-food-voice-session.ts`, `src/ai/realtime-session.ts`, `src/ai/food-instructions.ts`, `src/ai/mock-provider.ts`, `src/domain/adherence.ts`, `src/domain/care-team-message.ts`, `src/domain/tasks.ts`, `src/domain/health-brief.ts`, `src/domain/types.ts`, `src/i18n/strings.ts`, `src/state/store.tsx`, `src/state/storage.ts`, `src/domain/food-lookup.ts`, `src/app/api/realtime/token/route.ts`.

**Fidelity corrections made vs. the original draft:** (1) the live realtime voice path does **not** currently pass model output back through `classifySafety()` — added FR-6a as a hard, release-blocking requirement rather than an assumed property; (2) `i18n/strings.ts` is a **Food-Lens-only** dictionary today, not app-wide — scoped string extraction as real work; (3) `buildCareTeamMessage(state)` takes **no language argument** — extension is scoped, not assumed; (4) Flow 1's SBP 182 is a **hard-escalate emergency**, not a "call_clinic" soft escalate — the two urgency levels must not be conflated; (5) read-back must not gate the safety banner.
