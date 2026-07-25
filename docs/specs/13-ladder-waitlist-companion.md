# Ladder Waitlist Companion — The Productive Wait (Demo)

> Ladder today is a great first hour: a family describes their child, gets verified county-matched resources, and can book the evaluation visit when it's offered. But the wait it serves is ~12 months long, and after that first hour the app goes quiet. This spec makes the wait **longitudinal and productive**: everything a family does while waiting accrues into (a) a materially better evaluation visit, (b) services already running before the visit happens, and (c) a shorter effective wait. The anchor mechanic is **the family's own dated words** — the app already extracts, grounds, and stores them; it just never shows them again. Six features turn that stored record into the product: a wait-status header, an observation journal, a printable Visit Packet, a tracked next-steps loop with real deadline clocks, a monthly check-in with skill-loss watch and a one-question experience pulse, and an earlier-visit list. Still a demo for UKHCI — fictional data, on-device, honest badges — but the shape is the pilot's shape, and the pulse question hands UKHCI the patient-experience metric their Executive Value Analysis is blocked on.

**Status:** Spec authored 2026-07-25. Extends spec 09 (Family Navigator) and spec 11 (rank-and-justify) after plan 14 (UKHCI Ladder rebrand + evaluation-visit loop) shipped to production 2026-07-24 (`dpl_H8ReZXsxssdWBx8MU7uYHBcrWAxT`). Code identifiers stay `family*`; user-facing brand is Ladder. **Implemented by [plan 15](../plans/15-ladder-waitlist-companion.md)** — Tasks 1–13 landed on `master` 2026-07-25 (`4958339`→closeout). Closeout gates: `npm run check` green (lint clean, 1997 unit tests, build clean), `npm run crisis:gate` **PASS unchanged** (310 tests, 6 files), `family-navigator.spec.ts` 27 passed / 1 skipped across chromium + mobile including both new companion journeys. Deferred as spec'd: impact-dashboard render, notification reuse for check-ins, model-ranked guides, accounts/persistence.

## Problem & Rationale

Two lines of shipped code state the problem precisely:

1. `src/components/family-experience.tsx:344` — `const reviewFacts = family?.facts.filter(({ interviewId }) => interviewId === latestInterviewId)`. Every fact from every earlier conversation is extracted, provenance-tagged, persisted — **and filtered out of the render**. The app accumulates a longitudinal record of the child and shows the family only the newest slice.
2. `family.referral.referredAt` is written when the demo referral is seeded and **read by nothing**. The app knows the day the wait started and never mentions it.

Meanwhile the real-world wait is ~12 months (spec 09's epic-level framing). What a waiting family actually needs, month by month:

- **A memory.** A developmental evaluation is mostly history-taking: *when did you first notice, how often, give me an example.* After a year, parents answer from stressed recall and the best details are gone. Dated observations captured in the moment are clinically better evidence than anything reconstructed in the exam room.
- **Parallel progress.** First Steps, the Michelle P. list, a written school evaluation request — these run *concurrently* with the dev-peds wait, several have date cutoffs that permanently cost the family if missed, and today the app hands over a card and forgets it.
- **A shorter wait.** Clinics scramble to fill late cancellations. A family that has said "call us if something opens" — with constraints — converts cancelled slots into completed visits. This is the only feature that *reduces* the waitlist rather than decorating it.
- **Someone noticing change.** Twelve months is long enough for a child to change materially. Loss of previously acquired skills is a "tell the clinic now" finding; today nothing in the app would catch "she used to say twenty words and now says four."
- **Help with this week.** Sleep, meltdowns, feeding, communication. Verified plain-language strategies, matched to what the family already said — education, not therapy.

## Target Users

Same as spec 09: Kentucky caregivers of children with developmental concerns, on (or headed for) the UK Developmental Pediatrics waitlist. Phone-first, possibly low-literacy, possibly Spanish-speaking, in a stressful season of life. Secondary audience: the UKHCI room — this demo is the working argument for the Ladder pilot, and every feature maps to a pilot metric (engagement, no-show, patient experience).

## Goals & Non-Goals

**Goals**

1. Give a waiting family a reason to open Ladder in month 4 that pays off in month 12.
2. Turn stored-but-hidden facts into a family-visible journal and a printable Visit Packet.
3. Make time-critical parallel tracks (First Steps cutoff, Michelle P. date-ordering) visible as calm, dated clocks with tracked follow-through.
4. Catch skill regression during the wait and route it to the clinic — without promising re-triage.
5. Define and capture the patient-experience metric (one-question pulse) UKHCI has not yet defined.
6. Demonstrate the earlier-visit list end to end on the patient side.
7. Accrue an engagement-event record sufficient to compute the pilot's 50%-engagement / 25%-no-show / experience metrics later (dashboard itself stays deferred).

**Non-Goals**

- No backend, accounts, or cross-device sync — durability is handled with honesty + export, and real persistence is named as the demo→pilot graduation gate.
- No real clinic scheduling integration; the earlier-visit list is patient-side UX plus a demo control.
- No push/SMS notifications in core scope (the app's existing opt-in PWA reminder machinery is a named stretch, not a dependency).
- No tele-therapy, no generated clinical advice: model output never authors strategies, facts, or resource names — selection and grounding only, per spec 11's structural rule.
- No new crisis pathway. The crisis gate is frozen; this spec adds a distinct, non-locking "clinic-now" tier for regression and routes all new free text through the *existing* family interview surface so gate coverage is inherited, not re-implemented.
- No school-evaluation day-count countdowns until 707 KAR 1:300 is human-verified (Open Questions).
- IPV/ACEs and other sensitive screens stay excluded per spec 10's boundary.

## How It Builds on Existing Primitives (ground truth, verified 2026-07-25 at `36b9e68`)

| Primitive | State today | This spec's use |
| --- | --- | --- |
| `FamilyFact` (label, value, `sourceSnippet`, provenance status) + `familyFactStatus` | Extracted per interview, persisted, rendered only for the latest interview | The journal and Visit Packet are largely a *render* of this existing data, grouped by date |
| Family interview surface (typed + dictation, atomic submission, crisis-gated, mock/live extraction) | One orientation conversation | Reused verbatim as the note-entry and check-in-entry path — zero new free-text surface class |
| `FamilyInterview` rows with `createdAt` | Stored, undistinguished | Gain a `kind` tag (`orientation` \| `note` \| `checkin`) for journal grouping and engagement metrics |
| `referral.referredAt`, `FamilyAppointment` machinery (plan 14) | Written; `referredAt` unread | Wait-status header renders it; earlier-visit offers reuse the offer/book reducer path |
| Stage timeline + `YEAR_ONLY_TIMING_NOTE` (`family-stages.ts`) | Age-window nudges, honest year-only caveat | Deadline clocks extend this engine; year-only profiles use the same early-and-honest convention |
| Demo time-travel controls (`backdateFamilyDiagnoses`, `setFamilyAppointmentCountdown`) | Shipped pattern | Check-in due-ness and earlier-visit demo controls follow it |
| `buildCareTeamMessage` (`care-team-message.ts`) + Health Brief print CSS (`health-brief-card.tsx`, `@media print`) | Deterministic plain-text builders, printable views | Visit Packet = same pattern: deterministic builder + printable component |
| Vignette gate (`family-vignettes.corpus.ts`, deterministic tier in `npm test`) | Build-breaking recommendation-quality tests | Regression-cue detection gets corpus cases + traps under the same gate |
| Resource catalog verification discipline (`verifiedAt`, `sourceUrl`, do-not-seed list) | 37 org entries | Extended to a small *content* catalog (`FamilyGuide`) under identical rules |
| `alreadyEnrolled` + matching exclusion | Boolean per resource | Absorbed into the steps tracker as its `enrolled` status; kept in sync for matching |
| Audit events (5 appointment events landed in plan 14) | Append-only log | Engagement-event taxonomy formalized on top; dashboard deferred |

## Design Principles (carry-forward invariants)

1. **One ask at a time.** Never two open questions on screen. The header shows a *pointer* to the single next thing, never a second copy of the question itself.
2. **The family's own words, dated.** Provenance badges ("From your words" / "Our guess") stay first-class; the Visit Packet contains zero model prose.
3. **Verified, dated, cited — or absent.** Every clock, guide, and urgency line carries a source and an as-of date. Unverifiable numbers (school-eval day counts) are excluded, not softened.
4. **Calm, not alarmist.** Deadline copy explains *why* and gives weeks, not sirens. Only the crisis gate interrupts; the clinic-now tier informs.
5. **Nothing is locked behind engagement.** Skipping the pulse, ignoring check-ins, or declining the earlier-visit list never degrades resources or booking.
6. **Honest demo.** Simulated things say "(demo)". On-device storage is disclosed where the family is asked to invest ("Notes stay on this device — print or share a copy sometimes").
7. **Full es parity** (informal `tú`, brand "Ladder" untranslated), existing accessibility patterns (min-h-12 targets, focus rings, aria-live where content appears).

## Key User Flows / Features

### F1 — "Your Ladder" wait-status header

A compact card at the top of `/ladder` once a profile exists.

- **Wait line:** "On the list at UK Developmental Pediatrics since March 2026 — about 4 months so far." Computed from `referral.referredAt`. If no referral: the existing seed CTA lives here. **Never a predicted seen-by date**; optional honesty line: "We can't predict the exact date — here's what makes the wait useful."
- **Next rung:** exactly one pointer chip, deterministic priority (tested pure function `nextFamilyRung(state, now)`):
  1. unacknowledged safety event (points at banner)
  2. due appointment reminder / overdue visit question (points at appointment card)
  3. unacknowledged clinic-now flag (F5)
  4. deadline clock inside its warning window (F4)
  5. monthly check-in due (F5)
  6. oldest stale planned step (F4 follow-up)
  7. journal nudge if no touch in 30+ days ("Add a 10-second note about Mateo")
  8. quiet (no chip)
- **Count chips:** notes N · steps in motion N · visit date (when booked) · "on the earlier-visit list" (when opted in).
- Tapping the rung scrolls/focuses the owning section — the header never hosts the interaction itself (invariant 1).

### F2 — Observation journal ("Your notes" / "Tus notas")

- **Entry:** the existing interview box, reframed. After the orientation conversation completes, its placeholder becomes "What did you notice this week? A sentence is plenty." Submissions create `FamilyInterview` rows with `kind: "note"` and run the identical extraction + crisis gate. Dictation already works; a note is a ten-second voice memo.
- **Journal section:** below the thread, "Your notes so far" renders **all** facts (not just the latest interview's), grouped by month, newest first, each with its date, provenance badge, and verbatim snippet. Raw note text is expandable per entry.
- **Non-destructive curation:** each fact gets an "include in visit packet" toggle (`includeInSummary`, default true). No delete in scope — the journal is an append-only record, and exclusion covers "I didn't mean that."
- **Durability honesty:** a fixed line under the journal — "Notes stay on this device. Print or share a copy sometimes so you don't lose them." After every 5th note, a one-time nudge points at the Visit Packet's print/copy action.
- The in-thread "here is what we heard" review turn is unchanged (it reviews *the newest* submission — correct as-is).

### F3 — Visit Summary & Packet ("Visit packet" / "Paquete para la visita")

A deterministic builder + printable view, no model in the path (care-team-message + health-brief patterns).

`buildFamilyVisitSummary(family, language, now): string` (plain text, copyable) and `<FamilyVisitPacket>` (printable). Sections, all from on-device state:

1. Child basics (first name if given, birth year/stage, county) and diagnoses with dates.
2. **What we noticed, over time** — dated facts where `includeInSummary !== false`, family's verbatim snippets, grouped by month; provenance marked; "Our guess" facts either excluded or explicitly labeled (decision: excluded from print, visible in journal — the packet is testimony, not inference).
3. **Changes we're flagging** — unresolved clinic-now flags (F5), prominent.
4. **Services already in motion** — steps with status `in_touch`/`enrolled` and their dates (F4).
5. **Questions we want to ask** — checkbox-picked from a fixed starter list (~10 items, e.g. "What do the results mean for school?", "Who coordinates next steps?"). Fixed-only in this scope; custom questions belong to the interview surface.
6. Logistics line when relevant ("We may need help with transportation" from a recorded ride barrier).
7. Footer: "Written from our own notes in Ladder · printed {date} · not a medical record."

The **prep card** from plan 14 grows into the packet's cover page: what to bring (including "this packet"), what happens at the visit, how long it takes, comfort tips — verified/cited copy (CDC act-early + clinic-agnostic phrasing). Print via `window.print()` scoping (existing `@media print` pattern); copy + share reuse existing actions and audit as `shared`.

### F4 — Next-steps tracker + deadline clocks ("Next steps" / "Próximos pasos")

- **Commit loop:** every matched resource card gains "I'll do this" → creates a `FamilyResourceStep { resourceId, domain, status: "planned", plannedAt }`. Statuses: `planned → tried → in_touch → enrolled → not_for_us`. `enrolled` sets `alreadyEnrolled` (and vice-versa via the existing toggle) so matching exclusion keeps working.
- **Follow-up turn (max one per page visit):** if the oldest `planned`/`tried` step is >7 days stale: "Last time you planned to call First Steps — how did it go?" [Got through / Left a message / Haven't yet / Not for us] → status update + optional gentle retry later. Fixed buttons only. Feeds the header's rung #6.
- **Deadline clocks — verified facts only:**
  - **First Steps cutoff:** referrals not accepted within 45 days of the 3rd birthday (already a catalog `actNow` fact). Computed from birth year/month; **year-only profiles assume the earliest possible birthday** so the warning fires early, carrying the existing year-only honesty note. Renders as a calm chip on the First Steps card + escalates the stage-timeline entry: "about {n} weeks left to start this — after that, the school system takes over referrals."
  - **Age-3 transition window** — already in the stage engine; the clock chip unifies its presentation.
  - **Michelle P.:** urgency without a fake date — "the list is date-ordered; applying now holds your place" (existing verified fact). Tracked as a step like any other.
  - **Explicitly excluded:** Kentucky school-evaluation day counts until 707 KAR 1:300 is human-verified. The card says "the school's timeline is set by state rule — ask for the dates in writing" instead of asserting numbers.

### F5 — Monthly check-in, change watch, and the pulse

**Due-ness:** >30 days since last touch (touch = any interview/note, step update, appointment action, or check-in; derived selector, no new clock storage). Surfaces as the header rung + a single thread turn. Demo control follows the backdate pattern ("pretend a month passed").

Three-part sequence, strictly one ask at a time, each skippable:

1. **Open note:** "It's been about a month. Anything new or different with Mateo?" — routes through the interview surface (`kind: "checkin"`), same extraction, same crisis gate.
2. **Skill-loss probe (fixed buttons):** "Compared with a few months ago, has Mateo lost any skills he used to have — words, movements, things he could do?" [No / Not sure / Yes, I think so]
   - **Yes** → **clinic-now card**: "Losing skills is worth telling the clinic about now — not waiting for the visit. Call {clinic}. This can matter for how soon he's seen." Records `FamilyFlag { type: "regression", source: "probe" }`; lands in the packet's flagged section; acknowledge-to-dismiss; **never locks the page, never promises re-triage.**
   - **Not sure** → two-sentence cited examples of what skill loss looks like, then [No / Yes, I think so].
3. **Pulse:** "How supported do you feel this month?" — five tap targets (1–5) + optional skip. Stores `FamilyPulse { at, score }`. **Metric definition handed to UKHCI: patient experience = % of pulses scoring 4–5 during the wait.** Never gates anything.

**Regression cues in free text (all family surfaces):** a deterministic `REGRESSION_CUES` lexicon (en/es) in the extraction layer — "stopped talking", "lost words", "used to … now doesn't", "no longer", "forgot how to", "dejó de hablar", "perdió palabras", "ya no" — raises the same flag with `source: "text"`. **Trap discipline (build-breaking, vignette-gate tier):** must NOT fire on "lost his shoe", "we lost track of time", "I'm losing my mind" (caregiver burnout → parent_support), "she stopped crying at drop-off" (positive change), "no longer needs diapers at night" (gain). Corpus: ≥8 positives, ≥6 traps, en+es.

### F6 — While-you-wait guides ("Things to try at home")

A small **content** catalog under the org-catalog's exact verification discipline:

```ts
interface FamilyGuide {
  id: string;
  domains: DevNeedDomain[];
  ages?: { min?: number; max?: number };   // months
  title: string;                            // "Two-word ladders: growing speech at home"
  plainSummary: string;
  steps: string[];                          // 3–5 short imperative lines, verbatim from cited source or faithful plain-language adaptation
  sourceName: string;
  sourceUrl: string;                        // fetch-verified at seed time
  verifiedAt: string;
  humanVerify?: boolean;
}
```

- Seed ~10 across the highest-traffic domains (therapies/speech, behavior/routines, school prep, parent support), from stable public sources (CDC "Learn the Signs. Act Early." materials, healthychildren.org, KY-SPIN handouts). Do-not-seed list applies; anything bot-blocked goes on the pre-demo human-verify list.
- Surfaced (a) as a compact "Things to try at home" strip under matched resources (max 2, matched deterministically by lead domain + age); (b) as the optional close of a check-in when the note maps to a domain. Guides render with source + date, always.
- **No model authorship.** A later spec may let the rank-justify chain order guides with "because you said…" lines; this scope is deterministic match only.

### F7 — Earlier-visit list ("If a spot opens sooner" / "Si se abre un lugar antes")

- **Opt-in turn** on the appointment card, available from the moment a referral exists (most valuable *before* the first offer): "Cancellations happen. If an earlier time opened up, could you take it on short notice?" [Yes, put us on the list / No thanks]
- **Yes** → fixed multi-select constraint chips: [Weekday mornings / Weekday afternoons / Any weekday / We need 2+ days' notice] → `FamilySoonerList { optedInAt, constraints[] }`. Header chip: "On the earlier-visit list". Opt-out is one tap, anytime.
- **Demo control:** "An earlier opening appeared (demo)" → generates a near-term offer consistent with the stated constraints, through the *existing* offer/book reducer path (a new `FamilyAppointment` with near slots). Accept → booked earlier (reminder ladder recalibrates automatically); decline → original booking untouched, still listed.
- **Pilot seam, stated plainly in-app and in this spec:** matching real cancellations requires clinic scheduling integration and an operational owner — out of scope. The demo proves the patient-side flow and the ops pitch (filled cancellations = the no-show metric attacked from both directions).

## Data Model (additions to the `family` slice)

```ts
// FamilyInterview gains:  kind: "orientation" | "note" | "checkin"   (backfilled to "orientation")
// FamilyFact gains:       includeInSummary?: boolean                 (absent ⇒ true)

export type FamilyStepStatus = "planned" | "tried" | "in_touch" | "enrolled" | "not_for_us";
export type FamilyResourceStep = {
  id: string;
  resourceId: string;
  domain: DevNeedDomain;
  status: FamilyStepStatus;
  plannedAt: string;
  updatedAt: string;
};

export type FamilyPulse = { at: string; score: 1 | 2 | 3 | 4 | 5 };

export type FamilyFlag = {
  id: string;
  type: "regression";
  source: "probe" | "text";
  raisedAt: string;
  acknowledgedAt?: string;
};

export type FamilySoonerConstraint = "weekday_mornings" | "weekday_afternoons" | "any_weekday" | "needs_notice";
export type FamilySoonerList = { optedInAt: string; constraints: FamilySoonerConstraint[] };

// FamilyNavigatorState adds:
//   steps: FamilyResourceStep[];
//   pulses: FamilyPulse[];
//   flags: FamilyFlag[];
//   soonerList: FamilySoonerList | null;
```

**Storage:** optional-backfill discipline exactly as plan 14 established — old saves validate, sanitizer backfills (`steps: []`, `pulses: []`, `flags: []`, `soonerList: null`, `kind: "orientation"`), guards enforce semantic coherence (scores 1–5, known statuses/constraints, timestamps ≥ creation where applicable, dedupe by id). `enrolled` steps and `alreadyEnrolled` are kept mutually consistent by the reducer.

**Engagement events (taxonomy, audit-log-backed — dashboard deferred):** `note_added`, `checkin_completed`, `pulse_recorded`, `step_planned`, `step_updated`, `flag_raised`, `flag_acknowledged`, `sooner_opted_in`, `packet_printed`, `packet_shared`, plus plan 14's five appointment events. A pure selector `familyEngagement(state, now)` derives lastTouchAt / touches in last 30d / counts, so the future impact dashboard is a render over data that started accruing now.

## Safety, Scope & Liability

- **Crisis gate: frozen and inherited.** Every new free-text path (notes, check-in text) *is* the existing family interview surface — same extraction route, same on-device crisis handling, same corpus coverage. No new free-text surface class exists for the gate to miss. `crisis:gate` and the navigator vignette tier must pass unchanged.
- **Clinic-now tier is not the crisis tier.** Regression flags render an informational card (call the clinic now), never lock voice or the page, and never claim scheduling outcomes. Copy reviewed against the no-diagnosis lint: naming a *symptom pattern to report* is allowed; naming a condition is not.
- **No invented facts.** Packet and journal are deterministic renders of stored, provenance-tagged data. Clocks compute from profile dates + catalog-verified facts. Guides are catalog text. The model's only jobs remain extraction (existing) and — later, out of scope — guide ranking.
- **Dated-fact honesty.** Every clock/urgency line carries source + as-of date; excluded facts (school day counts) are excluded loudly in-app, not silently.
- **Durability honesty.** On-device storage disclosed where investment is requested; print/copy is the sanctioned backup. Real persistence is the named demo→pilot gate.
- **Not a medical record; not medical advice** footer on the packet; existing demo badge stays page-level.

## Functional Requirements

- **FR-1** `/ladder` shows the wait-status header once a profile exists; it renders `referredAt` as a month + elapsed duration and exactly one next-rung pointer per the priority function; the function is pure and unit-tested across all 8 priority states.
- **FR-2** Submitting text ≥1 char in the interview box after orientation creates a `kind:"note"` interview; the journal groups all facts by month with provenance badges and verbatim snippets; toggling "include in packet" flips `includeInSummary` without deleting anything.
- **FR-3** The Visit Packet builder is deterministic (same state ⇒ same string), excludes `inferred` facts and `includeInSummary === false` facts from print, includes unresolved flags and in-motion steps, and renders printable via the existing print pattern; copy/share audit as `shared`.
- **FR-4** "I'll do this" creates a step; the follow-up turn appears at most once per page visit and only for steps >7 days stale; `enrolled` ⇔ `alreadyEnrolled` consistency holds under both entry paths (property-tested in the reducer).
- **FR-5** The First Steps clock fires only for profiles where the child is under 3, computes from the earliest-possible birthday when only a year is known (with the year-only note), disappears at enrollment (`enrolled` step) or age-out, and never renders a school-eval day count.
- **FR-6** The check-in turn appears only when the derived last-touch exceeds 30 days; its three parts run strictly sequentially; every part is skippable; completion updates last-touch so it cannot re-fire same-session.
- **FR-7** The skill-loss probe's "Yes" path and any `REGRESSION_CUES` text hit raise exactly one unacknowledged regression flag at a time (no duplicates), render the clinic-now card, and place the flag in the packet; acknowledged flags stop rendering but stay in the packet history.
- **FR-8** The regression lexicon passes its vignette-gate tier: all corpus positives flag, all traps stay silent, en and es, inside `npm test` with zero env.
- **FR-9** The pulse stores at most one score per check-in, renders as five ≥44px tap targets, and skipping records nothing.
- **FR-10** Guides render only from the seeded catalog with visible source + `verifiedAt`; matching is deterministic (domain + age); at most 2 in the resources strip.
- **FR-11** Earlier-visit opt-in stores constraints; the demo control produces an offer through the existing `offerFamilyAppointment` path whose slots respect the constraint labels; accepting rebooks via the existing book path and the reminder ladder recomputes; declining changes nothing.
- **FR-12** Every listed engagement event writes its audit entry; `familyEngagement` derives last-touch and 30-day counts correctly across event types (unit-tested with a synthetic year of activity).
- **FR-13** All new user-facing strings ship en + es simultaneously; the second-person rationale test extends to new surfaces.
- **FR-14** `npm run check`, `crisis:gate`, and the deterministic navigator/vignette tiers pass unchanged throughout; no new free-text surface exists outside the family interview component (enforced by review + a grep-style test on input/textarea usage in new components).

## Demo Script (the acceptance walkthrough)

*Persona: returning family, profile saved weeks ago, referral seeded, visit booked for next month. Language toggled es at beat 7.*

1. Open `/ladder`: header reads "On the list since March — about 4 months," next rung: "Monthly check-in (30 seconds)."
2. Tap the mic, say "He stopped using the word 'more' at dinner — he used to say it every night." Note lands; review turn shows the fact, "From your words."
3. Check-in continues: skill-loss probe → "Yes, I think so" → clinic-now card names the clinic and why calling now matters. Acknowledge.
4. Pulse: tap 2. (The room sees the metric UKHCI hasn't defined get captured in one tap.)
5. Journal shows three months of dated notes; toggle one early note out of the packet.
6. Resources: First Steps card wears the clock chip ("about 6 weeks left to start this"); tap "I'll do this." A guide strip shows "Two-word ladders" with its CDC source and date.
7. (es) Header, check-in, and packet strings render in Spanish; brand stays "Ladder."
8. Earlier-visit turn: opt in, pick "weekday mornings." Demo control fires "an earlier opening appeared (demo)" → Thursday 9:30 offer → accept → booked earlier; reminder recomputes.
9. Print the Visit Packet: cover prep page + dated observations + flagged regression + services in motion + picked questions. The room holds the artifact a family would hand the clinician.
10. Return visit (time-travel a month): follow-up turn asks "Did you get a chance to call First Steps?" → "Left a message" → step updates; header rung moves on.

## Success Criteria (demo-grade)

- A first-time viewer can say what the family gets out of months 2–11 without being told.
- The packet prints clean on one Letter sheet + cover, readable at arm's length, zero model prose.
- Every number, date, and strategy on screen traces to a cited source or the family's own words.
- The UKHCI mapping is articulable per feature: engagement (F2/F5 events), no-show (F4 barriers + F7 backfill + plan 14 reminders), experience (F5 pulse), EVA unblock (metric definitions + event substrate).
- Gates stay green; es parity holds; no invariant regressions (one-ask, honesty badges, provenance).

## Phasing (scope groups for the implementation plan)

- **P0 — Spine:** types + storage backfill (`kind`, steps/pulses/flags/soonerList), `nextFamilyRung`, wait-status header rendering `referredAt`, engagement selector + event taxonomy.
- **P1 — Journal:** note framing of the interview box, all-facts journal render, include-toggle, durability line + export nudge.
- **P2 — Packet:** deterministic builder + printable view + starter questions + prep cover; print/copy/share wiring.
- **P3 — Steps & clocks:** step statuses + card CTA + follow-up turn + First Steps / age-3 clocks + Michelle P. urgency step.
- **P4 — Check-in & watch:** due-ness, three-part turn, regression lexicon + vignette corpus + clinic-now tier, pulse.
- **P5 — Guides & sooner list:** guide catalog seeding (fetch-verified) + strips; earlier-visit opt-in + demo control; demo-script polish pass.

Each phase demos standalone; P0 ships no visible behavior beyond the header and is the compile/storage keel.

## Open Questions & Risks

1. **707 KAR 1:300 verification** (school-eval timelines) — owner + date needed before any day-count ships; until then FR-5's exclusion stands.
2. **Guide source list** — final ~10 sources need fetch-verification at seed time; bot-blocked candidates (healthychildren.org occasionally) go to the human-verify list. Adaptation vs verbatim wording per source's terms needs a per-entry note.
3. **Regression lexicon recall** — the cue list will miss phrasings (that's the probe's job to backstop); the risk to manage is false *positives* eroding trust — hence trap-heavy corpus and the "Not sure" education path rather than instant alarm.
4. **Alarm fatigue** — one-rung rule + calm copy are the mitigations; if a future feature wants a second simultaneous prompt, this spec's invariant loses and must be re-argued explicitly.
5. **Year-only birthdays** make the First Steps clock deliberately early — copy must make "early on purpose" feel careful, not broken (existing note pattern helps).
6. **Notification stretch** — reusing the app's opt-in PWA reminder machinery for check-in nudges is plausible and deliberately out of core scope; decide after P4 lands.
7. **Pulse wording** — "supported" vs "confident" vs "heard"; pick once, keep stable (metric comparability), verify the es rendering with a native reader before the UKHCI demo.
8. **Durability promise creep** — the moment any real family is told to keep notes here, localStorage is a broken promise; the pilot gate (accounts/persistence) must precede any real-family use of F2/F3.
