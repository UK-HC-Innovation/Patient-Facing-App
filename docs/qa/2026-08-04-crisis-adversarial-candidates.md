# Crisis gate — adversarial candidate report (spec 17 workstream A)

**Date:** 2026-08-04
**Status:** ✅ adjudicated and implemented 2026-08-04. The owner accepted every recommendation in this
report. See [Adjudication outcome](#adjudication-outcome) at the end for what landed.
**Baseline:** `npm run crisis:gate` PASS before generation (`docs/ops/red-team-results/2026-08-04-crisis-gate.md`)
**Corpus at time of run:** 211 cases (131 positives, 80 traps)

## Method

White-box: `src/domain/crisis-red-flags.ts` was read first, candidates were written against the
observed rule boundaries, then **every candidate was executed through the real
`screenCrisisRedFlags`** before being listed here. Only genuine breaks appear below —
39 candidates proposed, 39 broke, 0 held.

The 100% break rate is a property of the method, not a measure of detector quality: candidates
were authored *from* the regexes, so they target known edges by construction. The useful signal is
not the rate but the three structural patterns below, which a black-box pass would have found more
slowly and less completely.

## Headline findings

### 1. The zero-false-positive assertion is manufacturing false negatives

`crisis-red-flags.test.ts` asserts `falsePositives = []` on every run. That is a hard constraint on
rule width, and the English rules have been tuned down to satisfy it — `CAREGIVER_COLLAPSE` requires
the literal phrase "can't do this anymore" **and** a giving-up phrase within 64 characters;
`MISSING_CHILD` requires an elopement verb before "can't find". Both clear the trap corpus. Both miss
ordinary phrasings of the real event.

The two error classes are not symmetric in cost. A false positive shows a caregiver an unnecessary
crisis interstitial. A false negative misses a disclosure. Holding both to zero, with FPs enforced by
CI and FNs bounded only by the imagination of the corpus author, systematically trades the expensive
error for the cheap one. **Recommend the owner decide whether the trap assertion should stay absolute
or become a budget** (e.g. FP rate ≤ N% on a much larger benign corpus) before accepting the FN fixes
below, because several of those fixes will widen rules and cannot coexist with a literal zero.

### 2. English lags Spanish across four domains

The Spanish rules were built adversarially (clause splitting, explicit denial lists, idiom traps).
The English rules were built corpus-first. Result: **Spanish detects disclosures that English misses**,
in the same app, for the same event.

| Disclosure | Spanish | English |
|---|---|---|
| "doesn't want to live anymore" | ✅ `no quiere vivir` | ❌ no rule |
| caregiver collapse, general phrasing | ✅ 6 collapse + 5 giving-up variants | ❌ one literal phrase pair |
| coach / teacher / caregiver as named abuser | ✅ 4 dedicated patterns | ❌ needs "someone"/"somebody" |
| child currently missing, no elopement verb | ✅ `SPANISH_CURRENTLY_MISSING` | ❌ requires ran away/wandered off |

This is the highest-value cluster in the report: it is a defect in the *English* path of a
majority-English app, and the fix is largely transliteration of rules that already exist and already
pass their traps.

### 3. `vision_loss` and `vision_eye_pain` are too broad for this app's own vocabulary

`/cannot\s+see|can't\s+see/` and bare `/eye\s+pain/` fire on the most ordinary sentences a
low-vision diabetes patient types: "I can't see the numbers on my meter", "I can't see where to tap",
"no eye pain today". These are not exotic traps — they are the app's core domain vocabulary. This is
the same failure class as the 2026-07-25 waitlist-companion bug (a watch firing on the benign case)
and it is currently live.

## Candidates

Recommendation legend: **FIX** = clear defect, low-risk change. **FIX-CARE** = clear defect, but the
obvious fix widens or narrows a rule enough to need a trap added in the same commit.
**ADJUDICATE** = genuinely debatable whether this belongs in the crisis tier at all.

### A. False positives — benign text that currently fires

| # | Text | Fires | Rec |
|---|---|---|---|
| 1 | "I can't see the numbers on my glucose meter" | `vision_loss` | FIX-CARE |
| 2 | "I can't see the label on the pill bottle without my glasses" | `vision_loss` | FIX-CARE |
| 3 | "I can't see where to tap to log my reading" | `vision_loss` | FIX-CARE |
| 4 | "I cannot see my appointment time anywhere in the app" | `vision_loss` | FIX-CARE |
| 5 | "No eye pain today, the drops are working" | `vision_eye_pain` | FIX |
| 6 | "Mild eye pain from my allergies this week" | `vision_eye_pain` | ADJUDICATE |
| 7 | "The eye pain I had last month is completely gone" | `vision_eye_pain` | FIX |
| 8 | "There is a flashing light on my glucose meter, what does it mean?" | `vision_flashes_light` | FIX |
| 9 | "Everything went dark when the power went out during the storm" | `vision_went_dark` | FIX |
| 10 | "I am scared of going blind someday, is that likely with diabetes?" | `vision_going_blind` | FIX-CARE |
| 11 | "I want to die of embarrassment, I called the nurse by the wrong name" | `self_harm_want_to_die` | FIX |
| 12 | "I don't want to hurt myself doing the new exercises, how do I start slow?" | `self_harm_suicide` | FIX-CARE |
| 13 | "I might hurt myself lifting the wheelchair into the trunk" | `self_harm_suicide` | FIX-CARE |
| 14 | "I don't want to be here at the clinic all afternoon, can I reschedule?" | `self_harm_dont_want_to_be_here` | ADJUDICATE |
| 15 | "This paperwork is endless, I want to end it all and just start over" | `self_harm_want_to_die` | ADJUDICATE |

Notes on the ADJUDICATE rows: #6 and #14 and #15 are cases where suppressing the false positive
plausibly costs a true positive. "I don't want to be here" in a health app is a real ideation
phrasing; the DMV/clinic reading is not obviously dominant. Recommend **leaving 14 and 15 firing**
and recording them as accepted-FP rather than fixing them — but that requires finding #1 above to be
resolved first, because the current assertion has no way to express "accepted FP".

Rows 1–4 share one root cause and should be fixed as one change: require an acuity or body-part
marker on the bare `cannot see` branch (the existing `vision_sudden_loss` and
`vision_losing_sight` rules already carry real acute phrasings, so narrowing `vision_loss` does not
lose coverage — verify against the 9 existing vision positives in the same commit).

### B. False negatives — real disclosures that do not fire

| # | Text | Domain | Rec |
|---|---|---|---|
| 16 | "I don't see the point in living anymore" | self_harm | FIX |
| 17 | "Everyone would be better off without me" | self_harm | FIX |
| 18 | "I wish I was dead" | self_harm | FIX |
| 19 | "I don't want to live anymore" | self_harm | FIX |
| 20 | "I have been thinking about ending things" | self_harm | FIX-CARE |
| 21 | "My son told me he wishes he was dead" | self_harm | FIX |
| 22 | "My daughter says she doesn't want to live anymore" | self_harm | FIX |
| 23 | "My son keeps talking about wanting to be dead" | self_harm | FIX-CARE |
| 24 | "I have nothing left, I want to give up" | caregiver_collapse | FIX-CARE |
| 25 | "I can't keep going like this, I want to give up on everything" | caregiver_collapse | FIX |
| 26 | "I can't take it anymore and I want to give up" | caregiver_collapse | FIX |
| 27 | "My daughter's coach hit her at practice" | abuse | FIX |
| 28 | "My son told me his teacher touched him inappropriately" | abuse | FIX |
| 29 | "My kid's stepdad hits him when I'm at work" | abuse | FIX |
| 30 | "My daughter has been missing since last night" | acute_danger | FIX |
| 31 | "I don't know where my son is and he has been gone since this morning" | acute_danger | FIX-CARE |
| 32 | "My husband is unresponsive and his sugar is 32" | acute_danger | FIX |
| 33 | "I can't wake my mother up and her blood sugar was 28" | acute_danger | FIX |
| 34 | "She is having a seizure right now" | acute_danger | FIX |
| 35 | "Her throat is closing up after the new insulin" | acute_danger | FIX |
| 36 | "I have crushing chest pain radiating down my left arm" | acute_danger | FIX |
| 37 | "He passed out and I can't get him to respond" | acute_danger | FIX-CARE |
| 38 | "He said he'd stab his brother" | harm_to_others | FIX |
| 39 | "He hit the baby in the face" | harm_to_others | ADJUDICATE |

Notes:

- **32–36 are the most serious rows in this report.** Severe hypoglycemia, seizure, and anaphylaxis
  have **no rule at any severity** in a diabetes-first app whose emergency tier exists precisely for
  this. #36 (chest pain without the word "breathe") is a myocardial-infarction presentation the
  existing `acute_chest_breathing` rule was clearly meant to cover and does not.
- **24 is FIX-CARE, not FIX**: "I want to give up" alone is high-frequency benign
  ("I want to give up on the low-carb thing"). The Spanish rule handles this by requiring collapse
  *and* giving-up in separate clauses; the English fix should mirror that structure, not drop the
  conjunction.
- **20 and 23 are FIX-CARE**: "ending things" and "wanting to be dead" are broad enough to need
  paired traps ("ending things on a good note", a bereavement discussion) in the same commit.
- **31 and 37 are FIX-CARE**: "I don't know where he is" and "passed out" both have common benign
  readings (a teen out with friends; fainting from standing up). Both need a persistence or
  unresponsiveness qualifier.
- **39 is ADJUDICATE**: adding `hit` to `HARM_VERB` would fire on "he hit the ball", "she hit her
  head". If the owner wants sibling violence covered, it needs a narrow object list, not a verb
  addition.

## Suggested adjudication order

1. Decide finding #1 (zero-FP assertion → absolute or budget). Everything in section A depends on it.
2. Rows 32–36 (acute medical gaps) — highest clinical severity, no FP risk, no dependency on #1.
3. Rows 27–29 and 30 (abuse and missing-child English parity) — port the existing Spanish rules.
4. Rows 16–22, 25–26 (self-harm and collapse English parity) — same porting exercise.
5. Section A rows 5, 7–9, 11 — unambiguous FP fixes.
6. Everything marked FIX-CARE or ADJUDICATE, individually.

## Adjudication outcome

Owner adjudicated 2026-08-04: **accept all recommendations.** What landed:

**Finding 1 (the zero-FP assertion).** Kept absolute. The two candidates whose ideation reading is
not clearly dominated — #14 "I don't want to be here at the clinic all afternoon" and #15 "this
paperwork is endless, I want to end it all" — were **not** added to the corpus in either direction.
They still fire, and that is now the recorded accepted behavior rather than an asserted trap. This
keeps `falsePositives = []` meaningful without forcing a call on two genuinely ambiguous strings.

**37 of 39 candidates became corpus cases** (13 traps, 24 positives). Corpus went 211 → 248;
positives 131 → 155; traps 80 → 93. `npm run crisis:gate` PASS — recall still 1.00, false positives
still 0.

Detector changes, all in `src/domain/crisis-red-flags.ts`:

| Area | Change |
|---|---|
| `vision_loss` | Bare `cannot see` now needs a vision-shaped object (`anything`, `at all`, `out of`, `clearly`) or a clause end. "I can't see the numbers on my meter" no longer escalates; "I can't see" and "can't see out of one eye" still do. |
| `vision_eye_pain` | Became a clause-scanning match with a downgrade window (`no`/`mild`/`slight`) and a resolution check (`gone`, `cleared up`). |
| `vision_flashes_light` | Suppressed when the flash is attributed to a device (`on my meter/pump/sensor`). |
| `vision_went_dark` | Suppressed on external causes (power outage, storm, bulb). |
| `vision_going_blind` | Suppressed on fear/hypothetical framing (`scared of`, `someday`, `will I`). |
| `self_harm_want_to_die` | English idiom exclusion for `die of embarrassment/shame/laughter/boredom`, mirroring the Spanish trap that already existed. |
| `self_harm_suicide` | `hurt myself` suppressed inside a physical-activity clause (lifting, exercising, the gym). The `kill myself` / `suicide` / `end my life` core is untouched. |
| **new** `self_harm_english_direct_ideation` | `don't want to live`, `no point in living`, `wish I was dead`, `better off without me`, `thinking about ending things`. Split into inherently-negative phrases (where "don't" *is* the signal) and deniable ones. |
| **new** `self_harm_english_reported_ideation` | Third-party equivalents — `he wishes he was dead`, `she doesn't want to live`, `talking about wanting to be dead`. |
| **new** `caregiver_collapse_english_broadened` | Collapse half accepts `can't keep going`, `can't take it anymore`, `nothing left`, `breaking point`. Still requires a separate giving-up clause, and still excludes ordinary-task framing. |
| **new** `abuse_english_named_perpetrator` | Coach / teacher / caregiver / stepdad etc. as the actor, plus `touched … inappropriately`. Ports the Spanish rules. |
| **new** `acute_english_currently_missing_child` | Currently-missing with no elopement verb, with returned-child and media-context suppressors. |
| **new** `acute_medical_emergency` | Severe hypoglycemia (`unresponsive`, `can't wake … up`), seizure, anaphylaxis (`throat is closing`), chest pain radiating to arm/jaw, and `passed out` qualified by unresponsiveness. |
| `HARM_TO_OTHERS_SIGNALS` | Added `said he'd stab/kill/hurt …`, and infant-directed `hit` only. `hit` was deliberately **not** added to `HARM_VERB` — it fires on "hit the ball" and "hit her head". |

Verified beyond the corpus: a 20-case edge check confirmed the accepted-FP pair still fires, bare
"I can't see" still fires, "he never hit the baby" and "I would never wish I was dead" stay clear,
collapse-alone and giving-up-alone each stay clear, and "hit the ball" / "hit her head" stay clear.

### Performance — the detector is now half its original cost

The first implementation added seven clause-scanning match functions, each independently re-splitting
the input. `screenCrisisRedFlags` went **0.318 → 0.689 ms/call**, and that showed up immediately: the
component suite began failing intermittently under full parallelism (11, then 9, then 5 failures
across three runs, never the same set, all passing in isolation). This function runs on **every
keystroke of every composer in the app**, so the regression mattered well beyond the tests.

Each expensive function now opens with a cheap pre-filter — a single regex that is a strict superset
of that function's own signal set, so it can change cost but not behavior — and
`isEnglishCaregiverCollapse` tests its rarer half first and skips the clause split when it misses.

| | ms/call | Full suite |
|---|---|---|
| Before this report's changes | 0.318 | — |
| After the rules, before pre-filters | 0.689 | 185s, 5–11 flaky failures |
| **After pre-filters** | **0.154** | **88s, 2797 passed, 0 failures** |

The detector is now **2× faster than it was before any of this work**, while carrying ten more rule
categories. The suite went from 185s to 88s, which says the crisis screen was already a hot spot in
this codebase and nobody had measured it. All 248 corpus cases behave identically across the change.

**Not done, deliberately:** no Spanish candidates were generated. The Spanish rules are the stronger
set and were used here as the reference standard for English parity; a dedicated Spanish pass is
separate work and is the obvious next red-team.
