# Ladder Wave 2 — structured resource routing

**Status:** implemented
**Date:** 2026-07-31
**Source:** `docs/superpowers/sprints/2026-07-30-ladder-remaining-persona-fixes-sprint.md` and the open Wave 1 ledger in `docs/qa/ladder-personas/2026-07-29-results.md`

## Purpose

Wave 1 repaired narrative integrity. Wave 2 does not reopen that work. It consumes the caregiver-attributed transcript, the saved profile, and the already-derived active domains, then makes resource selection more precise through a deterministic structured-intent layer.

This wave closes the eleven findings left open after Wave 1: LADDER-PERSONA-004, 005, 006, 007, 010, 012, 014, 015, 017, 018, and 019. It does not rescore the dated persona run and does not close the separate neutral diagnosis-education capability gap.

## Contracts

### 1. Structured intent

The client derives a non-persisted `StructuredFamilyIntent` from the latest caregiver transcript, profile, and active domains. The vocabulary is narrower than a diagnosis taxonomy and describes an ask or situation: early-intervention access, therapy access, transportation access, developmental evaluation, school evaluation, school removal, school-plan/behavior support, school dispute, waiver planning, supported decision-making, respite, sibling support, and recreation.

The structured intent is advisory for ranking and mandatory for the eligibility rules below. It does not add a diagnosis, change facts, change active domains, or replace Wave 1 source attribution.

### 2. Eligibility gating

- IDD/behavioral waivers require an active waiver/financial domain or an explicit waiver ask. The HCB waiver additionally requires a physical-disability basis.
- Developmental pediatrics requires an explicit developmental-evaluation ask or a supported developmental/diagnosis basis. A dyslexia-only school-evaluation request is not such a basis.
- School discipline guidance requires removal, suspension, expulsion, or send-home intent.
- FBA/BIP guidance requires school removal or school behavior-plan intent.
- Dispute-resolution guidance requires an actual dispute or an existing plan/meeting that is reported not to be working.
- Diagnosis-specific organizations require a matching saved or caregiver-reported diagnosis basis.

Catalog age and county rules remain the first eligibility floor. Model output can reorder eligible catalog IDs but cannot restore an ineligible ID.

### 3. Ranking

County-serving resources rank before statewide navigation. Within that boundary, direct asks outrank generic domain matches:

- school removal: IDEA discipline, then FBA/BIP, then dispute/escalation;
- school evaluation: written evaluation request, Parent Toolbox, KY-SPIN, then learning-disability support;
- supported decision-making: My Choice Kentucky first;
- transportation/therapy access: county-serving transportation, OCSHCN, then statewide navigation;
- sibling support: Sibling Support Project first;
- early intervention: county Point of Entry, statewide First Steps, transition guidance when age-eligible, then Help Me Grow.

Enrolled-resource sinking remains in force after intent scoring.

### 4. Result limits

The recommendation surface shows at most eight resource cards. Live and deterministic recommendations share that limit. Ranked results are filled from the eligible deterministic order when a provider returns fewer than eight usable IDs. Nearby recreation remains a separately labeled optional section and is not allowed to duplicate a primary card.

### 5. Locality transparency

Every primary resource card states either `Serves {county} County` or `Available statewide`, followed by the matched need that caused it to be shown. The existing honest empty state remains when no domain-specific county or statewide catalog entry matches. A county-serving result therefore cannot be visually indistinguishable from a statewide directory.

### 6. Action attribution

Save and plan actions use the match domain selected after structured-intent ranking. When an explicitly requested resource supports several domains, the direct intent wins (for example, Sibling Support Project persists as `sibling_support`, not `parent_support`). Resource IDs and existing action persistence shapes remain unchanged.

## Safety and preservation boundaries

- No changes to crisis classification, safety-event routing, or acknowledgement behavior.
- No changes to Wave 1 fact extraction, source snippets, caregiver/child subject handling, or monthly-domain merge semantics.
- No new diagnosis inference.
- No catalog invention and no relaxation of server/client catalog-ID validation.
- County-first routing, age filtering, stable resource IDs, persistence, and deterministic no-key behavior remain required.

## Verification

Focused regressions must cover all eleven Wave 2 IDs through the exact persona openings or an equivalent direct contract assertion. Required release checks are `npm run check` and `npm run crisis:gate`. The ledger records exact test counts, build output, and the crisis-gate report after the commands complete.

## Closeout addendum — 2026-08-03

A fresh desktop/mobile validation added exact browser coverage for all 12 approved persona openings, profiles, languages, resource contracts, locality labels, result caps, and intended actions. The combined Ladder browser run passed **51 applicable checks with one intentional duplicate skip**. Review also closed saved-diagnosis UUID handling, dyslexia-only Developmental Pediatrics gating, physical-disability basis handling for HCB, accented bilingual dispute intent, and enrolled-card visibility under the eight-card cap. See [the dated validation report](../qa/ladder-personas/2026-08-03-validation.md).

The separate neutral `diagnosis_education` capability remains outside Wave 2 and is specified in [Wave 3](16-ladder-neutral-evaluation-education.md).
