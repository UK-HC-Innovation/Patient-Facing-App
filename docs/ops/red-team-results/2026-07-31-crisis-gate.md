# Crisis gate red-team result

## Date

2026-07-31

## Command

```
npx vitest run src/domain/crisis-red-flags.test.ts src/ai/safety-gate.test.ts src/domain/front-door.test.ts src/domain/safety.test.ts src/ai/voice-gate-corpus.test.ts src/ai/output-guard.test.ts
```

## Result

PASS

## Output

```
RUN  v2.1.9 C:/Patient centered

 ✓ src/domain/safety.test.ts (16 tests) 6ms
 ✓ src/domain/crisis-red-flags.test.ts (187 tests) 46ms
 ✓ src/ai/voice-gate-corpus.test.ts (2 tests) 35ms
 ✓ src/ai/safety-gate.test.ts (48 tests) 46ms
 ✓ src/ai/output-guard.test.ts (12 tests) 40ms
 ✓ src/domain/front-door.test.ts (45 tests) 33ms

 Test Files  6 passed (6)
      Tests  310 passed (310)
   Start at  02:39:19
   Duration  1.35s (transform 392ms, setup 486ms, collect 818ms, tests 206ms, environment 3.06s, prepare 662ms)
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
