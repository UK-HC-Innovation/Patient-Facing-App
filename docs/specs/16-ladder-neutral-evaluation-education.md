# Ladder Wave 3 — neutral evaluation education

**Status:** complete; validated 2026-08-03
**Date:** 2026-08-03
**Source:** the remaining catalog/capability gap in the 2026-07-29 Ladder persona ledger and the fresh 2026-08-03 Wave 2 validation

## Purpose

Close the one remaining Ladder capability gap without inferring or suggesting a diagnosis. When a caregiver explicitly asks for neutral help understanding whether an evaluation, screening, or therapy consultation makes sense, Ladder should preserve that ask as `diagnosis_education` and show checked, non-diagnostic education alongside any service route already supported by the caregiver's words.

F03 is the anchor: the caregiver reports observable social, sensory, and language concerns, says the child has no diagnosis, asks whether speech/occupational therapy and a developmental evaluation make sense, and explicitly asks the app not to apply a label. Today Ladder keeps the therapy route but does not emit the neutral education domain.

## Contract

### 1. Deterministic education intent

The deterministic interview extractor may add `diagnosis_education` only when the caregiver explicitly asks to understand evaluation choices, developmental screening, what an evaluation does, or how to discuss uncertainty without a label. The result is an information need, never a clinical conclusion.

Positive examples include:

- “I want evidence about whether therapy and a developmental evaluation make sense.”
- “What does a developmental evaluation look at?”
- “She has no diagnosis; I want to understand the options without labeling her.”

Concern words alone do not activate the domain. A named condition framed as a worry, internet search, family speculation, or school concern remains a concern and does not become a reported diagnosis.

### 2. Additive domain behavior

`diagnosis_education` is additive. It does not replace `therapies`, `early_intervention`, `school_iep`, or another supported active domain. Monthly check-ins preserve it under the existing merge rules; ordinary notes follow the existing replacement/retraction contract. No persisted type or storage migration is required because the domain already exists in `DevNeedDomain` and current guards.

### 3. Neutral, checked content

The education route reuses the verified guide and resource catalogs. It may explain:

- the difference between developmental screening, school evaluation, therapy evaluation, and a focused developmental consultation;
- that an evaluation gathers information and does not itself force a diagnosis or service;
- what observations or records a caregiver can bring;
- that eligibility and referral rules belong to the named program or school system.

Copy must not name a likely condition, assign probability, recommend a diagnosis, or say that a child “shows signs of” a condition. Diagnosis-specific organizations remain gated by a saved or caregiver-reported diagnosis. Developmental Pediatrics remains gated by the Wave 2 contract: explicit developmental-evaluation intent or a supported developmental diagnosis; a dyslexia-only school request is not a basis.

### 4. Ranking and action attribution

The education domain may add eligible neutral guides/resources to the existing structured candidate pool, but it cannot restore a candidate rejected by Wave 2 eligibility rules. Direct service asks continue to outrank generic education. An action on a multi-domain resource uses the direct service domain when present; otherwise it may persist under `diagnosis_education`.

The eight-card primary cap, county-before-statewide ordering, enrolled-card visibility, locality copy, and optional nearby-recreation separation remain unchanged.

### 5. Safety and provenance

- No new free-text surface, crisis phrase, safety tier, or provider bypass.
- The caregiver's exact words remain the source; no synthetic diagnosis fact is created.
- Live extraction may return the existing domain only when its rationale is grounded in the submitted text and passes the existing diagnosis lint.
- English and Spanish rationale/copy keys must remain in parity.

## Acceptance tests

1. Exact F03 deterministic opening emits `therapies` and `diagnosis_education`, no reported-diagnosis fact, and no invented condition wording.
2. “She has no diagnosis” by itself does not emit `diagnosis_education`.
3. Dyslexia/ADHD concern without a reported diagnosis keeps the school-evaluation route and does not unlock diagnosis-specific organizations or Developmental Pediatrics.
4. A saved autism diagnosis still uses the real profile label rather than its generated UUID for diagnosis-specific eligibility.
5. F03 renders neutral checked education plus OCSHCN/Developmental Pediatrics, at most eight primary cards, and completes its intended save action on desktop and mobile.
6. Spanish equivalents preserve the same no-label boundary and string-key parity.
7. `npm run check`, `npm run crisis:gate`, and the exact persona browser cohort pass.

## Non-goals

- No diagnosis inference, likelihood estimate, symptom checker, or model-generated differential.
- No new diagnosis-specific catalog entries or relaxation of source verification.
- No screening-instrument recommendation engine.
- No persistence, account, notification, API, or deployment work.
- No change to historical 2026-07-29 scores; a dated validation report owns new evidence.

## Implementation evidence

The implementation adds a narrow bilingual deterministic education-intent rule,
applies the same rule when reconciling live provider output, preserves direct
service domains and action attribution, and fills the checked-guide strip from
additive domains. It does not add a fact, diagnosis, persisted type, resource,
or free-text surface.

Validation is recorded in
[the 2026-08-03 Wave 3 report](../qa/ladder-personas/2026-08-03-wave3-validation.md).
