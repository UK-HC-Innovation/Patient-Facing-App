# Crisis gate red-team result

## Date

2026-08-04

## Command

```
npx vitest run src/domain/crisis-red-flags.test.ts src/ai/safety-gate.test.ts src/domain/front-door.test.ts src/domain/safety.test.ts src/ai/voice-gate-corpus.test.ts src/ai/output-guard.test.ts src/domain/family-safety.test.ts
```

## Result

PASS

## Output

```
RUN  v4.1.10 C:/Patient centered


 Test Files  7 passed (7)
      Tests  334 passed (334)
   Start at  09:52:02
   Duration  3.46s (transform 1.29s, setup 1.75s, import 1.76s, tests 862ms, environment 12.35s)
```

## Interpretation

Deterministic recall = 1.00 (all corpus positives detected); false positives = 0. Floor of 0.95 met.

The crisis classifier (`src/domain/crisis-red-flags.ts`, exported as
`classifyCrisis` in `src/domain/safety.ts`) is the F4 gate. Self-harm
disclosures route to the crisis tier (988/911/safety-plan) and the provider is
never called; sudden vision loss and acute danger route to the emergency tier.
Negation is handled by stripping negated self-harm spans before scanning, so
"I would never hurt myself" clears while "I want to die" still fires. This gate
is advisory-biased toward escalation, which spec 04 accepts.

The gate also runs the front-door routing invariant (`src/domain/front-door.ts`):
for every crisis-corpus positive, `decideFrontDoor` must return a Coach outcome
and must NEVER route the utterance to a feature screen. This makes "the router
sent a crisis to the BP form" a build-breaking failure, not a silent UX
regression, and confirms the front door can only navigate or defer — never write.
