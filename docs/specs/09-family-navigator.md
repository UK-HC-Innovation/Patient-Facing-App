# Family Navigator — Developmental Pediatrics Resource Connection (Demo)

> A caregiver-facing pathway (`/family`) that takes a parent of a child with developmental needs (autism, ADHD, dyslexia, speech delay, developmental delay, intellectual disability) from "I just got this diagnosis and a stack of fliers" to a short list of **verified, county-matched, age-appropriate Kentucky resources** — entered either through a structured needs screen or by **talking into an interview box** ("tell us about your child") that is transcribed and crunched by a language model into reviewable facts and suggested need domains. Staged, diagnosis-date-aware nudges ("the Michelle P. waiver list is date-ordered — apply *now*") follow in P1. **This is a demo for the UK Healthcare Innovation (UKHCI) team, not a product for real families**: it answers their backlogged problem statement — *"provide waitlisted families with local resources and education"* — with working software instead of a slide.
>
> **2026-07-24 — UKHCI Ladder:** the navigator's user-facing brand is now **UKHCI Ladder**, served at `/ladder` (`/family` permanently redirects). First waitlist-product slice landed: referral anchor + evaluation-visit loop (slot booking, fixed-choice barriers check routed into need domains, T-14/T-3/T-1 reminder ladder with demo time-travel, missed-visit recovery). Plan: `docs/plans/14-ukhci-ladder.md`. Deferred, in order: wait-status card, monthly check-ins + experience pulse, interim home-activity content, clinic impact dashboard.

> **Demo posture (explicit scope decisions, 2026-07-17):** demo audience only; no real families soon; no new PHI/privacy hardening beyond what the app already does (all data fictional + on-device); ships on the **same Vercel deployment** (patient-centered.vercel.app) so the room also discovers the rest of the app; ongoing catalog verification will belong to a **navigator** role later and is out of scope now; family context starts **minimal** and deepens through use. One thing is *not* demo-grade and never will be: the crisis gate (see Safety).

## Problem & Rationale

Alec's framing in the 2026-07-17 UKHCI kickoff, from lived experience: there are lots of special-needs resources across Kentucky, but they're hard to find, it's hard to know what you need *when* you need it, and even developmental pediatricians are "good, not great" at what's out there — *"I've been told some stuff, and then actually knowing that it's not actually the case."* Families leave the diagnosis visit with a stack of papers, and the epic-level problem behind the backlog item is a ~12-month developmental-pediatrics waitlist.

The research pass for this spec (2026-07-17; every cited URL verified by automated fetch or, where bot-blocked, a manual browser — the few exceptions are flagged inline) proved the stale-directory failure mode is not hypothetical — **Kentucky's own directories exhibit it today**:

- Kentucky's KY FACES state resource directory still lists **The Arc of Kentucky** as an active statewide resource — while The Arc's national chapter finder says *"Currently, there is no state chapter of The Arc in this state,"* the org's IRS filing trail ends FY2023 with $0 net assets, and its website is frozen in mid-2020.
- The national International Dyslexia Association site still links **IDA Kentucky** — whose official site now returns *"This site is no longer available."*
- **helpmegrowky.com**, the state screening program's own vanity domain, serves an expired TLS certificate; the KY family guide PDF that still ranks in search results returns 404; the Kentucky Autism Training Center's current site explicitly disclaims the individual-family consultation that older directories still promise.

So the product thesis is *verification discipline as the feature*: a small, hand-verified, dated, source-linked catalog beats a big scraped one — exactly the `verifiedAt` + `sourceUrl` discipline the app's SDOH Connect catalog already enforces. And the sharpest clinical framing is **waitlist-to-active**: the family waiting 12 months for the developmental peds clinic isn't idle — they're getting First Steps before the age-3 cutoff, on the Michelle P. list (which is date-ordered), in a parent group, and prepped for the ARC/IEP meeting. That reframes the tool from "a directory" to "what the clinic's waitlist does while it waits."

**Why this platform:** roughly 70% is composition of shipped primitives — the needs-screen → deterministic flags → county-matched verified catalog pattern (`/support`), the free-text → extracted-facts → confirm provenance loop (`/intake`), the crisis gate + grounding stack, voice input, the recall/SLA nudge machinery, and the chat-first navigation. The genuinely new work is a caregiver/child data slice, the catalog itself, the LLM interview crunch, and — non-negotiable — teaching the crisis gate to hear a *parent's* voice.

## Target Users

**Demo personas (all fictional; no real family's data, including any team member's, is ever seeded):**

- **Morgan, Scott County, caregiver of Riley (9).** Riley was diagnosed with dyslexia + ADHD two months ago; fourth grade in Scott County Schools. Morgan's questions: what do I do about school (what's an "ARC meeting"?), what financial help exists, is there a parent group nearby, what should I be doing *now* vs. later. Mirrors the design partner's situation without using it.
- **Casey, Perry County, caregiver of a 2-year-old with speech delay.** The urgency case: First Steps eligibility ends at the 3rd birthday and referrals are refused within 45 days of it — the "right thing *right now*" demo beat, and it reuses the app's existing Perry County grounding (Brent fixture, SDOH catalog, screening sites).
- **The UKHCI room** (Alec, Hayley, Landon, Ian): the actual P0 audience. They need to see speed (built in days), safety (the crisis beat no Lovable mock has), and verification discipline (dated sources, including the "we know The Arc of KY is defunct and the CHILD waiver is new" moments).

**Future (P2+, out of demo scope):** the **navigator** — the named human who owns catalog verification cadence, receives escalations, and closes loops. Same load-bearing role as the SDOH spec's CHW; no real-family onboarding without one.

## Goals & Non-Goals

**Goals**

- A working `/family` pathway on the shared deployment: minimal caregiver/child profile → needs screen *or* voice/typed interview → verified county+age-matched resources → save/share with audit — all functional with **zero API key** (mock path) and on a phone.
- The interview box: speak or type a paragraph about your child; the app transcribes, extracts reviewable facts (with evidence status), proposes need domains with plain-language rationales — and **never invents a resource** (model proposes *domains*; catalog matching stays deterministic).
- A seed catalog of ~30 fetch-verified Kentucky developmental-peds resources with `verifiedAt`, `sourceUrl`, age bands, and dated "act now" facts (waiver waitlists, age cutoffs) — plus an explicit **do-not-list** set with reasons.
- Extend the crisis gate to caregiver voice **before** any family free-text surface ships, with corpus cases enforced by `crisis:gate` and `npm run check` (the repo has no CI — these local gates are the enforcement).
- P1: deterministic stage nudges keyed on child age + diagnosis date, reusing the recall/SLA machinery.

**Non-Goals**

- **Not a product for real families yet** — demo data, fictional personas, a visible "demo — fictional data" badge on family surfaces.
- **Not a diagnosis tool.** It never says or implies "your child has X" — not in the interview output, not in resource rationales (enforced by a new family-specific lint, see Safety). "Does my kid have autism?" routes to education + humans.
- **Not an eligibility determination or benefits calculator.** Waiver/SSI content is dated facts + who-decides + how-to-apply. It never estimates approval likelihood, and **income is not collected** (the one profile field from the design partner's personal Copilot setup we deliberately refuse).
- **Not a scraper.** The catalog is hand-curated and fetch-verified; internet scraping is at most a future curator assist, never a live path.
- **Not a second-patient model.** The child is structured data under the caregiver's single-user account — no multi-patient identity, auth, or proxy-consent model in the demo.
- **Not reviews/ratings in any P0/P1 form.** The feedback loop Alec described ("the food was expired and it was degrading") needs *real families using real resources*, which the demo posture excludes by definition — so P2 sketches the in-app "did you use it / did it help" loop, and his Google-reviews-ingestion idea is named and deliberately deferred with it (review quality and liability for disability services is its own design problem, not a free add-on). **Not push/SMS, not EHR anything, not a coach-chat mode in P0.**
- **Not new privacy machinery.** Existing on-device localStorage + audit + delete surface carries over unchanged; that is sufficient for fictional demo data by the user's explicit call.

## How It Builds on Existing Primitives (ground truth, verified 2026-07-17 at d765a99)

Every claim below was re-verified against the working tree; several correct stale statements in earlier specs.

- **Crisis pathway EXISTS now — older docs are stale.** `src/ai/safety-gate.ts:13` exports `CARE_TEAM_ACTIONS = ["call_clinic","draft_message"]`, `CRISIS_ACTIONS = ["crisis_call_988","crisis_text_988","call_emergency","safety_plan"]`, and `EMERGENCY_ACTIONS`. `AiMessageAction` (types.ts:125) is the closed 6-value union backing them; message-actions.tsx renders offline-safe `tel:988` / `sms:988` / `tel:911` links; crisis messages lock the composer until acknowledged (conversation-panel.tsx:65). Spec 03's "no 988/911 action exists" is no longer true.

- **But the crisis gate has no dedicated caregiver-voice coverage — execution-verified gap.** The 5 self-harm `CRISIS_RULES` (crisis-red-flags.ts) are built around first-person forms (`myself`, exact inflections like `want to die`); only person-neutral keywords (`suicid(e|al)`, "ending it all", "don't want to be here") incidentally catch some third-person phrasings. Running the *actual source* through Node: **"my son says he wants to die," "my daughter has been hurting herself," "he told me he wants to kill himself," "my kid ran away from home and we can't find her," "I can't do this anymore, I want to give up" — all five return `matched:false` / `classifySafety:"allowed"` / `socialEmergency:false`.** The 27-case corpus (crisis-red-flags.corpus.ts, `CRISIS_RECALL_FLOOR = 0.95`) contains zero caregiver/third-person cases, so `crisis:gate` currently proves nothing about the *default voice of this feature's user*. Closing this is FR-6 and gates everything else.

- **Needs screen → flags → county catalog (the `/support` Connect pattern).** `SOCIAL_SCREEN_QUESTIONS` (5 yes/no/declined items, en+es) → `computeSocialFlags` (yes-only, social-screen.ts:67) → `findKentuckyResources({county, needType, limit=4})` with `' County'`-suffix normalization, county-first ranking, `"statewide"` sentinel (sdoh-resources.ts:135). `KentuckySdohResource` carries `sourceName/sourceUrl/verifiedAt/referralMode` — the verification provenance this feature elevates. Gaps to fix in the family variant: the card component renders `verifiedAt` but **not** `sourceUrl` (resource-referral.tsx:32), the flow ends at an audit-only share (`shareReferral` dispatches just `addAuditEvent "shared"`, support/page.tsx:58 — no referral record), and no UI ever writes `patient.county` (fixture-only).

- **Free-text → facts → confirm (the `/intake` provenance loop).** `addContextItem` stores a `CareContextItem` + `ExtractedFact[]` and audits; `confirmFact` sets any matching fact to `confirmed` with no precondition on prior status (store.tsx:45,97,105) — which is exactly why reusing it for `inferred`/`patient_reported` interview facts needs no change. Confirmed facts feed `/plan` and the Health Brief (both filter to `confirmed`); coach grounding, by contrast, receives **all** extracted facts regardless of status (grounding-facts.ts:96) — one more reason the family slice stays separate (see Data Model). **Critical correction: intake extraction is pure regex — no LLM, no AiMode, no API route** (`extractInstructionFacts`, instructions.ts:3, three English patterns + a low-confidence fallback). The interview box's LLM crunch is genuinely new; its build patterns come from elsewhere: the coach route (`/api/coach/text` — env-gated, `DEMO_PASSCODE` body check, degrade-to-mock), the pantry provider (zod-validated JSON contract + a plain-text digest so grounding can veto), and the screening extractor (`parseExtractionPayload` returns `null` on any off-shape reply — never trust the model).

- **Voice, two grounded options.** (a) **Web Speech API** — `HomeComposer` (home-composer.tsx:27,94) proves the shim: `SpeechRecognition ?? webkitSpeechRecognition`, feature-detected, en-US/es-US, one final transcript per utterance, zero server cost, zero key. **This is the P0 interview input — but only the shim/feature-detect/language selection carries over**: HomeComposer's `onresult` *replaces* the input and auto-routes immediately, so a copy-paste would auto-submit the first utterance; the interview variant must instead append each final transcript to the editable textarea and never auto-submit. (b) The WebRTC realtime session (realtime-session.ts) already surfaces final user transcripts independently of replies (`create_response:false`; `conversation.item.input_audio_transcription.completed` → `userTranscript`, gpt-4o-mini-transcribe) — but transcribe-only reuse needs a small gate-bypass change, live keys, and inherits food-worded context injection. Reserved for P2 conversational voice.

- **Storage traps (each has reset-to-demo consequences).** `AppState` lives under a single localStorage key (`storage.ts:34`; the only other key is the onboarding-complete marker, storage.ts:942, deliberately outside the validation/reset path — the precedent if family onboarding needs its own marker), with validation-based "migrations": a new `AppState` member **must** get load-time backfill + a type guard + sanitize wiring or existing saves hard-reset to the Brent demo. `hasValidRelationships` (storage.ts:120) hard-resets on a foreign `patientId` in the core arrays (carePlan/medications/readings/contextItems/auditEvents); the newer arrays lenient-filter foreign ids instead — either way a second patientId does not survive load, so the child lives *inside* a new `family` slice keyed to the caregiver, not as a second patient. `isAiMode` (storage.ts:235) rejects persisted messages in unknown modes — one reason P0 adds **no** new `AiMode` (`AiMode` verified as 8 values ending at `"food"`, types.ts:123; the "connect" mode older docs promised never landed).

- **Staging substrate exists; age doesn't.** No DOB/age/diagnosis-date field exists anywhere (grep-verified). The closest pattern to "diagnosis-date staged nudges" is the DR recall loop: event date → `recallDateFrom(confirmedAt, months)` UTC-month math (dr-triage.ts:74) → `RecallReminder{dueAt, reason}` → surfaced by `buildTodayTasks` inside a 60-day window and only when no screening gap is already open (a suppression pattern P1's engine may want too); plus `escalationDue` SLA logic with suppressing stages and the `backdatedSentAt` **demo time-travel** helper (referral-followup.ts:13,24 — demo controls backdate data, never fake the clock), and `monthsSince` (screening-sites.ts:315). P1's stage engine copies these shapes. Note `MAX_TODAY_TASKS = 3` (tasks.ts:6) and the closed `TaskItem.kind` union — P0 keeps family nudges on `/family` surfaces and out of the Today slice entirely.

- **Route registration is five surfaces + two lockstep tests.** New route cluster checklist (verified): (1) `src/app/family/page.tsx` (+subpages) with `AppShell`; (2) strings — new `FamilyStringKey` table (`Record<Language, Record<Key,string>>` makes **es compile-mandatory**) + menu label/desc keys in `HomeStringKey`; (3) `MENU_GROUPS` (menu-grid.tsx) **and** `REQUIRED_ROUTES` (menu-grid.test.tsx); (4) `ROUTE_SYNONYMS["/family"]` (route-classifier.ts — auto-extends `CLASSIFIER_HREFS` and the live-LLM allowlist); (5) `ROUTE_LABELS` + `NAV_LEXICON`/`NAV_LEXICON_ES` (+ verb rules) in front-door.ts. Steps 3+4 must land together or front-door.test.ts:93's menu/classifier set-equality assertion fails; step 5 is *not* test-enforced (a missing `ROUTE_LABELS` entry silently falls back to the raw href), so it takes a manual check. The front-door safety invariant extends for free: `decideFrontDoor` screens crisis/safety **before** any routing, so once caregiver-voice rules exist, "my son says he wants to die" typed into the *home* composer routes to Coach crisis UI, never to `/family`.

- **Education module pattern (P2).** retinopathy-education.ts is the per-condition template: topic array + keyword-length-scored QA + `EDUCATION_MATCH_FLOOR` + domain-context regex gate + crisis-classify-first in the UI + "Not a diagnosis" source label. Per-diagnosis Learn modules (autism/ADHD/dyslexia) clone this shape; the coach hook (safety-gate.ts:217) is hardcoded to the single DR pair and English-only — generalizing it is P2 work, not config.

- **Nudge template lint gotcha.** `renderNudge` only renders allowlisted templates and lints against 22 prohibited terms **including "abuse" and "violence"** (nudge-template.ts). P1 family nudge copy must be written around the lint (or the policy deliberately amended) — discovered now, not at ship time.

## Key User Flows

**Flow 1 — First visit: minimal profile + entry choice.**
1. `/family` (via Menu → Support group, home composer "help for my daughter", or direct link). A visible **"Demo — fictional data"** badge sits in the header of every family surface.
2. One-screen setup: county (picker over a new `KY_COUNTIES` constant — all 120 counties, a data artifact this feature ships because none exists anywhere in the codebase; it doubles as the domain for the county→First-Steps-POE mapping seed entry #4 needs; defaults from `state.patient.county` when set), child's first name (optional), birth year + optional birth month, school stage, diagnoses (multi-select from `DevDiagnosis` + free label) each with an optional diagnosis month. Explicitly *not* collected: income, address, full DOB, last name.
3. Two entry cards: **"Answer a few questions"** (Flow 2) and **"Tell us about your child"** (Flow 3). Both re-entrant, both skippable.

**Flow 2 — Structured needs screen.**
1. Eight yes/no/declined items (en/es), one per need area: early help before 3, therapies, school/IEP, money/waivers, a break for the caregiver (respite), meeting other parents, siblings, getting places. Mirrors `SOCIAL_SCREEN_QUESTIONS` mechanics exactly.
2. Deterministic yes-only flags (`computeFamilyFlags`, pure) → Flow 4. Answers persist as facts (`patient_reported`), declines recorded, never silently dropped.

**Flow 3 — The interview box ("Tell us about your child").**
1. A single editable textarea + mic button. Mic = Web Speech API (HomeComposer pattern); each utterance appends its final transcript to the textarea; the parent reviews/edits before submitting (zod-bounded, 10–5000 chars like `careContextInputSchema`).
2. **Safety first, before any network call:** the text runs the extended crisis screen (`classifyCrisis` with the new caregiver rules), `classifySafety`, and `screenSocialEmergency`. Any match → route to `/chat?ask=` (Coach re-runs the full gate and renders crisis UI with 988/911 actions); **no extraction, no resources render.** This is the existing front-door invariant applied to a new surface.
3. Clean text → POST `/api/family/interview` (clone of the coach route: `HEALTH_AI_PROVIDER`/`HEALTH_AI_API_KEY` env-gated, `DEMO_PASSCODE` body check, 15s timeout). The model receives the interview text + the minimal profile and a JSON-only contract; the reply is zod-validated. **Off-shape reply → treated as null → deterministic fallback extractor** (screening-extract discipline).
4. Contract (the model may propose **facts, domains, rationales — never resources, never diagnoses**):
   ```json
   {
     "facts": [{ "label": "Grade", "value": "4th grade", "sourceSnippet": "..." }],
     "domains": [{ "domain": "school_iep", "rationale": "You mentioned reading struggles at school..." }],
     "followUps": ["Does Riley have an IEP or 504 plan today?"]
   }
   ```
5. Zero-key/mock path: a **client-side** deterministic keyword extractor (regex per domain — "speech/talking" → `therapies` + `early_intervention` when age < 3; "school/IEP/reading" → `school_iep`; "waiver/money/afford" → `waivers_financial`; "break/exhausted/overwhelmed" → `respite` + `parent_support`; …) produces the same contract shape. It runs when the route reports unconfigured/locked **and on any fetch failure**, so "no API key," "wrong passcode," and "network down" all land on one identical path and the demo runs end to end regardless.
6. Facts render as review cards (IntakeReviewCard pattern). Status is assigned by a deterministic client-side rule — a fact whose `sourceSnippet` is a verbatim substring of the interview text is `patient_reported`; anything else is `inferred` — so the contract carries no model-asserted status field to trust. A tap confirms (`confirmed`). Confirmed facts persist to the family slice — **this is how "minimal context deepens through use."** Each rationale passes the diagnosis-claim lint (below) or is dropped (domain chip stays, rationale text goes).
7. Domain merge is a pure recompute, never accumulation: `activeDomains = union(computeFamilyFlags(screenAnswers), latestInterviewDomains)` — re-running the screen or a new interview *replaces* that surface's contribution, so a yes→no re-answer or a narrower second interview can retract a domain (the same recompute semantics as `computeSocialFlags`). `latestInterviewDomains` is persisted separately from the merged array so this invariant survives reloads and later screen edits. Model-proposed domains drive matching **without** a confirm tap (deliberate asymmetry — facts *assert* and need confirmation; domains only *route*). → Flow 4.

**Flow 4 — Verified resources.**
1. For each active domain, deterministic matching: `findFamilyResources({county, domain, childAgeYears, limit})` — county-first then statewide, age-band filtered (First Steps never offered for a 9-year-old; transition planning never for a toddler).
2. Cards render: name, what it is, contact, age band, **source name + `verifiedAt` + tappable `sourceUrl`** (fixing the SDOH card gap — the link *is* the credibility), and an optional dated **"act now"** line (e.g. *"The Michelle P. waiver list is date-ordered — 9,686 people were waiting as of 9/2/2025 (CHFS). Applying now sets your place."*).
3. Actions per card: **Save** (persists to the family slice's saved list), **Share** (per-share consent checkbox → audit `shared` event — ResourceReferral pattern), and on waiver/program cards an **"already on this / receiving this"** toggle — Alec's question was subtractive ("what waivers are we *not* on?"), so already-enrolled resources render badged, drop their `actNow` urgency, and sink below unenrolled matches. A saved-resources section on `/family` is the return visit's anchor.
4. Zero matches → honest empty state: statewide fallbacks (KY-SPIN, HDI's resource directory, kynect resources, 211) + "a navigator can help find local options" — never a dead end dressed as an answer.

**Flow 5 — Staged timeline ("the right thing at the right time"). P0 ships the read-only card; P1 ships the full engine.**
1. P0: a read-only now / next / later card on `/family`, derived by `buildFamilyStages(family, now)` — a pure function over birth year(+month) + diagnosis dates. The data substrate is already collected in the P0 profile, and timed delivery was the signature ask of the meeting ("in a month, here's a therapy group for parents") — the demo must *show* it, not describe it.
2. P1: the full trigger table below, plus a demo control that backdates the diagnosis date (`backdatedSentAt` pattern) to walk the room through month-1 vs. month-6 vs. age-17 states without faking the clock.

## Data Model (new `family` slice)

```ts
export type DevDiagnosis =
  | "autism" | "adhd" | "dyslexia" | "speech_language"
  | "developmental_delay" | "intellectual_disability" | "down_syndrome" | "other";

export type DevNeedDomain =
  | "early_intervention" | "therapies" | "school_iep" | "waivers_financial"
  | "respite" | "parent_support" | "sibling_support" | "transportation"
  | "future_planning" | "diagnosis_education" | "recreation";

export type ChildDiagnosis = { id: string; label: DevDiagnosis; otherLabel?: string; diagnosedAt?: string };

export type FamilyProfile = {
  childFirstName?: string;
  birthYear: number;
  birthMonth?: number;   // 1-12, optional. Month+year is deliberately NOT a full DOB; sub-year
                         // stage triggers (2y3m window, 45-days-before-3) need it — year-only
                         // degrades to conservative early firing (see Staged Timing Engine).
  schoolStage: "not_school_age" | "preschool" | "elementary" | "middle" | "high" | "post_high";
  county: string;        // from the new KY_COUNTIES constant (all 120 — ships with this feature)
  diagnoses: ChildDiagnosis[];
};

export type FamilyScreenAnswer = { questionId: string; domain: DevNeedDomain; response: "yes" | "no" | "declined" };
// mirrors SocialAnswer; screen submit also writes FamilyFacts (sourceSnippet = question text), declines included

export type FamilyInterview = {
  id: string; rawText: string; source: "typed" | "voice" | "mixed"; createdAt: string;
  extraction: "live" | "mock";
};

export type FamilyFact = {
  id: string; interviewId?: string; label: string; value: string;
  status: EvidenceStatus; sourceSnippet: string;   // patient_reported | inferred | confirmed
};

export type SavedFamilyResource = { resourceId: string; savedAt: string; domain: DevNeedDomain };

export type FamilyNavigatorState = {
  profile: FamilyProfile | null;
  interviewDraft: string;             // editable, unsubmitted text; seeded examples populate this
  screenAnswers: FamilyScreenAnswer[];
  interviews: FamilyInterview[];
  facts: FamilyFact[];
  latestInterviewDomains: DevNeedDomain[]; // replacement contribution from the latest crunch
  activeDomains: DevNeedDomain[];   // recomputed on screen submit / interview crunch:
                                    // union(computeFamilyFlags(screenAnswers), latestInterviewDomains);
                                    // each surface's contribution is replaced, never accumulated
  saved: SavedFamilyResource[];
  alreadyEnrolled: string[];        // resource ids the family marks "already on/receiving" —
                                    // answers the subtractive "what are we NOT on", suppresses actNow
};
// AppState gains: family: FamilyNavigatorState | null
```

Storage: backfill `family: null` in `loadStoredState`, add an `isFamilyNavigatorState` guard + sanitize wiring (lenient-filter entries, never fatal), include in `resetDemo`/`deleteDemoData` paths. The sanitizer backfills `interviewDraft: ""` and `latestInterviewDomains: []` inside an otherwise valid family slice so early P0 saves remain loadable. Deliberately **separate** from `contextItems`/`extractedFacts` so child facts never leak into the adult coach's grounding table (grounding-facts.ts pushes *all* `extractedFacts` — mixing would have Brent's BP coach citing Riley's IEP).

## Resource Catalog (`src/domain/family-resources.ts`)

```ts
export interface FamilyResource {
  id: string;
  name: string;
  domains: DevNeedDomain[];
  counties: string[];               // county names or "statewide"
  ages?: { min?: number; max?: number };   // years; absent = all ages
  summary: string;                  // what it is + what a family actually gets
  contact: string;                  // phone/email/how to start
  actNow?: string;                  // dated, sourced urgency line (waitlists, cutoffs)
  sourceName: string;
  sourceUrl: string;                // rendered as a link on the card
  verifiedAt: string;               // fetch-verified date
  humanVerify?: boolean;            // true when the primary source blocks automation or needs a phone check
  referralMode: "self_serve" | "call" | "provider_referral" | "school_contact" | "navigator_referral";
}
```

### Seed entries (~31, all fetch-verified 2026-07-17 unless noted)

**Statewide backbone**

| # | Resource | Domains | Ages | Load-bearing facts to surface |
|---|----------|---------|------|-------------------------------|
| 1 | KY-SPIN (Parent Training & Information Center) | parent_support, school_iep, future_planning, diagnosis_education | 0–26 | Free helpline (800) 525-7746; one-on-one navigation; "Families Training Families"; not legal representation |
| 2 | Office for Children with Special Health Care Needs (OCSHCN) — incl. KY Family to Family HIC | parent_support, therapies, waivers_financial, diagnosis_education | 0–21 | Current name confirmed (formerly "Commission" — obsolete); regional clinics statewide incl. **autism diagnostic clinics at Morehead & Somerset only** (per a fact sheet whose locations insert is dated 06/2023 — phone-verify the clinic lineup pre-demo); **RN case management open to any family regardless of diagnosis** (no eligibility hurdle); houses the F2F center's **peer parent-mentor matching** (Parent to Parent USA) + Medicaid/KCHIP navigation; (800) 232-1160 |
| 3 | Kentucky First Steps / KEIS | early_intervention, therapies | 0–3 | Anyone can refer incl. parents: 1-877-41STEPS; eligibility not income-based, $0 under 250% FPG; **45-day** referral→IFSP clock; **no referrals accepted within 45 days of the 3rd birthday** |
| 4 | First Steps Point of Entry directory | early_intervention | 0–3 | 15 districts cover all 120 counties (Dec 2025 listing); app maps county→POE so parents don't guess (the demo mappings Scott→Bluegrass and Perry→Kentucky River are *inferred from ADD geography — verify against the 12/25 POE listing PDF before seeding*) |
| 5 | Help Me Grow Kentucky | early_intervention, diagnosis_education | 0–5 | Free ASQ-3/ASQ:SE-2 screening online (en/es) or (877) 616-7388; **link the chfs.ky.gov page — helpmegrowky.com has an expired TLS cert** |
| 6 | Age-3 transition to preschool special ed (KDE) | early_intervention, school_iep | 2¼–4 | Transition conference window 2y3m–2y9m, ≥90 days pre-birthday; **IEP-by-3rd-birthday right only holds with an active IFSP** — don't exit First Steps early |
| 7 | KDE special-ed dispute resolution (OSEEL) | school_iep | 3–21 | Kentucky calls the IEP team the **"ARC"**; escalation ladder: ARC meeting → free mediation → written complaint (**1-year hard window**) → due process (3-year); complaint forms in 8+ languages (mediation/due-process forms en/es) |
| 8 | KDE Parent & Family Toolbox | school_iep, diagnosis_education | 3–21 | "Preparing for the ARC" guide; IEP fact sheets en/es |
| 9 | Kentucky Protection & Advocacy | school_iep, future_planning | all | The **legal**-advocacy step; intake ≠ guaranteed lawyer; won't take custody/SSI-dispute cases |
| 10 | Michelle P. Waiver | waivers_financial, respite, therapies | all | **actNow:** date-ordered list; 9,686 waiting as of 9/2/2025, avg ~3.5 yrs, longest ~8.6 yrs (CHFS to KY legislature, 9/17/2025) — *the meeting's "8-year" figure is the tail, not the median; the app says the sourced version* |
| 11 | SCL Waiver | waivers_financial, respite, future_planning | 3+* | The only KY IDD waiver with residential supports; avg wait ~7.8 yrs; placement by **category of need**, not date (*age band per the Kids' Waivers aggregator — the CHFS page states no age; confirm with DBHDID (502) 564-7700) |
| 12 | HCB Waiver | waivers_financial, respite | all | Nursing-facility level of care (physical/medical) — autism/ADHD alone won't qualify; but avg wait ~4 months; listed to prevent the common MPW mix-up |
| 13 | CHILD Waiver | waivers_financial, respite, therapies | 0–21 | CHFS now states that it is accepting participant applications for the new CHILD program; requires exhausting other services; absent from most parent guides — a currency moment. Do not repeat the aggregator's ~100-slot figure as a CHFS fact; use the waiver help desk (844) 784-5614 for questions. |
| 14 | STABLE Kentucky (ABLE accounts) | future_planning, waivers_financial | onset <46 | Age-of-onset rule expanded 26→**46 on 1/1/2026** (older KY decks are stale); save without losing SSI/Medicaid |
| 15 | SSI for children (SSA) | waivers_financial, future_planning | 0–17 | Parental deeming ends at 18 — previously denied families should re-apply at 18; *ssa.gov blocked automated fetch (403): human re-verify before demo* |
| 16 | My Choice Kentucky (supported decision-making) | future_planning | 14+ | KY has **no SDM statute** (bills failed '19/'20/'21) but courts treat SDM as a less-restrictive alternative; guardianship-alternatives education before 18 |
| 17 | HDI Kentucky Disability Resource Guide (resources.hdiuky.org) | diagnosis_education, general fallback | all | UK UCEDD's searchable statewide directory, 2026 edition — the in-app "find more" link |
| 18 | Kentucky Autism Training Center (U of L) | diagnosis_education, parent_support | all | Free trainings + caregiver-support-group support; **explicitly does NOT do individual family consults/IEP help** (older directories say otherwise — set the expectation) |
| 19 | UK Developmental Pediatrics — Golisano Children's at UK | diagnosis_education, therapies | 18 months–12 years, concern-specific | **Referral-only** through the child's primary care provider. Current published criteria: autism concerns 18 months–12 years, global developmental delay 18 months–5 years, intellectual disability 6–12 years, and ADHD 4–12 years. Dyslexia is not a listed referral indication, so the app routes that need to school + community paths. |
| 20 | KY LEND (HDI) | parent_support, diagnosis_education | adults | Parents of children with IDD can *join as trainees* (~9/yr; spring application) — a growth path, not a service |
| 21 | Kentucky 211 / kynect resources | all domains fallback | all | Already in the SDOH catalog; re-verified 2026-07-17 for this population: 211 covers all 120 counties with a "Disabilities, Independent Living & Aging" category (phone/text reliable; web fragmented); **kynect has NO developmental-disability browse category — keyword search works** ("developmental disability" → 30+ results), so in-app copy must say *search*, never *browse* |

**Central-KY / demo-local (Scott + Fayette)**

| # | Resource | Domains | Notes |
|---|----------|---------|-------|
| 22 | Autism Society of the Bluegrass | parent_support, diagnosis_education, recreation | $12/yr, monthly meetings + listserv; site's meeting format is internally inconsistent — copy says "confirm via listserv" |
| 23 | Central Kentucky Riding for Hope | recreation, therapies | Kentucky Horse Park (Scott/Fayette line — ideal for Georgetown demo); ages 5+; $35/30-min with automatic scholarship |
| 24 | Lexington Parks Therapeutic Recreation | recreation | Camps + adapted sports; seasonal first-come registration; non-Fayette residency question flagged in copy |
| 25 | DSACK (Down Syndrome Assoc. of Central KY) | parent_support, diagnosis_education | New/expectant parent outreach; free except tuition-based K-8 Co-Op |
| 26 | Scott County Schools Exceptional Child Services | school_iep | Named contacts w/ direct lines (verified 2026-07-17); page has zero procedure content — route to phone |
| 27 | Scott County FRYSC | parent_support, transportation, waivers_financial | **No published district directory** — honest in-app instruction is "call your child's school, ask for the Family Resource Center" |
| 28 | CHADD Kentucky Connections | parent_support, diagnosis_education | Statewide via Zoom, first Wednesdays; the only KY CHADD affiliate — set expectations (one meeting/month) |
| 29 | FEAT of Louisville | parent_support, recreation, therapies | Swim-safety program (**drowning-risk mitigation — pairs with the elopement crisis rules**); preschool 2–6, camp 7–21 |
| 30 | Down Syndrome of Louisville | parent_support, therapies, future_planning | Louisville metro; lifespan programs banded by age |
| 31 | LDA of Kentucky | parent_support, school_iep | Dyslexia/LD support — **weakest activity signal** (no 2026 events posted); listed with "call to confirm" caution, because the honest alternative (IDA KY) is dead |

### Do-NOT-seed list (negative findings are catalog content)

Kept in the module as commented exclusions with dated reasons — they are the demo's proof that verification is the product:

- **The Arc of Kentucky (state chapter)** — national chapter finder: no KY state chapter; IRS trail ends FY2023 at $0; site frozen 2020. *Still listed as active in KY FACES.*
- **IDA Kentucky** — official site returns "no longer available"; national IDA still links it; last FB post June 2024.
- **helpmegrowky.com** — expired TLS cert (use the chfs.ky.gov page).
- **chfs.ky.gov FamilyGuidetoServices PDF** — 404s but still ranks in search.
- **Legacy URLs** — old KATC louisville.edu path (301s), old Michelle P. provider page (archived 2/28/24), dpa.ky.gov's stale P&A page (public defenders ≠ Protection & Advocacy), and the dead `chfs.ky.gov/agencies/ccshcn` OCSHCN URL — which **HDI's own Kentucky Disability Resource directory still lists** (fetched 2026-07-17): even the good directories have stale entries.
- **Sibshops in Kentucky** — none confirmable (directory blocks fetching; Cincinnati lead is 2017-era/COVID-hold). `sibling_support` matches route to KY-SPIN + the Sibling Support Project directory with "a navigator can help confirm" copy — the domain ships honest-thin rather than fabricated-full.

**Verification policy:** every seeded entry's `sourceUrl` is verified at seed time (automated fetch, or manual browser where the domain bot-blocks); `verifiedAt` ≤ 30 days old on demo day. When a current primary source conflicts with dated narrative elsewhere in this spec, the seed uses the current primary-source fact and the implementation summary records the discrepancy; verification discipline outranks preserving stale demo copy. The named pre-demo human-verify list, in full: **SSI/ssa.gov** (research facts not machine-verified), **STABLE enrollment site** (stablekentucky.com may block automation), and **Sibling Support Project directory** (siblingsupport.org may block automation and is the sibling-domain fallback link). CHILD status is now published by CHFS; the help desk remains the contact for case-specific questions. Also note kynect.ky.gov may block non-browser fetches — automated link checkers can *falsely* report it down. Post-demo cadence belongs to the future navigator role (out of scope now). CHFS has committed to a public waiver-waitlist dashboard by Aug 2026 — when it exists it becomes the canonical waitlist link and the numbers above get refreshed from it.

## Staged Timing Engine (P1)

Pure function over `birthYear`(+`birthMonth`) + `diagnoses[].diagnosedAt` (recall-loop shapes: `recallDateFrom`-style month math; demo backdating, never clock-faking). Sub-year triggers — the 2y3m transition window, the 45-days-before-3 cutoff — require `birthMonth`; with year-only data the engine fires **conservatively early** (active for the whole calendar year the trigger could apply, with copy saying so) and never silently late.

| Trigger | Stage nudge | Domain |
|---|---|---|
| Any IDD diagnosis, immediately | Michelle P. is date-ordered — apply now (dated waitlist fact) | waivers_financial |
| Diagnosis +1 month | "You don't have to figure this out alone" — parent group / peer mentor | parent_support |
| Diagnosis +3 months | Sibling support; respite options | sibling_support, respite |
| Age < 3, always urgent | First Steps before the 3rd birthday; refuses referrals in last 45 days | early_intervention |
| Age 2y3m | Transition-conference window opens; stay enrolled to keep IEP-by-3 | early_intervention → school_iep |
| Age 4–5 | School enrollment: ARC/IEP primer | school_iep |
| Age 14 | Transition planning starts (KY-SPIN "Mission Transition") | future_planning |
| Age 17 | Before 18: SSI re-application (deeming ends), SDM vs. guardianship, STABLE account | future_planning |

Deliberately **not** a notification system (the app has none — all time checks evaluate on render, like `checkReferralFollowup` on mount). Stage entries render on `/family`; nothing enters the Today task slice in P1 without a deliberate `TaskItem.kind` extension decision. Named honestly: on-render surfacing is pull-based — a family that stops opening the app gets the discharge-papers failure mode in digital form. Alec's ask was *active* delivery; the eventual channel (push/SMS/navigator-triggered outreach) is an Open Question, not a forgotten one.

## Safety, Scope & Liability

**The caregiver-voice crisis gate is P0's only non-negotiable, demo or not.** This surface *invites* a parent to describe their child in free text on a public deployment. Shipping it while "my son says he wants to die" gets a normal reply would betray the app's entire identity — and the safety beat is also the demo's sharpest differentiator vs. a Lovable mock.

- **New deterministic rules (crisis-red-flags.ts), all corpus-enforced:**
  - *Third-person suicidality/self-harm* → domain `self_harm` → crisis tier (988 explicitly serves people worried about someone else): reported ideation ("says/said/saying/telling/told me … want(s) to die" — the progressive form included, it's the demo-script string), third-person reflexives ("kill/hurt himself/herself/themselves"), intent phrasing ("wants to end his life," "threatens to hurt herself").
  - *Ongoing self-injury* ("has been hurting herself," "keeps cutting himself") → `self_harm`.
  - *Missing/eloped child* ("ran away and we can't find her," "wandered off," "got out of the house") → `acute_danger` → emergency (911). Elopement is a leading cause of death in autistic children (drowning); FEAT's swim program cross-links here.
  - *Abuse-adjacent disclosure* ("someone is hurting my child," "being abused") → crisis tier with route-to-human copy. A dedicated Childhelp hotline action (1-800-422-4453) means extending the closed `AiMessageAction` union + storage lenient-filter + message-actions renderer — **deferred to P1 as a deliberate typed change**; P0 uses the existing 988/911/clinic actions plus banner text.
  - *Caregiver collapse* — conservative combined patterns only ("can't do this anymore" + give-up/ending phrasing), because "give up" alone is a false-positive machine.
- **Corpus additions:** ≥10 positives (the five execution-verified misses above, plus elopement/abuse/burnout variants) and ≥5 traps that MUST stay unmatched: "he hurt himself at recess yesterday" (accidental injury), "this waitlist is killing me," "I give up trying to get her to eat vegetables," "she's dying to ride the horses," "he ran away with the soccer ball." `crisis:gate` keeps `recall ≥ 0.95` **and zero false positives** as a build-breaking test; the five previously-missed strings become named regression cases.
- **Ordering:** interview safety screening runs client-side before any network call (Flow 3.2); the front-door router picks the new rules up automatically (it calls `classifyCrisis`), preserving its crisis-never-reaches-a-feature-screen invariant app-wide.

**Never-diagnose enforcement (deterministic, not vibes):** the interview prompt carries adapted `GROUNDING_SAFE_PHRASING` guards ("never state that the child has a condition — say 'the concerns you described'"), and every model rationale passes a **new family-specific diagnosis-claim lint** before render — a violating rationale is dropped while its domain chip survives. The existing grounding.ts `DIAGNOSIS_CLAIM_PATTERNS` are the *pattern-shape precedent only*, not the implementation: verified 2026-07-17 they are second-person and hardcoded to four adult chronic conditions ("you have hypertension/diabetes/…"), so "Riley has autism" and "your child has ADHD" sail straight through them — and routing rationales through `verifyGrounding` wholesale would be worse, false-positiving on the word "reading" (`\breadings?\b` is a clinical-adjacent trigger) while missing every child-diagnosis claim. The new patterns cross third-person subjects (he/she/they/your child/`childFirstName`) with the `DevDiagnosis` vocabulary (autism/autistic, ADHD, dyslexia/dyslexic, speech/language disorder, developmental delay, intellectual disability, Down syndrome) and claim shapes (has / is / sounds like / appears to have / was diagnosed with), exported with unit traps in both directions — "children with autism often…" must pass; "this sounds like dyslexia" must not. The model never emits resource names, so resource hallucination is structurally impossible rather than lint-caught: **matching is deterministic against the catalog, full stop.**

**Waivers/benefits:** dated facts, application paths, and who-decides — never eligibility conclusions, never approval-likelihood estimates (the one thing the design partner's personal Copilot does that this app deliberately won't), no income field anywhere. Every waitlist figure carries its source and as-of date.

**Demo honesty:** every family surface carries the "Demo — fictional data" badge; personas are invented; the deployment's existing `DEMO_PASSCODE` gating covers the new live-LLM route exactly as it does coach/vision/token. Mandatory-reporting, proxy consent, minors' data governance, FERPA adjacency — all real product concerns, all explicitly deferred with the real-family launch they'd gate.

## Functional Requirements

- **FR-1** `/family` route cluster registered per the five-step checklist (page + strings; MENU_GROUPS & REQUIRED_ROUTES; ROUTE_SYNONYMS; ROUTE_LABELS & en/es lexicons) in one change-set; both lockstep tests green; the non-test-enforced surfaces (ROUTE_LABELS, lexicons) manually checked.
- **FR-2** Minimal family profile: county (picker over the new `KY_COUNTIES` constant), optional child first name, birth year + optional birth month, school stage, diagnoses with optional dates, per-resource "already on/receiving" marks. No income, address, full-DOB, or last-name fields exist — birth month+year is deliberately the ceiling.
- **FR-3** Structured screen: 8 yes/no/declined items (en/es); deterministic yes-only flags; declines recorded; re-entrant.
- **FR-4** Interview box: typed + Web Speech mic (feature-detected, hidden when unsupported); each utterance appends to an editable textarea and never auto-submits; 10–5000 char bound with a live character count — over-cap blocks submit with a visible message and the mic disables near the cap; spoken words are never silently truncated.
- **FR-5** Interview safety ordering: extended `classifyCrisis` + `classifySafety` + `screenSocialEmergency` run on-device **before** any network call; any match routes to `/chat?ask=` crisis handling and suppresses extraction and resources.
- **FR-6** Caregiver-voice crisis rules + corpus cases land **before or with** the first family free-text surface; `crisis:gate` green with recall ≥ 0.95 and zero false positives; the **six** named regression strings match (the five execution-verified misses plus the demo-script line "honestly she's been saying she wants to die"); the five named traps don't. Every free-text utterance in the Demo Script must exist as a named corpus or e2e case.
- **FR-7** `/api/family/interview`: env-gated, `DEMO_PASSCODE`-checked, zod-validated JSON contract with exactly the keys `facts[{label,value,sourceSnippet}]`, `domains[{domain,rationale}]`, `followUps[]`; off-shape → null → the client-side fallback extractor; 15s timeout.
- **FR-8** Zero-key mock extractor produces the same contract deterministically; the full demo runs with no API key.
- **FR-9** Rationale lint: **new** family-specific diagnosis-claim regexes (third-person subjects × `DevDiagnosis` vocabulary × has/is/sounds-like/diagnosed claim shapes — the grounding.ts patterns are shape-precedent only; they are second-person and adult-condition-hardcoded and MUST NOT be reused as-is) strip violating rationales pre-render, with positive and negative unit cases; the model never receives catalog names and the UI never renders a model-authored resource.
- **FR-10** Interview facts carry `EvidenceStatus` assigned by the deterministic client-side rule (`patient_reported` when `sourceSnippet` is a verbatim substring of the interview text, else `inferred` — never model-asserted) with `sourceSnippet`; confirm flow persists them to the family slice; profile deepens only through confirmed facts.
- **FR-11** Resource matching is deterministic: county + domain + age-band, county-first then statewide, honest empty state with statewide fallbacks. Cards render source name, `verifiedAt`, **tappable `sourceUrl`**, age band, and `actNow` when present; already-enrolled resources render badged, without `actNow`, below unenrolled matches.
- **FR-12** Every seeded entry fetch-verified with dated source; bot-blocked entries carry a human-verify flag; the do-not-seed exclusion list ships in-module with dated reasons.
- **FR-13** Save persists to the family slice; Share requires a per-share consent checkbox and writes an audit `shared` event.
- **FR-14** `family` slice persistence: load-time backfill to null, type guard, lenient sanitize (including `interviewDraft` and `latestInterviewDomains` defaults); `resetDemo` and `deleteDemoData` handle it; no change to `AiMode`/`isAiMode` in P0.
- **FR-15** Waiver/benefit copy: dated + sourced facts and application paths only; no eligibility determinations or likelihood estimates anywhere.
- **FR-16** A `seedExampleFamily` reducer action (payload `"morgan" | "casey"`) overwrites the family slice with a fixture — profile plus `interviewDraft` prefilled and ready to crunch, no submitted interview and no pre-confirmed facts. Caregiver names are chip labels only (no caregiver-name field exists, on purpose). `resetDemo` and `deleteDemoData` null the slice.
- **FR-17** All new strings ship en+es via a `FamilyStringKey` table (compile-enforced); es marked demo-grade pending native review.
- **FR-18 (P1)** Stage engine: pure, date-math-only, backdatable for demo; any nudge copy passes (or deliberately amends) the `PROHIBITED_TERMS` lint; no Today-task integration without an explicit `TaskItem.kind` decision.

## Demo Script (the P0 acceptance test)

1. **Cold open** — phone, patient-centered.vercel.app/family**?k=\<passcode\>** (the `?k=` param arms the live-LLM routes exactly as it does for `/food`; without it every beat silently exercises the mock path): "This is the backlog item you showed me on Tuesday, running."
2. **Load example family** (Morgan/Riley, Scott County) → mic, **one tap per sentence** (the Web Speech shim finalizes at pauses — rehearse this exact paragraph on the demo phone): *"My daughter is in fourth grade in Georgetown. She was just diagnosed with dyslexia and ADHD a couple months ago. Reading homework is a nightly battle and I don't know what to ask the school for. Money's tight and I keep hearing about waivers but have no idea where to start."*
3. **Crunch** (the live LLM path — mock is the offline contingency) → facts render (grade: 4th — patient_reported; diagnoses — patient_reported; school concern — inferred) → confirm one → domains: school_iep, waivers_financial, parent_support.
4. **Resources** → Scott-first cards: the district's named special-ed contacts, "ARC is Kentucky's word for the IEP meeting" primer, KY-SPIN's free helpline, Michelle P. with the dated waitlist line ("for Michelle P., 8 years is the tail — average ~3.5 — though an ~8-year *average* is real for the SCL waiver; either way the Michelle P. list is date-ordered, so applying now is the move"), CKRH at the Horse Park. Tap a `sourceUrl` — it's real, it loads. Then scroll to the **timeline card**: *now* — apply Michelle P., prep the ARC meeting; *next month* — parent group; *later* — sibling support. "This is the 'right thing at the right time' part of your idea."
5. **The safety beat** — type *"honestly she's been saying she wants to die"* → crisis UI, 988 call/text buttons, no resources, composer locked until acknowledged. "This is what a healthcare-grade version of this idea has that a prototype doesn't."
6. **The currency beat** — CHILD waiver card: "CHFS currently accepts applications through kynect, an ADRC, or a community mental health center. CHFS does not publish a slot count on the program page, so this demo makes no phone-confirmed global enrollment-status claim" (never assert the aggregator's ~100-slots figure unattributed). Add the future-planning example: "STABLE's age-of-onset ceiling moved from 26 to 46 on January 1 — most Kentucky decks are still stale on that." Then the do-not-seed list: "and here's what we *removed* that the state's own directory still lists."
7. **Perry variant** (Casey chip): age-2 speech delay → First Steps front and center with the 45-days-before-3 cutoff — "same tool, opposite corner of the state, different right-now answer."
8. **Zoom out** — Menu: food lens, eye screening, glucose, the same safety gate everywhere. "One platform; this took days, not a vendor contract."

## Success Criteria (demo-grade)

- `npm run check` (lint + vitest + build), `npm run crisis:gate`, and the e2e suite green with the new corpus cases.
- Full golden path works with zero API key (mock extractor) and live with `?k=` passcode on the deployed app.
- Every seeded `sourceUrl` verified within 30 days of demo day; the three named human-verify items (SSI, STABLE, Sibling Support directory) checked by hand.
- The six caregiver-voice regression strings hard-escalate on every free-text surface (family interview, home composer, chat).
- The 8 demo-script beats execute on a phone without dev tools.

## Phasing

**P0 — the demo (thin, shippable, safety-complete).** Route cluster + registration; minimal profile (incl. optional birth month + `KY_COUNTIES`); structured screen; interview box (typed + Web Speech) with mock and live crunch paths; caregiver-voice crisis rules + corpus (crisis:gate green); family-specific diagnosis-claim lint; ~31-entry verified catalog + do-not-seed list; county+age matching; cards with sourceUrl links + save/share + already-on marks + audit; **read-only now/next/later timeline card**; example-family seeding; demo badge; en/es strings.

**P1 — time, in full.** The complete stage engine (P0's card ships the `buildFamilyStages` derivation; P1 adds the full trigger table, the backdate demo control, and templated nudge copy through the `PROHIBITED_TERMS` lint — the copy-vs-lint work is why the full engine isn't P0); Childhelp hotline as a typed `AiMessageAction` extension; es native review; optional Today-tile decision.

**P2 — depth (with real-family gating decisions).** Per-diagnosis Learn modules (retinopathy-education pattern, generalized coach hook); "did you use it / did it help" feedback loop feeding catalog quality; conversational voice via the realtime session (transcribe-only mode + non-food context injection); coach-chat family mode (AiMode + isAiMode + mock branch as one change-set); navigator-facing verification queue; the real privacy/consent/mandatory-reporting work that a real-family launch would gate on.

## Open Questions & Risks

- **Two audiences, one deployment.** The state (RHTP) sees this app as chronic-disease/patient-facing; UKHCI will now see a family surface on the same URL. The demo badge mitigates confusion, but if the state demo and the UKHCI demo ever land in the same week, decide whether `/family` hides behind a query flag. (Owner call, cheap either way.)
- **Catalog ownership after the demo.** Navigator role is agreed but unstaffed; until then `verifiedAt` dates age publicly. Mitigation: the dates are *visible* — staleness is disclosed, not hidden — and the CHFS waitlist dashboard (due Aug 2026) will replace the most volatile numbers with a canonical link.
- **Timed delivery is pull-only until there's a channel.** The staged timeline renders only when the family opens the app — the discharge-papers failure mode in digital form if they don't. The vision Alec described ultimately needs an active channel (push/SMS/email or navigator-triggered outreach); on-render surfacing is a deliberate demo-scope constraint, not the end state.
- **Sibling support is honest-thin** (no confirmable KY Sibshop). Alec named this need specifically; the demo should say "this is where the directory is weakest — and the tool says so instead of guessing," which is the thesis, but it's worth a human check of the Sibling Support Project map before demo day.
- **Web Speech API variance — a single point of failure for the owner's must-have.** Voice-in has no P0 alternative transport (the realtime path is P2), and the stated behavior on unsupported browsers is a typed-only fallback. Named contingency, decided now: rehearse the exact demo paragraph on the actual demo phone during P0; if it fails there, present from a known-good Android/Chrome device carried as backup.
- **Third-person crisis rules will fight the zero-false-positive corpus test.** Expect a rule-tightening iteration (the "hurt himself at recess" trap is designed to force it); budget it, don't be surprised by it.
- **The clinic-side view is the real P3.** A "what your waiting families have been connected to" summary for the developmental peds clinic is what turns this from parent tool into waitlist intervention — deliberately out of scope until UKHCI reacts to the demo.

---

Grounding: all codebase claims verified 2026-07-17 against the working tree at `d765a99` (files: `src/domain/types.ts`, `src/domain/crisis-red-flags.ts` + `.corpus.ts` + `.test.ts`, `src/ai/safety-gate.ts`, `src/domain/social-screen.ts`, `src/domain/sdoh-resources.ts`, `src/domain/instructions.ts`, `src/state/store.tsx`, `src/state/storage.ts`, `src/domain/referral-followup.ts`, `src/domain/dr-triage.ts`, `src/domain/tasks.ts`, `src/domain/nudge-template.ts`, `src/domain/retinopathy-education.ts`, `src/domain/front-door.ts`, `src/domain/route-classifier.ts`, `src/components/home-composer.tsx`, `src/components/resource-referral.tsx`, `src/ai/realtime-session.ts`, `src/ai/food-instructions.ts`, `src/domain/grounding.ts`, `src/i18n/strings.ts`, `src/components/menu-grid.tsx`); caregiver-voice gap verified by executing the real source against the six named regression strings (all unmatched today). All resource claims verified 2026-07-17 by fetch or manual browser (sources inline; four named items flagged for pre-demo human re-verification; two figures are aggregator-sourced and labeled as such in place). Meeting context: 2026-07-17 UKHCI kickoff transcript.
