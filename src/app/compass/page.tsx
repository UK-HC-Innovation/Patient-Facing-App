"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FoodViewfinder } from "@/components/food-viewfinder";
import { FoodGuidanceSource } from "@/components/food-guidance-source";
import { CompassAlternatives, CompassCarveOut, CompassScoreRow } from "@/components/compass-score";
import { NutritionCompass } from "@/components/nutrition-compass";
import { useFoodCamera } from "@/hooks/use-food-camera";
import { useLiveFoodScore, type LiveMatch } from "@/hooks/use-live-food-score";
import { useFoodVoiceSession } from "@/hooks/use-food-voice-session";
import {
  LOOKUP_FOOD_SCORE_TOOL,
  buildCompassInstructions,
  buildCompassVoiceContext,
  lookupFoodScore
} from "@/ai/compass-instructions";
import { toCompassContext } from "@/domain/compass-context";
import { blankCompassState } from "@/domain/fixtures";
import {
  foodOrderIntentToLookupText,
  mergePizzaOrderRefinement,
  parseFoodOrderIntent,
  type FoodOrderIntent
} from "@/domain/food-order-intent";
import type { NotScoreableReason } from "@/domain/food-compass";
import type { LiveSessionContext } from "@/ai/types";
import { speak, stopSpeaking } from "@/voice/tts";
import { COMPASS_PAGE_TITLE } from "./title";

const PROTOTYPE_STEPS = [
  ["1", "Point the camera"],
  ["2", "Talk naturally"],
  ["3", "Compare options"]
] as const;
const LANGUAGE = "en" as const;

type FoodCandidate = { code: string; description: string; fcs: number };
type SortMode = "score" | "density";

type ConversationResult =
  | { kind: "match"; match: LiveMatch; candidates: FoodCandidate[]; input: string; cameraFoodCode: string | null }
  | { kind: "carve_out"; reason: NotScoreableReason }
  | { kind: "none" };

type ConversationTurn = {
  id: string;
  role: "patient" | "assistant";
  text: string;
  scripted?: boolean;
};

function sentenceCase(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function scriptedOpening(match: LiveMatch): string {
  if (/\bpizza\b/i.test(match.food.description)) {
    return `I see ${match.food.description}. Do you know which restaurant it came from and what toppings, crust, or size it has?`;
  }
  return `I see ${match.food.description}. Its published Food Compass score is ${match.score.fcs} out of 100. What would you like to know about it?`;
}

export default function CompassPage() {
  const camera = useFoodCamera();
  const { grabFrame, start: startCamera, stop: stopCamera } = camera;
  const passcode = useMemo(
    () => (typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("k") ?? undefined),
    []
  );

  // /compass never calls useHealthState. The root layout would hand it a full demo patient
  // with medications and blood-pressure readings, and this page must not carry one.
  const state = useMemo(() => blankCompassState(), []);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [refinement, setRefinement] = useState<ConversationResult | null>(null);
  const [refinementLoading, setRefinementLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const lastAutoConversationFoodRef = useRef<string | null>(null);
  const shownRef = useRef<ConversationResult | null>(null);
  const voiceResultRef = useRef<ConversationResult | null>(null);
  const pizzaIntentRef = useRef<FoodOrderIntent | null>(null);

  const live = useLiveFoodScore({
    videoRef: camera.videoRef,
    grabFrame: camera.grabFrame,
    cameraActive: camera.status === "active",
    barcodeActive: false,
    passcode
  });

  // A spoken refinement is explicit and outranks the raw camera match until the
  // lens has held on a different food long enough to establish a new scene.
  const shown = useMemo<ConversationResult | null>(() => {
    if (refinement) {
      return refinement;
    }
    if (live.match) {
      return { kind: "match", match: live.match, candidates: [], input: "", cameraFoodCode: live.match.food.code };
    }
    return live.carveOut ? { kind: "carve_out", reason: live.carveOut } : null;
  }, [refinement, live.match, live.carveOut]);
  shownRef.current = shown;

  const runQuery = useCallback(
    async (
      text: string,
      requestedSort: SortMode = sortMode,
      foodId?: string,
      cameraFoodCode: string | null = live.match?.food.code ?? null
    ) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        return null;
      }
      setRefinementLoading(true);
      try {
        const response = await fetch("/api/food/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            ...(foodId ? { foodId } : {}),
            passcode,
            preferHigherScore: requestedSort === "score",
            preferLowerCalorieDensity: requestedSort === "density"
          })
        });
        const json = (await response.json()) as {
          mode: string;
          reason?: NotScoreableReason;
          match?: LiveMatch;
          candidates?: FoodCandidate[];
        };
        let next: ConversationResult;
        if (json.mode === "carve_out" && json.reason) {
          next = { kind: "carve_out", reason: json.reason };
        } else if (json.mode === "match" && json.match) {
          next = {
            kind: "match",
            match: json.match,
            candidates: json.candidates ?? [],
            input: trimmed,
            cameraFoodCode
          };
        } else {
          next = { kind: "none" };
        }
        voiceResultRef.current = next;
        shownRef.current = next;
        setRefinement(next);
        return next;
      } catch {
        const next: ConversationResult = { kind: "none" };
        voiceResultRef.current = next;
        shownRef.current = next;
        setRefinement(next);
        return next;
      } finally {
        setRefinementLoading(false);
      }
    },
    [live.match?.food.code, passcode, sortMode]
  );

  // Re-run so the selected, mutually exclusive sort mode updates the visible alternatives.
  const changeSortMode = useCallback(
    (next: SortMode) => {
      if (next === sortMode) {
        return;
      }
      setSortMode(next);
      if (shown?.kind === "match") {
        const input = refinement?.kind === "match" ? refinement.input : shown.match.food.description;
        const cameraFoodCode =
          refinement?.kind === "match" ? refinement.cameraFoodCode : live.match?.food.code ?? null;
        void runQuery(input, next, shown.match.food.code, cameraFoodCode);
      }
    },
    [live.match?.food.code, refinement, runQuery, shown, sortMode]
  );

  const handleVoiceTranscript = useCallback(
    (role: "patient" | "assistant", text: string) => {
      setConversationTurns((turns) => [
        ...turns.slice(-7),
        { id: crypto.randomUUID(), role, text }
      ]);
    },
    []
  );

  const prepareVoiceResponse = useCallback(
    async (text: string) => {
      const current = voiceResultRef.current ?? shownRef.current;
      const currentFoodName = current?.kind === "match" ? current.match.food.description : "";
      const hasPizzaContext = pizzaIntentRef.current !== null || /\bpizza\b/i.test(currentFoodName);
      const parsed = parseFoodOrderIntent(text);
      const intent = hasPizzaContext
        ? mergePizzaOrderRefinement(text, pizzaIntentRef.current)
        : parsed;
      if (!intent) {
        return;
      }
      if (intent.item === "pizza") {
        pizzaIntentRef.current = intent;
      }
      const cameraFoodCode = current?.kind === "match" ? current.cameraFoodCode : live.match?.food.code ?? null;
      await runQuery(foodOrderIntentToLookupText(intent), sortMode, undefined, cameraFoodCode);
    },
    [live.match?.food.code, runQuery, sortMode]
  );

  const getContext = useCallback(
    (): LiveSessionContext => {
      const current = voiceResultRef.current ?? shownRef.current;
      return {
        // Once conversational details override the raw camera match, avoid pairing
        // a later frame with a restaurant-specific interpretation it may not depict.
        frameDataUrl: voiceResultRef.current ? null : grabFrame(),
        identifiedFood: null,
        flagTexts: [],
        compass:
          current?.kind === "carve_out"
            ? { kind: "carve_out", reason: current.reason }
            : current?.kind === "match"
              ? toCompassContext(current.match.score, current.match.alternatives)
              : null
      };
    },
    [grabFrame]
  );

  const buildVoiceContext = useCallback((context: LiveSessionContext) => {
    const current = voiceResultRef.current ?? shownRef.current;
    return buildCompassVoiceContext(
      context.compass ?? null,
      current?.kind === "match" ? current.match.food.description : null,
      current?.kind === "match" ? current.match.provenance : undefined
    );
  }, []);

  const voice = useFoodVoiceSession({
    language: LANGUAGE,
    getState: () => stateRef.current,
    getContext,
    onFinalTranscript: handleVoiceTranscript,
    beforePatientResponse: prepareVoiceResponse,
    onSafetyIntercept: (intercept) => {
      setConversationTurns((turns) => [
        ...turns.slice(-7),
        { id: crypto.randomUUID(), role: "assistant", text: intercept.content }
      ]);
    },
    // Without this the voice control below can never appear: it renders only when
    // mode === "live", and mode only leaves "unknown" inside start().
    probeOnMount: true,
    buildInstructions: () => buildCompassInstructions(),
    buildContext: buildVoiceContext,
    tools: [
      {
        ...LOOKUP_FOOD_SCORE_TOOL,
        parameters: LOOKUP_FOOD_SCORE_TOOL.parameters as unknown as Record<string, unknown>,
        handler: async (args) => lookupFoodScore(String(args.query ?? ""), passcode)
      }
    ]
  });
  const {
    mode: voiceMode,
    requestContextResponse,
    startWithContextResponse,
    status: voiceStatus,
    stop: stopVoice
  } = voice;

  // In mock or locked mode the patient-oriented local coach is not used on this public surface.
  // A deterministic spoken opening still demonstrates the intended automatic handoff.
  const voiceAvailable = voiceMode === "live";
  const voiceCanStart = voiceStatus === "idle" || voiceStatus === "closed" || voiceStatus === "error";
  const correctionCandidates =
    shown?.kind === "match" && shown.match.interpretation
      ? shown.candidates.filter((candidate) => candidate.code !== shown.match.food.code).slice(0, 4)
      : [];

  const liveFoodCode = live.match?.food.code ?? null;

  useEffect(() => {
    if (!refinement || refinement.kind !== "match" || !refinement.cameraFoodCode || !liveFoodCode) {
      return;
    }
    if (refinement.cameraFoodCode === liveFoodCode) {
      return;
    }
    // Require a different camera match to remain stable before returning control
    // to the lens; a single vision wobble must not erase conversational details.
    const timer = window.setTimeout(() => {
      voiceResultRef.current = null;
      pizzaIntentRef.current = null;
      setRefinement(null);
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [liveFoodCode, refinement]);

  useEffect(() => {
    const match = live.match;
    if (!match || refinement || !liveFoodCode || voiceMode === "unknown") {
      return;
    }
    if (lastAutoConversationFoodRef.current === liveFoodCode) {
      return;
    }

    if (!voiceAvailable) {
      const opening = scriptedOpening(match);
      lastAutoConversationFoodRef.current = liveFoodCode;
      setConversationTurns((turns) => [
        ...turns.slice(-7),
        { id: crypto.randomUUID(), role: "assistant", text: opening, scripted: true }
      ]);
      void speak(opening, { language: LANGUAGE });
      return;
    }

    if (voiceStatus === "connecting" || voiceStatus === "thinking" || voiceStatus === "speaking") {
      return;
    }

    lastAutoConversationFoodRef.current = liveFoodCode;
    if (voiceStatus === "listening") {
      requestContextResponse();
    } else {
      void startWithContextResponse();
    }
  }, [
    live.match,
    liveFoodCode,
    refinement,
    requestContextResponse,
    startWithContextResponse,
    voiceMode,
    voiceStatus,
    voiceAvailable
  ]);

  useEffect(() => {
    void startCamera();
  }, [startCamera]);

  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) {
        stopCamera();
        stopVoice();
        stopSpeaking();
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
    };
  }, [stopCamera, stopVoice]);

  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-4 [&>*]:min-w-0">
      <header className="grid gap-3">
        <h1 className="text-xl font-semibold">{COMPASS_PAGE_TITLE}</h1>
        <p className="text-sm text-ink/65">
          Point the camera at a food and Food Lens starts the conversation. Add restaurant, topping, crust, or size
          details naturally while you talk; the demo never invents a brand-specific score.
        </p>
        <ol aria-label="Prototype flow" className="grid grid-cols-3 gap-2 text-xs font-semibold text-ink/70">
          {PROTOTYPE_STEPS.map(([step, label]) => (
            <li className="rounded-control bg-calm px-2 py-2 text-center" key={step}>
              <span className="mr-1 text-care">{step}</span>
              {label}
            </li>
          ))}
        </ol>
        <FoodGuidanceSource kind="general" />
      </header>

      <section className="grid gap-2" aria-label="Food camera">
        <FoodViewfinder
          cameraStatus={camera.status}
          demoPreview
          idleLabel={
            voice.status === "closed"
              ? "Conversation ended. Restart below or point at a new food."
              : shown?.kind === "match"
                ? voiceAvailable
                  ? "Starting a conversation about this food…"
                  : "Demo conversation started automatically."
                : "Conversation starts when a food is identified."
          }
          language={LANGUAGE}
          scanChip={shown?.kind === "match" ? shown.match.food.description : null}
          scoreBadge={
            shown?.kind === "match" ? "score" : shown?.kind === "carve_out" ? "carve_out" : live.badge
          }
          scoreBand={shown?.kind === "match" ? shown.match.score.band : undefined}
          scoreFcs={shown?.kind === "match" ? shown.match.score.fcs : undefined}
          scoreName={shown?.kind === "match" ? shown.match.food.description : undefined}
          scoreTier={shown?.kind === "match" ? shown.match.score.tier : undefined}
          sessionStatus={voice.status}
          showVoiceStatus
          videoRef={camera.videoRef}
        />
      </section>

      <section
        aria-label="Automatic food conversation"
        className="grid gap-3 rounded-control border border-care/20 bg-calm/40 p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Automatic food conversation</h2>
            <p className="text-xs text-ink/70">
              {voiceAvailable
                ? "No text box: identify the food, then add details or ask questions out loud."
                : "Scripted preview: with live voice connected, the user continues out loud."}
            </p>
          </div>
          <FoodGuidanceSource kind="general" />
        </div>

        <div aria-live="polite" className="grid gap-2" role="log">
          {conversationTurns.length > 0 ? (
            conversationTurns.map((turn) => (
              <article
                className={`rounded-control px-3 py-2 text-sm leading-6 ${
                  turn.role === "assistant" ? "bg-white" : "bg-care/10"
                }`}
                key={turn.id}
              >
                <p>
                  <span className="font-semibold">{turn.role === "assistant" ? "Food Lens" : "You"}:</span>{" "}
                  {turn.text}
                </p>
                {turn.scripted ? (
                  <p className="mt-1 text-[11px] text-ink/70">Scripted fallback for the functional prototype.</p>
                ) : null}
              </article>
            ))
          ) : shown?.kind === "match" ? (
            <p className="rounded-control bg-white px-3 py-2 text-sm text-ink/70">
              Starting a conversation about {shown.match.food.description}…
            </p>
          ) : (
            <p className="rounded-control bg-white px-3 py-2 text-sm text-ink/70">
              Waiting for the camera to identify a food.
            </p>
          )}
          {voice.partialAssistantText ? (
            <article className="rounded-control bg-white px-3 py-2 text-sm leading-6 text-ink/70">
              <p>
                <span className="font-semibold">Food Lens:</span> {voice.partialAssistantText}
              </p>
            </article>
          ) : null}
        </div>

        {voiceAvailable && !voiceCanStart ? (
          <button
            className="min-h-12 rounded-control border border-care bg-white px-4 py-2 font-semibold text-care"
            onClick={voice.stop}
            type="button"
          >
            End conversation
          </button>
        ) : null}
        {voiceAvailable && voice.status === "error" ? (
          <button
            className="min-h-12 rounded-control border border-care bg-white px-4 py-2 font-semibold text-care"
            onClick={() => void voice.startWithContextResponse()}
            type="button"
          >
            Try automatic conversation again
          </button>
        ) : null}
        {voiceAvailable && voice.status === "closed" ? (
          <button
            className="min-h-12 rounded-control border border-care bg-white px-4 py-2 font-semibold text-care"
            onClick={() => void voice.startWithContextResponse()}
            type="button"
          >
            Start conversation again
          </button>
        ) : null}
      </section>

      <NutritionCompass
        foodName={shown?.kind === "match" ? shown.match.food.description : null}
        score={shown?.kind === "match" ? shown.match.score : null}
        state={
          refinementLoading || (!shown && live.badge === "pending")
            ? "pending"
            : shown?.kind === "none"
              ? "no_match"
              : shown?.kind === "carve_out"
                ? "carve_out"
                : "idle"
        }
      />

      <fieldset className="grid gap-2 rounded-control border border-ink/10 p-3">
        <legend className="px-1 text-sm font-medium text-ink/75">Sort better options by</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={sortMode === "score"}
            className="h-5 w-5"
            name="compass-sort"
            onChange={() => changeSortMode("score")}
            type="radio"
          />
          Highest score first
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={sortMode === "density"}
            className="h-5 w-5"
            name="compass-sort"
            onChange={() => changeSortMode("density")}
            type="radio"
          />
          Lowest calorie density first
        </label>
      </fieldset>

      {shown ? (
        <div aria-label="Food result" className="min-w-0" role="region">
          {shown.kind === "carve_out" ? <CompassCarveOut language={LANGUAGE} reason={shown.reason} /> : null}

          {shown.kind === "none" ? (
            <p className="rounded-control bg-calm px-3 py-3 text-sm text-ink/70">
              No published score for that one. Try a simpler name, or choose a sample.
            </p>
          ) : null}

          {shown.kind === "match" ? (
            <section className="grid min-w-0 gap-3 rounded-control border border-ink/10 bg-white p-4 shadow-sm [&>*]:min-w-0">
          <FoodGuidanceSource kind="general" />
          {shown.match.interpretation && shown.match.provenance ? (
            <div aria-label="Order interpretation" className="grid min-w-0 gap-3 rounded-control bg-calm/60 p-3 [&>*]:min-w-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-care">We heard</p>
                <dl className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-sm [&>*]:min-w-0">
                  <div>
                    <dt className="text-xs text-ink/70">Restaurant</dt>
                    <dd className="break-words font-semibold">{shown.match.interpretation.restaurant ?? "Not specified"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink/70">Food</dt>
                    <dd className="break-words font-semibold">{sentenceCase(shown.match.interpretation.item)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink/70">Toppings</dt>
                    <dd className="break-words font-semibold">
                      {shown.match.interpretation.toppings.length > 0
                        ? shown.match.interpretation.toppings.map(sentenceCase).join(", ")
                        : "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink/70">Crust</dt>
                    <dd className="break-words font-semibold">
                      {shown.match.interpretation.crust ? sentenceCase(shown.match.interpretation.crust) : "Not specified"}
                    </dd>
                  </div>
                  {shown.match.interpretation.size ? (
                    <div>
                      <dt className="text-xs text-ink/70">Size</dt>
                      <dd className="break-words font-semibold">{sentenceCase(shown.match.interpretation.size)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="border-t border-care/15 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-care">Closest published match</p>
                <p className="mt-1 text-sm font-semibold">{shown.match.provenance.matchedAs}</p>
                <p className="mt-1 text-xs text-ink/65">{shown.match.provenance.note}</p>
                {shown.match.provenance.unmatchedDetails.length > 0 ? (
                  <p className="mt-1 text-xs text-ink/65">
                    Not represented in this score: {shown.match.provenance.unmatchedDetails.join(", ")}.
                  </p>
                ) : null}
              </div>

              {correctionCandidates.length > 0 ? (
                <div className="border-t border-care/15 pt-3">
                  <p className="text-xs font-semibold text-ink/70">Choose a closer published category</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {correctionCandidates.map((candidate) => (
                      <button
                        className="max-w-full break-words rounded-control border border-care/25 bg-white px-3 py-2 text-left text-xs font-medium text-care disabled:opacity-40"
                        disabled={refinementLoading}
                        key={candidate.code}
                        onClick={() =>
                          void runQuery(shown.input, undefined, candidate.code, shown.cameraFoodCode)
                        }
                        type="button"
                      >
                        {candidate.description} · {candidate.fcs}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <h2 className="text-lg font-semibold">{shown.match.food.description}</h2>
          <CompassScoreRow language={LANGUAGE} score={shown.match.score} />

          {shown.match.nutrients ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ["Calories", shown.match.nutrients.kcal, "per 100 g"],
                  ["Protein", shown.match.nutrients.protein, "g"],
                  ["Fibre", shown.match.nutrients.fiber, "g"],
                  ["Sodium", shown.match.nutrients.na, "mg"],
                  ["Potassium", shown.match.nutrients.k, "mg"],
                  ["Saturated fat", shown.match.nutrients.sfa, "g"]
                ] as const
              )
                .filter(([, value]) => value !== null)
                .map(([label, value, unit]) => (
                  <div className="rounded-control bg-calm/60 px-3 py-2" key={label}>
                    <dt className="text-xs font-medium text-ink/70">{label}</dt>
                    <dd className="font-semibold">
                      {value} {unit}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : (
            // ~1/3 of published foods predate FNDDS 2017-18, so there is no panel to show.
            <p className="text-xs text-ink/70">
              No nutrient panel for this food — its published score comes from an earlier survey cycle.
            </p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-ink/75">
              Better options · {sortMode === "score" ? "highest score first" : "lowest calorie density first"}
            </h3>
            <div className="mt-2">
              <CompassAlternatives
                alternatives={shown.match.alternatives}
                currentFcs={shown.match.score.fcs}
                language={LANGUAGE}
              />
            </div>
          </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {voiceAvailable && voice.error ? (
        <p className="rounded-control border border-pulse/30 bg-pulse/5 px-3 py-2 text-sm text-pulse" role="alert">
          {voice.error}{" "}
          {voice.status === "error"
            ? "Use “Try automatic conversation again” to retry."
            : "You can keep talking or say the details again."}
        </p>
      ) : null}

      <footer className="border-t border-ink/10 pt-3 text-xs text-ink/70">
        <details className="rounded-control border border-ink/10 bg-white p-3">
          <summary className="cursor-pointer font-semibold text-care">How scoring works</summary>
          <div className="mt-2 grid gap-1">
            <p>Scores: Food Compass 2.0 (Tufts University, used with permission)</p>
            <p>
              Methodology:{" "}
              <a className="underline" href="https://arxiv.org/abs/2512.11836" rel="noreferrer noopener" target="_blank">
                arxiv.org/abs/2512.11836
              </a>
            </p>
            <p>AI-assisted identification · Not medical advice — consult your care team.</p>
          </div>
        </details>
      </footer>
    </main>
  );
}
