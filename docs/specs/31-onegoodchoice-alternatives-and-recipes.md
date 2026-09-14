# Spec 31: OneGoodChoice, alternatives and recipes

**Status:** C1 built and deployed 2026-09-14 (`1f0033c`, `333c618`; production `f3f7d23`, `dpl_HH1BqptYZ7eGPN5c6YHPLrzXNbid`), with C2's barcode swaps and C3's labeled recipe search. The owner released it before the nutrition lead and a Spanish reviewer signed off, so its families, targets, exclusions and names are live as proposed defaults and their reviews (section 10) still apply. Section 13 records the build and what changed from this draft.
**Date:** 2026-09-14. Evidence gathered 2026-09-13 and 2026-09-14.
**Author:** Claude (Opus 5), from `docs/handoffs/31-onegoodchoice-alternatives-recipes-spec-prompt.md`.
**Baseline:** HEAD `79eec03`. Its last code commit is `32223e2` (brand identity), committed and not deployed. Production is `4a0be55` (spec 30 A2), the last entry in `docs/ops/DEPLOYS.jsonl`.
**Surfaces:** `/food/demo` (public, store-free) and `/food` (personal), plus the identify route, Food Compass domain code, typed hook and voice context they share.
**Relation to other specs:** builds spec 30 R10 and Slice C; answers spec 30 section 13.6 decision 4; proposes retiring spec 23 owner decision 3's two sort toggles (section 10, decision 1). Spec 30 R1 (one current choice), R3 (store-free public door), R4 (candidate mode) and R11 (the visible chart) stay contracts.

## 1. Review requested

Review this spec against HEAD and production before anyone plans the build. Reproduce the counts in section 3 with the harness in section 9, test R1 to R3 against the named cases in appendix A, and say whether C1 is one slice or two. Return a verdict, ranked blockers and amendments, as spec 30 section 13 did.

Boundaries: no implementation, deploy, commit or paid model call. Typed and `foodId` lookups against `/api/food/identify` make no model call and are fine to repeat. Do not build against a `.next` that another session's dev server uses.

## 2. Product outcome

### What the grant counts

The 2026-09-04 Review Copy (page 4) counts an analysis as complete when it shows a score and usable guidance: "an appropriate alternative or affirmation of the current choice." Suggestions follow nutrition-lead-approved rules, fit a comparable eating occasion and make no inventory or price claim. A small score difference does not by itself make one food healthier. Release testing needs at least 95% of suggested alternatives to meet the prespecified rules (page 5). The primary outcome is at least one completed analysis in at least three of six weeks, so a confirmed food that ends with no swap and no affirmation may be a week that does not count.

The Review Copy never mentions recipes; a text search of all 10 pages finds none. The 09-03 working draft promised "one practical change, and provide a recipe link" (line 85), and the 09-04 revisions dropped the link. Recipes sit outside the completed-analysis definition, so they come after the swap work.

### Success

- After a confirmed food, one line under the verdict says what to do next: one swap that fits the same eating occasion, with its published score, or a true statement that the choice is fine as it is or that nothing similar scores clearly higher.
- The same swap appears on both doors, in both languages, on screen and in voice.
- No swap comes from a broad food-group guess, and no line claims a rank the table contradicts.
- Every number is a published Table S5 value or the existing labeled estimate. A swap with no number (water, unsweetened tea, black coffee) says it has none.
- A recipe link, when present, opens a vetted page and carries no model-written number or diet claim.

### Preserve

Spec 30's contracts: one current choice, candidate mode and its promotion policy, the visible chart, both doors, Spanish parity and the store-free public door (`scripts/check-public-door-store-free.mjs`). Published scores. The 10-point rule unless the nutrition lead changes it. Typed lookup with no model call. A label-only package estimate still shows no swap (`e2e/food-lens.spec.ts:344`).

### Out of scope

A new score or nutrient inference; availability, price, allergy or therapeutic-diet claims; retailer integration; swaps on plates (spec 30 R6 still governs plates); storage schema changes; research instrumentation (spec 30 section 11); any paid call on the public door.

## 3. Evidence

Labels follow spec 30: O = fresh observation (here, production API responses and live web pages; no browser was used on either door), X = direct execution of current functions, C = code finding, J = design judgment, H = hypothesis to test. Requirements in section 4 are J unless they cite an E row.

Method. A scratch vitest config outside the tree, with `@` aliased to `src` (spec 30 section 10), ran the real `findAlternatives` over all 9,229 non-ambiguous Table S5 rows. It also called the identify route handler for 102 named queries and for the 100 corpus cases, following the typed hook's order of operations (`stripCorrectionPrefix`, `isQuestionLine`, `splitPlateLine`, the whole line first, then `splitSuggested`). To keep the run short, each call received only the rows the function's own filters keep; on a 197-row sample that matched the full-table call exactly, and the empty count matched the handoff's replica (1,632). The same 102 queries went to production as typed text, then as a `foodId` for the first chip under each sort preference: 408 requests, none reaching a model. A clean `git archive` of HEAD was built in the scratchpad and measured with the repo's own `scripts/check-ladder-bundle.mjs`. The harness and its outputs stayed in the session scratchpad; section 9 turns the harness into committed tests.

| ID | Evidence | Finding and source |
|---|---|---|
| E01 | X | Reach. Of the 100 corpus cases, 5 show an alternative with no tap after submitting and 35 need one chip tap. 60 never show one: 23 scored matches with an empty list, 12 plate lines or plate items, 9 safety intercepts, 7 carve-outs, 5 misses with no chips, 2 candidates whose chips have no alternatives, 1 question and 1 empty line. Of the 28 typed lines that score directly, 5 show an alternative. `src/test/fixtures/food-typed-corpus.json`; appendix B. |
| E02 | X | Empty lists. 1,632 of 9,229 rows get none, and 416 of those score 100. For 1,004, a higher row sits in the pool and only the 10-point rule hid it; the screen then prints "Already one of the best choices in its group." for 513 and "Nothing similar scores higher." for 491. 141 of the 513 sit in their pool's top tenth; for the other 372 the claim is false outright. 212 empty rows have nothing higher in their pool, so their line is true. `food-compass.ts:804-900`, `compass-score.tsx:252-258`. |
| E03 | C | A heading over nothing. `/food` prints "Better options" whenever a published score exists (`page.tsx:1484-1496`). `/food/demo` prints "Better options · highest score first" and a two-radio sort control for every match, empty or not (`demo/page.tsx:1013-1051`). |
| E04 | O | Unrelated picks on production. After the first chip on the public door, which sorts by score: fried chicken → Chicken liver, braised 81; Chicken liver, fried 71; Egg substitute omelet 71. Pizza → Topping from vegetable pizza 56; Topping from cheese pizza 51. Beef bologna 1 → Beef liver, braised 74, on both doors. Bacon 26 → Cocoa powder, not reconstituted 91, from the WWEIA bucket "Not included in a food category". Latte 58 → Coffee substitute 90; Cereal beverage 87. Lemonade 1 → Wine, nonalcoholic 49. Fried fish 77 → Fish, NS as to type, raw 100, on both doors. Fried chicken, bologna and fried fish reach these through the group-plus-one-shared-word fallback; the rest come from inside a WWEIA category. |
| E05 | C, X | The doors disagree, and the public door mislabels its order. `/food` asks with no sort preference, so shared words come first. `/food/demo` sends `preferHigherScore` for chip taps and sort changes (`demo/page.tsx:110, 172-173, 649-652`), but a typed direct match arrives through `useTypedFoodScore`, which sends no preference (`use-typed-food-score.ts:81-85`), and is shown under "highest score first". The first alternative differs between the two orders for 4,777 of the 7,273 rows that have two or more. |
| E06 | X | Near duplicates. The default order's first pick shares the current food's head word (the text before the first comma) for 2,929 of 7,597 rows, and all three shown do for 1,804. 100 first picks differ from the current food only in fat wording; 21 of those add fat or oil, as in plain white rice 23 → Rice, white, cooked, made with oil 37. |
| E07 | X, O | Drinks. Table S5 has no plain brewed tea, plain coffee or plain water row. All 14 soft drinks score 1. The 14 Tea rows are hibiscus, chai with milk and pre-sweetened or bottled teas (median 12). The only water rows are flavored bottled waters scoring 1 to 21. Four scored rows sit under 5 kcal per 100 g, against `compass-instructions.ts:30`: Tea, hibiscus 56 (0 kcal), two low-calorie fruit drinks (24 and 1) and an herbal sweetener (13). On production, sweet tea's list is a lemonade drink 30, hibiscus tea 56 and chai 35, and typed `unsweetened tea` returns the same three pre-sweetened chips as `sweet tea`. |
| E08 | C | Packaged foods. A label-only estimate shows no swap by design. A barcode that maps to a published row shows none either: `use-compass-score.ts:75-76` drops the name for barcode sources, `PublishedFoodMatch` carries no list (`use-barcode-review.ts:13-18`), and `page.tsx:371-378` passes the empty result on. |
| E09 | C, O | Recipes. Each alternative links to a Google search for "<FNDDS description> recipe" (`food-compass.ts:756-758`, `compass-score.tsx:275-282`), and `route.test.ts:211-219` asserts the Google URL. USDA MyPlate Kitchen recipe and search URLs now return 301 to the MyPlate.gov home page (checked 2026-09-14). Plate It Up! Kentucky Proud is live at `fcs.mgcafe.uky.edu/plate-it-up`, with per-serving Nutrition Facts, English only, no recipe search and 167 recipes. |
| E10 | C | Pantry. `/food` only, camera on only (`page.tsx:1560-1581`). Each tap sends one frame to `/api/food/vision` in JSON mode, and the prompt carries conditions, medicines and the care-plan citation (`food-instructions.ts:137-145`, `pantry-provider.ts:28-31`). |
| E11 | C | Voice can name swaps the code did not supply. The public persona says "Suggest a better option in the same food group when you have one." (`compass-instructions.ts:31`). The personal lens tells the model to keep a suggested option "generic (a food category or common product type)" (`condition-lens.ts:117-118`), which reads as permission to invent one when the list is empty, and the phrasing guard's own example is "a lower-sodium version would be a better pick" (`food-instructions.ts:115`). The public lookup tool maps candidate mode to `no_match` (`compass-instructions.ts:124-126`), so a spoken "pizza" gets neither a score nor a choice. |
| E12 | O | Spanish staples miss. `refresco` offers Queso Fresco; `jugo de naranja` offers pico de gallo; `papas fritas` offers Mexican stewed potatoes; `pollo frito` an asopao; `pan blanco` a banana; `té dulce` pan dulce; `café` café con leche. None of these scores a wrong row, so spec 30 R4 holds, and none of the chips is the food meant. Alternatives on the Spanish door print English FNDDS text (`compass-score.tsx:268`). |
| E13 | O | Kentucky staples miss. `country ham` offers country-style pork sausage, a granola and prosciutto; `hot dog` offers the bun first; `hot brown` offers brown rice; `macaroni and cheese` offers beef and macaroni first; `green beans with bacon` offers green beans cooked with oil; `fried chicken` offers wing, thigh and breast fried with no coating; `white rice` offers glutinous rice first. |
| E14 | X | Bundles at HEAD, from a scratch build: `/food/demo` 204.3 of 205 KiB, `/food` 313.6 of 315 KiB, Ladder first load 315.7 of 316 KiB. The public door has 0.7 KiB of headroom. The handoff's figures predate `32223e2`. |
| E15 | O, X | Production matches HEAD for 96 of 102 probes. The 6 differences come from `32223e2`'s brand rewrites (coca cola, sprite, diet coke, red bull, lay's, cheetos). `cheetos` regresses at HEAD: production reaches the table's own Cheetos row (17), and HEAD rewrites it to a generic corn-puff row (23). A separate fix has been suggested. Typed lookups from this machine took about 140 ms at p50 and 280 ms at p95. |
| E16 | X | Threshold sensitivity, from a pool replica that matches the real count at 10: rows with no qualifying alternative at a 1-point rule 628; 5 points 976; 10 points 1,632; 15 points 2,265; 20 points 2,990. |

### 3.1 The handoff's claims on this HEAD

| # | Claim | Result |
|---|---|---|
| 1 | Bare names stop at candidate mode | Holds on production and HEAD for all seven names; the corpus tally is 36 match and 39 candidate. |
| 2 | 1,632 empty lists, 416 at 100 | Holds exactly. Honey Nut Cheerios 58 and potato chips 47 are empty; banana 83 and soup beans 91 get the affirmation. Soup beans' affirmation sits over 13 higher bean rows (up to 100) that the threshold hid. |
| 3 | 1,004 false empty lines, 513 of them "best" | Holds. 141 of the 513 are in their pool's top tenth. |
| 4 | Weak picks | Holds, and the public door's score order is worse (E04). |
| 5 | Low-calorie conflict | Holds: 4 rows. |
| 6 | Packaged foods show none | Holds, and it also covers barcode rows that map to a published row (E08). |
| 7 | The recipe link is a Google search | Holds. MyPlate Kitchen, the handoff's first candidate source, is offline (E09). |
| 8 | Pantry is personal, camera-only and paid | Holds. |
| 9 | Voice asks for better options | Holds, and the lens guidance invites invented swaps (E11). |
| - | Headroom of 2 KiB and 1.4 KiB | Corrected to 1.4 KiB on `/food` and 0.7 KiB on `/food/demo` (E14). |

### 3.2 Table-wide counts

| Band | Rows | With a list | Empty | At 100 | Hidden by the 10-point rule (line printed) | Nothing higher in pool |
|---|---|---|---|---|---|---|
| Encourage (70+) | 2,131 | 1,125 | 1,006 | 416 | 513 ("Already one of the best") | 77 |
| Moderate (31-69) | 4,213 | 3,667 | 546 | 0 | 452 ("Nothing similar scores higher.") | 94 |
| Minimize (30 or less) | 2,885 | 2,805 | 80 | 0 | 39 ("Nothing similar scores higher.") | 41 |
| All | 9,229 | 7,597 | 1,632 | 416 | 1,004 | 212 |

Rows with a WWEIA category use it as their pool (6,150 rows, 1,208 empty). The 3,079 pre-2017 rows use the group-plus-shared-word fallback (424 empty).

Most empties by WWEIA category: no category 424 of 3,079; Other vegetables and combinations 82 of 151; Fish 77 of 233; Other dark green vegetables 63 of 65 (59 at 100); Beef, excludes ground 58 of 76 (top score 51); Chicken, whole pieces 53 of 157 (top 69); Pork 51 of 82 (top 54); Rice mixed dishes 35 of 136; Eggs and omelets 33 of 151; Nuts and seeds 32 of 78; Potato chips 16 of 30 (top 54); Soft drinks 14 of 14 (every row scores 1); Frankfurters 11 of 11 (top 3); Rice 10 of 30; Ready-to-eat cereal, higher sugar 10 of 86 (top 65).

### 3.3 A prototype of the proposed rules

A scratch model of R1, R2 and R4 ran over the whole table (X, indicative: the families are unreviewed, the drink rule in R3 was not modeled, and its action rule was looser than R4's):

- Inherited categories reach 1,601 of the 3,079 pre-2017 rows.
- 6,790 rows get a swap, against 7,597 with a list today, and 1,126 encourage-band rows get the affirmation. 1,000 rows lose their list: 845 pre-2017 rows with no category and no same-head row 10 points higher, 94 whose inherited category has nothing, 55 whose only candidates were excluded, and 6 others. 193 rows gain one.
- The lost lists are mixed. Some were cereal to cereal through the fallback (Kashi cereal 73 → Uncle Sam 85); many were not (Frosted Wheat Bites 55 → Macaroni, whole wheat 82; 100% Bran 58 → Rice, wild 77; High protein bar 50 → Flour and milk patty 80). The reviewed family table can add pre-2017 members by food code (R1).
- Top swap by kind: same category 5,019; preparation action 1,415; same head word with no category 195; another category in the family 143; product line 18.
- Corpus: usable guidance with no tap after submitting goes from 22 to 28 cases. Honey Nut Cheerios (twice) and Cheerios Protein gain a swap, and Mountain Dew, Ale-8 and diet coke gain a drink swap. One-tap guidance goes from 36 to 34 and no guidance from 42 to 38. Four of today's 22 are the false Cheerios "best" line.

## 4. Requirements

### 4.0 The eleven decisions at a glance

| # | Decision | Recommended default | Evidence | Needs |
|---|---|---|---|---|
| 1 | Pool | Reviewed eating-occasion families, product-line and preparation swaps, inherited categories for pre-2017 rows, no group fallback (R1, section 5) | E02, E04, 3.3 | Nutrition lead |
| 2 | Ranking and threshold | Keep 10 points; practical kinds first; one order on both doors; never a swap that only adds fat or oil (R2) | E05, E06, E16 | Nutrition lead |
| 3 | Swaps without a score | Water, sparkling water, unsweetened tea, black coffee for sugar-sweetened drinks; under-5-kcal rows not scored (R3) | E07 | Nutrition lead |
| 4 | Preparation changes | Six named actions with the row's score and source row; reviewed display names (R4) | 3.3, appendix A | Nutrition lead, Spanish reviewer |
| 5 | Empty and affirmation copy | Three one-line states, no heading or sort control (R5, section 6) | E02, E03 | Nutrition lead, Spanish reviewer |
| 6 | Reach | Reviewed default rows and candidate sets; barcode rows get swaps (R7) | E01, E08, E12, E13 | Nutrition lead, Spanish reviewer |
| 7 | How many | One swap, "More swaps" in place, comparison in place (R6) | E03, E05 | You |
| 8 | Recipes | One link on the default swap: curated UK Extension page first, labeled web search second; pantry stays personal (R10, R11) | E09, E10 | You, Extension collaborator |
| 9 | Voice and typed answers | Same list and state as the screen; no swap the code did not supply (R8) | E11 | Content review only |
| 10 | Completion | Confirmed food, score, and a swap or the affirmation (R9) | Grant | You, for water |
| 11 | Personal-door extras | "Use this instead" then "Log this"; saved swaps deferred (R12) | spec 30 R3 | None |

### R1. Who is eligible

- Families. A reviewed, versioned table maps eating-occasion families to WWEIA categories, preferred targets and exclusions (section 5). It lives server-side and only the identify route imports it, like the alias table in `food-compass-search.ts`.
- Pools, in order, for a confirmed row: (1) a product-line sibling, meaning a brand row's plainer sibling in the same line (Cereal (General Mills Cheerios Honey Nut) → Cereal (General Mills Cheerios)); (2) a preparation action within the same head food (R4); (3) the family's reviewed preferred targets; (4) the row's own WWEIA category; (5) the other categories in its family.
- Pre-2017 rows, the 3,079 with no WWEIA category, take the category that at least 60% of their head food's rows in the same Table S5 group carry, when there are at least two such rows (1,601 rows). The family table may add reviewed members by food code, cereal first. A row with neither gets product-line and preparation swaps only, or the honest line.
- Retire the group-plus-one-shared-word fallback (`food-compass.ts:831-837`). It is how fried chicken, bologna and fried fish reach organ meat and raw fish in E04.
- "Not included in a food category" (18 rows, from bacon to cocoa powder) is never a pool.
- Target exclusions, reviewed by the nutrition lead: rows under 5 kcal per 100 g (R3); "Topping from ..." rows; organ meats unless the current food is one; substitutes (egg substitute, coffee substitute, cereal beverage); raw meat, poultry, fish or egg rows for a cooked food; rows that add fat or oil the current row lacks (R2); ambiguous rows, as today. Catch-all rows (NFS, "NS as to") rank last.
- Provenance. Each swap carries its pool (`line`, `action`, `preferred`, `category`, `family` or `no_score`) and, for an action, its key. The UI, voice context and tests read it (spec 30 R10).

### R2. Threshold and order

- Keep the 10-point rule. Changing it is the nutrition lead's call. E16 gives the trade-off: 5 points leaves 976 rows empty instead of 1,632, and the extra swaps are the small contrasts the grant says prove nothing.
- Order: R1's pool order, then, inside a pool, most shared content words, then higher score, then lower calorie density with an observed density before an estimate (today's tie-break). Rows that differ only in fat type or "NS as to" wording collapse into one entry, the highest score.
- The table often lists one food under several codes from different survey years: grits with cheese scores 35 under one code and 45 under another. A row that names the same food with only survey wording changed ("cooked", "regular", "NS as to", "corn or hominy") is never a swap for it.
- Never offer a row that only adds fat or oil; 21 of today's first picks do. Removing added fat is an action (R4). The nutrition lead confirms, since Food Compass rewards plant oil.
- One order everywhere: typed matches, chip taps, camera confirmations and voice, on both doors. The route's `preferHigherScore` and `preferLowerCalorieDensity` parameters go with the sort control (R6).
- The route returns at most three swaps: the default and two more.

### R3. Swaps without a score

- A reviewed list of no-score swaps: water, sparkling water, unsweetened tea and black coffee, with English and Spanish names. They are the default for sugar-sweetened drinks: every row in Soft drinks, Fruit drinks, Sport and energy drinks, Diet sport and energy drinks, Other diet drinks, Flavored or carbonated water and Enhanced or fortified water; every Tea row at 5 kcal or more (all carry sugar or milk); and sweetened Coffee rows. The nutrition lead confirms the list and where it attaches.
- A no-score swap shows no number, dial or chart marker, and it uses the existing sentence "Almost no calories, so there's no score for it." Published rows from the sugar-sweetened categories are never targets for those drinks. Without that rule the prototype offers a carbonated fruit drink 47 for a cola 1 and a sugar-free energy drink 27 for diet cola.
- Under 5 kcal. A published row whose FNDDS 2017-18 energy is under 5 kcal per 100 g shows as not scored with the same sentence, is never plotted and is never offered as a swap. This withholds four published numbers (E07), changes none, and matches both the Food Compass exclusion and `compass-instructions.ts:30`.
- Typed names land on the carve-out. The carve-out classifier (`food-compass.ts:235-260`) accepts the no-score names in both languages: `unsweetened tea`, `unsweetened iced tea`, `black coffee`, `plain coffee`, `sparkling water`, `agua`, `agua con gas`, `té sin azúcar`, `café negro`, `café solo`. A tap or a typed line reaches the carve-out answer instead of pre-sweetened chips. This re-adjudicates corpus cases `excl-black-coffee` and `es-agua` from candidate to carve-out.

### R4. Preparation actions and display names

- When a same-head row differs from the current row by one recognized change and scores at least 10 higher, the swap is shown as an action with that row's score. Six actions: bake, broil or grill instead of frying; take the skin off; skip the added fat; choose whole grain; choose lower sodium; choose unsweetened. The row may also differ in fat wording that adds no fat, and in nothing else. When several rows qualify, the highest score wins, unless the family table names a preferred target.
- The source row always shows under the action, the way the identity review shows it ("Scored as Catfish, baked or broiled, no added fat").
- An action appears only where the published rows support it. French fries from fresh score 64 and a baked potato 65, so fries get no baking action.
- Named results under this rule: white bread 11 → choose whole grain, Bread, whole wheat 57; plain white rice 23 → choose whole grain, Rice, brown, cooked, no added fat 69; fried catfish 66 → bake, broil or grill it, 83; a fried chicken wing with the skin eaten, 50 → take the skin off, 63.
- Display names. The default swap leads with the action, the no-score name or a reviewed short name from the family table in English and Spanish, and the source row sits under it. A brand row's reviewed name is its product ("Cheerios"). A row with no reviewed name shows its source row alone, in both languages, and a test counts how many first-family defaults still lack a reviewed name.

### R5. Empty and affirmation lines

- Three states replace today's two lines (exact copy in section 6):
  - affirmation: a score of 70 or more and no eligible swap;
  - similar: a score under 70, a higher eligible row, and none that clears the threshold;
  - none higher: a score under 70 and nothing higher in the eligible pool.
- Retire "Already one of the best choices in its group." It claims a rank the pool contradicts for 513 rows. This answers spec 30 section 13.6 decision 4.
- A state is one line under the verdict, with no heading, sort control or recipe link. A label-only estimate still shows nothing.

### R6. One swap, more on request

- The alternatives slot shows one default swap: "Try instead", the name or action, the source row, a score dial and the calorie-density line. "More swaps (2)" expands in place to at most two more.
- Tapping the swap expands a comparison in place: the current food and the swap side by side with score, band, calorie density and source row. This is spec 30 R10's Compare, without a new screen. The comparison has one button, "Use this instead", which makes the swap the current choice through the door's existing `foodId` path, a replacement under spec 30 R2. Opening the comparison logs nothing and asserts no purchase.
- Retire the `/food/demo` sort control and its heading (`demo/page.tsx:1013-1051`; the `compassSort*`, `compassSorted*` and `compassBetterOptionsSorted` strings). This ends spec 23 owner decision 3's toggles (section 10, decision 1).
- The chart keeps one marker for the current food. A second marker for the swap is out of scope for C1.

What changes on screen:

| Added | Replaces or removes |
|---|---|
| "Try instead" row | The "Better options" heading and its three cards, both doors |
| "More swaps (2)" | The second and third cards |
| Comparison on tap, with "Use this instead" | Nothing; it sits behind a tap |
| One state line | "Already one of the best choices in its group." or "Nothing similar scores higher." under a heading |
| Nothing | The public sort fieldset and its heading |
| One recipe link on the default swap (C3) | A "Recipe ideas" link on every card |

`FoodFactsCard` still carries a second copy of the list (`food-facts-card.tsx:394-488`), but no page imports it. C1 deletes that block or the component.

### R7. Reach

- Swaps stay behind identity confirmation (spec 30 R1, R4). No chip shows a swap or a score.
- Cut taps only with reviewed identities:
  - Reviewed default rows for common and Kentucky bare names: pizza, fried chicken, sweet tea, cornbread, white rice, mashed potatoes, biscuit, grits and coffee, with `black coffee` going to the carve-out (R3). Each is a spec 30 section 13.6 decision 3 adjudication, and each moves from one tap to none.
  - Reviewed candidate sets where today's chips name the wrong foods (E12, E13): country ham, hot dog, pop tarts, hot brown, macaroni and cheese, fried chicken (coated breast, drumstick and thigh), and the Spanish words `refresco`, `jugo de naranja`, `papas fritas`, `pollo frito`, `pan blanco`, `té dulce`, `café` and `arroz`. Nutrition and Spanish review come first (spec 30 section 13.6 decision 6).
- A barcode that maps to a confirmed published row gets that row's swaps by `foodId` on both doors (E08). A label-only estimate keeps none.
- Plates show no swaps until a reviewed plate rule exists (spec 30 R6).

### R8. Voice and typed answers

- One list. The voice context and the `lookup_food_score` result carry the same default swap, its pool and the R5 state, taken from the route response the screen used (`toCompassContext`, `buildCompassContext`, `lookupFoodScore`).
- Context lines name the swap or the state, for example "Swap to suggest: Cheerios, 77 (row: Cereal (General Mills Cheerios))", "Swap to suggest: water or unsweetened tea (no score)" or "No swap: a good choice as it is."
- Instructions on both doors: suggest only the swap given; with no swap, say the state line in plain words; never call another food a better choice. This replaces `compass-instructions.ts:31`, the lens guidance at `condition-lens.ts:117-118`, "Better options in the same food group" at `food-instructions.ts:168` and the tool description at `compass-instructions.ts:65`. The phrasing guard's example at `food-instructions.ts:115` points at the swap on screen instead of a lower-sodium version.
- In candidate mode the tool returns the named rows without scores, so the model can ask which one. It never returns a swap for an unconfirmed row.
- Instruction text and fixture tests are the control C1 can build. Spoken output cannot be checked before it plays (spec 30 R7), so an invented spoken swap stays possible until Slice B's text-first turn exists (H).

### R9. What counts as a completed analysis

Instrumentation stays deferred; this is the definition it will use.

- Completed: a confirmed identity (spec 30 R1, "Confirmed food"), a published score or labeled estimate, and either a displayed swap (published row or no-score) or the affirmation line.
- Not completed: candidate, no match, failure, plate lines, the similar and none-higher lines, and a label-only estimate without a swap. Carve-outs get their own count as guidance without a score.
- Whether a water carve-out counts is an owner decision (section 10, decision 3).

### R10. Recipe link

- One recipe link, on the default published-row swap only. No link on no-score swaps, states, candidates or plates.
- The link is built from the swap's reviewed display name, never the FNDDS description, with a localized query ("brown rice recipe", "receta de arroz integral").
- Target, in order: a reviewed recipe page for that swap from a small curated table (section 10, decision 2); otherwise a web search for the display name. The curated table starts with Plate It Up! Kentucky Proud pages that the nutrition lead and an Extension collaborator pick for the swap families it covers, potato, chicken and vegetable sides first. A committed link check fails the build when a curated URL stops returning 200, the way the Ladder catalog freshness test works.
- The link text says where it goes: "Recipes (web search)" or "Recipe: {title} (UK Extension)". The link carries no score, nutrition number, cost or diet claim.
- No model-written recipe on the public door.

Source findings, 2026-09-13 and 2026-09-14, from web research and direct requests:

| Source | Status | Nutrition per serving | Spanish | Linkable search | Terms |
|---|---|---|---|---|---|
| USDA MyPlate Kitchen | Offline. Recipe, search and Spanish URLs return 301 to the MyPlate.gov home page; the last archived recipe page is from April 2026 | Had it | Had about 1,000 | Gone | Federal text was public domain; some recipes credited outside sources |
| Plate It Up! Kentucky Proud (UK FCS Extension) | Live, 167 recipes, newest August 2026 | Yes | No; its Spanish copies lived on a lapsed site | No; browse by season and commodity | UK copyright, no reuse statement; linking needs no permission |
| Cooking Matters | Live | No | No | Yes (`?s=`) | No recipe terms page |
| American Heart Association | Live, behind a bot challenge | Yes, with "Heart Healthy" style tags | Yes | Yes (`?q=`) | Forbids electronic reproduction; its tags read as health claims |
| Google search | Live | Varies by result | Yes | Yes | Automated queries are barred; a person's click is ordinary use |

Plate It Up! fits the swaps weakly today: of 167 recipes, 2 mention rice (neither is brown rice), 1 tea, none cereal, 15 potato and 9 chicken. Its links moved hosts once, and the old links now land on a home page. Extension work to map recipes to swap families and add Spanish fits the grant's $3,000 Extension line.

### R11. Pantry recipes (personal door)

- Pantry recipes stay on `/food`. The prompt reads the patient's plan, and the public door has neither that record nor a spend control for a paid route.
- Optional C4: a typed list of what's on hand replaces the camera requirement. It sends text through the same JSON path (a text-only call, cheaper than a frame), `createSafeAiResponse` and the grounding check.
- Model-written recipe text carries no digits: no quantities, nutrition numbers or scores. A validator rejects any field with a digit, and the card then says the recipe could not be shown. The existing phrasing guards still forbid calling a recipe safe for an allergy or a fit for a therapeutic diet.
- No public version. It would need a store-free prompt, a spend control and new safety tests for a feature the grant does not count.

### R12. Personal-door extras

- "Use this instead" followed by the existing "Log this" logs the swap as the meal. No schema change, so it rides in C1.
- A saved-swaps list is deferred; it needs a storage change spec 30 R3 rules out.

### R13. Boundaries

- The family table, display names, no-score list and exclusions stay server-side. The bundle check's per-chunk guard and `npm run storefree` stay green, and the public door gains no store dependency.
- C1 must fit the public door's 0.7 KiB, helped by removing the sort control. If a budget moves, record the measurement in `scripts/check-ladder-bundle.mjs` as earlier raises did.
- C1 to C3 add no model call. C4 adds one paid call on `/food` only, behind the existing provider gate.
- No availability, price, allergy or therapeutic-diet claim, and no retailer.
- Every new string and name ships in English and Spanish after Spanish review.
- Scores come only from the published table. A model may later explain or order eligible swaps; it never adds one.

## 5. First families

Row counts are the rows in the named categories. The "default target" column is proposed; the nutrition lead sets it.

| Family | Occasion | Categories | Default target | Questions for the nutrition lead |
|---|---|---|---|---|
| Breakfast cereal | Breakfast | Ready-to-eat cereal, higher sugar; Ready-to-eat cereal, lower sugar; Oatmeal; Grits and other cooked cereals (243), plus reviewed pre-2017 cereal rows | Product-line sibling, then any member | Is a hot cereal a swap for a cold one? Which pre-2017 cereal rows join? |
| Sugar-sweetened drinks | Drink | Soft drinks; Fruit drinks; Sport and energy drinks; Diet sport and energy drinks; Other diet drinks; Flavored or carbonated water; Enhanced or fortified water (95); Tea rows at 5 kcal or more; sweetened Coffee rows | Water or unsweetened tea (no score); black coffee for sweetened coffee | Are diet drinks swapped? Is milk or 100% juice ever a target? |
| Salty snacks | Snack | Potato chips; Tortilla, corn, other chips; Popcorn; Pretzels/snack mix; Crackers, excludes saltines; Saltine crackers; Nuts and seeds (269) | Popcorn, air-popped, unbuttered 82 as the preferred target | Nuts and seeds score up to 100 and are calorie dense: targets or not? Fruit as a snack swap? |
| Bread | Meal, breakfast | Yeast breads; Rolls and buns; Bagels and English muffins; Tortillas; Biscuits, muffins, quick breads (231) | Choose whole grain | Cornbread and biscuits: bread or starchy side? Cornbread's only swap today is Puerto Rican yam buns. |
| Rice and grains | Side | Rice; Pasta, noodles, cooked grains (55) | Choose whole grain | Does wild rice count as whole grain? |
| Starchy sides | Side | French fries and other fried white potatoes; Mashed potatoes and white potato mixtures; White potatoes, baked or boiled; Other starchy vegetables; Corn (211) | Potato, baked or boiled, no added fat | Are non-starchy vegetable sides (green beans 94) swaps for fries? Potato salad leads for mashed potatoes today. |
| Fried mains | Main | Same-head actions within Chicken, whole pieces; Chicken patties, nuggets and tenders; Fish; Shellfish; Pork; Beef, excludes ground; Turkey, duck, other poultry | Actions only: bake, take the skin off, skip the added fat | Is another cut (wing to breast) or another fish a swap? |

How a family is built and reviewed:

1. A committed script exports each family's members, one sheet per family: code, description, score, kcal per 100 g, category, proposed display name and proposed action.
2. The nutrition lead marks targets, sets exclusions and preferred targets, and approves or edits display names. A Spanish reviewer adds the Spanish names.
3. The reviewed table is committed with reviewer and date, like the Ladder catalog verification records. A test asserts that every code exists in `fcs2-foods.json` and that every swap the route returns passes the table.
4. Order: cereal and drinks first, since they carry the regression case and the no-score rule; then snacks, bread, rice, sides and fried mains. Rows outside the families keep their own WWEIA category under R1's exclusions.

## 6. Copy

Spanish needs a Spanish reviewer before release. Existing keys are reused where their meaning holds.

| Key | Where | English | Spanish |
|---|---|---|---|
| `swapLead` (new) | Above the default swap | Try instead | Prueba en su lugar |
| `swapMore` (new) | Expander | More swaps ({count}) | Más opciones ({count}) |
| `swapUse` (new) | In the comparison | Use this instead | Usar esta opción |
| `identityReviewScoredAs` (existing) | Under a swap | Scored as {row} | Puntuado como {row} |
| `swapAffirm` (new) | 70 or more, no swap | A good choice as it is. | Es una buena elección tal como está. |
| `swapSimilar` (new) | Under 70, a higher row under the threshold | Similar foods score about the same. | Las opciones parecidas tienen casi el mismo puntaje. |
| `compassNoCloseMatch` (existing) | Under 70, nothing higher | Nothing similar scores higher. | Nada parecido tiene mejor puntaje. |
| `swapWaterOrTea` (new) | No-score swap for drinks | Water or unsweetened tea | Agua o té sin azúcar |
| `swapBlackCoffee` (new) | No-score swap for sweetened coffee | Black coffee | Café negro |
| `compassCarveOutBelow5` (existing) | Under a no-score swap | Almost no calories, so there's no score for it. | Tiene muy pocas calorías, así que no lleva puntaje. |
| `actionBake` (new) | Action | Bake, broil or grill it | Hornéalo, ásalo o hazlo a la parrilla |
| `actionSkinOff` (new) | Action | Take the skin off | Quítale la piel |
| `actionNoAddedFat` (new) | Action | Skip the added fat | Evita la grasa añadida |
| `actionWholeGrain` (new) | Action | Choose whole grain | Elige integral |
| `actionLowerSodium` (new) | Action | Choose lower sodium | Elige bajo en sodio |
| `actionUnsweetened` (new) | Action | Choose unsweetened | Elige sin azúcar |
| `recipeSearch` (new, C3) | On the default swap | Recipes (web search) | Recetas (búsqueda web) |
| `recipeCurated` (new, C3) | On the default swap | Recipe: {title} (UK Extension) | Receta: {title} (Extensión de UK) |

Retired: `compassAlreadyBest`, `compassBetterOptions`, `compassBetterOptionsSorted`, `compassSortLegend`, `compassSortScore`, `compassSortDensity`, `compassSortedScore`, `compassSortedDensity`, and `compassRecipeLink`, which C3 replaces.

## 7. Delivery slices

| Slice | Scope | Dependency and effort |
|---|---|---|
| C1: reviewed swaps and true lines | R1 to R6, R8, R12's "Use this instead" and R13; the committed table-wide gate test; re-adjudicating `excl-black-coffee` and `es-agua`; deleting the unused `FoodFactsCard` list | Builds on master now. Release waits for the nutrition lead's review of the cereal and drink families, R2 and R3, and for Spanish review of section 6. About 6 engineering days, 2 days of nutrition review, half a day of Spanish review and 1 day of verification. It can land as two commits: the true lines, one order and the sort-control removal first (about 1.5 days, needing only Spanish review), then the reviewed pool. |
| C2: reach | R7: reviewed default rows and candidate sets; swaps for barcode rows that map to a published row | The alias adjudication runs beside C1; the barcode part follows C1's response shape. About 2 engineering days and 1 day of adjudication. |
| C3: recipe link | R10 | After C1, which supplies reviewed display names. About 1 engineering day; the curated table grows as Extension picks pages. |
| C4: pantry by typing | R11, `/food` only | Optional, after C3, and only if decision 4 says build. About 2 engineering days. |

Order: C1 with C2's adjudication in parallel, then C2's barcode part, then C3, then C4 if approved. Plate swaps, a second chart marker and saved swaps wait for later specs.

Likely seams: `src/domain/food-compass.ts` (`findAlternatives` becomes the swap finder; `recipeSearchUrl`; `classifyQueryScoreability`); a new server-only family table beside `src/domain/food-compass-search.ts`; `src/app/api/food/identify/route.ts` (`buildMatch`, the response shape, the retired sort parameters); `src/components/compass-score.tsx` (`CompassAlternatives`); both door pages; `src/domain/compass-context.ts`, `src/ai/compass-instructions.ts`, `src/ai/food-instructions.ts` and `src/domain/condition-lens.ts`; `src/hooks/use-compass-score.ts` and `src/hooks/use-barcode-review.ts` (C2); `src/i18n/strings.ts`. Callers of `alternatives` that change together: `compass-instructions.ts:112, 132`; `food-instructions.ts:166-171`; `demo/page.tsx:386, 1013-1051`; `page.tsx:356-377, 476, 1484-1496`; `compass-score.tsx:243-289`; `compass-context.ts:24-51`; `use-compass-score.ts:17, 101`; `use-live-food-score.ts:60`.

Tests that change: `e2e/food-demo.spec.ts:340` (the sort radio), `route.test.ts:211-219` (Google URL and same-group rule), `food-compass.test.ts:542-630` (`findAlternatives`), `food-facts-card.test.tsx:331-332`, and the two corpus cases above. `e2e/food-lens.spec.ts:344` stays as it is.

## 8. Acceptance criteria

Every row applies to both doors unless it says otherwise, in English and Spanish wherever copy appears.

| ID | Slice | Trigger | Required outcome |
|---|---|---|---|
| C01 | C1 | `honey nut cheerios` | Default swap "Cheerios", 77, pool `line`, source row shown; identical on both doors; no heading. |
| C02 | C1 | `cheerios`, `plain cheerios`, `banana`, `soup beans` | "A good choice as it is." and never "Already one of the best". |
| C03 | C1 | `potato chips` (47) | A reviewed salty-snack swap or "Similar foods score about the same."; never "Nothing similar scores higher." while potato-chip rows score 48 to 54. |
| C04 | C1 | `sweet tea`, then the first chip | Default "Water or unsweetened tea" with the below-5-kcal sentence and no number, dial or chart marker; "Use this instead" lands on the carve-out; hibiscus tea never appears. |
| C05 | C1 | Typed `unsweetened tea`, `black coffee`, `agua`, `té sin azúcar`, `café negro` | The carve-out answer with no score and no pre-sweetened chips. |
| C06 | C1 | `hibiscus tea`; the whole table | Not scored and not plotted; never a swap for any row (table-wide test). |
| C07 | C1 | `fried chicken`, then each chip | Never an organ meat, egg substitute or other excluded row; the default is an action with its source row and score. |
| C08 | C1 | `fried catfish`, then the first chip | "Bake, broil or grill it", 83, "Scored as Catfish, baked or broiled, no added fat". |
| C09 | C1 | `white rice`, every chip; `white bread` | No fat- or oil-added row offered; "Choose whole grain" to the brown rice or whole wheat row where one clears the threshold. |
| C10 | C1 | `pizza`, every chip | No "Topping from" row. |
| C11 | C1 | The bacon and bologna rows | No organ meat, cocoa powder or row from "Not included in a food category"; the right state line when nothing qualifies. |
| C12 | C1 | The three states | Exact strings from section 6 in both languages; one line; no heading, sort control or recipe link. |
| C13 | C1 | 30 named rows, each reached as a typed match, a chip tap and a fixture camera confirmation | The same default swap on both doors in every path. |
| C14 | C1 | `/food/demo` after any score | No sort radios; `e2e/food-demo.spec.ts:340` rewritten to assert the single order. |
| C15 | C1 | "More swaps (2)"; tap the swap; "Use this instead" | Expands in place to at most two more. The comparison shows both foods with score, band, density and source. "Use this instead" replaces the current choice and clears the old choice's actions (spec 30 R2); on `/food`, "Log this" then logs the swap. Opening the comparison writes nothing to storage on `/food/demo`. |
| C16 | C1 | Voice context and `lookup_food_score` for the C01, C02 and C04 rows; spoken `pizza` | The same default swap or state as the screen; `pizza` returns named rows with no score; a fixture reply that names an unsupplied food as better fails its eval case (no live model). |
| C17 | C1 | Label-only package estimate | No swap section; `e2e/food-lens.spec.ts:344` unchanged. |
| C18 | C1 | `npm run storefree` and the import graph | Green; the public door gains no store or family-table dependency. |
| C19 | C1 | Bundle | `/food/demo` at or under 205 KiB and `/food` at or under 315 KiB, or a recorded remeasurement. |
| C20 | C1 | Table-wide gate test | Every returned swap passes R1 to R3 (pool, threshold, exclusions, under 5 kcal, fat rule); no row prints a rank claim; coverage by band printed. |
| C21 | C1 | Frozen corpus | Green, with only `excl-black-coffee` and `es-agua` re-adjudicated. |
| C22 | C1 | Spanish door | Actions, no-score names and reviewed display names in Spanish; the source row still shown. |
| C23 | C2 | Each reviewed bare name in R7 | A published default row with its swap and no chip tap; basis `alias`. |
| C24 | C2 | The Spanish and Kentucky words in R7 | The reviewed row or reviewed chips naming the food meant; no wrong-food chips. |
| C25 | C2 | A barcode that maps to a published row | That row's swaps on both doors; a label-only estimate still has none. |
| C26 | C3 | Default published-row swap | One recipe link, to a curated page or a web search for the reviewed display name, labeled as such; no FNDDS text in the query; none on no-score swaps or states; a Spanish query on the Spanish door; the curated-link check passes. |
| C27 | C4 | `/food`, typed pantry list | Recipes with no camera, through `createSafeAiResponse`; no digits in model text; no allergy or diet clearance; unreachable from `/food/demo`. |

## 9. Verification plan

- Reproduce section 3's baseline before editing. The harness is a vitest config outside the tree with `@` aliased to `src`; it calls `findAlternatives` over the table and the route handler over the named and corpus lists, and gives E01, E02, E06 and E16 in about 15 seconds.
- Commit the harness as tests: a table-wide gate for R1 to R5 that prints coverage by band, route tests for the appendix A cases, and the corpus test with its two re-adjudicated cases.
- Component tests for the three states, the expander, the comparison and "Use this instead". E2e on both doors at 390×844 in Chromium and the mobile project for C01, C04, C07, C12, C14 and C15, with axe on the new row.
- `npm run check` (lint, unit tests, store-free check, build, bundle), `npm run crisis:gate` and the food e2e files. Run e2e on a private port with `PLAYWRIGHT_PORT`. To measure bundles without touching the shared `.next`, build a clean `git archive` copy with a junctioned `node_modules`, as this spec did; `NEXT_DIST_DIR` accepts only the package evaluator's directory names. Remove the junction before deleting the copy.
- After deploy, rerun the production probe (typed and `foodId` lookups only) and diff it against the HEAD harness.
- The nutrition review leaves an artifact: the family sheets with reviewer, date and decisions. The grant's 95% rule is measured later on the 200-case release set (spec 30 section 10); nothing here claims it.

## 10. Owner decisions

Product owner (you):

1. Retire spec 23 decision 3's sort toggles and three-card list in favor of one swap plus "More swaps". Recommended.
2. Recipes: keep one link on the default swap, with curated UK Extension pages first and a labeled web search as the fallback (R10). The other choice is no recipe link until a curated set exists. Recommended: the link, because it costs about a day and the curated set can grow.
3. Completion: count a no-score drink swap as an appropriate alternative (recommended), and report water carve-outs apart from completed analyses (recommended).
4. C4, pantry by typing on `/food`: skip until C1 to C3 ship, since the grant does not count it. Recommended.
5. The in-place comparison with "Use this instead" as spec 30 R10's Compare. Recommended.

Nutrition lead:

6. Family membership, preferred targets and exclusions (section 5), cereal and drinks first.
7. Keep the 10-point rule. Recommended.
8. Never offer a swap that only adds fat or oil. Recommended.
9. The target exclusions in R1. Recommended.
10. Withhold the four under-5-kcal scores. Recommended.
11. The no-score swaps and where they attach. Recommended as in R3.
12. Nuts and seeds as snack targets, vegetables as side targets, and milk or 100% juice for drinks. No default is recommended.
13. Default rows for the bare names in R7 (spec 30 section 13.6 decision 3).
14. The six action labels and the display names.

Spanish reviewer: 15. Section 6 copy, the display names and the Spanish alias entries in R7.

Extension collaborator (C3): 16. Which Plate It Up! pages serve which swaps, and whether Spanish versions can be added.

## 11. Review questions

1. Reproduce E02, E04 and E05. Would a dietitian accept any of the E04 picks?
2. Is the inherited-category rule sound? Sample 50 of the 1,601 rows it assigns.
3. The prototype drops 1,000 existing lists. Which were useful, and should the family table re-add them by code?
4. Food Compass rewards plant oil (D1, D4). Does refusing fat- or oil-adding swaps stay consistent with nutrition-lead-approved rules, or does it contradict the score the app shows?
5. Is a no-score drink swap an "appropriate alternative" under the grant? Is withholding four published scores consistent with spec 23's rule that a T1 score is the published value?
6. Is "Similar foods score about the same." true everywhere it prints, given a gap of up to 9 points?
7. Can R8's instruction changes keep voice to the supplied swap before spec 30 Slice B's text-first turn exists?
8. Should C1 ship as two commits, true lines first, or does that leave the public door worse for a while?
9. Is the Plate It Up! link check enough, given one past host move, and is a labeled web search acceptable as the fallback?
10. Will 0.7 KiB on `/food/demo` hold the expander and the comparison once the sort control is gone?

## 12. What was and was not exercised

Exercised: the scratch harness over the whole table; the identify route handler for 102 named queries and 100 corpus cases; 408 production typed and `foodId` requests; a scratch prototype of R1, R2 and R4 over the table (indicative); a clean HEAD build and the repo's bundle script; the Review Copy PDF text (all 10 pages) and the 09-03 and 09-04 Markdown drafts; web research on recipe sources, plus direct requests to MyPlate Kitchen and Plate It Up! pages.

Not exercised: no browser run on either door, so every rendering claim is C. The public door probes voice on load, which mints no session; the risk was the camera loop, which could send frames to the paid vision route if the browser pane attached a camera. No e2e run, live model, voice, physical phone or screen reader. No nutrition, Spanish or Extension review. No recipe source license confirmed with its publisher. The prototype is unreviewed scratch code and did not model R3's drink rule. Production latency comes from one machine.

## 13. As built, 2026-09-14

C1 is built on master in `1f0033c` and `333c618`, with C2's barcode swaps and C3's recipe search. It went to production on 2026-09-14 in `f3f7d23` (`dpl_HH1BqptYZ7eGPN5c6YHPLrzXNbid`) by the owner's call, ahead of the reviews. The owner took decisions 1 to 5 as recommended. Everything section 10 leaves to the nutrition lead or the Spanish reviewer is live as a proposed default in `src/domain/food-swaps.ts`, marked pending review, so their reviews now apply to what people see. A production probe of typed and `foodId` lookups, with no model call, confirmed the swaps, the carve-outs and the public door's new copy; `docs/ops/DEPLOYS.jsonl` has the details.

What shipped:

- `findSwaps` in `src/domain/food-swaps.ts` applies R1 to R3, and only the identify route imports it. The route returns at most three swaps, a `swapState` and, for a sugar-sweetened drink, a no-score swap.
- Rows under 5 kcal per 100 g answer as not scored, by `foodId` as well as by text. Typed `unsweetened tea`, `black coffee`, `agua`, `un vaso de agua`, `té sin azúcar` and `café negro` reach the carve-out, and corpus cases `excl-black-coffee` and `es-agua` are re-adjudicated.
- Both doors show one "Try instead" row, "More swaps", the comparison in place and "Use this instead" (`CompassSwaps` in `src/components/compass-score.tsx`). The public sort control and its strings are gone, and `FoodFactsCard` lost its unused copy of the list. On `/food`, "Use this instead" makes the swap the current choice and "Log this" then logs it.
- A barcode that maps to a published row gets that row's swaps on both doors (C25).
- The voice context and the public `lookup_food_score` tool carry the same swap or state line as the screen. In candidate mode the tool returns the named rows with no score (`needs_choice`).
- The default swap carries one recipe link, a labeled web search built from its reviewed display name.

Changes from the draft:

1. Cereal is two families, ready-to-eat and hot. Grits never get a cold cereal until the nutrition lead says the two are swaps for each other.
2. A milk family joins section 5: whole, reduced fat, lowfat and nonfat milk, with fat-free milk preferred. WWEIA files plain milk by fat level, so without it whole milk (54) never met fat-free milk (66).
3. School-lunch rows are never targets. They are trays a school serves, and they led the list for chicken nuggets and restaurant pepperoni pizza.
4. "Bake, broil or grill it" lands only on a row that says baked, broiled, grilled or roasted. The first build put a steamed row under that label for fried fish.
5. "Choose whole grain" takes brown or wild only against a white row; otherwise the row has to say whole wheat or whole grain. Plain spaghetti, whose row never says white, now reaches whole wheat spaghetti (82), and wild salmon can never pass as a grain.
6. Among preparation changes the highest score wins (R4), then a row with no added fat, then one that keeps the current fat wording. Fried fish therefore gets "Fish, NS as to type, baked or broiled, made with oil" (97) rather than appendix A's row with no added fat (95). The nutrition lead should confirm this case (review question 4).
7. A fourth state, `none`, prints no line. Both state lines are checked against every comparable row of the same food, its category and its family. When there is nothing to compare, or the higher similar rows are ones the rules keep out (a survey duplicate, a row that adds fat), nothing prints and voice hears "there is none to suggest for this food". The first build printed "Nothing similar scores higher." for 1,143 rows, many with nothing compared, such as Froot Loops Cereal Straws (4).
8. There are two no-score swaps: water or unsweetened tea, and black coffee. Sparkling water is not a swap of its own; typed, it already reaches the zero-calorie carve-out.
9. The curated recipe table, `recipeCurated` and its link check wait for Extension picks. Only the labeled web search shipped.

Measured on the committed code (X), over the 9,229 non-ambiguous rows:

| State | Rows | What shows |
|---|---|---|
| Swap | 6,256 | "Try instead" and the swap |
| No-score drink swap | 144 | "Water or unsweetened tea" (126) or "Black coffee" (18) |
| Affirmation | 1,216 | "A good choice as it is." |
| Similar | 600 | "Similar foods score about the same." |
| Nothing higher | 229 | "Nothing similar scores higher." |
| None | 784 | No line |

- 7,616 rows (82.5%) end in a swap or an affirmation. Before, 1,004 rows printed a false empty line (E02).
- Default swaps by pool: same category 4,697, preferred target 916, preparation change 565, another category in the family 78, product line 18. By change: skip the added fat 187, choose whole grain 170, bake 109, lower sodium 57, take the skin off 34, unsweetened 8.
- Of the 6,274 default swaps, 565 lead with a named change, 1,003 with a reviewed name and 4,706 with their source row alone, which is English on the Spanish door. 847 carry a recipe link. C22 stays open until the Spanish reviewer adds names.
- Corpus: all 28 typed lines that score directly show a swap or an affirmation with no tap; before, 5 showed an alternative. 33 more reach one after a single chip tap. 9 are carve-outs, and 30 never get one: 12 plate lines and items, 9 safety intercepts, 5 misses, 2 candidates whose chips get only state lines, 1 question and 1 empty line.
- Named cases that moved from appendix A's proposal: fried fish (item 6); cornbread and biscuit get whole wheat bread from the bread family; grits get oatmeal made with water (81), the hot-cereal preferred row; chicken nuggets get grilled chicken (64); `leche` now reaches fat-free milk in one tap. Country ham, `refresco`, `jugo de naranja`, bacon and macaroni and cheese still reach wrong chips, because C2's reviewed defaults and candidate sets are not built.

Verification:

- 215 unit tests in the 15 food suites pass, including the table-wide gate (C20) and a check that no state line contradicts its category. Lint, typecheck and `npm run storefree` (C18) are clean.
- `npm run crisis:gate` passed on `1f0033c`.
- Bundle, from a clean `git archive` build: C1 took `/food/demo` to 206.0 KiB and `/food` to 315.4 KiB, over their 205 and 315 KiB ceilings, so the 0.7 KiB of review question 10 did not hold. The swap row, "More swaps", the comparison, "Use this instead" and the state lines in two languages outgrew what the sort control's removal freed; the finder, families and names stay server-only. At `333c618`, which also carries `465bfbc`'s voice engine, the doors measure 206.6 and 316.0 KiB. The ceilings are now 208 and 317 KiB, with the measurements recorded in `scripts/check-ladder-bundle.mjs` (C19 by remeasurement), and the repo's bundle check passes against them on a rebuild of `333c618`, per-chunk guard and package-scanner checks included. Ladder is at 315.9 of 316 KiB.
- E2E on the same clean copy of `333c618`, in Chromium and the mobile project: all 182 tests in food-demo, food-critique, food-lens, food-lens-shell, food-plate and food-measure pass. A new Swaps block checks C01, C02, C04, C12, C14 and the "Use this instead" part of C15 on both doors; the label-only estimate test (C17) is unchanged and passes.

Still open:

- C2's reviewed default rows and candidate sets (R7). They touch `food-compass-search.ts`, which other work also edits.
- C13's 30-row cross-path test, and C16's fixture eval that fails a reply naming an unsupplied food. Tests cover the instruction and tool wording only.
- Spanish display names, the curated recipe table, saved swaps, plate swaps and a second chart marker.
- The nutrition lead's and the Spanish reviewer's sign-off on what is now live.

## Appendix A. Named cases

"Production, typed" is what `4a0be55` answers to the typed text. "Row used" is the match, or the first chip. The public door's list after a chip tap uses score order; after a typed direct match it shows the `/food` order under a "highest score first" heading (E05). "Proposed" follows R1 to R4 and is indicative until the families are reviewed.

| Query | Production, typed | Row used | `/food` today, first swap | `/food/demo` after a chip tap | Proposed |
|---|---|---|---|---|---|
| pizza | 3 chips | Pizza, cheese, stuffed crust 21 | Pizza, cheese and vegetables, gluten-free thick crust 44 | Topping from vegetable pizza 56 | Pizza, cheese and vegetables, whole wheat thin crust 44 |
| fried chicken | 3 chips | Chicken, wing, fried, no coating, skin eaten, made with oil 50 | A coated wing, skin and coating not eaten, 63 | Chicken liver, braised 81 | Take the skin off: the same wing, skin not eaten, 63 |
| sweet tea | 3 chips | Tea, iced, brewed, black, pre-sweetened with sugar 12 | Iced Tea / Lemonade juice drink, light 30 | Tea, hibiscus 56 | Water or unsweetened tea (no score) |
| unsweetened tea | The same 3 pre-sweetened chips | as sweet tea | as sweet tea | as sweet tea | The carve-out answer (R3) |
| cornbread | 3 chips | Cornbread, made from home recipe 33 | Yam buns; Puerto Rican style 61 | Yam buns; Puerto Rican style 61 | Nutrition lead: bread or starchy side (section 5) |
| white rice | 3 chips, glutinous first | Rice, white, cooked, glutinous 15 | Rice, white, cooked with fat, Puerto Rican style 38 | Rice, wild, 100%, cooked, fat added 77 | Default row Rice, white, cooked, no added fat 23, then choose whole grain: Rice, brown, cooked, no added fat 69 |
| mashed potatoes | 3 chips | Potato, mashed, from restaurant 44 | Potato salad, from restaurant 61 | Stewed potatoes with tomatoes 71 | Preferred target: Potato, baked, peel eaten 65 |
| black coffee | 3 latte and espresso chips | Coffee, Latte 58 | Coffee, Iced Latte, nonfat 71 | Coffee substitute 90 | The carve-out answer (R3) |
| honey nut cheerios | Match 58 | Cereal (General Mills Cheerios Honey Nut) 58 | None: "Nothing similar scores higher." (65 exists) | Typed match: same as `/food` | Try instead: Cheerios 77 (product line) |
| cheerios | Match 77 | Cereal (General Mills Cheerios) 77 | None: "Already one of the best" (85 exists) | Typed match: same as `/food` | A good choice as it is. |
| potato chips | Match 47 | Potato chips, plain 47 | None: "Nothing similar scores higher." (54 exists) | Typed match: same as `/food` | Salty-snack family, preferred Popcorn, air-popped, unbuttered 82 |
| banana | Match 83 | Banana, raw 83 | None: "Already one of the best" (true) | Typed match: same as `/food` | A good choice as it is. |
| soup beans | Match 91 | Pinto beans, from dried, fat added 91 | None: "Already one of the best" (bean rows up to 100) | Typed match: same as `/food` | A good choice as it is. |
| hibiscus tea | Match 56 at 0 kcal | Tea, hibiscus 56 | None | Typed match: same as `/food` | Not scored (R3) |
| water | Carve-out | none | Carve-out | Carve-out | Unchanged |
| biscuits and gravy | Match 15 | Biscuit with gravy 15 | Egg and cheese on biscuit 35 | Typed match: same as `/food` | Egg and cheese on biscuit 35 (nutrition lead to confirm) |
| fried catfish | 3 chips | Catfish, battered, fried 66 | Trout, battered, fried 79 | Catfish, baked or broiled, made with cooking spray 83 | Bake, broil or grill it: 83 |
| green beans with bacon | 3 "cooked with oil" chips | Green beans, fresh, cooked with oil 94 | None: "Already one of the best" | as `/food` | A good choice as it is. |
| biscuit | 3 chips | Biscuit, wheat 3 | Muffin, whole wheat 41 | Yam buns; Puerto Rican style 61 | Bread family (nutrition lead) |
| grits | 3 chips | Grits, with cheese, fat added 35 | Cereal, cooked, NFS 79 | Cereal, cooked, NFS 79 | Oat bran cereal, cooked, no added fat 63, once R2 drops the second grits-with-cheese code (45) as the same food; the NFS row ranks last |
| fried okra | Match 47 | Fried okra 47 | Sweet potato fries, from fresh, fried 74 | Typed match: same as `/food` | Nutrition lead: cooked okra rows score up to 100 but do not share the head word |
| country ham | 3 wrong chips | Pork sausage, country style, fresh, cooked 5 | Turkey or chicken, pork, and beef sausage, reduced sodium 23 | Egg omelet (Tortilla Espanola) 65 | Reviewed candidate set first (R7) |
| fried bologna | 3 chips | Bologna, beef 1 | Beef liver, braised 74 | Beef liver, braised 74 | Cold cuts category, no organ meat (nutrition lead) |
| macaroni and cheese | 3 chips, beef first | Beef and macaroni with cheese sauce 41 | Beef, potatoes, and vegetables ...; cheese sauce 54 | Stewed variety meats, mostly liver 87 | Reviewed candidate set first (R7) |
| pan dulce | Match 11 | Pan Dulce, no topping 11 | Pastry, fruit-filled 54, in English on the Spanish door | Typed match: same as `/food` | Pastry, fruit-filled 54 with a reviewed Spanish name |
| arroz con pollo | Match 38 | Rice with chicken, Puerto Rican style 38 | Rice with squid, Puerto Rican style 69 | Typed match: same as `/food` | Nutrition lead to confirm the rice-dish target |
| frijoles | 3 reviewed chips | Pinto beans, from dried, no added fat 95 | None: "Already one of the best" | as `/food` | A good choice as it is. |
| tamales | 3 reviewed chips | Tamale with meat 33 | Chiles rellenos, filled with meat and cheese 65 | Chiles rellenos, filled with meat and cheese 65 | Category swap (nutrition lead to confirm) |
| frosted flakes | 3 chips | Cereal, frosted corn flakes 9 | Cereal, chocolate flavored, frosted, puffed corn 32 | Cereal (Post Great Grains Raisins, Dates, and Pecans) 65 | Cereal family preferred target (nutrition lead) |
| froot loops | 3 chips, straws first | Froot Loops Cereal Straws 4 | Cereal (Kellogg's Froot Loops) 29 | Cereal (Uncle Sam) 85 | Default row Cereal (Kellogg's Froot Loops) 29, then a cereal-family swap |
| oatmeal | 3 chips | Oatmeal, multigrain, fat added 47 | Oatmeal, regular or quick, made with water, no added fat 81 | same | Same row |
| coca cola | 3 chips (a match at HEAD) | Soft drink, cola 1 | None: "Nothing similar scores higher." | none | Water or unsweetened tea (no score) |
| lemonade | 3 chips | Lemonade, fruit juice drink 1 | Fruit juice drink, citrus, carbonated 47 | Wine, nonalcoholic 49 | Water or unsweetened tea (no score) |
| gatorade | Match 1 | Sports drink (Gatorade G) 1 | Energy drink (XS Gold Plus) 28 | Typed match: same as `/food` | Water or unsweetened tea (no score) |
| doritos | Match 12 | Tortilla chips, cool ranch flavor (Doritos) 12 | Tortilla chips, reduced sodium 33 | Typed match: same as `/food`, labeled highest score first | Tortilla chips, reduced sodium 33 |
| popcorn | 3 chips | Popcorn, flavored 49 | Popcorn, air-popped, unbuttered 82 | same | Same row |
| white bread | Match 11 | Bread, white 11 | Bread, white, special formula, added fiber 57 | Typed match: same as `/food` | Choose whole grain: Bread, whole wheat 57 |
| spaghetti | 3 chips | Spaghetti, cooked, fat added in cooking 46 | Spaghetti, cooked, whole wheat, fat added in cooking 82 | same | Choose whole grain: 82 |
| bacon | 3 chips | Bacon, for use with vegetables 26 | Chicken, for use with vegetables 62 | Cocoa powder, not reconstituted 91 | Reviewed candidate set (R7); that category is never a pool |
| french fries | 3 chips | Potato, french fries, restaurant 56 | None: "Nothing similar scores higher." (64 exists) | none | Preferred target: Potato, boiled, from fresh, peel eaten, no addded fat 66 (the row's own spelling) |
| fried fish | 3 chips | Fish, NS as to type, battered, fried 77 | Fish, NS as to type, raw 100 | Fish, NS as to type, raw 100 | Bake, broil or grill it: Fish, NS as to type, baked or broiled, no added fat 95 |
| baked chicken | 3 chips | Chicken, wing, roasted, broiled, or baked, skin eaten 52 | The same wing, skin not eaten, 64 | Chicken liver, braised 81 | Take the skin off: 64 |
| chicken nuggets | Match 26 | Chicken nuggets 26 | Chicken nuggets, from school lunch 40; then Chicken liver, braised 81 | Typed match: same as `/food` | Chicken fillet, grilled 64 (nutrition lead to confirm) |
| refresco | Miss, 2 chips | Queso Fresco; Adobo fresco | n/a | n/a | Reviewed soft-drink row (R7), then water or unsweetened tea |
| jugo de naranja | Miss, 3 chips | Salsa, pico de gallo, and two soups | n/a | n/a | Reviewed orange juice row (R7), then "A good choice as it is." (72) |
| papas fritas | 2 chips | Stewed potatoes, Mexican style (Papas guisadas) 53 | Stewed potatoes with tomatoes 71 | Vegetable combinations, Asian style, ..., cooked, made with oil 92 | Reviewed french fries rows (R7) |

## Appendix B. Corpus reach, every case

Taps are counted after the typed line is submitted, following the typed hook's own order of operations at HEAD. "One tap" assumes the person picks a chip whose row has an alternative; some chips name the wrong food.

- Alternative with no tap (5): `exact-doritos`, `exact-pan-dulce`, `compound-biscuits-and-gravy`, `es-arroz-con-pollo`, `seq9-baked-banana`.
- Alternative after one chip tap (35): `ambig-pizza`, `ambig-chicken`, `ambig-soup`, `ambig-salad`, `ambig-coffee`, `ambig-fried-chicken`, `ambig-grilled-chicken-no-sauce`, `exact-bojangles-combo` (its chips are Fun Fruits Creme Supremes and two chicken rows), `compound-chicken-and-dumplings`, `compound-mac-and-cheese`, `compound-macaroni-and-cheese`, `compound-pbj`, `compound-spaghetti-and-meatballs`, `compound-rice-and-beans`, `compound-ham-and-cheese-sandwich`, `compound-chicken-and-rice`, `es-frijoles`, `es-huevos`, `es-tamales`, `en-tamale`, `es-tamal`, `es-pollo-asado`, `es-es-un-tamal`, `es-son-frijoles`, `es-como-pollo`, `es-agua` (its chip is a noodle soup), `es-queso`, `en-no-it-is-a-tamale`, `seq1-pizza`, `seq5-correction-tamale`, `seq6-can-of-soup`, `seq7-2-slices-pizza`, `excl-black-coffee`, `excl-diet-soda` (its first chip is Irish soda bread), `fail-restaurant-combo`.
- Never, scored with an empty list (23): `exact-apple`, `exact-banana`, `exact-honey-nut-cheerios`, `exact-cheerios`, `exact-plain-cheerios`, `exact-mountain-dew`, `exact-ale-8`, `exact-soup-beans`, `ambig-diet-coke`, `es-manzana`, `es-platano-accent`, `es-platano`, `es-banano`, `seq3-apple`, `seq3-banana`, `seq4-cheerios`, `seq4-honey-nut`, `seq5-correction-apple`, `seq5-correction-es`, `seq8-plain-cheerios-again`, `seq8-cheerios-protein`, `seq9-banana-raw`, `recovery-after-safety`. Under R1 to R5 these become the affirmation (apple, banana, Cheerios, soup beans and their Spanish and sequence twins), a swap (both Honey Nut Cheerios cases and Cheerios Protein) or the drink swap (Mountain Dew, Ale-8, diet coke).
- Never, candidates whose chips have no alternative (2): `exact-quinoa`, `es-leche`. Both become affirmations or similar lines under R5.
- Never, plate lines and plate items (12): `compound-fish-and-chips`, `list-pizza-and-salad`, `list-apple-banana`, `part-apple`, `part-banana`, `part-fried-chicken`, `part-mashed-potatoes`, `part-green-beans`, `part-cornbread`, `part-sweet-tea`, `part-banana-pudding`, `seq7-side-salad-ranch`. Unchanged: plates show no swaps.
- Never, carve-outs (7): `seq1-water`, `excl-water`, `excl-bourbon`, `excl-wine`, `excl-hard-seltzer`, `excl-infant-formula`, `excl-baby-food`. Unchanged.
- Never, misses with no chips (5): `es-cerveza`, `es-manzana-roja`, `seq2-unknown`, `seq10-long`, `fail-gibberish`.
- Never, safety intercepts (9): `safety-appetite-hopeless`, `safety-appetite-hopeless-es`, `safety-child-ingestion`, `safety-child-ingestion-es`, `safety-dose-question`, `safety-dose-short`, `safety-skip-metformin`, `safety-high-sugar`, `safety-dose-es`. Unchanged: safety comes first.
- Never, a question (1): `seq6-is-45-carbs`. Never, an empty line (1): `seq10-empty`.
