# Voice-First Infrastructure — Architecture Brief

> **Lifecycle — software complete, external validation pending.** Voice P0–P7
> landed in `1b17ef0` on 2026-07-20 and shipped in production `4cbe8c7` on
> 2026-07-21. The language toggle, cross-surface voice controls, live `/chat`
> voice, and output-transcript guard are built. Real-device mic, WebRTC,
> echo-cancellation, and TTS checks have not been recorded; clinical/legal review
> and a BAA-backed production voice posture remain external release gates. This
> brief preserves the pre-build architecture and must not be re-executed.

*Synthesized 2026-07-19 from a 7-agent investigation: two codebase audits (voice stack, interaction surfaces), two web-research sweeps (state-of-the-art voice AI, healthcare voice UX/safety), and three independent architecture designs (safety-first, latency/experience, product-sequencing). Web-sourced claims are current as of July 2026.*

**Goal:** make the majority of the platform voice-controlled — back-and-forth information exchange, voice interviews, and conversations with the LLM that build plans and documents — with cutting-edge voice components, without weakening the safety architecture.

---

## 1. Where we stand: the kernel already exists

The audit found far more than "a mic button." The app already has a real voice kernel:

| Asset | Where | Why it matters |
|---|---|---|
| **Classify-before-respond invariant** | `realtime-session.ts:16–24` (`create_response:false`), `applyTranscriptGate` (33–52), 4s fail-closed watchdog (223–233) | The model structurally cannot speak until the deterministic gate passes the transcript. This is the crown jewel — every engine below preserves it. |
| **Pure sync voice gate** | `evaluateVoiceTranscript` (voice-gate.ts:21–69) | Microsecond regex gate over crisis/emergency/blocked tiers; already tested for word-form vitals and negation. |
| **Session contract** | `LiveSession*` types (types.ts:26–72) | One abstraction already implemented by three engines (WebRTC realtime, speechSynthesis fallback, mock). |
| **Token-mint gate ladder** | `api/realtime/token/route.ts:32–53` | crisisOpen 409 → provider → key → passcode. Clone-able for any voice vendor. |
| **Spoken fallback cascade** | `local-coach-session.ts` | Literally text → full safety gate → speechSynthesis. The production cascade is this pattern with better STT/TTS. |
| **Hardened dictation shim** | `family-interview.tsx:21–62` | Generation counters, replay dedupe, final-only results. (The `home-composer.tsx:16–36` shim is a weaker duplicate — consolidate.) |
| **Voice metrics** | `realtime-voice-metrics.ts` | 1200ms p95 voice-turn budget already codified. |
| **Safety identifier** | `voice-safety-identifier.ts` | Salted hash; raw patient id never leaves in the clear. |

**Closeout:** the software gaps identified by the 2026-07-19 audit were closed
in `1b17ef0`: follow-up interview voice, TTS on chat/family/plan surfaces,
front-door spoken confirmation, realtime output-transcript gating, shared voice
consent/audit/indicator controls, and the language toggle all landed. Hardware
verification remains pending; no completed run of the real-device checklists in
`docs/voice-hardware-check.md` and `docs/food-lens-demo.md` is recorded.

---

## 2. The one architectural law

Every design perspective independently landed on the same rule:

> **Text-in-the-loop, both directions. No assistant audio is synthesized from text the gates never saw; no user utterance reaches a model before its transcript passes the deterministic gate. And: voice fills, screen commits — no voice path dispatches a store write without visual confirmation.**

This extends the app's existing invariants (deterministic crisis gate, write-incapable LLM, grounding verification) into the audio modality instead of replacing them. It also decides the engine question: **speech-to-speech models are only acceptable where their output-gating gap is tolerable, because S2S audio is generated before any text gate can see it.** Independent research confirms this isn't just our preference — cascaded pipelines dominate healthcare voice deployments for exactly this reason, and **Azure/OpenAI do not currently list realtime native audio as HIPAA-covered** ("treat PHI as text-only" is Microsoft's own guidance), so S2S-with-PHI has no clean compliance story in mid-2026.

---

## 3. Recommended architecture: one contract, three engines (with a planned fourth)

Extend the existing `LiveSessionHandle` into a shared **`VoiceSession`** layer (`src/voice/`) that every surface consumes. Engines behind it, chosen per surface:

- **T1 — Dictate** (Web Speech STT only). Keyless, $0. Form fill and front-door utterances. The unified hardened shim.
- **T2 — Voice-turn** (T1 + speechSynthesis TTS of **pre-gated text**). Keyless, $0. Interviews, guided capture, read-aloud, talk-to-draft. Because TTS only ever speaks deterministic strings or grounding-verified model output, output-side safety is inherited structurally — no new gate needed.
- **T3 — Live** (existing OpenAI Realtime WebRTC). Passcode-gated, highest cost/wow. Open free-form conversation only (/food and /chat). The code default remains **gpt-realtime-2**; a cheaper verified model may be selected through `HEALTH_AI_REALTIME_MODEL`. Output-transcript gating runs safety patterns over `response.output_audio_transcript.delta`; on hit, it sends `response.cancel` + buffer flush — accept that ~a sentence may escape; do not add a jitter-buffer delay, it kills the feel.
- **T4 (planned upgrade, not built now) — Cloud cascade**: streaming STT (Deepgram Flux — built-in end-of-turn <300ms, multilingual, BAA) → the existing gated text routes → streaming TTS (ElevenLabs Flash v2.5 or Cartesia Sonic-3) played through `<audio>`/MediaSource (never manually-scheduled PCM, or browser echo-cancellation goes blind and the agent hears itself). Drop-in replacement for T2's STT/TTS when Web Speech turn-taking feels sluggish or production/BAA posture is needed. Same gate placement as T2: **gate before TTS synthesis** — zero unsafe audio is ever generated.

**Do not adopt Pipecat/LiveKit now.** Both require a long-running worker beside Vercel to solve problems the app already solved (interruption handling) or can solve browser-side — and no framework provides classify-before-respond; we'd re-implement the gate inside their pipeline anyway. Vercel stays a token mint; all media flows browser↔vendor. Revisit LiveKit Agents only past ~10K min/mo or if telephony is needed.

**No wake words.** iOS kills background mic anyway, and a persistent open mic in a health app is a trust problem. Pattern: tap-to-start → within-session hands-free turn-taking (VAD/semantic endpointing, tuned for **older speakers with generous pause tolerance** — the single biggest determinant of whether patients feel heard or cut off) → explicit end + 180s idle timeout + tab-hide teardown (patterns already exist in `use-food-voice-session.ts`).

### VoiceSession API sketch

```ts
type VoiceEngine = "dictate" | "voiceturn" | "live";   // + "cascade" later

interface VoiceSessionInit {
  engine: VoiceEngine;
  surface: "family" | "frontdoor" | "capture" | "draft" | "chat" | "food";
  language: Language;                                   // → es-US/en-US STT, per-language TTS voice
  gateTranscript: (t: string) => VoiceGateResult;       // evaluateVoiceTranscript — mandatory, non-optional
  contextProvider?: () => VoiceContext;                 // generalizes food's injectContext
  grammar?: string[];                                   // chip labels — biases matching, powers mock + PHQ-9 local matching
  onEvent: (e: VoiceSessionEvent) => void;
  passcode?: string;                                    // live tier only
}

interface VoiceSessionHandle extends LiveSessionHandle {
  speak(text: string, opts?: { interruptible: boolean }): Promise<void>;  // T2+
  stopSpeaking(): void;                                 // barge-in / tap-to-silence
  pauseListening(): void; resumeListening(): void;      // consent control
}
```

Lifecycle: first-ever session shows a consent sheet (clone the PHQ-9 consent pattern, `phq9-check-in.tsx:53–72`); persistent listening indicator + earcons on mic open/close; new `voice_session_started` audit action (the 14-value enum at `types.ts:162–176` has no voice action today).

---

## 4. Safety invariants for voice (the contract with crisis:gate)

1. No assistant audio from text that hasn't passed the deterministic gates + grounding verifier; on T2/T4, TTS input is byte-identical to verifier output.
2. Every final user transcript passes `evaluateVoiceTranscript` before any response is requested; absent transcript ⇒ fail closed (watchdog), never fail open.
3. Crisis intercept ⇒ cancel + flush + human-authored crisis copy spoken calmly (warm handoff: same voice, slower pace, validate first — production: pre-recorded per-language audio assets; demo: speechSynthesis of the deterministic copy) within ~500ms of the transcript + on-screen crisis card. Feature output suppressed for the session; new session mints 409 until acknowledgment — and **acknowledgment is tap-only; voice can never dismiss a crisis card.**
4. Write-incapability untouched: voice yields staged drafts. Clinical numbers (`addReading`, `addGlucoseReading`, assessment scores) commit by **tap only**, with digit read-back for out-of-range values ("one-two-zero over eight-zero — tap Save if that's right"). Verbal confirm allowed only for reversible non-clinical actions (`logDose`, onboarding) via **local deterministic grammar** — never the LLM interpreting assent.
5. **PHQ-9/SDOH audio never leaves the device to a non-BAA vendor.** Web Speech is server-backed (Chrome ships audio to Google), so voice assessment answers use local chip-grammar matching only ("several days" / "dos" / "the first one" matched client-side against rendered chip labels); raw audio/transcripts never reach any LLM route. Item-9 interrupt identical to `phq9Item9IsPositive`, spoken or tapped.
6. Every voice path has a tap/type twin and a visible, correctable transcript (WCAG 2.5.6 — voice-first is fine, voice-ONLY is a conformance failure).
7. es parity is structural: gate regexes, voice corpus, ASR locale, TTS voice, crisis audio — all per-language, compile/CI-enforced.
8. A deterministic mock voice engine exists for every surface, with the bypass-closed test pattern (`mock-provider.test.ts:183–184`) applied to each.

**crisis:gate extension:** add a voice corpus lane — every crisis phrase in the corpus gets ASR-degraded variants (punctuation stripped, fillers, number-word forms, homophones, es + code-switched forms) asserted against `evaluateVoiceTranscript` at 100% tier-1 recall; event-ordering contracts per engine (intercept ⇒ no `response.create` / no TTS request / no `assistantTranscript`); gate execution <5ms over the full corpus; plus a **typed-simulation harness** — a dev-only input feeding text through the full VoiceSession pipeline so crisis:gate and e2e exercise voice flows without a mic.

---

## 5. Implemented rollout (software landed; hardware validation pending)

The implementation handoff expanded this sequence to P0–P7. All software phases
landed in `1b17ef0`; the effort estimates below are retained as historical
planning context.

| Phase | Surface | Engine | Effort | Demo win |
|---|---|---|---|---|
| **P0** | Kernel: unify shims → `useDictation`; `VoiceSession` + TTS util + indicator + consent + audit action + `tVoice` strings (en/es); **merge the language toggle** (ab7896b) | — | 2–3d | none (infra) |
| **P1** | **Family interview voice-complete**: speak follow-up questions + chip options aloud; mic on `FamilyFollowUpTurn`; chip labels as recognizer grammar | T2 | 2d | Caregiver completes the whole orientation interview hands-free |
| **P2** | **Front-door voice nav**: spoken echo-confirm before navigation ("Taking you to blood sugar — say no to stop", ~1.5s cancel window); surface the never-used `clarify` variant as a spoken 3-option choice | T1+T2 | 1.5d | "Log my sugar" navigates by voice, confirmably |
| **P2.5** | **Read-aloud**: `<ReadAloud>` on /plan, /visits Health Brief, /learn + per-message speaker button in /chat + family thread. Pre-authored/derived copy only — zero new safety surface | T2 | 1d | Cheapest win in the plan; pull earlier if a demo looms |
| **P3** | **Voice capture** glucose/BP/PHQ-9: number parser ("one twenty over eighty", "ciento veinte sobre ochenta"), zod ranges as plausibility gates, digit read-back, voice-filled form → visual review → tap confirm → dispatch; PHQ-9 per-item read-aloud with 0–3 local chip grammar | T2 | 3–4d | Speak a BP reading end-to-end |
| **P4** | **Talk-to-draft** (plan/brief): split pane — conversation + live `DraftDocument` (a projection/staging layer over intake's existing `addContextItem` → `extractInstructionFacts` → per-fact `confirmFact` pipeline; **no new document store, no new invariant surface**); per-fact provenance to the interview turn (the Abridge pattern); spoken turn summaries; snapshot-per-accepted-turn undo ("undo that"); read-back before commit | T2 (T4 later) | 5–6d | Talk a care plan into existence, watch it build |
| **P5** | **/chat live voice** + output-transcript gating; code default `gpt-realtime-2`, cheaper model by verified env opt-in; real-phone hardware pass remains pending | T3 | 3d + device time | Full-duplex coach |
| **P6** | Verify: check + crisis:gate voice lane + e2e + typed-simulation corpus through every voice path; fix stale `food-lens-demo.md:5–6` "gate deferred" note | — | 1d | — |

Order rationale: family interview first (stated beachhead, ~80% built, keyless). Capture before draft because the number parser and confirm pattern are prerequisites for drafting trust. /chat live voice last — it's the only phase that costs money per minute and needs hardware verification.

---

## 6. Costs (order of magnitude, July 2026 prices)

| Session | Stack | Est. |
|---|---|---|
| P1–P4 surfaces (T1/T2) | Web Speech + speechSynthesis + existing mock/text routes | **~$0** (text tokens only when live) |
| 5-min quick Q&A | realtime-2.1-**mini** | $0.08–0.15 |
| 5-min quick Q&A | realtime-2.1 flagship uncached | $0.90–2.30 ← why a verified mini model remains an opt-in cost lever |
| 12-min interview on T4 cascade | Deepgram Flux + gpt-4o-mini + ElevenLabs Flash | $0.30–0.45 (Cartesia TTS: ~$0.17) |

The tiering **is** the cost control; T3 additionally sits behind `DEMO_PASSCODE`, the crisisOpen 409, and the idle timeout.

---

## 7. Constraints and risks surfaced by research

- **HIPAA/S2S gap:** Azure/OpenAI realtime native audio not explicitly BAA-covered as of these sources → cascade is the compliant default for PHI, not just the safe one. Deepgram/AssemblyAI/ElevenLabs (Zero Retention Mode) all have BAA paths.
- **Web Speech reality:** server-backed (not on-device, not offline), flaky on iOS WebViews, Firefox flagged. Fine as the keyless T1/T2 demo tier; it is **not** the production STT story — that's T4.
- **iOS Safari:** first agent audio must be unlocked by the same tap that starts the session; backgrounding kills capture (tab-hide teardown pattern already exists); phone calls interrupt WebRTC audio without auto-resume.
- **Whisper-family hallucination on silence** (~1.2–1.7% of segments, 40% potentially harmful): never send silence to STT; discard transcripts from sub-threshold audio; distrust long transcripts from short audio.
- **Accent/es disparity:** significantly higher WER for es-accented speech; ElevenLabs Scribe v2 and AssemblyAI Universal-3 Pro currently lead es/en code-switching. Test **es-US dialects (Mexican/Caribbean), not es-ES**, for TTS.
- **Speaker confusion** (child vs caregiver at home): don't trust diarization; ask ("Was that Mateo or you?"); treat multi-voice segments as low-confidence.
- **Barge-in lessons from the field:** users prize being interruptible and not being interrupted; on user speech, hard-reset the turn (pause, flush, re-ask cleanly) rather than resuming mid-sentence.

---

## 8. Decisions for the product owner

1. **Engine strategy** — recommended: three keyless tiers now + realtime-mini for open Q&A, with the cloud cascade (T4) as a planned drop-in upgrade. Alternatives: cascade-first day one (better turn-taking immediately, adds vendors/cost now) or S2S-everywhere (fastest feel, weakest gate posture + HIPAA gap).
2. **Clinical-number commits** — tap-only with digit read-back (recommended) vs verbal-confirm. Tap-only sacrifices full hands-free for the highest-stakes writes.
3. **PHQ-9/SDOH voice posture** — local chip-matching now (recommended) vs excluding assessments from voice entirely until on-device STT is proven.
4. **/food's S2S future** — keep WebRTC with added output-transcript gating (recommended; accepts ~a-sentence escape) vs migrating /food to the cascade too and retiring S2S.
5. **When to sign BAAs / go T4** — trigger on: turn-taking feels sluggish in user hands, real users (not demos), or PHI posture required. Vendor picks staged: Deepgram (STT) + ElevenLabs-ZRM or Cartesia (TTS).

## 9. Closeout evidence

The implementation handoff is `docs/handoffs/12-voice-everywhere.md`. Voice
P0–P7 and the language toggle landed in `1b17ef0`; production `4cbe8c7`
contained that software. The remaining next step is owner-run real-device
validation, followed by the external clinical/legal and BAA decisions required
before production voice handles real PHI.
