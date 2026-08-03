# Home Health AI Ownership App

Mobile-first prototype for patient-owned chronic care at home (hypertension +
diabetes).

## What it does

- Helps a patient understand a hypertension/diabetes care plan.
- Logs home blood pressure and blood sugar readings.
- Summarizes blood-sugar **time-in-range** and surfaces a plain-language
  **food↔blood-sugar pattern** from the patient's own logs (discrete readings
  summarized — no CGM, no device, no causal claim).
- Shows whether the day's diabetes medicine was marked taken in the patient's
  own dose log, and lets meal logging assume an editable serving count.
- Explains medicines in plain language.
- Captures medication barriers without blame.
- Provides guided AI coaching with safety boundaries.
- Generates a visit-ready Health Brief the patient carries to their doctor. For
  a diabetic it also carries blood-sugar time-in-range, refill-based medicine
  coverage, an eye-screening summary, and the food↔blood-sugar pattern — all
  derived on-device (no provider dashboard, no backend).
- Carries a diabetic patient through the eye-screening loop (`/screening`):
  "you're due" nudge → find & book the nearest camera → photograph the printed
  result → confirmed import → correctly-tiered referral → silence escalation →
  slot booking → annual recall. The app reads the camera's **printed report**
  only — it never interprets eye photographs.
- Provides privacy, export, delete, and audit foundations.

## Safety and support behavior

- **Crisis pathway (F4).** A self-harm disclosure — typed in the Coach, spoken in
  Food Lens voice, or a positive PHQ-9 item 9 on the Check-in — short-circuits the
  AI provider and shows a fixed, human-authored response with offline-safe
  `tel:988` / `sms:988` / `tel:911` deep links and an inline safety plan. The
  composer locks until the patient acknowledges the crisis resources, and the
  event is audited as `crisis_escalated`. Sudden vision loss, acute danger, and
  acute material emergencies (no food today, hungry children, out of insulin)
  escalate to an emergency tier with 911 (and 211) guidance.
- **Answer grounding.** Every model answer is checked against the patient's own
  records; an unsupported claim is replaced with a "contact your care team"
  fallback rather than guessed.
- **Voice safety.** Live and mock voice turns are classified before any spoken
  answer (server VAD auto-response is off; the turn waits for the gate).
- **Check-in (`/checkin`).** A consent-gated, minimal PHQ-9 self-check (not a
  diagnosis, not therapy) with item-9 crisis routing.
- **Support (`/support`).** An optional material-needs screen (food, housing,
  utilities, transportation, finances) with a county-first Kentucky resource
  finder and a per-referral consent step before anything is shared.
- **Medicines PDC card.** A refill-based, honestly-labeled diabetes coverage
  estimate beside the dose streaks in the default retinopathy walkthrough.
- **Display & access.** Accessibility preferences (large text, high contrast,
  keyboard focus) set on the Privacy page apply app-wide.

## Demos

- Fresh sessions default to **Brent Wright**, a blood-pressure + diabetes patient
  who is overdue for diabetic retinopathy screening.
- `/demo` renders the app inside a phone bezel (same-origin iframe opening on
  the `/screening?entry=sms` nudge, shares this browser's data) for stakeholder
  walkthroughs — it is not in the nav.
- **DR screening golden path:** open `/screening?entry=sms` → "See times near
  me" → Book it → answer the ride question → "I had my screening — read my
  report" → pick `report-moderate-npdr.svg` from the demo picker → "That's
  right" → referral already sent (packet viewable) → "Demo: simulate 5 days
  passing" → care team notified → pick a slot → teachable moment into
  `/glucose` / `/food`. Rerun with `report-pdr-dme.svg` (urgent retina tier) or
  `report-no-dr.svg` (12-month recall). Ask the Coach "what did my eye report
  say?" for the grounded answer.

## What it does not do

- It does not diagnose.
- It does not prescribe.
- It does not change medication doses.
- It does not replace urgent or emergency care.
- It does not send health data to an external AI provider by default.

## Open clinical/legal question

The emergency number is hardcoded to **911** behind the `call_emergency` action and
a single i18n key, so a swap to a locale-aware emergency number is a one-string
change. Locale-aware emergency routing is deferred to clinical/legal review.

The application remains a synthetic-data demo. The required ownership and
evidence before any real-patient pilot are listed in the
[demo-to-pilot release gates](docs/ops/demo-to-pilot-release-gates.md).

## Local setup

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000/today
```

## Verification

```bash
npm run check        # lint + vitest + build (passes with zero env vars — mock-first)
npm run crisis:gate  # crisis suite + recall floor -> docs/ops/red-team-results/
npx playwright install
npm run test:e2e
```

## AI posture

The app uses a local mock AI provider by default. Real AI provider integration should be treated as a separate integration decision and requires privacy, security, clinical safety, and regulatory review before sending patient health data outside the browser.
