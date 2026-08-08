# Demo-to-pilot release gates

**Decision:** keep the current application in synthetic-data demo status. Do not
enroll real patients or store real family/health information until every pilot
gate below has a named owner, dated approval, and release evidence.

## What is allowed now

- Stakeholder demonstrations with the fictional fixtures and mock-first AI mode.
- Deterministic browser and safety testing with synthetic personas.
- Product discovery, caregiver usability sessions using invented scenarios, and
  clinical/content review that does not enter real patient information.

The production URL is a demo distribution channel, not a clinical launch. Its
localStorage state is not an account, clinical record, durable backup, or
HIPAA-grade persistence layer.

## Pilot gates

| Gate | Required evidence | Named owner required |
| --- | --- | --- |
| Clinical safety | Approved thresholds and escalation copy; independent crisis-path review; documented residual-risk and incident process | Licensed clinical lead |
| Legal and regulatory | Written scope classification for patient-facing CDS, screening, voice, and report extraction; locale-aware emergency-number decision | Counsel / regulatory lead |
| Privacy and minors | Proxy-consent model, notice/authorization copy, data minimization, retention/deletion policy, and minors governance | Privacy officer |
| Secure persistence | Authenticated tenant-isolated backend; encryption; backup/restore; actor-bearing audit; access review; breach logging | Security/backend owner |
| Vendor posture | BAAs and no-training/no-retention terms for every PHI processor; approved production AI mode and documented fallback | Security/privacy owner |
| Content and licensing | TEAM UP Center electronic-use agreement for SWYC; human verification of every draft instrument and translated clinical string | Content/licensing owner |
| Clinical operations | Staffed escalation and referral queues, response-time promises, hours/coverage, handoff ownership, and closed-loop outcome capture | Pilot clinic operations owner |
| Quality and accessibility | CI release gates, dependency policy, threat model, WCAG review, bilingual human review, and real-device voice/camera checks | Engineering/QA owner |
| Evaluation | Approved protocol, success/guardrail metrics, adverse-event review, recruitment/consent plan, and stop criteria | Product/research owner |

## Go/no-go rule

A pilot release is **no-go** while any row lacks an owner or its evidence. Passing
the software test suite is necessary but not sufficient. The release record must
name the exact commit, deployment, approvals, environment, and monitoring owner.

## Engineering boundary until the gates are owned

- Keep real data out of localStorage, logs, screenshots, fixtures, and test
  artifacts.
- Do not add a clinician worklist, EHR integration, SMS outreach, or live
  referral promises without the secure-backend and clinical-operations owners.
- Keep `/ladder/impact` on its frozen synthetic cohort. Aggregating real family
  journey records across devices is a backend, consent, tenant-isolation,
  operations, and evaluation-protocol change—not a fixture swap.
- Keep model output explanatory and grounded; deterministic code owns safety,
  eligibility, and resource authority.
- Prefer bounded demo improvements backed by the maintained persona, crisis,
  accessibility, and browser gates over new clinical scope.

## Spec 22 gates — specialist review of what shipped 2026-08-08

Spec 22 closed three code blockers an external family-experience review found
(the false device-only privacy promise, adult-voiced child-crisis copy, and
simulated care actions inside the family surfaces). The review also asked for
five specialist reads that no amount of engineering can satisfy. They are gates,
not backlog: each names what shipped, so a reviewer can start from the artifact
rather than the whole app.

| Gate | What to review | Why it cannot wait for a later spec | Owner |
|---|---|---|---|
| Pediatric behavioral health + child safety | The `safety*` keys in `src/i18n/family-strings.ts` (en and es) and their routing in `src/components/family-crisis-banner.tsx`. These are Ladder's own crisis words, written household-neutral because the detector reports a domain and never a subject. | They are the words a caregiver reads at the worst moment. They were drafted by engineering against a review finding, and have had no clinical read. | Unassigned |
| Professional Spanish + bilingual caregiver review | Every `es` string added or changed by spec 22, especially the crisis set and the AI-consent disclosure. | Spanish is already labelled a draft; spec 22 added consequential new Spanish to the safety and consent paths, which is the worst place for a draft translation. | Unassigned |
| Privacy, security, legal | The consent flow (`src/domain/family-ai-consent.ts`, `family-ai-consent-card.tsx`), what the disclosure claims, and whether session-scoped consent for a minor's data is defensible. | Spec 22 made the copy true, not compliant. Whether this consent model is *sufficient* for children's data is a legal question. | Unassigned |
| Accessibility follow-on | Global read-aloud scope, 200%/400% reflow, skip links, and the honesty of the screen-reader/keyboard toggles in settings (they present always-on support as optional). | Out of spec 22's Ladder scope because it is app-wide, but the review found it and it is real. | Unassigned |
| Kentucky program facts | Re-verification cadence for the 52-entry catalog, and the standing human-only checks (SSI/ssa.gov, STABLE, Sibling Support Project, the three `humanVerify` procedural entries). | The freshness test enforces dates, not truth. Note the budget test self-detonates on 2026-08-18. | Unassigned |

**Deployment posture added by spec 22.** A family-facing build must set
`NEXT_PUBLIC_LADDER_SIM=0`, which removes the waitlist seed, the appointment
simulation, and the time-travel controls. The flag defaults **on** so the
stakeholder demo is unchanged; the pilot build opts out. A build that reaches
real families with the flag on is a no-go regardless of the table above.

**Provider posture.** `/api/family/*` sends nothing unless a `?k=` passcode is
present *and* the caregiver accepts the online-helper disclosure. Note that the
route's own passcode check is skipped entirely when `DEMO_PASSCODE` is unset, so
the client gate is the only protection — do not treat the server as a backstop.

## Next decision meeting

The next product decision should assign owners and target dates to the nine gates
above. If those owners are not available, the roadmap remains demo validation and
maintenance rather than pilot engineering.
