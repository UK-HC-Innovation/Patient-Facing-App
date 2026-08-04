# Family Navigator II — Situation-Grounded Recommendations (Demo)

**Status:** implemented — `/api/family/recommend`, `src/ai/family-rank-prompt.ts`, `src/domain/family-rank.ts`. Verified 2026-08-04.

> The Family Navigator today sends the caregiver's full story to a language model and then throws away everything it understood, squeezing the reply through an 11-value domain enum — so "my seven-year-old has been kicked out of school several times for violence" comes back as *"You mentioned school, an IEP, or help with reading."* This spec inverts the model's job: instead of classifying text into buckets that a regex could fill, the model **ranks and justifies resources from the verified catalog against this family's actual situation** (retrieve → rank → justify). Selection is id-only from a deterministically retrieved candidate set — the model can explain a recommendation but can never invent one. Alongside it: the `/family` crisis response changes from dead-end redirect to **standard emergency language + continue** (a caregiver describing a child in crisis is exactly who this tool serves — showing 988/911 and then refusing to help finds no one a program); the catalog gains **procedural-guidance entries** (IDEA discipline protections, written evaluation requests, FBA/BIP) with citations; and a **clinician-reviewable vignette gate** modeled on `crisis:gate` makes recommendation quality a tested property instead of a vibe.
>
> **Demo posture (explicit scope decisions, 2026-07-21):** decisions locked by the user this date — (1) no separate clinical-review workstream for the animal-harm/harm-to-others gap; instead, deterministic rules show the standard call-911 / emergency-department / 988 language and the flow **pushes forward with the caregiver's ask**; (2) the catalog **does** carry procedural guidance with citations (`verifiedAt` + `sourceUrl` discipline, `humanVerify` until checked); (3) build order is gate-first per recommendation — the vignette corpus lands before the ranking call so quality regressions are visible from the first live run. Same demo posture as spec 09 otherwise: fictional data, demo badge, `DEMO_PASSCODE`-gated live routes, mock path is the zero-key demo. **This spec amends spec 09 in two named places (FR-5's redirect and the "no org names in rationales" rule) and preserves everything else.** The surface is LIVE at patient-centered.vercel.app/family (deployed 2026-07-21 at `4cbe8c7`) — this is a change to a shipped surface, not an unshipped one.

## Problem & Rationale

The live extraction path (`/api/family/interview`, gpt-4o-mini, temp 0) reads the whole caregiver paragraph — then `familyInterviewResultSchema` forces its understanding through `domains: [{domain, rationale}]` where `domain` is one of 11 enum values, and resource selection is a deterministic catalog filter over that enum (`findFamilyResources({county, domain, childAgeYears})`). The model isn't the ceiling; the schema is. Live and mock output are indistinguishable for the motivating case:

- **The Breathitt case (real session, 2026-07-21):** *"I have a seven-year-old who has behavioral issues… explosive anger… kicked out of school several times for violence… harmful towards animals. We live in Breathitt County and we need help."* The app answered *"School and IEP — You mentioned school, an IEP, or help with reading."* The lead finding isn't reading help — it's **repeated disciplinary removal**, which under IDEA carries specific, time-sensitive protections (manifestation determination after a pattern of removals; a written evaluation request starts legal clocks a phone call doesn't). None of that is representable in the current taxonomy, so no model, however good, can surface it.
- **The rationale is decorative.** It's written about the *domain*, not about *why this resource for this family* — and the route's system prompt forbids naming any program in a rationale, so the "why" is structurally prevented from connecting to the recommendation.
- **"Harmful towards animals" trips nothing.** Verified against the corpus at `0b034c5`: no rule, corpus case, or test anywhere covers harm-to-others or animal cruelty (`REFLEXIVE_HARM` is self-harm only; animals appear only as missing-pet negative traps). School-discipline content invites exactly these disclosures.
- **The dead-end redirect fights the population.** Today crisis-adjacent text on `/family` triggers `router.push("/chat?ask=…")` plus `suppressForSafety()` — the thread resets and matched resources are wiped. A caregiver whose child is in behavioral crisis gets crisis copy and loses the navigator. The chat surface already has the better pattern: crisis copy + locked composer + **"I've seen this — continue"** (`crisisAcknowledge`, `acknowledgeCrisis` action). `/family` should say the safety words *and then keep helping*.

The thesis is unchanged from spec 09 — verification discipline is the feature; the model never invents a resource. What changes is the model's job: from *classifier* (a job a regex does equally badly) to *reasoner over the verified catalog* (a job only it can do).

## Target Users

Same as spec 09 (fictional demo personas; the UKHCI room). One addition sharpens the design target:

- **The Breathitt caregiver** (composite of the real 2026-07-21 session, kept fictionalized): 7-year-old, explosive behavior, repeated school removals for violence, harm to animals, Breathitt County. The vignette gate's case #1. Success = the lead recommendation is school-discipline/evaluation procedure with a grounded "why," the safety banner shows without killing the flow, and Kentucky River-area + statewide supports rank above generic reading help.

## Goals & Non-Goals

**Goals**

- A **rank-and-justify call**: deterministic retrieval (county + age + active domains, exactly today's `buildResourceMatches` semantics) produces a candidate set; the model receives the caregiver transcript + profile + candidate catalog facts and returns **catalog ids only**, ranked, each with a short "why this, for you" justification and an optional verbatim caregiver quote; server and client both re-resolve ids against the catalog and drop unknowns. Card names, contacts, URLs, and dates always come from the catalog.
- A **"here is what we heard" lead narrative** — one plain-language paragraph naming the lead concern, grounded in the caregiver's own words, replacing the enum-labeled rationale list as the thing the family reads first.
- **Banner-not-dead-end safety on `/family`**: crisis/safety/social-emergency matches render an inline non-dismissible banner (existing 988/911 links via `urgent-help.tsx`, existing `tSafety` copy, acknowledge button per the chat pattern) — and the turn **continues on the deterministic mock path** (the tripping text never leaves the device; live calls resume on later clean turns).
- **Harm-to-others coverage**: new deterministic rules + corpus cases for caregiver-reported harm to animals and to other people, with new standard copy (911 / nearest emergency department / 988 / pediatrician), zero-false-positive floor maintained.
- **Three procedural-guidance catalog entries** (IDEA discipline protections, written evaluation request, FBA/BIP request) with citations, `humanVerify: true` until source-checked.
- **A vignette gate**: a clinician-reviewable corpus of caregiver vignettes with expected lead concerns and must/must-not resource sets; deterministic tier inside `npm test` (build-breaking, zero env), live tier as an opt-in `navigator:gate` script writing dated reports beside the crisis-gate results.
- Zero-key parity: a deterministic mock ranker produces the same result shape so demo, e2e, and the deterministic gate tier all run with no API key.

**Non-Goals**

- **Not a new domain taxonomy.** `DevNeedDomain` stays 11 values; procedural entries ride under `school_iep`. (Adding a value touches the schema, storage guard, route enum injection, screen merge, both string tables, and the mock extractor — deliberately out of scope.)
- **Not a diagnosis tool — unchanged and re-enforced.** Every justification passes the existing `containsFamilyDiagnosisClaim` lint; violations drop the justification, never the card.
- **Not a change to app-wide crisis routing.** The front door, home composer, chat, checkin, and voice gates keep their exact behavior; `crisis:gate`'s six-file suite is untouched except for *additive* corpus cases. Only the `/family` surface's *response* to a match changes.
- **Not legal advice.** Procedural entries state what a protection *is*, who decides, and how to start it — cited, dated — never "you will win" or applied conclusions about this child's case.
- **Not a live-LLM-judged build gate.** The build-breaking tier is deterministic; the live tier is opt-in and advisory (a report, not a red build), because `npm run check` must stay green with zero env.
- **Not reviews, notifications, EHR, or real-family onboarding** — all spec 09 non-goals carry forward.

## How It Builds on Existing Primitives (ground truth, verified 2026-07-21 at `0b034c5`)

- **Retrieval already exists and is kept as the floor.** `findFamilyResources({county, domain, childAgeYears, limit})` (family-resources.ts:608) filters domain ∧ age-band ∧ (county ∨ statewide), sorts county-first then catalog order; `buildResourceMatches` (family-experience.tsx) takes 4 non-enrolled per domain, prioritizes county → `actNow` → catalog order, sinks enrolled, and falls back to the four statewide ids (`ky_spin, hdi_resource_guide, kynect_resources, kentucky_211`) when nothing domain-specific matched. **Rank layers on top of this retrieval; it never expands the candidate set.** The fallback and honest-empty-state semantics survive verbatim: when retrieval returns only fallbacks, there is nothing to rank and the fallback card set renders exactly as today.
- **The unlock signal survives.** Resources gate on `!safetySuppressed && family.profile && family.activeDomains.length > 0`; `activeDomains = mergeFamilyDomains(screenAnswers, latestInterviewDomains)`. The 8-question needs screen produces domains with **no interview text** — screen-only users have nothing to rank from, so ranking runs **only when at least one interview exists**; otherwise today's deterministic order and static rationales render unchanged.
- **Acknowledge-and-continue is an existing pattern, not an invention.** `crisisAcknowledge` ("I've seen this — continue" / "Ya lo vi — continuar", strings.ts:277,299), `acknowledgeCrisis` action + audit line (store.tsx:64,182), `hasUnacknowledgedCrisis` selector gating chat voice, food voice, and the realtime token route. `/family` adopts the same machinery via a family-scoped safety event (below) rather than a chat message.
- **The standard crisis language already ships.** `tSafety` keys `crisisResponse`, `abuseResponse`, `socialEmergencyResponse`, `emergencyResponseSuffix` (en+es); `urgent-help.tsx` renders the real `tel:988` / `sms:988` / `tel:911` links; `crisisTierForDomain` maps domains → crisis/emergency tiers. The banner composes these; the only new copy is the harm-to-others response (which adds the emergency-department wording the user specified).
- **Two transcripts exist and the distinction is load-bearing.** The orientation loop sends the Q:/A:-framed `liveTranscript` to the LLM but stores and grounds against the answers-only `caregiverTranscript` (`meta.rawText`). All quote-grounding in this spec (`becauseYouSaid`, fact snippets) checks `rawText.includes(...)` against the **caregiver transcript**, exactly like `familyFactStatus` today.
- **The lint chain is reused, not rebuilt.** `filterUnsupportedDiagnosisFacts` (verbatim-snippet + affirmative-assertion grounding), `stripUnsafeFamilyRationales` / `containsFamilyDiagnosisClaim` (third-person × diagnosis vocabulary × claim shapes, also reused by the voice output-guard), `sanitizeFamilyFollowUps` (drops questions naming catalog resources via `RESOURCE_NAME_PATTERN` — an alternation of **full** catalog names). Justifications get the same treatment with one scoped rule (below).
- **Storage discipline is the sharpest constraint.** `sanitizeFamilyNavigatorState` (storage.ts:842) rebuilds the family slice from only its known keys — any new persisted field is silently deleted on reload unless the type, guard, sanitizer, and a pre-sprint-payload regression test land **atomically**. `isFamilyInterview` pins `extraction: "live" | "mock"`; shapes are contract.
- **The gate pattern to copy.** `scripts/crisis-gate.mjs` runs six vitest files and writes `docs/ops/red-team-results/<date>-crisis-gate.md`; the corpus test enforces recall ≥ 0.95 **and zero false positives** over `screenCrisisRedFlags`, with per-case expected domains. The vignette gate clones the harness shape with its own corpus, its own npm script, and its own dated filename.
- **Tests that pin today's redirect behavior (must be rewritten in the same phase that changes it, never weakened silently):** `family-interview.test.tsx` (~194, routes-before-network table), `family-orientation-interview.test.tsx` (~139, ~278), `family/page.test.tsx` (~572, ~587), e2e `family-navigator.spec.ts` (417–434 EN redirect, 487–508 ES). None are inside the crisis-gate six-file suite. The one frozen router-level case — front-door's "keeps family help language behind the crisis gate" — is **entry-time** behavior and is untouched.
- **Shared tree caution:** plan 12 (Screening Hub) is Active in this tree. Do not touch screening seams (`isAssessmentEvent`, `/checkin`, instrument registry files); keep every commit path-scoped.

## Key User Flows

**Flow 1 — Rank and justify (the new spine).**
1. Caregiver submits the interview (typed/voice, existing flow). Extraction runs exactly as today (live → mock fallback) producing facts / domains / follow-ups; facts review and basics turns are unchanged.
2. Once `profile` exists and `activeDomains` is non-empty **and at least one interview exists**, the client computes the candidate set with today's retrieval (`buildResourceMatches` + `buildNearbyTherapeuticRecreation`, deduped) and POSTs `{text: caregiverTranscript, profile, language, passcode?, candidateIds}` to **`/api/family/recommend`**.
3. The route re-resolves every candidate id via `getFamilyResourceById` (unknown ids dropped server-side), builds the prompt from **catalog data only** (id, name, summary, contact mode, age band, counties tier, `actNow`), and asks the rank model for JSON: `{heard, lead, recommendations: [{id, why, becauseYouSaid?, urgency}]}`. Off-shape → `data: null` (existing discipline).
4. The client validates again: ids not in the candidate set are dropped; each `why` passes the justification lint; each `becauseYouSaid` must satisfy `caregiverTranscript.includes(snippet)` or it is removed. If everything is dropped or the call failed → **deterministic mock ranker** (same shape, current ordering, static rationale strings, snippet reuse from the mock extractor). The result persists to `family.recommendations` and renders.
5. Cards render in rank order with: catalog-sourced name/contact/source/verifiedAt (never model text), the "why this" line, the "You said: '…'" quote when present, and an urgency chip (`act_now` composes with the catalog `actNow` line). The `heard` narrative renders as the section lead. Save/share/enrolled semantics unchanged.

**Flow 2 — The Breathitt case, after.** Same paragraph as the real session. Extraction: behavior + school concerns; basics prefilled (Breathitt, ~2019, elementary — shipped 2026-07-21). New: the harm-to-others rule trips on "harmful towards animals" → inline banner (911 / nearest emergency department / 988 / pediatrician wording) with acknowledge button; the turn continues on the mock path. Resources unlock: `heard` names repeated school removal as the lead; top cards are `idea_school_discipline` ("You said: 'kicked out of school several times'…"), `kde_evaluation_request` (act-now: a written request starts timelines a phone call doesn't), `fba_bip_request`, then Kentucky River-area and statewide behavior/parent supports. Reading-help entries do not lead.

**Flow 3 — Crisis banner: acknowledge and continue.**
1. Any submit path (opening interview or follow-up answer) that trips `classifyCrisis` / `classifySafety ≠ allowed` / `screenSocialEmergency` dispatches `recordFamilySafetyEvent` (tier + domain + audit line) instead of redirecting.
2. The banner renders at the top of the interlude: tier-appropriate `tSafety` copy, `urgent-help` links, `crisisAcknowledge` button. Non-dismissible; acknowledging records `acknowledgeFamilySafetyEvent` + audit. While unacknowledged, `hasUnacknowledgedCrisis` (selector extended to include family safety events) locks **all** voice surfaces including family follow-up dictation.
3. **The tripping text never reaches the network.** That turn's extraction runs `extractFamilyInterviewMock` locally; `requestFamilyInterview` and `/api/family/recommend` are not called with it. Later turns that screen clean resume the live path. The thread, review card, basics, and resources all survive — `suppressForSafety`'s wipe behavior is retired.
4. Entry-time routing elsewhere is unchanged: crisis text typed on the home composer still routes to coach; `/chat?ask=` handling is untouched.

**Flow 4 — Vignette gate.**
1. `src/domain/family-vignettes.corpus.ts`: ≥ 24 cases `{id, language, text, profile, expectedLead, mustIncludeIds, mustNotIncludeIds, expectSafetyBanner, reviewedBy?, reviewedAt?}` — Breathitt is case #1; en+es coverage; review columns start empty and the module header says unreviewed entries are engineering drafts pending clinician sign-off.
2. Deterministic tier (in `npm test`, zero env, build-breaking): runs mock extract → domains → retrieve → mock rank per vignette; asserts safety-banner expectations, mustNotInclude (never recommend X for Y), fallback honesty, and — once the mock ranker lands — lead-concern expectations for the deterministic path.
3. Live tier (`npm run navigator:gate`, requires `HEALTH_AI_API_KEY`): same corpus through the live prompt builders (shared module, so script and route cannot drift), writes `docs/ops/red-team-results/<date>-navigator-gate.md` with per-vignette lead-match / include / exclude results and an aggregate score. Advisory: the report is the artifact; the build does not depend on it.

## Data Model

```ts
// types.ts — additions (atomic with storage guards + sanitizer + regression test)
export type FamilySafetyEvent = {
  id: string;
  tier: "crisis" | "emergency";
  domain: string;             // CrisisDomain | "safety" | "social"
  createdAt: string;
  acknowledgedAt?: string;
};

export type FamilyRecommendationItem = {
  resourceId: string;         // must resolve via getFamilyResourceById at render
  why?: string;               // linted; absent → static domain rationale fallback
  becauseYouSaid?: string;    // verbatim substring of the caregiver transcript, re-checked at render
  urgency: "act_now" | "soon" | "when_ready";
};

export type FamilyRecommendationSet = {
  interviewId: string;        // stale if ≠ latest interview id → deterministic fallback
  createdAt: string;
  extraction: "live" | "mock";
  heard: string;              // linted lead narrative
  lead: DevNeedDomain;
  items: FamilyRecommendationItem[];
};

// FamilyNavigatorState gains:
//   safetyEvents: FamilySafetyEvent[];
//   recommendations: FamilyRecommendationSet | null;
```

Recompute rules (locked): a new interview round **replaces** `recommendations`; screen resubmit and enrollment toggles do **not** re-rank (deterministic re-ordering only); on reload the stored set renders if its `interviewId` matches the latest interview, else the deterministic path renders. Catalog drift is absorbed by id re-resolution at render — names, contacts, and dates always come from the current catalog; a dropped id drops the row.

`/api/family/recommend` (new route, mirrors the interview route's gates exactly — env pair, `DEMO_PASSCODE`, unconfigured/locked/success envelope, 15s timeout, strict zod body, `response_format: json_object`, temp 0): model `HEALTH_AI_RANK_MODEL || "gpt-4o"` — ranking is the judgment step and gets the stronger tier; extraction stays on gpt-4o-mini. Body caps: transcript ≤ 5000 chars, `candidateIds` ≤ 24. Reply schema caps: `heard` ≤ 600 chars, ≤ 12 recommendations, `why` ≤ 300, `becauseYouSaid` ≤ 200.

## Catalog Additions (procedural guidance — precedent: `kde_dispute_resolution`, `kde_age_three_transition`, `kde_parent_toolbox`)

Three entries, `humanVerify: true` until the user source-checks them, appended at the **end** of the hand-written catalog block (insertion position is behavior — the catalog-order tiebreak feeds ordering assertions):

1. **`idea_school_discipline` — "IDEA school discipline protections (KDE)"** — `[school_iep]`, ages 3–21, statewide, `self_serve`. Summary: when removals exceed ten cumulative school days in a year, federal rules treat it as a change of placement and the school must hold a manifestation determination review — is the behavior connected to a disability the school knew or should have known about; protections can extend to children not yet found eligible. Cites 34 CFR §300.530–536 in text; `sourceUrl` = the federal IDEA regulation page.
2. **`kde_evaluation_request` — "KDE special education evaluation request"** — `[school_iep]`, 3–21, statewide, `school_contact`. Summary: a **written** request to the district starts evaluation timelines under Kentucky rules (707 KAR 1:300 cited in text; no day-count asserted until human-verified). `actNow`: "A written request starts legal timelines that a phone call does not — date it and keep a copy."
3. **`fba_bip_request` — "FBA and behavior intervention plan (BIP) request"** — `[school_iep, therapies]`, 3–21, statewide, `school_contact`. Summary: what a functional behavior assessment is, that the ARC can order one, and that a BIP makes behavior support part of the plan instead of a discipline matter.

Locks that fall out of the verified test/lint reality: entry **names carry a proper-noun anchor** (IDEA/KDE/FBA) so `RESOURCE_NAME_PATTERN`'s full-name alternation cannot over-block legitimate follow-ups ("Have you sent the school a written evaluation request?" must survive `sanitizeFamilyFollowUps` — pinned by a new regression test). The catalog test's single-`verifiedAt` assertion relaxes to per-entry valid-ISO-date-≤-today (the 47 existing entries keep their date); the pinned ID set gains the three ids; the affected e2e ordering assertions are re-pinned in the same phase. Single `sourceUrl` stays (secondary citations live in summary text) — no type change.

## Safety, Scope & Liability

- **`crisis:gate` is additive-only.** New rules and corpus cases for `harm_to_others` (caregiver-reported harm to animals: "harmful towards animals", "hurts/kills animals"; harm to people: threats to classmates/siblings, "hurt other kids", weapon mentions; en+es) with ≥ 6 positives and ≥ 4 traps ("rough with the dog", "he hurt himself at recess" stays a self-harm trap, "fighting over toys"), the recall floor and **zero false positives** maintained, `crisisTierForDomain("harm_to_others") = "crisis"`. New `tSafety` copy pair `harmToOthersResponse` (en+es): if anyone is in immediate danger call 911; for urgent concerns take the child to the nearest emergency department; 988 also serves people worried about someone else; tell the pediatrician what is happening. `createSafeAiResponse` maps the new domain to this copy + `CRISIS_ACTIONS` (additive test).
- **The banner never weakens the words.** Same 988/911 links, same non-dismissible placement, acknowledge-to-continue, voice locked while unacknowledged, audit on show and on acknowledge. What changes is only what happens *around* the words: the navigator keeps working.
- **Crisis text stays on-device.** The tripping turn is mock-extracted locally; no network call ever carries text that matched a crisis/safety/social rule. This preserves the provider-short-circuit principle (safety-gate tests: "provider never called") in the one place this spec touches it.
- **Never-diagnose, re-enforced at the new surface.** `heard` and every `why` pass `containsFamilyDiagnosisClaim`; a violating `heard` falls back to the deterministic summary line; a violating `why` is stripped to the static domain rationale. A `why` naming any catalog resource **other than its own card** is stripped (own name allowed — the card shows it anyway).
- **The rationale-naming amendment is scoped.** The extraction route's "no org/program names" rule stands. Only the **rank** call may reference resources — and only by id, from the candidate set, re-resolved twice. Hallucinated ids die server-side; ids outside the candidate set die client-side.
- **Procedural ≠ legal advice.** Entries describe protections, who decides, and how to start — dated, cited, `humanVerify` until checked. No outcome predictions, no case-specific legal conclusions, and the existing waiver/benefits rules (no eligibility determinations, no income) carry forward untouched.

## Functional Requirements

- **FR-1** `/api/family/recommend`: env/passcode/envelope parity with the interview route; strict body `{text ≤ 5000, profile, language, passcode?, candidateIds ≤ 24}`; server-side id re-resolution drops unknown ids; `HEALTH_AI_RANK_MODEL || "gpt-4o"`, temp 0, json_object, 15s timeout; off-shape reply → `{mode:"success", data:null}`.
- **FR-2** Reply contract `{heard ≤ 600, lead ∈ DevNeedDomain, recommendations ≤ 12: [{id, why ≤ 300, becauseYouSaid? ≤ 200, urgency ∈ act_now|soon|when_ready}]}`, zod-validated; prompt builders live in a shared module imported by both the route and `navigator-gate.mjs`.
- **FR-3** Client validation chain, applied to live **and** mock output: candidate-set membership → diagnosis-claim lint on `heard` + every `why` → other-resource-name strip → `becauseYouSaid` verbatim-substring check against the caregiver transcript. Every drop degrades to the deterministic equivalent; nothing dead-ends.
- **FR-4** Deterministic mock ranker: same output shape, current prioritization order, `lead` = first active domain in DOMAIN_ORDER, static rationale strings, snippets reused from the mock extractor; runs on unconfigured/locked/error/lint-empty. The zero-key demo and e2e exercise it.
- **FR-5** *(amends spec 09 FR-5)* Safety matches on `/family` render the inline banner (tier copy via `crisisTierForDomain` + `classifySafety` level + social flag; `urgent-help` links; acknowledge button) and **continue the turn on the mock path**; the tripping text is never sent to any network call; entry-time routing on all other surfaces unchanged. The enumerated redirect tests are rewritten to assert the new behavior in the same phase.
- **FR-6** `FamilySafetyEvent` + `recommendations` persistence lands atomically: types, storage guards, sanitizer keys, load-time backfill, and a regression test proving a pre-sprint family payload loads intact.
- **FR-7** `hasUnacknowledgedCrisis` extends over unacknowledged family safety events; chat voice, food voice, realtime token route, **and family follow-up dictation** all lock while one is open; show + acknowledge both write audit events.
- **FR-8** Harm-to-others rules + corpus cases: `harm_to_others` domain, tier crisis, ≥ 6 positives / ≥ 4 traps en+es, recall floor and zero-FP maintained, `harmToOthersResponse` copy en+es, safety-gate mapping additive. The front-door corpus invariant (every positive routes coach at entry) applies to the new positives automatically.
- **FR-9** Catalog: the three procedural entries with proper-noun-anchored names, citations in text, `humanVerify: true`, appended at block end; catalog test relaxed to per-entry date validity; pinned ID set updated; follow-up-lint regression ("written evaluation request" phrasing survives) added; affected e2e ordering assertions re-pinned same-phase.
- **FR-10** Rank ordering renders only from a validated, non-stale recommendation set (`interviewId` matches latest); otherwise today's deterministic ordering renders. Screen-only users (no interviews) never invoke rank. Fallback and empty-state semantics byte-identical.
- **FR-11** UI: `heard` narrative leads the resources section; cards show why/quote/urgency in rank order; save/share/enrolled semantics and the nearby-recreation section unchanged; all new strings en+es via `FamilyStringKey` (parity test enforces).
- **FR-12** Vignette corpus ≥ 24 (≥ 6 es), Breathitt as case #1, review columns present; deterministic tier runs inside `npm test` with zero env and is build-breaking; live tier is `npm run navigator:gate`, requires the key, writes `docs/ops/red-team-results/<date>-navigator-gate.md`, and never gates the build.
- **FR-13** READMEs: specs README gains rows 11 **and** the missing 12; plans README lifecycle table gains plan 13; spec 09's row marked amended-by-11.

## Demo Script (the acceptance test)

1. Phone, `/family?k=<passcode>`. Paste the Breathitt paragraph.
2. Facts review renders; basics prefill confirms Breathitt / ~2019 / elementary in one tap (shipped).
3. **Safety beat:** the harm-to-others banner appears — 911 / emergency department / 988 wording, real links — and the conversation *keeps going*. Tap "I've seen this — continue"; note the mic was locked until then.
4. **The money beat:** resources lead with *"Here is what we heard"* naming repeated school removal; top card is IDEA discipline protections with *"You said: 'kicked out of school several times'"*; written-evaluation-request card shows the act-now line; FBA/BIP follows; reading-help entries do not lead.
5. Toggle to es, resubmit a Spanish vignette: banner copy, heard narrative, and justifications in Spanish; catalog summaries English with the existing notice.
6. Kill the passcode (`/family` without `?k=`): same flow, deterministic copy — the demo never dies with the key.
7. Show `docs/ops/red-team-results/<date>-navigator-gate.md` beside the crisis-gate report: recommendation quality is now a tested artifact.

## Success Criteria (demo-grade)

- `npm run check` green with zero env (deterministic vignette tier included); `npm run crisis:gate` green — recall 1.00, zero FP, corpus grown additively; `npm run test:e2e` green including the rewritten `/family` safety beats.
- The Breathitt vignette passes deterministically (banner + mustNot: reading-lead) and live (lead = school discipline/evaluation) on the deployed app with `?k=`.
- Every new catalog entry's `sourceUrl` fetch-verified before demo day; `humanVerify` flags cleared only by the user.
- A pre-sprint localStorage payload loads without reset; a mid-crisis reload re-renders the unacknowledged banner.

## Phasing

Gate-first, per the locked build order: **P0** harm-to-others rules + corpus + copy (classifier layer; behavior unchanged). **P1** banner-and-continue (state, selector, voice locks, audit, test rewrites). **P2** procedural catalog entries + test rework. **P3** vignette corpus + deterministic tier + `navigator-gate.mjs`. **P4** `/api/family/recommend` + mock ranker + persistence. **P5** rank UI + `heard` narrative + es parity + READMEs. Exact build steps, commits, and acceptance in **plan 13** (`docs/plans/13-family-navigator-rank-justify.md`) — where they disagree, the plan wins.

## Open Questions & Risks

- **Rank-quality ownership.** The vignette corpus ships engineering-drafted; `reviewedBy`/`reviewedAt` stay empty until a clinician passes over it. The gate makes quality *visible*, not *validated* — the report says which, honestly.
- **KY evaluation timeline.** The day-count is deliberately not asserted until `kde_evaluation_request` is human-verified against 707 KAR 1:300; copy ships with the citation and no number.
- **Zero-FP pressure on harm-to-others.** "Rough with the dog" vs "harmful towards animals" will take a tightening iteration, like the third-person rules did. Budgeted, not surprising.
- **Two models, one budget.** gpt-4o on rank raises per-session cost; acceptable at demo volume, revisit before any real-family scale.
- **Ranking behind a stale flag.** If a family edits the screen after ranking, rank order reflects the interview while the domain set reflects the union — the deterministic layer absorbs the delta, but a re-rank affordance ("update my list") is a fast follow if it confuses.
- **Shared tree.** Plan 12 is Active; path-scoped commits and the screening do-not-touch list are non-negotiable.

---

Grounding: all codebase claims verified 2026-07-21 against the working tree at `0b034c5` via a five-reader research pass + adversarial gap-check (files: `src/domain/safety.ts`, `src/domain/crisis-red-flags.ts` + `.corpus.ts` + `.test.ts`, `src/domain/social-screen.ts`, `src/ai/safety-gate.ts` + `.test.ts`, `src/ai/output-guard.ts`, `src/ai/voice-gate-corpus.test.ts`, `src/domain/front-door.test.ts`, `src/domain/family-resources.ts` + `.test.ts`, `src/domain/family-interview.ts`, `src/domain/family-screen.ts`, `src/domain/family-diagnosis-lint.ts`, `src/domain/family-follow-up-lint.ts`, `src/domain/family-basics-extract.ts`, `src/components/family-experience.tsx`, `src/components/family-interview.tsx` + `.test.tsx`, `src/components/family-orientation-interview.tsx` + `.test.tsx`, `src/components/family-follow-up-turn.tsx`, `src/components/urgent-help.tsx`, `src/components/conversation-panel.tsx`, `src/state/store.tsx`, `src/state/storage.ts`, `src/state/selectors.ts`, `src/app/api/family/interview/route.ts`, `src/app/chat/page.tsx`, `src/i18n/family-strings.ts` + `.test.ts`, `src/i18n/strings.ts`, `src/app/family/page.test.tsx`, `e2e/family-navigator.spec.ts`, `scripts/crisis-gate.mjs`, `package.json`, `docs/ops/DEPLOYS.jsonl`). Decisions locked by the user 2026-07-21 in-session: banner-and-continue for animal-harm/suicidal-ideation content with standard 911/ED language; procedural guidance in the catalog: yes; build order gate-first. The motivating Breathitt session is the same date. Production is live at `4cbe8c7` (2026-07-21 deploy, 71 commits) — this spec changes a shipped surface.
