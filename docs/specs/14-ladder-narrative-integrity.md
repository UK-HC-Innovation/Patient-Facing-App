# Ladder Narrative Integrity — Evidence, Service Status, and Check-in Continuity

**Status:** Wave 1 implemented and verified as of 2026-07-31. This is the first delivery wave in the approved four-wave Ladder persona-fix program. Waves 2–4 remain open.

## Purpose

Ladder must turn a caregiver's narrative into an accurate, durable account of the child's needs without confusing:

- the child's experience with the caregiver's own accessibility needs;
- services already in place with services the family still needs;
- a professional recommendation with the caregiver's direct observation;
- concern about a possible condition with a reported diagnosis; or
- a monthly update with a replacement for the family's established needs.

This wave fixes five reproducible product defects:

| Finding | Failure to correct |
| --- | --- |
| LADDER-PERSONA-003 / F01 | The speech fact cites the doctor's therapy recommendation instead of Theo saying “mama and no.” |
| LADDER-PERSONA-008 / F06 | Current speech and occupational therapy become a new unmet therapy need. |
| LADDER-PERSONA-009 / F06 | “Reading long pages is hard for me” becomes Sam's school need. |
| LADDER-PERSONA-013 / L01 | A positive monthly speech update adds a false `therapies` need and replaces established `school_iep,parent_support` state with `therapies,school_iep`. |
| LADDER-PERSONA-016 / L03 | Grade and a general school fact displace the functional burden and pending evaluation. |

It also corrects LADDER-PERSONA-011. Preserved F07 screenshot evidence shows that “Have you applied for any state programs yet?” was visible under the accessible “Question 1 of 2” heading. The runner looked for a nonexistent `data-testid` and reported a product defect that did not occur.

## Program Context

This specification does not attempt to close the entire remaining persona backlog at once. The approved dependency order is:

1. Narrative integrity and durable check-in state — this specification.
2. Structured intent, resource eligibility, ranking, result limits, and action attribution.
3. County/statewide reach and “why shown” transparency.
4. A fresh deterministic run of all 12 personas, corrected findings and scores, complete gates, and final branch review.

Wave 1 deliberately supplies trustworthy evidence for Wave 2. It may improve downstream findings such as F06 result volume and L03 ranking, but those findings remain open until their resource-order contracts pass.

## Goals

1. Select the most relevant literal caregiver evidence for every extracted child concern.
2. Distinguish current, historical, recommended, requested, unavailable, and insufficient services.
3. Prevent caregiver self-description from becoming a child clinical or school fact.
4. Preserve concrete functional burden and pending-evaluation status without inventing a diagnosis.
5. Make a monthly check-in additive to established needs while preserving screen-based retraction for the eight screen domains and ordinary-note replacement for the remaining domains.
6. Apply the same local grounding rules to deterministic and live extraction.
7. Correct the F07 QA record and protect the accessible follow-up behavior with a regression test.
8. Preserve crisis behavior, diagnosis protections, literal-source provenance, Spanish parity, and current storage compatibility.

## Non-Goals

- Resource eligibility, ordering, candidate caps, or action-domain attribution.
- Neutral diagnosis-education content or its resource gating.
- County/statewide service-area labels or explanation copy.
- A persistent caregiver accessibility profile or a new reading-level preference field. The raw narrative remains available as conversation context, but this wave only prevents misattribution to the child.
- A new structured “current services” fact. Existing services remain available in the saved raw interview but do not become an unmet-need fact in this wave.
- A new clinical status, diagnosis, crisis tier, API route, database, dependency, or free-text surface.
- Rewriting old interview facts already stored on a device.

## Design Principles

1. **“From your words” always means literal.** Every locally selected fact uses a nonempty substring of the caregiver transcript. A safe live fact with a nonliteral snippet may retain the existing `inferred` status, but it cannot displace stronger local evidence or be presented as patient-reported.
2. **Direct observation outranks recommendation.** “He says mama and no” is stronger evidence for a speech fact than “his doctor said therapy could help.”
3. **Current service and positive progress are context, not unmet needs.** They become actionable only when the narrative also says support is insufficient, lost, unavailable, recommended, requested, or still needed.
4. **Actor checks are concern-specific.** Caregiver self-description is excluded from child school, speech, behavior, motor, diagnosis, and evaluation facts. It must not disable valid family-level respite, transportation, parent-support, or sibling-support routes.
5. **Uncertainty never becomes diagnosis.** Concern about dyslexia, ADHD, autism, or another condition remains a concern unless the existing explicit-diagnosis contract is satisfied.
6. **Local rules are authoritative for known contradictions.** A live model cannot reinstate a fact or domain that the local actor/service analysis proves is unsupported.
7. **Precision changes are narrow.** When local analysis has no recognized evidence either way, existing safe live output is not discarded merely because a new regular expression lacks recall.

## Architecture

### 1. Transient narrative analysis

`src/domain/family-interview.ts` gains a pure, deterministic analysis seam over the existing literal sentence splitter. It may use private supporting types equivalent to:

```ts
type NarrativeActor = "child" | "caregiver" | "clinician" | "unclear";
type ServiceStatus =
  | "current"
  | "historical"
  | "recommended"
  | "requested"
  | "unavailable"
  | "insufficient"
  | "none";
type EvidenceRole =
  | "observation"
  | "functional_burden"
  | "pending_evaluation"
  | "reported_diagnosis"
  | "professional_recommendation"
  | "caregiver_accessibility"
  | "positive_change";
```

These annotations are computation-only. They are not exported through the interview schema and are never persisted.

The analyzer must:

- preserve exact source offsets while splitting sentences and relevant clauses;
- support English and Spanish patterns for every newly introduced rule;
- recognize `say` and `says` as speech evidence;
- recognize child observations, functional burden, and waiting/pending evaluation language;
- distinguish a positive-only change such as “using more words” from a new unmet speech need, while allowing an explicit continuing difficulty or request to override that positive direction;
- recognize bounded current-service phrases such as “already goes to,” “currently receives,” and their Spanish equivalents;
- let insufficiency, access loss, replacement, or new-request language override a current-service phrase;
- recognize bounded caregiver self-limitation phrases such as “hard for me” without suppressing valid first-person requests made on behalf of the child; and
- leave the existing high-precision regression-cue logic unchanged.

The implementation must not use a global “first person means caregiver-only” rule. “I need help finding his therapy” and “I do not drive” remain valid family needs even though they use first person.

### 2. Evidence eligibility and selection

For each targeted concern/domain, local analysis returns one of three support states:

- **supported** — at least one eligible child/family need is present;
- **excluded-only** — relevant words occur, but every occurrence is a current service without a gap, positive-only change, caregiver self-description, or otherwise wrong actor/status; or
- **absent** — the analyzer found no relevant signal.

`excluded-only` is the narrow state that authorizes removing contradictory live output. `absent` does not.

Eligible fact candidates are selected by stable priority:

1. acquired-skill regression, using the unchanged regression detector;
2. direct functional burden or pending-evaluation status;
3. direct child observation;
4. other caregiver-reported concern;
5. professional recommendation.

Ties retain source order. Grade and explicit reported diagnosis remain separately extracted. The concern-detail budget remains bounded at two so the review card does not grow without limit, but two facts may now come from the same broad category when they carry different material information. For L03 this means:

- a functional-impact fact sourced to the literal “Reading and homework take hours”; and
- an evaluation-status fact sourced to the literal “we are waiting for an evaluation.”

New fact labels and values, if needed to distinguish those roles, ship together in English and Spanish through `src/i18n/family-strings.ts`. No new persisted fields are required.

### 3. Shared result reconciliation

`sanitizeResult` in `src/components/family-interview.tsx` remains the single client boundary used by both the initial interview and orientation follow-up rounds. Its reconciliation inputs expand to include `language` and an injectable `now` so English/Spanish rules and age-sensitive early-intervention behavior are identical on deterministic and live paths. Both call sites already own the selected language and can supply the current time.

The boundary invokes local evidence reconciliation and then passes the complete reconciled result through the existing diagnosis-fact, unsafe-rationale, and unsafe-follow-up guards. Locally merged content cannot bypass those final guards.

Reconciliation behavior:

- merge locally supported facts/domains into either deterministic or live output;
- replace a lower-quality targeted fact with the higher-quality local literal snippet;
- remove every live fact mapped to a targeted concern whose raw-text support state is `excluded-only`, even if the provider supplied a fabricated or nonliteral snippet. Target mapping may use the fact's label, value, and source text; the provider's invented snippet cannot override the submitted narrative;
- remove `therapies`, `school_iep`, and dependent `early_intervention` live domains only when their local support state is `excluded-only`;
- retain unrelated safe live facts/domains only when their target's local support is `absent`, preserving the existing `inferred` status for any nonliteral live snippet;
- deduplicate facts and domains stably; and
- when an `excluded-only` correction removes a live fact or domain, replace the live follow-up set with deterministic follow-ups built from the final reconciled domains, then apply the existing follow-up sanitizer and maximum-round behavior.

The deterministic extractor uses the same analysis directly, making reconciliation idempotent on fallback output. There is no provider prompt-only fix and no difference in correctness based on API availability.

### 4. Check-in domain continuity

The `addFamilyInterview` reducer branch in `src/state/store.tsx` will use `FamilyInterview.kind`:

- `orientation` and ordinary `note` submissions retain the current replacement contract because their extraction represents the current conversation;
- `checkin` submissions stably union newly extracted domains with `family.latestInterviewDomains`; and
- all kinds retain existing fact append/deduplication and recommendation invalidation.

When the family later submits a needs screen, an explicit `no` removes that matching carried interview domain at that point in time. `declined` does not retract it. A later interview can add the domain again if the family reports a new need.

Profile reconciliation must respect that chronology. A later profile edit may re-extract the latest interview for age/profile accuracy, but it cannot add a screen-retracted domain that is currently absent from `latestInterviewDomains`. If a genuinely later interview has already added the domain back, a subsequent profile edit preserves it. Required reducer coverage is:

1. interview domain present;
2. screen `no` removes it;
3. profile save does not resurrect it;
4. later interview re-adds it; and
5. another profile save preserves the later re-addition.

The needs screen covers eight domains. Its `no` answer is an explicit retraction path for those domains only. `future_planning`, `diagnosis_education`, and `recreation` have no corresponding screen row; they remain subject to the existing ordinary-note replacement behavior rather than a nonexistent screen control. A universal per-domain removal UI is outside this wave.

Any screen submission that changes or retracts active domains invalidates `family.recommendations`, just as a new interview does. Stale ranked lead, “what we heard” text, explanations, or guide selection cannot survive a domain change. The resulting `activeDomains` continues to be derived from screen answers plus the reconciled interview-domain set.

## Exact Behavioral Contracts

### F01 — direct speech evidence

Input:

> Theo is two. He says mama and no, but not much else, and he still falls a lot when he walks. His doctor said speech and physical therapy could help. I’m his grandmother and I don’t drive, so we need a ride to appointments. I need somebody to tell me who to call first.

Required:

- the exact domain set `early_intervention`, `therapies`, and `transportation`;
- the `About talking` source contains the literal “mama and no”;
- the doctor's recommendation is not the speech fact's source;
- no diagnosis, school, waiver, crisis, or regression state.

### F06 — current services and caregiver accessibility

Input:

> Sam is seven. He already goes to speech and occupational therapy. I need a break sometimes, his sister needs support too, and I’d like a sports or recreation program where they both feel welcome. Reading long pages is hard for me, so please keep it short.

Required:

- the exact domain set `respite`, `parent_support`, `sibling_support`, and `recreation`;
- no `therapies` domain or talking fact based only on current speech/OT;
- no `school_iep` domain or child school fact from the caregiver's reading statement;
- no diagnosis, crisis, or regression state.

Minimal-pair controls must prove that these still activate a therapy need:

- current therapy “is not enough”;
- the provider stopped or the service was lost;
- the family needs another therapist;
- therapy was recommended but has not started;
- the family requests therapy; and
- therapy is unavailable or inaccessible.

Historical-service controls must also prove:

- “He completed occupational therapy last year and does not need it now” and “She had speech therapy as a toddler” remain context-only; while
- “His therapist stopped coming and we still need OT” is an actionable lost-service need.

### L01 — additive monthly check-in

Starting state: `school_iep,parent_support`.

Monthly note:

> Este mes la maestra dice que las transiciones siguen siendo difíciles, pero Sofía está usando más palabras con una amiga.

Required:

- the positive speech change does not create a new unmet `therapies` domain;
- established `school_iep` and `parent_support` remain active, producing exactly those two active domains;
- an ordinary note continues to replace its latest-interview domain set;
- an explicit later screen `no` can retract its matching carried domain;
- `declined` cannot silently remove a need.

### L03 — functional burden and pending evaluation

Input:

> Maya is ten and in fifth grade. Her teacher and I are concerned about dyslexia and ADHD, but she has not been diagnosed. Reading and homework take hours, and we are waiting for an evaluation.

Required:

- grade, functional burden, and pending-evaluation facts are all retained;
- the two detail snippets are literal substrings of the input;
- the exact domain set is `school_iep`;
- no reported dyslexia or ADHD diagnosis is created.

### F07 — QA correction

Exact F07 deterministic orientation must expose this question by accessible heading:

> Have you applied for any state programs yet?

The test must query the rendered heading/text contract, not add or depend on a test-only product attribute.

The dated QA report and F07 run record must be amended to:

- classify LADDER-PERSONA-011 as a retracted QA false positive;
- change F07 D3 from 0 to 2 and F07 from `12/16` Amber to `14/16` Green;
- change the aggregate from `172/208` to `174/208` (`83.6538%`);
- change the unweighted mean from `82.1875%` to `83.2292%`;
- change the distribution from 6 Green / 4 Amber / 2 Red to 7 Green / 3 Amber / 2 Red; and
- change the historical confirmed product-defect count from 19 to 18. With the two High findings already fixed, 16 valid product defects remain open before Wave 1 implementation.

Every dependent F07 outcome, executive-summary, journey-ledger, coverage-matrix, finding-table, reproduction, methodology, and evidence-index reference must be corrected. LADDER-PERSONA-012 becomes F07's highest remaining product finding.

The 27-candidate taxonomy must continue to reconcile exactly:

- 19 product candidates = 18 confirmed defects plus 1 intermittent/non-reproducing candidate;
- 1 catalog/capability gap;
- 3 expected demo limitations; and
- 4 test-environment limitations, with the retracted F07 locator error retained here as a Medium-severity QA limitation.

The overall severity ledger remains 0 Critical, 2 High, 19 Medium, and 6 Low because LADDER-PERSONA-011 changes classification rather than severity. The original runner mistake, retired finding ID, and preserved screenshot remain documented so the correction is auditable.

Defect ledgers must distinguish historical audit findings from current open work:

- 18 historically valid confirmed product defects;
- 16 open immediately before Wave 1 because the two High findings are already fixed;
- 11 open after all five Wave 1 product contracts pass: 10 Medium (`004`, `005`, `006`, `007`, `010`, `012`, `014`, `015`, `017`, `018`) and 1 Low (`019`).

Only F07 is rescored in this wave because preserved evidence proves the original score was wrong. F01, F06, L01, and L03 keep their dated-run scores until the fresh 12-persona Wave 4 rerun, even after their individual finding dispositions change to resolved.

## Test Strategy

Implementation is test-first.

1. Add exact F01, F06, L01, L03, and F07 contracts before production changes and verify the relevant new assertions fail for the expected reasons. The F07 product behavior test is expected to pass immediately and documents the false-positive correction.
2. Add table-driven English and Spanish minimal pairs for actor, resolved-history/current/recommended/requested/unavailable/insufficient/lost service status, positive-only versus still-unmet change, functional burden, and pending evaluation.
3. Add adversarial English and Spanish live-result tests in `src/components/family-interview.test.tsx` proving:
   - F01 replaces a provider-selected doctor-recommendation speech snippet with the local “mama and no” evidence;
   - F06 removes current-service-only therapy and caregiver-only school facts, including fabricated nonliteral targeted snippets;
   - L01 positive-only speech removes an adversarial live therapy fact/domain;
   - L03 merges local functional-burden and pending-evaluation details into a shallow live result;
   - resolved historical “occupational therapy” removes an adversarial live therapy result, while lost still-needed therapy remains;
   - an unrecognized but safe unrelated live fact is not dropped;
   - a fixed `now` controls age-sensitive early-intervention output; and
   - removing a targeted live domain replaces its live follow-ups with deterministic follow-ups for the final domains.
4. Add reducer tests in `src/state/store.test.ts` for check-in union, ordinary-note replacement, explicit-no retraction, declined preservation, profile-save non-resurrection, later-interview re-addition, post-re-addition profile preservation, fact deduplication, and recommendation invalidation after either an interview or changed screen state.
5. Add the exact F07 deterministic Ladder-page regression in `src/app/ladder/page.test.tsx`, querying the follow-up through its accessible heading. Keep component-level follow-up tests green without introducing a test-only selector.
6. Update and mechanically validate the QA arithmetic, all dependent F07 references, candidate taxonomy, severity ledger, and finding disposition.
7. Run focused tests, the complete test/check pipeline, crisis gate, and deterministic navigator gate. The live navigator tier is run when provider credentials are configured; unavailable credentials are recorded explicitly and do not replace the deterministic gate.

Existing tests that merely encode the old defect must be strengthened or updated, not deleted or weakened.

## Failure and Safety Behavior

- Invalid or ambiguous model output continues through the current schema and safety sanitizers.
- A recognized wrong actor/status produces no child fact or unmet domain.
- A locally absent signal does not automatically erase otherwise safe live output.
- No classifier branch can create a diagnosis.
- Crisis disclosures continue through the existing family safety path unchanged and remain outside this non-crisis wave.
- Every locally selected snippet remains literal caregiver text. Safe nonliteral live snippets retain `inferred` status and generated explanations never become patient-reported evidence.
- Storage loading requires no backfill because no persisted type changes.

## Files Expected to Change

- `src/domain/family-interview.ts`
- `src/domain/family-interview.test.ts`
- `src/components/family-interview.tsx`
- `src/components/family-interview.test.tsx`
- `src/state/store.tsx`
- `src/state/store.test.ts`
- `src/domain/family-screen.ts` and `src/domain/family-screen.test.ts` if explicit-no retraction is factored there rather than locally in the reducer
- `src/app/ladder/page.test.tsx`
- `src/components/family-orientation-interview.test.tsx` only if shared follow-up behavior needs additional unit coverage
- `src/i18n/family-strings.ts` and relevant string tests if role-specific fact labels are introduced
- `docs/qa/ladder-personas/2026-07-29-results.md`
- `docs/qa/ladder-personas/runs/2026-07-29-F07.md`

The implementation plan may refine file placement after test-first inspection, but it may not weaken the behavioral contracts.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Broad actor filtering suppresses legitimate family requests | Apply actor exclusion only to child concern/evaluation facts; cover first-person requests and logistics with positive controls. |
| “Already in therapy” hides a real access problem | Insufficiency, loss, replacement, request, recommendation, and unavailability override current-service status; test each as a minimal pair. |
| Positive progress becomes a new unmet need | Treat improvement-only language as excluded evidence unless the same narrative also states a continuing difficulty or request. |
| Local rules reduce live-model recall | Remove live output only in the evidence-backed `excluded-only` state; preserve safe output when local status is merely `absent`. |
| Two-fact cap loses material detail | Rank evidence roles and permit two distinct facts from one broad category; grade/diagnosis stay outside that cap. |
| Check-ins accumulate stale needs forever | Preserve time-relative screen retraction for screen domains, ordinary-note replacement for all domains, and later narrative re-addition without allowing profile edits to resurrect retracted state. |
| English-only fixes regress Spanish | Every new lexical rule and user-facing label ships with Spanish parity and table-driven tests. |
| Correcting QA history obscures what happened | Preserve the runner error, screenshot evidence, original finding ID, and arithmetic correction as an auditable retraction. |

## Definition of Done

Wave 1 is complete only when:

- all five reproducible product contracts pass on the deterministic path;
- targeted contradictory live results are locally reconciled;
- screen retraction survives profile edits and a genuinely later interview can re-add the need;
- F07's false finding and every dependent score/count are corrected;
- no persisted schema migration is introduced;
- focused and full tests pass;
- `npm run check`, `npm run crisis:gate`, and the deterministic navigator gate pass;
- a fresh review finds no unresolved Wave 1 defect; and
- no claim is made that downstream matching/ranking findings are closed before Wave 2.

## Verification Evidence — 2026-07-31

- Focused Wave 1 regression suite: **875/875 tests passed across 7 files**.
- Deterministic navigator contract: **81/81 tests passed** in `src/domain/family-vignettes.test.ts`.
- Full `npm run check`: lint passed with no warnings or errors; Vitest reported **2,705 passed and 1 skipped tests across 191 passed and 1 skipped test files**; the production build generated **25/25 static pages**.
- `npm run crisis:gate`: **PASS**, with **310/310 tests passed across 6 files**, deterministic recall **1.00**, and **0 false positives**. The generated evidence is [the 2026-07-31 crisis-gate report](../ops/red-team-results/2026-07-31-crisis-gate.md).
- Live `npm run navigator:gate`: not run because `HEALTH_AI_API_KEY` was unavailable. The deterministic tier passed; this specification does not claim a live-provider pass.

No persisted schema migration, dependency addition, new crisis tier, resource-catalog expansion, or deployment is part of this wave. Resource eligibility, ranking, result caps, action attribution, county/statewide transparency, diagnosis education, and the fresh 12-persona rescore remain explicitly open for Waves 2–4.

## Independent Review Verdicts — 2026-07-31

- Specification compliance: **PASS** after removing a global resource-domain ordering normalization that exceeded Wave 1 scope. Matching, ranking, request domains, and guide selection again consume `family.activeDomains` directly.
- Code quality: **PASS** after binding asynchronous recommendation results to their interview, ordered domains, profile identity, language, and ordered candidate set, and after making ordered domain changes invalidate stale recommendations.

Both remediations passed a fresh review and the complete verification pipeline recorded above. A provisional suggestion to bind each opaque screen `questionId` to its domain was reviewed but not adopted: the domain is the modeled authority, existing persisted and test data permit non-catalog question IDs, and retraction-only validation would create an asymmetric compatibility change outside this wave. The final reviewer did not classify it as a remaining finding.
