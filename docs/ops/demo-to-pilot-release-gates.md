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
- Keep model output explanatory and grounded; deterministic code owns safety,
  eligibility, and resource authority.
- Prefer bounded demo improvements backed by the maintained persona, crisis,
  accessibility, and browser gates over new clinical scope.

## Next decision meeting

The next product decision should assign owners and target dates to the nine gates
above. If those owners are not available, the roadmap remains demo validation and
maintenance rather than pilot engineering.
