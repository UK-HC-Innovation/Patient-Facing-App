# Ladder Resources-First Front Door — One-Line Verification, Help Before Questions (Demo)

> After a caregiver describes their child, Ladder currently answers with five stacked "we received your words" surfaces — an echo of their own text, "Here is what we heard" fact cards, a "Why these areas" rationale list, a blocking "We already picked this up from what you wrote" basics-confirm card, and a pointer to resources that live a full page-scroll away under a *third* recap. The help arrives last and the ceremony arrives first. This spec inverts the order: **one compact "sounds like" sentence (the verification), then real resource cards, then at most one optional clarifying question** — with every fact card, source quote, confirm button, and rationale preserved verbatim inside a collapsed disclosure instead of in front of the help. Extracted basics auto-apply as a provisional profile instead of demanding a confirm tap, because provenance honesty already lives downstream in the journal and Visit Packet. Nothing about extraction, ranking, matching, the crisis gate, or the one-ask invariant changes — this is a render-order and ceremony-removal spec.

**Status:** Spec authored 2026-08-04 from direct user feedback on the live flow ("far too much visual clutter… the first thing that should come out is some possible resources… clarification questions would come next"). Extends specs 09 (Family Navigator), 11 (rank-and-justify), 13 (waitlist companion), 15 (structured routing). Ground truth verified against `master` at `2399d2d`. Implementation target: a single Opus session working directly on `master`; the Phasing section below is the plan skeleton (author `docs/plans/16-ladder-resources-first.md` from it, or implement straight from the FRs).

## Problem & Rationale

The post-submit render order is the problem, and it is fully legible in two files. A caregiver who types *"We live in Scott County and my son just turned three. He isn't talking yet."* sees, top to bottom:

1. **Their own text echoed back** as a chat bubble — `src/components/family-orientation-interview.tsx:315-317`.
2. **"Here is what we heard"** (`factsTitle`) — intro line, then one `FamilyFactCard` per extracted fact, each with label, value, a "You wrote…" blockquote, and its own confirm button — `src/components/family-experience.tsx:756-791`.
3. **"Why these areas"** — a per-domain rationale list — `family-experience.tsx:777-789`.
4. **"We already picked this up from what you wrote"** (`basicsPrefillTitle`) — the basics-confirm card with three more label/value/quote rows and two buttons — `family-experience.tsx:209-274`. This card **blocks the rest of the conversation** via `holdTurn={needsBasics}` (`family-experience.tsx:992`), and resources cannot match at all until it is answered because matching requires a saved profile (`family-experience.tsx:415-428`).
5. **"We found N places that can help — they're just below"** — a pointer paragraph (`family-experience.tsx:837-848`); the actual resources section sits below the appointment card and follow-up ask, topped by a **third recap** ("What matters most right now" + the ranked `heard` sentence, `family-experience.tsx:1160-1167`).

Five acknowledgment surfaces before any help; two of them repeat the same trust legalese ("Nothing is saved until you say it is correct" — `factsIntro` and `basicsPrefillIntro`); the clarification questions (`FamilyFollowUpTurn`, up to 2 rounds) interleave before the family ever reaches a resource card.

The material insight: **the sentence the family actually needs already exists.** The ranked `heard` line — validated by `validateHeard` (`src/domain/family-rank.ts:115-119`) so it can never carry a diagnosis claim — is exactly "based on your description, it sounds like…". It just renders at the bottom of the page while the ceremony renders at the top. And the confirmation ceremony is redundant *by the app's own design*: every fact already carries a provenance badge ("From your words" / "Our guess — please check" / "You said this is right"), the journal renders all of it with confirm buttons, and the Visit Packet already excludes inferred facts from print. The trust machinery is downstream and structural; the upfront ceremony duplicates it at the exact moment the family wants an answer.

## Target Users

Same as specs 09/13: Kentucky caregivers of children with developmental concerns — phone-first, possibly low-literacy, possibly Spanish-speaking, in a stressful season. On a phone, the current five-surface stack is 3–4 screens of scrolling before the first resource. Secondary audience: the UKHCI room — "family types one paragraph, help appears" is the demo beat this spec buys.

## Goals & Non-Goals

**Goals**

1. First screen after one submission = one summary sentence + real resource cards + at most one optional question.
2. Verification becomes a one-line strip with an expandable disclosure — never a wall.
3. Extracted basics (county / birth year / school stage) auto-apply as a provisional profile; the confirm tap is deleted; only genuinely missing fields are asked, one at a time.
4. Clarifying questions become visibly optional re-rankers that render *below* resources.
5. Zero loss of trust machinery: every fact card, source quote, confirm action, rationale, and provenance badge survives — relocated, not removed.

**Non-Goals**

- No changes to extraction (`extractFamilyInterviewMock`, live provider), ranking (`rankFamilyResourcesMock`, `validateRankedItems`, `validateHeard`), matching (`buildStructuredResourceMatches`), or the catalog. This spec moves and merges renders.
- No new free-text surface, no crisis-pathway change of any kind. `crisis:gate` must pass byte-identically.
- No partial-profile matching (matching still requires a complete profile; the fix is making the profile complete *without ceremony*, not matching without one).
- No change to the journal, Visit Packet builder, check-in, steps, clocks, or appointment machinery — except the two provenance markers named in FR-4.
- No new model calls. The deterministic strip template is string interpolation.

## Ground Truth (verified 2026-08-04 at `2399d2d`)

| Primitive | State today | This spec's use |
| --- | --- | --- |
| `rankedSet.heard` + `validateHeard` + `HEARD_MAX` (`family-rank.ts:10,115-119`) | Renders at the top of the resources section, far below the fold | Becomes the strip's text when live ranking lands; validation unchanged |
| `rankHeardFallback` string | Generic deterministic fallback sentence | Superseded in the strip by a personalized deterministic template (new strings); string itself stays as `validateHeard`'s fallback |
| `extractFamilyBasics` → `FamilyBasicsHints` (`family-basics-extract.ts:205-253`) | Feeds the prefill-confirm card; every hint carries `sourceSnippet` and `approximate` | Feeds silent auto-apply; snippets render in the disclosure, not a blocking card |
| `FamilyBasicsTurns` (`family-experience.tsx:154-366`) | Prefill-confirm card + sequential county → year → stage turns | Confirm card deleted; sequential turns kept **only for missing fields** |
| `reviewTurn` facts + rationale (`family-experience.tsx:756-791`) | Top-level block in the interlude | Moves inside the strip's `<details>` unchanged (same `FamilyFactCard`, same confirm reducer) |
| Interlude assembly order (`family-experience.tsx:817-850`) | safety → clinic-now → review → basics → pointer | safety → clinic-now → **strip → inline cards** → (missing-basics turn) |
| Follow-up turn placement (`family-orientation-interview.tsx:332-346`) | Already renders *after* the interlude | Unchanged position — with cards in the interlude, the question lands below resources for free |
| `holdTurn` (`family-orientation-interview.tsx:62,334`) | True whenever `needsBasics` | True only while a missing-field turn is actually pending |
| `pendingReviewFocusRef` (`family-experience.tsx:388-413`) | Focuses the review block on round 0 | Retargets to the strip |
| Provenance badges + journal + packet (spec 13 F2/F3) | "From your words" / "Our guess — please check" / confirmed; packet excludes inferred facts from print | The structural trust story that makes upfront ceremony safe to remove |
| `FamilyResourceCard` (steps, save, share, enroll, clock line, urgency, `becauseYouSaid`) | Renders only in the resources section | Same component renders top-3 in the thread; identical props and handlers |
| Ranking hold on pending safety (`family-experience.tsx:448-449`) | Live ranking never runs while a safety banner is unacknowledged | Unchanged; deterministic strip + deterministic card order still render |

## Design Principles (carried forward, plus one new)

1. **One ask at a time** (spec 13 invariant 1). The strip and the inline cards are *answers*, not asks; at any moment at most one question is open (missing-basics turn XOR follow-up XOR check-in, existing precedence).
2. **The family's own words, dated.** Quotes, provenance badges, and confirm actions all survive inside the disclosure and the journal.
3. **Safety words first.** The crisis banner and clinic-now card always precede the strip and cards, and are never collapsible.
4. **Verified, dated, cited — or absent.** Unchanged. Inline cards are the same catalog cards.
5. **New: Answer, then verify, then ask.** The default reading order of every future thread surface is: what we can offer → how we understood you (collapsed) → what we'd still like to know (optional). Ceremony may never precede help again without re-arguing this principle.

## Features

### F1 — The "sounds like" strip

One compact turn, rendered in the interlude directly after the safety slots, replacing the `reviewTurn` block, the basics prefill card, and the resources-section heard block.

- **Visible content:** a single sentence + a disclosure toggle. Deterministic template the instant a profile and active domains exist (new strings `heardStrip` en/es), built from profile + lead domain:
  - en: `Sounds like: {county} County · {child}, about {age} · {need}.` — `{child}` is `childFirstName` when present, else "your child"; `{age}` computed from `birthYear`; `{need}` is the existing short domain label (e.g. "Therapies", "Early intervention" — `domainTherapies` et al.).
  - Pieces whose value is unknown are omitted, not placeholder'd.
- **Live upgrade:** when `rankedSet` lands, the validated `heard` replaces the template **in place** (same strip, `aria-live="polite"`). `validateHeard` already guards diagnosis claims; nothing new to validate. While a safety event is pending, ranking is held (existing behavior) and the deterministic template simply stands.
- **Disclosure** (`<details>`, native, collapsed by default; summary copy: "Check or change this" / es equivalent, min-h-12 target). Contents, in order:
  1. The relocated fact cards — same `FamilyFactCard`s for the latest interview, with "You wrote" quotes and confirm buttons wired to the same `confirmFamilyFact` reducer.
  2. The relocated "Why these areas" domain rationale list, unchanged.
  3. A compact profile editor: render `FamilyProfileForm` with `initialProfile`, saving flips provenance to `stated` (F2). When the profile is `extracted` and unconfirmed, a one-line note above it: "We read these from your words — check them" (reuse the `evidenceInferred` tone).
  4. Exactly **one** trust line (replacing today's two): "Nothing here is saved anywhere but this device, and you can change any of it."
- **Attention hint:** when any latest-interview fact has `inferred` status or the profile is `extracted`, the summary row shows a small "check our guesses" chip. The disclosure still defaults closed — a chip, not a wall.
- **Focus:** `pendingReviewFocusRef` retargets to the strip container on round-0 submissions.

### F2 — Provisional basics: auto-apply, ask only the gap

- **Auto-apply rule (round 0, no existing profile):** if `extractFamilyBasics` yields county **and** birthYear, save the profile immediately — no card, no tap — with the new provenance value `extracted`. School stage: use the stated hint when present; else when age ≤ 4, default `not_school_age` (marked approximate); else the stage turn is asked.
- **Missing fields:** the existing sequential turns (`FamilyBasicsTurns`) ask **only** the fields extraction did not produce, one at a time, in the thread — county select, year input, stage chips, unchanged UI. Hinted fields are committed silently and never re-asked. The `confirmingPrefill` card and its states are **deleted**.
- **`holdTurn`** narrows to "a missing-field turn is pending" (profile still null). On the complete-hints path it is never true, so the follow-up question renders the same render the resources do — below them.
- **Provenance:** new family-slice field `profileProvenance: "stated" | "extracted"` (storage: validate → backfill `"stated"` → sanitize, exactly the plan-14/15 optional-backfill discipline). Any manual save — strip editor, setup form, a basics turn answer — sets `stated`. `saveFamilyProfile` gains an optional `provenance` argument defaulting to `"stated"`.
- **Honesty downstream:** while provenance is `extracted`, (a) the strip shows the "check our guesses" chip (F1), and (b) the Visit Packet's child-basics block appends "(read from your description — please check)" / es equivalent. Both markers disappear once any manual save occurs.

### F3 — Resources in the thread

- Directly under the strip, render the top `min(3, displayResources.length)` entries of the **same** `displayResources` array as full `FamilyResourceCard`s — identical props and handlers (steps, save, share, enroll, clock lines, urgency, `why`, `becauseYouSaid`). One `role="region"` labeled with the existing `resourcesTitle`.
- Below the cards: one link — new string `seeAllResources` ("See all {count} places below" / es) — anchored to `#family-resources`. The old pointer paragraph (`resourcesFoundBelow`/`resourcesFoundBelowOne`) is removed; keys deleted if no other consumer.
- **Fallback path** (`matchResult.isFallback`): no inline cards; one line in the thread — new string `fallbackInThread` ("We didn't find county programs for this yet — statewide starting points are below.") — linking to the section, whose existing fallback machinery is unchanged.
- The full resources section below stays as the durable browsing home (all 8 cards, guides, therapeutic recreation, back-to-top). Duplication of the top 3 is deliberate: the thread shows the first answer; the section is the library. Two dedupe edits to the section itself:
  - The "What matters most right now" heard block (`family-experience.tsx:1160-1167`) is **removed** — its content now lives in the strip.
  - `resourcesIntro` renders only when no interview exists (the screen-only path, which has no thread and therefore no strip).
- A pending safety event does not suppress the cards — the banner leads, help stays on the page (existing principle); only live ranking is held.

### F4 — Questions demoted to optional re-rankers

- The follow-up turn keeps its position (after the interlude — which now means after the cards), its 2-round cap, and its full answer machinery (re-extract, re-rank, safety screen per answer). What changes is framing: an eyebrow line above the question — new string `followUpOptional` ("Optional — answering sharpens the list." / es).
- Ignoring the question costs nothing and requires no dismissal; the resources are already on screen.
- `orientationComplete` ("Thanks. That is enough to get you started.") renders **only when nothing matched** (`activeDomains` empty or zero matches) — when cards are visible the thanks is noise.

### F5 — Thread de-cluttering

- The opening-text echo bubble (`family-orientation-interview.tsx:315-317`) is **removed**. The strip is the acknowledgment; the raw text already lives, dated, in the journal.
- Answered follow-up Q/A round bubbles (`:318-329`) stay — they are short and they are the conversation.
- "Start over" stays.

## What is removed vs. relocated (reviewer's checklist)

| Surface today | Fate |
| --- | --- |
| Opening text echo bubble | **Removed** (journal keeps raw text) |
| "Here is what we heard" block + `factsIntro` | **Relocated** into strip disclosure; intro line dropped (superseded by the single trust line) |
| `FamilyFactCard`s + confirm + "You wrote" quotes | **Relocated**, byte-identical behavior |
| "Why these areas" rationale | **Relocated** into disclosure |
| Basics prefill-confirm card (`basicsPrefillTitle/Intro/Confirm/Change`) | **Removed** (auto-apply); strings deleted; `basicsPrefillApproxYear` kept (reused for approx display) |
| Sequential basics turns | **Kept**, missing fields only |
| "We found N places below" pointer | **Removed**, replaced by inline cards + `seeAllResources` link |
| "What matters most right now" + heard block in section | **Removed** from section; content **relocated** to strip |
| `resourcesIntro` | Kept for the screen-only (no-interview) path only |
| `orientationComplete` | Kept for the nothing-matched path only |
| Duplicate trust legalese (`factsIntro` + `basicsPrefillIntro`) | Collapsed to one line in the disclosure |

## Functional Requirements

- **FR-1** After a round-0 submission with auto-appliable basics, the thread renders — in order — safety slots (if any), the strip, ≥1 and ≤3 resource cards, then the optional follow-up question. No confirm tap intervenes anywhere on this path. The strip's deterministic sentence renders in the same paint as the cards; the validated live `heard` replaces it in place when ranking lands, and a diagnosis-bearing `heard` falls back exactly as `validateHeard` dictates today.
- **FR-2** The disclosure contains the relocated fact cards (same confirm reducer), the domain rationale, the profile editor, and exactly one trust line; it defaults closed; the "check our guesses" chip appears iff an `inferred` latest-interview fact or an `extracted` profile exists. Confirming a fact in the disclosure and confirming it in the journal are the same action (shared reducer, property-tested once).
- **FR-3** Auto-apply fires only on round 0 with no existing profile and county+birthYear hinted; stage resolution follows F2's rule (stated → hint; else age ≤ 4 → `not_school_age` approximate; else ask). With any required field missing, exactly the missing turns are asked, one at a time, hinted fields never re-asked, and `holdTurn` is true only while such a turn is pending.
- **FR-4** `profileProvenance` round-trips storage with backfill `"stated"`; auto-apply writes `"extracted"`; any manual save writes `"stated"`; the packet's basics marker and the strip chip render iff `extracted`, and both disappear after any manual save. Old saves load unchanged (regression test).
- **FR-5** Inline cards are the head of the same `displayResources` array the section renders (single source of truth — a reorder from ranking, enrollment sinking, or step changes updates both). All card actions (plan step, save, share, enroll toggle) work identically from either location; state is shared, not duplicated.
- **FR-6** The fallback path renders no inline cards and one `fallbackInThread` line; the section's fallback machinery is unchanged.
- **FR-7** The removals table holds exactly: no orphaned strings (deleted keys grep to zero uses), no orphaned anchors, and the rung-pointer targets of `nextFamilyRung` all still resolve to on-page sections.
- **FR-8** Safety order is frozen: banner and clinic-now cards precede the strip; neither is ever inside a disclosure; a pending safety event holds live ranking but not the strip, cards, or section. `npm run crisis:gate` passes unchanged; the regression watch, its corpus, and `screenFamilySafety` are untouched.
- **FR-9** One-ask invariant: with the strip and cards on screen, at most one question is open at any time across missing-basics turn, follow-up turn, follow-up step ask, and check-in (existing precedence untouched — this FR is an assertion test, not new logic).
- **FR-10** All new strings ship en + es simultaneously (informal `tú`, brand "Ladder" untranslated): `heardStrip` template pieces, disclosure summary, trust line, guesses chip, `seeAllResources`, `fallbackInThread`, `followUpOptional`, packet basics marker, extracted-profile note. Deleted keys removed from both languages and the key union.
- **FR-11** A11y: strip container `aria-live="polite"` and focusable (round-0 focus target); disclosure summary is a ≥48px target with visible focus ring; inline-cards region labeled; no keyboard trap introduced by the relocations.
- **FR-12** Gates: `npm run check` green; `crisis:gate` PASS byte-identical; deterministic vignette/navigator tiers unchanged; e2e `family-navigator.spec.ts` updated per the test-impact inventory plus one new journey: *paste one complete description → resources visible with zero confirm taps → optional question below the cards → answer it → list re-ranks with no new recap blocks*. No new `input`/`textarea` outside the existing interview component (spec 13 FR-14's grep-style check extends here).

## Test-impact inventory (expected breakage, to be updated not weakened)

- `src/components/family-orientation-interview.test.tsx` — opening-echo assertions; interlude order.
- `src/app/ladder/page.test.tsx` and `src/components/family-interview.test.tsx` — `factsTitle` placement, prefill-confirm flow, pointer paragraph.
- `src/components/family-contrast.test.tsx` — layout/order assertions.
- `e2e/family-navigator.spec.ts` — every journey that taps "Yes, that is right" on the prefill card must be rewritten to assert the *absence* of that step; companion journeys re-anchored.
- `src/components/family-journal.test.tsx`, `family-wait-header.test.tsx` — expected unaffected; run to confirm (journal/rungs don't target the review block).
- New: strip unit tests (template pieces, omit-unknown, live-upgrade swap, diagnosis-claim fallback), auto-apply reducer/provenance tests, packet-marker test, FR-9 one-ask assertion.

## Demo Script (acceptance walkthrough)

1. Paste *"We live in Scott County and my son just turned three. He isn't talking yet and I'm worried about his speech."* → one paint later: strip reads "Sounds like: Scott County · your child, about 3 · Therapies", three cards below it (First Steps wearing its clock chip), and below them: "Optional — answering sharpens the list" + one question. Zero taps were required.
2. The strip's sentence upgrades in place to the model's heard line (or stands, zero-key demo). No layout jump.
3. Expand "Check or change this": facts with "You wrote…" quotes and confirm buttons, the rationale list, the profile editor showing the extracted values with the check-note. Confirm one fact; the journal shows it confirmed.
4. Missing-field variant: *"My daughter is two and stopped saying words she used to say."* → clinic-now card (regression watch, unchanged) and a single county turn as the only question; answer it → strip + cards appear. No year turn (age hinted), no stage turn (≤4 default).
5. Ask the optional question's answer via voice → list re-ranks; no new recap blocks appear anywhere.
6. Toggle es → strip, disclosure, chip, link, and optional eyebrow all render in Spanish; brand stays "Ladder".
7. Crisis phrase in a note → banner first, unmoved and uncollapsed; strip, cards, and section all still on the page beneath it.

## Success Criteria (demo-grade)

- A first-time phone viewer sees a resource card without scrolling after one submission (baseline today: 3–4 screens of ceremony first).
- The complete-hints path from paste to visible resources involves **zero** taps.
- Nothing from the removed-vs-relocated table is lost — every quote, confirm, badge, and rationale reachable within one tap.
- Gates green: `check`, `crisis:gate` (byte-identical), vignette tiers, updated e2e.
- es parity; one-ask, safety-first, provenance invariants all hold.

## Phasing (scope groups — each demos standalone)

- **P0 — Strip + relocations:** build the strip (deterministic template + live upgrade + disclosure housing the relocated facts/rationale/trust line), remove the opening echo and the section heard block, retarget focus. Pure render reorganization; no state changes; most tests break and are re-anchored here.
- **P1 — Provisional basics:** `profileProvenance` type + storage backfill + reducer arg, auto-apply + stage default, missing-only turns, `holdTurn` narrowing, prefill-card deletion, packet marker, profile editor in the disclosure.
- **P2 — Inline resources + question demotion:** top-3 cards in the interlude, `seeAllResources` link, pointer removal, `resourcesIntro`/`orientationComplete` gating, fallback line, `followUpOptional` eyebrow.
- **P3 — Parity + proof:** es strings, dead-key deletion, a11y pass, new e2e journey, demo-script dry run, FR-9 assertion test.

## Open Questions & Risks

1. **Ages 3–4 defaulting to `not_school_age`** can under-serve preschool Child Find leads when the caregiver never says "preschool" — accepted for v1 (the stated-hint path catches most, Edit is one tap, and under-3 First Steps routing is unaffected). Revisit after the next persona cohort.
2. **Strip text swap jank** (template → live heard): keep both shapes to one sentence, `aria-live="polite"`, no height-animating container. If personas notice it, pin the template and move the live heard into the disclosure instead — a one-line change.
3. **Top-3 duplication** with the full section is deliberate (thread = answer, section = library). If cohort feedback reads it as a bug, the fallback design is the section rendering the remainder — decide then, not now.
4. **Silent wrong-county risk:** auto-apply means a mis-extracted county shapes matches without a confirm tap. Mitigations: the county extractor already requires "X County" or a live-in verb (`family-basics-extract.ts:19-31`), the chip + packet marker flag unconfirmed basics, and Edit is one tap. Watch the persona runs for a single wrong-county case before tightening.
5. **Dead-string deletion** (`basicsPrefillTitle/Intro/Confirm/Change`, `resourcesFoundBelow*`, possibly `factsIntro`/`factsTitle` if fully superseded) — grep for consumers before removing; `factsTitle` may survive as the disclosure's internal heading.
