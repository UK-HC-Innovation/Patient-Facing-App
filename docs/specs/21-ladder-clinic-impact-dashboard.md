# Ladder Clinic Impact Dashboard — Synthetic, On-Device Demo

> A clinic-facing measurement surface for the three UKHCI Ladder measures already agreed in specs 09 and 13: family engagement, evaluation-visit no-show/follow-through, and the one-question patient-experience pulse. This is a dashboard of invented cohort rows, not a clinic worklist or production analytics system.

**Status:** Implemented 2026-08-06. Verification evidence is recorded in [Implementation Notes](#implementation-notes-2026-08-06). Extends spec 13's family-journey event substrate and closes spec 20's named next-feature item. Route: `/ladder/impact`.

## Problem

Ladder already stores the dated records needed to define the pilot measures: interviews and check-ins, saved resources and step updates, appointment states, reminder acknowledgements, flags, and experience pulses. The patient-side demo can show each behavior, but UKHCI has no single surface that answers the clinic question: “If we ran this as a pilot, what would we measure and what exactly would each denominator contain?”

The dashboard must prove that measurement contract without implying a live multi-family data system. The current app has one browser-local family record, no accounts, no tenant boundary, no EHR or scheduling feed, and no HIPAA-grade analytics store. Therefore spec 21 uses a frozen synthetic cohort compiled with the app and computes every card on-device.

## Audience and decision

Primary audience: UKHCI clinical, operational, and evaluation stakeholders reviewing a possible Ladder pilot.

The default view should let that audience verify three things without interaction:

1. the outcome definition;
2. the numerator and denominator behind the displayed percentage; and
3. what is excluded or unavailable in the demo.

It does not support patient lookup, outreach, queue management, drill-through to family details, or live monitoring.

## Goals

- Render the three agreed measures from the same typed `FamilyNavigatorState` records that drive the family journey.
- Keep all calculations deterministic, on-device, and separately testable from presentation.
- Put the numerator and denominator next to every headline rate.
- Treat no denominator as “Not enough data,” never `0%`.
- Show pending and replaced appointments as coverage context, not completed/missed outcomes.
- Make “demo only,” “synthetic,” “on-device,” the frozen as-of date, and the absence of real integrations visible without opening a disclosure.
- Give stakeholder demos a discoverable link from `/demo`.

## Non-goals

- Real family or patient data.
- A clinic worklist, family-level drill-down, alerts, outreach, or operational action.
- Backend ingestion, accounts, authentication, authorization, cross-device aggregation, EHR/FHIR, scheduling, or analytics telemetry.
- Claims of causality, effectiveness, statistical confidence, or comparison with a real baseline.
- Replacing the evaluation protocol and owners required by `docs/ops/demo-to-pilot-release-gates.md`.

## Metric contract

All rates are point-in-time results as of the dashboard's visible `asOf` timestamp. Events after that timestamp are ignored.

### 1. 30-day engagement

**Question:** Did an eligible family use at least one meaningful Ladder journey action in the trailing 30 days?

- **Numerator:** included synthetic families with at least one dated family-journey touch between `asOf - 30 days` and `asOf`, inclusive.
- **Denominator:** synthetic cohort rows enrolled by `asOf` with a family profile.
- **Touch substrate:** the existing selector's timestamps from interviews/check-ins, step updates, pulses, flags raised/acknowledged, saved resources, appointment creation/reminder acknowledgements, and the check-in touch stamp.
- **Reference:** at least 50%, inherited from spec 13's agreed UKHCI measure.
- **Display context:** total dated touches is supporting volume, not the family-level numerator.
- **Excluded:** future enrollments, rows without a profile, invalid timestamps, and activity after `asOf`.

### 2. Evaluation-visit follow-through and no-show

**Question:** Of visits with a known self-reported outcome, what share completed and what share were missed?

- **Outcome denominator:** appointments whose stored status is `completed` or `missed`.
- **Follow-through numerator:** `completed` outcomes.
- **No-show numerator:** `missed` outcomes.
- **Reference:** no-show at or below 25%, inherited from spec 13's agreed UKHCI measure.
- **Coverage context, excluded from the outcome denominator:** `offered`, `booked`, and `confirmed` are pending; `replaced` is an earlier time returned to the clinic, not a visit outcome.
- **Evidence label:** both terminal states are family self-reports in this demo. There is no scheduler or clinic confirmation feed.

Follow-through and no-show are complements over the same denominator. The UI shows both so a favorable framing cannot hide missed visits.

### 3. Patient-experience pulse

**Question:** What share of optional monthly support pulses were positive?

- **Numerator:** scored pulses with score 4 or 5.
- **Denominator:** all scored pulses 1–5 at or before `asOf`.
- **Unit:** pulse responses, not unique families; a family may contribute more than one month.
- **Supporting coverage:** unique responding-family count and the full 1–5 distribution.
- **Excluded:** skips, because no score is stored; future-dated pulses.

This is the definition agreed in spec 13: patient experience = percentage of pulses scoring 4–5 during the wait.

## Data and architecture

- `src/domain/family-journey.ts` owns the existing touch substrate and adds the bounded `familyTouchesInWindow` plus `familyEngagement` summary promised in spec 13.
- `src/domain/family-impact.ts` owns cohort eligibility, denominator rules, point-in-time filtering, and the three metric results.
- `src/domain/family-impact-fixtures.ts` owns the frozen invented cohort and visible as-of time. It is deliberately separate from caregiver fixtures and contains no real family or clinic identity.
- `src/components/family-impact-dashboard.tsx` renders summary cards, denominator-aware comparison bars, distribution, exclusions, and limitations.
- `src/components/family-impact-dashboard-demo.tsx` bundles the fixture and pure selector into a small client boundary, so the browser computes the snapshot literally on-device.
- `src/app/ladder/impact/page.tsx` supplies static route metadata and mounts that client boundary. There is no fetch, API route, persistence read/write, cookie, analytics SDK, or data-network dependency.

The fixture is intentionally small and legible: 12 eligible families, 7 engaged in the window, 8 terminal visit outcomes, and 10 scored pulses. Its job is to exercise the contracts and empty states, not simulate statistical evidence.

## Layout and visual contract

1. UKHCI Ladder header with a persistent “Demo only · synthetic · on-device” badge and frozen snapshot date.
2. Three hero cards: engagement, visit follow-through, and positive experience pulse. Each card shows percentage, numerator/denominator, and the key exclusion/reference note.
3. A 30-day engagement bar with a visible 50% reference marker.
4. A stacked completed/missed outcome bar with direct count and percentage labels. Color is not the only distinction.
5. A five-row pulse distribution with exact counts.
6. A visible limitations panel: the fixture proves definitions and layout only; it cannot establish impact or causality.

No time-series chart is included: one frozen fixture has no honest 8–12 period trend. No family table is included: exact person-level lookup is neither needed nor appropriate for this demo.

## Empty states

- Engagement denominator `0`: “Not enough data” plus “No eligible synthetic family records are available for this window.”
- Visit outcome denominator `0`: “Not enough data” plus a statement that pending/replaced appointments are not outcomes.
- Pulse denominator `0`: “Not enough data” plus a statement that skipped check-ins are excluded.
- The dashboard never formats a null rate as `0%`.

## Safety, privacy, and pilot boundary

- The dashboard contains aggregated invented data only and no child-level detail.
- It does not read the browser's saved family record, so a caregiver's on-device notes cannot appear in the clinic demo by accident.
- It sends nothing to a server or external model.
- It is not a clinical queue and offers no action that could imply monitoring or a response promise.
- Real cohort reporting remains no-go until proxy consent/minors governance, a secure tenant-isolated backend, actor-bearing audit, clinic operations ownership, and an approved evaluation protocol have named owners and release evidence.

## Acceptance criteria

- **FR-1:** `/ladder/impact` renders all three agreed measures from the synthetic cohort through pure selectors.
- **FR-2:** Each rate displays its numerator and denominator; visit follow-through and no-show share the same outcome denominator.
- **FR-3:** The fixture reconciles to 7/12 engagement (58%), 6/8 visit follow-through (75%), 2/8 no-show (25%), and 8/10 positive pulses (80%).
- **FR-4:** Future events/enrollments, missing profiles, pending visits, replaced appointments, and pulse skips follow the exclusions above.
- **FR-5:** Every zero denominator displays “Not enough data” and a metric-specific explanation; no `0%` is shown.
- **FR-6:** Demo-only, synthetic, on-device, frozen-date, no-integration, and no-causality language is visible on the default view.
- **FR-7:** The synthetic dashboard does not read/write localStorage, call an API, add a free-text surface, or touch the crisis pathway.
- **FR-8:** Focused selector and component tests pass, followed by `npm run check` and `npm run crisis:gate` unchanged.

## Implementation Notes (2026-08-06)

- Implemented the pure family-engagement seam and bounded point-in-time window.
- Added the frozen 12-row synthetic cohort and denominator-tested impact selector.
- Added the clinic dashboard route, accessible cards/bars/distribution, honest empty states, and the `/demo` entry link.
- Added focused unit/component tests for reconciliation, exclusions, empty denominators, visible limitations, and route discoverability.
- Verification: focused Vitest run **50 passed** across 4 files; Playwright route smoke **2 passed** (desktop Chromium + Pixel 7); `npm run check` **green** (209 files passed / 1 skipped; 3006 tests passed / 1 skipped; production build compiled and statically prerendered `/ladder/impact`); `npm run crisis:gate` **PASS unchanged** (7 files, 334 tests, deterministic recall 1.00, false positives 0). The first full-check attempt hit timeout failures while another repository was running a high-parallel Vitest/Prisma job on the same machine; all 33 timed-out tests passed in isolation, and the uncontended full command then passed.
- No push or deployment performed.
