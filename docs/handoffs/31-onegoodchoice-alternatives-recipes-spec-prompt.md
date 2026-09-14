# Prompt: write spec 31, alternatives and recipes for 1 good choice

Paste everything below the line into a fresh Claude Code or Codex session opened at `C:\Patient centered`. It asks for a spec, not code.

---

You are writing spec 31 for 1 good choice, the Food Lens at `/food/demo` (public, store-free) and `/food` (personal) in `C:\Patient centered`. The goal is to bring back useful alternative recommendations and recipes on both doors. Write the spec and its README row only. Do not change code, data, config or tests, do not deploy, and do not call paid model routes. Typed lookups against `/api/food/identify` make no model call; use them freely. Observe behavior on production or through those lookups: a local dev server in this shared tree may be serving another session's edits.

## Read first

1. `CLAUDE.md` at the repo root. Its UI rules apply to everything you propose: fewest words, answers first, one continuous screen, expand in place, a blank state that stays blank, and key-dependent features that fail visibly.
2. `C:\Users\tsthe2\.claude\writing-rules.md`. The spec's prose and every proposed UI string follow it.
3. `docs/specs/30-onegoodchoice-trustworthy-choice.md`, all of it. R10 and Slice C are this spec's unbuilt predecessor. R1 (current-choice states), R4 (candidate mode) and the visible chart are contracts you keep. Section 13.6 decision 4 is still open and belongs to this spec.
4. `docs/specs/23-food-compass-live-lens.md`, owner decision 3: the original promise of deterministic alternatives, Google recipe links and two sort toggles, copied from Scott Black's prototype.
5. `docs/specs/README.md` and spec 30's layout, for format.
6. The grant, read-only. `C:\Users\tsthe2\OneDrive - University of Kentucky\Projects\One Good Health\proposals\drafts\2026-09-04 - One Good Choice - FAHA Review Copy.pdf` is the authority. Its greppable sibling, `2026-09-04 - One Good Choice - FAHA Submission Working Revision.md` (lines 58-74), defines a completed analysis as a score plus "an appropriate alternative or affirmation of the current choice", asks for suggestions that fit a comparable eating occasion, and rules out inventory and price claims. The primary outcome is at least one completed analysis in at least three of six weeks, so this spec is on the study's critical path. The 09-03 working draft (line 85) promised "one practical change, and provide a recipe link"; the 09-04 revisions dropped the recipe link. Check what the Review Copy says about recipes.

## What is true today

Verified 2026-09-13: API behavior on production (`4a0be55`, spec 30 A2), code on `master` (`32223e2`). Re-verify each item on your HEAD and correct any that no longer hold.

Alternatives and recipe links are still in the code on both doors. They seldom reach the screen, and what does reach it is often weak.

1. **Reach.** Spec 30 A2 sends bare names to candidate mode: no score and no alternatives until the person taps a row. `pizza`, `fried chicken`, `sweet tea`, `cornbread`, `white rice`, `mashed potatoes` and `black coffee` all stop there. Before A2 the identify route published rank 1 unconditionally (spec 30 section 13.2, blocker 4), so a bare name scored and listed alternatives in one step. In the frozen typed corpus (`src/test/fixtures/food-typed-corpus.json`), 36 of 100 cases expect a scored match and 39 expect candidate mode.
2. **Empty lists.** `findAlternatives` (`src/domain/food-compass.ts:804-900`) keeps rows from the same WWEIA category (or the same S5 group plus a shared word when a food has no category) that score at least 10 points higher, and returns the top 3. Across Table S5, 1,632 of 9,229 non-ambiguous rows get nothing; 416 of those already score 100. On production, Honey Nut Cheerios 58 and potato chips 47 get nothing. Banana 83 and soup beans 91 get the affirmation, which is right.
3. **False empty copy.** `CompassAlternatives` (`src/components/compass-score.tsx:252-258`) prints "Already one of the best choices in its group." at 70 and above and "Nothing similar scores higher." below. For 1,004 of the empty rows a higher row sits in the same pool and only the 10-point rule hid it, so the message is false; 513 of those print "Already one of the best". Plain Cheerios 77 is the known case (Uncle Sam 85 is in its pool). Spec 30's default for this case, "No close swap found", was never built. Both doors still print the "Better options" heading over an empty list, and `/food/demo` adds its two-option sort control (`src/app/food/demo/page.tsx:1013-1051`).
4. **Weak picks.** The default order ranks shared words first, so the list fills with the same food prepared another way. On production, after picking the first candidate where there is one: stuffed-crust pizza 21 → gluten-free and whole wheat veggie pizzas, 43-44; fried chicken wing 50 → the same wing with the skin not eaten, 63; white rice 15 → three rice rows cooked with fat or oil, 35-38; iced sweet tea 12 → hot chai with milk 35 and hibiscus tea 56; cornbread 33 → Puerto Rican yam buns 61; mashed potatoes 44 → potato salad 61. Names are raw FNDDS text. The swap a dietitian would name often sits in another category (plain Cheerios for Honey Nut) or has no row at all: Table S5 has no unsweetened tea or plain brewed coffee, and water is `carve_out zero_calorie`.
5. **Low-calorie rule conflict.** `src/ai/compass-instructions.ts:30` tells the voice model that anything under 5 kcal per 100 g has no score. At least four published rows sit under that line and still score. Hibiscus tea (0 kcal, 56) is one, and it is what sweet tea gets offered. Typed `unsweetened tea` returns three pre-sweetened candidates, so a swap that says "unsweetened tea" sends people into a lookup that cannot find it.
6. **Packaged foods.** A label-only estimate shows no alternatives on purpose (`e2e/food-lens.spec.ts:344`).
7. **Recipe link.** Each alternative carries "Recipe ideas", a Google search for "<FNDDS description> recipe" (`food-compass.ts:756-758`, `compass-score.tsx:275-282`). No alternative means no recipe link. It is the only recipe path on `/food/demo`.
8. **Pantry recipes.** "Find recipes in my pantry" exists only on `/food`, and only while the camera is on (spec 29 P4; `src/app/food/page.tsx:1557-1589`). One frame goes through `PantryProvider` (`src/ai/pantry-provider.ts`) to `/api/food/vision` in JSON mode and returns up to three cards with have and buy lists, a watch-out and a merged shopping list (`src/components/pantry-recipes.tsx`). The prompt (`src/ai/food-instructions.ts:134-145`) uses the patient's conditions and medicines and cites the care plan and latest reading, so it cannot move to the store-free door as written. Every tap calls the paid vision route.
9. **Voice.** The instructions on both doors ask the model for a better option when one exists (`compass-instructions.ts:31`; `food-instructions.ts:98, 166-171`), and the same list reaches it through context and, on the public door, the `lookup_food_score` tool. An empty list leaves it nothing grounded to suggest.

## Decisions the spec must make

Give each one a recommended default and its evidence, and mark the ones that need the nutrition lead or me.

1. **Pool.** What counts as a comparable alternative. Spec 30 R10 asked for nutrition-reviewed substitution families that cross WWEIA categories, cereal first, with Honey Nut Cheerios 58 → plain Cheerios 77 as the regression case. Propose the first families by eating occasion (breakfast cereal, sweet drinks, chips and snacks, bread, rice, fried mains, starchy sides) and say how each is built and reviewed. No broad group fallback that returns unrelated foods.
2. **Ranking and threshold.** Keep or change the 10-point rule; any change needs nutrition review. Rank so the practical swap beats a near-duplicate row. Decide whether a row that differs only by added fat or oil is a swap the nutrition lead would recommend.
3. **Swaps without a score.** How water, unsweetened tea or black coffee can be offered without inventing a number, and one rule for the under-5-kcal rows.
4. **Preparation changes.** Whether "bake it instead of frying" or "take the skin off" appears as a plain action with that row's score, and how FNDDS text becomes a short localized display name with the source row still attached (spec 30 R4).
5. **Empty and affirmation copy.** Exact English and Spanish for three cases: a higher row exists under the threshold; nothing comparable scores higher; this is already a good choice. No heading or sort control over an empty list.
6. **Reach under candidate mode.** Alternatives stay behind identity confirmation (spec 30 R1). Count taps from typing to the first alternative for every corpus case, and propose how to cut them without scoring a guess.
7. **How many to show.** One default with Compare and more on demand (spec 30 R10), or the list of three with a sort control that the public door has now (spec 23). Recommend one.
8. **Recipes.** Choose among a better search link (clean display name, better query), a vetted recipe source, and model-written recipes. For a source, check license, link stability, nutrition data and Spanish; start with USDA MyPlate Kitchen and Plate It Up! Kentucky Proud (a UK Cooperative Extension program; the grant reserves $3,000 for Extension collaboration). For pantry recipes, decide whether they stay personal-only, whether a typed list of what's on hand replaces the camera requirement, and whether a store-free public version is worth its spend. Any model-written recipe goes through `createSafeAiResponse`, prints no number the code did not compute, never clears an allergy or a therapeutic diet, and on the public door never mentions a plan, readings, medicines or a care team.
9. **Voice and typed answers.** Same eligible list as the screen; never name a swap the code did not supply; say what they say when the list is empty.
10. **Completion.** When a result counts as usable guidance for the grant (an alternative shown, or an affirmation). Instrumentation stays deferred.
11. **Personal-door extras** such as saved swaps or logging the alternative: in scope only if cheap, otherwise deferred.

## Constraints

- Code decides eligibility and every number. Scores come only from the published table. A model may later explain or order eligible options, nothing more.
- Keep spec 30's contracts: one current choice, candidate mode, the visible chart, both doors, Spanish parity, and a store-free public door (`scripts/check-public-door-store-free.mjs`).
- No availability, price, allergy or diet-fit claim without evidence. No retailer integration.
- Bundle headroom at the A2 measurement was about 2 KiB on `/food` (313.05 of 315 KiB) and 1.4 KiB on `/food/demo` (203.6 of 205), per `scripts/check-ladder-bundle.mjs`. Substitution tables stay server-side, like the alias table. Re-measure before sizing client work.
- Paid calls on the public door need a spend control. The grant allots $1,500 for hosting, model serving and software across 12 months.
- Anything added to the screen names what it replaces or removes.

## Evidence standard

Label claims O, X, C, J or H as spec 30 does. Re-run the table-wide count with the real `findAlternatives` from a scratch vitest config outside the tree (spec 30 section 10 describes that harness) and report it by score band and WWEIA category. Build a named alternatives case list: every food above, Kentucky foods (soup beans, cornbread, biscuits and gravy, fried catfish, sweet tea, fried chicken, mashed potatoes, green beans with bacon) and Spanish entries (`pan dulce`, `arroz con pollo`, `frijoles`, `tamales`). State what you could not exercise.

## Deliverable

`docs/specs/31-onegoodchoice-alternatives-and-recipes.md`, laid out like spec 30: status, baseline sha, product outcome, evidence table, R-numbered requirements, slices with dependencies and effort (first slice deterministic only: pool, ranking, honest copy; recipes after), an acceptance table with test IDs covering both doors, a verification plan, owner decisions, and review questions for an independent reviewer. Add its row to `docs/specs/README.md`.

Commit only those two files, path-scoped: `git commit -- docs/specs/31-onegoodchoice-alternatives-and-recipes.md docs/specs/README.md`, message `docs(specs): spec 31 alternatives and recipes`, then `git push origin master`. Other sessions edit this tree; never reset or check out over changes you did not make.

Reply with the decisions you recommend, the ones that need me or the nutrition lead, and what you could not verify.
