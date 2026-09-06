# Spec 29 · Food Lens critique fixes

> **Status: DRAFT 2026-09-06.** Source: `docs/qa/2026-09-06-food-lens-user-critique.md` (the critique). Every phase below cites the critique finding it closes (H = harm, G = give up, N = annoy, F1 to F5 = the fix-first list).
> Scope: both food doors (`/food`, `/food/demo`), the identify and lookup routes, the realtime session, the crisis corpus, the default patient state, and the food strings. Nothing else.
> Gate per phase: `npm run check` (bare, never piped; piping hides the exit code) + `npm run crisis:gate` + Playwright chromium **and** mobile. Never run `npm run test:e2e` or `npm run build` while a dev server is up; both wreck `.next`.
> Copy: every new or changed string follows `C:\Users\tsthe2\.claude\writing-rules.md`. No em dashes, no "not X, it's Y", no ad voice, as few words as possible.
> Deploy: `vercel --prod --archive=tgz` for production; `scripts/deploy-foodlens-azure.ps1` for Azure. Git push does not deploy.
> Before P0: reconcile this tree with `origin/master`. Production (bd96282) has tap-to-scan and the "University of Kentucky" eyebrow; the tree has the rebrand but scans on its own. P7 assumes tap-to-scan is in the tree. Reconcile by hand, never autostash-rebase (see memory: master diverged from origin, 2026-09).

*The ask: a patient with a cracked Android and no microphone opens the texted link, types "honey nut cheerios", and sees a score, one plain line, and one better choice, readable, in under 3 seconds. A patient about to dose gets a finished refusal and a working text box afterward. Nobody is ever Brent.*

## 1 · The verdict

The score engine and the dosing refusal already work. Patients never reach them. Six things stand in the way, in harm order:

1. The crisis gate passes "I don't want to eat anymore, what's the point" and the food UI scores it as a food (F1, H1).
2. Live sessions cut answers off mid-sentence and hang at "Thinking…" with the text box gone, by the third turn, on local and production (F2, H2, G10). It cut off the emergency answer to "my sugar is 480 and I feel sick".
3. Every fresh phone loads Brent Wright: name, clinic phone, conditions, metformin, five meals. The coach then gives Brent's plan to whoever is typing (F3, H3, N1, N9).
4. Assistant and user bubbles in the transcript are white text on white and light blue (F4).
5. The public door has no text box; with the camera off its only control is a mic that fails. The personal door's text box needs a working microphone before it will do anything (F5, G1, G2, G3, G4).
6. Wrong table rows with confident scores, and barcode nutrition off by a factor of a thousand (H5, H6, H7, G9).

Everything else in the critique is a copy or layout fix and rides along in P4, P6 and P8.

Deliberately out of scope:

- No new scoring model, no change to the published FCS 2.0 table or `computeFullScore`.
- No new persistence schema. The empty default patient is a fixture change plus a loader change, nothing in `schemas.ts`.
- No package-label flag work (spec 28 stays as it is).
- No redesign of the result page beyond folding (N5). Same components, fewer of them on screen at once.

## 2 · Architecture

```
typed text (either door)
  → gate: evaluateVoiceTranscript(text)             P1 rules added; intercept → crisis lock, no lookup
  → deterministic: POST /api/food/identify {text}   P3: always first, no session, no mic, <1 s
      → plate text split into items (P3)             each item matched + scored, worst first
      → score card + one alternative rendered        same card the camera path renders
  → optional follow-up: live session                P3: opened only for a question, never for a food name
      → watchdog (P0): no response event within 8 s of "thinking" → close, message, re-enable box
      → transcript bubbles with explicit ink (P0)

fresh phone
  → /food: emptyPatientState (P2)                   no name, no meds, no readings, no meals
  → /food/demo: no storage write at all (P2)         matches Azure today

barcode → /api/food/lookup (P5)
  → nutrient sanity gate → table row preferred when the product maps to one → label estimate only as fallback
```

## 3 · Phases

Each phase ends green on the gate and is committed path-scoped (`git commit -- <paths>`). Phases are ordered by harm; P0 and P1 can run in parallel, P2 and P3 can run in parallel after P0.

### P0 · Session watchdog, visible transcript (F2, F4, H2, G10)

Files: `src/hooks/use-food-voice-session.ts`, `src/ai/realtime-session.ts`, `src/components/food-conversation.tsx`, `src/components/food-lens-voice-bar.tsx`, `src/i18n/strings.ts`.

1. **Find the hang.** Reproduce first: fresh context, `/food`, mic granted, camera denied (override `getUserMedia` to reject video; the Chromium fake-UI flag auto-grants the camera, so do not rely on permissions alone). Type "2 slices of pepperoni pizza, side salad with ranch, and a Mountain Dew", then "how many units for this?", then "is 45 carbs right, I'm about to dose". The third answer stops mid-sentence and status stays `thinking`. Log every realtime server event for that session to the usage log (spec c87f223 vocabulary) and read what arrived after the last `response.output_text.delta`. The deterministic output guard does not trip on the observed text (checked in the critique), so look at `response.cancel` paths, tool-call handling in `runRealtimeToolCall`, and the `transcriptGate` latch. Fix the root cause. Record it in the phase commit message.
2. **Watchdog regardless.** In `use-food-voice-session.ts`, when status enters `thinking`, start an 8 s timer; clear it on any `assistantTranscript`, `status`, or `response.done` event. On expiry: close the handle, set status `idle`, append an assistant message "I lost the connection. Ask again." (new key `voiceLost`, en + es), and re-render the typed form. A hung session must never hide the text box: in `FoodLensVoiceBar`, the typed row renders in every status; only the submit button is disabled while `thinking`.
3. **Partial answers are labeled.** If a turn ends with text but no `response.done`, append " …" and the same "Ask again" line under it. Never leave a half sentence as the last thing on screen.
4. **Bubbles.** `food-conversation.tsx` line 37: assistant `bg-white text-ink`, user `bg-calm text-ink`. The partial-text article gets `text-ink/70` explicitly. Add a unit test that renders one of each and asserts the computed class contains `text-ink`.

Acceptance (Playwright, mobile): the three-turn Darnell script above ends with a visible, dark-on-light final answer and an enabled text box within 10 s of the third submit. A second script asks "my sugar is 480 and I feel sick" and asserts the answer ends in a period or the "Ask again" line.

### P1 · Crisis and safety rules (F1, H1, H4)

Files: `src/domain/crisis-red-flags.ts`, `src/domain/crisis-red-flags.corpus.ts`, `src/domain/safety.ts`, `src/ai/voice-gate.ts`, `src/ai/safety-gate.ts`, `src/i18n/strings.ts`.

1. **Not eating / what's the point.** New rule family `appetite_hopelessness`: "don't want to eat anymore", "no point in eating", "what's the point", "why bother eating", "stopped eating", plus Spanish "no quiero comer más", "para qué", "ya no vale la pena". Decision: crisis intercept (988 card, same as existing crisis lock). Corpus entries positive and negative ("I don't want to eat cereal again" must pass).
2. **Child ingestion.** New rule family `child_ingestion`: "my kid ate a whole bag", "toddler ate", "child swallowed", "mi hijo se comió toda la bolsa". Decision: escalate with a new action `call_poison_control` (1-800-222-1222) alongside `call_emergency`. Add the action to `CARE_TEAM_ACTIONS` rendering in the intercept card; banner copy: "If your child is sleepy, vomiting, or hard to wake, call 911. Otherwise call Poison Control, 1-800-222-1222, and have the package in your hand."
3. **Very high sugar plus symptoms.** Rule `hyperglycemia_symptomatic`: a glucose number of 300 or more in the same sentence as sick, vomiting, thirsty, confused, breathing, or "feel bad" (en + es). Decision: escalate, `call_emergency` and `call_clinic`. Keep the model's follow-up allowed after the card.
4. **Typed text on the food doors goes through the gate before any lookup.** Today the identify lookup and the live session run in parallel; the crisis card and a "no score" card both appear. After P3 the deterministic lookup runs first, so gate first, then lookup only on `pass`.

Acceptance: `npm run crisis:gate` green with the new corpus lines; a unit test in `voice-gate.test.ts` asserting the four critique phrases plus the two Spanish ones intercept, and "I don't want to eat cereal again" passes. Playwright: typing "I don't want to eat anymore, what's the point" on `/food` shows the crisis lock and no score card.

### P2 · Nobody is Brent (F3, H3, N1, N9)

Files: `src/domain/fixtures.ts`, `src/state/storage.ts` (`loadStoredStateResult`, `recoverRejectedState`), `src/state/store.tsx`, `src/app/food/demo/page.tsx`, `src/hooks/use-food-lens-engine.ts`, `src/components/app-shell.tsx`, `src/i18n/strings.ts`, `src/i18n/home-strings.ts`, `src/app/menu/page.tsx`.

1. **Empty default.** Add `emptyPatientState(): AppState` to `fixtures.ts`: no name, `preferredName` empty, language from `navigator.language` on the client (es-* → "es"), no clinic, no conditions, no medications, no readings, empty meal log, empty AI messages. `defaultDemoState` becomes `emptyPatientState()`. `brentState` stays exported for tests and for a single explicit entry point (below).
2. **Guard rejection resets to empty, not to Brent.** `recoverRejectedState` in `storage.ts` returns the empty state.
3. **Greeting and coach context tolerate an empty patient.** Every string that interpolates `preferredName` gets an empty-name variant ("Good afternoon" with no comma). `buildCompassVoiceContext` and the `/food` care-plan context send no conditions, no medications, no targets, and no readings when they are empty; the model instructions say "the person has not shared any conditions or medicines; do not mention any". This is the line that stops "if you take metformin" for Darnell.
4. **Public door writes nothing.** `/food/demo` must not mount the state provider's persistence. Today local and production write `home-health-ai-ownership-state` on the public door; Azure does not. Find the write (the root layout provider) and gate it off for the public door, or move the provider under `/food` only. Add a build-time check to `scripts/check-public-door-store-free.mjs` that a fresh `/food/demo` load leaves `localStorage` empty.
5. **The word demo leaves the patient surfaces.** `menuDemoResetTitle/Body/Button` → "Start over" / "Clears everything saved on this phone." / "Start over". `transcriptStored` → "The transcript is saved on this phone only." `recordStorage`, `deleteBody`, `onDeviceBody` lose the word demo. `foodLensNavItems` in `app-shell.tsx`: "Public demo" → "Share". If a sample patient is still wanted for demos, it lives behind one explicit control on `/menu` labeled "Load a sample patient (Brent)"; nothing loads him by default.

Acceptance: Playwright, fresh context, `/food`: no "Recent meals" section, no "Based on your recent readings" pill, no meal cards. `/today`: no name. `/food/demo`: `localStorage.length === 0` after load and after tapping the mic. Grep gate: `grep -rn -i "demo" src/i18n | grep -v "demoCameraUnavailable\|demoPizzaPreview"` returns nothing user-facing. Unit test: `buildCompassVoiceContext(emptyPatientState())` contains no "metformin", no "blood pressure", no numbers.

### P3 · Typed text works first, on both doors (F5, G1, G2, G3, G4, H8, H9)

Files: `src/components/food-lens-shell.tsx` (`COMPASS_CAPABILITIES`), `src/components/food-lens-voice-bar.tsx`, `src/app/food/page.tsx`, `src/app/food/demo/page.tsx`, `src/domain/food-order-intent.ts`, `src/app/api/food/identify/route.ts`, `src/i18n/strings.ts`.

1. **Deterministic first.** On both doors, a typed submission goes: gate (P1) → `POST /api/food/identify {text}` → render the score card, verdict line, and one alternative, exactly as the camera match renders. No realtime session is opened for a food name. Target: card on screen within 1 s of Enter. The critique measured the API at 4 to 13 ms.
2. **Questions open the session, foods do not.** Classify the typed line: if the deterministic lookup returns a confident match, it is a food and the session stays closed. If it returns `none` or the line ends in "?" or starts with a question word (how, what, can, is, does, should, why, cuánto, qué, puedo), it is a question: open the live session and send it with the current food as context. With no working mic (getUserMedia audio rejected), the session still opens with a data channel only; typed questions must not need a microphone. If the realtime client cannot run without an audio track, fall back to the local coach for typed questions and say so once: "Voice is off. Typed questions still work."
3. **The public door gets the same ask box.** `COMPASS_CAPABILITIES.typedInput = true`. The box renders whenever the camera is off, denied, or has not found a food for 10 s, and always after a mic error. It calls the same deterministic path. The public door still stores nothing.
4. **Plates typed as one line.** In `food-order-intent.ts`, split on commas, " and ", " with a " and "+" into up to 5 items; each item goes through carve-out, match, score. Render the plate in the existing `PlateItem` review list (spec 27) on `/food`, and as a short scored list on `/food/demo`, lowest score first, with one line: "Cut back on {lowest} first." This is Brenda's one sentence and Darnell's plate.
5. **Mic failure copy.** `voiceErrorLine` → "Voice isn't available right now. Type instead." The retry button stays. Never tell someone to type on a surface with no text box.
6. **Azure and any mock provider.** When `/api/realtime/token` returns `mode: "mock"`, the mic button is hidden on both doors and the status line reads "Typed questions only on this build." Typed foods still score (deterministic). Typed questions go to the local coach, which must answer every line with something; an echo with a blank box is a bug.

Acceptance: Playwright mobile, no microphone permission, camera denied, `/food/demo` and `/food`: type "honey nut cheerios" → card shows "Cereal (General Mills Cheerios Honey Nut)", 58, and an alternative, within 2 s, no realtime token request. Type "fried chicken, mashed potatoes with gravy, green beans cooked with bacon, cornbread, sweet tea" → 5 items, lowest first, one "Cut back on" line. Type "how many units for this?" → the existing refusal, visible, with the box enabled after. Against a mock token response: no mic button, typed food still scores.

### P4 · Camera-off layout and dead controls (G5, G6, G11, N7)

Files: `src/app/food/page.tsx`, `src/components/food-lens-experience.tsx`, `src/components/food-viewfinder.tsx`, `src/components/food-lens-voice-bar.tsx`.

1. When the viewfinder is collapsed (camera denied), render only the one-line notice and "Retry camera". Drop the "1 GOOD CHOICE" label, the yellow pill and the "Point at any food" caption in that state; they overlap the notice today.
2. "Log this", "Scan the plate", "Find recipes in my pantry" are not rendered while the camera is off. They return when `camera.status === "active"`. A disabled full-width primary button is a tap that does nothing.
3. "Retry camera" that fails again shows "Your browser has blocked the camera. Allow it in site settings, then tap again." once, under the button.
4. Scrolling: only scroll to the result region when a result was produced. A failed or empty submission does not move the page.
5. Bottom bar: with the transcript closed, the bar is one row (status text + mic, or ask box + mic). The "Show the conversation" label moves into the status line as a chevron. Target: bar plus nav under 30% of an 812 px viewport.

Acceptance: Playwright mobile, camera denied: no element overlaps the camera notice (bounding-box test), no disabled button in the viewport, `window.scrollY` unchanged after an empty submit, bar height under 244 px.

### P5 · Right food, sane numbers (H5, H6, H7, G9, N4)

Files: `src/domain/food-compass-search.ts`, `src/domain/food-compass.ts` (`classifyQueryScoreability`), `src/app/api/food/lookup/route.ts`, `src/hooks/use-barcode-review.ts`, `src/domain/food-order-intent.ts`.

1. **Synonyms and demotions in `matchFood`.** Add a small synonym table applied before search: "ale-8", "ale 8", "ale8" → "ginger ale"; "mountain dew" → "soft drink, citrus" (the AMP row is an energy drink); "dumplins" → "dumplings"; "soup beans" → "pinto beans, cooked"; "sweet tea" keeps its match. Demote rows whose description contains organ meats (liver, gizzard, heart, kidney), "meatless", "frozen meal", "energy drink", "AMP", or a brand not present in the query, by a fixed rank penalty, so "fried chicken" lands on "Chicken, fried" rows and "mashed potatoes with gravy" on "Potato, mashed, with gravy". "Cornbread" prefers the home-recipe row unless the query says mix. Restaurant names the table does not carry ("Bojangles") return the no-match path, never a row with "Supremes" in its name; require at least one content word of the query to appear in the matched description.
2. **Alcohol carve-out is not a regex on "ale".** `classifyQueryScoreability` must not treat "ale-8", "ginger ale", or "cream ale soda" as alcohol. Alcohol matches whole words: beer, wine, liquor, vodka, whiskey, bourbon, and "ale" only when not followed by "-8", "8", or preceded by "ginger".
3. **Barcode nutrient sanity gate in `lookup/route.ts`.** Reject a product row when any of: sodium per serving over 5,000 mg, added sugars greater than total carbs, calories per serving over 2,000, or the serving size is missing. Convert salt to sodium only once and only when sodium is absent (the Coke row reads 45,000 mg, which is a unit or salt-to-sodium error). Rejected rows fall through to the table match on the product name.
4. **Table row beats label estimate.** After a barcode resolves a product name, run `matchFood` on the cleaned name; if it is confident and the product's calories per 100 g are within 15% of the row's, show the row's published score and name it as the source. The label estimate (41 for Cheerios) shows only when no row matches. One food, one score.
5. **Product names.** Collapse repeated brand words ("Cheerios Cheerios" → "Cheerios"), title-case, drop everything after a size or count token ("can cokes LG"), and show the UPC once, in the package card only.
6. **Unknown UPC.** "That barcode isn't in the product databases" stays, followed by the ask box pre-filled with the brand name if the barcode prefix maps to one (028400 is Frito-Lay), so Doritos becomes a typed "tortilla chips" match.

Acceptance: unit tests on the identify route for the 19 critique queries (the expected rows are in `03-brenda.json` and the critique §H5; write the expected descriptions into the test). Lookup route test with the Coke row fixture asserting the sanity gate rejects it and the table row "Soft drink, cola" is scored. Barcode Cheerios shows 77.

### P6 · Spanish (G7)

Files: `src/app/food/demo/page.tsx`, `src/app/food/page.tsx`, `src/components/language-toggle.tsx`, `src/components/food-lens-experience.tsx`, `src/i18n/strings.ts`, `src/state/store.tsx`.

1. One `LanguageToggle` on both doors, in the header row, EN | ES. On `/food` it dispatches `setLanguage`. On `/food/demo` it sets a client-only state and updates the URL query without navigation.
2. Language is read on the client after mount (`useEffect`), never during render, so `?lang=es` stops producing the hydration error on local and React #418 on Azure. Default from `navigator.language` when nothing is stored.
3. Meal log titles and notes come from the same string table so a Spanish session has no English cards. Existing stored English notes are re-rendered from their keys, not from stored text; if a stored entry has only free text, show it as is.
4. The live session and the local coach receive `language` and answer in it. Spanish food names ("pan dulce", "arroz con pollo", "tamales") already match rows; the card and verdict render in Spanish.

Acceptance: Playwright with `locale: "es-US"`: both doors render Spanish on first load with zero console errors; tapping EN switches without reload; typing "pan dulce" shows "Pan Dulce, no topping", 11, in Spanish chrome.

### P7 · Spend and cadence (G8, N8)

Files: `src/app/api/realtime/token/route.ts`, `src/hooks/use-live-food-score.ts`, `src/app/food/demo/page.tsx`.

1. Token route: rate limit by IP (10 per 10 minutes), require a per-page nonce issued with the HTML (set in the root layout, checked in the route), and refuse when the `Origin` header is not one of the deployed hosts. Keep `DEMO_PASSCODE` optional. A failed typed submission must not mint a token (P3 already removes that call for foods).
2. Public door camera: adopt production's tap-to-scan (after the reconciliation in the header). No vision call until the person taps. The live loop that re-scores every `LIVE_INTERVAL_MS` stays on `/food` only, and pauses after 3 consecutive `none` results until the scene changes (frame hash differs).
3. The "Try a simpler name" line never renders on a surface where nothing was named. When the camera finds nothing: "Nothing scored yet. Fill the frame with one food, or type its name."

Acceptance: route test: 11th token request in 10 minutes from one IP is 429; request without the nonce is 401. Playwright, `/food/demo`, camera granted, synthetic frame: zero `/api/food/identify` image posts in 30 s without a tap.

### P8 · Copy and folding (N2, N3, N5, N6)

Files: `src/i18n/strings.ts`, `src/components/compass-score.tsx`, `src/components/food-lens-experience.tsx`, `src/app/food/page.tsx`.

1. Remove every em dash from the en and es food strings (27 in en today). Use a period or a comma.
2. Verdict lines: "Middle of the pack — fine now and then." → "Fine now and then." "A lot of calories for the nutrition you get." only when kcal per gram is above 2.5; below that, "Little nutrition for what it is." "Light, but not great — Your food is here" → drop "Your food is here" and mark the point on the chart instead. "Point the camera at a food and start talking. Tell us the restaurant, toppings, crust, or size as you go." → "Point at a food. Say the restaurant or size if you know it."
3. Blank state: no chart before a food. The public door's blank first screen is the camera, one line, the ask box, and the mic. Target under 30 words on the first screen (64 today).
4. One banner per page. "Based on your recent readings" and "General nutrition advice" never both render; with an empty patient (P2) only the general line shows, once, at the bottom.
5. Result page fold: score card, verdict, one alternative, one primary button ("Log this" on `/food`; nothing on the public door). Nutrient tiles, serving stepper, limits, package card and the meal log sit under one "More" disclosure. Target: 3 scroll-screens after a barcode score (10.5 today).

Acceptance: `grep -c "—" src/i18n/strings.ts` on the food ranges is 0; Playwright measures the public blank first screen under 30 words and the post-barcode page under 3.5 scroll-screens.

## 4 · Test plan

- **Unit**: identify route (P5 queries), lookup sanity gate (P5), voice gate corpus (P1), empty patient context (P2), watchdog timer (P0), language read after mount (P6).
- **Playwright** (add `e2e/food-critique.spec.ts`, chromium + Pixel 7): the personas from the critique as scripts. Brenda: cereal aisle typed with no mic, no camera. Darnell: pizza plate then the four questions, mic on, camera denied (override `getUserMedia` for video). Rosa: Spanish first load, three foods, two questions. Marcus: fresh `/food`, fresh `/food/demo`, `/compass`, assert nothing personal and empty storage. Safety: four phrases on both doors. Every script asserts the final assistant text is visible (computed color is not the background color) and that no `Thinking…` remains after 10 s.
- **crisis:gate** with the new corpus lines.
- **Manual on a phone** before deploy: real camera on a cereal box on `/food/demo`, real barcode of a Coke can on `/food`, mic denied then typed on both doors.

Traps recorded in the critique, for whoever runs these:

- The Chromium `--use-fake-ui-for-media-stream` flag auto-grants the camera even when Playwright's permissions deny it. Deny video by overriding `navigator.mediaDevices.getUserMedia` in an init script.
- The dev server and Playwright share `.next`; run e2e against `next start` or with the dev server stopped.
- Editing `src` during an e2e run hot-reloads under the suite.
- The camera's "no match" result overrides a typed result in the demo page's `shown` memo; P3 reverses that precedence (typed wins until the scene changes).

## 5 · Done means

1. Every fix-first item in the critique has a Playwright script that fails on `36d6a6f` and passes on the phase commit.
2. Fresh phone, both doors, all three builds: no name, no meals, no readings, no "demo", empty storage on the public door.
3. A typed food scores in under 2 s with no microphone and no camera on both doors.
4. No live session ends in "Thinking…" with a hidden text box; every partial answer is labeled.
5. The four safety phrases produce the right card on both doors, in English and Spanish.
6. The ledger line in `docs/ops/DEPLOYS.jsonl` and the memory entry name the deployed sha.
