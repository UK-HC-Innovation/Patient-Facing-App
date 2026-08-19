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
import { parseFoodOrderIntent } from "@/domain/food-order-intent";
import type { NotScoreableReason } from "@/domain/food-compass";
import type { LiveSessionContext } from "@/ai/types";
import { COMPASS_PAGE_TITLE } from "./title";

const ORDER_EXAMPLE = "I am ordering a pepperoni and sausage pizza from Papa John's";
const TRY_CHIPS = [
  { label: "Papa John's order", query: ORDER_EXAMPLE },
  { label: "pizza", query: "pizza" },
  { label: "Caesar salad", query: "Caesar salad" },
  { label: "latte", query: "latte" }
];
const PROTOTYPE_STEPS = [
  ["1", "Scan or describe"],
  ["2", "Review the score"],
  ["3", "Ask a question"]
] as const;
const LANGUAGE = "en" as const;

type FoodCandidate = { code: string; description: string; fcs: number };
type SortMode = "score" | "density";

type TypedResult =
  | { kind: "match"; match: LiveMatch; candidates: FoodCandidate[]; input: string }
  | { kind: "carve_out"; reason: NotScoreableReason }
  | { kind: "none" };

function sentenceCase(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export default function CompassPage() {
  const camera = useFoodCamera();
  const passcode = useMemo(
    () => (typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("k") ?? undefined),
    []
  );

  // /compass never calls useHealthState. The root layout would hand it a full demo patient
  // with medications and blood-pressure readings, and this page must not carry one.
  const state = useMemo(() => blankCompassState(), []);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [query, setQuery] = useState(ORDER_EXAMPLE);
  const [typed, setTyped] = useState<TypedResult | null>(null);
  const [typedLoading, setTypedLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [cameraExpanded, setCameraExpanded] = useState(true);
  const [voiceExampleActive, setVoiceExampleActive] = useState(false);
  const queryRef = useRef<HTMLTextAreaElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const live = useLiveFoodScore({
    videoRef: camera.videoRef,
    grabFrame: camera.grabFrame,
    cameraActive: camera.status === "active" && cameraExpanded && typed === null,
    barcodeActive: false,
    passcode
  });

  // A typed answer is an explicit request and outranks whatever the camera happens to see.
  const shown = useMemo<TypedResult | null>(() => {
    if (typed) {
      return typed;
    }
    if (live.match) {
      return { kind: "match", match: live.match, candidates: [], input: "" };
    }
    return live.carveOut ? { kind: "carve_out", reason: live.carveOut } : null;
  }, [typed, live.match, live.carveOut]);

  const runQuery = useCallback(
    async (text: string, requestedSort: SortMode = sortMode, foodId?: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        return;
      }
      setTypedLoading(true);
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
        if (json.mode === "carve_out" && json.reason) {
          setTyped({ kind: "carve_out", reason: json.reason });
        } else if (json.mode === "match" && json.match) {
          setTyped({
            kind: "match",
            match: json.match,
            candidates: json.candidates ?? [],
            input: trimmed
          });
        } else {
          setTyped({ kind: "none" });
        }
      } catch {
        setTyped({ kind: "none" });
      } finally {
        setTypedLoading(false);
      }
    },
    [passcode, sortMode]
  );

  // Re-run so the selected, mutually exclusive sort mode updates the visible alternatives.
  const changeSortMode = useCallback(
    (next: SortMode) => {
      if (next === sortMode) {
        return;
      }
      setSortMode(next);
      if (shown?.kind === "match") {
        const input = typed?.kind === "match" ? typed.input : shown.match.food.description;
        void runQuery(input, next, shown.match.food.code);
      }
    },
    [runQuery, shown, sortMode, typed]
  );

  const handleVoiceTranscript = useCallback(
    (role: "patient" | "assistant", text: string) => {
      if (role !== "patient" || !parseFoodOrderIntent(text)) {
        return;
      }
      setVoiceExampleActive(false);
      setQuery(text);
      setTyped(null);
      void runQuery(text);
    },
    [runQuery]
  );

  const getContext = useCallback(
    (): LiveSessionContext => ({
      frameDataUrl: camera.grabFrame(),
      identifiedFood: null,
      flagTexts: [],
      compass:
        shown?.kind === "carve_out"
          ? { kind: "carve_out", reason: shown.reason }
          : shown?.kind === "match"
            ? toCompassContext(shown.match.score, shown.match.alternatives)
            : null
    }),
    [camera, shown]
  );

  const voice = useFoodVoiceSession({
    language: LANGUAGE,
    getState: () => stateRef.current,
    getContext,
    onFinalTranscript: handleVoiceTranscript,
    onSafetyIntercept: () => {},
    // Without this the voice control below can never appear: it renders only when
    // mode === "live", and mode only leaves "unknown" inside start().
    probeOnMount: true,
    buildInstructions: () => buildCompassInstructions(),
    buildContext: (context) =>
      buildCompassVoiceContext(
        context.compass ?? null,
        shown?.kind === "match" ? shown.match.food.description : null,
        shown?.kind === "match" ? shown.match.provenance : undefined
      ),
    tools: [
      {
        ...LOOKUP_FOOD_SCORE_TOOL,
        parameters: LOOKUP_FOOD_SCORE_TOOL.parameters as unknown as Record<string, unknown>,
        handler: async (args) => lookupFoodScore(String(args.query ?? ""), passcode)
      }
    ]
  });

  // In mock or locked mode the on-device coach speaks in a patient-care-plan voice, which is
  // wrong for this surface — so the voice button is hidden rather than mislabelled. Typed
  // scoring and alternatives still work fully, which IS the no-passcode shareable demo.
  const voiceAvailable = voice.mode === "live";
  const voiceCanStart = voice.status === "idle" || voice.status === "closed" || voice.status === "error";
  const handleVoiceAction = () => {
    if (voiceCanStart) {
      void voice.start();
      return;
    }
    voice.stop();
  };
  const correctionCandidates =
    shown?.kind === "match" && shown.match.interpretation
      ? shown.candidates.filter((candidate) => candidate.code !== shown.match.food.code).slice(0, 4)
      : [];

  const resultKey = typed
    ? typed.kind === "match"
      ? `typed:${typed.input}:${typed.match.food.code}`
      : `typed:${typed.kind}`
    : live.match
      ? `live:${live.match.food.code}`
      : live.carveOut
        ? `live:carve-out:${live.carveOut}`
        : null;

  const focusResult = useCallback(() => {
    setCameraExpanded(false);
    window.requestAnimationFrame(() => {
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const focusQuery = useCallback(() => {
    queryRef.current?.focus({ preventScroll: true });
    queryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleCompassPrompt = useCallback(() => {
    if (shown?.kind === "none" || query.trim().length === 0) {
      focusQuery();
      return;
    }
    setVoiceExampleActive(false);
    setTyped(null);
    void runQuery(query);
  }, [focusQuery, query, runQuery, shown?.kind]);

  useEffect(() => {
    if (!resultKey) {
      return;
    }
    focusResult();
  }, [focusResult, resultKey]);

  useEffect(() => {
    void camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) {
        camera.stop();
        voice.stop();
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
    };
  }, [camera, voice]);

  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-4 [&>*]:min-w-0">
      <header className="grid gap-3">
        <h1 className="text-xl font-semibold">{COMPASS_PAGE_TITLE}</h1>
        <p className="text-sm text-ink/65">
          Point the camera at a food, or describe what you are ordering. We match the details to a published Food
          Compass 2.0 category without inventing a brand-specific score.
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
        <div className={cameraExpanded ? "block" : "hidden"}>
          <FoodViewfinder
            cameraStatus={camera.status}
            demoPreview
            idleLabel={shown?.kind === "match" ? "Tap start to ask about this food." : "Tap start and describe your order."}
            language={LANGUAGE}
            onScoreTap={focusResult}
            onVoiceStatusTap={voiceAvailable && voiceCanStart ? handleVoiceAction : undefined}
            scanChip={shown?.kind === "match" ? shown.match.food.description : null}
            scoreBadge={
              !cameraExpanded
                ? "hidden"
                : shown?.kind === "match"
                ? "score"
                : shown?.kind === "carve_out"
                  ? "carve_out"
                  : live.badge
            }
            scoreBand={shown?.kind === "match" ? shown.match.score.band : undefined}
            scoreFcs={shown?.kind === "match" ? shown.match.score.fcs : undefined}
            scoreName={shown?.kind === "match" ? shown.match.food.description : undefined}
            scoreTier={shown?.kind === "match" ? shown.match.score.tier : undefined}
            sessionStatus={voice.status}
            showVoiceStatus={voiceAvailable}
            videoRef={camera.videoRef}
          />
        </div>

        {!cameraExpanded ? (
          <button
            className="flex min-h-20 w-full min-w-0 items-center justify-between gap-4 rounded-control bg-ink px-4 py-3 text-left text-white"
            onClick={() => setCameraExpanded(true)}
            type="button"
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-white/60">Camera collapsed</span>
              <span className="block truncate text-sm font-semibold">
                {shown?.kind === "match" ? shown.match.food.description : "Food camera"}
              </span>
            </span>
            <span className="shrink-0 rounded-control bg-white px-3 py-2 text-sm font-semibold text-ink">Expand camera</span>
          </button>
        ) : shown ? (
          <button
            className="justify-self-end rounded-control border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink/70"
            onClick={focusResult}
            type="button"
          >
            Back to result
          </button>
        ) : null}
      </section>

      <NutritionCompass
        foodName={shown?.kind === "match" ? shown.match.food.description : null}
        onRequestFood={handleCompassPrompt}
        requestLabel={shown?.kind === "none" ? "Try another food name" : query.trim().length > 0 ? "Plot this order" : "Describe a food"}
        score={shown?.kind === "match" ? shown.match.score : null}
        state={
          typedLoading || (!shown && live.badge === "pending")
            ? "pending"
            : shown?.kind === "none"
              ? "no_match"
              : shown?.kind === "carve_out"
                ? "carve_out"
                : "idle"
        }
      />

      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setVoiceExampleActive(false);
          setTyped(null);
          void runQuery(query);
        }}
      >
        <label className="text-sm font-medium text-ink/75" htmlFor="compass-query">
          Describe a food or order
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <textarea
            autoComplete="off"
            className="min-h-20 w-full resize-none rounded-control border border-ink/15 px-3 py-2 text-base text-ink placeholder:text-ink/65"
            id="compass-query"
            onChange={(event) => {
              setVoiceExampleActive(false);
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Describe a food or restaurant order"
            ref={queryRef}
            rows={2}
            value={query}
          />
          <button
            className="min-h-12 rounded-control bg-care px-4 font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/65"
            disabled={typedLoading || query.trim().length === 0}
            type="submit"
          >
            {typedLoading ? "Matching…" : "Find score"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {TRY_CHIPS.map((chip) => (
            <button
              className="rounded-control border border-ink/15 bg-white px-3 py-2 text-sm font-medium"
              key={chip.label}
              onClick={() => {
                setVoiceExampleActive(false);
                setQuery(chip.query);
                setTyped(null);
                void runQuery(chip.query);
              }}
              type="button"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </form>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-care/20 bg-calm/50 p-3" aria-label="Voice example control">
        <div>
          <h2 className="text-sm font-semibold">Voice flow example</h2>
          <p className="text-xs text-ink/70">Canned for this prototype, so developers can see the intended exchange.</p>
        </div>
        <button
          className="rounded-control border border-care bg-white px-3 py-2 text-sm font-semibold text-care disabled:opacity-40"
          disabled={typedLoading && voiceExampleActive}
          onClick={() => {
            setVoiceExampleActive(true);
            setQuery(ORDER_EXAMPLE);
            setTyped(null);
            void runQuery(ORDER_EXAMPLE);
          }}
          type="button"
        >
          {typedLoading && voiceExampleActive ? "Playing example…" : voiceExampleActive ? "Replay voice example" : "Play voice example"}
        </button>
      </section>

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
        <div aria-label="Food result" className="min-w-0 outline-none" ref={resultRef} role="region" tabIndex={-1}>
          {shown.kind === "carve_out" ? <CompassCarveOut language={LANGUAGE} reason={shown.reason} /> : null}

          {shown.kind === "none" ? (
            <p className="rounded-control bg-calm px-3 py-3 text-sm text-ink/70">
              No published score for that one. Try a simpler name, or choose a sample.
            </p>
          ) : null}

          {shown.kind === "match" ? (
            <section className="grid min-w-0 gap-3 rounded-control border border-ink/10 bg-white p-4 shadow-sm [&>*]:min-w-0">
          {voiceExampleActive ? (
            <div aria-label="Canned voice transcript" className="grid gap-2 rounded-control border border-care/20 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-care">Voice example · canned demo</p>
                <FoodGuidanceSource kind="general" />
              </div>
              <p className="rounded-control bg-calm px-3 py-2 text-sm">
                <span className="font-semibold">You:</span> {ORDER_EXAMPLE}.
              </p>
              <p className="rounded-control bg-care/5 px-3 py-2 text-sm">
                <span className="font-semibold">Food Lens:</span> I found the closest published category: {shown.match.food.description}. Its Food
                Compass score is {shown.match.score.fcs} out of 100.
                {shown.match.provenance ? ` ${shown.match.provenance.note}` : ""}
              </p>
            </div>
          ) : null}

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
                        disabled={typedLoading}
                        key={candidate.code}
                        onClick={() => void runQuery(shown.input, undefined, candidate.code)}
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

      {voiceAvailable ? (
        <button
          className="min-h-14 w-full rounded-control border border-care bg-white px-4 py-2 font-semibold text-care"
          onClick={handleVoiceAction}
          type="button"
        >
          {voice.status === "error"
            ? "Try voice again"
            : voiceCanStart
            ? shown?.kind === "match"
              ? `Ask about ${shown.match.food.description}`
              : "Describe an order by voice"
            : "End"}
        </button>
      ) : null}

      {voiceAvailable && voice.error ? (
        <p className="rounded-control border border-pulse/30 bg-pulse/5 px-3 py-2 text-sm text-pulse" role="alert">
          {voice.error} Tap “Try voice again” to retry.
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
