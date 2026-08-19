"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FoodViewfinder } from "@/components/food-viewfinder";
import { CompassAlternatives, CompassCarveOut, CompassScoreRow } from "@/components/compass-score";
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
import type { NotScoreableReason } from "@/domain/food-compass";
import type { LiveSessionContext } from "@/ai/types";
import { COMPASS_PAGE_TITLE } from "./title";

const TRY_CHIPS = ["pizza", "Caesar salad", "latte", "burger"];
const LANGUAGE = "en" as const;

type TypedResult =
  | { kind: "match"; match: LiveMatch }
  | { kind: "carve_out"; reason: NotScoreableReason }
  | { kind: "none" };

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

  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState<TypedResult | null>(null);
  const [typedLoading, setTypedLoading] = useState(false);
  const [preferHigherScore, setPreferHigherScore] = useState(false);
  const [preferLowerCalorieDensity, setPreferLowerCalorieDensity] = useState(false);

  const live = useLiveFoodScore({
    videoRef: camera.videoRef,
    grabFrame: camera.grabFrame,
    cameraActive: camera.status === "active",
    barcodeActive: false,
    passcode
  });

  // A typed answer is an explicit request and outranks whatever the camera happens to see.
  const shown = useMemo<TypedResult | null>(() => {
    if (typed) {
      return typed;
    }
    if (live.match) {
      return { kind: "match", match: live.match };
    }
    return live.carveOut ? { kind: "carve_out", reason: live.carveOut } : null;
  }, [typed, live.match, live.carveOut]);

  const runQuery = useCallback(
    async (text: string, preferences?: { preferHigherScore: boolean; preferLowerCalorieDensity: boolean }) => {
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
            passcode,
            preferHigherScore: preferences?.preferHigherScore ?? preferHigherScore,
            preferLowerCalorieDensity: preferences?.preferLowerCalorieDensity ?? preferLowerCalorieDensity
          })
        });
        const json = (await response.json()) as {
          mode: string;
          reason?: NotScoreableReason;
          match?: LiveMatch;
        };
        if (json.mode === "carve_out" && json.reason) {
          setTyped({ kind: "carve_out", reason: json.reason });
        } else if (json.mode === "match" && json.match) {
          setTyped({ kind: "match", match: json.match });
        } else {
          setTyped({ kind: "none" });
        }
      } catch {
        setTyped({ kind: "none" });
      } finally {
        setTypedLoading(false);
      }
    },
    [passcode, preferHigherScore, preferLowerCalorieDensity]
  );

  // Re-run so the toggles reorder the alternatives that are already on screen.
  const togglePreference = useCallback(
    (which: "score" | "density") => {
      const next = {
        preferHigherScore: which === "score" ? !preferHigherScore : preferHigherScore,
        preferLowerCalorieDensity: which === "density" ? !preferLowerCalorieDensity : preferLowerCalorieDensity
      };
      setPreferHigherScore(next.preferHigherScore);
      setPreferLowerCalorieDensity(next.preferLowerCalorieDensity);
      const current = typed?.kind === "match" ? typed.match.food.description : null;
      if (current) {
        void runQuery(current, next);
      }
    },
    [preferHigherScore, preferLowerCalorieDensity, runQuery, typed]
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
    onFinalTranscript: () => {},
    onSafetyIntercept: () => {},
    buildInstructions: () => buildCompassInstructions(),
    buildContext: (context) =>
      buildCompassVoiceContext(
        context.compass ?? null,
        shown?.kind === "match" ? shown.match.food.description : null
      ),
    tools: [
      {
        ...LOOKUP_FOOD_SCORE_TOOL,
        parameters: LOOKUP_FOOD_SCORE_TOOL.parameters as unknown as Record<string, unknown>,
        handler: async (args) => lookupFoodScore(String(args.query ?? ""), passcode)
      }
    ]
  });

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

  // In mock or locked mode the on-device coach speaks in a patient-care-plan voice, which is
  // wrong for this surface — so the voice button is hidden rather than mislabelled. Typed
  // scoring and alternatives still work fully, which IS the no-passcode shareable demo.
  const voiceAvailable = voice.mode === "live";

  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-4">
      <header className="grid gap-1">
        <h1 className="text-xl font-semibold">{COMPASS_PAGE_TITLE}</h1>
        <p className="text-sm text-ink/65">
          Point the camera at a food, or type one. Scores are the published Food Compass 2.0 values.
        </p>
      </header>

      <FoodViewfinder
        cameraStatus={camera.status}
        language={LANGUAGE}
        scanChip={shown?.kind === "match" ? shown.match.food.description : null}
        scoreBadge={
          shown?.kind === "match"
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
        videoRef={camera.videoRef}
      />

      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setTyped(null);
          void runQuery(query);
        }}
      >
        <label className="text-sm font-medium text-ink/75" htmlFor="compass-query">
          Type a food
        </label>
        <div className="flex gap-2">
          <input
            autoComplete="off"
            className="min-h-12 flex-1 rounded-control border border-ink/15 px-3 text-base"
            id="compass-query"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="pepperoni pizza"
            value={query}
          />
          <button
            className="min-h-12 rounded-control bg-care px-4 font-semibold text-white disabled:opacity-40"
            disabled={typedLoading || query.trim().length === 0}
            type="submit"
          >
            {typedLoading ? "Scoring…" : "Score it"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {TRY_CHIPS.map((chip) => (
            <button
              className="rounded-control border border-ink/15 bg-white px-3 py-2 text-sm font-medium"
              key={chip}
              onClick={() => {
                setQuery(chip);
                setTyped(null);
                void runQuery(chip);
              }}
              type="button"
            >
              {chip}
            </button>
          ))}
        </div>
      </form>

      <fieldset className="grid gap-2 rounded-control border border-ink/10 p-3">
        <legend className="px-1 text-sm font-medium text-ink/75">Sort better options by</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={preferHigherScore}
            className="h-5 w-5"
            onChange={() => togglePreference("score")}
            type="checkbox"
          />
          Highest score first
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={preferLowerCalorieDensity}
            className="h-5 w-5"
            onChange={() => togglePreference("density")}
            type="checkbox"
          />
          Lowest calorie density first
        </label>
      </fieldset>

      {shown?.kind === "carve_out" ? <CompassCarveOut language={LANGUAGE} reason={shown.reason} /> : null}

      {shown?.kind === "none" ? (
        <p className="rounded-control bg-calm px-3 py-3 text-sm text-ink/70">
          No published score for that one. Try a simpler name, or point the camera at it.
        </p>
      ) : null}

      {shown?.kind === "match" ? (
        <section className="grid gap-3 rounded-control border border-ink/10 bg-white p-4 shadow-sm">
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
                    <dt className="text-xs font-medium text-ink/60">{label}</dt>
                    <dd className="font-semibold">
                      {value} {unit}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : (
            // ~1/3 of published foods predate FNDDS 2017-18, so there is no panel to show.
            <p className="text-xs text-ink/55">
              No nutrient panel for this food — its published score comes from an earlier survey cycle.
            </p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-ink/75">Better options in the same food group</h3>
            <div className="mt-2">
              <CompassAlternatives alternatives={shown.match.alternatives} language={LANGUAGE} />
            </div>
          </div>
        </section>
      ) : null}

      {voiceAvailable ? (
        <button
          className="min-h-14 w-full rounded-control border border-care bg-white px-4 py-2 font-semibold text-care"
          onClick={() => (voice.status === "idle" || voice.status === "closed" ? void voice.start() : voice.stop())}
          type="button"
        >
          {voice.status === "idle" || voice.status === "closed" ? "Talk about this food" : "End"}
        </button>
      ) : null}

      <footer className="grid gap-1 border-t border-ink/10 pt-3 text-xs text-ink/55">
        <p>Scores: Food Compass 2.0 (Tufts University, used with permission)</p>
        <p>
          Methodology:{" "}
          <a className="underline" href="https://arxiv.org/abs/2512.11836" rel="noreferrer noopener" target="_blank">
            arxiv.org/abs/2512.11836
          </a>
        </p>
        <p>AI-assisted identification · Not medical advice — consult your care team.</p>
      </footer>
    </main>
  );
}
