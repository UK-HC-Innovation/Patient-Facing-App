# Codex handoff: spec 30 first build (B0, A1, A2) and deploy

Paste everything below the line into Codex as one prompt.

---

You are implementing and deploying the first build of spec 30 in the repo at `C:\Patient centered` (Next.js 15, React 19, TypeScript strict, Vitest, Playwright). Work directly on `master` in that tree. Read these before touching code, in this order:

1. `CLAUDE.md` at the repo root (product rules, blank-state rule, copy voice, git rules).
2. `C:\Users\tsthe2\.claude\writing-rules.md` (every user-facing string you add or change follows it; no em dashes, no "not X, it's Y" reframes, as few words as possible).
3. `docs/specs/30-onegoodchoice-trustworthy-choice.md`, all of it. Section 3 "Fable verification" lists the exact file and line evidence for every defect; section 8 defines the slices; section 9 holds the acceptance criteria; section 13 is the review verdict and the amendments.
4. `docs/specs/29-food-lens-critique-fixes.md`, section 6 "What shipped", for the traps the last build hit.
5. The last three lines of `docs/ops/DEPLOYS.jsonl`, for the ledger format and the production verification style you must match.

## Scope

Build and deploy, in this order: **B0** (guard patch), **A1** (one current choice), **A2** (justified identity). Deploy after A1 (with B0) and again after A2. Nothing from slices C, D, E. No new score model, no change to the published FCS 2.0 table or `computeFullScore`, no new persistence schema, no model migration, no paid evaluation, no retailer or research work.

Baseline: `f027544` on `master`. If `origin/master` has moved, fetch and reconcile by hand before starting. Never autostash-rebase. Production is the Vercel alias `https://patient-centered.vercel.app`; git push does not deploy.

## Defaults for the six owner decisions in section 13.6

The owners have not answered. Use these defaults and say so in the final report:

1. Public live voice stays as it is, with the B0 patch. Do not switch `/food/demo` to mock mode.
2. Plate directive: print "Cut back on X first" only when the plate has at least two scored items, every item resolved, and X's band is minimize. Otherwise print nothing.
3. Bare generic names (`pizza`, `chicken`, `soup`, `salad`, `coffee`): candidate mode, no default row. The alias table ships with only the unambiguous entries listed in P4.
4. When no swap clears 10 points but a higher row exists in the pool: "No close swap found." Never "Already one of the best" in that case.
5. "my plan says 1 unit per 10 carbs, what is that for 45": refuse the arithmetic with the existing care-team copy.
6. Spanish aliases: ship only the entries in P4; everything else returns candidates.

## Gates, run at the end of every phase

- `npm run check` bare. Never pipe it; piping hides the exit code. It runs lint, vitest, the store-free witness, the build and the bundle budgets.
- `npm run crisis:gate`.
- Playwright, both projects, serialized, against a distinct build directory so you do not clobber any dev server sharing `.next`:

```bash
NEXT_DIST_DIR=.next-package-eval-spec30 npx playwright test e2e/food-critique.spec.ts e2e/food-demo.spec.ts e2e/food-lens-shell.spec.ts e2e/food-lens.spec.ts e2e/food-plate.spec.ts e2e/food-package.spec.ts --project=chromium --project=mobile --workers=1
```

- Never run `npm run build` or Playwright while a dev server is up in this tree. Never edit `src` while an e2e run is in progress; it hot-reloads under the suite.
- A passing test name is not evidence. Do not weaken a test to accept stale state. Do not raise a bundle ceiling except from a fresh measurement, and never touch the >900 KiB per-chunk guard in `scripts/check-ladder-bundle.mjs`. The alias table and every search change stay server-side in `src/domain/food-compass-search.ts`, which only the identify route imports.
- Commit at the end of each phase, path-scoped: `git commit -- <paths>`. Conventional-ish messages (`fix:`, `feat:`, `test:`, `docs(ops):`). Other sessions may be editing this tree; never `git reset --hard` or `git checkout --` over changes you did not make.

## P0. Baseline and reproduction

Record the commit, dirty files and provider configuration without secrets. Then reproduce before editing, and keep the outputs for the report:

1. Add `src/app/api/food/identify/route.corpus.test.ts` and `src/test/fixtures/food-typed-corpus.json`. The test calls the route's `POST` directly with `new Request(...)` for every corpus entry and asserts `mode`, matched row code and, after A2, the identity basis. Seed the corpus with every query named in spec sections 3 and 9. Write the current (wrong) outcomes as `todo`-marked expectations so the file runs green at P0 and turns into the A2 gate in P4. This is the harness the review used; it resolves 33 queries in under a second.
2. Reproduce E01 in a unit test on `/food`: type `pizza`, then `water`; assert the pizza verdict is still rendered. Mark it as the failing baseline.
3. Run the existing guard suites: `npx vitest run src/ai/voice-gate.test.ts src/ai/output-guard.test.ts src/hooks/use-food-voice-session.test.tsx`.

## P1. B0, the guard patch (spec R7)

Files: `src/ai/voice-gate.ts`, `src/ai/output-guard.ts`, `src/ai/realtime-session.ts`, `src/domain/safety.ts`, `src/domain/grounding.ts`, their tests, `src/i18n/strings.ts` only if an existing string needs a Spanish twin.

1. **Input gate.** Add a dosing-request family to the `blocked` tier: units, insulin, dose, bolus, unidades, insulina, dosis, in a question shape or followed by "for this", "for this meal", "for this plate", "para esto". Add a medication-skip shape with a drug name ("skip my metformin", "saltar la metformina"). Reuse the existing `blocked` response and `CARE_TEAM_ACTIONS`; no new clinical copy. Required intercepts: "how many units for this?", "how many units should I take for this meal", "how much insulin should I take for this pizza", "8 units?", "so 8 units then", "¿cuántas unidades para esto?", "cuántas unidades de insulina me pongo para esto", "can I skip my metformin tonight if I eat light", "my plan says 1 unit per 10 carbs, what is that for 45". Required passes: "how many calories in this?", "how many servings in the box?", "I'm not going to take 8 units for this", "is 45 carbs right" alone, and every existing corpus line in `src/ai/voice-gate-corpus.test.ts`.
2. **Output guard.** Export the medication-change patterns from `src/domain/grounding.ts` and use them in `hasBlockedClaim`. Add Spanish stated-dose forms ("N unidades", "dosis de N", "póngase N unidades") and renal/therapeutic-diet clearance shapes ("safe with your kidney diet", "fine for your renal diet", Spanish equivalents). Required trips, streamed word by word: "Take 8 units of insulin.", "Take 8 units of insulin for this pizza.", "You should take 8 units.", "8 units should do it.", "Your usual dose for that would be 4 units.", "Eso son 8 unidades.", "Póngase 8 unidades de insulina.", "This is safe with your kidney diet." Required passes: "Never use this for insulin math; follow your care team's plan.", "Do not stop or change the dose without your care team." (the mock safety note), "This has 12 grams of sugar per serving."
3. **Coverage.** In `realtime-session.ts`, run `outputGuard.observeDelta` on `response.output_audio_transcript.done` (diff against what the deltas already delivered, so text is not double-counted) and on `response.output_text.delta`. A tripped guard must suppress the `.done` emit.
4. Unit tests for every case above in `voice-gate.test.ts` and `output-guard.test.ts`; a realtime-session test proving a `.done` transcript with an unguarded dose is intercepted.
5. Extend the crisis corpus only if `npm run crisis:gate` requires it; record its output under `docs/ops/red-team-results/` with today's date.

Commit: `fix(safety): block dosing requests and stated doses on the live voice path (spec 30 B0)`.

## P2. A1, one current choice (spec R1, R2, R3, R5 accounting, R6, and the riders)

Files: `src/app/food/page.tsx`, `src/app/food/demo/page.tsx`, `src/hooks/use-typed-food-score.ts`, `src/hooks/use-manual-food-score.ts`, `src/hooks/use-compass-score.ts`, `src/components/food-typed-plate.tsx`, `src/components/food-lens-experience.tsx`, `src/components/food-lens-shell.tsx`, `src/components/food-lens-blocks.tsx`, `src/components/food-viewfinder.tsx`, `src/components/nutrition-compass.tsx`, `src/components/food-lens-voice-bar.tsx`, `src/ai/local-coach-session.ts`, `src/ai/mock-provider.ts`, `src/domain/typed-food-line.ts`, `src/i18n/strings.ts`, tests, `e2e/food-critique.spec.ts`, `e2e/food-lens-shell.spec.ts`.

1. **One current interpretation on `/food`.** Add a reducer above `live` (from `useManualFoodScore`), `typed`, `foodResolutionState` and `plateItems` that yields exactly one current state in the shape of the table in spec R1. The public door's `shown` memo in `demo/page.tsx:122-140` is the pattern. `handleTypedLine` must act on every `TypedFoodResult` kind: `carve_out` and `none` clear the live match and render the exclusion or no-match state; `plate` clears the single-food verdict, alternatives and Log this.
2. **Typed hook takes the authority.** `useTypedFoodScore` accepts the door's `FoodAuthority`, snapshots the epoch at submit, and drops results that are no longer current. Every replacement (barcode confirmation, camera confirmation, `logPlate`, `adoptMatch`) calls `typed.clear()`. Stamp each published result with its epoch; `onLog`, `toggleFavorite` and `onAddToPlate` check that stamp before committing.
3. **Question path aborts the pending lookup.** In `useTypedFoodScore.submit`, move `abortRef.current?.abort()` above the `isQuestionLine` branch so a question cancels an in-flight food lookup. A late `match` from a superseded lookup is a no-op on both doors.
4. **Guard the eight post-await writes** listed under E12 in spec section 3 with an epoch check, including the realtime tool handler in `demo/page.tsx:435` (return nothing for a food no longer current) and `use-compass-score.ts`.
5. **Pending state.** Both doors read `typed.pending` and show it within 150 ms: disable the Ask button and show a status line on the voice bar, and pass `chart.pending` while a typed lookup is in flight.
6. **Plate accounting.** `splitPlateLine` returns the full list plus the dropped tail; the hook keeps the count and names; `FoodTypedPlate` renders "Not scored: {names}" when anything was dropped. Per-item failure: replace `Promise.all` with `allSettled`; a failed item renders as unchecked with a retry; the line never becomes a `question`. The typed plate renders on `/food` even when `plateItems` has entries (a separate block under the assembled plate). Apply the plate directive default from above.
7. **`adoptMatch` options.** Either honor `pin` in `useManualFoodScore.adoptMatch` or remove the option from the `LiveScoreState` contract and its two callers. Do not leave a parameter that typechecks and does nothing.
8. **Rider: why-score reachable (E09).** Move `whyScore` out of `FOOD_LENS_FOLDED_SLOTS` to render under the chart in `FOOD_LENS_ANSWER_SLOTS`, or make the fold a controlled `<details open={...}>` that `openWhyScore` opens. Add a visible "Why this score?" text button beside the score on both doors (reuse the `compassWhyScore` string). Focus lands on the panel heading; closing returns focus to the trigger. Fix `e2e/food-lens-shell.spec.ts:229` so it taps the marker without opening the fold first.
9. **Rider: public denied camera (E08).** `demo/page.tsx` passes `collapsedViewfinder={cameraBlocked}` and `onCameraRetry` the way `page.tsx:1115-1140` does. `food-viewfinder.tsx` shows the pizza placeholder only while the camera is `active`-pending on first load for at most the stream attach, never for `denied` or `unavailable`; the denied state is the one-line notice plus Retry camera.
10. **Rider: contrast (E10).** `text-ink/55` and `text-ink/60` become `text-ink/70` at `food-lens-blocks.tsx:111-112, 271` and `food-typed-plate.tsx:53`. Add an axe assertion in `e2e/food-critique.spec.ts` after a typed score on both doors: zero contrast violations in the result region.
11. **Rider: mock-mode copy and status (E11, R8).** `local-coach-session.ts` must not emit `listening` on open; emit `idle` and let the door's `idleLabel` show. The mock provider's food answers on the public door must not mention a plan, readings, medicines or a care team; give the public door a store-free reply set. Fix the stale comment at `demo/page.tsx:518-519`.
12. **Rider: E06.** Rewrite "a dosing question is refused, and the box still works afterwards" to assert the refusal copy and the care-team actions on both doors, once with the token mocked and once with a stubbed live data channel that replays a canned dose so the gate path is exercised. Keep the enabled-box assertions.
13. Fix the stale comment at `food-lens-experience.tsx:252-253`.

Acceptance for this phase: A01, A02, A03, A05, A08, A09, A10, A11, A12, A13, A14, A15, A16, A17, A18, A22, A23 from spec section 9, each as a unit or e2e test that fails on `f027544` and passes on your commit. State which ones you could only assert by reading.

Commit path-scoped: `feat(food): one current choice on the personal door, reachable why-score, typed plate accounting (spec 30 A1)`.

## P3. Deploy A1 with B0

1. All three gates green on the A1 commit. Record the counts.
2. `git fetch origin` and confirm `origin/master` has not moved past your base; if it has, reconcile by hand and rerun the gates.
3. `git push origin master`.
4. `vercel --prod --archive=tgz`. Capture the deployment id and URL from the output. The deployment URL itself 302s to SSO; verify on the alias.
5. Verify on `https://patient-centered.vercel.app` and record every result verbatim:
   - `POST /api/food/identify {"text":"water"}` returns `carve_out` `zero_calorie`.
   - `POST /api/food/identify {"text":"honey nut cheerios"}` returns the Honey Nut row at 58 (unchanged).
   - `POST /api/realtime/token` with an empty body returns 401.
   - In a browser against the alias, `/food`: type `pizza`, then `water`; the pizza score, alternatives and Log this are gone and the exclusion state is editable. Then type `apple, banana`; two fruit rows, no pizza verdict, no "Cut back" line.
   - `/food/demo` with the camera blocked: the collapsed notice and Retry camera are present, no pizza image, typed box visible, `localStorage.length === 0` after a typed score.
   - `/food/demo`: type `banana`; tap the chart marker; the domain breakdown is visible without opening More about this food.
   - `/food`, `/food/demo`, `/today`, `/ladder`, `/glucose`, `/screening`, `/api/health` all return 200; `GET /compass` is a 308 to `/food/demo`.
6. Append one line to `docs/ops/DEPLOYS.jsonl` in the exact shape of the previous entries: `at`, `sha`, `executableSha`, `target`, `url`, `deploymentUrl`, `deploymentId`, `commitsShipped`, `commitRange`, `verified[]`, `gates{unitTests, unitSkipped, lint, typecheck, build, storeFreeWitness, bundleBudgets, crisisGate, e2e}`, `measured{}`, `note`. The note names the root cause of E01 (the typed hook held no authority and `clear()` was never called), what B0 blocks, what was deliberately not done, and anything not verified.
7. Commit the ledger line: `docs(ops): record the spec 30 A1 and B0 deploy`, then push.

## P4. A2, justified identity (spec R4, R5)

Files: `src/domain/food-compass-search.ts`, `src/domain/typed-food-line.ts`, `src/app/api/food/identify/route.ts`, `src/hooks/use-typed-food-score.ts`, both door pages, `src/components/food-identity-review.tsx`, `src/components/food-lens-blocks.tsx`, `src/i18n/strings.ts`, the corpus test from P0, `e2e/food-critique.spec.ts`.

1. **Promotion policy.** Implement the five rules in spec R4 as one pure function in `food-compass-search.ts`, returning `{ basis: "alias" | "head_canonical" | "brand" | "coverage" | null, row }`. The typed branch of the identify route publishes a score only with a non-null basis and otherwise returns `mode: "candidate"` with up to three named rows and no score. A lone candidate goes through the same rules on both the typed and camera paths; `matchFood` no longer returns a single hit as confident by itself. Add a negation-aware normalizer so "no sauce" matches "without sauce" and "plain" counts as canonical. On `none`, return the top three coverage-rejected hits as candidates instead of `[]`.
2. **Alias table.** English and Spanish, normalized, each entry mapping to one row code or to a named candidate set, with the entry recorded as the basis. Ship these and no more (codes checked against `src/data/food-compass/fcs2-foods.json` on 2026-09-07; re-verify before committing):

- `manzana` → Apple, raw (63101000)
- `plátano`, `platano`, `banano` → Banana, raw (63107010)
- `plain cheerios` → Cereal (General Mills Cheerios) (57123000)
- `frijoles` → candidates: Pinto beans, from dried, no added fat (41104020); Black beans, from dried, no added fat (41102020); Refried beans, fat not added in cooking (41205015)
- `leche` → candidates: Milk, whole (11111000); Milk, reduced fat (2%) (11112110); Milk, fat free (skim) (11113000)
- `huevos` → candidates: Egg, whole, fried with oil (31105030); Egg omelet or scrambled egg, NS as to fat added in cooking (32104900); Egg, whole, boiled (31103000)
- `tamales`, `tamale` → candidates: Tamale with meat (58103120); Tamale with chicken (58103130); Tamale, sweet (53430700)
- `pollo asado` → candidates: Chicken, breast, roasted, broiled, or baked, skin not eaten (24122120); Chicken, breast, roasted, broiled, or baked, skin eaten (24122110); Chicken, thigh, roasted, broiled, or baked, skin not eaten (24152220)

Do not guess a code. If a description above does not match the data exactly, fix the entry from the data and say so in the report.
3. **Question classifier.** A line is a question only when it contains `?` or `¿`, starts with an interrogative (how, what, why, when, where, which, cuánto, cuántos, qué, cuál, cómo), or starts with a modal plus pronoun (can I, could you, should I, would it, puedo, debo, podría). Remove bare "can", "is", "are", "es", "son", "como", "por" as openers. `can of soup`, `es un tamal`, `son frijoles` are foods or corrections and never open a session.
4. **Correction prefixes.** Strip "no,", "no.", "actually", "it is a", "it's a", "es un", "es una", "en realidad" and mark the line as a correction that replaces the current food.
5. **Whole dish first.** Look up the whole line before splitting. Split only when the whole line returned nothing justified or the line contains a comma or plus. "and"/"y" never splits a line whose whole-line row covers both sides (`chicken and dumplings`, `biscuits and gravy`, `peanut butter and jelly sandwich`, `macaroni and cheese`); `pizza and salad` has no covering row and splits.
6. **Candidate mode in the UI.** Typed `candidate` renders through `FoodIdentityReview` (one proposed row, Yes / Change) when there is one candidate and through the `FoodNoMatch` chips when there are several, on both doors, with no score, chart, alternatives or actions until a tap. A tap sends `foodId` to the route, which is already deterministic.
7. **Corpus gate.** Fill in the real expectations in the P0 corpus test: mode, row code and basis for all 100 cases (20 exact foods and brands, 20 compounds, lists and overflow, 20 bilingual and ambiguous, 20 replacement and race sequences, 20 exclusions, failures and safety recovery). Required outcomes include: `apple` → Apple, raw by `head_canonical`; `honey nut cheerios` → 57241000 by `brand`; `chicken`, `soup`, `salad`, `coffee`, `pizza`, `diet coke` → `candidate`; `pollo asado`, `huevos`, `frijoles`, `leche`, `tamales` → `candidate` with the alias sets; `manzana` → Apple, raw by `alias`; `chicken and dumplings` → a dumplings dish row, never a plate; `No, it is a tamale` → correction, never a plate; `can of soup` and `es un tamal` → never `question`; a seven-item list → five scored plus two named as not scored. Zero false confident acceptances among the designated ambiguous cases; report abstentions separately.

Acceptance for this phase: A04, A06, A07, A19, A20, A21 from spec section 9, plus the corpus test green. Every existing e2e case in `food-critique.spec.ts` still passes, including "pan dulce" scoring on the Spanish door and "honey nut cheerios" scoring 58 with no token request.

Commit path-scoped: `feat(food): justified typed identity with alias table, candidate mode and whole-dish-first parsing (spec 30 A2)`.

## P5. Deploy A2

Repeat P3 exactly, with these production checks added and recorded verbatim:

- `POST /api/food/identify {"text":"pollo asado"}` returns `candidate`, three chicken rows, no score.
- `POST /api/food/identify {"text":"manzana"}` returns Apple, raw at 95.
- `POST /api/food/identify {"text":"chicken and dumplings"}` returns a dumplings dish row.
- `POST /api/food/identify {"text":"diet coke"}` returns `candidate`, never a cake row.
- In a browser on `/food/demo?lang=es`: type `es un tamal`; no token request; the tamale candidates render in Spanish.
- In a browser on `/food`: type `No, it is a tamale` after a scored food; one correction, not two foods.

Ledger note names the promotion policy, the alias entries shipped, the bare names now in candidate mode, and the owner decisions still open.

## Final report

Return, in this order: the three commit shas and the two deployment ids; the gate counts per phase; the A01 to A23 table with pass, fail or read-only for each; the corpus result (confident correct, candidate, abstain, false confident, by category); everything deliberately not done with the reason; everything not verified; and the six owner decisions with the default you applied for each.
