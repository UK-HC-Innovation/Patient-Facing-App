# Package label scan — identity before score

> **Status: APPROVED FOR BUILD AFTER RED-TEAM REVISION. Production flag stays off.**
> Date: 2026-08-31
> Scope: the personal `/food` door gets package controls. The shared live path gains confirmation and a semantic package-abstention state; `/food/demo` gains no barcode, OCR route, store access, or package controls.
> Review record: [`docs/qa/2026-08-31-package-label-scan-red-team.md`](../qa/2026-08-31-package-label-scan-red-team.md)
> Verification gate: focused unit/integration tests, `npm run check`, `npm run crisis:gate`, flag-on and flag-off Chromium/mobile Playwright, route-level real-image evaluation, and a visual/accessibility pass.
> The ask: stop a package such as Edamame Ranch from being silently scored as a visually similar product such as Cool Ranch Doritos, then provide a reliable way to identify and score the actual package.

## 1. Build decision

The first draft was rejected. A single vision model cannot guarantee that it will always recognize packaging, and model confidence is not an independent check. The revised build moves the safety boundary out of model judgment:

1. **No single-food camera result publishes a score before a person confirms the proposed identity.** This holds whether the model calls the scene food, a package, or something unclear.
2. A front-package photo can propose brand, product, and flavor. It never selects FNDDS and never supplies nutrition.
3. A barcode lookup can propose an exact database product. It becomes authoritative only after the person confirms the displayed product name.
4. A Nutrition Facts photo supplies raw printed rows. Server code parses and validates those rows; the person sees every score-changing value before confirming.
5. A label-derived score ignores front name/category heuristics. Only confirmed printed ingredients may affect processing/additive domains.

The model may still make a candidate error. It may not turn that error into a silent score. For the reported regression, “Edamame Ranch,” an editable candidate, or a clear rescan request is acceptable. A Doritos score cannot appear until someone explicitly chooses Doritos.

## 2. Why the current path fails

Today’s loop is optimized for cheap recognition of one prominent loose food, not print:

- `useFoodCamera` downsizes loop frames to a 768 px edge at JPEG quality 0.7.
- `/api/food/identify` sends `detail: "low"` and asks for one food name.
- It requests confidence but does not enforce it.
- Any non-empty name can be fuzzy-matched to FNDDS and immediately publish a T1 score.
- FNDDS contains “Edamame, cooked” and an exact Cool Ranch Doritos row, but not every seasoned branded snack.
- Nutrition Facts is reachable only after an active barcode returns a validated miss.
- One frame wins; later `none`/error responses preserve the previous result.
- An active barcode disappears after about five seconds when the package is turned, which can clear the very context the label flow needs.

This is evidence routing and authority, not merely OCR quality.

## 3. Structural evidence rules

1. **Unconfirmed means unscored.** Image-only live results and barcode results remain candidates until explicit confirmation.
2. **No package-front FNDDS.** Brand/product/flavor text is display identity only and never calls `/api/food/identify { text }`.
3. **Nutrition has a visible source.** Package nutrition comes from a confirmed barcode record or confirmed raw Nutrition Facts rows.
4. **No model arithmetic.** The model transcribes raw labels, amounts, units, and headings. Deterministic code normalizes them. Unreadable and `<` values are not silently converted to exact numbers.
5. **Name cannot change label score.** `label_vision` scores ignore name/category keyword heuristics. Only confirmed printed ingredient text can affect D5/D6.
6. **Authority is epoch-bound.** Live, barcode, package, camera-stop, correction, and exit transitions share one monotonic epoch. An older async response cannot write after a newer authority decision.
7. **Abstention beats substitution.** Low evidence, multiple packages, ambiguous columns, inconsistent units, or conflict produces review/rescan.
8. **App-controlled non-retention.** The app stores no image or raw OCR evidence. It makes no broader promise about device or provider retention.
9. **One explicit attempt, one upstream call.** Retaking is another visible action. There is no automatic OCR retry.
10. **Authority order:** explicit user correction > confirmed barcode > confirmed Nutrition Facts > refinement > confirmed live-food candidate. Drafts never participate.

## 4. End-to-end authority flow

```text
low-detail live frame
  -> /api/food/identify
       food + sufficient evidence -> unscored candidate -> Confirm / Not this
       package cues               -> package abstention, clear stale score
       unclear                    -> no-match/abstain

confirmed live candidate
  -> POST /api/food/identify { foodId } (deterministic, no model)
  -> T1 score becomes visible

barcode detected
  -> existing seed -> Open Food Facts -> USDA lookup
  -> pin {barcode, database product} to current authority epoch
  -> show product name -> Confirm / Not this
  -> only confirmation makes barcode food authoritative

explicit package flow on /food
  -> cloud disclosure + signed short-lived package session
  -> high-resolution front photo -> candidate identity -> Confirm / Edit / Retake
  -> high-resolution Nutrition Facts photo -> raw rows -> deterministic validation
  -> show every included value -> Confirm / Retake
  -> confirmed identity + confirmed nutrition -> T2 label estimate

confirmed barcode at any point
  -> supplies identity + nutrition and closes the package flow
front/barcode disagreement
  -> show both, no score/logging, require a choice or retake
```

Identity, nutrition, and barcode are orthogonal. The UI recommends front first and Nutrition Facts second, but a barcode may arrive at any time and the patient may turn the package without losing the session.

## 5. Live identify becomes candidate-first

### 5.1 Exact model wire object

Keep the existing Chat Completions endpoint/model for the affordable live loop, but replace free JSON mode with one strict root object. All keys are required; conditional values are nullable; every object uses `additionalProperties: false`.

```ts
type LiveVisionOutput = {
  kind: "food" | "package" | "none";
  food: string | null;
  confidence: number;
  visualForm:
    | "loose"
    | "plated"
    | "sealed_package"
    | "open_package"
    | "mixed_package_scene"
    | "unclear";
  packageCues: Array<
    | "printed_product_text"
    | "nutrition_panel"
    | "barcode"
    | "wrapper_or_seam"
    | "retail_container"
  >;
};
```

Visible text is inert data, never an instruction. The prompt explicitly ignores instruction-like words printed in the image and never asks the model for nutrition or a score.

### 5.2 Route results

- `kind: "package"`, any package visual form, or any package cue returns `{ mode: "package" }` with no FNDDS work.
- `kind: "food"`, loose/plated form, no package cue, and confidence >= 0.80 may be matched/disambiguated, but returns `{ mode: "candidate", candidate, candidates }` without a score.
- Malformed, contradictory, or low-confidence output returns `none`.
- Text-only queries and exact `foodId` corrections retain their deterministic `match` response.

Confirming a live candidate posts its exact `foodId`; only that response enters `live.match`. This adds no model call. `useLiveFoodScore` gains `candidate`, `confirmCandidate`, and `packageDetected`.

A package response synchronously clears match, carve-out, candidates, no-match, correction pin, and the restore stash. During a package hold, a passive 32×32 signature loop may detect a changed scene but makes no paid request until rearm; this avoids both a stuck hold and background spend.

Both `/food` and `/food/demo` render candidate confirmation before a live score. `/food/demo` maps package mode to a route-blind semantic abstention with copy equivalent to “This looks packaged. I need a barcode or Nutrition Facts label to score it.” It imports no scanner control or private module.

## 6. Barcode confirmation and session pinning

Current automatic lookup stays, but lookup success populates `barcodeCandidate`, not `barcodeFood`.

- Capture the detected code and authority epoch before lookup.
- Abort/discard the lookup if the epoch changes.
- Keep the resolved candidate when `activeBarcode` later becomes null; turning the package is expected.
- Display database brand/product and code with `Use this product` and `Not this`.
- Confirmation promotes it to `barcodeFood`; rejection clears it and rearms scanning.
- A newly detected different code invalidates the old draft and requires a fresh review.
- If a confirmed front identity and barcode candidate have no discriminative token overlap, enter conflict and withhold score/logging. Generic stopwords never establish agreement.

This changes the authority stack from `barcodeFood ?? labelFood` to confirmed values only. `canLog` is false for every candidate, extraction, and conflict state.

## 7. Detailed capture without changing loop cost

Leave `grabFrame()` byte-compatible for the 768 px / 0.7 live ring. Raise the requested camera stream to an ideal 2048 px width, then add async `captureDetailedFrame()`:

1. Try `ImageCapture.takePhoto()` when available.
2. Otherwise draw the native video frame.
3. On iOS/unsupported devices, offer a native file/camera input. Accept common raster sources, reject SVG, and continue only if the browser can decode the image.
4. Normalize through a fresh canvas, apply browser orientation, strip EXIF, and output `image/jpeg`.
5. Start at max edge 2048 / quality 0.90; iteratively reduce quality and then dimensions until the data URL is <= 3,600,000 characters.
6. Reject failure rather than using the 768 px loop frame for OCR.
7. Revoke object URLs, clear blob/file refs, zero temporary arrays where practical, and never put the data URL in React or persisted state.

The server enforces a 4,000,000-byte whole-request ceiling, leaving headroom below [Vercel’s 4.5 MB function limit](https://vercel.com/docs/functions/limitations). It accepts only a base64 JPEG, verifies magic bytes and declared JPEG dimensions, caps each edge at 2048 and total pixels at 4,194,304, and caps decoded bytes before calling the provider.

## 8. Authenticated package route

### 8.1 Fail-closed configuration

- `NEXT_PUBLIC_FOOD_PACKAGE_SCAN=1` mounts personal package controls at build time.
- `FOOD_PACKAGE_SCAN_ENABLED=1` permits session/paid routes at runtime.
- `FOOD_PACKAGE_SESSION_SECRET` must contain at least 32 random bytes.
- `DEMO_PASSCODE`, `HEALTH_AI_PROVIDER=openai`, and `HEALTH_AI_API_KEY` must also exist.
- `HEALTH_AI_PACKAGE_MODEL` starts with `gpt-5.6-luna`; the release corpus may require Terra. Use the least costly model that passes, record the exact model/config, and pin a snapshot when one is available.

Missing flag/auth configuration returns `mode: "disabled"` without reading a large body or calling OpenAI.

### 8.2 Package session

Add `POST /api/food/package/session` following the existing family AI auth pattern:

- same-origin only;
- bounded 1 KB JSON containing passcode and disclosure version;
- constant-time invite comparison;
- short-lived signed HttpOnly, SameSite=Strict cookie scoped to `/api/food/package`;
- issue/provider rate buckets and bounded key count;
- no-store response;
- the package panel shows the approved cloud-image disclosure before this request.

The paid route requires the valid cookie, same origin, rate allowance, and an in-process concurrency slot. The flags remain off for a real production posture until a distributed limiter and external approvals exist.

### 8.3 `POST /api/food/package`

Body: `{ kind: "front" | "nutrition", image, patientId? }`.

Read it with a streaming byte-bounded JSON helper. Enforce content type, strict request schema, image MIME/magic/dimensions, and field lengths before provider spend. Route modes are `front`, `nutrition`, `needs_rescan`, `disabled`, `unconfigured`, `locked`, and `error`.

Use the OpenAI Responses API with a fully specified request:

- `POST /v1/responses`;
- `store: false`;
- `reasoning: { effort: "none" }`;
- system `input_text` plus user `input_text` and `input_image` at `detail: "original"`;
- one root-object strict `text.format` JSON schema, all keys required/nullable and all objects `additionalProperties: false`;
- `max_output_tokens: 350` for front, `1200` for nutrition;
- one upstream request only;
- 20-second timeout combined with `request.signal` so client abort can cancel upstream work;
- existing safety identifier, no-store responses, and no image/error echo.

Parse output by type rather than assuming the first item is text. Refusal, incomplete output, absent message text, schema failure, timeout, and provider error are visible failures. GPT-5.6 supports image input, Structured Outputs, and original image detail; `original` preserves dimensions and is appropriate for small-text OCR ([model guidance](https://developers.openai.com/api/docs/guides/latest-model), [Luna model](https://developers.openai.com/api/docs/models/gpt-5.6-luna)).

## 9. Front identity contract

The strict model object is a single root object:

```ts
type PackageFrontOutput = {
  kind: "single_package" | "multiple_packages" | "not_package" | "unreadable";
  quality: "good" | "blur" | "glare" | "too_far" | "cropped";
  brand: string | null;
  product: string | null;
  flavor: string | null;
  visibleText: string[];
  confidence: number;
};
```

The server accepts a review candidate only when:

- `kind === "single_package"` and quality is `good`;
- confidence >= 0.85;
- product or brand is present;
- at least one discriminative brand/product token occurs in normalized `visibleText`;
- bounded fields contain no control characters and there is only one product.

Words such as “snack,” “original,” “flavor,” and “ranch” alone are not discriminative. The visible-text list is a review aid from the same model, not independent proof. The patient confirms, edits the display identity, or retakes. No front result calls FNDDS.

Prompt-injection fixtures include packages printed with “ignore previous instructions,” JSON fragments, model names, and requests to output another product.

## 10. Nutrition Facts raw-row contract

The model returns raw visible strings rather than trusted numeric values:

```ts
type NutritionRow = {
  field:
    | "calories" | "total_fat" | "saturated_fat" | "trans_fat"
    | "cholesterol" | "sodium" | "total_carbohydrate" | "fiber"
    | "total_sugars" | "added_sugars" | "protein" | "potassium"
    | "calcium" | "iron" | "mono_fat" | "poly_fat";
  printedLabel: string;
  printedAmount: string;
  printedUnit: string | null;
};

type PackageNutritionOutput = {
  kind: "nutrition_facts" | "not_label" | "unreadable" | "ambiguous_columns";
  quality: "good" | "blur" | "glare" | "too_far" | "cropped";
  servingSizeRaw: string | null;
  servingsPerContainerRaw: string | null;
  columnCount: number;
  selectedColumnHeading: string | null;
  rows: NutritionRow[];
  ingredientTextRaw: string | null;
  confidence: number;
};
```

All keys are required in the wire schema. Rows are bounded, unique by field, and carry both the printed nutrient label and amount/unit. Instruction-like label text remains data.

### 10.1 Deterministic normalization

- Accept only one unambiguous per-serving column in P0. `columnCount > 1`, “per container,” or an unclear heading returns `needs_rescan`.
- Field-specific parsers accept expected `g`/`mg` units and calories with no `%DV` interpretation. A mismatched unit rejects that row; it is never converted by guess.
- Parse locale decimal comma where the visible label language supports it.
- Printed exact zero remains zero. Printed `<1 g` remains a visible upper-bound row but normalizes to `null`; it is never turned into 0 or 1.
- Apply existing per-serving caps after parsing.
- Require visible serving size and exact calories plus exact total fat, saturated fat, sodium, total carbohydrate, fiber, total sugars, added sugars, and protein for an immediately reviewable T2 draft.
- Require at least three included Food Compass domains. Calories-only and sparse-label neutral scores are forbidden.
- Rounding-aware relationships allow 1 g slack: saturated fat <= total fat + 1; added sugars <= total sugars + 1; sugars/fiber <= carbohydrate + 1.
- With exact fat/carbohydrate/protein, compute `macroKcal = 9F + 4C + 4P`. Warn when `abs(macroKcal - calories) > max(50, 0.5 * calories)`. Hard-reject only an obvious factor/column error where either value is more than 3× the other plus 100 kcal and no visible alternate-energy cue exists. Sugar alcohol/high-fiber cases remain review warnings, not automatic failures.
- A printed zero-calorie label is valid input and resolves to the existing `zero_calorie` carve-out rather than a rescan loop.

Every included numeric row, unit, serving basis, ingredient string, warning, and omitted/unusable row is visible before confirmation. Nothing score-changing is collapsed. The patient can retake; no action is preselected.

### 10.2 Score isolation

Confirmation creates the existing `IdentifiedFood` with `source: "label_vision"`, per-serving basis, the confirmed identity, session barcode if any, normalized visible values, and confirmed ingredient text.

Add `allowIdentityHeuristics?: boolean` to `computeLabelScore`, defaulting true for compatibility. `useCompassScore` passes false for `label_vision`, so name/category cannot trigger cured-meat or processing penalties; the ingredient string can. A unit test holds nutrition/ingredients fixed, changes the front name to “jerky,” and requires an identical score.

No new persisted `FoodSource`, meal-log field, or storage migration is needed.

## 11. Orthogonal package state and authority epoch

Add `usePackageScan` with a reducer whose state contains independent axes:

```ts
type PackageScanState = {
  active: boolean;
  epoch: number;
  identity: Idle | ReadingFront | FrontReview | ConfirmedIdentity;
  nutrition: Idle | ReadingNutrition | NutritionReview | ConfirmedNutrition;
  barcode: Idle | LookingUp | BarcodeMiss | BarcodeReview | ConfirmedBarcode | BarcodeConflict;
  error: PackageScanError | null;
};
```

The engine owns a synchronous monotonic authority ref shared by live, barcode, and package controllers.

- Increment before package start, barcode replacement, live confirmation/correction, camera stop, cancel, exit, and scan-again.
- Capture epoch before every fetch and check it before every state mutation after `await`.
- Starting package mode increments synchronously, clears live/restorable authority, and aborts generic identify before React state changes.
- Barcode/session candidates survive `activeBarcode === null` while the package is turned.
- Browser `AbortController`s cancel invalidated identify, lookup, session, front, and nutrition requests.
- The route combines disconnect abort and timeout for its one upstream call.
- During front/nutrition review, conflict, or extraction, no score is published and `canLog` is false.

Resolution is exact:

- confirmed barcode -> use database `IdentifiedFood`;
- confirmed identity + confirmed nutrition -> construct `label_vision` food;
- confirmed identity alone -> no score;
- confirmed nutrition alone -> keep draft and ask for identity;
- barcode/front conflict -> show both; `Use barcode product`, `Reject barcode`, or `Retake`; no silent precedence.

## 12. UI, copy, and accessibility

Use one dynamically imported door-local `FoodPackageScanPanel`; fold the current barcode-miss-only `FoodLabelFallback` into it so two cards never compete.

Resting personal action: “Scan a package.” Live package detection promotes the same action. The flow uses short steps:

1. cloud image disclosure and Continue/Not now;
2. “Show the front”;
3. “I read: {identity}” with Confirm, Edit name, Retake;
4. “Show the barcode or Nutrition Facts”;
5. full Nutrition Facts readback with Use these numbers or Retake;
6. resolved score with existing T2/provenance UI.

Requirements:

- neutral actions, no preselection or countdown;
- every target >= 44 px;
- polite progress live region; errors use alert semantics;
- focus moves to review/error heading and returns predictably after cancel;
- keyboard-only and screen-reader complete path;
- no color-only status;
- English/Spanish keys and placeholders land together;
- clear instructions for glare, crop, distance, dual columns, and file-input fallback;
- 375 px layout remains one continuous screen without nested horizontal scroll.

The shared experience gains only semantic live candidate confirmation and package-abstention copy. It stays store-free and route-blind. The package panel, auth, barcode, and OCR chunks are absent from `/food/demo`.

## 13. File map

New:

- `src/domain/package-scan.ts` / `.test.ts` — wire schemas, raw-row parser, validation, token overlap, conversion.
- `src/domain/food-authority.ts` / `.test.ts` — monotonic epoch controller if it cannot remain hook-local.
- `src/server/food-package-auth.ts` / `.test.ts` — cookie signing, same-origin, bounded JSON, rate/concurrency gates.
- `src/ai/package-scan-prompts.ts` / `.test.ts` — fixed inert-text prompts and strict JSON schemas.
- `src/app/api/food/package/session/route.ts` / `.test.ts`.
- `src/app/api/food/package/route.ts` / `.test.ts`.
- `src/hooks/use-package-scan.ts` / `.test.tsx`.
- `src/components/food-package-scan.tsx` / `.test.tsx`.
- `src/components/food-identity-review.tsx` / `.test.tsx` for shared live/barcode candidate confirmation where composition requires it.
- `scripts/package-label-eval.mjs` and `docs/qa/package-label-eval/manifest.example.json`.

Changed:

- `src/app/api/food/identify/route.ts` and tests — strict package-aware image output and unscored candidate response.
- `src/hooks/use-live-food-score.ts` and tests — candidate state, epoch/abort, package clearing/hold.
- `src/hooks/use-food-camera.ts` and tests — 2048 stream request and detailed/file normalization.
- `src/hooks/use-food-lens-engine.ts` — shared epoch and package suspension.
- `src/app/food/page.tsx` — confirmed-only barcode/label authority and package controller.
- `src/app/food/demo/page.tsx` — live candidate confirmation and semantic package abstention only.
- `src/components/food-lens-experience.tsx` / `food-lens-blocks.tsx` — route-blind candidate/abstention presentation.
- `src/ai/label-extraction.ts` — retire generic `/api/food/vision` label OCR.
- `src/domain/food-compass.ts`, `use-compass-score.ts`, and tests — label identity-heuristic isolation.
- `src/components/food-label-fallback.tsx` — remove or fold into package panel.
- `src/i18n/strings.ts`, deferred `src/i18n/package-strings.ts`, and locale tests.
- `.env.example` — flags, session secret, package model.
- `package.json` — `eval:package-label` command.
- e2e configuration/specs — explicit flag-on and flag-off servers.
- `.gitignore` — private corpus images and generated result artifacts.
- `docs/specs/README.md` and package demo/QA documentation.

Unchanged: `FoodSource`, persisted app/meal-log schemas, and storage guards.

## 14. Verification and evaluation

### 14.1 Deterministic gates

- An image identify result cannot return a score; only confirmed `foodId` can.
- Package output does no FNDDS matching/disambiguation and clears all stale/restorable state.
- A candidate arriving after epoch invalidation writes nothing.
- Client abort propagates to the route; the route makes at most one provider call per explicit attempt.
- Barcode result remains unscored until confirmation and survives turning the package.
- Barcode/front conflict keeps score and log controls absent.
- Front output with low confidence, poor quality, multiple packages, generic-only evidence, overlong fields, or instruction text abstains.
- The strict outbound Responses payload is snapshotted, including `store: false`, original detail, root schema, token cap, and reasoning effort.
- Bounded reader rejects wrong content type and bodies immediately below/above 4,000,000 bytes.
- JPEG verifier rejects wrong MIME/magic, oversize bytes, dimensions, and pixels.
- Raw-row tests cover zero/null, `%DV`, wrong units, duplicate rows, decimals, comma decimals, `<1 g`, FDA rounding, high fiber, sugar alcohol, bilingual labels, per-container, and dual columns.
- Label score is invariant to front name/category edits.
- Flag-off route returns disabled before body/provider work.
- English/Spanish parity, store-free witness, old save hydration, and bundle budgets remain green.

### 14.2 Browser gates

Chromium desktop and mobile, with separate flag-on and flag-off builds:

1. regular camera candidate -> no score -> confirm -> T1;
2. package after an existing score -> stale score clears -> package abstention;
3. front -> identity review/edit -> nutrition -> full readback -> confirm -> T2;
4. barcode hit -> product review -> confirm; front model not called;
5. barcode disappears while turning package -> candidate/session remains;
6. barcode miss/no barcode -> identity and nutrition complete in either order;
7. front/barcode conflict -> no score/log until resolved;
8. late live/barcode/package responses cannot win after epoch change;
9. blur, glare, crop, multiple package, dual column, disabled, locked, unauthorized, rate limit, timeout, retry, camera API absence, and file input;
10. `/food/demo` candidate confirmation and explicit package abstention, with no personal chunks or controls;
11. axe, keyboard, focus, screen-reader names, reduced motion, and 375 px layout.

### 14.3 Route-level real-image gate

`npm run eval:package-label -- --manifest <private manifest> --release` rejects a caller-supplied base URL, builds the current checkout into a unique ignored output directory with a precommitted build ID, and launches only that production artifact on a random loopback port. It injects a fresh invite, signing secret, and per-run attestation; verifies the signed route identity plus the artifact's own build manifest before and after the run; then confirms process-tree shutdown before removing the isolated artifact. This prevents a mock, stale route, or concurrently replaced `.next` directory from satisfying the release gate. It does not duplicate prompts or validators.

The local gitignored manifest contains per case:

- a reviewed opaque corpus ID that is copied into each durable report;
- stable ID, relative path, SHA-256, front/nutrition/live kind;
- expected route mode plus required/forbidden identity tokens and a category-token proxy checked against the candidate product field;
- exact human nutrition values plus readable/null mask;
- serving basis, column target, language, package type, glare/skew/crop/size subgroup, opaque fixed condition IDs, and preregistered `clear` flag;
- expected request count and allowed abstention.

Two distinct people independently transcribe ground truth; disagreements are adjudicated before the run. Before building or making any paid request, the harness verifies every source path and SHA-256, all minimum case counts, and every required clear subgroup cell. Before any live-route spend it also opens a successful signed package session. It enforces a global 10.1-second package-call start interval across signed-session renewals, aborts the whole run if a session issuance/renewal fails, makes no retries, and records the reviewed opaque corpus ID, actual response model and service tier, metadata completeness, exact normalized JPEG dimensions/quality/attempt, concrete Git-plus-dirty-tree hash and Next build ID, request latency (excluding deliberate pacing/session setup), usage tokens, the applied price-card rates, token-price upper-bound cost, and pass/fail. It confirms process-tree shutdown and isolated-artifact removal before publishing a report. The ignored, sanitized aggregate JSON/Markdown contains no images, paths, image-source or manifest hashes, reviewer names, product names, raw OCR, or nutrition values and exits nonzero in release mode.

Minimum release corpus: 60 clear/simulated-hard package fronts, 40 Nutrition Facts panels, and 20 live-routing cases. It covers all major package types, English and Spanish/bilingual labels, no-glare plus glare, no-skew plus skew, no-crop plus partial crop, dual-column traps, similar colorways, multiple-package scenes, and the original Edamame Ranch failure or a human-verified equivalent. Live cases use the exact 768/q0.7 preprocessing. Hook tests cover temporal/video races.

Release thresholds:

- 100% of image/live and barcode paths remain unscored before confirmation (structural test).
- 0 package fronts enter an FNDDS `match` response.
- 100% of accepted front candidates preserve the required human-verified product tokens and the preregistered category-token proxy in the candidate product field; clear-front review coverage >= 85%.
- 100% of every accepted non-null nutrition value matches adjudicated ground truth; clear-panel review coverage >= 80%.
- 0 wrong-column panels reach review.
- Edamame Ranch contains verified edamame/ranch identity tokens or abstains; Doritos is forbidden.
- one explicit front/nutrition attempt equals one upstream request; no hidden retry.
- route-reported model/service-tier/usage metadata and the run attestation are complete; mean and per-case token-price upper-bound cost stay at or below $0.02 and $0.05, and route p95 latency stays at or below 30 seconds.
- report Wilson confidence intervals and subgroup results. Finite results measure quality; they do not support a universal “the model never errs” claim.

Re-run on model alias/config changes and before enablement. A failed gate leaves the package UI/provider flag off; the candidate-confirmation and stale-score safety fixes may still ship.

## 15. Privacy and operational boundary

- At the package action, state that this image is sent to OpenAI when cloud scanning is enabled.
- Send only the current normalized image and scan kind. Do not send prior frames, meal history, conditions, medicines, transcripts, or confirmed nutrition values.
- The app does not store images or raw OCR evidence. Confirmed ingredient OCR may affect the in-memory score, but is stripped from meal logs and both realtime and fallback voice context. Client normalization strips metadata; refs/URLs are cleared.
- `store: false` is set upstream, but provider retention/data-control behavior must be documented separately. Do not promise that the provider or device stores nothing.
- Current disclosure approval is product-owner prototype approval only. No real-patient/production enablement without legal, privacy, clinical, regulatory, and provider/BAA review.
- No background detailed capture or OCR. Rate/concurrency/byte/pixel/output caps fail closed and return visible retry guidance.
- The current request and concurrency counters are process-local prototype controls, not a deployment-wide spend ceiling. Both production flags remain off until a distributed limiter is implemented and reviewed.
- No telemetry sink is added. If one is approved later, omit images, OCR rows, identities, barcodes, and nutrition values.

## 16. Phased build

| Phase | Deliverable | Gate |
|---|---|---|
| P0 | Authority epoch; live image candidates; confirmed-only barcode; package stale-score abstention | route/hook/page tests; existing text path unchanged; public door store-free |
| P1 | Detailed capture; auth/session; strict front/nutrition Responses route; domain parsers | byte/pixel/auth/call-budget/schema tests; no image retention |
| P2 | Orthogonal package reducer; personal panel; conflict/readback; label score isolation; en/es | component/integration tests; no score/log before confirmation |
| P3 | Flag-on/off desktop/mobile journeys, accessibility, and visual inspection | Playwright + axe + bundle isolation |
| P4 | Route-level real-image harness and calibration | every threshold in section 14.3; exact model/config recorded |
| P5 | Full audit | `npm run check`, `npm run crisis:gate`, focused e2e, clean diff and privacy review |

Implementation is approved in this order. Production enablement, deployment, push, and real-patient use are not approved by this spec.
