# Plate scan — one photo to a scored plate

> **Status: PLANNED — not started.**
> Scope: the /food door only. The public door /food/demo gains nothing (spec 24 owner decision 5, reaffirmed by spec 26, stands).
> Gate per phase: `npm run check` (bare, never piped) + `npm run crisis:gate` + Playwright chromium **and** mobile.
> Redeploy with `vercel --prod --archive=tgz`; git push does not deploy on this project.
> Origin: red-team of a ChatGPT feature conversation (2026-08-28). Verdict: build decomposition and coarse portions, skip the categorical health panel (the compass card already does it better), take the one-question refine idea.
> *The ask: point the camera at a whole dinner, tap once, and get 2–5 scored plate items with rough portions, one follow-up question, and carb numbers that can never be mistaken for insulin math.*

## 1 · The verdict

Today the lens names the single most prominent food in the frame (`IDENTIFY_SYSTEM`, `src/app/api/food/identify/route.ts:32`) and a real dinner is added one food at a time. This spec adds a deliberate "Scan plate" capture that decomposes one photo into 2–5 discrete foods, lands each as a `PlateItem` through the existing ledger match, proposes coarse half-step portions, and hedges photo-derived carbs.

Four features, in dependency order:

1. **Decomposition** (P0–P1). One model call returns discrete foods; each is carve-out-checked, ledger-matched, scored, and appended to the plate.
2. **Coarse portions** (P2). The model proposes grams; the server snaps them to half-step servings of the 100 g ledger basis; chips correct in one tap.
3. **Honest carbs** (P3). Display-only carb range plus grounding guards so photo estimates never feed insulin dosing or allergy clearance.
4. **One-question refine** (P4). Deterministic fat-added sibling detection turns the highest-value question ("cooked with oil?") into a chip that re-scores.

Deliberately out of scope:

- **No dish-level ingredient decomposition.** A curry, casserole, stew, soup, sandwich, or burrito stays ONE item. The FNDDS composite row already carries the invisible oil, cream, and butter in its survey recipe data; matching the whole dish beats guessing its parts.
- **No persistence changes.** `PlateItem` stays session-only `useState`; the plate's new fields never reach `mealLogEntrySchema`, `storage.ts` guards, or `schemas.ts`. A guard rejection resets every user to the Brent demo (`loadStoredStateResult` → `recoverRejectedState`, `src/state/storage.ts:1638`); this spec stays out of that blast radius entirely.
- **No public-door changes.** /food/demo has no plate, and keeps not having one.
- **No depth sensors, no multi-angle capture, no model-emitted nutrition numbers.**

## 2 · Architecture

```
photo (grabFrame(), 768px max edge, JPEG q0.7 — the only frame source)
  → POST /api/food/plate  {image, passcode?, patientId?}        NEW route, image-only
      → 1 vision call: PLATE_SYSTEM, json_object, temperature 0, detail:"high"
          {"foods":[{"name","grams","note","confidence"}]}      ≤5 foods; mass only, never nutrients
      → per food: classifyQueryScoreability → matchFood(index, name, 10)
      → unconfident names batched into ONE disambiguation call (2 model calls max total)
      → per-item payload: match (identify's match shape, minus alternatives and
        estimatedDomains) + candidates (≤4) + proposedServings + basis
  → /food door: append PlateItems { food: toIdentifiedFood(...), servings,
        compassScore, portion: {origin:"vision", basis} }        session-only
  → existing summarizePlate / PlateCard / buildPlateEntries carry the rest
```

### 2.1 · Boundary rules (numbered, checkable)

1. The model names foods and estimates **mass in grams**. It never states or estimates a nutrition score, calorie count, or nutrient amount (the same closing sentence `IDENTIFY_SYSTEM` uses, verbatim). Grams of food on a plate are a portion, not a nutrient; this is the line that keeps rule 2 true.
2. Every displayed number comes from the ledger. Portions scale ledger numbers through `scaleNutrition`, always applied to the **unscaled** food at render/log time (the `src/app/food/page.tsx:147` invariant: scoring reads the unscaled food; scaling rounds and would corrupt per-100 kcal ratios).
3. Composite dishes are one item. `PLATE_SYSTEM` instructs: mixed or integrated dishes (curries, casseroles, stews, soups, sandwiches, burritos, smoothies) are named as the single dish; only physically separate foods on the plate are separate entries.
4. Photo portions are estimates. `PlateItem.portion.origin === "vision"` until any user correction flips it to `"user"`; the carb range and estimate copy render only while `"vision"`.
5. No new persisted fields anywhere. `PlateItem.portion` is a session-only type extension in `src/domain/plate.ts`; `buildPlateEntries` ignores it; `MealLogEntry` is untouched.
6. The new route copies the identify gate discipline exactly: provider check (`HEALTH_AI_PROVIDER === "openai"` + `HEALTH_AI_API_KEY`) **before** the `DEMO_PASSCODE` check; `{mode:"unconfigured"}` / `{mode:"locked"}` at HTTP 200; 502 only on upstream throw/timeout; `export const dynamic = "force-dynamic"`; `Cache-Control: no-store`; `OpenAI-Safety-Identifier` via `buildVoiceSafetyIdentifier` (Node runtime); `AbortSignal.timeout(15_000)` per call.
7. Nothing new imports the store, and nothing in the shared Layer-1 files reads a route. Any new shared component/hook is added to `ROUTE_BLIND_FILES` in `scripts/check-public-door-store-free.mjs`; door-local components on /food need nothing.
8. Decomposition never answers allergy or child-safety questions. Ingredient recall from a photo runs about one-in-three wrong; clearance claims are blocked in both prompt and verifier (P3).
9. The identify route and its response union are untouched. Six call sites consume it (`use-live-food-score`, `use-compass-score`, `compass-instructions`' `lookupFoodScore`, `food/page.tsx`, `food/demo/page.tsx`, three e2e stub fixtures), and its route tests pin model spend by fetch call count. The plate pass is a sibling route.

## 3 · Response contract (frozen in P0)

```ts
// POST /api/food/plate   body: { image: string, passcode?: string, patientId?: string }
type PlateResponse =
  | { mode: "plate"; items: PlateItemResult[] }   // ≥1 item
  | { mode: "none" }                              // model saw no food, or zero items survived
  | { mode: "unconfigured" }
  | { mode: "locked" }
  | { mode: "error"; message: "empty_request" | "plate_request_error" };

type PlateItemResult =
  | { kind: "match";
      match: IdentifyMatch;              // identify's match shape minus alternatives + estimatedDomains:
                                         // { food: {code, description, group}, tier: "T1",
                                         //   score: CompassScore, nutrients: FnddsRecord | null }
      candidates: Candidate[];           // ≤4, deduped by code, primary first ({code, description, fcs})
      proposedServings: number | null;   // half-steps, clamped [0.5, 6]; null when grams missing
      basis: string | null }             // the model's human phrase, e.g. "about two cups"
  | { kind: "carve_out"; name: string; reason: NotScoreableReason }
  | { kind: "none"; name: string; candidates: Candidate[] };  // ledger match unconfident or absent; ≤3, may be empty
```

Carve-outs are **per item** so one glass of water cannot swallow the plate. (The identify route's whole-response `{mode:"carve_out"}` contract stays exactly as is for its consumers.)

Model output contract, parsed with zod following the `labelExtractionSchema` pattern (every field independently `.catch(null)` so one implausible value cannot discard the rest; entries with empty names dropped; more than 5 entries truncated; `confidence < 0.3` dropped; `grams` accepted only in (0, 2000]):

```json
{"foods":[{"name":"grilled chicken breast","grams":140,"note":"about one breast","confidence":0.9}]}
```

`proposedServings = clamp(roundToHalf(grams / 100), 0.5, 6)` because `toIdentifiedFood` emits per-100 g facts with `servingGrams: 100` — one serving of a T1 ledger match **is 100 g**. The helper lives in `src/domain/plate-scan.ts` with unit tests.

Disambiguation batching: items where `matchFood(...).confident` is false are collected into ONE second model call listing each item's name and its top rows, returning `{"choices":[{"item": n, "row": m | -1}]}`. Total model spend per scan: 1 call when all items are confident, 2 calls otherwise, never more. `row: -1` (or an out-of-range row) demotes that item to `kind:"none"` with its top-3 candidates still attached so the UI can offer chips.

## 4 · What deliberately stays

| Surface | Stays because |
|---|---|
| identify route, response union, its 6 consumers, its call-count tests | the plate pass is a new sibling route; nothing existing changes |
| `e2e/food-lens.spec.ts`, `e2e/food-demo.spec.ts`, `e2e/food-lens-shell.spec.ts` | byte-unchanged gate through P4 (their identify stubs match on `body.image` and never see the new route) |
| PlateCard average rules (a plate of one is never an "average") | pinned by `plate-card.test.tsx` and spec 25 §6 |
| `summarizePlate` / `summarizeDayTotals` scalar sums | carb ranges are display-only; stored entries keep point estimates; `null` still means incomplete, never uncertain |
| `mealLogEntrySchema`, `storage.ts` guards, `schemas.ts` | no persistence changes in this spec |
| public door capabilities and input shape | spec 24 owner decision 5, reaffirmed by spec 26 |
| `grabFrame()` at 768 px / q0.7 | one frame source; a higher-res capture path is decision point 5 in §9, deferred |
| live-loop economics (`detail:"low"`, 2.5 s cadence, scene gate) | the plate scan is a separate, user-initiated spend class; it never rides the loop cadence |

## 5 · Hard safety rules (these become code and tests, not vibes)

1. **Insulin dosing.** Photo-derived carb numbers must never be presented as usable for insulin math. Two halves, both required:
   - Verifier: new patterns in `src/domain/grounding.ts` beside `MEDICATION_CHANGE_PATTERNS` blocking dose-calculation help. Anchor on dose arithmetic, never on proximity to a bare `for`: `insulin`/`bolus` + a computation verb (`calculate`, `figure`, `cover`) + a number with units, and `insulin-to-carb ratio` / `carb ratio` arithmetic. Refusal and negation shapes must NOT match: the hedge copy this spec itself mandates ("Never use them for insulin math; follow your care team's plan") and the existing mock safety note ("Do not stop or change the dose…", pinned at `grounding.test.ts:200-208`) must both keep passing — every typed food answer runs through this verifier, and a pattern that matches the refusal silently swaps compliant answers for the generic grounding fallback. Add the hedge sentence to the must-pass corpus in `safety-gate.test.ts` so the P3 gate proves the refusal survives the verifier. The existing `take N units` tripwire already blocks stated doses; this adds only the calculation-help shapes.
   - Prompt: one new line saying photo carb numbers are rough estimates, never help compute an insulin dose, point to the care team's plan. It must land in THREE places, because `GROUNDING_SAFE_PHRASING` does not reach live voice: (a) `GROUNDING_SAFE_PHRASING` (`src/ai/food-instructions.ts:85`) for the typed vision, pantry, and compass prompts; (b) the base section list in `buildFoodLensInstructions` (`food-instructions.ts:64-76`), which is what the realtime voice session actually uses (`use-food-voice-session.ts:249-251` never spreads the phrasing guards); (c) a matching dose-calculation check in the voice output guard (`src/ai/output-guard.ts`), which never runs `verifyGrounding` — its corpus in `output-guard.test.ts` is already inside `crisis:gate`.
   - The refusal copy points to the patient's care plan. It never offers a formula, and it never scolds. Fast unsafe action must always read worse than deliberate care.
2. **Allergy and child-safety clearance.** The coach must never clear a food for an allergy or a child from a photo. Verifier patterns target clearance-shaped claims ("safe for your peanut allergy", "your child can eat this", "okay for your celiac") anchored on allergy/child terms plus a safety verb; the prompt line says to recommend the label and the care team instead. Watch overblocking: "this is high in peanuts" must still pass. Corpus cases in `src/ai/safety-gate.test.ts` (already inside `crisis:gate`, so the guard is gate-enforced with zero wiring).
3. **The glucose-extractor prefix contract stays.** `extractGlucoseClaims` requires a "blood sugar|glucose" prefix precisely so "65 g of added sugar" is not misread; the existing `grounding.test.ts` pin ("does not misread grams of added sugar") must still pass untouched.
4. **Numbers stay deterministic.** `PLATE_SYSTEM` and the batch-disambiguation prompt both carry the identify routes' verbatim prohibition on stating or estimating scores, calories, or nutrient amounts.

## 6 · Copy (en + es land in the same commit, always)

All keys append to the `FoodLensStringKey` union inside the matching surface cluster (`plate*` / `portion*`), with en and es values at the matching positions in `foodLensStrings` (`src/i18n/strings.ts`). The locale-parity suite (`src/i18n/strings.test.ts`) auto-covers new keys: key-set equality, per-key placeholder equality, no empty strings. TypeScript strict makes a missing es value a build failure, so both languages ship per phase, not as a cleanup phase.

Draft en values (Tama voice: short, plain, no hedging theater; es at existing catalog quality):

| Key | en |
|---|---|
| `plateScanButton` | Scan the plate |
| `plateScanBusy` | Reading the plate… |
| `plateScanFailed` | Could not read the plate. Try again. |
| `plateScanUnavailable` | Plate scan needs the live camera key. |
| `plateScanEmpty` | No separate foods found. Get the whole plate in view and try again. |
| `plateSkipped` | Skipped: {items} (not scored) |
| `platePortionBasis` | Photo estimate: {basis} |
| `portionChipHalf` | Half that |
| `portionChipAbout` | About right |
| `portionChipDouble` | Double it |
| `plateCarbRange` | about {low}–{high} g carbs |
| `plateCarbEstimateNote` | Carb numbers from a photo are rough. Never use them for insulin math; follow your care team's plan. |
| `refineOilQuestion` | Cooked with oil or butter? |
| `refineNoOil` | No oil |
| `refineWithOil` | With oil or butter |
| `refineFried` | Fried |

Notes: `plateServings` already dodges pluralization with "{count} serving(s)"; reuse that dodge. `t()` leaves an unknown `{var}` literal in the output with no error, so double-check var names at every call site. The en dash in `plateCarbRange` is a numeric range, which the voice rules allow.

## 7 · Phased plan

Every phase is a complete, committed, **pushed**, green unit (commit path-scoped and push per phase; push does not deploy on this project). **Gate per phase:** `npm run check` (lint && vitest && store-free witness && build && bundle budgets — run it bare, never piped) + `npm run crisis:gate` + Playwright chromium **and** mobile — with `e2e/food-lens.spec.ts`, `e2e/food-demo.spec.ts`, and `e2e/food-lens-shell.spec.ts` byte-unchanged through P4. The 4 dr-screening e2e failures (urgent + normal tier, chromium and mobile) are accepted pre-existing failures per the deploy ledger; a run showing exactly those 4 is green.

| Phase | Content | Effort | Key detector if wrong |
|---|---|---|---|
| P0 | `/api/food/plate` route: PLATE_SYSTEM + zod parse + per-item carve-out/match + batched disambiguation + `plate-scan.ts` helpers; route tests pin the call budget | 0.5 d | route tests: fetch call counts (1 confident / 2 max / 0 non-image) |
| P1 | /food scan button + items land as PlateItems + basis line + per-item candidate swap + visible unconfigured/locked; e2e stub + new `e2e/food-plate.spec.ts` | 1 d | new e2e green twice (desktop + mobile); visual pass incl. blank state |
| P2 | Half / About right / Double chips + snap/clamp + origin flip + stepper interop | 0.5 d | `plate-card.test.tsx`; no-rounding-drift test |
| P3 | Carb range display + insulin/allergy grounding guards + `formatPlateContext` estimate line + corpus tests | 0.5 d | `crisis:gate` report; grounding tests |
| P4 | One-question refine: `plate-refine.ts` fat-added sibling detection + chip row + foodId re-score swap | 0.5 d | unit tests on real FNDDS description pairs |
| P5 | Full verification + visual pass + ship: deploy (`vercel --prod --archive=tgz`) + `DEPLOYS.jsonl` line + push | 0.5 d | prod probes; ledger line |

### P0 · Server route and domain helpers

New files:
- `src/app/api/food/plate/route.ts` — copy the identify route's skeleton: same env gating order (provider before passcode), same `MAX_IMAGE_CHARS = 1_500_000`, same 200-status mode discipline, own `askModel`-style helper sending `detail: "high"` (this is a one-shot user-initiated call, not the loop; the ~768 px source frame keeps the token cost bounded). `max_tokens` ≈ 500 for the decomposition call. No text path: a body without a valid image is 400 `empty_request`.
- `src/domain/plate-scan.ts` — pure helpers + types: `PlateItemResult`, `servingsFromGrams(grams)` (`clamp(roundToHalf(grams/100), 0.5, 6)`), `CARB_RANGE_BAND = 0.3` (used in P3), and the zod schema `plateVisionSchema` following `label-extraction-schema.ts` (`.catch(null)` per field). Keeping helpers in `src/domain/` keeps the route thin and lets the client import the types; minisearch stays server-side (`buildFoodSearchIndex` must never reach a client bundle).
- `src/app/api/food/plate/route.test.ts` — follow `identify/route.test.ts` conventions exactly: `ORIGINAL_ENV` snapshot, `beforeEach` deletes `HEALTH_AI_PROVIDER`/`HEALTH_AI_API_KEY`/`DEMO_PASSCODE`, `vi.spyOn(globalThis, "fetch")` with chained `mockResolvedValueOnce`, `afterEach` restores env + `vi.restoreAllMocks()`.

Server flow per request: parse body → reject a missing/invalid image with 400 `empty_request` → provider gate → passcode gate → decomposition call → zod parse (reject to `{mode:"none"}` when zero foods survive) → for each food: `classifyQueryScoreability(name)` (per-item `kind:"carve_out"`; all 5 `NotScoreableReason` values handled downstream even though only 4 are query-decidable) → `matchFood(data.index, name, 10)` → confident items resolve immediately; unconfident items go to the single batched disambiguation call → assemble per-item payloads with `lookupScore(food, siblings, nutrients)` (siblings from `data.byCode`), candidates deduped/capped at 4.

Test list (pin each): non-image body → 400 `empty_request`; unconfigured; locked (set `DEMO_PASSCODE`); happy path, 3 confident foods → exactly 1 fetch call, 3 `kind:"match"` items with correct `proposedServings` snapping (140 g → 1.5, 80 g → 1, 30 g → 0.5, 900 g → 6); one unconfident item → exactly 2 fetch calls; water among foods → per-item `carve_out` while the rest match; `grams: null` → `proposedServings: null`; 7 foods returned → 5 items; upstream `!ok` → `{mode:"none"}` (matching identify: a rate-limited key reads as "nothing seen"); thrown/timeout → 502 `plate_request_error`; `row: -1` in disambiguation → `kind:"none"` with candidates.

### P1 · The /food door

- `src/components/plate-scan-button.tsx` — door-local (only /food imports it, so the store-free witness and `ROUTE_BLIND_FILES` are untouched). Props: `{ language, busy, unavailable, onScan }`. Place it beside the existing pantry-scan and label-photo triggers on /food, matching their visual pattern. When the live loop is already provider-disarmed (`disarmReason "provider"`), render it disabled with `plateScanUnavailable` inline; when a scan returns `unconfigured`/`locked`, show the same message. A dead-looking button that does nothing is banned by demo posture rules.
- `src/app/food/page.tsx` — `scanPlate()`: `grabFrame()` (null-guard → `plateScanFailed`); POST `/api/food/plate` with `{image, passcode, patientId}` (thread `usePasscode`'s value or the surface silently locks if `DEMO_PASSCODE` ever returns); on `mode:"plate"`:
  - map `kind:"match"` items → `PlateItem { id: crypto.randomUUID(), food, servings: proposedServings ?? 1, compassScore: {fcs, band, tier}, portion: { origin: "vision", basis } }`, where `food` copies the `page.tsx:124` transform verbatim per item: `toIdentifiedFood({ ...match.food, fcs2: match.score.fcs, fcs1: 0, nova: 1, hsr: 0, nutriScore: "C", ambiguous: match.score.ambiguous }, match.nutrients)`. The abbreviated form without the filler fields does not typecheck (`FcsFood` requires them, `food-compass.ts:24-34`);
  - append all to `plateItems`; stash per-item candidates in door-local state keyed by plate-item id;
  - then mirror `onAddToPlate`'s cleanup: `rearmLiveScore()` (clears match, pin, and stash), clear `barcodeFood`/`labelFood`, reset the shared `logged` boolean.
  - `carve_out` items render as one short `plateSkipped` line. `kind:"none"` items with candidates render up to 3 add-chips reusing the `FoodNoMatch` pattern (`food-lens-blocks.tsx:174`, `onSelect(foodId)` → the same identify `{foodId}` re-score → append as a plate item); with no candidates they join the `plateSkipped` line. `mode:"none"` → `plateScanEmpty`.
  - Vision servings live on the PlateItems directly, never in the pre-plate `portionServings` state, so the portion-reset effect at `page.tsx:405-426` cannot clobber them.
- `src/domain/plate.ts` — add `portion?: { origin: "vision" | "user"; basis: string | null }` to `PlateItem`. `summarizePlate` and `buildPlateEntries` ignore it by construction.
- `src/components/plate-card.tsx` — per-item: `platePortionBasis` line when `portion?.basis`; up to 3 candidate chips (clone the `FoodCorrectionChips` chip pattern: `min-h-11 rounded-full`) for items that arrived with candidates; tapping one POSTs `/api/food/identify` `{foodId, passcode}` (the deterministic re-score path, zero model spend) and swaps that item's `food` + `compassScore` in place, then drops that item's chips. Do not touch `adoptMatch`: the live-lens pin is for the lens, and pinning here would silence the camera for 60 s.
- e2e: `e2e/food-plate.spec.ts` needs THREE stubs: `**/api/food/plate` fulfilling a canned two-item response, `**/api/food/identify` fulfilling image posts with a match (copy the `stubCameraMatch` idiom from `e2e/food-demo.spec.ts:29-42`), and `**/api/realtime/token` → `{mode:"mock"}`. Without the identify stub, the Playwright webServer's forced mock provider makes the live loop provider-disarm, P1's own rule then renders the scan button disabled, and every tap assertion fails. Keep fixtures as full literals — new required fields on `CompassScore` break e2e at runtime, not compile time. Assert: tap scan → two `plate-item` entries with basis copy and proposed servings → candidate chip swaps an item → Log plate → localStorage `home-health-ai-ownership-state` gains 2 mealLog entries sharing one `mealId` with scaled `carbsG`. Every spec runs twice (chromium + Pixel 7); copy the `scrollTo(0)` workaround pattern from `food-lens.spec.ts` for mobile.
- Bundle watch: /food is at ~296.5 KiB gzip against a 303 KiB ceiling (about 6.5 KiB of headroom) and /food/demo at ~186.2 against 192 (strings load there too). Keep the button tiny, reuse existing components, `dynamic(ssr:false)` anything heavier, and read the `bundle:ladder` output every phase.

### P2 · Portion chips

- Chips render on plate items while `portion.origin === "vision"`: `portionChipHalf` (servings × 0.5, floor 0.5), `portionChipAbout` (keep), `portionChipDouble` (× 2, cap 20). Any chip tap, and any stepper edit on that item, flips `origin` to `"user"` and hides the chips (and, after P3, the carb range).
- `changePlateServings` (`page.tsx:510`) gains a clamp to [0.5, 20] — it is currently uncapped; `capServings` only runs inside the spoken-portion parser.
- Rounding rule: servings are the only mutable value; nutrition is always derived per render from the **unscaled** `item.food.nutrition` × current servings. Never rescale a scaled value (integer/0.1 g rounding compounds). Add a test: half then double returns exactly the ×1 numbers.
- Stepper interop: `previousServing`/`nextServing` (duplicated in `plate-card.tsx` and `food-facts-card.tsx`) only produce 0.5, 1, 2, 3…; vision proposals in half-steps (1.5, 2.5) render fine via `formatServings` and the snap floor of 0.5 means the steppers' `<= 0.5` disable logic still holds. Leave the duplication alone; it is out of scope.
- Extend `plate-card.test.tsx`: chip visibility by origin, half/double math, origin flip, clamp.

### P3 · Honest carbs and the guard stack

- Display: while `portion.origin === "vision"` and `carbsG` is present, the plate item shows `plateCarbRange` with `low = floorTo5(0.7 × scaledCarbs)`, `high = ceilTo5(1.3 × scaledCarbs)` (`CARB_RANGE_BAND` in `plate-scan.ts`; rounding to 5 g keeps false precision out). The range is computed at render time and never stored; logged entries keep the point estimate, so `summarizeDayTotals` and `computeFoodFlags` are untouched. `plateCarbEstimateNote` renders once under the plate whenever any carb range is visible, with no lens gating on either the range or the note: `PlateCard` prints whole-plate carbs under every lens (`plate-card.tsx:65-67`; only day totals gate carbs to the diabetes lens), and the insulin sentence is safe copy for every patient.
- Precedent to follow for the hedged rendering: `compass-score.tsx:220-224` (score range with low/high copy) and `compassEstimateNote` with `T2_MEASURED_MAE`.
- Guards (§5): patterns + unit tests in `grounding.ts`/`grounding.test.ts`; the new `GROUNDING_SAFE_PHRASING` line; 4–6 end-to-end corpus cases in `safety-gate.test.ts` (insulin-dose calculation ask, "safe for my peanut allergy", "could my 4-year-old eat this", plus answers that must PASS: the hedge copy itself ("Never use them for insulin math; follow your care team's plan"), "this is high in carbs", "peanut butter is high in fat").
- `formatPlateContext` (`src/domain/plate.ts:129`) appends, when any item is vision-portioned: "Portions were estimated from a photo; call the carb and calorie numbers rough estimates." The existing closing instruction ("Use the numbers above exactly; do not recompute them") stays; the two compose: state the numbers exactly AND call them estimates.

### P4 · One-question refine

- `src/domain/plate-refine.ts` — `plateRefineQuestion(match, candidates)`: normalize the matched description and each candidate's; detect pairs that differ **only** by fat-preparation qualifiers ("fat not added in cooking" ↔ "fat added in cooking", "fried", "breaded"). Emit `{ question: "refineOilQuestion", options: [{foodId, labelKey}] }` mapping qualifiers to `refineNoOil` / `refineWithOil` / `refineFried` (fall back to the trimmed description when no label fits). Unit-test against 2–3 real description pairs pulled from `src/data/food-compass/fcs2-foods.json` during implementation, plus negatives (candidates that differ by food, not preparation → no question).
- UI: at most **one** question per scan (that is the product point) — attach it to the qualifying item with the highest calories at current servings. Chip row under that plate item; a tap runs the same P1 foodId-swap path and removes the question. No model call anywhere in this phase.

### P5 · Verify and ship

- Full gates, bare: `npm run check`, `npm run crisis:gate` (commit the dated report under `docs/ops/red-team-results/`), `npm run test:e2e` with both projects. Do not edit `src/` while e2e runs (hot reload corrupts the run); expect the dev-preview `.next` collision if a preview server is up (restart the preview; not a code bug).
- Visual pass per project rules: `npm run dev`, open /food, confirm the scan flow end to end AND that the blank state is blank (test after a real `deleteDemoData`, not on first load — first paint is the Brent demo until hydration completes). Confirm /food/demo is unchanged.
- Ship: `vercel --prod --archive=tgz`; verify against the alias `https://patient-centered.vercel.app` (never the tree, never the first deploymentUrl). Append the `DEPLOYS.jsonl` line with gates + verified probes: `POST /api/food/plate {}` → 400 `empty_request` (proves the route deployed without buying a model call), `POST /api/food/identify {text:"pizza"}` → `mode:"match"` (regression probe), /food and /food/demo → 200.
- Commits and pushes already happened per phase; P5 ends with the deploy, the ledger line, and a final push of the ledger + crisis-gate report files. The `ship-phase` skill automates the deploy + ledger + memory steps if preferred.

## 8 · Trap list (read before every phase)

1. Piping `npm run check` hides its exit code. Run it bare.
2. Editing `src/` during an e2e run hot-reloads under the suite and produces phantom failures; running e2e kills a concurrent dev server's `.next` (restart the preview).
3. The Playwright identify stubs in `food-demo.spec.ts` and `food-lens-shell.spec.ts` fulfill only when the posted body contains `image` and `route.continue()` otherwise; `food-lens.spec.ts`'s `stubEmptyFoodLens` fulfills every identify POST unconditionally. The plate route gets its OWN stub; a missed stub makes image flows return `unconfigured`, the loop disarms, and the failure looks like a UI bug.
4. Blanket `vi.useFakeTimers()` stalls fetch promises so code lands in catch paths indistinguishable from success (spec 26 §7.1 fixed this once). Narrow fake timers and assert the request actually fired.
5. Route tests that forget the `beforeEach` env deletes leak `HEALTH_AI_PROVIDER` across tests and silently flip deterministic tests into provider-mode tests.
6. `askModel`-style helpers return null on upstream `!ok` → that is `{mode:"none"}`, not an error; a rate-limited or bad key reads as "no food seen". Only a thrown fetch/timeout is a 502.
7. The portion-reset effect (`page.tsx:405-426`) re-parses the last utterance on every `identifiedFoodId` change. Plate-item servings are immune (they never touch `portionServings`), but do not route vision proposals through the pre-plate stepper state.
8. `adoptMatch` pins the lens for 60 s. Plate-item corrections swap in place and must not call it.
9. `mode:"none"`/`"error"` deliberately keep the last shown lens match (no-flash rule). The plate scan must not clear the lens on failure either; only success rearms.
10. ~1/3 of ledger foods have `nutrients: null` → `nutrition: null` → that item nulls every whole-plate total (`incomplete: true`) and has no carb range. Expected, not a bug.
11. `scaleNutrition` rounds (integers for kcal/mg, 0.1 g for grams). Always derive from the unscaled food; never rescale a scaled value.
12. `FoodFavorite.foodId` is the bare 8-digit FNDDS code; `IdentifiedFood.id` is `fndds:XXXXXXXX`. Plate items from the ledger must use `toIdentifiedFood` so favorites, history, and re-score chips keep working.
13. The shared `logged` boolean is reset by barcode detect, portion change, and add-to-plate; the scan path must reset it too or a stale "Logged" confirmation lingers.
14. The name-appears-once rule: `FoodVerdict` prints the food name only when the sticky strip is not already printing it; new blocks printing item names compete with this.
15. Slot discipline: an empty slot renders literally nothing (no heading over an empty body). One continuous screen; expand in place; as few words as possible.
16. `PlateCard`, `MealLogList`, `FoodConversation`, `PantryRecipes`, `FoodLabelFallback` are `dynamic(ssr:false)` for bundle reasons; follow suit for anything non-trivial. `PlateCard`'s key falls back to `${food.id}-${index}`; duplicate foods need the uuid `id`.
17. New `FoodLensStringKey` entries need en + es in the same commit (strict TS), same placeholders (parity test), appended inside the matching cluster in all three places (union, en, es).
18. The client casts identify/plate JSON without zod; a changed response shape fails nowhere loudly client-side. Freeze the P0 contract and treat any change as a breaking one.
19. HTTP status discipline: `unconfigured`/`locked` are 200 with a mode discriminator; 4xx/5xx only for `empty_request`/upstream throw. Existing client mode-switches depend on it.
20. Vitest only sees tests under `src/**`; Playwright only sees `e2e/`. A test in the wrong tree silently never runs.
21. No `backdrop-filter` or `drop-shadow` filters inside the scroll shell (recorded compositing regression).
22. Concurrent sessions share this tree: commit early, path-scoped; never `git reset --hard` or `git checkout --` over changes you did not make.

## 9 · Owner decision points

1. **`detail:"high"` on the plate route's decomposition call** (one-shot, user-initiated; roughly 10–20× the token cost of one loop frame, bounded by the 768 px source). *Recommended: yes.*
2. **Carb range band at ±30%, display-only, rounded to 5 g** (`CARB_RANGE_BAND` constant; tunable later against real scans). *Recommended: yes.*
3. **Public door stays without plate scan** (spec 24 owner decision 5, reaffirmed by spec 26; revisit only with a deliberate spec). *Recommended: yes.*
4. **Zero persistence changes in this spec** (plate stays session-only; ranges never stored; logged entries keep point estimates). *Recommended: yes.*
5. **Higher-resolution capture path for plate scans** (a `grabFrame(maxEdge)` variant at ~1024 px for the one-shot only). Defer until real-scan accuracy says the 768 px frame is the bottleneck. *Recommended: not now.*
