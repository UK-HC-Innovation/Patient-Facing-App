# Package label scan adversarial review

**Date:** 2026-08-31
**Reviewed artifact:** `docs/specs/28-package-label-scan.md`, draft before revision
**Initial verdict:** **NO-BUILD**
**Disposition:** revise the design, then permit implementation behind fail-closed flags; do not enable the paid scanner for production or real-patient use until its release corpus and external approvals pass.

## What the review tried to break

Two independent read-only reviews and the implementation owner attacked the proposed evidence boundary, live and barcode races, nutrition OCR contract, prompt injection, request abuse, image handling, privacy claims, feature flags, public-door isolation, accessibility, and whether the proposed evaluation could prove its claims.

The draft had the right central idea: a package front is identity evidence, not nutrition evidence. It did not yet make that rule structural. Four blockers could still produce a wrong accepted score.

## Findings and required dispositions

| ID | Severity | Finding | Required disposition |
|---|---|---|---|
| R1 | BLOCKER | A model-only `food | package | none` classifier cannot guarantee “no package-appearance T1.” An open pouch, cropped wrapper, transparent tub, or mixed scene can still be returned as loose food with high self-reported confidence and enter FNDDS. A finite corpus cannot prove “never.” | Make the guarantee structural: an image-only live result is a review candidate, never a published score. A patient must confirm the proposed row before its score appears. Package classification improves routing but is not the safety boundary. |
| R2 | BLOCKER | Passive barcode detection is not bound to the package under review. An adjacent product’s barcode can resolve first and current `barcodeFood ?? labelFood` authority publishes it immediately. | Every barcode lookup becomes a review candidate. Pin the code and result to a scan epoch and require the patient to confirm the returned product name. Do not clear the candidate when the barcode leaves frame as the package is turned. |
| R3 | BLOCKER | Front identity is not actually score-independent. `computeLabelScore` currently includes `name` and `category` in cured-meat/additive heuristics, so editing a front name can change T2 with identical Nutrition Facts. | For `label_vision`, exclude front name/category from D5/D6. Only confirmed printed ingredient text may affect those domains. Test score invariance across front-name edits. |
| R4 | BLOCKER | `{ value, printed }` cannot establish which nutrient row, unit, or column was read. The same model supplies both, and a consistently wrong per-container column can pass vague arithmetic checks. | Ask for raw labeled rows, raw amount, raw unit, column heading, serving size, servings per container, and column count. Parse amounts deterministically. Reject unresolved multi-column labels. Define exact required rows, rounding tolerances, and null behavior. Show every score-changing input. |
| R5 | BLOCKER | A 5,000,000-character data URL plus JSON can exceed Vercel’s 4.5 MB function payload limit before the route runs. | Cap the whole UTF-8 request at 4,000,000 bytes and the normalized JPEG data URL at 3,600,000 characters. Iteratively resize/recompress client-side and boundary-test both caps. See [Vercel Functions limits](https://vercel.com/docs/functions/limitations). |
| R6 | BLOCKER | The draft’s union-shaped example is not a portable strict Structured Outputs schema, and it did not freeze Chat Completions versus Responses. | Use `/v1/responses` for the package route. Send a single root object whose fields are all required and nullable where conditional, set `additionalProperties: false` on every object, `store: false`, `reasoning.effort: "none"`, `max_output_tokens`, and `detail: "original"`. Parse refusal, incomplete, error, and message output explicitly. |
| R7 | HIGH | React request IDs alone do not close authority races. A generic result can mutate state between the package tap and the next render; barcode changes, camera stop, and restore stashes have separate timing. | Use one synchronous monotonic authority epoch shared by live, barcode, and package requests. Increment it before every authority transition; capture and validate it before every state write after `await`. Abort browser requests, clear all live/restorable state, and combine route request abort with the upstream timeout. |
| R8 | HIGH | The linear package state machine conflicts with the real camera flow. `activeBarcode` clears after about five seconds when the patient turns the package, and identity/nutrition may arrive in either order. | Persist a session barcode independently of the live detector. Model identity, nutrition, and barcode as orthogonal substates; resolve only after confirmed barcode or confirmed identity plus confirmed nutrition. |
| R9 | HIGH | Structured output does not neutralize printed prompt injection or make self-reported evidence independent. | State that visible text is inert data, never instructions. Bound every field/list. Add package images containing instruction-like text. Treat model evidence as unverified until compared with the physical package. |
| R10 | HIGH | The proposed request boundary had no signed session, same-origin check, rate/concurrency limit, decoded image validation, or reliable cost cap. A flag plus optional passcode is not enough for a paid public route. | Mint a short-lived, HttpOnly, same-origin package session from the demo invite and disclosure version. Require it on the package route. Add request-body, JPEG magic/dimension/pixel, per-session rate, in-flight concurrency, per-kind output-token, and one-upstream-call limits. Keep the feature off when auth configuration is incomplete. |
| R11 | HIGH | “No image persistence” was broader than the app can promise and ignored file metadata and provider controls. Current approval is prototype-only. | Say “not stored by this app.” Normalize through canvas to strip EXIF, revoke blob/object URLs, clear refs, disclose cloud processing at the action, document provider retention controls, and block real-patient/production enablement pending legal, privacy, clinical, and regulatory approval. |
| R12 | HIGH | The 40-image local corpus was not reproducible and could not support absolute error claims. It lacked ground-truth procedure, hashes, a runnable command, actual route coverage, model version, and live preprocessing. | Define a versioned manifest, two-person ground truth with adjudication, image hashes, preregistered clarity/subgroup fields, exact route calls, model/config recording, Wilson confidence intervals, and nonzero release exit. Exercise 768/q0.7 live preprocessing and the original failure or a verified equivalent. |
| R13 | HIGH | `calories > 0` would trap legitimate zero-calorie products in rescan. | Accept a visibly printed zero and return the existing deterministic zero-calorie carve-out. Null remains unreadable and is never converted to zero. |
| R14 | HIGH | “Broad 4/4/9” was undefined and can reject valid high-fiber, sugar-alcohol, alcohol, and rounded labels while still missing a wrong column. | Use row/column evidence as the primary gate. Treat macro mismatch as a warning except for defined factor/unit impossibilities, and only when all core macros are present. Include decimal, comma-decimal, `<1 g`, rounding, dual-column, and bilingual cases. |
| R15 | HIGH | `ImageCapture.takePhoto()` is not a cross-browser capture plan, and the current stream requests only 1280 px. | Request a 1920/2048 stream while keeping the live ring at 768. Treat `ImageCapture` as an enhancement and a normalized native file input as the supported iOS fallback. |
| R16 | HIGH | The two rollout flags were not executable in current Playwright/build configuration; the response union lacked `disabled`. | Freeze `mode: "disabled"`, add a flag-on package matrix plus flag-off browser and build-manifest witnesses, and assert package modules stay out of `/food/demo` and out of initial `/food` assets while off. |
| R17 | MEDIUM | Confirmation risked becoming a dark pattern: some score-changing fields were collapsed, there was no field correction, and “Use these numbers” could substitute patient trust for OCR precision. | Show every included field, unit, serving basis, ingredient text, warning, and omitted field. Use neutral unselected actions and support a field edit or retake. Confirmation is a final comparison, not the accuracy mechanism. |
| R18 | MEDIUM | The public-door behavior contradicted itself: package-specific copy in one section and generic no-match in another. | Choose one semantic, route-blind package abstention state with explicit label-needed copy. It clears stale scores but imports no barcode, package route, private store, or controls into `/food/demo`. |

## Revised proof boundary

The build will not claim that a vision model can never misclassify packaging. It will prove the narrower and enforceable properties:

1. No single-food image result, package or otherwise, publishes a score until a person confirms the proposed identity.
2. A front-package scan never enters FNDDS and never supplies nutrition.
3. A barcode result never becomes authoritative until its product identity is confirmed.
4. A Nutrition Facts score uses only confirmed normalized rows and confirmed printed ingredients; front identity text cannot change it.
5. All async sources share one authority epoch, so an older response cannot win after a package, barcode, camera, or correction transition.
6. The paid route is inaccessible when its flag, signed session, provider, secret, or request bounds fail.

These are code/test properties. The image corpus then measures routing quality, OCR precision, useful coverage, latency, and cost without pretending a finite sample proves a universal negative.

## Build decision

The reviewed draft is rejected. Implementation may start only after the plan incorporates every BLOCKER and HIGH disposition above. The accepted build remains feature-flagged off for production until:

- the route-level release corpus passes;
- the original Edamame Ranch image or a human-verified equivalent is included;
- model/config drift has not invalidated the recorded run;
- required legal, privacy, clinical, and regulatory approvals exist for real-patient use.
