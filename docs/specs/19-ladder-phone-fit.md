# Ladder Phone Fit — Compact Answers, Two-Tap Share, Folded Reference (Demo)

> Spec 18 put the answer first; this spec makes the answer *fit*. The Scott County demo run ("I have a three-year-old in Scott County with difficulty talking") renders **16.5 phone viewports** of output for one submission (measured at 375×812; 4.9 after this spec), for three legible reasons: the top-3 resource cards print **twice in full** (thread and library — the duplication spec 18 marked "deliberate, revisit on feedback"; the feedback arrived); every card carries **~12 always-visible elements**, including two near-duplicate description paragraphs and a four-line share-consent block nobody has tapped yet; and **every reference section mounts fully expanded** — notes, visit packet (the facts' third printing), things-to-try, and the timing plan. This spec fixes all three: the thread's top-3 become compact answer cards that expand in place, the full card obeys a one-description / one-deadline rule with share behind a deliberate tap, and the reference sections fold to one-line summaries that any existing anchor or rung link auto-opens. Presentation only — no extraction, ranking, matching, catalog, state-shape, or crisis-path change.

**Status:** Spec authored 2026-08-04 from direct user feedback on the live Scott County run ("This is a lot of information to output onto a phone"). Extends specs 09 (Family Navigator), 13 (waitlist companion), 15 (structured routing), 18 (resources-first front door). **Amends spec 18 F3 and resolves its Open Question 3**: the thread-vs-library duplication of the top 3 is now decided *against* full duplication — the thread shows the compact answer, the library remains the only home of the full card. Ground truth verified against `master` at `de51809`. **Implemented on `master` 2026-08-04** — see Implementation Notes below.

## Implementation Notes (2026-08-04) — what the build measured and corrected

1. **The page was worse than the spec claimed, and the fix is bigger than it claimed.** "~8 phone screens" was an estimate from reading the output. Measured on a 375×812 viewport, submitting the Scott County paragraph: **16.5 viewports before, 4.9 after** — a 70% cut, not the ~60% the success criteria implied. Both numbers come from the same probe (`scrollHeight / innerHeight`), taken with the working tree stashed and restored, and the after-number is reproduced by the live browser run and by the e2e guard (`expect(screens).toBeLessThan(6)`).
2. **"First card visible without scrolling" was never true and is not claimed.** Measured on the same viewport, the strip lands at y≈830 and the first card at y≈1020 — before *and* after this spec (baseline 839/1029, now 827/1017). What sits above them is real content: the demo badge, the wait header, the check-in demo control, and the interview section with its composer. Making the first card clear an 812px fold means cutting one of those, which this spec's non-goals forbid. The success criterion is restated as what the build actually achieves and what the complaint was actually about: the *page* is short, and the answer sits within the second screen rather than three screens down. Spec 18's own criterion is inherited unchanged, not improved on.
3. **The appointment card's "duplicated" demo sentence is screen-reader-only.** The repeated "This demo pretends your child is on the UK Developmental Pediatrics waitlist" in the pasted page text comes from the card's `sr-only` `aria-live` region (`family-appointment-card.tsx:512-519`), which is invisible on screen and must stay. The real visible duplicate was the `demoBadge`, printed once by the page and once by the appointment card — that one is removed.
4. **Folding by wrapping, not by replacing.** Each folded section keeps its own `<section id data-testid aria-labelledby>` root and moves only its body inside a `<details>`. Making the `<details>` itself the root would have preserved the anchor but dropped the landmark, and `getByRole("region", { name })` is load-bearing in several suites. Anchors, rung targets, and `data-testid`s are all untouched as a result.
5. **The deep-link handler reads the hash on every mount, which leaked between tests.** `useFamilyFoldAnchors` opens whatever `window.location.hash` names at mount — correct for a real deep link, but jsdom keeps the hash from a previous test's anchor click, so the next test mounted with a section already open. Fixed in the tests (`window.history.replaceState` in `beforeEach`), not in the hook: the behavior is right, the fixture was dirty.
6. **`scrollIntoView` is guarded.** jsdom does not implement it, and the anchor's own navigation already scrolls; the explicit call only re-settles the target now that it has its full height.
7. **The journal's fold row counts entries, not "notes".** `foldJournalSummary` first used the wait-header's definition (`kind !== "orientation"`), which reads "0" right after the orientation that just produced three fact cards. It now counts `interviews.length`, which is what the month headings *inside* the journal count — so the closed row and the opened section agree.
8. **Two pre-existing e2e failures are not ours.** `dr-screening.spec.ts` and `home-health.spec.ts` each assert a live coach answer and fail identically with this branch stashed. Verified before and after; untouched.

Final state: `next lint` clean, **2834 unit tests passing** (baseline 2817), `next build` clean, `crisis:gate` PASS with 334 tests across 7 files unchanged (only the two timing lines differ), ladder e2e 31 passed / 1 skipped, full e2e 85 passed with only the two pre-existing coach failures.

## Problem & Rationale

Three causes, each fully legible in two files:

1. **The top 3 cards render twice, in full.** `threadResources = displayResources.slice(0, 3)` (`src/components/family-experience.tsx:939-943`) renders complete `FamilyResourceCard`s in the thread (`:970-992`), and the `#family-resources` section renders the same head of the same array again (`:1345-1347`). The `resourceCard` helper's own comment says it: "One card renderer, two places" (`:749`). On a phone each full card is ~15 lines; the first three cost ~2 screens, twice.

2. **Every card shows everything, always.** `src/components/family-resource-card.tsx` stacks, unconditionally where the data exists: title, urgency chip, the ranked `why` sentence (`:176-180`), the `becauseYouSaid` quote (`:181-188`), **plus** the catalog `resource.summary` (`:189` — unconditional, which is why ranked cards read as two near-duplicate paragraphs), the service-area/match line (`:191-198`), the "Why it helps to start now" `actNow` block (`:200-205`), the First Steps `clockLine` (`:207-214`) — three deadline signals when a card has all of chip, actNow, and clock — the `humanVerify` notice, three action buttons (`:222-261`), the (already collapsed, good) details disclosure (`:266-304`), and the worst offender: an **always-visible share block** (`:306-339`) — consent checkbox, "check the consent box before sharing" hint, Share button, and status line — four lines of trust furniture on every card before anyone has expressed any intent to share.

3. **Every reference section mounts expanded.** The journal (`family-experience.tsx:1413-1422`), the visit packet (`:1424-1438` — the facts' third rendering, after the strip disclosure and the journal), the guides ("Things to try at home", `:1349-1365`, full step lists per `family-guide-card.tsx:36-42`), and the stage timeline (`:1505-1512`) all render in full on every visit. Only the per-card details and the profile form (`:1440-1470`) are collapsed today. Demo furniture compounds it: the `demoBadge` renders twice (`family-experience.tsx:1101-1103` and `family-appointment-card.tsx:505-507`), and demo controls sit in three separate dashed blocks (check-in `:1086-1098`, appointment `family-appointment-card.tsx:345-360`, timeline `family-stage-timeline.tsx:97-108`).

One non-problem, recorded so nobody fixes it: the appointment section's apparent duplicated "This demo pretends…" sentence in the copied page text is the `sr-only` `aria-live` announcement (`family-appointment-card.tsx:512-519`) — it is invisible on screen and stays.

## Target Users

Same as specs 09/13/18: Kentucky caregivers, phone-first, possibly low-literacy, in a stressful season. Spec 18 bought "help appears without scrolling"; this spec buys "and the page ends" — the full journey from submit to visit-packet summary should fit in two to three phone viewports, not eight.

## Goals & Non-Goals

**Goals**

1. After one submission, the thread shows the strip, three **compact** answer cards, and the optional question — in roughly one viewport.
2. The full card carries one description, at most one visible deadline block below the chip, and reveals the share-consent machinery only after a deliberate Share tap.
3. Notes, visit packet, timeline, and (when the thread already holds the answer) the resource library fold to one-line summary rows; every existing anchor, nav chip, and rung link auto-opens the section it targets.
4. One demo badge per page; demo controls keep working where they act.
5. **Zero loss:** every element visible today remains reachable within one tap — relocated or folded, never removed. Safety surfaces never fold.

**Non-Goals**

- No changes to extraction, ranking, matching, `displayResources` assembly, the catalog, or any reducer/state shape. This spec changes what renders when, not what is computed.
- No crisis-pathway change of any kind. `npm run crisis:gate` must pass in the spec-18-discharged sense (same files, same counts, PASS, only timing lines differ).
- No conversion of the wait-header nav to tabs — anchors, rung targets, and the one-scroll-page model stay (accordions, not tabs; tabs would break `RUNG_TARGETS` and re-anchor half the suite for no additional fold win).
- No weakening of consent-before-share: a share still requires an explicit consent tick per card instance; the audit dedupe (`family-experience.tsx:634-643`) is untouched.
- No removal of any card action, source attribution, or verified-date line.

## Ground Truth (verified 2026-08-04 at `de51809`)

| Primitive | State today | This spec's use |
| --- | --- | --- |
| `threadResources` slice + thread region (`family-experience.tsx:939-943,970-992`) | Full `FamilyResourceCard`s ×3 in the thread | Same slice, `variant="compact"`; spec 18 FR-5's single-source rule (`displayResources` head) still holds |
| `resourceCard` helper (`:749-781`) | One renderer, two places, identical props | Gains a variant argument; handlers unchanged |
| Resources section (`:1291-1348`), guides (`:1349-1365`), recreation (`:1366-1401`) | Always expanded | Folds iff thread cards are on screen; open on the screen-only and fallback paths |
| `FamilyResourceCard` summary (`family-resource-card.tsx:189`) | Unconditional | Moves into the details `<dl>` when `why` is present |
| `actNow` block + `clockLine` (`:200-214`) | Both render when both exist | `actNow` folds into details when a `clockLine` is showing; chip + one dated line stay |
| Share block (`:306-339`) | Always visible: checkbox + hint + button + status | Behind a Share tap; per-instance state unchanged (spec 18 impl-note 6) |
| Details disclosure (`:266-304`) | Collapsed; contact/ages/referral/source | Unchanged; absorbs the relocated summary and actNow paragraph |
| Journal (`family-journal.tsx:98`), packet (`family-visit-packet.tsx:103`), timeline (`family-stage-timeline.tsx:82-83`) | `id`s exist; sections always expanded | Wrapped in a shared folded-section shell; `id`s preserved on the fold root |
| Nav chips + rung link (`family-wait-header.tsx:15-23,88-98`) | Anchor `href`s to section ids | Unchanged markup; a hash-open handler opens the target's fold first |
| `seeAllResources` link (`family-experience.tsx:979-991`) | Anchors to `#family-resources` | Same link; now also opens the folded library |
| `demoBadge` ×2, demo blocks ×3 | Scattered | One page-level badge; control blocks keep `data-testid`s and labels |
| `MAX_DISPLAY_RESOURCES = 8` (`family-matching.ts:35`) | Caps the library | Unchanged; fold summaries count what the section renders |

## Design Principles (carried forward, plus one new)

1. **One ask at a time** (spec 13). Folding is not asking; the invariant is untouched.
2. **Safety words first, never folded.** Crisis banner, clinic-now card, check-in, follow-up ask, basics turns, and the strip are never inside any disclosure (extends spec 18 FR-8).
3. **Answer, then verify, then ask** (spec 18). Unchanged order; this spec shrinks each element's height, not its position.
4. **Verified, dated, cited — or absent.** Source names, verified dates, and consent gates survive every relocation.
5. **New: Detail is one tap away, never gone.** Compact and folded surfaces must reach their full form in exactly one interaction, in place, with no navigation and no state loss. Anything this spec hides must be findable by the person who wants it and invisible to the person who doesn't.

## Features

### F1 — Compact answer cards in the thread

`FamilyResourceCard` gains `variant?: "full" | "compact"` (default `"full"`; the library and fallback paths pass nothing and are byte-identical). The thread's three cards render `variant="compact"`.

- **Compact shows exactly:** name; urgency chip (or enrolled chip); **one** sentence — `why` when present, else `resource.summary`; the `clockLine` when present (the dated deadline is the one thing a compact card must not hide); the step-status pill or "I'll do this" button; and an expand control — new strings `resourceMore` ("More about this") / `resourceLess` ("Less"), `aria-expanded`, labeled with the resource name.
- **Expanding renders the full variant in place** (per-card local state, same component, same handlers) — no jump to the library, no scroll. Collapsing returns to compact. Save/share/enroll/details/quote/service-area all live in the expanded form.
- Dropped from compact (present in expanded): `becauseYouSaid` quote, service-area/match line, `actNow` block, `humanVerify`, save + enroll buttons, details, share.
- The `seeAllResources` link below the cards stays and now also opens the folded library (F4).

### F2 — One description, one deadline (full card)

- **One-paragraph rule:** when `why` is present, `resource.summary` moves into the details `<dl>` under a new `resourceAbout` label ("About this program") and does not render in the body. When `why` is absent (deterministic path, fallback, guides section untouched), the summary renders in the body exactly as today — this preserves spec 18's eligibility-caveat lesson: no path loses its only description.
- **One-deadline rule:** below the urgency chip, at most one dated block is visible. When `clockLine` is present, the `actNow` heading + paragraph relocate into details (same `<dl>`); the chip + clock line remain. When there is no `clockLine`, `actNow` renders as today (it is then the only dated warning).

### F3 — Two-tap share

- The consent checkbox, hint line, and status line no longer render up front. The share row shows only the quiet Share button (existing `resourceShare` label).
- First activation reveals the consent row in place — checkbox (existing `resourceShareConsent` label), hint, and a confirm control — focus moves to the checkbox. The actual share fires only with consent checked, through the same `onShare` and the same one-audit-line dedupe. Post-share status line renders as today.
- Per-instance consent state stays per-instance (spec 18 impl-note 6); a card expanded in the thread and its library twin still do not mirror consent, and tests continue to assert cross-copy behavior only through plan/save/enroll.

### F4 — Folded reference sections

A shared folded-section shell (native `<details>`; the section's existing `id` moves to the `<details>` root so every anchor still resolves; summary row = the section's existing heading + a one-line status; `min-h-12` target, visible focus ring; content stays mounted, so no state loss on toggle).

- **`#family-resources`** folds **iff** thread answer cards are on screen (`threadResources.length > 0`). Screen-only and fallback paths keep it open — there the section *is* the answer. Summary: `foldResourcesSummary` ("All {count} places · things to try at home"). Guides and recreation fold with their parent; unchanged inside it.
- **`#family-journal`** folds by default. Summary: `foldJournalSummary` ("{count} notes · latest {month}", singular variant).
- **`#family-visit-packet`** folds by default. Summary: `foldPacketSummary` ("Print or open"). Print/Copy buttons live inside and are one tap away; the print flow therefore always runs with the section open.
- **Stage timeline** folds by default. Summary: `foldTimelineSummary` ("{count} to think about now").
- **Hash-open handler:** one small client effect — on in-page anchor activation, `hashchange`, and initial load with a hash, find the target, open every closed ancestor `<details>` (including the per-card details when a future anchor targets one), then scroll and focus the heading. This covers the nav chips, the rung link, `seeAllResources`, and `backToTop` (which targets no fold and is unaffected).
- **Never folded:** wait header, check-in, crisis banner, clinic-now card, interview section, strip, basics turns, follow-up asks, appointment card (an active surface with reminders, not reference), profile disclosure (already collapsed), saved-resources list (already compact).

### F5 — One demo badge, gathered controls

- One `demoBadge` at the top of the page (above the interview section, which is the first section every path renders); the appointment card's copy (`family-appointment-card.tsx:505-507`) is removed.
- The three demo control blocks stay where they act (they mutate section-local state and e2e drives them) but keep their `data-testid`s and accessible names exactly; the check-in demo block's visual weight drops to match the others (`DEMO_BLOCK`, already shared).
- The `sr-only` appointment announcement is untouched.

## What is removed vs. relocated (reviewer's checklist)

| Surface today | Fate |
| --- | --- |
| Thread top-3 full cards | **Replaced** by compact variant; full form one tap away in place |
| `resource.summary` on ranked cards | **Relocated** into details ("About this program"); body-rendered when no `why` |
| `actNow` block when a `clockLine` shows | **Relocated** into details; visible when it is the only dated warning |
| Share consent checkbox + hint + status (pre-tap) | **Relocated** behind the Share tap; same strings, same consent gate, same audit line |
| `becauseYouSaid` quote, service-area line (compact only) | **Deferred** to the expanded/full form |
| Journal, packet, timeline, (conditionally) library bodies | **Folded**, mounted, one tap to open, anchors auto-open |
| Appointment card `demoBadge` | **Removed** (page-level badge covers it) |
| Everything else on the page | **Unchanged** |

## Functional Requirements

- **FR-1** After a round-0 submission with matches, the thread renders — in order — safety slots (if any), the strip, ≤3 compact cards, `seeAllResources`, then the optional question. A compact card shows exactly the F1 element list and nothing else; its expand control renders the full variant in place with identical handlers, and collapsing preserves any step/save/enroll state changes made while open.
- **FR-2** Spec 18 FR-5 still holds verbatim: thread cards are the head of the same `displayResources` array the library renders; a ranking reorder or enrollment sink moves both. Persisted state (step, saved, enrolled) stays mirrored across copies; per-instance share/consent state stays per-instance.
- **FR-3** One-paragraph rule: with `why` present, the body contains exactly one description and `resource.summary` appears in details; with `why` absent, the body summary renders as today. No path — ranked, deterministic, fallback, guides — ends with zero descriptions.
- **FR-4** One-deadline rule: no card ever shows both the `actNow` block and a `clockLine`; the chip plus one dated line is the visible maximum, and the relocated paragraph is verbatim in details.
- **FR-5** Two-tap share: no consent UI before the Share tap; after it, consent must be explicitly checked before `onShare` fires; the one-audit-line dedupe and post-share status are unchanged. A regression test asserts a share can never fire consent-unchecked through any sequence of taps.
- **FR-6** Folds: library folded iff thread cards are on screen (open on screen-only and fallback paths); journal, packet, timeline folded by default; each summary row is one line, names the content, and carries a true count/date derived from the same state the section renders.
- **FR-7** Every in-app anchor whose target sits inside a folded section opens it before scrolling — nav chips, rung link, `seeAllResources` — including deep-load with a hash. All `RUNG_TARGETS` and `pageNav` hrefs resolve to on-page, openable sections in every state (extends spec 18 FR-7).
- **FR-8** Safety surfaces never fold and never move: banner and clinic-now precede the strip, outside any `<details>`; check-in, follow-up asks, and basics turns are never folded. `npm run crisis:gate` passes in the spec-18-discharged form; the regression watch, corpus, and `screenFamilySafety` are untouched.
- **FR-9** Zero loss: the removed-vs-relocated table holds exactly — every element visible today is reachable within one tap; no orphaned strings (deleted keys grep to zero), no orphaned anchors, no dead `data-testid`s.
- **FR-10** All new strings ship en + es simultaneously (informal `tú`, "Ladder" untranslated): `resourceMore`, `resourceLess`, `resourceAbout`, fold summaries (`foldResourcesSummary`, `foldJournalSummary`(+One), `foldPacketSummary`, `foldTimelineSummary`), and any share-reveal string the build adds. Exact keys finalized at build, per house rule.
- **FR-11** A11y: expand controls and fold summaries are ≥48px targets with visible focus rings and accessible names that include the section/resource name; `aria-expanded` reflects state; heading structure is preserved inside `<summary>`; the share reveal moves focus to the consent checkbox; the hash-open handler moves focus to the opened section's heading; no keyboard trap.
- **FR-12** Gates: `npm run check` green; `crisis:gate` PASS; vignette/navigator tiers unchanged; e2e updated per the inventory plus one new phone journey at 375×812: *paste the Scott County description → strip + first compact card visible without scrolling → expand a card in place → open the library via "See all" → two-tap share with consent → journal and packet closed by default → nav chip opens the packet → print button reachable*. Every existing e2e share journey is re-anchored to the two-tap flow.

## Test-impact inventory (expected breakage, to be updated not weakened)

- `src/components/family-resource-card.test.tsx` — share/consent assertions (checkbox currently expected pre-tap), summary-visibility assertions, new variant + one-paragraph + one-deadline + two-tap tests.
- `src/app/ladder/page.test.tsx`, `src/components/family-interview.test.tsx` — thread-card content assertions (full-card text currently asserted in the thread), fold defaults.
- `src/components/family-contrast.test.tsx` — layout/order assertions re-anchored.
- `src/components/family-journal.test.tsx`, `family-visit-packet.test.tsx`, `family-stage-timeline*.test.tsx` — wrapped in the fold shell; open-then-assert.
- `src/components/family-wait-header.test.tsx` — expected unaffected (markup unchanged); run to confirm.
- `e2e/family-navigator.spec.ts` — share journeys become two-tap; anchor journeys assert auto-open; new FR-12 phone journey.
- New: fold-shell unit tests (default state per path, id preservation, hash-open incl. initial load), compact-variant tests, FR-5 consent-sequence test.

## Demo Script (acceptance walkthrough)

1. Phone viewport, paste *"I have a three-year-old in Scott County. He only strings a couple of words together."* → one screen holds: strip, three compact cards (First Steps wearing its clock line), "See all N places below", and the optional question. No card shows two paragraphs, a consent checkbox, or a "Why it helps to start now" block.
2. Tap "More about this" on First Steps → the card grows in place: quote, service area, buttons, details, Share. Tap "Less" → compact again; a step planned while open survives.
3. Tap Share → consent row appears, focus on the checkbox; tick, share → one audit line, status line shows. Repeat Share elsewhere without ticking → nothing fires.
4. "See all N places below" → the folded library opens and scrolls; guides render inside as today.
5. Journal and visit packet sit as one-line rows. Tap the "Visit packet" nav chip → the packet opens, focused; Print is one tap. Reload with `#family-journal` in the URL → journal arrives open.
6. Demo controls: exactly one "concept demo" badge on the page; "pretend a month passed" and the appointment demo still work by their existing labels.
7. Toggle es → compact cards, fold summaries, and share flow all in Spanish.
8. Crisis phrase in a note → banner first, unfolded, above everything; strip, compact cards, and folded sections all still present beneath it.

## Success Criteria (demo-grade)

*Restated at build time against measurement — see Implementation Note 1 and 2.*

- The Scott County journey renders in **under 6 phone viewports** from submit through the timeline's summary row. Measured at 375×812: **16.5 before, 4.9 after**. Guarded in e2e.
- The first compact card sits **inside the second screen** (y≈1020 of 812×2), not three screens down, and the answer is three short cards rather than three full ones. Spec 18's "sees a resource card after one submission" criterion is inherited unchanged; this spec does not claim to improve on it.
- Zero consent-unchecked shares possible; zero consent controls on screen before a Share tap; zero elements lost per the removed-vs-relocated table.
- Exactly one concept-demo badge on the page.
- Gates green: `check`, `crisis:gate`, vignette tiers, updated e2e including the new phone journey.
- es parity; one-ask, safety-first, single-source-of-cards invariants all hold.

## Phasing (scope groups — each demos standalone)

- **P0 — Compact answers (F1):** the variant, thread wiring, expand-in-place, `seeAllResources` retained. Most visual win; thread-content tests re-anchor here.
- **P1 — Card slimming (F2 + F3):** one-paragraph rule, one-deadline rule, two-tap share + FR-5 sequence test.
- **P2 — Folds (F4):** the fold shell, four sections wired, hash-open handler, journal/packet/timeline test updates.
- **P3 — Polish + proof (F5, parity):** demo-badge consolidation, es strings, a11y pass, new phone e2e journey, demo-script dry run.

## Open Questions & Risks

1. **Browser-chrome printing with sections closed** prints summary rows only (closed `<details>` content does not print, and Chromium's `::details-content` override is not yet dependable cross-browser). Accepted for the demo: the packet's own Print button lives inside the fold, so the supported print path always has it open. Revisit if a persona prints via the browser menu.
2. **Compact cards drop the `becauseYouSaid` quote.** The grounding proof spec 11 fought for is now one tap away rather than immediate. If cohort runs show families not trusting the compact match, the fallback is a single truncated quote line in compact — decide on evidence, not now.
3. **Library folded on the thread path** means a caregiver who ignores "See all" may never see cards 4–8. The counts in `seeAllResources` and `foldResourcesSummary` are the mitigation; watch the persona runs.
4. **Sticky nav chips** (wait-header nav pinned on scroll) were considered and deferred — folding shrinks the page enough that jump-links may no longer earn persistent chrome. Revisit after P2 lands.
5. **`family-contrast.test.tsx` and the e2e share journeys** are the widest re-anchor surface; budget for it in P0/P1 rather than discovering it in P3.
6. **Fold-state persistence** (remembering a caregiver's open/closed choices across visits) is deliberately out: defaults are per-path and predictable, and a persisted preference is new state shape — excluded by the non-goals.
