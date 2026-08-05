# Ladder Hardening — Ship the Redesign, True Safety Copy, a Record That Survives, Facts That Stay Fresh

> A three-agent audit (2026-08-05) of the Ladder found that months of shipped work is invisible — production still serves the pre-spec-18 front door with the deleted demo banner — and that the uncommitted tab redesign broke the one artifact a clinician ever sees (the visit packet prints blank). Behind those: three safety-copy defects (a no-referral family told to call a hardcoded Lexington clinic with no phone number right after reading "possible loss of skills"; a crisis banner that pins above every surface forever because the code contradicts its own comment; no way to retract a false "Possible loss of skills" line from the clinician packet), a family record that dies with the browser and has no working export, no mechanism of any kind that brings a family back for the monthly check-in, a 52-entry catalog whose freshness nothing enforces (30 phone numbers trace to a 12/2025 PDF), and a Spanish experience whose chrome is at 475/475 parity while every card a family acts on is English with the "this is in English" notice rendered on one surface of four. This spec fixes all of it in eight phases and ends with a verified production deploy. It is written to be executed end-to-end by an implementing agent in a fresh session.

**Status:** ✅ **Implemented and deployed 2026-08-05** at `c4dc316` (production `dpl_91tQiN2j5A1KN85gdqdN583aGZmo`, 13 commits, `de51809..c4dc316`). P0–P7 all landed; see [Implementation Notes](#implementation-notes-2026-08-05--what-the-build-measured-and-corrected). Spec authored 2026-08-05 from the full-app audit (three parallel read-only surveys: docs/backlog, UX surfaces, domain/data/safety — key claims re-verified in code by hand). Extends specs 09 (Family Navigator), 13 (waitlist companion), 18 (resources-first), 19 (phone fit). **Delivered the item spec 19 F4a named as "the next spec"** (a `rejected` status on `FamilyFact`), **decided spec 13 Open Question 6** (notification reuse: yes, in-app + `.ics`, honestly labeled), and **closed spec 18 Open Question 7** (suite-wide e2e stub of `/api/family/recommend`). Ground truth was verified against `master` at `76ce8fa` **plus the uncommitted tab-redesign working tree** (see Ground Truth).

## Problem & Rationale

Three distinct failures compound:

1. **The pipeline is stalled.** Last production deploy is `d728a79` (2026-08-03, Wave 3) per `docs/ops/DEPLOYS.jsonl`. Specs 17 (safety hardening), 18 (resources-first front door), 19 (phone fit + banner removal) are on `master` but not live — a family at the URL today gets the free-text-first front door and the "concept demo" banner the owner ordered deleted. The tab redesign (four-surface shell, UK-blue tokens) sits uncommitted on top, and it introduced two regressions that must not ship as-is.
2. **The sharpest copy in the app is wrong exactly when it matters.** The clinic-now card (skill-loss tier), the crisis banner lifecycle, and the un-retractable packet flag are all small code paths with outsized harm: they fire at the scariest moment a caregiver has, and each currently does something the specs never intended.
3. **The app's promises decay silently.** Notes live in one localStorage key with no export that works; nothing ever reminds a family to return; `verifiedAt` is display-only so no build, test, or UI will ever notice a dead phone number or a year-old waitlist count; Spanish families get translated chrome around English content with almost no labeling.

The unifying principle, inherited from every prior Ladder spec: **the app must not claim more than it does.** A print button that prints nothing, a "Checked on" date nothing enforces, a banner that says "until acknowledged" and means "forever" — each is the same defect. This spec makes the claims true.

## Target Users

Unchanged: Kentucky caregivers of children on (or headed for) a developmental-evaluation waitlist, on phones, in en or es; the clinician who receives the visit packet; the UKHCI stakeholders evaluating the demo.

## Goals & Non-Goals

**Goals**

- G1. Production serves current `master` + the redesign, with the two redesign regressions fixed first.
- G2. The clinic-now card never names a clinic the family has no relationship with, and always offers a real, tappable number when one exists in the verified catalog.
- G3. A crisis banner leads until acknowledged, then stands down — and a new disclosure re-raises it. Code, comment, and tests agree.
- G4. A caregiver can say "you misheard me" (`rejected`) as a distinct act from "don't send this" (excluded), and a rejected fact withdraws the packet lines it supported — including the regression flag.
- G5. The packet has two working exits (print, copy) with honest receipts, plus an on-device export; a malformed storage payload no longer silently destroys the record.
- G6. A family has a real way back: `.ics` calendar files for the check-in and visits, a Ladder-identity PWA install, and an in-app reminder while open — each labeled with exactly what it can and cannot do.
- G7. Content freshness is enforced by a failing test, the catalog gets a mechanical re-verification pass with an honest report, and every human-only check lands on a dated owner checklist.
- G8. Spanish readers are told, on every surface where it happens, when content is English; screen readers pronounce it as English; translation parity is enforced by tests; and the crisis detector gets the Spanish adversarial pass the English side already had.
- G9. The batch of verified small UX defects (§F8) is fixed with a test each.

**Non-Goals** (each named with its reason — none are silently dropped)

- Translating the 52-entry catalog and 8 guides into Spanish. It needs native-speaker review (spec 09 FR-17) and it breaks `family-gloss.tsx`'s English-only term detection — that pairing is its own spec.
- Accounts / server persistence / cross-device sync. Named demo→pilot gate (spec 13, `docs/ops/demo-to-pilot-release-gates.md`); owner decision.
- The clinic-facing impact dashboard and a real (caregiver-entered) referral intake. Feature specs, not hardening; named below as the next two specs.
- The Wave 4 12-persona rerun. QA program, recommended immediately after this ships (it doubles as acceptance validation for this spec).
- Dialing phone numbers. Human work; this spec produces the checklist, not the calls.
- Removing the demo apparatus (seeded referral button, check-in time travel, timeline backdater). They are the demo; they already carry demo wording.

## Ground Truth (verified 2026-08-05 at `76ce8fa` + uncommitted working tree)

Line numbers are from the audited tree and may drift a few lines; every claim below was read directly, and the three sharpest were re-verified by hand. Re-locate by the quoted code, not the number.

**Regressions in the uncommitted redesign (ship-blocking):**

- `src/styles/globals.css:57` — `#family-experience > *:not(.family-visit-packet) { display: none !important }`. The redesign made four `LadderPanel` wrappers the direct children (`src/components/family-experience.tsx:1714-1735`; panel root class `grid min-w-0 gap-4` at `src/components/ladder-shell.tsx:263`) and `.family-visit-packet` now sits two levels deeper (`family-visit-packet.tsx:109` → `family-fold-section.tsx:69`). All four panels are hidden in print media; **the packet prints blank**. `family-visit-packet.test.tsx:187-196` only spies `window.print`, so nothing catches it.
- `ladder-shell.tsx:80,137` renders tabs only for unlocked surfaces while `family-experience.tsx:1723-1734` always renders all four `role="tabpanel"` elements with `aria-labelledby="ladder-tab-…"` — on first run, three tabpanels reference IDs that do not exist. `ladder-shell.test.tsx:96` covers only the all-surfaces case.

**Safety copy (verified by hand):**

- `family-experience.tsx:996` — `clinic={family?.referral?.clinic ?? FAMILY_APPOINTMENT_CLINIC}`; the fallback is the hardcoded demo clinic `"UK Developmental Pediatrics"` (`src/domain/family-appointments.ts:10`). `clinicNowBody` says "Call {clinic}." (`src/i18n/family-strings.ts:847`) and the card carries no phone number. The fallback path has zero tests (`family-clinic-now-card.test.tsx:19` always passes `clinic` explicitly).
- `family-experience.tsx:979` — `safetyTurn = latestSafetyEvent ? <FamilyCrisisBanner …>` with `latestSafetyEvent = safetyEvents[safetyEvents.length - 1]` (`:317`). No acknowledged filter — `pendingFamilySafetyEvent` exists one line up (`:316`) and is not used here. `safetyEvents` persist (`src/state/storage.ts:1166`), so one disclosure pins the rose 988/911 banner above the header of every surface on every future visit. The comment at `:977` ("stays until acknowledged") contradicts the code. `page.test.tsx:1198-1202` asserts reducer state only; no test mounts a returning family with a stored acknowledged event.
- `family-strings.ts:809` (`packetFlagRegression`) — "Possible loss of skills, noticed {month}" is permanent in the printable clinician packet; the only caregiver affordance is acknowledging the card. `family-interview.ts:250-251` acknowledges the false-positive risk in a comment. Spec 19 F4a explicitly deferred the fix to "the next spec" — this one.

**Durability / way back:**

- One localStorage key `"home-health-ai-ownership-state"` (`storage.ts:59`); malformed or incoherent payloads are dropped and the app resets to `defaultDemoState` (`storage.ts:1460,1484-1487`) — a schema drift silently erases everything.
- Packet Copy swallows clipboard failure with no receipt (`family-visit-packet.tsx:88-100`, empty `aria-live` at `:131-133`); the share path has an unavailable message (`family-resource-card.tsx:594`) so the inconsistency is local. "Printed" is audited before the dialog opens (`family-visit-packet.tsx:114-117`) — cancel still leaves a receipt, the exact false-receipt class `family-share.ts:1-8` was written to kill.
- No reminder machinery touches Ladder: `checkInDue()` is render-time arithmetic (`src/domain/family-journey.ts:14,78-86`), appointment reminders render only while the Visit tab is open (`family-appointment-card.tsx:118,303-328`), no `.ics` anywhere in the repo, and the only notification code is the dose reminder wired to `/today` (`src/hooks/use-dose-reminder.ts:33-46`).
- PWA identity is wrong for Ladder: `public/manifest.webmanifest` has `start_url: "/today"`, name "Home Health Ownership" / "My Health"; `src/app/layout.tsx:8-13` sets that title app-wide; `public/sw.js` `notificationclick` defaults to `/today`. Installing from `/ladder` yields a "My Health" icon that opens the blood-pressure app.

**Freshness:**

- `src/domain/family-resources.ts` — 52 entries, `VERIFIED_AT = "2026-07-17"` (`:27`), `PROCEDURAL_VERIFIED_AT = "2026-07-21"` (`:30`); 40 unique phone numbers, 30 generated from `POE_DISTRICTS` (`:33-142`) whose source is "Kentucky Early Intervention System POE listing (12/25)" (`:163`). `src/domain/family-guides.ts` — 8 entries, `VERIFIED_AT = "2026-07-25"` (`:30`). `src/domain/sdoh-resources.ts:47-72` — 2 re-exported entries at `"2026-07-04"`.
- No runtime or test compares `verifiedAt` to now; the only assertion is an upper bound (`family-resources.test.ts:34`). Spec 09's own policy (≤30 days on demo day) is currently violated by every entry.
- Volatile facts on card faces: Michelle P. "9,686 people were waiting as of 9/2/2025 … about 3.5 years" (`family-resources.ts:317`, rendered on the face because `actNowInDetails` is First-Steps-only, `family-resource-card.tsx:167,378-384`); "$35 per 30-minute lesson" (`:496`); UK Developmental Pediatrics intake age bands (`:434`); "expanded … on January 1, 2026" (`:369`). "Checked on {date}" renders inside the `<details>` fold (`family-resource-card.tsx:528`) — the claim is on the face, its date is folded.
- A phone number lives in guide **prose** (`family-guides.ts:130`, `800-525-7746`) where `familyResourcePhones` (`src/domain/family-resource-contact.ts:29`) never sees it — untappable, invisible to the face-action test.
- Standing pre-demo human checks, still open (spec 09): SSI/ssa.gov (403s automation), STABLE enrollment page, Sibling Support Project directory; plus 3 procedural entries shipped `humanVerify: true` (spec 11) that only the owner clears. kynect.ky.gov blocks non-browser fetches — a link checker will falsely report it down (spec 09 caveat). CHFS's public waiver dashboard, due Aug 2026, becomes the canonical Michelle P. link when it lands.

**Spanish:**

- `family-strings.ts` — 475 keys, exact en/es parity, type-enforced (`:483`) and counted (`family-strings.test.ts:198`); only 3 legitimately identical values. **No test enforces placeholder parity** — a translation that drops `{weeks}` ships silently.
- All catalog content is English in both languages. `resourceSourceLanguageNotice` (`:692`) renders in exactly one place — the Programs library header (`family-experience.tsx:1503-1507`); the in-thread cards (`:1007,1541`), fallback cards (`:1517`), and guide strip get nothing. `lang={language}` wraps the whole app (`family-experience.tsx:1716`) with no `lang="en"` on English content — Spanish screen-reader voices mangle it.
- `spanishReviewNotice` (draft-translation caveat, `:486`) renders only in the expanded-composer branch (`family-experience.tsx:1245-1249`) — invisible to a returning es reader; the segmented header toggle also lacks the caveat the `buttons` variant carries (`language-toggle.tsx:83-88`).
- The crisis corpus (248 cases, recall 1.00, FP 0, gate green per `docs/ops/red-team-results/2026-08-05-crisis-gate.md`) has had **no Spanish adversarial pass** — `docs/qa/2026-08-04-crisis-adversarial-candidates.md` names it "the obvious next red-team."

**Small UX defects (each verified in code):**

- Back-to-top teleports: `ANCHOR_SURFACES["family-experience"] = "home"` (`ladder-shell.tsx:186`) + the anchor interceptor (`:214-236`) means the Programs library (`family-experience.tsx:1597-1604`) and Journal (`family-journal.tsx:187-194`) "Back to top" links silently switch to the Home tab.
- The language toggle — the one control on every surface including crisis states (`ladder-shell.tsx:122`) — omits `CONTROL_FOCUS` in both variants (`language-toggle.tsx:47-53,70-76`; the token is `src/components/family-theme.ts:9-28`).
- Dead rung: `family-journey.ts:160-165` states the invariant ("a rung only fires when the section that owns it is on the page") but the step section is additionally gated on `!threadActive` (`family-experience.tsx:1077-1085`) which the rung computation never receives (`:1172` passes only `checkinOpen`) — and `threadActive` stays true through `status === "complete"` (`family-orientation-interview.tsx:172`). After any note submission, "See how it went" points at `#family-followup`, which is not rendered. `page.test.tsx:1295` walks this state but never asserts the rung target.
- First Steps card not pinned: the clock rung links `#family-resources` when `early_intervention` is active (`family-journey.ts:198`, `family-wait-header.tsx:20`), but display is the model-ranked top `MAX_DISPLAY_RESOURCES = 8` (`src/domain/family-matching.ts:35`, applied `family-experience.tsx:513-540`); nothing guarantees the First Steps card survives the cut (`isFirstStepsResource` only decorates, `:807`).
- "Not sure" on the skill-loss probe records nothing: `onProbeAnswer` accepts `"no" | "yes"` (`family-checkin.tsx:36`); Not-sure swaps in CDC examples (`:179-187`) and a subsequent Skip stamps a touch that resets the 30-day clock with no signal kept.
- Silent extraction fallback: both composers catch the API error and fall through to the on-device mock with no notice (`family-interview.tsx:385-390`, `family-orientation-interview.tsx:258-264`).
- Share audit deduped globally and forever (`family-experience.tsx:669-678`) — a genuine second share months later is never recorded.
- Programs caps at 8 with no count of what was dropped; Notes unlocks on profile (`family-experience.tsx:1148`) while the journal needs facts (`:1645`), so a profile-only family gets a near-empty tab with a live Print button.
- No `env(safe-area-inset-bottom)` anywhere; the sticky tab bar (`ladder-shell.tsx:135`) overlays the end of the scroll, and the exit link (`:169-176`) sits exactly there.
- Past the First Steps cutoff, `firstStepsClock` returns `null` (`family-clocks.ts:47`) and the family silently loses the clock with no school-route handoff.
- e2e stubs `/api/family/interview` but not `/api/family/recommend` (spec 18 Open Question 7) — on a machine with a live key the gate is non-deterministic.

**What is already good and must not regress:** the crisis detector (334/334 across 7 suites, recall 1.00, zero FP — `scripts/crisis-gate.mjs`), no-network-on-crisis (`family-interview.tsx:377`, `family-orientation-interview.tsx:250`), the two-condition regression flag with its 24-case bilingual trap corpus (`family-interview.ts:1938-1949`, `family-regression.corpus.ts`), the two-shape clock (`family-clocks.ts:24-26`), phone-parsing discipline (`family-resource-contact.test.ts`), AA/AAA contrast tests, tab keyboard nav, and share consent focus handling.

## Design Principles

1. **Claims must be true.** Every receipt fires on the outcome, not the intent; every "until acknowledged" means until acknowledged; every "Checked on" date is enforced by a test that fails when it ages.
2. **Never invent contact details.** A phone number renders only if it exists verbatim in the verified catalog; a clinic is named only if the family's own record names it.
3. **Safety copy stands down, never disappears.** Acknowledgement de-escalates presentation; the help routes and the audit trail remain.
4. **The family's words are append-only.** `rejected` is a status with consequences, not a deletion.
5. **Honest channels.** A reminder feature says exactly when it can fire (app open; calendar app; installed PWA) — no implied server push that doesn't exist.
6. **Both languages, always.** Every new string lands in en and es in the same commit; where content is English, say so where it happens.
7. **Spec 19's presentation discipline carries forward:** keep anchors, `data-testid`s, and landmark roles stable unless the same phase updates the asserting test.

## Features

### F1 — Ship-blocking regression fixes (the redesign becomes committable)

- **F1a Print isolation that survives nesting.** Replace the direct-child selector with visibility-based isolation: in print media, hide the page content subtree (`visibility: hidden` on `#family-experience`), then re-show the packet subtree (`visibility: visible` on `.family-visit-packet` and all its descendants) positioned at the page origin, keeping the existing `__actions`/`__picker` suppression. This is robust to any wrapper depth. Proof is a **real print-media test**: a Playwright spec that renders a family with a packet, calls `page.emulateMedia({ media: "print" })`, and asserts the packet subtree is visible while the tab bar, thread, and other panels are not. jsdom cannot do this; do not fake it there.
- **F1b First-run ARIA.** A `tabpanel` may not reference a nonexistent tab. Either render panels only for unlocked surfaces (matching the tab list) or drop the `tabpanel` role/`aria-labelledby` until the surface's tab exists. Preserve the panels-stay-mounted behavior for unlocked surfaces (draft/scroll survival, `ladder-shell.tsx:250-268`). Unit-test the single-surface first run: no `aria-labelledby` pointing at a missing ID.
- **F1c Deterministic e2e.** Add the suite-wide stub of `/api/family/recommend` (mirror the existing `/api/family/interview` stub) so the gate is deterministic on machines with live keys. (Closes spec 18 OQ7.)
- **F1d Commit the redesign.** With F1a/F1b green, commit the currently uncommitted redesign work path-scoped, as its own commit(s), before the rest of this spec's work begins on top.

### F2 — Safety copy tells the truth

- **F2a The clinic-now card names only real relationships.** Resolution order for the skill-loss (clinic-now) card:
  1. A real referral exists → keep "Call {clinic}" with `family.referral.clinic`. Render a tappable phone **only** if that clinic's number exists verbatim in the catalog; never invent one.
  2. No referral, `early_intervention` active, child under 3 → route to the family's county First Steps office: name the POE district office and render its catalog phone tappable via the existing `familyResourcePhones` pipeline.
  3. Otherwise → "your child's doctor or clinic" wording; no invented name, no number.
  `FAMILY_APPOINTMENT_CLINIC` must never reach this card except through an actual referral record. New strings (`clinicNowBodyReferral` / `clinicNowBodyFirstSteps` / `clinicNowBodyGeneric` or equivalent) in both languages. Tests cover all three branches, including the previously untested fallback, and extend the phone-provenance sweep (`family-resource-contact.test.ts`) to this card.
- **F2b The crisis banner stands down after acknowledgement.** Layer-0 renders `pendingFamilySafetyEvent(safetyEvents)` (already computed at `family-experience.tsx:316`), not `latestSafetyEvent`. Acknowledged → the banner unmounts; the event remains persisted for the audit trail; a **new** disclosure raises a new pending event and the banner returns. Crisis help remains reachable through the standing routes (coach, crisis actions) — nothing is deleted, presentation de-escalates. Fix the comment at `:977` to match. Tests: (a) returning family with only acknowledged events → no layer-0 banner on any surface; (b) acknowledge → banner leaves without reload; (c) fresh disclosure after acknowledgement → banner returns. Keep `page.test.tsx:1198-1202`'s reducer assertions.
- **F2c `rejected` on `FamilyFact` — "you misheard me."** Add `"rejected"` to the fact status union (additive schema change; absent values hydrate unchanged — no destructive backfill). In the journal row's "Why we wrote this" disclosure, add a "This is wrong" control, distinct from the packet checkbox. Consequences of `rejected`: excluded from the packet; excluded from matching/ranking inputs; and if every fact supporting the regression flag is rejected, the packet's "Possible loss of skills" line is withdrawn. The journal keeps the family's words with a visible "marked wrong" chip — append-only survives (FR-3). Both languages; reducer, storage round-trip, packet-withdrawal, and matching-exclusion tests. (Delivers spec 19 F4a's named next step.)

### F3 — A record that survives

- **F3a Honest packet exits.** Copy: success and failure receipts into the existing `aria-live` region (strings in both languages; mirror the share path's unavailable message). Print: move the audit event to `afterprint` (guarded for environments without it; unit tests dispatch the event) so a cancelled dialog leaves no false receipt.
- **F3b On-device export.** A "Save a copy" action on the packet producing a plain-text file (Blob download) of exactly the packet content — included facts only, inclusion/rejection respected — plus, where `navigator.share` exists, sharing that same text behind the existing consent pattern with copy that says plainly: this text includes your child's information and leaves the app. No network, no new endpoint (FR-8).
- **F3c Storage is no longer self-destructive.** Before the malformed-payload reset (`storage.ts:1460,1484-1487`), stash the raw rejected payload in a single-slot recovery key (e.g. `home-health-ai-ownership-state.recovery`) with a `console.warn`. No UI this spec — it converts silent destruction into developer-assisted recovery, and says so in a code comment.

### F4 — A way back (decides spec 13 OQ6)

- **F4a `.ics` files.** On-device generated (Blob, no network): a check-in event (due date = last touch + 30 days, all-day, i18n summary/description) offered in the check-in section, and a per-appointment event with a `VALARM` (T-3 days) on the appointment card. These are the honest reminder channel — they work with the app closed.
- **F4b Ladder PWA identity.** A `ladder.webmanifest` (name/short_name "Ladder", `start_url: "/ladder"`, scope kept broad enough that the `/menu` exit still works, UK-blue theme tokens) linked from the Ladder route's metadata so installing from `/ladder` yields a Ladder icon that opens Ladder. `sw.js` `notificationclick` honors `event.notification.data?.url` instead of hardcoding `/today`. The root app's manifest is untouched.
- **F4c In-app check-in reminder.** Reuse the dose-reminder pattern (`use-dose-reminder.ts`) for check-in-due while the app is open, opt-in, with copy that states the limit plainly: a closed app cannot notify; the calendar file is the reliable channel. No server push exists and none is implied.

### F5 — Facts that stay fresh

- **F5a Freshness is enforced.** A test over all three catalogs asserting `verifiedAt` within `FRESHNESS_BUDGET_DAYS = 45` of now, exempting entries with `humanVerify: true` and entries on an explicit dated allowlist (`STALE_ACCEPTED` with a reason string each). Failure lists offending ids and ages. **This is a deliberate time bomb** — the build starts failing when facts age, which is the requested mechanism (spec 09's own ≤30-day demo policy, relaxed to 45 for CI sanity); the trade is named in the test's comment and in Open Questions.
- **F5b Mechanical re-verification pass.** Fetch every `sourceUrl` across the catalogs; classify ok / moved / blocked / dead. Known traps recorded in spec 09 apply: kynect.ky.gov and ssa.gov block automation, healthychildren.org intermittently bot-blocks — classify these "needs human," never "dead." Bump `verifiedAt` **only** for content-confirmed 200s (FR-6). Write the report to `docs/ops/catalog-verification/2026-08-05.md`.
- **F5c Owner checklist.** The same report ends with the human-only list, dated: all phone numbers (grouped, with the 30 POE numbers flagged as 12/2025-sourced), the 3 `humanVerify` procedural entries, the SSI/STABLE/Sibling-Support trio, and the Michelle P. figures (with the note that the CHFS dashboard due Aug 2026 becomes the canonical link).
- **F5d Dated claims carry their dates on the face.** Any card whose `actNow` renders on the face also renders its "Checked on {date}" line on the face (small, existing string), not only in the fold.
- **F5e The guide phone becomes a contact.** Move `800-525-7746` from guide prose (`family-guides.ts:130`) into a structured contact field so it is tappable and visible to the phone sweep; extend the guide card and its tests accordingly.

### F6 — Spanish integrity

- **F6a The "this is in English" notice renders wherever English content renders:** the in-thread compact card group, the fallback cards, and the guide strip — one notice per group (matching the library's existing placement), es only, existing string.
- **F6b `lang="en"` on English content.** Catalog-derived text nodes (resource name/summary/actNow/source, guide title/body) carry `lang="en"` when the app language is es, so screen readers switch voices.
- **F6c Placeholder parity test.** Extract `{token}` sets per key; assert en and es sets are equal for all 475+ keys. (Currently true, unguarded.)
- **F6d The draft-translation caveat reaches returning readers.** Render `spanishReviewNotice` in the collapsed-composer return state as well (or relocate it adjacent to the language toggle when es is active — implementer's choice, one place always visible on entry), and give the segmented toggle variant the caveat the buttons variant carries (`language-toggle.tsx:83-88`).
- **F6e Spanish adversarial crisis pass.** Mirror the 2026-08-04 English process (`docs/qa/2026-08-04-crisis-adversarial-candidates.md`): generate ≥40 Spanish candidates concentrated where English previously lagged (ideation, collapse, named abuser, currently-missing child) plus the new `acute_medical_emergency` domain; run the detector; adjudicate FP/FN; fold survivors into the corpus; keep the zero-FP assertion and the 0.95 recall floor absolute (FR-5). Record candidates + adjudication in `docs/qa/`, and the gate run in `docs/ops/red-team-results/`.

### F7 — Rung and clock truth

- **F7a No dead rungs.** `nextFamilyRung` receives the same visibility inputs the page uses to render sections (including the `threadActive` gate), so a rung is offered only when its target is on the page — restoring the invariant `family-journey.ts:160-165` states. Extend `page.test.tsx` so the note-just-submitted state asserts the rung's href target exists in the DOM (the case `:1295` walks but never checks).
- **F7b First Steps is pinned when its clock is running.** If `firstStepsClock` is non-null and `early_intervention` is active, the First Steps card is guaranteed a slot within the displayed 8 (pin, then fill by rank). Test: multi-domain family near the cutoff still sees the card the clock rung points at.
- **F7c The clock hands off instead of vanishing.** Past the cutoff (clock newly `null` with child near/over 3), render a one-line handoff: the First Steps window has closed and the school route (Child Find / preschool evaluation) is the path now — linking the existing school-route catalog entry if present, copy-only if not. Both languages.

### F8 — Small-defect batch (one test each)

1. Back-to-top stays on its surface: Programs' and the Journal's links target an in-surface anchor (or the anchor map resolves to the containing surface) — no silent tab switch.
2. `CONTROL_FOCUS` on both language-toggle variants.
3. "Not sure" on the skill-loss probe is recorded: `onProbeAnswer` accepts `"unsure"`; it lands on the check-in record (no flag, no packet line), the CDC-examples behavior stays, the check-in completes normally.
4. Extraction fallback gets a voice: when a composer falls back to the on-device mock, a quiet i18n notice line says so in the thread. Non-blocking.
5. Share audit dedupes per label **per day**, not forever.
6. Programs cap honesty: "Showing 8 of {n}" line when n > 8, both languages.
7. Notes empty state: profile-but-no-facts copy inviting the first note; the packet's Print/Copy stay but the emptiness is named.
8. Safe-area: the sticky tab bar pads with `env(safe-area-inset-bottom)` and `main` reserves bottom space so the last control and the `/menu` exit link clear the bar on iPhone.

## Functional Requirements

- **FR-1** No phone number renders anywhere in Ladder unless its digits appear verbatim in the verified catalog (extends the existing sweep to the clinic-now card and guide contacts).
- **FR-2** Crisis help is never reduced: the banner leads while an event is pending; acknowledgement de-escalates presentation only; a new disclosure re-raises; the no-network-on-crisis paths are untouched.
- **FR-3** The journal remains append-only. `rejected` is a status; no code path added by this spec deletes a family's words.
- **FR-4** Every new user-facing string ships in en and es in the same commit; placeholder parity is test-enforced.
- **FR-5** The crisis gate's zero-false-positive assertion and 0.95 recall floor remain absolute; the corpus only grows.
- **FR-6** `verifiedAt` changes only when a check actually completed; `humanVerify` is cleared only by the owner.
- **FR-7** Every packet exit (print, copy, save, share) emits exactly the packet content — included, non-rejected facts — and share requires an explicit consent tap whose copy names that child information leaves the app.
- **FR-8** No new network calls carry caregiver text; `.ics`, exports, and recovery stash are generated/stored on-device. The only endpoints remain `/api/family/interview` and `/api/family/recommend`.
- **FR-9** Print isolation is proven under print media emulation in a real browser, not inferred from jsdom.
- **FR-10** Existing anchors, `data-testid`s, and landmark roles survive unless the same phase updates the asserting test (spec 19 discipline).

## Test-impact inventory (expected breakage — update, don't weaken)

New print e2e; `ladder-shell.test.tsx` (first-run ARIA); `family-clinic-now-card.test.tsx` + `page.test.tsx` (clinic branches, banner lifecycle, dead-rung anchor, First Steps pin); `family-checkin.test.tsx` (`unsure`); `family-visit-packet.test.tsx` (receipts, afterprint, export); reducer/storage tests (`rejected`, recovery stash); `family-strings.test.ts` (new keys, placeholder parity); `family-resources.test.ts` (freshness budget, upper-bound date constant, guide contact); crisis corpus suites (Spanish additions — counts change, assertions don't); e2e family suites (recommend stub, safe-area/nav if asserted). The two pre-existing coach e2e failures (`dr-screening.spec.ts`, `home-health.spec.ts`) are known, not ours (spec 19 note 8) — verify unchanged, leave untouched.

## Phasing (P0 → P7; each lands green and path-scoped-committed before the next)

| Phase | Scope | Ships |
|---|---|---|
| P0 | F1a–F1d | Redesign committed with print + ARIA fixed, recommend stub in |
| P1 | F2a–F2c | Safety copy true; `rejected` exists |
| P2 | F3a–F3c | Packet exits honest; export; recovery stash |
| P3 | F4a–F4c | `.ics`, Ladder PWA identity, in-app reminder |
| P4 | F5a–F5e | Freshness test, re-verify report, owner checklist |
| P5 | F6a–F6e | Spanish surfaces + adversarial pass |
| P6 | F7, F8 | Rung/clock truth + the small-defect batch |
| P7 | Ship | Full gates, deploy, live verification, ledger |

## P7 — Verification & Ship (the guarded checkpoint)

1. Full gates locally: `npm run check` (lint, unit, build), `npm run crisis:gate` (7 suites; expect 334 + Spanish additions, PASS), full Playwright including the new print spec (expect only the two known coach failures).
2. All work committed path-scoped to `master` with conventional messages (`fix:` / `feat:` / `docs:` per phase).
3. `git push origin master` — plain push, never force; stop and surface if origin moved ahead.
4. Deploy: `vercel --prod --archive=tgz` (there is **no** GitHub auto-deploy; pushing alone ships nothing).
5. Verify live: `/ladder` serves the resources-first front door with the redesign, no "concept demo" banner; `/family?lang=es` 308-redirects preserving query; spot-check `/`, `/screening`, `/today`, `/checkin`, `/support`, `/food`; print preview of the packet shows the packet alone.
6. Append one line to `docs/ops/DEPLOYS.jsonl` matching the existing schema (`at`, `sha`, `target`, `url`, `deploymentId`, `commitsShipped`, `commitRange`, `verified[]`, `gates{}`, `note`).
7. Update this spec's **Status** line to Implemented with date and SHA, and add an Implementation Notes section in the house style (what the build measured and corrected — including anything found that this spec got wrong).

## Implementation Notes (2026-08-05) — what the build measured and corrected

Written in the house style: what was measured, and everything this spec got
wrong.

### Things the spec claimed that turned out to be false

1. **`sw.js` did not hardcode `/today`.** Ground Truth says the service worker's
   `notificationclick` "defaults to `/today`". It reads
   `event.notification.data?.url || "/today"` — `/today` is the *fallback*, and
   the handler already honours whatever a notification names. F4b therefore
   needed no service-worker change at all; the new check-in notification simply
   carries `data: { url: "/ladder" }`. One less file touched than the spec
   budgeted.
2. **`acute_medical_emergency` is a rule id, not a domain.** F6e calls it "the
   new `acute_medical_emergency` domain". It is a rule inside the existing
   `acute_danger` domain (`crisis-red-flags.ts`), added by spec 17. No new domain
   was added and none was needed; the Spanish pass targeted the rule.
3. **"English lags Spanish" is now out of date in one direction and was never
   true in the other.** The 2026-08-04 English report's finding #2 listed four
   areas where Spanish detected disclosures English missed, and spec 17 fixed the
   English side. Running the mirror pass found the *Spanish* side missing the
   same four plus one more: a named abuser had no Spanish path at all (7/7
   missed) and `acute_medical_emergency`'s signal list was English-only (8/8
   missed). Neither language was ahead; each had been hardened where its own pass
   had looked.
4. **The catalog is not 52 entries for freshness purposes, it is 66.** Ground
   Truth counts 52 `family-resources` entries. The freshness budget and the
   verification pass cover all three catalogs — 52 + 8 guides + 6 SDoH = 66
   entries across 44 unique source URLs, because the POE PDF is shared by 16 of
   them and two SDoH entries are re-exported into the family catalog.
5. **F3a cannot deliver the success criterion it states.** "Cancelled print
   leaves no 'Printed' audit event" is not achievable in a browser: `afterprint`
   fires when the dialog is *dismissed*, printed or not, and no engine exposes a
   "paper came out" signal. Moving the audit event off the click and onto
   `afterprint` narrows the false receipt from "the button was tapped" to "the
   print flow ran to completion" — a real improvement, and not the one the spec
   promised. Stated in the code where it lives rather than quietly implemented as
   if it worked.

### Things the spec was right about, and worse than it said

6. **The first-run ARIA defect was four panels, not three.** Ground Truth says
   three tabpanels reference ids that do not exist on first run. Through the
   whole first session `showTabs` is false and the bar is not rendered *at all*,
   so the fourth — Home's own panel — dangled too. The fix has two halves: panels
   exist only for surfaces that have a tab, and a panel is only a `tabpanel`
   while the bar is on the page. Verified on live production: zero tabpanels and
   zero dangling `aria-labelledby` on a fresh load.
7. **The clinic-now card's fallback was worse than "names the wrong clinic".**
   It named the demo clinic *and* carried no number, so the instruction was "call
   a place you have never heard of", with no way to call it. The First Steps
   branch now carries a real, tappable, catalog-verbatim number — which makes the
   29 POE phone numbers, all traced to a single 12/2025 PDF, load-bearing for the
   first time. They are §1 of the owner checklist for that reason.
8. **Three back-to-top links, not two.** F8.1 names Programs and the Journal. The
   stage timeline had the same `#family-experience` href and the same silent
   tab-switch; the test that enforces the invariant found it.

### Measurements

- **Catalog re-verification (F5b).** 66 entries, 44 unique URLs, all reachable:
  **0 dead, 0 moved**, 2 blocked to scripts (`ssi_children` on ssa.gov,
  `dsack` — both browser-loadable), 39 content-confirmed and bumped to
  2026-08-05, 20 reachable but not machine-confirmable (PDFs and JS-rendered
  pages) whose dates did **not** move. The freshness test passes because the
  catalog was re-verified, not because the budget was widened — which is the
  success criterion, and it was checked by running the test against the old
  dates first.
- **Spanish adversarial pass (F6e).** 55 candidates against the real detector:
  43 disclosures, 12 traps. **37 disclosures broke it; 0 traps did.** 34 fixed
  and folded in with all 12 traps; corpus 248 → 294; gate PASS, recall 1.00,
  false positives 0. Three caregiver-collapse candidates are deliberately not
  fixed and are named with reasons in
  `docs/qa/2026-08-05-spanish-crisis-adversarial.md` — firing on them needs a
  collapse-only path, which turns "ya no puedo más con el papeleo de la lista de
  espera" into a crisis interstitial.
- **The corpus paid for itself inside the hour.** The first version of the new
  escape-from-a-named-place rule had no subject constraint and fired on
  `trap_es_missing_dog`, a trap a *previous* pass had added for exactly that
  mistake. The gate caught it before the commit.
- **Print isolation (F1a, FR-9).** The new Playwright spec was run against the
  old CSS rule first and fails on it (`boundingBox()` null — the packet is inside
  a `display: none` panel), then passes against the new one. The full rule set is
  confirmed present in the live production CSSOM.
- **Gates at ship.** lint clean; 2994 unit tests passing, 1 skipped; build clean;
  crisis gate PASS; Playwright 87 passed / 1 skipped across both projects, with
  only the two known coach specs failing (`dr-screening`, `home-health` — spec 19
  note 8, verified unchanged and untouched).

### Design decisions the spec left open

9. **`rejected` is one-way in the UI.** The spec asks for "a 'This is wrong'
   control, distinct from the packet checkbox" and a "marked wrong" chip. The
   packet checkbox stays the reversible curation control; rejection is a
   correction of the record, taken on one tap, with the family's words and quote
   still on the page. Un-rejecting would have to restore a prior status the fact
   no longer carries, and guessing that status is the kind of invention this spec
   exists to remove.
10. **Facts were never a matching input.** F2c says a rejected fact is "excluded
    from matching/ranking inputs". Retrieval is profile + active domains +
    already-enrolled + the raw interview text; facts do not reach it. The
    exclusion is applied everywhere facts *are* consumed downstream — the packet,
    the regression flag's packet line, and the packet-notes count on the front
    door — and `activeFamilyFacts` exists so the next consumer inherits it.
11. **The step rung stands down rather than re-targeting.** F7a says the rung
    computation should receive the same visibility inputs the page uses. With
    `threadActive` true the step section is not rendered, so the honest rung is
    no rung — the header goes quiet and the thread owns the ask, which is the
    one-ask-at-a-time rule the page already follows.
12. **`STALE_ACCEPTED` entries expire.** The spec asks for "an explicit dated
    allowlist with a reason string each". Each entry carries a review-by date and
    the test fails when that date passes, so the allowlist cannot quietly become
    the permanent answer to a decaying catalog. Both current entries are dated
    2026-10-01.

### Still open after this ship

- The **owner checklist** in `docs/ops/catalog-verification/2026-08-05.md` is
  human work this spec deliberately did not do: 41 phone numbers (29 of them from
  one 12/2025 PDF and now load-bearing for the clinic-now card), three
  `humanVerify` procedural entries, the SSI/STABLE/Sibling-Support trio plus
  `dsack`, and the two volatile Michelle P. figures.
- **`.ics` files have not been opened in a real calendar app**, and the PWA
  install has not been done on a real phone. Both are on the standing spec 12
  hardware pass. The files are byte-verified against RFC 5545 shape by unit test
  (CRLF, folding at 75 octets, TEXT escaping, `VALARM` trigger) and the manifest
  is confirmed served with the right `start_url`, but a calendar app's parser is
  not a test suite.
- **The freshness test is now armed.** The two SDoH entries dated 2026-07-04 age
  out around 2026-08-18 and the POE block around 2026-08-31. That is the
  mechanism working, not a defect — but it is the first thing that will break
  `npm run check` with no code change, and it is worth knowing before it does.
- The **Wave 4 12-persona rerun** remains the recommended next QA program, and it
  doubles as acceptance validation for everything above.

## Success Criteria

- Live production serves current `master` including the redesign; the packet prints (print-media e2e green, and step 5's manual print preview confirms).
- First-run DOM has zero ARIA references to nonexistent IDs.
- The no-referral clinic-now card never names the demo clinic and offers a tappable catalog number on the First Steps branch (tests for all three branches).
- A returning family with only acknowledged safety events sees no layer-0 banner; a fresh disclosure brings it back (tests).
- A rejected fact leaves the packet, leaves matching, and can withdraw the regression flag line; the family's words remain visible (tests).
- Packet copy failure produces a visible receipt; cancelled print leaves no "Printed" audit event; "Save a copy" downloads the packet text.
- Check-in and appointment `.ics` files download and open in a calendar app (manual check, noted in Implementation Notes); installing from `/ladder` yields a Ladder-named icon opening `/ladder`.
- The freshness test exists, and passes at ship because F5b actually re-verified (not because the budget was widened); the verification report + owner checklist exist in `docs/ops/catalog-verification/`.
- es: notice on all four content surfaces, `lang="en"` markup, placeholder-parity test green, caveat visible on return; crisis corpus grew by the adjudicated Spanish cases with the gate green (recall 1.00, FP 0).
- Every F8 item has a test; the DEPLOYS.jsonl line is appended; this spec's status header says Implemented.

## Execution Notes (for the implementing agent)

- Work directly on `master` in `C:\Patient centered`. No worktrees, no branches (owner convention). Path-scoped commits: `git commit -- <paths>`.
- Line numbers in Ground Truth are from the audited tree — re-locate by quoted code before editing; the redesign files are currently **uncommitted**, so diff context matters until P0 lands.
- Running Playwright collides with a running dev preview server (it clobbers `.next` — Internal Server Error / routes-manifest ENOENT afterward). Stop the preview before e2e; restarting it afterward fixes it; it is not a code bug.
- The deploy remote situation: origin is `github.com/Tamathe/Patient-Facing-App`; never push to any RHTP remote. Deploys happen only via `vercel --prod --archive=tgz`.
- Honesty discipline for the writeup: record what was measured, including anything this spec claimed that turned out wrong — see spec 19's Implementation Notes for the expected tone.

## Open Questions & Risks

1. **The freshness test is a time bomb by design.** In ~45 days, `npm run check` fails until someone re-verifies or allowlists. That is the requested behavior (nothing else will ever notice decay), but it means CI redness with no code change. Named trade; owner can retune `FRESHNESS_BUDGET_DAYS` or the allowlist.
2. **PWA scope interplay.** Two manifests on one origin: a user who installs from `/` and one who installs from `/ladder` get different identities. Keep the Ladder manifest's scope broad enough for `/menu`; verify install flows on a real phone (the standing "real-phone hardware pass" from spec 12 remains open and would cover this).
3. **`afterprint` support.** Broadly supported; guard for absence (fall back to current behavior) so no environment loses the audit event entirely.
4. **Reminders remain honest but weak.** Without a server there is no true push. `.ics` is the reliable channel; the spec's copy must never imply more. Accounts/backend remain the pilot gate.
5. **Packet share is child data leaving the device.** The consent copy (F3b) is load-bearing; reuse the existing consent-pattern language, extended to name the packet's contents explicitly.
6. **Spanish catalog translation is deferred**, and F6a makes its absence more visible (more "this is in English" notices). That is honest, and it is also pressure — the follow-up spec should pair translation with `family-gloss` bilingual term detection.
7. **Follow-on specs, in recommended order:** (21) clinic-facing impact dashboard — the event substrate in `family-journey.ts` was built for it and it is the artifact that sells UKHCI; (22) caregiver-entered referral intake to replace the demo seed button as the Visit surface's real front door; then the Wave 4 12-persona rerun as acceptance validation of everything above.
