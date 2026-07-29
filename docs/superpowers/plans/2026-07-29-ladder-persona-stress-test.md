# Ladder Persona Stress Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute and document 12 synthetic, non-crisis Kentucky family journeys through Ladder, confirm every suspected defect, and deliver a reusable cohort plus an evidence-backed findings report.

**Architecture:** Treat each family as an isolated browser journey with its own durable run record and non-committed screenshot directory. Build the reusable cohort first, run eight first-session and four longitudinal cases against the deterministic local app, rerun suspected defects, repeat F02 and L03 against production, then synthesize the independent run records into one scored report.

**Tech Stack:** Next.js 15, React 19, strict TypeScript, Playwright/browser automation, localStorage state inspection, Markdown QA artifacts, Vitest, existing project safety and build gates.

## Global Constraints

- Use only fictional family data; never enter real names, dates of birth, addresses, contacts, identifiers, or clinical records.
- Run exactly eight first-session journeys (`F01`–`F08`) and four longitudinal journeys (`L01`–`L04`).
- Exclude crisis, abuse, self-harm, acute danger, caregiver collapse, missing-child, material-emergency, and developmental-regression disclosures.
- Require no crisis banner, no safety event, and no regression flag in every case.
- Use the deterministic no-key family-interview path; do not run the live navigator gate or expose data to an external AI provider.
- Do not change application source, tests, the resource catalog, or product behavior during this diagnostic pass.
- Do not fix confirmed defects in this pass.
- Treat caregiver education as an interaction and explanation variable, never as a proxy for intelligence or commitment.
- Do not use caricatured spelling, grammar, or dialect.
- Label shimmed or typed voice-style input as transcript-path coverage; do not claim microphone or acoustic-recognition coverage.
- Use only existing app demo controls for longitudinal time changes.
- Record that the 31-day family control can exercise stale-step behavior but not the exact seven-day threshold.
- Record that no existing demo control can advance a child across the First Steps age cutoff; L04 covers countdown persistence and enrollment retirement, not a simulated birthday.
- Use a fresh browser context for every first-session family and a separate retained context for each longitudinal family.
- The authoritative run is local at `http://127.0.0.1:3000/ladder`.
- Repeat F02 and L03 at `https://patient-centered.vercel.app/ladder` only after local completion.
- Keep durable text under `docs/qa/ladder-personas/`.
- Keep screenshots and traces under `test-results/ladder-personas/2026-07-29/`; do not force-add ignored binary evidence.
- Commit directly to `master` with scoped `docs:` or `test:` commits; do not push, open a pull request, or deploy.

---

## File Structure

- Create `docs/qa/ladder-personas/2026-07-29-cohort.md`
  - Reusable source of truth for all 12 cards, scoring dimensions, must-not-happen assertions, and coverage matrix.
- Create `docs/qa/ladder-personas/runs/2026-07-29-baseline.md`
  - Local build, deterministic tests, safety gate, existing Ladder e2e baseline, browser/server details, and known test-environment limitations.
- Create `docs/qa/ladder-personas/runs/2026-07-29-F01.md` through `2026-07-29-F08.md`
  - One isolated first-session result per family.
- Create `docs/qa/ladder-personas/runs/2026-07-29-L01.md` through `2026-07-29-L04.md`
  - One longitudinal result per family, including both reload checkpoints.
- Create `docs/qa/ladder-personas/runs/2026-07-29-production-smoke.md`
  - Production-only observations for F02 and L03, separated from local findings.
- Create `docs/qa/ladder-personas/2026-07-29-results.md`
  - Executive summary, cohort ledger, coverage matrix, aggregate scoring, confirmed findings, reproduction steps, strengths, limitations, and recommendations.
- Create one runtime-evidence directory for each of `F01`–`F08`, `L01`–`L04`, `production-F02`, and `production-L03` under `test-results/ladder-personas/2026-07-29/`
  - PNG screenshots and any browser traces. These remain local and are referenced from run records with absolute paths.
- Refresh `docs/ops/red-team-results/2026-07-29-crisis-gate.md` only if `npm run crisis:gate` rewrites it.

The per-family run files are intentionally independent so different execution workers never edit the same result file. Only the final synthesis task edits the aggregate results document.

---

### Task 1: Create the reusable cohort and scoring contract

**Files:**
- Create: `docs/qa/ladder-personas/2026-07-29-cohort.md`

**Interfaces:**
- Consumes: approved design `docs/superpowers/specs/2026-07-29-ladder-persona-stress-test-design.md`.
- Produces: exact family cards and scoring rules consumed by Tasks 3–16.

- [ ] **Step 1: Create the cohort document with the common run contract**

Use `apply_patch` to create the file. State that each run must record:

1. isolated starting storage;
2. exact profile and opening;
3. caregiver-attributed facts and source snippets;
4. follow-up relevance and repetition;
5. `latestInterviewDomains` and `activeDomains`;
6. visible resource IDs and order;
7. age/county exclusions;
8. resource action and persisted state;
9. `safetyEvents`, regression flags, and crisis-banner count;
10. screenshots and storage evidence;
11. scores and band;
12. confirmed versus non-reproducing findings.

Use `2 = expected without material friction`, `1 = usable but degraded`, and `0 = wrong, blocked, lost, or materially unusable`. Score D1–D8 for first-session cases and D1–D10 for longitudinal cases. Use Green `85–100%`, Amber `65–84%`, and Red below `65%`.

Require each family run record to begin with its exact heading, such as `# F01 — Theo` or `# L04 — Ava`, so completion can be checked mechanically.

- [ ] **Step 2: Add all 12 exact family cards**

Write the following profiles, openings, expected domains, exclusions, and resource oracles verbatim:

**F01 — Theo**

- Profile: Pike; May 2024; not school age; no diagnoses.
- Caregiver lens: grandmother guardian; GED; low digital confidence; rural setting.
- Opening: “Theo is two. He says mama and no, but not much else, and he still falls a lot when he walks. His doctor said speech and physical therapy could help. I’m his grandmother and I don’t drive, so we need a ride to appointments. I need somebody to tell me who to call first.”
- Input: voice-style transcript using the existing speech shim when available; otherwise enter the exact transcript as text and label the limitation.
- Expected domains: early intervention, therapies, transportation.
- Prohibited: school/IEP, waivers, diagnosis claims, crisis, regression.
- Resource oracle: `first_steps_big_sandy` before `first_steps_statewide`; `help_me_grow_ky` and `kentucky_211` remain reachable.
- Action: plan the Big Sandy First Steps resource.

**F02 — Mateo**

- Profile: Jefferson; October 2023; not school age; no diagnoses; Spanish UI.
- Caregiver lens: Spanish-first mother; high-school education; night-shift worker; urban setting.
- Opening: “Mateo tiene dos años y nueve meses y casi no habla. Señala lo que quiere y usa unas cinco palabras. Trabajo de noche y necesito saber a quién llamar esta semana para terapia del habla, en español.”
- Expected domains: early intervention, therapies.
- Prohibited: school/IEP, diagnosis claims, crisis, regression.
- Resource oracle: `first_steps_kentuckiana` before `first_steps_statewide`, followed by the age-three transition guidance when eligible; the clock communicates urgency without declaring ineligibility.
- Action: save the Kentuckiana Point of Entry and complete its consent-gated share.

**F03 — Zoe**

- Profile: Fayette; March 2022; preschool; no diagnoses.
- Caregiver lens: graduate-educated parent; evidence-oriented; cautious about labels; urban setting.
- Opening: “Zoe is four. She covers her ears in busy places, avoids group play, and has trouble with back-and-forth language. She has no diagnosis. I want evidence about whether speech or occupational therapy and a developmental evaluation make sense; I do not want the app to put a label on her.”
- Expected deterministic domain: therapies.
- Conceptual gap under observation: diagnosis education is appropriate but the no-key extractor cannot emit it.
- Prohibited: early intervention, waiver-first recommendations, invented autism, reported-diagnosis facts.
- Resource oracle: UK Developmental Pediatrics and OCSHCN should be useful age-appropriate candidates; autism-specific content must not imply a diagnosis.
- Action: save the most relevant evaluation or therapy resource actually shown.

**F04 — Gabriel**

- Profile: McCracken; May 2017; elementary; no diagnoses; English UI with code-switched input.
- Caregiver lens: bilingual father; trade certificate; small-city setting.
- Opening: “Gabriel is in fourth grade y ya tiene un IEP. La escuela still calls me to pick him up and sends him home when he gets overloaded. Hemos tenido meetings, pero el plan no está working. I need help with the IEP and what to ask for next.”
- Expected domain: school and IEP.
- Prohibited: crisis handling, early intervention, waivers, invented diagnosis.
- Resource oracle: `idea_school_discipline`, `fba_bip_request`, and `kde_dispute_resolution`; `kde_evaluation_request` may appear but must not displace the first two.
- Action: plan the IDEA school-discipline step.

**F05 — Jordan**

- Profile: Boone; February 2014; middle school; no diagnoses.
- Caregiver lens: single father; high-school education; frustrated and narratively disorganized; suburban setting.
- Opening: “Jordan is twelve and in seventh grade, and I’m frustrated because the story comes out all mixed up. Homework takes hours. He loses papers, forgets directions, cannot stay focused, starts three things and finishes none, and the school says he needs to try harder. I need help deciding whether to ask for an evaluation, an IEP, or a 504.”
- Expected domain: school and IEP.
- Prohibited: invented ADHD, respite, crisis, discipline/dispute resources leading.
- Resource oracle: `kde_evaluation_request`, `kde_parent_toolbox`, and `ky_spin`; discipline content must not lead.
- Action: save the evaluation-request resource.

**F06 — Sam**

- Profile: Warren; April 2019; elementary; no diagnoses.
- Caregiver lens: mother with some college; dyslexic; voice-first; small-city setting.
- Opening: “Sam is seven. He already goes to speech and occupational therapy. I need a break sometimes, his sister needs support too, and I’d like a sports or recreation program where they both feel welcome. Reading long pages is hard for me, so please keep it short.”
- Input: voice-style transcript using the F01 limitation rules.
- Expected domains: respite, parent support, sibling support, recreation.
- Deliberate extraction check: mentioning existing therapy must not be framed as a new unmet need; if `therapies` activates, score the distinction.
- Prohibited: invented diagnosis, Fayette/Louisville resources described as local, crisis, regression.
- Resource oracle: `sibling_support_project`, `ky_spin`, and an honest `kentucky_211` or `kynect_resources` recreation fallback.
- Action: plan the sibling-support resource; do not mark an existing program unless the test-card truth names that exact program.

**F07 — Noah**

- Profile: Christian; January 2010; high school; diagnoses autism and intellectual disability.
- Caregiver lens: aunt and kinship caregiver; GED; strong lived system knowledge; small-city setting.
- Opening: “Noah is sixteen. He was diagnosed with autism and intellectual disability when he was younger. I know the system and I’m planning for adult transition, supported decision-making, ABLE, and waivers before he turns eighteen. Please do not start at the very beginning.”
- Expected domains: waivers/financial, future planning.
- Prohibited: early intervention, generic beginner framing, UK Developmental Pediatrics, invented new diagnoses.
- Resource oracle: `scl_waiver`, `my_choice_kentucky`, `michelle_p_waiver`, and `stable_kentucky`; `hcb_waiver` must not lead without a physical-disability basis.
- Action: plan or consent-share My Choice Kentucky.

**F08 — Emma**

- Profile: Greenup; April 2007; post-high; diagnosis intellectual disability.
- Caregiver lens: grandfather guardian; low digital confidence; prefers short steps; rural/small-town setting.
- Opening: “Emma is nineteen. She was diagnosed with intellectual disability. Finished her program last spring. Adult transition. Supported decision-making instead of jumping straight to guardianship. ABLE. Services for what comes next. I need simple steps.”
- Screen answers in question order: no, declined, no, yes, declined, yes, no, declined.
- Expected active domains: waivers/financial, parent support, future planning.
- Prohibited: early intervention, school/IEP, `ssi_children`, UK Developmental Pediatrics.
- Resource oracle: `my_choice_kentucky`, `stable_kentucky`, and `scl_waiver`.
- Action: save My Choice Kentucky and verify all eight screen facts persist.

**L01 — Sofía**

- Profile: Fayette; June 2021; preschool; no diagnoses; Spanish UI.
- Caregiver lens: Spanish-first mother; associate degree; comfortable returning to the app; urban setting.
- Opening: “Sofía tiene cinco años. En la escuela le cuesta participar con otros niños y seguir conversaciones; las rutinas nuevas la abruman. No tiene diagnóstico. No sé por dónde empezar ni qué pedir en la escuela, y necesito hacerlo en español.”
- Monthly note: “Este mes la maestra dice que las transiciones siguen siendo difíciles, pero Sofía está usando más palabras con una amiga.”
- Expected domains: school/IEP, parent support.
- Prohibited: diagnosis claims, autism framing, crisis, regression.
- Resource oracle: `kde_evaluation_request`, `ky_spin`, and `kde_parent_toolbox`, with the honest Spanish notice about source-language limitations.

**L02 — Jaylen**

- Profile: Breathitt; March 2018; elementary; no diagnoses.
- Caregiver lens: parent with high-school education; intermittent connectivity; rural setting.
- Opening: “Jaylen is eight. We have an occupational therapy referral, but the nearest therapy is more than an hour away and we do not have a reliable ride. I want help finding something we can actually get to.”
- Expected domains: therapies, transportation.
- Prohibited: early intervention, school-discipline resources, invented local provider, crisis, regression.
- Resource oracle: `ocshcn`, `kentucky_211`, and `kynect_resources`; state honestly when no verified Breathitt-specific transportation provider exists.
- Longitudinal target: plan Kentucky 211, use the 31-day control, record “Left a message” as tried, then mark Kentucky 211 enrolled.

**L03 — Maya**

- Profile: Rowan; May 2016; elementary; no diagnoses.
- Caregiver lens: college-educated parent balancing work and care for other children; rural/small-town setting.
- Opening: “Maya is ten and in fifth grade. Her teacher and I are concerned about dyslexia and ADHD, but she has not been diagnosed. Reading and homework take hours, and we are waiting for an evaluation.”
- Expected initial domain: school/IEP; respite may activate only after the explicit sibling-care appointment answer.
- Prohibited: reported diagnosis, UK Developmental Pediatrics as a dyslexia evaluator, discipline/dispute leading, crisis, regression.
- Resource oracle: `kde_evaluation_request`, `kde_parent_toolbox`, `ky_spin`, or `lda_kentucky`.
- Longitudinal target: book, record work barrier, join and accept earlier slot, record sibling-care barrier on the replacement booking, miss the visit, rebook, and survive reload.

**L04 — Ava**

- Profile: Perry; January 2024; not school age; no diagnoses.
- Caregiver lens: single parent with some college; moderate digital confidence; rural setting.
- Opening: “Ava is two and uses about six words. We were referred to First Steps for speech therapy, and I want help making sure we get started before the deadline.”
- Follow-up note: “Ava started using two new words this month, and we called the First Steps number.”
- Expected domains: early intervention, therapies.
- Prohibited: school discipline, diagnosis claims, crisis, regression.
- Resource oracle: `first_steps_kentucky_river` before `first_steps_statewide`, followed by age-three transition guidance when eligible.
- Longitudinal target: verify countdown persistence, plan and save the Kentucky River resource, add the note and packet question, mark enrolled, and verify countdown retirement across reload.

- [ ] **Step 3: Add the coverage matrix**

Add one row per case and columns for age band, school stage, county, geography, language, opening style, caregiver education/reading need, profile-first versus description-first, expected domains, county-local versus statewide fallback, resource action, first-session versus longitudinal, and production smoke.

Validate these totals:

- 12 rows;
- 8 first-session and 4 longitudinal;
- 11 distinct counties;
- 2 Spanish journeys;
- 1 bilingual/code-switched journey;
- 2 voice-style transcript journeys;
- 2 production-smoke anchors;
- 0 crisis or regression cases.

- [ ] **Step 4: Validate and commit the cohort**

Run:

```bash
rg -n "^## (F|L)[0-9]{2}" docs/qa/ladder-personas/2026-07-29-cohort.md
if rg -n -i "self-harm|suicid|abuse|ran away|stopped (talking|walking|saying)" docs/qa/ladder-personas/2026-07-29-cohort.md; then exit 1; fi
git diff --check
git add docs/qa/ladder-personas/2026-07-29-cohort.md
git commit -m "docs: add Ladder persona stress cohort"
```

Expected: the first command prints exactly 12 card headings; the second prints no scenario disclosures; whitespace check passes; only the cohort file is committed.

---

### Task 2: Establish and record the local baseline

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-baseline.md`
- Modify if rewritten: `docs/ops/red-team-results/2026-07-29-crisis-gate.md`

**Interfaces:**
- Consumes: current committed `master` and existing project gates.
- Produces: verified local URL and baseline evidence required before persona execution.

- [ ] **Step 1: Confirm a clean, expected checkout**

Run:

```bash
git status --short
git branch --show-current
git log -1 --oneline
```

Expected: branch `master`; no unrelated changes. Record the exact commit hash and any pre-existing scoped files without modifying them.

- [ ] **Step 2: Run deterministic quality gates**

Run:

```bash
npm run check
npm run crisis:gate
npm run test:e2e -- e2e/family-navigator.spec.ts
```

Expected: lint/tests/build pass, crisis gate passes, and existing Ladder e2e passes on desktop and mobile. Do not run `npm run navigator:gate`; it requires a live API key and violates the no-key protocol.

If a command fails, preserve its exact result in the baseline file, rerun the focused failing command once, and classify it as a pre-existing baseline limitation. Do not fix it.

- [ ] **Step 3: Start the authoritative local app**

Start `npm run dev` as a long-lived workspace process at port 3000. Open `http://127.0.0.1:3000/ladder` and verify:

- heading `Ladder — your child's development`;
- concept-demo disclosure;
- opening interview;
- no seeded family profile;
- no crisis banner.

Keep the process alive through Task 16.

- [ ] **Step 4: Write and commit the baseline record**

Record command, exit status, duration, commit hash, local URL, browser engine and viewport, whether the crisis report changed, and the explicit live-gate omission.

Run:

```bash
git diff --check
git add docs/qa/ladder-personas/runs/2026-07-29-baseline.md
git add docs/ops/red-team-results/2026-07-29-crisis-gate.md
git commit -m "test: record Ladder persona baseline"
```

If the crisis report is byte-identical, omit it from staging. Expected: the baseline record is committed and no application file changes.

---

### Task 3: Execute F01 — Theo

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-F01.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/F01/`

**Interfaces:**
- Consumes: F01 card, local server, fresh browser context.
- Produces: D1–D8 score, transcript-path limitation, resource-order evidence, and planned-step persistence.

- [ ] **Step 1: Start clean and enter Theo's description**

Create a fresh browser context and assert its storage state has no origins or cookies. Install the existing speech-recognition final-transcript shim from `e2e/family-navigator.spec.ts`; open `/ladder`, click `Start speaking`, and verify the exact F01 opening appears once. If the shim is unavailable, type the exact opening and record text-path coverage.

Use the conversational basics turns to set Pike, birth year 2024, and not-school-age. Confirm any correctly inferred facts; answer dynamic follow-ups from the card without introducing new need domains.

- [ ] **Step 2: Inspect facts, domains, resources, and safety**

Require caregiver-quoted speech and motor facts; `early_intervention`, `therapies`, and `transportation`; no school or waiver domain; no crisis banner; empty `safetyEvents`; no regression flag.

Require `first_steps_big_sandy` before `first_steps_statewide`. Verify `help_me_grow_ky` and `kentucky_211` are reachable in the matched or fallback areas. Click `I'll do this` on Big Sandy First Steps and verify a persisted `planned` step.

- [ ] **Step 3: Capture evidence, score, and confirm defects**

Save `review.png`, `resources.png`, and `planned-step.png`. Inspect localStorage fields named in the cohort contract. Score D1–D8. Rerun once in a new context if any expected domain, order, or safety assertion fails.

- [ ] **Step 4: Write and commit F01**

Document expected versus actual, evidence paths, score, band, automatic-Red check, finding classification, and rerun result.

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-F01.md
git commit -m "test: record F01 Ladder persona journey"
```

---

### Task 4: Execute F02 — Mateo

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-F02.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/F02/`

**Interfaces:**
- Consumes: F02 card, local server, fresh browser context.
- Produces: Spanish first-session score and local First Steps boundary evidence.

- [ ] **Step 1: Set Spanish through the visible app control**

In a fresh context open `/today`. Within the `Language / Idioma` group click `Español`; verify persisted `patient.language === "es"`. Navigate to `/ladder` and assert `html[lang="es"]`, the Spanish Ladder heading, the label `¿Con qué te gustaría recibir ayuda?`, and button `Buscar ayuda`.

- [ ] **Step 2: Enter Mateo's exact profile and journey**

Before the opening, use `Agrega o cambia los datos` to set Jefferson, October 2023, not-school-age, and Mateo. Submit the exact Spanish opening and answer Spanish follow-ups.

Require Spanish caregiver-attributed speech facts, `early_intervention` and `therapies`, no school domain or diagnosis claim, and no horizontal overflow at the mobile viewport.

- [ ] **Step 3: Verify boundary resources and consent action**

Require `first_steps_kentuckiana` before `first_steps_statewide`; inspect any age-three transition card and the countdown/act-now copy. The app may communicate the approaching 45-day cutoff but must not declare Mateo ineligible.

Save the Kentuckiana card, check its Spanish share-consent box, share it, and verify exactly one persisted `shared` audit event.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `spanish-entry.png`, `review.png`, `countdown-resources.png`, and `share-complete.png`. Score D1–D8 and rerun suspected defects once.

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-F02.md
git commit -m "test: record F02 Ladder persona journey"
```

---

### Task 5: Execute F03 — Zoe

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-F03.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/F03/`

**Interfaces:**
- Consumes: F03 card, local server, fresh browser context.
- Produces: no-diagnosis labeling assessment and deterministic extraction-gap evidence.

- [ ] **Step 1: Run Zoe description-first**

In a fresh context submit the exact F03 opening, then answer Fayette, 2022, and preschool through the basics turn. Do not add a diagnosis.

- [ ] **Step 2: Verify cautious interpretation**

Require therapy-related caregiver facts and a `therapies` domain. Require no reported-diagnosis fact, no wording that says or implies Zoe has autism, no early-intervention domain, and no crisis/regression state.

Record whether the app surfaces diagnosis education. If it does not, classify that against the documented deterministic capability gap rather than inventing a pass.

- [ ] **Step 3: Inspect resource fitness**

Record the first four visible resource IDs. UK Developmental Pediatrics and OCSHCN are useful age-appropriate candidates; any waiver-first ordering or autism-specific rationale without a reported diagnosis is a finding. Verify every displayed resource's age band includes age four.

Save the most relevant evaluation or therapy resource actually shown.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `review-no-diagnosis.png`, `resources.png`, and `saved-resource.png`. Score D1–D8, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-F03.md
git commit -m "test: record F03 Ladder persona journey"
```

---

### Task 6: Execute F04 — Gabriel

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-F04.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/F04/`

**Interfaces:**
- Consumes: F04 card, local server, fresh browser context.
- Produces: code-switch interpretation and school-procedure ordering evidence.

- [ ] **Step 1: Run the code-switched opening**

In a fresh English context submit the exact F04 opening, then set McCracken, 2017, and elementary through the basics turn. Confirm only caregiver-supported facts.

- [ ] **Step 2: Check domain and false-positive safety**

Require `school_iep`, a relevant school follow-up, no unrelated active domain, no crisis banner, empty `safetyEvents`, and no invented diagnosis.

- [ ] **Step 3: Check procedural order and plan a step**

Record the first four resource IDs. Require IDEA discipline and FBA/BIP guidance to be visible and ahead of generic evaluation help; record whether dispute resolution is appropriately placed. Click `I'll do this` on IDEA discipline and verify the planned step persists.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `review-code-switch.png`, `school-resources.png`, and `planned-step.png`. Score D1–D8, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-F04.md
git commit -m "test: record F04 Ladder persona journey"
```

---

### Task 7: Execute F05 — Jordan

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-F05.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/F05/`

**Interfaces:**
- Consumes: F05 card, local server, fresh browser context.
- Produces: rambling-input, no-diagnosis, and non-discipline ordering assessment.

- [ ] **Step 1: Submit the exact long narrative**

Use a fresh context, submit the F05 opening, then set Boone, 2014, and middle school. Answer follow-ups without naming a diagnosis.

- [ ] **Step 2: Verify extraction and questions**

Require school and attention/behavior facts sourced to Jordan's opening; `school_iep`; no reported ADHD diagnosis; no respite, crisis, or regression state. Record whether follow-ups repeat the already-stated evaluation/IEP/504 request.

- [ ] **Step 3: Verify useful school ordering**

Require evaluation request, parent toolbox, and KY-SPIN to be visible. Discipline or dispute resources must not lead this non-discipline case. Save the evaluation-request resource and verify persistence.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `review-rambling.png`, `school-resources.png`, and `saved-evaluation.png`. Score D1–D8, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-F05.md
git commit -m "test: record F05 Ladder persona journey"
```

---

### Task 8: Execute F06 — Sam

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-F06.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/F06/`

**Interfaces:**
- Consumes: F06 card, local server, fresh browser context.
- Produces: voice-style, reading-load, multi-domain, and honest-fallback assessment.

- [ ] **Step 1: Enter the voice-style transcript**

Use a fresh context and the F01 shim procedure. Submit the exact F06 opening, then set Warren, 2019, and elementary. Record whether the UI honors the caregiver's request for short, understandable next steps.

- [ ] **Step 2: Check multi-domain interpretation**

Require respite, parent support, sibling support, and recreation. Record `therapies` as a degraded extraction if the app treats the already-active therapies as a new unmet need. Require no diagnosis, crisis, or regression state.

- [ ] **Step 3: Check fallback honesty**

Require Sibling Support Project and KY-SPIN to be available. Verify no Fayette or Louisville recreation program is described as local to Warren; an honest Kentucky 211 or kynect fallback is acceptable. Plan the sibling-support resource.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `review-multineed.png`, `fallback-resources.png`, and `planned-sibling-support.png`. Score D1–D8, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-F06.md
git commit -m "test: record F06 Ladder persona journey"
```

---

### Task 9: Execute F07 — Noah

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-F07.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/F07/`

**Interfaces:**
- Consumes: F07 card, local server, fresh browser context.
- Produces: transition-age, expert-caregiver, waiver-order, and age-filter evidence.

- [ ] **Step 1: Enter the structured profile before orientation**

In a fresh context use the profile disclosure to set Christian, January 2010, high school, Noah, autism, and intellectual disability. Save, then submit the exact opening.

- [ ] **Step 2: Verify advanced-context interpretation**

Require waiver/financial and future-planning domains, caregiver-supported reported diagnoses, and a waiver follow-up that does not restart with basic diagnosis education. Require no early intervention or newly invented diagnosis.

- [ ] **Step 3: Verify transition resources**

Record order for SCL, My Choice, Michelle P., and STABLE. HCB waiver must not lead without a physical-disability basis; UK Developmental Pediatrics must be absent by age. Plan or consent-share My Choice Kentucky.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `review-transition.png`, `transition-resources.png`, and `resource-action.png`. Score D1–D8, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-F07.md
git commit -m "test: record F07 Ladder persona journey"
```

---

### Task 10: Execute F08 — Emma

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-F08.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/F08/`

**Interfaces:**
- Consumes: F08 card, local server, fresh browser context.
- Produces: post-high, fragmented-input, mixed-screen, and age-exclusion evidence.

- [ ] **Step 1: Enter the profile before the fragmented opening**

Use a fresh context and the profile disclosure to set Greenup, April 2007, post-high, Emma, and intellectual disability. Save the profile, then submit the exact F08 opening. This order prevents a later structured-profile edit from resetting the visible orientation thread.

- [ ] **Step 2: Complete the mixed needs screen**

Open the yes/no screen. Answer its eight fieldsets in order: no, declined, no, yes, declined, yes, no, declined. Click `See what can help`.

Require eight persisted screen answers and facts. Only waivers and parent support are added by “yes”; future planning remains from the opening.

- [ ] **Step 3: Verify adult resource filtering**

Require My Choice, STABLE, and SCL options to be visible or reachable. Require `ssi_children`, UK Developmental Pediatrics, early-intervention resources, and school-only content to be absent by age/domain. Save My Choice Kentucky.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `fragmented-review.png`, `saved-needs-screen.png`, `adult-resources.png`, and `saved-resource.png`. Score D1–D8, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-F08.md
git commit -m "test: record F08 Ladder persona journey"
```

---

### Task 11: Execute L01 — Sofía

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-L01.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/L01/`

**Interfaces:**
- Consumes: L01 card, local server, one retained browser context.
- Produces: D1–D10 Spanish persistence, monthly check-in, journal, packet, and two-reload evidence.

- [ ] **Step 1: Establish the Spanish family state**

In a fresh retained context set Spanish through `/today`, then open `/ladder`. Use the Spanish profile form to set Fayette, June 2021, preschool, and Sofía. Submit the exact Spanish opening and answer Spanish follow-ups.

Require school/IEP and parent support, no diagnosis or autism claim, the Spanish source-language notice, and the expected statewide school resources.

- [ ] **Step 2: Select a packet question and perform reload checkpoint 1**

Select `¿Quién coordina los próximos pasos?` in the visit packet. Save a useful resource. Reload.

Verify Spanish language, profile, opening, facts, active domains, saved resource, and packet question remain. Capture `reload-1.png`.

- [ ] **Step 3: Complete the monthly Spanish return**

Click `Demo: imagina que pasó un mes`. In the monthly check-in choose `Agregar una nota`, submit the exact L01 monthly note through the Spanish interview, answer `No` to loss of skills, and choose pulse `4`.

Require `Gracias — nos vemos el próximo mes.`, the raw Spanish note in the journal, no regression card, no crisis banner, and the selected question in the packet.

- [ ] **Step 4: Perform reload checkpoint 2, score, rerun, and commit**

Reload and verify profile, language, facts, note, pulse, resources, packet selection, and check-in completion persist. Save `monthly-checkin.png`, `journal.png`, `packet.png`, and `reload-2.png`. Score D1–D10 and rerun defects once from a new retained context.

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-L01.md
git commit -m "test: record L01 Ladder persona journey"
```

---

### Task 12: Execute L02 — Jaylen

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-L02.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/L02/`

**Interfaces:**
- Consumes: L02 card, local server, one retained browser context.
- Produces: rural fallback and planned → tried → enrolled persistence evidence.

- [ ] **Step 1: Establish rural resource state**

Set Breathitt, March 2018, elementary, and Jaylen; submit the exact opening. Require therapies and transportation, no early intervention or school discipline, and an honest absence of verified Breathitt-local transportation.

Target `kentucky_211`. Click its `I'll do this` button and require `data-step-status="planned"` plus header text `1 step in motion`.

- [ ] **Step 2: Perform reload checkpoint 1 and trigger the stale-step follow-up**

Reload and verify the planned step. Click `Demo: pretend a month passed`. Because monthly check-in takes priority, choose `Skip check-in`.

Require the follow-up asking how Kentucky 211 went. Click `Left a message`; require `data-step-status="tried"`.

Record explicitly that the app's control advances 31 days and does not test the exact seven-day boundary.

- [ ] **Step 3: Perform reload checkpoint 2 and enroll**

Reload and verify `tried`. On Kentucky 211 click `We already have this`; require the enrolled badge/status and a packet entry under services already in motion.

Reload once more and verify enrolled state remains.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `rural-resources.png`, `planned-reload.png`, `tried-followup.png`, `enrolled-packet.png`, and `final-reload.png`. Score D1–D10, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-L02.md
git commit -m "test: record L02 Ladder persona journey"
```

---

### Task 13: Execute L03 — Maya

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-L03.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/L03/`

**Interfaces:**
- Consumes: L03 card, local server, one retained browser context.
- Produces: booking, two barrier types across bookings, earlier-slot replacement, missed-visit recovery, and two-reload evidence.

- [ ] **Step 1: Establish Maya's non-diagnosed evaluation state**

Set Rowan, May 2016, elementary, and Maya with no diagnoses. Submit the exact opening. Require school/IEP, no reported diagnosis, no UK Developmental Pediatrics dyslexia-evaluation recommendation, and no discipline/dispute lead.

- [ ] **Step 2: Book the original visit and join the earlier list**

In `family-appointment-card`, click `Show me (demo)`, choose the first offered date, and answer `Hard to get time off work`.

In `family-sooner-turn`, click `Yes, put us on the list`, `Weekday mornings`, and `Add us`. Open `Demo: move the visit closer`, click the earlier-opening demo control, and accept the sole earlier date.

- [ ] **Step 3: Perform reload checkpoint 1 and continue the replacement booking**

Reload. Require the earlier booking, absence of the prior visible date, and earlier-list status. For the replacement booking choose `Someone to watch the other kids`.

Acknowledge the currently due reminder with `Yes, we'll be there`. Use demo controls for `Tomorrow`, confirm again, then move to `Date passed` and choose `We couldn't make it`.

The two separate bookings are how this case exercises both work and sibling-care barriers; the app supports one barrier per appointment. Verify work adds `parent_support` and sibling care adds `respite`, matching `BARRIER_DOMAINS` in `src/domain/family-appointments.ts`.

- [ ] **Step 4: Perform reload checkpoint 2 and recover**

Reload. Require missed-visit reassurance and `Find a new time`. Click it, select the first new offered date, answer `We're all set`, and reload.

Inspect storage: the original is `replaced`, the earlier appointment is `missed`, and one current appointment is `booked`.

- [ ] **Step 5: Capture, score, rerun, and commit**

Save `initial-booking.png`, `earlier-offer.png`, `reload-1.png`, `missed.png`, `rebooked.png`, and `reload-2.png`. Score D1–D10, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-L03.md
git commit -m "test: record L03 Ladder persona journey"
```

---

### Task 14: Execute L04 — Ava

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-L04.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/L04/`

**Interfaces:**
- Consumes: L04 card, local server, one retained browser context.
- Produces: First Steps order, countdown persistence, note/packet continuity, enrollment retirement, and two-reload evidence.

- [ ] **Step 1: Establish Ava's First Steps state**

Set Perry, January 2024, not school age, and Ava. Submit the exact opening. Require `first_steps_kentucky_river` before `first_steps_statewide`, visible contact-now/countdown copy, early intervention and therapies, and no diagnosis/safety/regression state.

Plan and save the Kentucky River Point of Entry. Select `Who coordinates the next steps?` in the packet.

- [ ] **Step 2: Add the ordinary follow-up note and perform reload checkpoint 1**

Use `Start over` and submit the exact L04 follow-up note. Require it in the journal and packet without any regression card.

Reload and verify the profile, note, planned/saved resource, packet question, and countdown persist.

- [ ] **Step 3: Mark First Steps enrolled and retire the countdown**

Click `We already have this` on `first_steps_kentucky_river`. Require the enrolled badge, enrolled step state, no remaining First Steps resource clock, no urgent First Steps next rung, and packet service marked enrolled.

Reload and verify those outcomes persist.

Record the absence of a child-age time control as an expected demo limitation; do not claim that crossing the birthday/cutoff was tested.

- [ ] **Step 4: Capture, score, rerun, and commit**

Save `countdown.png`, `journal-packet.png`, `reload-1.png`, `enrolled.png`, and `reload-2.png`. Score D1–D10, rerun defects once, and commit:

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-L04.md
git commit -m "test: record L04 Ladder persona journey"
```

---

### Task 15: Audit and confirm all suspected findings

**Files:**
- Modify: any matching `docs/qa/ladder-personas/runs/2026-07-29-F*.md` or `docs/qa/ladder-personas/runs/2026-07-29-L*.md` file that contains a suspected or non-reproducing observation.

**Interfaces:**
- Consumes: 12 local run records and their local evidence.
- Produces: confirmed findings with exact reproduction steps or explicitly non-reproducing observations.

- [ ] **Step 1: Build the candidate-finding list**

Read all 12 run files. List every score of `0` or `1`, automatic-Red condition, unexpected order, missing domain, false domain, repeated question, persistence discrepancy, inaccessible action, or safety false positive.

Classify each candidate as product defect, catalog gap, expected demo limitation, deployment drift, or test-environment limitation.

- [ ] **Step 2: Verify every candidate has a clean rerun**

For each candidate, confirm its run record contains a second isolated attempt with the same input and profile. If missing, perform that rerun now and append the exact result and evidence path.

Do not merge two distinct symptoms into one finding unless they share the same reproducible cause and reproduction path.

- [ ] **Step 3: Assign severity**

Use:

- Critical: unsafe guidance, false crisis diversion that prevents use, cross-family state exposure, or unrecoverable required-state loss.
- High: wrong age/county resource behavior, blocked core journey, or a longitudinal transition that cannot complete.
- Medium: materially confusing extraction, irrelevant repetition, misleading prioritization, or avoidable re-entry.
- Low: copy, visual, or minor interaction friction with a clear workaround.

Check automatic-Red rules separately from severity.

- [ ] **Step 4: Commit only changed run records**

```bash
git diff --check
git add docs/qa/ladder-personas/runs/
git commit -m "test: confirm Ladder persona findings"
```

If every run already contains a complete rerun and no file changes, do not create an empty commit.

---

### Task 16: Run F02 and L03 production smoke checks

**Files:**
- Create: `docs/qa/ladder-personas/runs/2026-07-29-production-smoke.md`
- Create local evidence: `test-results/ladder-personas/2026-07-29/production-F02/`
- Create local evidence: `test-results/ladder-personas/2026-07-29/production-L03/`

**Interfaces:**
- Consumes: confirmed local F02 and L03 procedures.
- Produces: deployment-drift record kept separate from authoritative local findings.

- [ ] **Step 1: Repeat F02 on production**

Use a fresh production browser context. Set Spanish through `/today`, run F02 exactly, and capture Spanish entry, facts/domains, local POE order, countdown copy, consent-share result, and safety state.

Do not send real data and do not use a passcode or live-provider mode.

- [ ] **Step 2: Repeat L03 on production**

Use a separate fresh production context. Run the full L03 booking, earlier-slot replacement, two barriers across bookings, missed visit, rebook, and reload path.

Capture the final appointment state and all differences from local behavior.

- [ ] **Step 3: Classify differences**

For each difference, record local outcome, production outcome, exact URL, observation time, evidence, and whether it is deployment drift, browser variance, or non-reproducing.

- [ ] **Step 4: Commit the smoke record**

```bash
git add docs/qa/ladder-personas/runs/2026-07-29-production-smoke.md
git commit -m "test: record Ladder production persona smoke"
```

---

### Task 17: Synthesize, verify, and commit the final report

**Files:**
- Create: `docs/qa/ladder-personas/2026-07-29-results.md`
- Modify: `docs/superpowers/sprints/2026-07-29-ladder-persona-stress-test-sprint.md`

**Interfaces:**
- Consumes: baseline, 12 local run records, production smoke record, and evidence index.
- Produces: the completed user-facing stress-test package and closed sprint state.

- [ ] **Step 1: Build the journey ledger and aggregate score**

Create one table row per F01–F08 and L01–L04 with:

- family/county;
- journey type;
- score numerator and denominator;
- percentage;
- Green/Amber/Red band;
- automatic-Red reason or `none`;
- highest-severity confirmed finding;
- run-record link;
- decisive evidence link.

Compute percentages from applicable dimensions only. Do not average ordinal category labels. Report both the mean journey percentage and count of Green, Amber, and Red cases.

- [ ] **Step 2: Build the final report sections**

Write, in this order:

1. executive summary;
2. what Ladder handled well;
3. where families struggled;
4. journey ledger;
5. approved coverage matrix with actual completion state;
6. confirmed findings sorted Critical → High → Medium → Low;
7. exact reproduction steps and recommended fix direction for each finding;
8. catalog gaps;
9. expected demo limitations;
10. deployment drift;
11. test-environment limitations;
12. voice/transcript limitation;
13. methodology and scoring;
14. evidence index;
15. completion-criteria checklist.

Give each finding a stable ID `LADDER-PERSONA-001`, incremented by severity then case order.

- [ ] **Step 3: Verify completion mechanically**

Run:

```bash
test "$(rg -l "^# (F|L)[0-9]{2}" docs/qa/ladder-personas/runs/2026-07-29-*.md | wc -l)" -eq 12
rg -n "LADDER-PERSONA-[0-9]{3}" docs/qa/ladder-personas/2026-07-29-results.md
if rg -n -i "HEALTH_AI_API_KEY\s*=|sk-[A-Za-z0-9]{20,}" docs/qa/ladder-personas; then exit 1; fi
git diff --check
npm run check
npm run crisis:gate
```

Expected:

- exactly 12 family run files;
- every confirmed finding appears in the final report;
- no key name with a value and no secret-like token appears;
- whitespace check passes;
- full project check passes;
- crisis gate passes.

Review every screenshot before linking it. Confirm every longitudinal run has at least two reload checkpoints and every suspected defect has a rerun.

- [ ] **Step 4: Close the sprint state**

Update the sprint file:

- Phase 3 remains done and spec approved;
- Phase 4 is done;
- Plan path is `docs/superpowers/plans/2026-07-29-ladder-persona-stress-test.md`;
- execution status is complete;
- final report path is `docs/qa/ladder-personas/2026-07-29-results.md`;
- Next Action says to review findings and choose any fix scope.

- [ ] **Step 5: Commit the final package**

```bash
git status --short
git add docs/qa/ladder-personas/2026-07-29-results.md
git add docs/superpowers/sprints/2026-07-29-ladder-persona-stress-test-sprint.md
git commit -m "test: report Ladder persona stress results"
git status --short
```

Expected: report and sprint closure committed; ignored screenshots remain local; no application changes; working tree otherwise clean.

---

## Execution Notes

- Use existing stable selectors and behaviors from `e2e/family-navigator.spec.ts`, `src/components/family-experience.tsx`, `src/components/family-resource-card.tsx`, and `src/components/family-appointment-card.tsx`.
- Inspect `localStorage["home-health-ai-ownership-state"]` after decisive actions; screenshots alone cannot prove absence, ordering history, or state isolation.
- When the product asks up to two dynamic orientation follow-ups, answer naturally from the card without adding a new need that would invalidate the oracle.
- A resource may appear in either matched or fallback sections. Record both placement and visible rationale before scoring.
- The deterministic extractor does not emit `diagnosis_education`; F03 measures the resulting gap rather than expecting nonexistent behavior.
- Existing-therapy wording activates the `therapies` keyword path; F06 determines whether the UI distinguishes an existing service from a new unmet need.
- Time controls modify saved demo state, not real time. Never present them as production caregiver features.
- If a required UI control is absent, capture that absence, rerun once, score the affected dimension, and continue to the next safe checkpoint instead of altering storage manually.
