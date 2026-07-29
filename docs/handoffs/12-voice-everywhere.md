# Handoff: Voice Everywhere — P0–P7

> **Closeout — do not re-execute.** Voice P0–P7 landed in `1b17ef0` on
> 2026-07-20 and shipped in production `4cbe8c7` on 2026-07-21. The software
> scope is complete. Real-device mic, WebRTC, echo-cancellation, and TTS checks
> remain pending owner validation; clinical/legal review and a BAA-backed
> production voice posture remain external release gates. The repository and
> branch metadata below describe the historical execution environment.

**Repo:** `C:\Patient centered\.claude\worktrees\sleepy-bhaskara-23f161`
**Branch:** `claude/sleepy-bhaskara-23f161` (worktree of `C:\Patient centered`, main branch `master`)
**Stack:** Next.js App Router, TypeScript strict, Tailwind, Zod, Vitest + Testing Library (jsdom), localStorage-persisted `useReducer` store.
**Verify with:** `npm run check` (= `next lint && vitest run && next build`) and `npm run crisis:gate`.
**Companion doc:** `docs/specs/12-voice-first-infrastructure.md` (the architecture brief this implements — read it first for the why).

Execute P0…P7 in order, committing after each phase. Do not stop between phases for approval. No git worktrees; work directly in the path above. Conventional commits. Do not push.

Vitest note: on this machine vitest occasionally dies with a transient tinypool `Worker exited unexpectedly` crash that is not a test failure — retry once before diagnosing.

---

## Goal

Make voice a first-class modality across the app using three keyless tiers now and the existing WebRTC realtime engine for open conversation:

- **T1 Dictate** — Web Speech STT (one unified hardened hook). $0, keyless.
- **T2 Voice-turn** — T1 + `speechSynthesis` TTS speaking **pre-gated text only**. $0, keyless. Powers interviews, guided capture, read-aloud, talk-to-draft.
- **T3 Live** — the existing OpenAI Realtime WebRTC session, passcode-gated, for open conversation (/food today, /chat in P6), hardened with output-transcript gating. The code default is `gpt-realtime-2`; a cheaper verified model is an environment opt-in through `HEALTH_AI_REALTIME_MODEL`.

A cloud cascade tier (streaming STT + streaming TTS vendors) is deliberately **not** built now; the P0 hook signatures are the seam it will later slot behind.

## The law (repeat of the brief; every phase obeys it)

1. **Text-in-the-loop, both directions.** No assistant audio is synthesized from text that hasn't passed the deterministic gates; no utterance reaches a model before its transcript passes the gate. `speak()` is only ever called with: deterministic i18n strings, gate-approved model output, human-authored safety copy, or the user's own captured input read back verbatim.
2. **Voice fills, screen commits.** No voice path dispatches a store write without a visual confirm tap — clinical numbers especially. Verbal confirm exists only for reversible non-clinical actions via local deterministic grammar (never an LLM interpreting assent). Stated deliberately: dispatches into the app's canonical *staging* areas (`addContextItem` → `needs_review` facts) count as staging, not commit — `confirmFact` is the commit tap.
3. **Crisis flows are tap-operable and voice can never dismiss them.**
4. **PHQ-9/SDOH voice answers are matched locally against option labels; assessment audio/transcripts never reach any network route.**
5. **Every voice path has a tap/type twin and a visible transcript** (WCAG 2.5.6).
6. **en/es parity is compile-enforced** via `Record<Language, Record<Key, string>>` tables.

---

## Verified facts you can trust (re-verify only if something looks off)

### Existing voice kernel
- `src/ai/realtime-session.ts`: `ConnectArgs` (lines 114–122): `{ clientSecret, model, instructions, language, getContext: () => LiveSessionContext, onEvent, gateTranscript: (t) => VoiceGateDecision }`; `connectRealtimeSession(args): Promise<LiveSessionHandle>` (127). `REALTIME_SESSION_CONFIG` pins `create_response:false` + `interrupt_response:true` (16–24). Gate: `applyTranscriptGate` (33–52) — pass ⇒ `response.create`; intercept ⇒ `response.cancel` + `output_audio_buffer.clear` + `safetyIntercept` event. 4s fail-closed watchdog (28, 223–233). Food-specific pieces: `lastInjectedFoodId` (130) + the `injectContext` closure (188–205); `LiveSessionContext` itself is food-typed (`src/ai/types.ts:48–52`).
- `src/ai/voice-gate.ts`: `evaluateVoiceTranscript` (21–69) — pure sync regex gate (crisis/emergency/blocked tiers).
- `src/app/api/realtime/token/route.ts`: gate ladder crisisOpen-409 → provider → key → passcode (32–53); model default `"gpt-realtime-2"` (line 5); voice `"marin"` fixed at mint (67).
- `src/ai/local-coach-session.ts`: private `speak` closure (19–30, `es-ES`/`en-US`); `mode: "food"` hardcoded at 44; `speechSynthesis.cancel()` on close (84–90). **Only speechSynthesis usage in src/ — there is no shared TTS utility.**
- `src/hooks/use-food-voice-session.ts`: generic parts — event fan-out (81–125), gate via `evaluateVoiceTranscript` (127–130), 180s idle timer (23, 73–79), crisis refusal (138–141). **Tab-hide teardown lives in the consumer page, not the hook:** `src/app/food/page.tsx:167–179` (visibilitychange + pagehide listeners calling `voice.stop()`). Food parts — `buildFoodLensInstructions` (168), `OpenAiVisionProvider` fallback (186–189).
- Two divergent Web Speech shims: `home-composer.tsx:16–36` (naive) and `family-interview.tsx:21–62` (hardened: generation counter, replay dedupe, final-only).

### Store / state / i18n
- `PatientProfile` (`src/domain/types.ts:13–22`): has `language: "en" | "es"` and `accessibilityPreferences?: AccessibilityPreference[]`; the `AccessibilityPreference` union (types.ts:6–11) **already includes `"read_aloud"`**.
- `HealthAction` union: `src/state/store.tsx:49–86` (32 members; **no `setLanguage` on this branch**). `addAuditEvent` exists — see `shareResource` in `family-experience.tsx:284–289` for the exact payload shape (`{ type: "addAuditEvent", event: recordAuditEvent(...) }`).
- Audit action union: `src/domain/types.ts:162–176`, 14 values incl. `"deleted"`. `recordAuditEvent(patientId, action, label): AuditEvent` (`src/domain/audit.ts:3–7`).
- **No action removes a context item** — P5's undo adds one.
- Intake pipeline: `addContextItem` payload `{ item: CareContextItem; facts: ExtractedFact[] }` (store.tsx:53, reducer 127–134); `careContextInputSchema` `{title 2–80, rawText 10–5000, sourceLabel 2–80}` (schemas.ts:40–44); `extractInstructionFacts(item): ExtractedFact[]` (`src/domain/instructions.ts:3`) — deterministic, no LLM, facts `status:"needs_review"`; `confirmFact` `{factId}` (store.tsx:54, 135–143). `/plan` reads only `state.extractedFacts` filtered by status (`plan/page.tsx:12–13`).
- i18n: `Language` from `src/i18n/strings.ts:1`; helper pattern `(language, key, vars?) => string` with en fallback + `{var}` interpolation — `tSafety` (strings.ts:257), `tScreening` (strings.ts:732), `tFamily` (family-strings.ts:630), `tHome` (home-strings.ts:253).
- Persistence: `STORAGE_KEY = "home-health-ai-ownership-state"` (storage.ts:41); whole-state save on every change (store.tsx:602–613). Outside-store flag precedent: `ONBOARDING_COMPLETED_KEY` + `isOnboardingComplete()`/`markOnboardingComplete()` (storage.ts:1150–1158).
- **Language toggle:** commit `ab7896bb1be8d88f029d37bf262a7ca81b268837` on branch `claude/fervent-joliot-ffd33f` adds `setLanguage` action + `LanguageToggle` component + `isLanguage` export + privacy-panel/today wiring. Its merge-base with HEAD is its own parent and none of its 9 touched paths changed on this branch ⇒ **`git cherry-pick ab7896bb…` applies cleanly.**

### Surfaces
- Front door: `home-composer.tsx` `route()` (50–74): `decideFrontDoor` → navigate ⇒ `router.push(decision.href)` (57); safety ⇒ `/chat?ask=` (63, never the LLM router); else `classifyRouteRemote(trimmed, CLASSIFIER_HREFS)` (68) accepted only when `kind==="navigate" && CLASSIFIER_HREFS.includes(href) && confidence >= 0.75` (69); fallback `/chat?ask=` (73). Mic: `toggleVoice` (81–110), `lang` es-US/en-US (91), transcript auto-routes (94–98).
- `FrontDoorRoute` (`front-door.ts:7–9`): `{kind:"coach"; ask; reason:"safety"|"no_match"} | {kind:"navigate"; href; label}` — **navigate carries a `label`** (speak it). `decideFrontDoor` **never constructs clarify**; `RouteDecision` clarify (`route-classifier.ts:8–11`) carries `candidates: string[]` and today both consumers treat it as fall-through. **Do not modify `decideFrontDoor`** — `front-door.test.ts` is part of crisis:gate.
- Chat: `conversation-panel.tsx` — messages render as `<article>` (134–154), content `<p>{message.content}</p>` at 143; `crisisLock` (64–67) disables composer until `onAcknowledgeCrisis` (157–170). Within /chat's own submit flow, assistant messages are appended in `chat/page.tsx` `handleSubmit` (82–99) — but assistant-role messages ALSO enter the shared `state.aiMessages` from `checkin/page.tsx:52` (item-9 crisis) and `food/page.tsx:95,113`, and all render in ConversationPanel. Anything reacting to "new assistant message" must watch `state.aiMessages`, not the submit call site.
- PHQ-9: `phq9-check-in.tsx` — consent gate (53–72); labels from `PHQ9_ITEMS` / `PHQ9_RESPONSE_OPTIONS` in `@/domain/assessment` (bilingual inline `en`/`es` fields, values 0–3); react-hook-form, fields `item0..item8`. `checkin/page.tsx` — `phq9Item9IsPositive` (line 22, imported from `@/domain/assessment`); crisis dispatch (41–53) builds a `safety:"crisis"` AiMessage with `tSafety(language, "crisisResponse")` + `CRISIS_ACTIONS`.
- BP/glucose: **uncontrolled FormData forms** — `bp-log-form.tsx` (`BpLogFormValues` 8–14, `bpReadingInputSchema.safeParse` 21–27), `glucose-log-form.tsx` (same pattern). Schemas (`schemas.ts:3–27`): BP systolic 70–260 / diastolic 40–160 / pulse 30–220 nullable / `superRefine` systolic>diastolic; glucose 20–600; both require ≥1 of the 7-value context enum; note ≤280.
- Family thread: `family-follow-up-turn.tsx` — props (10–17) incl. `onAnswer(text, via: "chip"|"typed")`; chips call `onAnswer(option, "chip")` (72); `FAMILY_FOLLOW_UP_ANSWER_MAX = 500` (8). `family-orientation-interview.tsx` — `answerFollowUp` (140–227); per-answer safety gate (148–157); **`via` is dropped at line 273** and `source` hard-coded `"typed"` at 203; completion message (283–287). The question heading `id="family-follow-up-question"` and its round>1 focus effect live in `family-follow-up-turn.tsx` (heading 57–63, focus 34–40) — not in the orchestrator.
- Read-aloud targets: `/plan` sections (`plan/page.tsx`), Health Brief lines (`health-brief-card.tsx:115–118`; `HealthBrief.sections: Array<{title; items: string[]; status}>` types.ts:148–157), `/learn/retinopathy` answers (`retinopathy-learn.tsx`, `answerEducationQuestion` returns `{kind:"answer"; text; source} | {kind:"fallback"; text}`).
- Menu labels for spoken nav: `menu-grid.tsx` `MENU_GROUPS` (16–51) + `tHome` label keys (home-strings.ts:133–159 en, 215–241 es).

---

## P0 — Voice kernel

### P0.1 Cherry-pick the language toggle
`git cherry-pick ab7896bb1be8d88f029d37bf262a7ca81b268837` (clean per verification). Run `npm run test` after; this brings `setLanguage`, `LanguageToggle` (compact on /today, full in privacy panel), and the `isLanguage` export. Without it es voice is undemoable.

### P0.2 New `src/voice/` module
- **`use-dictation.ts`** — the unified hardened Web Speech hook, extracted from the family-interview pattern (generation counter, per-result replay dedupe, final-results-only, `es-US`/`en-US` from a `language` param, feature detection, stop-on-unmount, try/catch start). API:
  ```ts
  export function useDictation(options: {
    language: Language;
    onFinalTranscript: (text: string) => void;
    onError?: () => void;
  }): { supported: boolean; listening: boolean; start: () => void; stop: () => void }
  ```
  Consumers: P1 follow-up turns, P2 home composer, P4 capture, P5 draft. Note: `onFinalTranscript` is fixed at hook init — components that need mode-dependent handling (P2's route-vs-cancel) consult a component-level mode ref inside their callback. **Do NOT migrate `family-interview.tsx` to this hook** — its internal shim is locked by a large (~450-line) test file; accepted duplication, noted here deliberately.
- **`tts.ts`** — shared speechSynthesis utility (the only TTS in the app today is a private closure in local-coach-session.ts:19–30; do not touch that file):
  ```ts
  export function speak(text: string, options: { language: Language; rate?: number }): Promise<void>  // resolves on end/cancel; no-ops (resolved) when speechSynthesis is unavailable
  export function stopSpeaking(): void
  export function isSpeaking(): boolean
  export function subscribeSpeaking(cb: (speaking: boolean) => void): () => void  // for the indicator
  ```
  `utterance.lang`: `es` → prefer a `getVoices()` voice whose lang starts with `es-US`, else `es-ES` literal (matching local-coach-session); `en` → `en-US`. Chrome caveat: `getVoices()` returns `[]` until the async `voiceschanged` event — resolve the voice at each `speak()` call and add a one-time `voiceschanged` warm-up listener; tests cover both the empty-list fallback and the populated-list preference. Default rate 1.0; crisis copy is spoken at 0.9.
- **`voice-consent.ts` + `voice-consent-sheet.tsx`** — first-use consent, localStorage flag following the onboarding pattern (storage.ts:1150–1158): `VOICE_CONSENT_KEY = "home-health-voice-consent"`, `isVoiceConsentGranted()`, `markVoiceConsentGranted()`. The sheet mirrors the PHQ-9 consent block (phq9-check-in.tsx:53–72): plain-language bullets — mic only listens while the indicator shows; speech may be processed by the browser's speech service; nothing is saved without a visible confirm; you can always type instead. On accept: `markVoiceConsentGranted()` + dispatch the existing `addAuditEvent` action (payload shape: see `shareResource`, family-experience.tsx:284–289) with action `"voice_consent_granted"`. Expose one shared entry helper so every surface wires consent + session-start auditing identically:
  ```ts
  export function useVoiceEntry(): {
    consentRequired: boolean;              // !isVoiceConsentGranted()
    grantConsent: () => void;              // marks flag + audits voice_consent_granted
    onSessionStart: (surface: string) => void;  // audits voice_session_started ("Voice session started — {surface}")
  }
  ```
  Gate: every surface's mic entry point checks `consentRequired` and renders the sheet first if so, then calls `onSessionStart` when listening actually begins.
- **`voice-indicator.tsx`** — a small chip shown whenever dictation is listening or TTS is speaking: pulsing mic icon + label (`tVoice` "Listening…"/"Speaking…") + a stop button. **Wiring (stated to avoid improvisation):** props-driven — `{ listening: boolean; speaking: boolean; onStop: () => void }` — and mounted per-surface next to each mic entry point; `listening` comes from the surface's `useDictation` state, `speaking` from `subscribeSpeaking`. No global store, no polling. Earcons: short start/stop beeps via a throwaway `AudioContext` oscillator (~120ms, low volume); skip silently if `AudioContext` is unavailable.
- **New audit action values** — add `"voice_consent_granted"` and `"voice_session_started"` to the `AuditEvent["action"]` union (types.ts:162–176). The privacy panel's `actionLabelMap` (privacy-panel.tsx:12–27) is a monolingual-English `Record<AuditEvent["action"], string>` and stays that way after the cherry-pick — add English labels matching the existing 14 entries' style; bilingual audit labels are explicitly out of scope for this sprint.
- **`src/i18n/voice-strings.ts`** — `VoiceStringKey` union + `voiceStrings: Record<Language, Record<VoiceStringKey, string>>` + `tVoice` helper, exactly the family-strings pattern. Seed keys: listening/speaking labels, consent sheet copy, stop/cancel labels, per-phase keys added as later phases need them.

### P0.3 Tests
`use-dictation.test.ts` (mock SpeechRecognition: final-only append, replay dedupe, unmount stop, unsupported → `supported:false`); `tts.test.ts` (mock speechSynthesis: resolves on end, `stopSpeaking` cancels, unavailable → resolved no-op, es voice preference order); `voice-consent.test.ts(x)` (flag round-trip; sheet renders before first mic use; accept → flag + audit dispatch); indicator render states.

**Commit:** `feat: add voice kernel (dictation hook, tts, consent, indicator)`

---

## P1 — Family orientation interview goes hands-free (T2)

1. **Speak the thread.** In `family-orientation-interview.tsx`: when a round becomes current, `speak()` the question then its chip options ("You can say: {a}, {b}, or {c}" — new `tVoice` key), language-aware. When the thread completes, speak the `orientationComplete` line. All of this text is already sanitized (`sanitizeFamilyFollowUps`) or deterministic i18n — pre-gated by construction. `stopSpeaking()` on unmount, on mic start (barge-in), and on reseed.
2. **Mic on follow-up turns.** Extend the `via` union to `"chip" | "typed" | "voice"` in `FamilyFollowUpTurnProps.onAnswer`. Add `useDictation` to `FamilyFollowUpTurn` (mic button beside the text input, consent-gated). On final transcript: normalize (lowercase, strip punctuation/accents) and compare against the round's chip labels (and their 1-based ordinals: "one"/"uno", "the first one"/"la primera") — a match auto-submits as `onAnswer(chipLabel, "voice")`; no match fills the text input for the user to edit/submit (voice fills, screen commits).
3. **Provenance.** Stop dropping `via` at line 273 and stop hard-coding `source:"typed"` at 203: the orchestrator maps `via` per answer (`"voice"` ⇒ voice; chip/typed ⇒ typed) and reports `source: "voice" | "mixed" | "typed"` across the session in the extraction meta (mirror the opening composer's `inputSourceRef` semantics).
4. **Safety unchanged:** every answer still flows through `answerFollowUp`'s existing gate (148–157) regardless of chip/typed/voice path — a spoken crisis phrase redirects to `/chat?ask=` exactly like a typed one.
5. i18n: new keys (chips-spoken template, mic labels) in voice-strings en+es.

Tests (`family-orientation-interview.test.tsx`, `family-follow-up-turn.test.tsx` additions): question + options spoken on round start (mock tts); voice transcript matching a chip label auto-submits with `via:"voice"`; ordinal match; non-matching transcript fills input without submitting; spoken crisis phrase → `/chat?ask=` + no network; a voice-matched answer yields `source:"voice"` (and voice+typed across rounds yields `"mixed"`); `stopSpeaking` on barge-in/unmount.

**Commit:** `feat: voice-complete the family orientation interview`

---

## P2 — Front-door voice navigation with spoken confirm (T1+T2)

All in `home-composer.tsx` (do **not** modify `decideFrontDoor` — crisis:gate locks it):

1. **Migrate to `useDictation`**, deleting the inline shim (16–36, 81–110). Update `home-composer.test.tsx:63–90` mocks accordingly.
2. **Spoken echo-confirm for voice-initiated navigation only** (typed submits keep today's instant behavior). When the transcript resolves to `{kind:"navigate", href, label}` (from `decideFrontDoor` — it carries `label`; for classifier navigates map href → label via the `tHome` menu label keys): do not push immediately. Show a cancel chip ("Going to {label} — tap to cancel"), `speak()` "Taking you to {label}", and when the speak promise resolves, **restart dictation in cancel mode** — Web Speech ends after each final result, so there is no "still-open" session; use a component-level mode ref consulted inside `onFinalTranscript` (route mode vs cancel mode) and `start()` again for a ~1.5s window (`NAV_CONFIRM_MS = 1500`) matching a local cancel grammar ("no", "stop", "cancel", "wait" / "no", "para", "cancela", "espera"). Starting cancel listening only after the speak resolves avoids the mic hearing the app's own TTS; the tap-cancel chip is available the whole time and is the guaranteed path. Cancel (tap or voice) ⇒ stay, keep transcript in the input. Timeout ⇒ `router.push(href)`.
3. **Safety exception:** `reason === "safety"` routes keep today's immediate `/chat?ask=` push — no spoken delay, no confirm, nothing spoken.
4. **Surface clarify.** When `classifyRouteRemote` returns `{kind:"clarify", candidates}` (today it falls through to coach at line 69): **first filter `candidates` to `CLASSIFIER_HREFS` membership** — the remote response is cast unchecked (`as RouteDecision`, route-classifier-client.ts:21) and model-supplied hrefs must never become tappable navigation without the allowlist check the navigate branch already does; if none survive, go straight to the existing `/chat?ask=` fallback. Render the surviving (≤3) hrefs as tappable chips labeled via menu labels, and `speak()` "Did you mean {a} or {b}?"; answer by tap or by voice (local grammar: label text or ordinal, cancel-mode pattern from step 2). No match/timeout (~6s) ⇒ `/chat?ask=` fallback. `decideFrontDoor`'s own mock-classifier clarify handling stays untouched.

Tests: voice navigate speaks + delays + pushes after timer (fake timers); "no" within window cancels; typed submit unaffected (no delay); safety utterance → immediate `/chat?ask=`, tts never called; clarify chips render + spoken + voice-ordinal selects + timeout falls back to coach; **clarify candidates outside `CLASSIFIER_HREFS` are dropped (all dropped ⇒ coach fallback)**; es grammar variants.

**Commit:** `feat: spoken confirm and clarify for front-door voice navigation`

---

## P3 — Read-aloud on existing surfaces (T2, zero new safety surface)

1. **`<ReadAloud text={string} language={Language} />`** in `src/voice/read-aloud.tsx`: speaker toggle button (min-h-12, aria-pressed), `speak()` on tap, `stopSpeaking()` on second tap/unmount. Only ever handed deterministic/derived/gated text.
2. Mount points: each `/plan` section (concatenate that section's lines); `HealthBriefCard` (whole-brief button reusing the plain-text export builder at health-brief-card.tsx:30–39, plus per-section buttons); `/learn/retinopathy` answers (the `EducationAnswer.text`); `/chat` per-assistant-message speaker button inside the message `<article>` (next to line 143, `message.role === "assistant"` only — content is already gate-approved text); family thread **question bubbles and the completion line only** (sanitized/i18n text — the caregiver's own bubbles get no button here; verbatim read-back of user input is P4's read-back, not this component).
3. **Auto-read preference:** if `state.patient.accessibilityPreferences` includes the existing `"read_aloud"` value, `/chat` auto-speaks each new assistant message. Implementation constraints (stated to avoid two known bugs): **watch `state.aiMessages`** (assistant messages also arrive from checkin and food pages — see Verified facts), initialize the watcher with the current last-message id so mount/navigation never replays old messages, and **suppress auto-read entirely while a live voice session is active** (P6) — the user already hears the realtime audio; re-speaking the transcript is double audio. Crisis-safety messages are spoken at rate 0.9. Manual buttons work regardless of the pref.
4. Consent note: read-aloud is output-only — no mic — so it does **not** require the voice consent sheet.

Tests: ReadAloud toggles speak/cancel with correct lang; chat speaker button only on assistant messages; auto-read fires on a message appended after mount when pref set — not on mount with existing messages, not without the pref, and not while a live session is active; crisis message spoken at reduced rate.

**Commit:** `feat: read-aloud across plan, brief, learn, chat, and family thread`

---

## P4 — Voice capture: glucose, BP, PHQ-9 (T2)

### P4.1 `src/voice/number-parse.ts`
```ts
export function parseBpUtterance(text: string, language: Language): { systolic: number; diastolic: number; pulse: number | null; contexts: MeasurementContext[] } | null
export function parseGlucoseUtterance(text: string, language: Language): { valueMgDl: number; contexts: MeasurementContext[] } | null
```
Handle: digits ("120 over 80", "120/80", "145"), en word forms ("one twenty over eighty", "one hundred and forty five"), es forms ("ciento veinte sobre ochenta", "ciento cuarenta y cinco"). **Context phrases are extracted, not rejected:** bilingual phrase → enum mapping for the 7 `MeasurementContext` values ("after resting"/"después de descansar" → `after_resting`, "in the morning"/"en la mañana" → `morning`, …), returned in `contexts` (empty array when none spoken); unrecognized trailing words are ignored for number extraction but never cause a null when a plausible number was found. Parsing of the *numbers* is deliberately conservative — return null rather than guess a value. Table-driven tests en+es.

### P4.2 `VoiceCaptureCard` on /numbers and /glucose
New `src/voice/voice-capture-card.tsx`, rendered **above** the existing forms (which stay byte-identical — they're uncontrolled FormData forms; don't refactor them). Flow: mic (consent-gated) → transcript shown → parse → staging card displays the parsed values LARGE + context chips (the same 7-value enum, with any parsed contexts pre-selected) + note field → **Save is a tap** that validates through the same zod schema (`bpReadingInputSchema`/`glucoseReadingInputSchema` — both require ≥1 context, so Save stays disabled until a context is pre-selected from speech or tapped) and dispatches the same actions the pages use (`addReading`/`addGlucoseReading`) → spoken confirmation ("Saved: 120 over 80.").
- Out-of-zod-range or superRefine failure: speak a digit-by-digit read-back ("I heard one-eight-zero over two-one-zero — that doesn't look right. Tap a number to fix it."), allow one voice retry, then keep the staging card editable (tap fallback). **Never auto-dispatch. No verbal commit for clinical numbers.**
- Parse failure: speak one reprompt with an example ("You can say a number, like 'one twenty over eighty'"), then fall back to the form.

### P4.3 PHQ-9 voice (local-only, structurally offline)
In `phq9-check-in.tsx` (additive — keep react-hook-form wiring):
- Per-item ReadAloud (question + the four option labels from `PHQ9_RESPONSE_OPTIONS`).
- One mic affordance per item (consent-gated): final transcript is matched **locally** against option labels (`option.en`/`option.es`), values ("zero"–"three"/"cero"–"tres", digits), and ordinals; a match sets that item's radio via `setValue`; no match → speak one reprompt, then tap-only for that item. **The transcript is discarded after matching — assert in tests that no `fetch` occurs anywhere in the voice path.**
- The consent block gains one voice line (bilingual): answers spoken aloud are interpreted on this device and are not sent anywhere.
- Submit stays a tap. Item-9: whether the answer arrived by voice or tap, the existing `phq9Item9IsPositive` flow in `checkin/page.tsx:20–56` fires identically. **The rate-0.9 crisis speech goes in `checkin/page.tsx`** (an effect keyed on the `result.crisis` branch whose card renders at 62–66) — `phq9-check-in.tsx` changes are limited to the per-item mic/ReadAloud/consent-line.

Tests: parser tables (en/es, word/digit/mixed, context-phrase extraction, rejects out-of-range garbage, trailing unknown words don't null a good number); BP capture end-to-end — speak with a context phrase → staging card with context pre-selected → tap Save → dispatch with correct payload; Save disabled with zero contexts; no dispatch without tap; out-of-range → read-back + no dispatch; glucose same; PHQ-9 option matching (labels/values/ordinals, en+es), `setValue` called, **fetch spy never called**, item-9 spoken "nearly every day" → crisis path fires + spoken at 0.9.

**Commit:** `feat: voice capture for BP, glucose, and PHQ-9 with tap-only commits`

---

## P5 — Talk-to-draft on /plan (T2, keyless)

1. **New reducer action** `removeContextItem`: `{ type: "removeContextItem"; contextItemId: string }` — removes the context item and filters `extractedFacts` by `contextItemId`; audits `"deleted"` / "Care note removed". Add to the `HealthAction` union + store tests. (Verified: no removal action exists today.)
2. **`DraftPanel`** (`src/voice/draft-panel.tsx`), mounted on `/plan` behind a "Talk through your plan" button. Split view: left = conversation log (spoken turns as transcript bubbles), right = staged draft (facts grouped by context item).
   Loop per turn: mic (consent-gated) → transcript displayed → **safety gate first** — `classifyCrisis(t).matched || classifySafety(t).level !== "allowed" || screenSocialEmergency(t)` ⇒ `router.push('/chat?ask=' + encodeURIComponent(t))`, nothing stored (same trio as family-orientation-interview.tsx:148–157) → build a `CareContextItem` (`title: "Voice note {n}"`, `rawText: transcript`, `sourceLabel: tVoice("draftSourceLabel")` — must satisfy `careContextInputSchema`; transcripts under 10 chars get one spoken reprompt) → `dispatch({ type: "addContextItem", item, facts: extractInstructionFacts(item) })` (the intake pipeline verbatim, intake/page.tsx:13–33). This dispatch is **staging, not commit**, per the law's staging clause — all facts land `needs_review`; `confirmFact` remains the only commit → **speak a turn summary**: "I noted {n} item(s): {fact labels}. Tap confirm on any to add it to your plan."
3. **Per-fact provenance + confirm:** each staged fact shows its `sourceSnippet` and which voice note produced it (`contextItemId`); confirm is the existing `confirmFact` tap (facts land in /plan's confirmed section automatically since it reads `extractedFacts`).
4. **Undo:** an "Undo last note" button + local voice grammar ("undo that" / "deshaz eso") dispatches `removeContextItem` for the most recent voice-added item. Only voice-note items this panel created are undoable (track their ids in component state), and **voice undo works only while every fact of that item is still `needs_review`** — once any fact is confirmed, removal requires the tap Undo button (voice must never delete confirmed plan content).
5. **Read-back:** a button that speaks the staged + confirmed draft summary before the user leaves.
6. Deterministic extraction only (`extractInstructionFacts`) — keyless by construction. LLM-enriched extraction is a later, separate handoff.

Tests: utterance → context item + needs_review facts staged; nothing confirmed without tap; crisis utterance → redirect, no `addContextItem`; short transcript → reprompt, no dispatch; turn summary spoken with fact count; undo removes item + its facts (only voice-created ones; voice undo refused once a fact is confirmed, tap undo still works); read-back speaks; es strings.

**Commit:** `feat: talk-to-draft care plan panel over the intake fact pipeline`

---

## P6 — /chat live voice (T3) + realtime hardening

1. **Generalize `ConnectArgs` context injection.** Replace `getContext: () => LiveSessionContext` with `buildContextMessage: () => { text: string; imageDataUrl?: string | null } | null` (null ⇒ inject nothing). Move the food serialization + `lastInjectedFoodId` dedupe (realtime-session.ts:130, 188–205) into `use-food-voice-session.ts` — **create the `buildContextMessage` closure (and its `lastInjectedFoodId`) inside `start()`**, not in a hook-level ref: today the dedupe resets on every `connectRealtimeSession` call, so after a stop/restart the first injection must re-send the full food JSON, not `'{"foodData":"unchanged"}'`. Update `realtime-session.test.ts` accordingly and add a test asserting the food JSON is re-sent on the first injection after a restart; the food hook's wire-visible behavior must not change.
2. **Output-transcript gating.** New `src/ai/output-guard.ts` exporting a **pure, testable stateful helper** (the WebRTC shell can't run under jsdom, so the seam is mandatory):
   ```ts
   export function createOutputTranscriptGuard(args: {
     language: Language;
     send: (event: object) => void;          // response.cancel / output_audio_buffer.clear
     onEvent: (event: LiveSessionEvent) => void;
   }): { observeDelta: (delta: string) => void; reset: () => void }  // reset on response.created/response.done; one trip max per response (latch)
   ```
   `observeDelta` accumulates the response transcript and checks: `classifyCrisis(accumulated).matched` OR a new deny set (med start/stop/dose-change advice patterns, "you have {condition}" diagnosis claims, specific BP/A1C/glucose number assertions — reuse regex fragments from `src/domain/safety.ts` and the diagnosis terms in `family-diagnosis-lint.ts`). On trip: `response.cancel` + `output_audio_buffer.clear` + `safetyIntercept` with a **specified tier/copy mapping — never invented copy**: crisis-pattern trip ⇒ `safety: "crisis"`, content `tSafety(language, "crisisResponse")`, `CRISIS_ACTIONS`; med/diagnosis/number trip ⇒ `safety: "blocked"`, content = a new human-authored `tVoice` key ("Let me stop there — that's something to check with your care team."/es), `CARE_TEAM_ACTIONS`. Wire `observeDelta` into `realtime-session.ts` on `response.output_audio_transcript.delta` (the event name `reduceRealtimeEvent` already handles for partial transcripts) and `reset` on response start/done. Accept that ~a sentence of audio may escape; do NOT add a playback delay buffer. Unit-test the guard patterns, the latch (one intercept per response), and the cancel-and-flush ordering — all against the pure helper, no WebRTC needed.
3. **Model default: DO NOT change it.** The code default stays `"gpt-realtime-2"` — the deployed /food demo runs live on it, and a speculative id would 502 the mint and silently kill working voice. The cheaper model is opt-in via env only: the owner sets `HEALTH_AI_REALTIME_MODEL=gpt-realtime-2.1-mini` after verifying the id (owner action below). Add/keep a token-route test asserting the env override reaches the mint payload. Voice stays `"marin"`.
4. **Chat voice session.** New `src/hooks/use-chat-voice-session.ts` cloned from the food hook's generic skeleton: token fetch with `crisisOpen` attestation (block start while a crisis is unacknowledged), `gateTranscript: (t) => evaluateVoiceTranscript(t, getState(), language)`, idle timeout. Tab-hide teardown is page-level (mirror `food/page.tsx:167–179` — visibilitychange + pagehide listeners in `chat/page.tsx`). Instructions: `buildCoachSystemPrompt` **is exported** (`coach-provider.ts:37`) — import and reuse it directly, wrapped in `buildCoachVoiceInstructions(state)` that appends voice-specific brevity guidance; do NOT duplicate the guard sentences (they must not drift). `buildContextMessage: () => null`.
5. **Chat UI:** mount the voice controls in **`chat/page.tsx`** alongside `ConversationPanel`, computing the lock with the existing `hasUnacknowledgedCrisis(state)` selector (the same rule ConversationPanel implements privately at 64–67 — leave that internal code untouched, no new panel props). Voice button consent-gated and hidden while the lock is active; final user/assistant transcripts append as `AiMessage`s via the existing `addAiMessage` dispatch (mode `"ask"`); `safetyIntercept` → dispatch the intercept content as a `safety`-tiered assistant message so the panel's own crisisLock engages; the VoiceIndicator shows session state; stop button ends the session.
6. **Audit:** `useVoiceEntry().onSessionStart("chat")` on session start (P1–P5 surfaces already wire theirs through the same helper).

Tests: context-generalization keeps food tests green + restart re-sends food JSON; output guard trips on scripted deltas (med advice, diagnosis claim, crisis phrasing) with cancel+flush ordering, the per-response latch, and never on benign text; token route env-override test; chat hook — start blocked while a crisis is unacknowledged, transcripts append as messages, intercept engages the panel lock; consent + audit fire.

**Commit:** `feat: live voice coach on /chat with output-transcript gating`

---

## P7 — Verification & the voice crisis lane

1. **Voice corpus test** `src/ai/voice-gate-corpus.test.ts`: take the crisis/emergency phrases exercised in `crisis-red-flags.test.ts` and, deterministically in-test, generate ASR-degraded variants — punctuation stripped, lowercase, digit↔word number swaps, and filler insertions ("um", "este") **only at clause boundaries (utterance start, after punctuation, between clauses) — never inside a 4-word window around the crisis phrase itself**, because the crisis patterns are deliberately tight literal phrases and mid-phrase fillers defeat them by construction. Assert `evaluateVoiceTranscript` still intercepts every crisis-tier variant. **Do NOT edit `crisis-red-flags.ts` regexes in this phase** — those patterns are the zero-false-positive core of crisis:gate; a variant that defeats a pattern mid-phrase is documented as a known irreducible ASR miss at the top of the test file (with the mitigation note: the fail-closed watchdog and screen twin remain), and any proposed regex loosening goes to the owner as a follow-up, not into this sprint. Add a <5ms-per-call performance assertion over the corpus.
2. **Add the new file to the gate:** append `voice-gate-corpus.test.ts` (and `output-guard.test.ts`) to the test-file list in `scripts/crisis-gate.mjs` so `npm run crisis:gate` owns them.
3. `npm run check` + `npm run crisis:gate` — both green.
4. **Browser walk-through — best-effort by environment.** Dev server via the preview tooling (`.claude/launch.json` name `"dev"`); pane screenshots are broken on this machine — verify via DOM text/JS. **Web Speech APIs do not exist in headless automation**: run every step through its typed twin + DOM/JS assertions (that is what the twins are for), record what was skipped, and note that the true mic/speech legs belong to the owner hardware checklist. Steps (each via typed twin where the mic is unavailable):
   - /family: seed Morgan → opening (typed twin) → follow-up question renders + `speak` called (assert via a window-level tts spy or DOM state) → answer matching a chip → auto-submits → complete.
   - /today: "log my blood sugar" → expect the spoken/echoed label **"Log a blood sugar reading"** (this phrase matches the VERB_RULES entry at front-door.ts:55, not the nav-lexicon "My Blood Sugar" label) + cancel chip → let it navigate; a crisis phrase → instant `/chat?ask=`, no echo/delay.
   - /glucose: "one forty five after resting" (typed into the capture card's dev/typed twin) → staging card shows 145 with `after_resting` pre-selected → tap Save → reading appears; "eleven hundred" → read-back + no save.
   - /checkin: consent → item read-aloud wired → answer item 9 "nearly every day" → crisis card + spoken copy; confirm zero network calls from the assessment voice path (network log).
   - /plan: two notes into the draft panel → facts staged → confirm one → appears in confirmed instructions → undo removes the other (still unconfirmed) one.
   - /chat: with `?k=` passcode — session start path exercised (token mint observable); without passcode — graceful mock/typed fallback.
   - es: toggle language (cherry-picked toggle) and repeat the /family + /today flows in Spanish.
5. Fix any fallout; re-run both suites.

**Commit:** `test: voice crisis lane and end-to-end voice verification`

---

## Owner actions (not Codex)

- Run the hardware checklists on a real phone (`docs/voice-hardware-check.md`, `docs/food-lens-demo.md:88–96`) — WebRTC, echo cancellation, iOS autoplay unlock, es speech quality. Never yet executed.
- Verify the current cheap realtime model id (expected `gpt-realtime-2.1-mini`) against OpenAI's model list, then set `HEALTH_AI_REALTIME_MODEL` in Vercel to opt into it — the code default deliberately stays `gpt-realtime-2` so the live /food demo can't silently break.
- Run the mic/speech legs of the P7 walk-through on real hardware (they cannot run in headless automation).
- Decide when to trigger the T4 cloud-cascade upgrade (BAA vendors) — trigger conditions in `docs/specs/12-voice-first-infrastructure.md` §8.

## Guardrails

- **Never weaken or reorder a safety gate.** Every utterance passes the deterministic trio (or `evaluateVoiceTranscript` on live paths) before any network/LLM call; intercepts suppress feature output; crisis acknowledgment is tap-only.
- **`speak()` never receives ungated model text.** T2 speaks only i18n strings, sanitized interview questions, gate-approved chat messages, and derived projections. T3 output is guarded by P6.2.
- **No voice auto-commit of clinical numbers or assessments.** Staging card + tap, always.
- **PHQ-9/SDOH voice never touches the network.** Local label matching only; tests enforce with fetch spies.
- **Don't churn locked machinery:** `family-interview.tsx` internals, `decideFrontDoor`, `FamilyNeedsScreen`, the BP/glucose form components, and food-hook observable behavior all stay as-is except where a phase explicitly says otherwise.
- **en/es parity compile-enforced** for every new string table; voice grammars (cancel words, ordinals, number words) ship bilingual with tests.
- TypeScript strict, no `any`. Match surrounding style; no comments on unchanged code.
