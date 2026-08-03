# Ladder Wave 2 validation — 2026-08-03

## Result

**PASS.** All 12 approved synthetic personas completed a fresh deterministic routing-and-action check on desktop Chromium and a Pixel 7 viewport. The exact cohort openings, real profile fields, and Spanish/code-switched variants were used.

This is a fresh acceptance validation of the Wave 1–2 remediation contracts. It is not represented as a second manual run of every subjective D1–D10 scoring dimension from 2026-07-29, so the historical July arithmetic remains unchanged in its dated report.

## Browser evidence

Command:

```powershell
$env:PLAYWRIGHT_PORT='3221'
npx playwright test e2e/ladder-persona-routing.spec.ts e2e/family-navigator.spec.ts --workers=1
```

Result: **51 passed, 1 skipped** across desktop Chromium and Pixel 7. The skip is intentional: the Spanish horizontal-containment check is mobile-specific and therefore skips its duplicate desktop execution.

- `e2e/ladder-persona-routing.spec.ts`: **24/24 passed** — 12 exact personas × 2 viewports.
- `e2e/family-navigator.spec.ts`: **27/27 applicable checks passed** plus the one intentional duplicate skip.
- The run used a dedicated port and one worker so another checkout's concurrent dev server could not contaminate route or build evidence.

## Cohort disposition

| Case | Fresh acceptance status | Decisive Wave 2 evidence | Intended action |
| --- | --- | --- | --- |
| F01 | Green | Big Sandy First Steps first; unsupported waivers and Developmental Pediatrics absent | Big Sandy planned |
| F02 | Green | Kentuckiana Point of Entry first; statewide route retained; Spanish path | Kentuckiana saved and consent-shared |
| F03 | Green | OCSHCN then Developmental Pediatrics; unsupported waivers absent; no diagnosis invented | Developmental Pediatrics saved |
| F04 | Green | IDEA discipline, FBA/BIP, then dispute resolution for the code-switched removal narrative | IDEA discipline planned |
| F05 | Green | Evaluation request, Parent Toolbox, then KY-SPIN; discipline/dispute absent | Evaluation request saved |
| F06 | Green | Sibling Support Project first; eight-card cap; unsupported waivers absent | Sibling support planned under the correct domain |
| F07 | Green | My Choice Kentucky first; IDD waivers retained; HCB excluded without physical-disability basis | My Choice planned |
| F08 | Green | My Choice Kentucky first; ABLE retained; HCB excluded without physical-disability basis | My Choice saved |
| L01 | Green | Spanish school/parent route retained with Parent Toolbox and KY-SPIN | Parent Toolbox saved |
| L02 | Green | LKLP Region 13 county route first and visibly distinct from statewide navigation | Kentucky 211 planned |
| L03 | Green | Evaluation route first; discipline, dispute, Developmental Pediatrics absent | Evaluation request saved |
| L04 | Green | Kentucky River Point of Entry then statewide First Steps; unrelated specialty/waiver cards absent | Kentucky River planned |

Every primary card rendered county/statewide service-area copy and a matched-need explanation. Every persona rendered at most eight primary cards. The existing companion suite separately reverified save/share consent, enrollment sinking, notes, monthly check-ins, packet state, appointment replacement, reload persistence, safety banners, and mobile containment.

## Review findings closed during validation

1. Saved diagnoses were incorrectly compared by generated profile UUID instead of the diagnosis label. Real-form autism and intellectual-disability profiles now satisfy only their label-gated resources.
2. A dyslexia-only diagnosis could enter Developmental Pediatrics through the generic `diagnosis_education` domain. The resource now requires an explicit developmental-evaluation ask or a supported developmental diagnosis.
3. An `Other` diagnosis carrying a physical-disability basis was ignored for HCB eligibility. Verified physical-disability wording is now recognized without broadening IDD-waiver eligibility.
4. The code-switched phrase `el plan no está working` missed dispute intent because JavaScript word boundaries do not surround accented `á`. The bilingual matcher now covers that exact cohort wording and Spanish `funciona` variants.
5. Marking a visible card as already enrolled could sink it beyond the eight-card cap before its confirmation rendered. Enrolled cards now remain visible at the tail of the capped surface with urgency suppressed.

All five have focused regression coverage and passed the fresh browser cohort.

## Remaining capability gap

The deterministic interview extractor still does not emit neutral `diagnosis_education` intent for F03's explicit request to understand evaluation choices without labeling the child. This is not a reopened Wave 2 resource-routing defect. It is bounded separately in [Ladder Wave 3 — neutral evaluation education](../../specs/16-ladder-neutral-evaluation-education.md).
