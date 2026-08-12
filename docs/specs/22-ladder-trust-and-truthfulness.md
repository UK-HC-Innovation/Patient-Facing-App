# Ladder Trust & Truthfulness — A Privacy Promise That Is True, Crisis Copy That Addresses the Right Person, and a Demo That Says What It Is

> An external family-experience review (2026-08-06, full transcript in the review record) walked every Ladder surface in both languages with synthetic crisis wording and returned three release blockers. Two of the three are confirmed in code: **the privacy promise is materially false** ("Nothing here is saved anywhere but this device" while every routine free-text turn POSTs the caregiver's narrative and the full child profile off-device to `/api/family/interview`), and **the crisis pathway speaks adult-directed coach copy to a parent reporting a child in danger** — by explicit design comment, "the family surface never authors its own crisis words." The third (simulation controls inside the family experience) is confirmed but collides with a standing owner decision that the demo apparatus *is* the demo; this spec resolves that with a build flag rather than deletion. A fourth confirmed defect rides along: the eight quick questions say "all of these are optional" above a submit button that is `disabled` until all eight are answered. This spec fixes what the review got right, records what it got wrong, and files its specialist-review demands where they belong — as demo→pilot gates, not code.

**Status:** ✅ **Implemented 2026-08-08** in eight commits `ee953cd..32847ab`; the completion-audit fixes described below are in the current working tree. Not deployed and still a pilot **no-go**. Latest verification: `npm run check` passed (3045 tests passed, 1 skipped), the crisis gate passed 334/334 with a dated report at `docs/ops/red-team-results/2026-08-08-crisis-gate.md`, and all targeted Spec 22 and deterministic Coach browser paths passed. The full Playwright run remained load-flaky: 86 passed and 1 skipped, with 7 mobile startup failures; all 7 passed when rerun in isolation. See [Implementation Notes](#implementation-notes-2026-08-08) for the places the build corrected the spec. Authored 2026-08-06 from the external review and reconciled against `master` (`32847ab`) plus the current working tree. Extends specs 09 (Family Navigator), 11 (crisis inline + keep working), 13 (waitlist companion), 18 (resources-first), 19 (phone fit), 20 (hardening). Amends spec 20's non-goal on demo apparatus (kept, but flag-gated) and spec 09/11's crisis-copy reuse rule (the family surface now authors its own crisis words).

## Problem & Rationale

Every prior Ladder spec carries the same inherited principle: **the app must not claim more than it does.** Spec 20 applied it to receipts, banners, and freshness dates. This spec applies it to the three biggest claims the app makes:

1. **"Your notes stay on this phone" is false at the network layer.** The trust strip says "Nothing here is saved anywhere but this device" and the wait explainer says "Your notes stay on this phone" — yet on every routine free-text submission the client unconditionally POSTs the raw narrative plus the full child profile to the server (`/api/family/interview`, `/api/family/recommend`). The passcode/`unconfigured` gate lives **server-side**: even when the server answers `locked` or `unconfigured`, the family's words have already left the device. A deployment with `HEALTH_AI_PROVIDER=openai` and no `DEMO_PASSCODE` forwards every visitor's narrative to OpenAI. The one thing the code gets right — safety-tripping text is never sent (`family-interview.tsx:366-377`, `family-orientation-interview.tsx` equivalent) — is undercut by the fact that everything else *is* sent, silently, under copy that promises the opposite.
2. **The crisis banner addresses the wrong person.** `family-crisis-banner.tsx:14-15` documents the design: "Same strings the coach uses — the family surface never authors its own crisis words." Those strings are first-person adult crisis copy ("Feeling unsafe right now?", "tell someone you trust what is happening", "put anything you could use to hurt yourself out of reach"). A parent who writes "my son says he wants to die" is told to move *themselves* to a safer space. Beneath the banner, the tripping turn still runs the on-device mock extractor and renders a routine "what we heard" recap, with `domainsAfterSafety` injecting `parent_support` as the fallback need (`family-safety.ts:54-61`) — a child-safety disclosure filed as an ordinary resource category, and crisis-turn facts flowing into the persistent record and the printable clinician packet.
3. **Simulated care actions look operational.** The referral seed, appointment date picker, "Demo: move the visit closer", and check-in time travel live inline in the family surfaces (`family-appointment-card.tsx:392`, `family-experience.tsx:1328,1512`), marked only by a dashed border (`DEMO_BLOCK`, `family-theme.ts:43`) and demo wording. Spec 20 kept them deliberately ("They are the demo"). That is right for the stakeholder demo and wrong for any build a real family touches — and spec 13 already names real-family use as gated. The two postures need to be two builds, not one argument.

Smaller confirmed defects share the pattern: "All of these are optional" above `disabled={!isComplete}` (`family-needs-screen.tsx:109`); a Privacy screen whose "AI data use: not active" derives from the live-voice transport probe (`privacy-disclosure.ts:8`, `aiDataModeForVoiceTransport`) rather than from whether the family flow actually sent text; assessment-flavored interpretation copy ("may need support") that reads as a verdict rather than a quote.

## What the review got wrong (recorded so it is not re-litigated)

- **"Crisis text is sent to AI endpoints" — refuted.** The tripping turn never reaches the network; extraction falls to the on-device path by explicit code (`family-interview.tsx:366-369`). The privacy defect is real for *routine* turns only.
- **"Add a persistent prototype banner above every screen" — conflicts with a standing owner decision.** The "concept demo" banner was deleted on the owner's order (spec 19) and spec 20 shipped that deletion. This spec proposes a one-line service-status disclosure inside the existing trust strip instead (F3b); a full banner is Open Question 1.
- **"Thirty targeted tests passed but don't address safety" — understates the safety suite.** The crisis detector runs 334 cases across 7 suites at recall 1.00 / zero false positives (`scripts/crisis-gate.mjs`), with a 248-case adversarial corpus including caregiver-voice and harm-to-others coverage (specs 09/11/17). The gap the review found is *copy and interaction*, not detection — and that part is confirmed.
- **Specialist reviews (pediatric behavioral health, professional Spanish, legal/privacy) — right ask, wrong bucket.** These are demo→pilot gates, recorded in `docs/ops/demo-to-pilot-release-gates.md` by P6, not feature requirements this spec can satisfy in code.

## Target Users

Unchanged from spec 20: Kentucky caregivers on phones in en/es; the clinician who receives the visit packet; UKHCI stakeholders evaluating the demo. Newly explicit: the distinction between the **stakeholder demo build** (simulation on) and the **family-facing pilot build** (simulation off) is now a first-class product concept.

## Goals & Non-Goals

**Goals**

- G1. No caregiver text or child-profile field leaves the device without an affirmative, informed choice — and the privacy copy describes storage and transmission separately and exactly.
- G2. The AI-data-use disclosure reflects what the *family flow* actually did this session, not what the voice transport probe found.
- G3. A crisis disclosure gets household-neutral, child-aware copy matched to its domain; the tripping turn produces no interpretive recap, no extracted facts in the record or packet, and no `parent_support` need-label; urgent contacts remain reachable after acknowledgement; focus moves to the alert.
- G4. One build flag separates the stakeholder demo (simulation on) from the family posture (simulation off), and the family posture states plainly what Ladder does not do.
- G5. "Optional" means optional: the quick-questions screen submits with any number of answers, including zero.
- G6. Interpretation copy quotes, never assesses: topic language replaces verdict language across the confirmed string batch.
- G7. Intake has honest exits: "I'm not sure" and "I'm outside Kentucky" county routes, the diagnosis list behind a yes/no, month names instead of numerals.
- G8. Everything lands in en and es in the same commit, and the full gate (`npm run check`, `crisis:gate`, e2e) stays green.

**Non-Goals** (each named with its reason)

- Deleting the demo apparatus. Spec 20's decision stands; this spec flag-gates it (F3) instead.
- Accounts / server persistence / real referral or booking flows. Named demo→pilot gates (spec 13); owner decisions.
- Professional Spanish translation, pediatric behavioral-health review of crisis copy, legal/privacy counsel review. Human work; P6 files them as dated pilot gates. The new crisis strings ship as the best available draft and are labeled as awaiting clinical review in the gates doc — not in family-facing copy.
- Global read-aloud, 200%/400% reflow audit, and the base-app accessibility-settings honesty pass. Real, but app-wide rather than Ladder-scoped; recorded in the gates doc as a named follow-on.
- Redesigning first-use as one-task-per-screen and the Programs progressive-disclosure rework. Spec 18/19 territory; a fifth structural rework of the front door needs its own spec with its own measurement, not a rider here.
- On-device *live* model inference. "On-device" in this spec means the existing deterministic mock extractor, which already carries the flow with zero network.

## Ground Truth (verified 2026-08-06 at `fdafa7d` + working tree)

Line numbers drift; re-locate by the quoted code.

**Data path:**

- `src/components/family-interview.tsx:342-420` — `submit()` builds `{rawText, profile, passcode, language}` and, on non-safety turns, calls `requestFamilyInterview` unconditionally (`:379`). No client-side gate of any kind.
- `src/ai/family-interview-provider.ts:29-34` — the provider POSTs the full request body to `/api/family/interview` before any configuration check can run. Same shape for `src/ai/family-recommend-provider.ts:36` → `/api/family/recommend`.
- `src/app/api/family/interview/route.ts:112-121` — `unconfigured` and `locked` are decided **after** the body has arrived server-side. The passcode itself is sourced from the `?k=` query param (`src/app/ladder/page.tsx:16`).
- Safety turns are protected: `family-interview.tsx:366-377` skips the live route and the comment documents it ("The tripping text is never sent anywhere").
- The contradicted copy: `src/i18n/family-strings.ts:999` (`stripTrustLine`, "Nothing here is saved anywhere but this device"), `:1040` ("Your notes stay on this phone"), rendered via the disclosure strip (`family-experience.tsx:1050`) and asserted in tests (`page.test.tsx:209`, `family-contrast.test.tsx:300`).
- The AI-use disclosure derives from the voice transport: `src/domain/privacy-disclosure.ts:8` (`aiDataModeForVoiceTransport`); the family flow already knows its true mode per turn (`extraction: "live" | "mock"` in the `onExtracted` meta, `family-interview.tsx:390,410`) and does not feed it anywhere.

**Crisis pathway:**

- `src/components/family-crisis-banner.tsx:14-22` — copy keys resolve into the coach's adult `tSafety` strings by design; the banner heading is `urgentHelpSummary` ("Feeling unsafe right now? Get help", `src/i18n/strings.ts:289`); `crisisResponse`/`emergencyResponseSuffix` speak to the reader as the person at risk (`strings.ts:279`).
- `src/domain/family-safety.ts:54-61` — `domainsAfterSafety` injects `["parent_support"]` when nothing else is active; the tripping turn still runs `extractFamilyInterviewMock` and calls `onExtracted` (`family-interview.tsx:390-414`), so crisis-turn facts enter the record and are eligible for the packet.
- Acknowledgement collapses the banner (spec 20 F2 made it stand down correctly) but nothing in the Ladder shell offers a way to reopen urgent contacts afterward; the base-app shell deliberately has no persistent crisis affordance (`app-shell.test.tsx:23`).
- No focus management: the banner is `role="alert"` with an `sr-only` heading (`family-crisis-banner.tsx:34-42`); nothing moves keyboard focus or scroll to it.

**Demo apparatus (all inline in family surfaces, `DEMO_BLOCK`-styled, not build-gated):**

- Referral seed: `family-experience.tsx:1509-1514` ("The demo's way onto a waitlist"). Check-in time travel: `:1328-1336`. Visit-closer + earlier-opening simulation: `family-appointment-card.tsx:392-428`. Appointment date picker renders realistic selectable dates once seeded.

**Optionality:**

- `src/components/family-needs-screen.tsx:109` — `disabled={!isComplete}` under copy that says all questions are optional; `family-needs-screen.test.tsx:56-60` locks the gating in.

**What is already good and must not regress:** no-network-on-crisis (both composers); the 334-case crisis gate at recall 1.00 / zero FP; the two-condition regression flag and its bilingual trap corpus; `rejected` fact retraction (spec 20 G4); share consent + audit dedupe; en/es 475-key type-enforced parity; AA/AAA contrast tests; the banner stand-down lifecycle (spec 20 F2b).

## Design Principles

1. **Transmission is a choice, not a default.** The deterministic on-device path is the resting state; the network path exists only behind an informed, affirmative, revocable opt-in.
2. **Say storage and transmission separately.** "Stored in this browser" and "sent to our AI service when you choose the online helper" are two different sentences; never let one imply the other.
3. **Crisis copy is authored for the household.** It must read correctly whether the person at risk is the child, the caregiver, or someone else — and it never shares wording with the adult self-report coach.
4. **A crisis turn is not data.** No recap, no extracted facts, no need-labels, no packet lines from the tripping text. The thread stays alive (spec 11's decision stands); interpretation does not.
5. **Two postures, one codebase.** The simulation is either fully present (stakeholder demo) or fully absent (family build) — never argued about per-control.
6. **Quote, don't assess.** Interpretation copy attributes to the caregiver's words ("You wrote about…"), never to the tool's judgment ("…may need support").
7. **Both languages, always** (spec 20 principle 6 carries forward verbatim).

## Features

### F1 — Truthful data path

- **F1a Client-side gate.** Neither `requestFamilyInterview` nor `requestFamilyRecommendations` is called unless (i) a passcode is present *and* (ii) the caregiver has accepted the online-helper disclosure this session (F1b). Otherwise the flow uses `extractFamilyInterviewMock` and deterministic ranking with **zero network calls** — no POST that a server-side `locked` later excuses. Enforced by a test that mounts the composer with no passcode, submits, and asserts `fetch` was never called (mock at the provider boundary is insufficient; assert at the network layer).
- **F1b Just-in-time consent.** Before the first live-path submission of a session, a disclosure names the path in plain language: what is sent (the words you type and the child details you entered), to what (our AI service), for what (to identify topics and order program options), and the alternative (on-device matching, equally available, chosen by default). Two actions: use the online helper / stay on this device. Declining is sticky for the session; accepting is per-session, not persisted consent. All strings en+es.
- **F1c True copy.** Rewrite `stripTrustLine` and the `:1040` wait-explainer line to describe storage ("Your record is stored in this browser on this device") and transmission ("Nothing is sent unless you choose the online helper") as separate, exact sentences. Update the tests that assert the old strings (`page.test.tsx:209`, `family-contrast.test.tsx:300`) in the same commit.
- **F1d Honest AI-use disclosure.** Drive the family surface's `AiDataDisclosure` from the family flow's own per-turn `extraction` mode (already emitted in `onExtracted` meta), not from `aiDataModeForVoiceTransport`. States: nothing sent yet (default), on-device this session, online helper used this session (with vendor named). The session's live sends append to the existing audit/access-log mechanism so the Privacy screen's claim is generated, not asserted.
- **F1e Recommend parity.** The same gate, consent state, and disclosure cover `/api/family/recommend`; a consented interview turn covers the paired recommend call for that turn, but a mock interview turn never triggers a live recommend call.

### F2 — A crisis pathway that addresses the household

- **F2a Family-authored crisis strings.** New `family-strings` keys per domain — child self-harm/crisis, harm to others, abuse, social emergency, caregiver crisis — written household-neutral and child-aware (baseline register: "Someone may be in immediate danger. If you are worried that your child may hurt themselves or someone else, use the contacts below now."). `family-crisis-banner.tsx` stops importing `tSafety` copy keys; the 988/text/911 `UrgentHelp` action block is unchanged. The strings ship labeled in the pilot-gates doc as awaiting pediatric behavioral-health review (P6) — the label lives in the gates doc, never in family-facing copy.
- **F2b The tripping turn is not interpreted.** On a safety-tripped submission: do not run the mock extractor, do not call `onExtracted`, do not render a "what we heard" recap, and do not inject `parent_support` into visible needs. Previously established domains and resources remain (spec 11: the navigator keeps working); the banner plus a single neutral line ("We're not sorting this message into topics. The contacts above are the next step.") occupy the turn. `domainsAfterSafety` is retired or reduced to preserving `previous` only. Crisis-turn text therefore never reaches the record, the Notes surface, or the packet — extending the existing never-sent guarantee to never-extracted.
- **F2c Urgent help stays reachable.** After the first safety event, the Ladder shell carries a compact persistent "Urgent help" control (all surfaces, both languages) that reopens the standard contacts. The acknowledge button re-labels to "I understand — return to Ladder" and its confirmation notes contacts can be reopened anytime. The banner's stand-down lifecycle (spec 20 F2b) is untouched.
- **F2d Focus and motion.** When the banner mounts, move focus to its heading (make it visible or focus the section) and scroll it into view, instantly under `prefers-reduced-motion`. Unit-test focus placement; keep `role="alert"`.
- **F2e Gate integrity.** `crisis:gate` and the 334-case suite run unchanged; F2 touches response copy and turn handling, never detection. A regression test asserts a caregiver-voice disclosure ("my son says he wants to die") yields: banner with child-aware copy, no recap, no new facts, no network.

### F3 — Two postures, one flag

- **F3a `NEXT_PUBLIC_LADDER_SIM`.** All simulation affordances — referral seed, check-in time travel, visit-closer/earlier-opening controls, and the seeded appointment picker's interactive states — render only when the flag is on. Default **on** (today's demo behavior, zero change for stakeholders); the family/pilot build sets it off. One helper (`ladderSimEnabled()`) so the gate cannot drift per-control; a test renders the family experience with the flag off and asserts no `DEMO_BLOCK` element and no simulation `data-testid` mounts.
- **F3b Service-status line + family-posture notice.** The existing disclosure strip gains one sentence, both postures: "Ladder does not contact any clinic, make referrals, book appointments, or watch these notes — it organizes what you notice and shows Kentucky contacts you can call yourself." With the flag off, appointment surfaces render only family-entered facts and a visible amber notice identifies Ladder as a prototype rather than a connected clinic service. The stakeholder-demo posture keeps the owner's banner-removal decision and remains unchanged.
- **F3c Boundary copy.** Extend the front-door limitation line to the full set: no diagnosis, no screening conclusion, no eligibility decision, no clinical monitoring, no automatic referral — one sentence, en+es.

### F4 — Optional means optional

- **F4a** `family-needs-screen` submits with any number of answers (including zero); unanswered questions contribute nothing to matching. Copy: "Answer any that feel useful. You can skip the rest." Update the locking tests (`family-needs-screen.test.tsx:56-60`).
- **F4b** The optional follow-up question (spec 18's single clarifier) carries an explicit skip affordance ("Skip — show options") wherever it renders, with copy that skipping removes nothing.

### F5 — Quote, don't assess (string batch)

Locate by quoted string; every replacement lands en+es with its asserting tests updated in the same commit:

| Current | Replacement direction |
|---|---|
| "Sounds like: {category}" (therapy-flavored) | Topic attribution: "You mentioned talking and communication." |
| "{Domain} may need support" | "You wrote about {domain-topic}." |
| "make the wait count" (`family-strings.ts:1040` area) | "Steps you can choose while you wait." |
| "one call settles it" (First Steps cutoff card) | "A call can confirm the current rule and your options." Keep call button + school-route alternative in the same card (spec 20 F-batch already added the handoff). |
| "Worth doing now" | "Time-sensitive — this program has an age rule." Rose styling reserved for safety tiers; deadline cards move to neutral/amber. |
| "Changes we're flagging" | "Changes you may want to discuss." |
| Packet default questions "Which therapy should start first?" / "Should the siblings be checked too?" | "What options should we consider, and why?"; sibling question removed from defaults (a clinician raises it). |
| Packet footer "not a medical record" | Append: "A clinician has not reviewed this packet." |

### F6 — Honest intake exits

- **F6a County.** Add "I'm not sure" (→ statewide contacts, county refinable later) and "I'm outside Kentucky" (→ national starting points with an explicit scope statement). No dead ends.
- **F6b Diagnosis list.** Behind "Has a doctor or specialist already given your child a diagnosis?" — list renders only after Yes; No and Prefer-not-to-answer stand equal.
- **F6c Months and dates.** Localized month names replace 1–12 numerals; school stage starts at an explicit "Choose one" rather than a silent default (the sentinel handling at `interview/route.ts:89-90` already treats the default as not-an-answer — make the UI agree).

## Phasing

Each phase is a committable unit; `npm run check` + `crisis:gate` green at every boundary; e2e green at P2, P5.

- **P0 — Truthful data path (F1).** The release blocker. Exit: no-passcode build makes zero network calls from family free text (network-layer test); consent flow works en+es; copy and disclosure true.
- **P1 — Crisis pathway (F2).** Exit: caregiver-voice regression test green (banner, child-aware copy, no recap, no facts, no network); persistent urgent-help control on all surfaces; focus lands on the banner; full gate green.
- **P2 — Postures (F3).** Exit: flag-off build shows no simulation affordance and states the service-status line; flag-on build byte-identical to today's demo behavior.
- **P3 — Optionality + intake (F4, F6).**
- **P4 — String batch (F5).** en+es same commit; contrast and parity tests updated.
- **P5 — Verification pass.** Full e2e including the es journey; rerun the crisis red-team script and write the dated report beside the existing ones in `docs/ops/red-team-results/`.
- **P6 — Gates, not code.** Append to `docs/ops/demo-to-pilot-release-gates.md`: pediatric behavioral-health review of the F2a strings; professional Spanish + bilingual caregiver review; legal/privacy review of minors' data + AI consent; accessibility follow-on (read-aloud scope, reflow audit, settings honesty); program-fact re-verification cadence. Update `docs/specs/README.md` and the memory index.

## Open Questions

1. **Prototype banner — decided 2026-08-08.** Restore a visible notice in the flag-off (family) posture only, while retaining the F3b service-status sentence in both postures. Turning simulation off removes the repeated "demo" labels and therefore creates the greater risk that a family mistakes Ladder for a connected service. The stakeholder-demo posture keeps the owner's spec 19 banner-removal decision and is unchanged.
2. **AI in the family posture.** Keep the online helper behind F1b consent in the pilot build, or strip live AI from that posture entirely (mock-only)? F1 makes both a one-line flag choice; default here is consent-gated.
3. **Session vs. persisted consent.** F1b makes consent per-session by design (no persisted consent record on a shared device). Confirm, or require a revocable persisted setting with its own storage and copy.
4. **`parent_support` semantics.** F2b stops injecting it on crisis turns. Should a *non-crisis* mention of caregiver strain still surface caregiver-support resources? (Recommended: yes — unchanged.)

## Acceptance

- Network-silence test: family free text with no passcode ⇒ zero `fetch` calls (P0).
- Caregiver-voice crisis test: "my son says he wants to die" ⇒ child-aware banner, no recap, no new facts, no network, urgent-help control persists after acknowledge (P1).
- Posture test: `NEXT_PUBLIC_LADDER_SIM` off ⇒ no simulation affordances mount (P2).
- Zero-answer submit on the needs screen returns results (P3).
- Old assessment strings absent from both locales; parity count and placeholder checks green (P4).
- `npm run check`, `crisis:gate` (334/334), and the full e2e suite green; dated red-team report written (P5).
- Pilot-gates doc updated with the five specialist gates (P6).

## Implementation Notes (2026-08-08)

Three places the build corrected the spec, and one thing the tests caught that
neither the review nor the spec had found.

**F2b was too broad, and the vignette gate proved it.** The spec said a
safety-tripped turn should produce no interpretation at all — no extraction, no
domains. Implemented literally, the `missing_child_banner` vignette dropped to
zero resources: retrieval with no domains returns nothing, so a caregiver's
hardest message would have been answered with a blank page, and spec 11's
motivating Breathitt case (school exclusion plus harm to an animal) would have
lost the school-discipline routing it exists to prove. The `parent_support`
floor in `domainsAfterSafety` therefore stays. What actually changed is where
the harm was: a crisis turn now creates no facts, persists no words (so nothing
reaches the Journal, the Notes tab, or the printable packet), runs no regression
scan, and renders no "what we heard" recap. The new `recordFamilySafetyTurn`
action carries routing without carrying the record.

A second-order consequence, fixed in the same phase: profile basics normally
come from stored interview text, which a crisis turn no longer keeps — so a
caregiver naming county, birth year, or school stage inside a disclosure was
asked for it again immediately afterwards, and matching had no county. Those
logistics are now held only in component memory for deterministic resource
matching on the current page. They never enter the reducer, localStorage, notes,
packet, or an online request. The broad safety-routing category remains durable
so the local route and safety-event lifecycle can continue without retaining the
caregiver's words.

**F1b's ordering is the reverse of what the spec implied.** The spec described
consent "before the first live-path submission". The build makes the first turn
always on-device and offers the choice underneath the answer. This is stricter
(nothing can leave before an informed choice, because the first turn never
tries) and it keeps spec 18/19's one-box front door intact — a caregiver in
distress is not made to settle a data question before seeing anything useful.

**The `UrgentHelp` component was itself adult-voiced.** F2a replaced the banner's
copy, but the shared crisis-contacts block rendered its own summary, `"Feeling
unsafe right now? Get help"`, *inside* the new banner. The family-crisis-turn
test caught it. `UrgentHelp` now takes an optional summary; the coach keeps the
old default, and the family surface passes household-neutral wording.

**Corrections to the spec's own ground truth.** The placeholder-parity test the
spec listed as missing already exists (spec 20 F6c added it). The key count is
521, not 475. The e2e recommend stub (spec 20 F1c) does exist and is applied
suite-wide.

**Deliberate scope cuts.** F6 (county escape routes, diagnosis behind a yes/no,
localized month names) is **not implemented** — F4a shipped, F4b/F6a/F6b/F6c did
not. They are honest-intake improvements with no safety or truthfulness blocker
behind them, and they touch the profile form's shape rather than its copy. They
remain open as the next slice.

The simulation flag now masks dedicated referral, appointment, sooner-list,
visit-packet, clinic-target, and check-in effects when it is off. It cannot
soundly undo a stakeholder-demo time-travel action that already rewrote canonical
timestamps or diagnosis months in the same browser: those older mutations have
no provenance from which to reconstruct the original values. Until demo time
travel becomes a non-destructive overlay, stakeholder-demo and family builds
must use distinct origins/storage namespaces. Switching an existing origin from
simulation-on to simulation-off requires an explicit browser-storage reset
before family use.

**Environment note for whoever runs the e2e suite next.** `.env.local` on the
authoring machine carries a live OpenAI key with no `DEMO_PASSCODE`. With it
set, `e2e/dr-screening.spec.ts` and `e2e/home-health.spec.ts` fail because the
live model replaces the deterministic coach answers they assert — unrelated to
this spec, and both pass with the AI env cleared. Because the route's passcode
check is skipped entirely when `DEMO_PASSCODE` is unset, that configuration also
means the F1a client gate is the only thing standing between caregiver text and
OpenAI. Verifying it was the point.

## Adversarial review of the implementation (2026-08-08)

Four attackers went at the committed implementation and 25 adjudications ran
over their claims. Eight survived; those eight were fixed in `65beeef`,
`3456743`, and `545cf31`.
Two were blockers, and the sharpest was the twin of a bug that had already been
fixed on one side and not the other: the crisis-turn record was suppressed but
the crisis-turn *send* was not, so an ordinary reply after a disclosure POSTed
the cumulative transcript — crisis sentence included — to the model. The
guarantee it broke ("the tripping text is never sent anywhere") predates this
spec by four specs. Both gates now screen the whole transcript.

The completion audit then attacked the resulting current tree rather than
stopping at the committed fixes. It closed several second-order failures: a
later negating reply can no longer clear the cumulative crisis latch; acknowledging
a crisis can no longer trigger an online recommendation request derived from
that turn; crisis-derived profile logistics remain session-only and cannot leak
into a later consented thread; Privacy now distinguishes Ladder text attempts,
legacy online records, saved drafts, and Coach voice transport; flag-off masks
persisted simulation state; and the source-backed missing-child, abuse,
medication, food, mixed-risk, Spanish, and negation routes have direct regression
coverage.

Two findings remain product/release work rather than hidden code behavior:

**Dictation is a third data path.** The composer's microphone uses the browser's
`SpeechRecognition`, whose speech service may process audio off-device and sits
outside the F1a passcode/online-helper gate. Ladder now discloses that path next
to the microphone and in the consent/decline copy, and tells a caregiver to type
instead to avoid it. The remaining release decision is whether third-party
browser dictation belongs in the family posture at all; there is still no Ladder
control that disables or withdraws that speech-service path mid-session.

**Consent cannot be withdrawn.** F1b is one-way for the session: a caregiver who
accepts and then regrets it can only close the tab. The copy now says exactly
that instead of implying a control that does not exist, but the honest fix is a
visible off switch.

Two claims were rejected on adjudication and should not be re-filed: the
zero-answer needs-screen submit returning the general set is the specified F4a
behaviour, not a dead end; and `safetyTurnRef` being set without being consumed
is unreachable given where the length guard sits.
