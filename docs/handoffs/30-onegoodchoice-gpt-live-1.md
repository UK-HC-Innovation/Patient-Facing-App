# Handoff: GPT-Live-1 as the voice engine for 1 good choice

Paste everything below the line into a fresh Claude Code or Codex session as one prompt. Written 2026-09-13 against `32223e2`, and revised the same day to drop the playback hold and the pre-launch safety test.

---

You are adding OpenAI's GPT-Live-1 as a second voice engine for 1 good choice (`/food` and `/food/demo`) in the repo at `C:\Patient centered` (Next.js 15, React 19, TypeScript strict, Vitest, Playwright). Work directly on `master` in that tree. Read these first, in this order:

1. `CLAUDE.md` at the repo root.
2. `C:\Users\tsthe2\.claude\writing-rules.md`. Every user-facing string you add follows it.
3. `docs/specs/30-onegoodchoice-trustworthy-choice.md`, sections R7, R8, 8 and 13.
4. `docs/handoffs/30-onegoodchoice-first-build.md`, P1. Its intercept and pass lists are the test cases for the voice gates in this build.
5. `src/ai/realtime-session.ts`, `src/hooks/use-food-voice-session.ts`, `src/app/api/realtime/token/route.ts`, `src/ai/output-guard.ts`, `src/ai/voice-gate.ts`.
6. The last three lines of `docs/ops/DEPLOYS.jsonl`.
7. OpenAI's GPT-Live docs (append `.md` to any of these for the raw page):
   - https://developers.openai.com/api/docs/models/gpt-live-1
   - https://developers.openai.com/api/docs/guides/live
   - https://developers.openai.com/api/docs/guides/live-migration
   - https://developers.openai.com/api/docs/guides/live-delegation
   - https://developers.openai.com/api/docs/guides/live-conversations
   - https://developers.openai.com/api/docs/guides/live-prompting
   - https://developers.openai.com/api/docs/guides/voice-webrtc (the GPT-Live variant)
   - https://developers.openai.com/api/docs/guides/voice-server-controls
   - https://developers.openai.com/api/docs/guides/voice-latency-cost
   - https://developers.openai.com/api/docs/guides/your-data

## What GPT-Live-1 is

Checked against OpenAI's docs on 2026-09-13. The docs win if anything here is wrong; record the difference in P0.

- Model `gpt-live-1`, served only at `/v1/live/sessions`. It is a separate API from Realtime; `/v1/realtime/*` does not serve it.
- Audio and text in, audio and text out. Images and video are rejected. OpenAI's advice is to send images to a vision backend and pass GPT-Live the text.
- $0.05 per connected minute, billed per second. Silence and waiting on backend work count. Muting the mic does not stop billing; `session.close` does. Backend models and tools bill separately.
- Concurrent sessions by usage tier: 25 at Tier 1, up to 500 at Tier 5.
- Full duplex and server-driven: GPT-Live decides when to speak. No client event creates, cancels or truncates a response. `turn_detection`, `create_response`, `interrupt_response`, `response.cancel`, `output_audio_buffer.clear` and `conversation.item.truncate` are gone, and no event marks the end of a spoken response.
- WebRTC: your server posts the browser's SDP offer to `POST https://api.openai.com/v1/live/sessions` with the API key, body `{ session: {...}, transport: { type: "webrtc", sdp } }`, and gets back `{ session: { id }, transport: { sdp } }`. The browser sets that SDP as the answer, uses data channel `oai-events`, waits for `session.started`, and never sends `session.start`. No ephemeral client secret is involved.
- Session config is strict and rejects unknown fields: `model`; `instructions` (fixed after start, extend with `session.instructions.append`); `audio.output.voice` (default `marin`, fixed after start); `delegation` (`{ type: "client" }` by default, or `{ type: "responses", responses: { model, instructions, tools, ... } }`); `input` (startup history, at most 128 messages and 8,192 tokens); `store` (off by default; on keeps recordings 30 days). Confirm where the safety identifier goes before sending one.
- Server events: `session.started`, `session.updated`, `session.closed` (final usage and a reason), `session.input_transcript.delta` and `session.output_transcript.delta` (text fragments with `start_ms`/`end_ms` on the session timeline; there is no turn-completed event), `session.delegation.created` (an id and a target, no task text), the three `*.appended` acknowledgments, `session.input_audio.muted`/`unmuted`, `session.usage.updated`, `error`.
- Client events: `session.instructions.append` (interrupts speech in progress), `session.thinking.append` (quiet context), `session.commentary.append` (say this aloud; it may paraphrase), each with `content` up to 500 tokens and a required `delegation_id` (`null` for general context); `session.input_audio.mute`/`unmute`; `session.update` (only `delegation.responses` can change); `session.close`.
- Function tools exist only inside Responses delegation, and no setting forces GPT-Live to delegate.
- OpenAI's guidance for blocking model audio: control output at the client (mute or drop it, discard queued audio) and keep your existing input and output safeguards.
- Data: `/v1/live/sessions` keeps abuse-monitoring data 30 days and is ZDR-eligible with limitations. HIPAA eligibility for this endpoint is unverified; BAA-backed voice stays the external release gate spec 12 records.
- Voices: `marin` plus twelve new ones (quartz, ripple, vesper, willow, stone, gleam, meridian, bossa, tempo, beacon, delta, cinder). Spanish support comes from third-party reports only; OpenAI's session guide does not list it.

## Safety on GPT-Live

Today's voice safety rests on three Realtime controls. `create_response: false` holds every reply until the patient's final transcript clears `evaluateVoiceTranscript`. `response.create` releases it. `response.cancel` plus `output_audio_buffer.clear` stop a reply the output guard trips on. GPT-Live has none of the three.

The owner chose speed on 2026-09-13: no playback hold, no delay line and no pre-launch safety measurement. Do not add any of them. The existing input gate and output guard stay, wired as a kill switch. They read the transcript as it streams and add no delay. On a trip they mute the audio element, close the session and show the refusal or crisis card. Part of an answer can be heard before the cut. This build does not satisfy spec 30 Slice B, so do not describe it as release approval for study participants.

Facts come from code. GPT-Live gets no images and no tools. It gets text facts, and client delegation sends its questions back to the app, which answers from the same deterministic paths the typed box uses.

## Scope

Build: the engine switch, a server route for the SDP exchange, a Live transport behind the existing `LiveSessionHandle`, the existing gates wired as a kill switch, client delegation answered by code, a short check on the real model, and the deploy.

Out of scope: a playback hold or delay line, a paid red-team measurement, `/chat` voice (stays on Realtime and must behave exactly as today), Ladder and family surfaces, the identify, plate, vision and package routes and their models, a new text route (spec 30 Slice E), a sideband server, `store`, recordings, forks, custom voices and telephony. No new npm dependency; the repo calls OpenAI with `fetch`.

## Defaults for the owner decisions

Nobody has answered these. Use the defaults and list them in the final report.

1. Doors: both, one flag. The voice hook is shared.
2. Production: Live on for English at the end of this build.
3. Spanish: Live for `es` too if the P4 Spanish check sounds right. Otherwise Spanish stays on Realtime.
4. Voice: `marin`, the voice both doors use today.
5. Delegation: client. No backend model and no backend token spend.
6. Spend: close after 60 s with no speech from either side, hard cap of 5 minutes per session (at most $0.25).

## Gates, run at the end of every phase

- `npm run check` bare. Never pipe it; piping hides the exit code. It runs lint, vitest, the store-free witness, the build and the bundle budgets.
- `npm run crisis:gate`.
- Playwright, both projects, serialized, on a private port, after confirming no other dev server is running in this tree. Five dev servers sharing one `.next` is what made food e2e look flaky last time.

```bash
PLAYWRIGHT_PORT=3217 npx playwright test e2e/food-critique.spec.ts e2e/food-demo.spec.ts e2e/food-lens-shell.spec.ts e2e/food-lens.spec.ts --project=chromium --project=mobile --workers=1
```

- Do not set `NEXT_DIST_DIR` to an arbitrary name. `next.config.mjs` rejects anything except `.next-package-eval-<24 hex>` with a matching `PACKAGE_LABEL_EVAL_BUILD_ID`, and that pair also switches on evaluator attestation headers.
- The Browser pane caches `/_next/static/chunks/app/food/page.js` with no version query and can show an old build through every reload trick. Decide with `curl -s http://localhost:<port>/_next/static/chunks/app/food/page.js | grep -c "<a string you just wrote>"`, or trust a green Playwright run.
- Bundles: `/food/page` has a 315 KiB ceiling and `/food/demo/page` 205 KiB, with almost no headroom. Load the Live transport with `import()` inside `startSession` so neither first load grows. Raise a ceiling only from a fresh measurement, and never touch the >900 KiB per-chunk guard in `scripts/check-ladder-bundle.mjs`.
- Nothing new on the public door imports `@/state/*`. The store-free witness enforces it.
- Commit at the end of each phase, path-scoped: `git add <paths> && git commit -m "..." -- <paths>`. Other sessions edit this tree; never `git reset --hard` or `git checkout --` over changes you did not make.

## P0. Baseline, docs and access

1. Record the commit, dirty files and provider configuration without secrets. Production is `4a0be55`. `32223e2` (brand identity) is on `master`, undeployed, and ships with this build.
2. Read every doc listed above. Write the exact request shape, field names and event names you will use into `docs/ops/gpt-live-1-notes.md`, dated, with the URL for each.
3. Access: with `HEALTH_AI_API_KEY` from `.env.local`, printing nothing secret, call `GET https://api.openai.com/v1/models/gpt-live-1` and record the status. Record the org's usage tier. If this key cannot use the model, stop and report; nothing below works without it.
4. Baseline suites: `npx vitest run src/ai/voice-gate.test.ts src/ai/voice-gate-corpus.test.ts src/ai/output-guard.test.ts src/ai/realtime-session.test.ts src/hooks/use-food-voice-session.test.tsx`.

## P1. Engine switch and session route

Files: `src/app/api/realtime/token/route.ts`, new `src/app/api/live/session/route.ts`, a shared guard module under `src/server/`, `src/middleware.ts`, `.env.example`, tests.

1. Two env vars. `HEALTH_AI_LIVE_LANGUAGES`: empty (the default) keeps Realtime everywhere; `en` or `en,es` turns Live on for those languages. `HEALTH_AI_LIVE_MODEL`, default `gpt-live-1`.
2. The token route adds `engine: "realtime" | "live"` to its probe and mint answers only when the body says `surface: "food"`, and the food hook sends that. With engine `live` the token route mints nothing and the hook goes to the new route. `/chat` sends no surface and gets byte-identical answers; test it. A missing `engine` means `realtime`, so the existing e2e stubs keep their meaning.
3. `POST /api/live/session` takes `{ sdp, instructions, language, patientId, crisisOpen, passcode, nonce }` and runs the token route's checks in the same order: crisis attestation (409), origin (403), nonce (401), mint rate limit (429 with Retry-After), provider and key (`mock`), passcode (`locked`). Move those checks into the shared module and have both routes call it. Cap the SDP and instruction sizes. Then call `/v1/live/sessions` with `model`, `instructions`, `audio.output.voice: "marin"`, `delegation: { type: "client" }` and the WebRTC transport. Never send `store`. Return `{ mode: "live", engine: "live", model, sessionId, sdp }` with `Cache-Control: no-store`; on upstream failure, 502.
4. A failed Live start shows the existing "Could not start the voice session." and leaves the typed box working. No automatic fallback to Realtime or to mock.
5. Add `/api/live/session` to `FOODLENS_API_PATHS` in `src/middleware.ts`, or the narrow Azure surface returns 404 for it.
6. Route tests: check order, the upstream body (client delegation, voice, no `store`, no image fields), the response shape, `/chat` unchanged.

Commit: `feat(voice): GPT-Live-1 session route behind a per-language engine switch`.

## P2. Live transport and kill switch

Files: new `src/ai/live-session.ts` and its test, `src/ai/output-guard.ts`, `src/hooks/use-food-voice-session.ts` and its test, `e2e/food-critique.spec.ts`.

Keep the logic in pure reducers the way `realtime-session.ts` does, so unit tests need no WebRTC.

1. `connectLiveSession` returns the same `LiveSessionHandle` the hook uses today.
2. Connect: mic tracks on an `RTCPeerConnection`, data channel `oai-events`, offer to `/api/live/session`, answer from `transport.sdp`. Send nothing before `session.started`.
3. Playback: the remote stream plays through an `<audio>` element, as in `realtime-session.ts` today. No Web Audio graph and no delay.
4. Input gate: collect `session.input_transcript.delta` into the current user turn and run `evaluateVoiceTranscript` on the whole turn after every delta. Decide and test when a turn ends. On an intercept: mute the audio element at once, send `session.close`, emit `safetyIntercept`, and latch the connection the way `createTranscriptGateLatch` does.
5. Output guard: feed `session.output_transcript.delta` to `createOutputTranscriptGuard`. Its remedy sends `response.cancel` and `output_audio_buffer.clear`, which GPT-Live rejects. Make the remedy an argument, keep Realtime's as it is, and give Live the same remedy as an input intercept.
6. Context: never send images. When the authority epoch changes, send the current facts as `session.thinking.append` with `delegation_id: null`, under 500 tokens, keeping the "not spoken by the user" framing. On `/food`, if history and day totals push it over, drop them and say so in the report.
7. The opening camera turn (`requestContextResponse`, `startWithContextResponse`) sends a code-built sentence (score, band, one follow-up question) as `session.commentary.append`.
8. Status: `listening` after `session.started`, `speaking` while output transcript deltas are arriving, `thinking` while a delegation is open; the 8 s watchdog now watches open delegations. With no turn-completed event, finalize an assistant turn after a quiet gap you choose and test, and mark it `truncated` when the person talks over it.
9. Spend: `close()` sends `session.close`, waits up to 2 s for `session.closed`, records its usage, then tears down. Idle close at 60 s, hard cap at 5 minutes. Confirm `usePageHideTeardown` on both doors reaches `close()`.
10. Typed lines never enter a Live session. A typed question closes any open Live session and takes the path `startSession` already uses when voice is not live: `openLocalCoachSession` with `OpenAiVisionProvider` when a key is present, the on-device mock when not. The typed food path is unchanged.
11. Tests: every intercept line in handoff 30 P1.1, fed word by word, intercepts by its last word; every pass line, fed word by word, never intercepts (including "I'm not going to take 8 units for this"); every output trip line in handoff 30 P1.2 trips and every output pass line passes; a trip mutes the audio element and sends `session.close`; nothing reaches the UI after a latch; the hook sends typed text to the text path when the engine is `live`. One e2e per door with the probe stubbed to `engine: "live"`: typed foods still score, a typed dosing question still gets the refusal, and no request reaches `/api/live/session`.

Commit: `feat(voice): GPT-Live-1 transport with the existing gates as a kill switch`.

## P3. The app answers delegations

Files: new `src/ai/live-delegation.ts` and its test, both door pages, `src/ai/compass-instructions.ts`, `src/ai/food-instructions.ts`, `src/i18n/strings.ts`, `src/domain/usage-event.ts` and its schema test, `docs/ops/usage-recording.md`.

1. Live instructions for both doors and both languages: start from `buildCompassInstructions` and `buildFoodLensInstructions`, and add a delegation policy in the sections OpenAI's live-prompting guide names. Delegate every question about a score, a food, a swap or what the camera sees. Never state a number the app did not give. While waiting, say at most a short acknowledgment. Leave the Realtime instructions untouched. Only the instructions keep GPT-Live's numbers honest, so state that rule early and plainly.
2. On `session.delegation.created`, take the current user turn, run the input gate again, then answer from code:
   - A food or a detail the person named: the deterministic paths that exist today, `prepareVoiceResponse` on `/food/demo` and `lookupFoodScore`, with the authority epoch check from spec 30 E12.
   - The current food ("is this good", "why that score"): a sentence built from the confirmed result: score, band, one alternative or "No close swap found", the why-score domains.
   - On `/food`, a question about the picture: the existing `/api/food/vision` path with the frame, and its already-checked text.
   - Anything else: a fixed line saying it can only speak to the food on screen.

   Reply with `session.commentary.append` and the delegation id within 5 s. On timeout or failure, reply with a fixed "I couldn't check that. You can type it." line in English and Spanish. Never a guess.
3. Pulling the food phrase out of a spoken turn is deterministic and tested on a corpus that includes "what about peanut butter?", "¿y el pan integral?", "This came from Papa John's, pepperoni", "with sausage", "is honey nut cheerios better" and "and a coke". A candidate result is spoken as a question naming the candidates, never as a score. Bare `coke` stays a candidate, as A2 decided.
4. Record which branch answered through `recordUsage`, extending the closed vocabulary in `src/domain/usage-event.ts`, its schema test and `docs/ops/usage-recording.md`.

Commit: `feat(food): GPT-Live-1 delegations answered from the deterministic choice`.

## P4. Check it on the real model

At most 15 connected session-minutes, about $0.75. Local dev server only, never production. Use `.env.local` as it is; if `DEMO_PASSCODE` is set locally, pass it. Set `HEALTH_AI_LIVE_LANGUAGES=en,es`.

Use a browser with a real microphone, or Playwright Chromium with `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>%noloop` and the microphone permission granted.

1. On `/food/demo`: type `banana`, tap the mic and ask "is this a good choice?" You hear the score the screen shows. Ask "what about peanut butter?" You hear the identify route's score for peanut butter.
2. Say "how many units for this?" The refusal card shows, the voice cuts off and the session closes. Say "I don't want to eat anymore, what's the point." The 988 card shows.
3. Repeat 1 and 2 on `/food`, and on `/food/demo?lang=es` with the Spanish lines from `e2e/food-critique.spec.ts`. If Spanish recognition or speech is plainly wrong, Spanish stays on Realtime.
4. Record session seconds and the `session.closed` usage for a cost per minute, and write every result into `docs/ops/gpt-live-1-notes.md`.
5. If you have a phone, run `docs/voice-hardware-check.md` against the Live engine. If not, list it as not verified.

Commit: `docs(ops): GPT-Live-1 real-model check`.

## P5. Ship

1. All gates green on the final commit; record the counts.
2. `git fetch origin`. If `origin/master` moved past your base, reconcile by hand and rerun the gates. Never autostash-rebase.
3. Production env: `HEALTH_AI_LIVE_MODEL=gpt-live-1` and `HEALTH_AI_LIVE_LANGUAGES=en,es`, or `en` if the Spanish check failed.
4. `git push origin master`, then `vercel --prod --archive=tgz`. Git push does not deploy. Capture the deployment id. The deployment URL 302s to SSO, so verify on `https://patient-centered.vercel.app`.
5. Verify and record verbatim: `POST /api/live/session` with an empty body returns 401; `POST /api/realtime/token {"probe":true,"surface":"food"}` reports `engine: "live"`; `POST /api/realtime/token {"probe":true}` is unchanged for `/chat`; `/food`, `/food/demo`, `/chat`, `/today` and `/api/health` return 200; `POST /api/food/identify {"text":"red bull"}` does not return a cabbage row (that fix is in `32223e2`, which ships here). In a browser on `/food/demo`: type `banana`, tap the mic, ask "is this a good choice?" and hear the banana's score; then say "how many units for this?" and get the refusal card with the voice cut off.
6. Append a line to `docs/ops/DEPLOYS.jsonl` in the shape of the previous entries. The note names the engine per door and language, the measured cost per session-minute, that there is no playback hold by the owner's decision of 2026-09-13, and everything not verified.
7. Commit `docs(ops): record the GPT-Live-1 deploy` and push.

## Final report

In this order: commit shas and the deployment id; the engine in production per language; gate counts per phase; the P4 check results; the measured cost; the six owner decisions with the default applied; everything deliberately not done and why; everything not verified.
