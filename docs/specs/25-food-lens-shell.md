# Food Lens Shell — One Scroll Surface, and a Camera That Stops Paying For Itself

> Built from the design handoff in `Design/design_handoff_food_lens_shell/` (build spec draft 1, Aug 2026).
> **Status:** implemented 2026-08-25 on master and deployed 2026-08-26. Application commit `c827e97`; deployed source `648e479`; production deployment `dpl_EHLVRXFqLAj95q3oFVpHAK1xeB1c` at `https://patient-centered.vercel.app`. Fresh gates: `npm run check` green (lint · 3 498 unit tests · build · bundle budgets), `npm run crisis:gate` green (342/342), and every food-surface Playwright test green on chromium + mobile. Deploy path remains `vercel --prod --archive=tgz`; `git push` does nothing.

## What this replaced

`/food` and `/compass` each rendered a stack of independent cards under a fixed viewfinder. Both now render **one component** — `FoodLensShell` — as a single vertical scroll surface with four regions, and every difference between the two mounts is a capability prop rather than a route check.

| Region | Height | Behaviour |
|---|---|---|
| Viewfinder | 336px (132px collapsed) | Scrolls away normally. Not sticky. |
| Status strip | 44px, both modes | `sticky top-0`. Loop status while the camera is up; food name + score + a button back once it is not. |
| Content | auto | The eleven named slots, in fixed order. An empty slot renders nothing. |
| Voice bar | `sticky bottom-0` | Transcript expands upward, max 180px. |

336px is a constraint, not a preference: it is the largest viewfinder that still puts the band chip, the verdict sentence and the number on the first screen.

## The visibility gate (build spec §3 — the one net-new feature)

`useLiveFoodScore` gained two disarm reasons and one imperative input:

- **`"offscreen"`** — set when less than `GATE_PAUSE_BELOW` (0.50) of the viewfinder is on screen, cleared only when the ratio recovers past `GATE_RESUME_ABOVE` (0.60). Two thresholds, because a single line flips the loop on and off through a slow scroll. The resume then holds one full `LIVE_INTERVAL_MS` before the first send, so a flick past the camera costs nothing.
- **`"crisis"`** — explicit, because the crisis screen unmounts the camera and a naive gate would read 0% and pause: correct by accident. "Paused because you scrolled" and "stopped because we intercepted" do not share a code path.
- **`setVisibleRatio(ratio)`** — imperative on purpose. The ratio lives in a ref, is measured once per animation frame by `useViewfinderVisibility`, and only the derived on/off boolean is allowed to reach React state.

`rearm()` can still clear the current food, but it can never clear `"offscreen"` or `"crisis"` — ratio recovery is the only way back, and no "Scan again" chip ever appears for a scroll. Coming back inside the 60-second window restores `stashRef` instead of buying a fresh identify, and the scene signature and idle clock survive the pause, so `AUTO_DISARM_MS` bookkeeping is untouched.

Four loop states, because "no pill at all" is a real answer: `sending` · `searching` · `paused_offscreen` · `unavailable`. A permission error is not a loop state.

## Correctness rules the layout now enforces (§6)

- **A plate of one is not an average.** Below two items `PlateCard` shows the published score with its band and the word "average" is absent; at two or more it switches to "Plate average · N items" and gains the caveat. `formatPlateContext` says the same thing to the coach.
- **The plate average is never plotted.** Chart markers read `compass.score` only.
- **A carve-out has no number slot.** The 50px figure and the chart are absent, not zeroed or greyed — a dimmed dash reads as a bad score. The viewfinder badge reports "Not scored"; the carve-out sentence itself belongs to the verdict, which is the one place the product says it.
- **Servings never move the score.** Stated once, in the portion block.
- **Quadrant names live outside the plot** — a colour-keyed 2×2 legend beneath it with the user's quadrant marked, and the plot corners hold data.
- **The food name appears once per screenful.** The verdict prints it only while the strip is not.

## Things found while building, and fixed

- **`overflow: hidden` is still a scrollport.** Focusing the chart marker scrolled the plot's own hidden box instead of the page. The plot, the strip and the viewfinder now clip with `overflow-clip`, which creates no scrollport.
- **Two pinned bars swallow whatever the browser scrolls to an edge.** The shell sets `scroll-padding-top`/`scroll-padding-bottom` on the scroll root while it is mounted, so focus and a readable position arrive together. The voice bar's own controls opt out of that padding through `[data-food-lens-pinned]` in `globals.css` — otherwise the browser keeps trying to lift the bar clear of itself.
- **One unbreakable line in a grid item widened the document four-fold.** A grid item's default `min-width: auto` is its min-content width, and the truncated last-turn line in the voice bar is a single nowrap string: the phone answered by shrink-to-fitting the whole page to ~35%. `[&>*]:min-w-0` on the bar's grid. `e2e/food-lens-shell.spec.ts` now asserts no horizontal overflow at 412px and at 1440px.
- **The published alternatives arrive last and move everything below them.** The slot is held back until they land, because an empty `CompassAlternatives` says "already one of the best", which is not true yet.
- **Day totals reading 0% before anything was eaten** is a heading with an empty body, which the slot contract bans. The slot renders only once something has been logged today.

## Strings (§8 reconciliation)

The build spec estimated 19 new English strings and asked for a reconciliation before copy review. The actual count against the shipped dictionary is **31 new Food Lens keys (62 across `en`/`es`) plus 2 safety-adjacent keys**. The extra dozen are shell chrome the draft folded into other counts: wordmark, strip landmark and button, content/voice landmarks, the `of 100` unit, chart legend and direction lines, transcript toggle labels, the attribution line, the servings rule and the not-scored badge.

Two strings went into `safetyStrings`, not the copy review, and still need the safety approval path: **`voicePausedForSafety`** and **`crisisLockNote`**.

Three strings are the highest-risk in the set because they are the only place the product speaks a judgement in its own words: **`verdictEncourage` / `verdictModerate` / `verdictMinimize`**. They are drafted, not approved (§9).

The verdict's band chip keeps the **published band names** (Encourage / Moderate / Minimize), not the chart's quadrant names. The prototype's chip reads "Limit", which is the quadrant label; the verdict is about the band, and renaming a published band is a scoring-copy change this work has no mandate for.

Also done here: the **Spanish accent pass** §7 asked for around `compassCalorieDensity` — eleven strings in that region shipped unaccented.

## Open decisions (§9 — flagged, not guessed)

1. **Disclosure consolidation.** The design replaces three repeated guidance sentences with one pill and a detail sheet, and needs a compliance yes. Built the safe way instead: the gate's claim ("frames go out only while the viewfinder is on your screen") is **added** to the attribution block, and every existing inline guidance sentence stays. If compliance says "consolidate", the sheet is a small change; if it says "inline", nothing moves.
2. **The public denied-camera dead end.** `/compass` with no camera still lands on the sample scan — today's answer, unconfirmed.
3. **Chart alternative dots: re-score on tap, or read-only comparison?** Not built either way; only the user's own marker is a control, and it opens the domain breakdown.
4. **In-memory scan history on `/compass`.** Not built. Still an owner call.
5. **Verdict sentence ownership.** Drafted; needs an editor and an approver.

## Deliberately not built

**§11 telemetry.** The counters (`gate_pause`/`gate_resume`, `stash_hit` vs `reidentify_on_return`, `strip_camera_tap`, `verdict_visible_ms`, `voicebar_expand`) have no sink in this codebase — there is no analytics pipeline, deliberately, and `auditEvents` is a patient-visible privacy log in the patient's own store, which `/compass` must not have. Adding one is a privacy decision for the unauthenticated mount (§3.5 already rules out food names there), not an engineering detail. The gate exposes everything a future counter needs; the sink is the open question.

## Known cost (§14)

Under a draggable sheet the camera was always present — half-covered, but live. In the scroll model, reading the detail means the camera is gone. The Camera button in the status strip is a mitigation rather than a fix, and it is the first thing to watch in a real usability test.

Second cost: the shell, strip, voice bar and their strings add about 6 KiB gzip to each route. `scripts/check-ladder-bundle.mjs` budgets moved from 185 → 192 KiB (`/compass`) and 290 → 303 KiB (`/food`), measured at 186.6 and 297.3. The tripwire those budgets exist for — a ~1.6 MB `fcs2-foods.json` reaching the client — is untouched, and the per-chunk 900 KiB check is unchanged.

## Where the tests are

- `src/hooks/use-live-food-score.test.tsx` — the gate: pause at 0.49, hysteresis at 0.55, one-interval hold at 0.61, `rearm()` never clearing `offscreen`, the free stash restore, provider and crisis precedence, the four loop states, no-match candidates.
- `src/hooks/use-viewfinder-visibility.test.tsx` — ratio maths and the one-measurement-per-scroll-burst coalescing.
- `src/components/food-lens-shell.test.tsx` — slot order, the 44px strip in both modes, the camera button as a capability, and a render probe proving a strip flip re-renders 44 pixels rather than the content region.
- `src/components/food-lens-blocks.test.tsx` — verdict, carve-out with no number, no-match candidates, why-score focus.
- `e2e/food-lens-shell.spec.ts` — frames stop off screen, scrolling back costs nothing and shows no "Scan again", the strip's two modes at one height with the name shown once, the public mount's frozen input shape, the carve-out, the marker → breakdown → focus round trip, the legend beneath the plot, and no horizontal overflow at either end of the viewport range.
