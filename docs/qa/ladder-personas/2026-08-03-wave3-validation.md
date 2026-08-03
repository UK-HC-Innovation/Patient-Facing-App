# Ladder Wave 3 validation — 2026-08-03

## Result

**PASS.** The neutral evaluation-education capability is implemented without
relaxing the no-diagnosis boundary or the Wave 2 resource eligibility gates.

## Acceptance evidence

- Exact F03 emits `therapies` and additive `diagnosis_education`, creates no
  reported-diagnosis fact, keeps OCSHCN and Developmental Pediatrics first, and
  attributes the multi-domain service action to `therapies`.
- “She has no diagnosis” alone, a possible-autism concern, and the L03
  dyslexia/ADHD pending-school-evaluation narrative do not emit neutral
  education intent.
- English evaluation questions, English no-label options, and Spanish neutral
  evaluation wording emit the same domain with localized non-diagnostic copy.
- Ungrounded live-provider `diagnosis_education` output is removed during local
  reconciliation.
- The direct therapy guide remains first and checked neutral education fills the
  second guide slot. F03 renders that checked education on desktop and mobile.
- Diagnosis-specific organizations, waiver eligibility, the eight-card cap,
  locality copy, enrollment behavior, and the existing crisis seam remain under
  their Wave 2 contracts.

## Verification

```text
npm audit --audit-level=high
PASS — 0 vulnerabilities

npm run check
PASS — lint clean; 2,730 unit tests passed, 1 opt-in live-provider test skipped;
production build completed on Next.js 15.5.22

npm run crisis:gate
PASS — deterministic recall 1.00; false positives 0

PLAYWRIGHT_PORT=3221 npx playwright test \
  e2e/ladder-persona-routing.spec.ts e2e/family-navigator.spec.ts --workers=1
PASS — 51 passed, 1 intentional desktop duplicate skipped across Chromium and
Pixel 7; all 24 persona executions passed (12 personas × 2 viewports)
```

## Release boundary

This closes the bounded demo capability. It does not authorize real-patient use.
The separate [demo-to-pilot release gates](../../ops/demo-to-pilot-release-gates.md)
remain no-go conditions for a clinical pilot.
