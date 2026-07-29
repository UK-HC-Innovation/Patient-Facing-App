# Crisis gate red-team result

## Date

2026-07-26

## Revision and scope

This run was executed against revision
`324fa8e299e9d9f99cdbf9e6b92da6b4655b8ce5` (`324fa8e`). It verifies that
revision only and does not verify later UI/state commits. The recorded command
ran six test files and 310 tests.

## Command

```
npx vitest run src/domain/crisis-red-flags.test.ts src/ai/safety-gate.test.ts src/domain/front-door.test.ts src/domain/safety.test.ts src/ai/voice-gate-corpus.test.ts src/ai/output-guard.test.ts
```

## Result

PASS

## Output

```
RUN  v2.1.9 C:/Patient centered

 ✓ src/domain/safety.test.ts (16 tests) 7ms
 ✓ src/domain/crisis-red-flags.test.ts (187 tests) 72ms
 ✓ src/ai/voice-gate-corpus.test.ts (2 tests) 43ms
 ✓ src/ai/output-guard.test.ts (12 tests) 46ms
 ✓ src/ai/safety-gate.test.ts (48 tests) 72ms
 ✓ src/domain/front-door.test.ts (45 tests) 57ms

 Test Files  6 passed (6)
      Tests  310 passed (310)
   Start at  00:10:33
   Duration  2.19s (transform 610ms, setup 773ms, collect 1.45s, tests 296ms, environment 4.62s, prepare 792ms)
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
