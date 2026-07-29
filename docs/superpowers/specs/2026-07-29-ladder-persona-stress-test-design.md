# Ladder Persona Stress Test

## Purpose

Stress-test the UKHCI Ladder family navigator with 12 realistic, fully synthetic Kentucky families. The work tests the product through caregiver journeys rather than isolated matcher inputs: eight families complete a first session and four continue through persisted waitlist, resource, and appointment states.

The output is an evidence-backed assessment of where Ladder helps families reliably, where it degrades, and which confirmed defects deserve attention first.

## Scope

### Included

- Twelve fictional child-and-caregiver test cards.
- Eight isolated first-session journeys.
- Four longitudinal journeys using saved state, reloads, and the app's demo time controls.
- English, Spanish, and one natural bilingual/code-switched input.
- Typed, fragmented, narrative, screen-assisted, and voice-style transcript inputs.
- Children from age two through post-high-school transition.
- Eleven Kentucky counties spanning urban, suburban, small-city, and rural contexts.
- Caregivers with varied formal education, reading needs, digital confidence, family structures, schedules, and service knowledge.
- County, age, need-domain, resource-ordering, explanation, action, and persistence checks.
- Two deployed-demo smoke checks after the authoritative local run.

### Excluded

- Crisis, abuse, self-harm, acute danger, caregiver-collapse, missing-child, material-emergency, and developmental-regression disclosures.
- Real patient or family information.
- Live eligibility determinations, diagnoses, prescriptions, or clinical recommendations.
- Resource-catalog expansion or re-verification.
- Product fixes during the testing pass.
- Load, concurrency, penetration, or infrastructure performance testing. Here, "stress test" means diverse family-journey and state-transition testing.

## Considered Approaches

1. **Journey-first with a coverage matrix — selected.** Each family is internally coherent and uses natural caregiver language. A cross-family matrix prevents duplicated ages, counties, needs, interaction styles, and lifecycle states.
2. **Coverage-first.** Systematically combines independent variables. It maximizes pairwise coverage but produces less believable families and weaker end-to-end narratives.
3. **Mystery-shopper.** Uses richly improvised family stories. It feels highly human but is difficult to compare, reproduce, and rerun after product changes.

## Cohort

All names and details are fictional. Caregiver education affects vocabulary, reading load, explanation needs, and interaction style; it is never treated as a proxy for intelligence, commitment, or parenting ability. Plain-language cases will not rely on caricatured spelling or grammar.

| ID | Journey | Child and county | Primary need | Caregiver interaction lens |
|---|---|---|---|---|
| F01 | First session | Theo, 2, Pike | Speech and motor delays; therapy and transportation | Grandmother guardian, GED, voice-first, low digital confidence |
| F02 | First session | Mateo, 2, Jefferson | Speech delay near the First Steps age boundary | Spanish-first mother, high-school education, night-shift worker |
| F03 | First session | Zoe, 4, Fayette | Social-communication and sensory concerns; no diagnosis | Graduate-educated parent who wants evidence and resists premature labels |
| F04 | First session | Gabriel, 9, McCracken | Existing IEP, continuing school removals, inadequate support | Bilingual father, trade certificate, naturally code-switches |
| F05 | First session | Jordan, 12, Boone | Attention and executive-function concerns | Single father, high-school education, frustrated and narratively disorganized |
| F06 | First session | Sam, 7, Warren | Existing therapies plus respite, sibling support, and recreation | Mother with some college who has dyslexia and prefers voice |
| F07 | First session | Noah, 16, Christian | Autism/intellectual-disability transition planning and waivers | Aunt and kinship caregiver, GED, strong lived expertise |
| F08 | First session | Emma, 19, Greenup | Post-high-school services and future planning | Grandfather guardian, low digital confidence, mixed yes/no/declined screen answers |
| L01 | Longitudinal | Sofía, 5, Fayette | Spanish-language developmental navigation | Return use, check-in, journal, packet, and persisted state |
| L02 | Longitudinal | Jaylen, 8, Breathitt | Rural therapy and transportation access | Resource step progresses from planned to tried to enrolled across reloads |
| L03 | Longitudinal | Maya, 10, Rowan | Dyslexia/ADHD evaluation wait | Work and sibling-care barriers, booking, earlier-slot choice, missed visit, and rescheduling |
| L04 | Longitudinal | Ava, 2, Perry | Speech delay and First Steps enrollment | Countdown, enrollment, notes, packet continuity, and age-boundary behavior |

## Test Card Contract

Each family receives one reusable card with:

- caregiver and child context;
- current date-relative age and profile truth;
- opening message exactly as entered;
- follow-up answers in the caregiver's established voice;
- structured-screen answers when used;
- interaction method and language;
- expected extracted facts and evidence attribution;
- expected and prohibited need domains;
- expected county-local, age-appropriate, or honest statewide-fallback behavior;
- expected follow-up questions and actions;
- longitudinal starting state and transition sequence, when applicable;
- must-not-happen assertions;
- checkpoint list and scoring fields.

Test cards separate persona truth from expected product behavior. They do not require a particular sentence when several responses would be equally safe and useful.

## Execution Protocol

### Environment

The authoritative run uses the current `master` build at `http://127.0.0.1:3000/ladder` with the deterministic no-key path. This keeps all cases reproducible and avoids external AI disclosure. The production smoke checks use `https://patient-centered.vercel.app/ladder`.

No application source is changed during the run. Any setup needed solely for evidence capture remains outside product behavior.

### Isolation

- Every first-session case starts in a fresh browser context with empty site storage.
- Each longitudinal case receives its own browser context and retains only its own state.
- A baseline storage check precedes the first action.
- Reload checks occur only at checkpoints named on the test card.
- State from one family must never appear in another family's journey.

### First-session sequence

1. Open Ladder at a clean start.
2. Enter the exact caregiver opening through the assigned input style.
3. Answer Ladder's follow-ups naturally from the test card.
4. Supply or confirm county, birth information, school stage, and diagnoses only when requested.
5. Complete the needs screen when that case uses it.
6. Review extracted facts, need domains, recommended resources, rationales, and next actions.
7. Exercise the assigned save, share-consent, enrollment, or planned-step action.
8. Record all checkpoints and evidence.

### Longitudinal sequence

1. Complete the family's first session and establish the named waitlist or resource state.
2. Reload and verify persisted profile, facts, resources, steps, referral, and appointment data.
3. Use only the app's existing demo time controls to reach seven-day, monthly, reminder, missed-visit, and age-boundary checkpoints.
4. Exercise the family-specific continuation path:
   - Spanish return check-in, journal, and packet;
   - rural resource step progression;
   - booking, work/sibling barrier, earlier-slot decision, missed visit, and reschedule;
   - First Steps enrollment and countdown retirement.
5. Reload at the final state and verify continuity.

Demo time controls accelerate a real state transition; they are not evaluated as caregiver-facing production behavior.

### Input variation

The cohort includes concise plain language, long narrative, fragments, uncertain language, domain knowledge, natural frustration, English, Spanish, and bilingual code-switching. F01 and F06 use voice-style transcripts. If the test browser cannot supply real speech recognition, the same final transcript is entered through the description field and the result is labeled as text-path coverage; the report must not claim that microphone capture or acoustic recognition quality was tested.

### Defect confirmation

A suspected defect is rerun once from a clean state. A result is reported as confirmed only when it reproduces or when preserved state/evidence proves a deterministic failure. Non-reproducing observations remain clearly labeled.

After local completion, F02 and L03 are repeated as smoke checks on the deployed demo. Deployment differences are reported separately from source behavior.

## Evaluation

Each applicable dimension receives:

- `2` — expected outcome without material friction;
- `1` — usable but degraded, confusing, incomplete, or unnecessarily effortful;
- `0` — wrong, blocked, lost, or materially unusable.

### Dimensions

1. Caregiver input understood.
2. Facts extracted accurately and attributed to the caregiver.
3. Follow-up questions relevant and non-repetitive.
4. Child profile captured without unnecessary re-entry.
5. Need domains identified correctly.
6. Resources appropriate for age, county, and stated needs.
7. Next steps understandable and actionable.
8. Language, tone, trust, and absence of false safety escalation.
9. Saved-state continuity for longitudinal families.
10. Waitlist and appointment progression for longitudinal families.

First-session scores use dimensions 1–8. Longitudinal scores use dimensions 1–10. Percentages are based only on applicable dimensions.

### Result bands

- **Green:** 85–100%.
- **Amber:** 65–84%.
- **Red:** below 65%.

Any journey is automatically Red if Ladder invents a diagnosis, gives materially wrong age/county guidance, loses required longitudinal state, blocks the intended journey, exposes another family's state, or falsely diverts ordinary non-crisis wording into the crisis pathway.

### Finding severity

- **Critical:** unsafe guidance, false crisis diversion that prevents use, cross-family state exposure, or unrecoverable required-state loss.
- **High:** wrong age/county resource behavior, blocked core journey, or a longitudinal transition that cannot complete.
- **Medium:** materially confusing extraction, irrelevant repetition, misleading prioritization, or avoidable re-entry that does not fully block progress.
- **Low:** copy, visual, or minor interaction friction with a clear workaround.

Every observation is also classified as a product defect, catalog gap, expected demo limitation, deployment drift, or test-environment limitation.

## Evidence and Deliverables

The completed package contains:

1. A reusable cohort and test-card document.
2. A journey ledger with expected versus actual behavior, checkpoints, scores, and evidence references.
3. Screenshots for decisive successes and failures.
4. A coverage matrix across age, geography, language, caregiver interaction style, need domain, and lifecycle state.
5. Reproduction steps for every confirmed defect.
6. A prioritized findings report with recommended fixes.
7. An executive summary naming what Ladder handles well and where families are most likely to struggle.

Durable text artifacts live under `docs/qa/ladder-personas/`. Run-specific screenshots and browser traces live under `test-results/ladder-personas/2026-07-29/`; the report links to them locally and states when an artifact is intentionally not committed.

The final findings report is `docs/qa/ladder-personas/2026-07-29-results.md`.

## Completion Criteria

The run is complete only when:

- all 12 journeys reach their final named checkpoint;
- every applicable scoring dimension has evidence;
- each suspected defect has been rerun once;
- all four longitudinal cases have passed through at least two reload checks, including the final state;
- cross-family isolation has been verified;
- the two production smoke checks are recorded;
- every finding has severity, classification, reproduction steps, and evidence;
- limitations distinguish transcript-path testing from actual acoustic recognition;
- the cohort, ledger, coverage matrix, findings, and executive summary are internally consistent.

## Safety and Privacy

All cases are synthetic and non-crisis. Ordinary frustration and service-navigation difficulty remain in scope because false positive escalation is a trust and usability risk. The run does not deliberately probe crisis recall.

No real names, dates of birth, addresses, contact details, insurance identifiers, or clinical records are used. No API keys, secrets, or environment contents appear in evidence. Screenshots are reviewed before inclusion.

## Change Boundary

This pass diagnoses and reports. It does not fix Ladder, modify the resource catalog, push code, or deploy. Product changes require a separate approved implementation scope.
