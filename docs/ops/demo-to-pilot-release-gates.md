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
| Pediatric behavioral health + child safety | The `safety*` keys in `src/i18n/family-strings.ts` (en and es), their selection in `src/components/family-safety-copy.ts`, and the route/action composition in `src/components/family-crisis-banner.tsx` and `src/components/family-safety-contacts.tsx` (including KYSAFE1, local-law-enforcement/NCMEC, 211, prescriber/pharmacist, 988, and 911 distinctions). These are Ladder's own crisis words, written household-neutral because the detector reports a domain and never a subject. | They are the words and actions a caregiver receives at the worst moment. They were drafted by engineering against a review finding and authoritative public routing sources, but have had no pediatric clinical read. | Unassigned |
| Professional Spanish + bilingual caregiver review | Every `es` string added or changed by spec 22, especially the crisis set and the AI-consent disclosure. | Spanish is already labelled a draft; spec 22 added consequential new Spanish to the safety and consent paths, which is the worst place for a draft translation. | Unassigned |
| Privacy, security, legal | The consent flow (`src/domain/family-ai-consent.ts`, `family-ai-consent-card.tsx`), the generated Privacy history, browser `SpeechRecognition` dictation, what each disclosure claims, and whether session-scoped consent for a minor's data is defensible. | Spec 22 made the Ladder text copy true and exposed the separate dictation path; it did not make either model compliant. Whether this consent model and third-party speech path are *sufficient* for children's data is a legal question. | Unassigned |
| Accessibility follow-on | Global read-aloud scope, 200%/400% reflow, skip links, and the honesty of the screen-reader/keyboard toggles in settings (they present always-on support as optional). | Out of spec 22's Ladder scope because it is app-wide, but the review found it and it is real. | Unassigned |
| Kentucky program facts | Re-verification cadence for the 52-entry catalog, the standing owner-only checks, and provider service-area metadata. See the [2026-08-12 source and manual review](catalog-verification/2026-08-12.md). | The freshness test enforces dates, not truth. The 2026-08-12 pass refreshed supported facts while retaining older dates and explicit review flags where exact county routing could not be established from a primary source. | Unassigned |

**Deployment posture added by spec 22.** A family-facing build must set
`NEXT_PUBLIC_LADDER_SIM=0`, which removes the waitlist seed, the appointment
simulation, and the time-travel controls, and adds a visible prototype/not-a-
clinic-service notice across Ladder surfaces that says to use invented
information only. The flag defaults **on** so the stakeholder demo is unchanged;
the pilot build opts out. A build that reaches real families with the flag on is
a no-go regardless of the table above.

The two postures must also use distinct origins or storage namespaces. Demo
time-travel controls historically rewrote canonical timestamps and diagnosis
months without provenance, so changing the flag on an existing origin cannot
reconstruct the pre-demo values. Never promote a simulation-on origin to the
family posture without explicitly resetting its browser storage first. If
same-origin posture switching becomes a requirement, first redesign time travel
as non-destructive simulation metadata/overlays and provide a migration or reset
for legacy mutated records.

**Provider posture.** `/api/family/*` sends nothing to the model unless all four
server settings are present: `HEALTH_AI_PROVIDER=openai`,
`HEALTH_AI_API_KEY`, `DEMO_PASSCODE`, and a separately generated
`FAMILY_AI_SESSION_SECRET` of at least 32 bytes. Share a Ladder invite only as
`/ladder#invite=<DEMO_PASSCODE>`; fragments do not enter the initial HTTP request,
and the browser exchanges it once for a 30-minute HttpOnly, SameSite session
cookie before removing it from the address bar. Legacy `?k=` values are scrubbed
but are not accepted as family credentials. The caregiver must still accept the
current-version online-helper disclosure. That acknowledgement mints a signed
bearer bound to the same session, its expiry, and the `interview`/`recommend`
purposes. The bearer is held only in mounted React memory and sent in
`X-Ladder-AI-Consent`; both provider routes validate it before reading the
caregiver request body. Missing or stale consent, wrong-purpose consent, and
missing auth configuration all fail closed. Client revocation prevents later
sends from that tab, but it cannot invalidate a copied bearer before its short
expiry; a pilot that requires immediate server-side revocation needs a shared
revocation store.

**Offline posture.** The service worker is a repeat-visit shell, not a data
cache. It handles only same-origin `GET` navigation for `/ladder`, immutable
`/_next/static/` assets, the Ladder manifest, and its icon. It never intercepts
`/api/`, POST, exports, caregiver state, or external program links. Production
browser tests warm the exact deployed shell, go offline, and cover ordinary and
crisis turns with zero family API requests. This is not a cold-install offline
claim: a device must have completed a controlled online visit first.

**Persistence posture.** AppState now sits behind an async repository contract
and a serialized coordinator that coalesces checkpoints and makes deletion a
generation barrier. The current adapter deliberately reports
`consistency: "single_context"`: localStorage cannot provide atomic compare-and-
swap across tabs, devices, crashes, or concurrent writers. The contract reserves
`transactional_cas` for a future IndexedDB or server adapter whose compare and
write happen in one backing-store transaction. This seam improves ordering and
prevents an older queued save from landing after an in-tab deletion, but it does
not turn browser storage into a clinical record, backup, or cross-device account.

The source-keyed in-process limits (10 invite exchanges and 20 provider calls
per minute) are defense in depth for a single function instance, not an
authoritative deployment quota. Serverless route bundles and isolates do not
share that memory and reset it on cold start. Before enabling public live AI,
configure an edge/WAF rate rule for `POST /api/family/*` keyed by trusted client
IP or JA4, or replace the in-process windows with one shared Redis/KV limiter.

The current CSP is a narrow anti-framing/object/base/form boundary so the
same-origin `/demo` phone frame still works. It is not an XSS or exfiltration
boundary: a pilot needs a nonce-compatible production policy with explicit
`default-src`, `script-src`, `connect-src`, `style-src`, and `img-src` directives,
plus browser proof for every camera, voice, and provider path.

## Next decision meeting

The next product decision should assign owners and target dates to the nine gates
above. If those owners are not available, the roadmap remains demo validation and
maintenance rather than pilot engineering.
