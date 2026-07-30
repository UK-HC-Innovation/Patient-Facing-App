# F02 and L03 production smoke — 2026-07-30

## Scope and authority

This is a production smoke comparison against the authoritative local records
`2026-07-29-F02.md` and `2026-07-29-L03.md`. The production observations do not
replace or rescore either local outcome.

- Production target: `https://patient-centered.vercel.app`
- F02 URLs: `https://patient-centered.vercel.app/today` and
  `https://patient-centered.vercel.app/ladder`
- L03 URL: `https://patient-centered.vercel.app/ladder`
- F02 observation: Thursday, July 30, 2026, 7:36:10–7:36:17 AM EDT
  (`America/New_York`)
- L03 final observation: Thursday, July 30, 2026, 7:39:54–7:40:04 AM EDT
  (`America/New_York`)
- Browser: standalone Playwright Chromium; F02 used a 390 × 844 mobile viewport
  and L03 used a 1440 × 1000 desktop viewport.
- Isolation: F02 and L03 used separate new browser contexts. Each context began
  with no cookies or stored origins and used a one-time `sessionStorage` guard
  to clear site `localStorage` only on its first production document. Reloads
  retained that case's state.

## Deterministic client-side boundary

Before either family submitted text, the browser intercepted
`/api/family/interview` and `/api/family/recommend` and returned the same
deterministic `{ "mode": "unconfigured", "data": null }` response used by the
authoritative local journeys. F02 recorded four intercepted requests across its
opening and follow-up; L03 recorded two across its opening. No request reached
the production family endpoint handler or an external AI provider.

No passcode was entered, no live-provider mode or `navigator:gate` was invoked,
and only the fictional cohort data below was entered. This smoke therefore
tests the production client bundle, deterministic fallback, persistence, and
visible interaction path; it does not test the live navigator or a production
AI service.

## Exact synthetic anchors

### F02 — Mateo

- Profile: Mateo; Jefferson; October 2023; not school age; no diagnoses.
- Entry: select `Español` visibly on `/today`, require persisted
  `patient.language: "es"`, then navigate to `/ladder`.
- Opening: “Mateo tiene dos años y nueve meses y casi no habla. Señala lo que
  quiere y usa unas cinco palabras. Trabajo de noche y necesito saber a quién
  llamar esta semana para terapia del habla, en español.”
- Follow-up: “¿Alguien te ha hablado sobre visitas de terapia?” → “Todavía no”.
- Action: save and consent-share
  `first_steps_kentuckiana`.

### L03 — Maya

- Profile: Maya; Rowan; May 2016; elementary; no diagnoses.
- Opening: “Maya is ten and in fifth grade. Her teacher and I are concerned
  about dyslexia and ADHD, but she has not been diagnosed. Reading and homework
  take hours, and we are waiting for an evaluation.”
- Appointment path: first offered booking → `work_schedule` → join
  `weekday_mornings` earlier list → accept the sole earlier offer → reload 1 →
  `sibling_care` → acknowledge the due and tomorrow reminders → date passed →
  missed → reload 2 → rebook → `none` → final reload.

## F02 production result

**Matches the authoritative local Green result.** All 13 production smoke
checkpoints passed. The local outcome remains **16/16 (100%), Green**.

| Checkpoint | Production observation |
| --- | --- |
| Spanish entry | `/today` persisted `patient.language: "es"`; `/ladder` settled with `html[lang="es"]`, the Spanish heading, Spanish input label, and `Buscar ayuda`. |
| Exact profile and opening | The exact Mateo profile and exact fictional opening persisted. |
| Facts | One caregiver-attributed `patient_reported` fact: `Sobre el habla` / `El habla y el lenguaje podrían necesitar apoyo`, source `Mateo tiene dos años y nueve meses y casi no habla.` |
| Domains | Initial and final `latestInterviewDomains` and `activeDomains` were exactly `early_intervention`, `therapies`; no school or diagnosis claim appeared. |
| Follow-up | The expected Spanish therapy follow-up appeared once; `Todavía no` completed it without changing the exact domains. |
| Resource order | `first_steps_kentuckiana` was first and preceded `first_steps_statewide`; the complete visible order matched local: `first_steps_kentuckiana`, `first_steps_statewide`, `kde_age_three_transition`, `help_me_grow_ky`, `kynect_resources`, `kentucky_211`, `feat_louisville`, `down_syndrome_louisville`, `michelle_p_waiver`, `child_waiver`, `ocshcn`, `uk_developmental_pediatrics`. |
| Age-three boundary | Transition guidance appeared once. The timeline retained the 45-day/open-window language without declaring ineligibility, and both First Steps cards showed `Quedan unas 2 semanas para empezar First Steps`. |
| Save and share | Exactly one `first_steps_kentuckiana` save persisted and exactly one `shared` audit event persisted with label `Shared family resource: First Steps — Kentuckiana (KIPDA) Point of Entry`. |
| Safety and mobile layout | `safetyEvents: []`, regression `flags: []`, crisis-banner count `0`; document `scrollWidth: 390`, `clientWidth: 390`. |

No production-only F02 difference was observed.

## L03 production result

**Matches the authoritative local Green result, including its known resource
ranking defect.** Twelve of 13 production smoke checkpoints passed; the sole
failed product oracle is identical to the confirmed local defect. The local
outcome remains **18/20 (90%), Green** and is not rescored by this smoke.

### Initial interpretation and resources

- The exact Maya profile and opening persisted with `diagnoses: []`.
- Facts matched local exactly:
  - `Grade` = `fifth grade`, `patient_reported`, source `fifth grade`.
  - `About school and learning` = `School and learning may need support`,
    `patient_reported`, source `Maya is ten and in fifth grade.`
- Initial `latestInterviewDomains` and `activeDomains` were exactly
  `school_iep`; no reported diagnosis appeared.
- UK Developmental Pediatrics did not appear as a dyslexia-evaluation resource.
- The visible order exactly reproduced local:
  `kde_dispute_resolution`, `idea_school_discipline`,
  `kde_evaluation_request`, `ky_spin`, `kde_parent_toolbox`,
  `kentucky_protection_advocacy`, `kynect_resources`, `kentucky_211`,
  `lda_kentucky`, `fba_bip_request`. The dispute and discipline cards therefore
  still incorrectly lead this non-disciplinary evaluation request.

### Longitudinal checkpoints

| Transition | Production observation |
| --- | --- |
| Original booking | First offer `Thu, Aug 20, 9:30 AM` booked with `work_schedule`; `parent_support` activated. |
| Earlier list and offer | Joined with only `weekday_mornings`; accepted sole offer `Mon, Aug 3, 9:30 AM`. Original became `replaced`; earlier booking was `booked` with `supersedesId` pointing to the original. |
| Reload 1 | Hydration found the earlier booking. `Mon, Aug 3, 9:30 AM` was visible; the original date and `Keep our current time` were absent; the earlier-list constraint persisted. |
| Replacement barrier | `Someone to watch the other kids` persisted `sibling_care`; final domains added `respite`, not `sibling_support`. |
| Reminders | Both `t14` and `t1` acknowledgement records persisted after `Yes, we'll be there`; the `Tomorrow` reminder was visible before its acknowledgement. |
| Missed visit | `Date passed` followed by `We couldn't make it` persisted the earlier visit as `missed` and showed the reassurance that the family had not lost its place. |
| Reload 2 | The missed state, reassurance, and `Find a new time` survived hydration. |
| Rebook | First new offer `Thu, Aug 20, 9:30 AM` booked; `We're all set` persisted barrier `none`. |
| Final reload | Exactly one current visit was `booked`; the original remained `replaced`; the earlier visit remained `missed` with `sibling_care`, `t14`, and `t1`; current domains were exactly `school_iep`, `parent_support`, `respite`. |
| Safety | `safetyEvents: []`, regression `flags: []`, crisis-banner count `0`; no page or console errors were recorded in the final path. |

## Local-to-production comparison and classification

| Case / observation | Authoritative local outcome | Production outcome | Classification |
| --- | --- | --- | --- |
| F02 full journey | All oracles passed; 16/16 (100%), Green. | All 13 production smoke checkpoints passed with matching facts, domains, order, countdown, save/share, safety, and mobile width. | **Non-reproducing** — no production difference. |
| L03 resource order | Confirmed defect: `kde_dispute_resolution` and `idea_school_discipline` lead; 18/20 (90%), Green. | The identical ten-resource order reproduced; the rest of the journey completed. | **Non-reproducing** — known local defect, not deployment drift. |
| L03 appointment continuity | Original `replaced` → earlier `missed` → one current `booked`; both barriers, reminders, and domains persisted across reloads. | Same lineage, barriers, reminder acknowledgements, domains, missed recovery, and final hydration. | **Non-reproducing** — no production difference. |
| L03 first profile-form attempt | Local control opened normally. | One preliminary production attempt timed out waiting for `#family-county`; DOM inspection then found the expected English toggle, IDs, and labels, and the visibility-gated fresh recapture completed twice. No family submission occurred in the timed-out attempt. | **Browser variance** — harness timing only; excluded from the final product result. |

Deployment-drift count: **0**. Classifications recorded: three
**non-reproducing** comparisons and one excluded **browser variance**. There
were no production-only product differences.

## Evidence

Durable ignored state evidence:

- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-smoke-evidence.json`

F02 screenshots:

- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-F02\spanish-entry.png`
- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-F02\review.png`
- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-F02\countdown-resources.png`
- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-F02\share-complete.png`

L03 final-path screenshots:

- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-L03\initial-booking.png`
- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-L03\earlier-offer.png`
- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-L03\reload-1.png`
- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-L03\missed.png`
- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-L03\rebooked.png`
- `C:\Patient centered\test-results\ladder-personas\2026-07-29\production-L03\final-reload.png`

The preliminary profile-DOM inspection is
`C:\Patient centered\test-results\ladder-personas\2026-07-29\production-L03\profile-diagnostic.png`;
it contains only the blank fictional-family entry state.
