# Unified Food Lens Platform — One Engine, Two Doors

> **Status: P0–P6 COMPLETE. P0–P5 deployed 2026-08-28; P6 (the namespace move) built the same day.** Application commit `d584540`; production deployment `dpl_91VJKNgyp5kfWDSUx498pFH3QqNm` at `https://patient-centered.vercel.app`; ledger line in `docs/ops/DEPLOYS.jsonl`. Redeploy with `vercel --prod --archive=tgz`; `git push` does nothing on this project.
>
> **Design provenance:** Authored 2026-08-27 from an adversarial design panel: two code scouts (responsibility diff matrix, constraint sweep), three independent architectures with opposing priors (minimal extraction · radical one-URL · full platform-adapter), three judges (clinical-safety/privacy auditor, pragmatic implementer, product advocate). Every load-bearing claim below was verified against the working tree at `9fb547d`; the two losing designs both contained judge-verified mechanism errors on the authority-stack seam, which is itself a finding this spec records.
>
> The ask: *"/food and /compass should be combined into a unified platform."*

## 1 · The verdict

**Unify the engine, keep two doors.** Spec 25 already merged the rendering layer (`FoodLensShell`, capability props, zero route checks). What is still duplicated is ~1,600 lines of *page-level orchestration* across `src/app/food/page.tsx` (~915 lines) and `src/app/compass/page.tsx` (~809 lines), plus a split product identity. This spec unifies the orchestration into one provably store-free shared layer and one product identity — behind the two existing URLs, which become ~thin "doors" of pure per-mount policy.

**One decisive topology fact:** nothing inside the app links to `/compass` — every in-app deep link (`menu-grid.tsx:23`, `glucose-insights.tsx:36`, `week-in-food-card.tsx:54`, `teachable-moment-card.tsx:13`, `front-door.ts:18`, `route-classifier.ts:21`) points at `/food`. `/food` is the product; `/compass` is a distribution channel. "Unified platform" means one engine behind both, not one URL.

### 1.1 One-URL, rejected on the record (so the question is answered permanently)

Two variants were designed in full before rejection:

- **`/food?mode=guest`** — fails **open**. Query params are the least durable part of a shared URL (truncated by messaging apps, dropped by copy-link flows, re-typed bare). A stripped param lands an outsider on the demo patient record — Maria/Brent, medications, BP readings — the exact leak `e2e/compass.spec.ts:118-119` exists to prevent. A public health demo must fail closed. **Rejected.**
- **`/food` defaults to guest; personal mode via a device-claimed localStorage flag** — fail-closed and the strongest one-URL design available. Still loses on four concrete costs: (1) one URL = one `<title>`/manifest identity, but the tab-title split is a deploy-verified requirement (`src/app/compass/layout.tsx`: "wrong on a shareable food demo") and metadata cannot read localStorage; (2) the mode decision downgrades from a build-time import-graph fact to a runtime conditional, weakening the store-free proof and adding first-paint mode flicker; (3) the two independent per-route bundle budgets (`scripts/check-ladder-bundle.mjs`) collapse to one, killing the ~110 KiB gzip delta that is today's passive witness that the public mount excludes personalization code; (4) ~15 e2e `goto` sites and every in-app `/food` href acquire mode-flag coupling. Gain: one URL on a slide. **Rejected.**

If profiles/auth ever arrive, the seam for one-URL is already in this design (§6, the persistence adapter) — revisit then, not now.

## 2 · Architecture

Three layers. Layer 0 exists (spec 25). This spec adds Layer 1 and thins Layer 2.

```
Layer 2  THE DOORS (per-route, thin — pure policy)
         src/app/food/page.tsx              src/app/compass/page.tsx
         store, crisis source,              blankCompassState, refinement +
         barcode/label/portion authority,   5s stability release, pizza-intent,
         plate/pantry/favorites/meal-log,   auto-start + scripted TTS, weHeard,
         persisted transcript sink          sort modes, session transcript array
                     \                          /
Layer 1  THE ENGINE + EXPERIENCE (new, shared, provably store-free)
         src/hooks/use-food-lens-engine.ts       — camera lifecycle + live-loop wiring + passcode
         src/components/food-lens-experience.tsx — shell assembly, default verdict/whyScore slots
         src/hooks/use-passcode.ts · use-page-hide-teardown.ts · use-why-score.ts
                     |
Layer 0  THE SHELL (exists, unchanged)
         food-lens-shell.tsx · food-lens-blocks.tsx · food-lens-voice-bar.tsx
         use-live-food-score.ts · use-viewfinder-visibility.ts · use-food-camera.ts
         use-food-voice-session.ts
```

**The load-bearing boundary rule:** Layer 1 files may never value-import `@/state/store`, `@/state/storage`, or `@/components/app-shell` (which imports the store), directly or transitively. Personalization enters Layer 1 only through props the `/food` door supplies. Enforced by the §3 witness on every `npm run check` — not a convention.

### 2.1 `useFoodLensEngine` (new hook)

Owns: `useFoodCamera()` + the mount-start effect (today duplicated at `food/page.tsx:345-348` / `compass/page.tsx:374-376`), the `useLiveFoodScore` invocation (`food:127-136` / `compass:98-105`), and passcode. Inputs per mount: `barcodeActive` (`/food`: `activeBarcode !== null`; `/compass`: `false`) and `crisis` (`/food`: `hasUnacknowledgedCrisis(state)`; `/compass`: session latch). It does **not** own the page-hide teardown — that needs the voice session's `stop`, created later in the door with mount-specific config; the door calls the shared `usePageHideTeardown([...stops])` itself.

Deliberately **not** in the engine: `useLiveFoodScore` internals (invariant: gate/stash/crisis semantics untouched, only invoked), the voice session, any resolution/authority logic.

**Why a hook + component pair rather than one god component:** `/food` must compute its authority stack (`scannedFood = barcodeFood ?? labelFood`, then barcode/label > correction > live match) *from* the live hook's output *before* the shell renders. So the door calls the engine at top level, runs its own per-mount hooks against the result, and hands a finished view to `<FoodLensExperience>`. Standard React, no cleverness.

### 2.2 `FoodLensExperience` (new component)

Consumes a finished `FoodLensView` — `{ foodKey, foodName, score, carveOut, estimatedDomains, badge, noMatch }` — and **never learns whether a name came from a barcode, a label photo, a correction pin, or a spoken refinement**. Internally: runs `useWhyScore(foodKey)` (the close-refocuses-marker + reset-on-new-food dance, character-identical today at `food:648-663` / `compass:400-407`); builds the default **verdict** and **whyScore** slots (the two genuinely identical slot bodies); merges door-supplied `slots` over the defaults; invokes `FoodLensShell`. A `sharedViewfinderProps()` helper returns the ~12 identical `FoodViewfinder` props; each door spreads it and adds its own.

Slots that stay **pure pass-through from the doors** (verified divergent, not unified now): `plate`, `chart`, `weHeard`, `flags`, `totals`, `nutrients`, `alternatives`, `actions`, `attribution`. They can graduate later, one at a time, behind the same gates — under the §6 adapter rule.

### 2.3 Leaf extractions

- `use-passcode.ts` — the one true `?k=` parse. Replaces **five** sites: `food/page.tsx:104`, `:319`, `compass/page.tsx:76`, `use-food-voice-session.ts:197`, `:346`.
- `use-page-hide-teardown.ts` — one `visibilitychange`+`pagehide` registration holding stops in a ref (`/food` passes `[camera.stop, voice.stop]`; `/compass` adds `stopSpeaking`). Deliberate delta from today's re-subscribing effect: equivalent-or-better, documented in the file header, unit-tested for stop-identity churn.
- `use-why-score.ts` — `{ whyOpen, close, markerRef }` with the focus handback.
- The character-identical T2 estimate-badge span folds into `FoodVerdict` (rendered when `score.tier === "T2"`); the `tierBadge` prop is deleted.

### 2.4 Boundary rules (checkable by an implementer)

1. Layer 1 never value-imports the forbidden modules — machine-enforced (§3).
2. Layer 1 never reads `usePathname`/`location.pathname` — machine-enforced (§3). No mode enum, no route check in disguise.
3. The experience receives `crisis: ReactNode | null` and **nothing else about crisis** — `/food`'s reversible store-derived crisis and `/compass`'s one-way session latch both compile to "a node or null" before crossing the boundary.
4. Transcript sinks never cross the boundary: `onFinalTranscript`/`onSafetyIntercept` stay wired door-side. No shared code touches `AiMessage`, `sources`, or `carePlan.id` (the grounding wipe vector stays untouchable by construction). **If voice wiring ever moves into the shared layer, the intercept→crisis-trip must be wired outside any per-mount customization surface.**
5. All `dynamic()` imports stay in `food/page.tsx` so the chunk graph — and both bundle budgets — move minimally.
6. The doors own their voice configuration entirely (`compass-instructions.ts` / `food-instructions.ts` are never merged — the compass persona's "there is no patient here" is a safety property).

## 3 · The store-free witness — `scripts/check-public-door-store-free.mjs` (new, Phase 0; renamed with the route in P6)

Converts spec 24 decision 5 from an e2e-pinned convention into a build-time-proven property. Designed around two verified subtleties that break the naive approaches:

- The root layout (`src/app/layout.tsx:24`) mounts `HealthStateProvider` around everything, so the storage-key literal is **already, correctly** in `/compass`'s shared layout chunks → a bundle-string scan false-positives on day one.
- Webpack dedup makes chunk-byte scans blind to cross-chunk module references → a chunk-level check proves nothing.

**Mechanism:** BFS over the real TypeScript source graph from `src/app/compass/page.tsx`. Extract specifiers from `import … from`, `export … from`, and `import("…")`; **skip `import type`** (erased at compile time — this is what lets `AppState` flow through `@/domain/types` freely); mixed imports count as value edges (conservative). Resolve `@/x` → `src/x`; ignore node_modules. **Forbidden leaves:** `src/state/store.tsx`, `src/state/storage.ts`, `src/components/app-shell.tsx`. **Explicitly allowed:** `src/state/selectors.ts` — pure, verified (its only import is `import type { AppState }`), and already on `/compass`'s graph via `use-food-voice-session.ts:11`. Also asserts no Layer-1 file references `usePathname`/`location.pathname` (rule 2). On failure, prints the shortest offending import chain. ~80 lines, `node:fs`+`node:path` only (no new packages).

**Negative fixture:** the script also asserts `src/app/food/page.tsx` *does* reach `store.tsx` — permanent proof the walker works.

**Wiring:** `"storefree"` script; `check` becomes `lint && test && storefree && build && bundle:ladder`. `check-ladder-bundle.mjs` is untouched — the ~110 KiB `/food`-minus-`/compass` gzip delta stays as the independent second witness, and the 900 KiB single-chunk trap keeps guarding the 5 MB data assets. ESLint `no-restricted-imports` may be added later for editor feedback but is not the guarantee (not transitive).

## 4 · What deliberately stays per-mount (and the recorded model for ever changing it)

| Stays split | Why it must |
|---|---|
| URLs, titles, chrome, PWA identity | Externally shared `/compass` URL; deploy-verified metadata split (revisitable via §7 Phase 6 only) |
| State source (`useHealthState` vs `blankCompassState`) | Spec 24 decision 5, locked |
| Input shape / capability constants | Decision 5 + `compass.spec.ts:56` freeze |
| **The authority stack** | See below — two spending disciplines, not one mechanism with two configs |
| Transcript sink (persisted `AiMessage` w/ `sources` vs capped session array) | Wipe-vector adjacency; any shared sink is a safety change |
| Crisis lifecycle (reversible store vs one-way latch) | Irreconcilable semantics; crosses the boundary only as `ReactNode \| null` |
| Voice personas, tools, auto-start policy | Compass ignorance is a safety property; `/food` never speaks unprompted (spec 24) |
| Classifier/menu absence of `/compass` | The two user populations must never cross a link |

### 4.1 The authority stack — recorded so the next session inherits the mechanics, not the bug

Both losing panel designs made verified mechanism errors here; this is the mandatory starting model for any future unification attempt (which must run as **its own spec**, not a refactor):

- Today authority is split three ways: `/food`'s page memos (`scannedFood`/`identifiedFood`, `food/page.tsx:138-147`), the hook's internal 60s correction pin (`CORRECTION_PIN_MS`, `use-live-food-score.ts:22/209/218-224/260`), and `/compass`'s page-local refinement with a 5s scene-stability release (`compass/page.tsx:315-330`).
- These are **two spending disciplines**: a wall-clock correction pin **suppresses paid identify calls** (`suspendVision: true`), while a scene-stability refinement release **requires the vision loop to keep spending** — it needs fresh matches to detect that a different food has held for 5s (`suspendVision: false`). Any unified model must carry an explicit per-policy `suspendVision`; a "pin far in the future, release on stability" design starves its own release condition via the spend-guards at `:218/:260` — the named failure mode, do not repeat.
- Global precedence if ever unified: **correction > barcode > label > refinement > vision**; per-mount difference is which sources are *registered*, never the order. Specify against **all five** pin sites — including the `correctionPinnedUntilRef.current = 0` clear inside barcode preemption (`use-live-food-score.ts:~380`): barcode outranks a held correction.

## 5 · Product identity + feature parity

- **One name: "Food Lens."** `src/app/compass/title.ts` → `"Food Lens — public demo"` (its own comment invites the rename). `docs/food-lens-demo.md` restructures from two runbooks into one product doc with a *Personal door (/food)* and *Public door (/compass)* section.
- **`/food` absorbs** (Phase 5, owner-flippable — the first patient-visible value): the chart's full four-state machine (pending/no_match/carve_out/idle — strictly better than render-when-score-else-nothing), the nutrients no-panel fallback line, and the weHeard interpretation panel via one `CorrectionSurface` (renders whenever a resolution carries `interpretation` — additive, store-free).
- **`/food` does NOT absorb by default:** sort modes (a demo-analysis affordance that costs phone-viewport height spec 19 fought to reclaim — one-line owner flip later); auto-conversation (never — spec 24: `/food` doesn't speak unprompted).
- **`/compass` never gets:** typed input, barcode, label fallback, plate, portions, flags, totals, favorites, meal log, pantry, saved picks, persisted transcript, any store, any telemetry (spec 25's privacy stance stands).

## 6 · The future seam: `FoodLensPersistence`

When any store-fed slot later graduates into the shared experience, store-backed features must enter as **members of a nullable typed adapter** — `persistence: FoodLensPersistence | null`, constructed only by the `/food` door from `useHealthState()`, with the shared layer importing **only the type** (erased at compile time) — never as capability booleans. Structural unrepresentability is strictly stronger than convention: a decision-5 violation stops compiling instead of merely failing review. This adapter is also the eventual auth/profiles seam, and the precondition for ever revisiting one-URL (§1.1).

## 7 · Phased plan

Every phase is a complete, committed, green unit. **Gate per phase:** `npm run check` (now including the witness) + `npm run crisis:gate` + Playwright chromium **and** mobile — with `e2e/compass.spec.ts`, `e2e/food-lens.spec.ts`, `e2e/food-lens-shell.spec.ts`, `e2e/diabetes-loop-tier2.spec.ts` **byte-unchanged** through Phase 4.

| Phase | Content | Effort | Key detector if wrong |
|---|---|---|---|
| **P0** | The witness (§3): store-free BFS + route-blindness + negative fixture, landed green on the *untouched* tree | 0.5 d | Self-testing by construction |
| **P1** | **Pin currently-untested behaviors first**: compass frame-suppression while a refinement holds (`compass/page.tsx:240-242`), correction-pin spend-suppression, pizza-intent clearing on stability release, the auto-start branch. Then leaf extractions: `use-passcode` (5 sites), `use-page-hide-teardown`, `use-why-score`, T2 badge fold — each with its own unit tests | 1–1.5 d | whyScore focus handback → `food-lens-shell.spec.ts:147-175` |
| **P2** | Engine + experience + door rewrite. **Cut-paste, not re-author** — every per-mount mass moves verbatim. Expected: `food/page.tsx` ~915→~620, `compass/page.tsx` ~809→~600, ~280 shared new lines, net ≈ −150. New `food-lens-experience.test.tsx` re-proves the input-shape guarantee at the new layer (guest capabilities → zero textboxes, zero strip buttons, zero personalized guidance scope) | 2.5 d | Witness (import chain printed at build); gate/stash e2e; untouched 192/303 KiB budgets |
| **P3** | Optional consolidation inside the seam — pixel-identical only; anything that can't stay pixel-identical is dropped, not negotiated | 0–1 d | e2e byte-unchanged |
| **P4** | Identity: title rename, one product doc, this spec finalized with the §4 "why these stay split" list | 0.5 d | — |
| **P5** | *Owner-gated:* `/food` parity absorptions (§5) — chart state machine, nutrients fallback, weHeard/CorrectionSurface | 1 d | New e2e for the absorbed states |
| **P6** | *Owner-gated, on the shelf:* namespace move — `src/app/compass/` → `src/app/food/demo/` + `next.config.mjs` permanent redirect `/compass → /food/demo` (query strings preserved; deploy-verified precedent: `/family → 308 → /ladder`). The shared link in the wild keeps working forever; `/food/demo` inherits only root + its own layout so the metadata split survives; joins neither menu nor classifier | 0.5 d | Redirect e2e + both-routes-200 ledger convention |

Deploy (`vercel --prod --archive=tgz`) + `DEPLOYS.jsonl` line at the end of whatever is approved. **Core plan P0–P4: ~5–6 solo days. Everything through P6: ~7–8.**

## 7.1 · What actually shipped, and the one correction made on the way

P0–P5 landed 2026-08-28 (`f6bdffd`, `63e910c`, `06272b2`, and this commit). P3 was cut as
the plan allowed — P2 had already taken its value, and nothing left could stay
pixel-identical. The doors went 915 → 832 and 809 → 720 lines; both route budgets came down
rather than up.

**The correction.** P5 as designed said `/food` should absorb the chart's full four-state
machine, including `/compass`'s carve-out state. Implementing it showed that would have
broken spec 25 §6 — *a carve-out has no chart* — which `e2e/food-lens-shell.spec.ts` asserts
on `/food`. The chart was unified the other way instead: the carve-out rule now holds on
**both** doors, which fixes a quiet spec-25 violation on `/compass` that had been rendering a
"not scored" plot. Whether the plot holds its place when there is nothing to plot became a
capability (`chartPlaceholder`) rather than a mount difference: the public door's chart is
the centrepiece of its page, the personal door's empty screen belongs to the recents row.
`/food` gained the pending and no-match states, which is the parity actually worth having.

**Not absorbed:** the we-heard interpretation panel. On `/food` an `interpretation` only ever
arrives from the text path, which that door does not use, so the panel would have been dead
code rather than a feature.

**Also found and fixed on the way in:** a blanket `vi.useFakeTimers()` in the new compass
tests stalled the identify promise, so the refinement landed through `runQuery`'s catch —
indistinguishable from success, which would have let the release test pass without a request
ever being made. Timers are now narrowed to `setTimeout`/`clearTimeout` and the test asserts
the request fired.

**Flakes, not regressions:** `quick-check.crisis`, `swyc-checkin`,
`family-orientation-interview` and one Playwright legend test each failed once under
full-suite load and passed immediately in isolation — the documented precedent for this repo.

## 7.2 · P6, as built

The public door moved from `/compass` to `/food/demo` — under the product it is a door onto.
`src/app/compass/{page,layout,title,page.test}` moved to `src/app/food/demo/`, `e2e/compass.spec.ts`
became `e2e/food-demo.spec.ts`, and `next.config.mjs` gained a permanent redirect beside the
existing `/family → /ladder` one. Next carries the query string through, so `?lang=es` survives
the hop — which two new e2e tests assert, along with the status code being **308** and not a
temporary 307.

**The move created one new risk, and closed it.** At `/compass` the public door inherited only
the app root layout. At `/food/demo` it also inherits anything at `src/app/food/layout.tsx` —
a file that does not exist today, would apply to the public door without appearing anywhere in
its own directory, and is exactly where someone would put a provider. The store-free witness now
walks the inherited wrapper chain between the app root and the route, with the root itself the one
documented exception (it mounts `HealthStateProvider` around everything by design). Both wrapper
kinds are walked: a `template.tsx` wraps children exactly as a layout does, so it is the same leak
surface under a different filename. Verified by planting a store-importing `src/app/food/layout.tsx`
and then a `template.tsx`, and confirming the check fails with the chain printed.

That walk finds nothing today, which made it the easiest thing in the file to delete or mis-seed
with every gate still green. So `--self-test` now drives it off a stub tree, and one function
builds the whole seed rather than two spreads that can drift apart. Five mutations were run
against it — drop `template.tsx`, seed at the app root, walk into the route's own directory, drop
the wrappers from the seed, drop the route files from the seed — and all five are caught.

**The public door was still advertising the patient app's installed identity.** Next merges
metadata field by field, so the demo layout declaring only `title` kept the root layout's
`manifest` and `icons`. Installing the shared link offered "My Health" with the patient icon and
opened `/today`. `/ladder` hit this exact bug first and fixed it the same way, so the public door
now ships `public/food-lens.webmanifest` (start_url `/food/demo`, scope `/` so the `/compass`
redirect still resolves inside the installed window) and `public/food-lens-icon.svg`, pinned by
`src/app/food/demo/layout.test.tsx`.

**Three capability flags were declared and read nowhere.** `sampleScan` duplicated the hard-coded
`demoPreview` prop; `plate` and `personalized` read as enforcement while enforcing nothing. All
three are deleted, and the type's header now records where that enforcement actually lives: the
import-graph proof, not a boolean a future edit can forget.

Reachability is unchanged: `/food/demo` joins neither the menu nor the route classifier, so the
public door still cannot be reached from inside the patient app, and the lockstep test never
notices. The route budget followed the route (`/food/demo/page`, same 192 KiB ceiling, measured
186.2 KiB).

One naming asymmetry left deliberately: `src/ai/compass-instructions.ts`, `compass-score.tsx`
and the `compass*` string keys keep their names. Those are Food Compass — the published scoring
system — not the old URL, and renaming them would be churn with no reader benefit.

## 8 · Owner decision points

1. **Approve P0–P4** (the engine + identity — no product-visible change, decision 5 strengthened to a build-time proof). *Recommended: yes.*
2. **P5 parity on `/food`** — the first user-visible payoff of unification. *Recommended: yes.*
3. **P6 namespace move** (`/compass` → `/food/demo` + permanent redirect) — ✅ **done** (see §7.2). The old link never breaks: 308 with the query string preserved, asserted in `e2e/food-demo.spec.ts`.
4. **Sort modes on `/food`** — *recommended: no* (phone-fit), capability stays one flip away.
5. **Authority-stack unification** — *recommended: not now.* If ever, as its own spec starting from the §4.1 model.
