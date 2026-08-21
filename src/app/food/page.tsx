"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { FoodAskBar } from "@/components/food-ask-bar";
import { FoodConversation } from "@/components/food-conversation";
import { FoodFactsCard } from "@/components/food-facts-card";
import { FoodGuidanceSource } from "@/components/food-guidance-source";
import { FoodViewfinder } from "@/components/food-viewfinder";
import { PantryRecipes } from "@/components/pantry-recipes";
import { MealLogList } from "@/components/meal-log-list";
import { createSafeAiResponse } from "@/ai/safety-gate";
import { PantryProvider, PANTRY_REQUEST_TEXT } from "@/ai/pantry-provider";
import { activeConditions, selectLenses } from "@/domain/condition-lens";
import { computeFoodFlags, type FoodFlag } from "@/domain/food-flags";
import { buildMealLogEntry } from "@/domain/meal-log";
import { parsePortionServings, scaleNutrition } from "@/domain/portion";
import { foodLookupResponseSchema, mealLogEntrySchema } from "@/domain/schemas";
import { t } from "@/i18n/strings";
import { useFoodCamera } from "@/hooks/use-food-camera";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { useFoodVoiceSession, type VoiceSafetyIntercept } from "@/hooks/use-food-voice-session";
import { useCompassScore } from "@/hooks/use-compass-score";
import { useLiveFoodScore } from "@/hooks/use-live-food-score";
import { toIdentifiedFood } from "@/domain/food-compass";
import { toCompassContext } from "@/domain/compass-context";
import { useHealthState } from "@/state/store";
import type { AiMessage, IdentifiedFood, PantryResult } from "@/domain/types";
import type { LiveSessionContext } from "@/ai/types";

export default function FoodPage() {
  const { state, dispatch } = useHealthState();
  const language = state.patient.language;
  const lens = useMemo(() => selectLenses(activeConditions(state.carePlan)), [state.carePlan]);
  const foodMessages = useMemo(() => state.aiMessages.filter((message) => message.mode === "food"), [state.aiMessages]);
  const latestPatientUtterance = useMemo(() => {
    for (let index = foodMessages.length - 1; index >= 0; index -= 1) {
      const message = foodMessages[index];
      if (message.role === "patient") {
        return message.content;
      }
    }
    return "";
  }, [foodMessages]);

  const camera = useFoodCamera();
  const passcode = useMemo(
    () => (typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("k") ?? undefined),
    []
  );
  const [barcodeFood, setBarcodeFood] = useState<IdentifiedFood | null>(null);
  const [portionServings, setPortionServings] = useState(1);
  const [logged, setLogged] = useState(false);
  const { activeBarcode } = useBarcodeScan({
    videoRef: camera.videoRef,
    enabled: camera.status === "active",
    onBarcode: () => setLogged(false)
  });

  const live = useLiveFoodScore({
    videoRef: camera.videoRef,
    grabFrame: camera.grabFrame,
    cameraActive: camera.status === "active",
    barcodeActive: activeBarcode !== null,
    passcode
  });

  // A barcode is authoritative while it is on screen; otherwise the live vision match is.
  const identifiedFood = useMemo<IdentifiedFood | null>(() => {
    if (barcodeFood) {
      return barcodeFood;
    }
    return live.match ? toIdentifiedFood({ ...live.match.food, fcs2: live.match.score.fcs, fcs1: 0, nova: 1, hsr: 0, nutriScore: "C", ambiguous: live.match.score.ambiguous }, live.match.nutrients) : null;
  }, [barcodeFood, live.match]);

  const identifiedFoodId = identifiedFood?.id ?? null;
  const scaledFood = useMemo<IdentifiedFood | null>(() => {
    if (!identifiedFood?.nutrition) {
      return identifiedFood;
    }
    return { ...identifiedFood, nutrition: scaleNutrition(identifiedFood.nutrition, portionServings) };
  }, [identifiedFood, portionServings]);

  // Scored from identifiedFood, not scaledFood: scaleNutrition rounds to integers, and a
  // per-100-kcal score recomputed off rounded values would wobble as portions change.
  // The score is a property of the food; the flags are a property of the portion.
  const labelCompass = useCompassScore(barcodeFood, { passcode });
  const compass = useMemo(
    () =>
      live.match && !barcodeFood
        ? {
            score: live.match.score,
            carveOut: null,
            alternatives: live.match.alternatives,
            alternativesLoading: false
          }
        : { ...labelCompass, carveOut: labelCompass.carveOut ?? live.carveOut },
    [barcodeFood, labelCompass, live.carveOut, live.match]
  );
  const compassRef = useRef(compass);
  compassRef.current = compass;

  const flags = useMemo<FoodFlag[]>(
    () => computeFoodFlags(scaledFood, lens, { medications: state.medications, readings: state.readings }, language),
    [scaledFood, lens, state.medications, state.readings, language]
  );

  const foodRef = useRef<IdentifiedFood | null>(null);
  foodRef.current = scaledFood;
  const flagsRef = useRef<FoodFlag[]>([]);
  flagsRef.current = flags;
  const lastAssistantRef = useRef<string | null>(null);
  const lastPortionFoodIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const getContext = useCallback((): LiveSessionContext => {
    const current = compassRef.current;
    return {
      frameDataUrl: camera.grabFrame(),
      identifiedFood: foodRef.current,
      flagTexts: flagsRef.current.map((flag) => flag.text),
      compass: current.carveOut
        ? { kind: "carve_out", reason: current.carveOut }
        : toCompassContext(current.score, current.alternatives)
    };
  }, [camera]);

  const appendMessage = useCallback(
    (role: "patient" | "assistant", content: string) => {
      if (role === "assistant") {
        lastAssistantRef.current = content;
      }
      const message: AiMessage = {
        id: crypto.randomUUID(),
        mode: "food",
        role,
        content,
        createdAt: new Date().toISOString(),
        safety: "allowed",
        sources: role === "assistant" ? [stateRef.current.carePlan.id] : []
      };
      dispatch({ type: "addAiMessage", message });
    },
    [dispatch]
  );

  const appendIntercept = useCallback(
    (intercept: VoiceSafetyIntercept) => {
      const message: AiMessage = {
        id: crypto.randomUUID(),
        mode: "food",
        role: "assistant",
        content: intercept.content,
        createdAt: new Date().toISOString(),
        safety: intercept.safety,
        sources: [],
        banner: intercept.banner,
        actions: intercept.actions
      };
      dispatch({ type: "addAiMessage", message });
    },
    [dispatch]
  );

  const voice = useFoodVoiceSession({
    language,
    getState: () => stateRef.current,
    getContext,
    onFinalTranscript: appendMessage,
    onSafetyIntercept: appendIntercept
  });

  const [pantryResult, setPantryResult] = useState<PantryResult | null>(null);
  const [pantryLoading, setPantryLoading] = useState(false);

  const findPantryRecipes = useCallback(async () => {
    if (pantryLoading) {
      return;
    }
    setPantryLoading(true);
    setPantryResult(null);
    const passcode =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("k") ?? undefined : undefined;
    const image = camera.grabFrame() ?? undefined;
    try {
      // Same safety gate as every other AI answer: crisis + reading escalation run
      // on the synthetic pantry utterance, and grounding runs on the recipe summary.
      const response = await createSafeAiResponse(
        { mode: "food", patientInput: PANTRY_REQUEST_TEXT, state: stateRef.current, image },
        new PantryProvider({ passcode })
      );
      if (response.recipes && response.recipes.length > 0) {
        setPantryResult({ detectedItems: response.detectedItems ?? [], recipes: response.recipes });
      } else if (response.safety !== "allowed") {
        appendIntercept({
          safety: response.safety,
          content: response.content,
          banner: response.banner,
          actions: response.actions ?? []
        });
      } else {
        appendMessage("assistant", response.content);
      }
    } finally {
      setPantryLoading(false);
    }
  }, [appendIntercept, appendMessage, camera, pantryLoading]);

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

  useEffect(() => {
    let cancelled = false;
    if (!activeBarcode) {
      // Only the barcode's own identification is cleared here. A vision match lives in
      // the live-score hook, which owns preemption and the 60 s restore window.
      setBarcodeFood(null);
      return;
    }
    void fetch(`/api/food/lookup?barcode=${activeBarcode}`)
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) {
          return;
        }
        const parsed = foodLookupResponseSchema.safeParse(json);
        setBarcodeFood(parsed.success && parsed.data.found ? parsed.data.food : null);
        setLogged(false);
      })
      .catch(() => {
        if (!cancelled) {
          setBarcodeFood(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeBarcode]);

  useEffect(() => {
    if (!identifiedFoodId) {
      lastPortionFoodIdRef.current = null;
      setPortionServings(1);
      return;
    }
    const parsedPortion = parsePortionServings(latestPatientUtterance, language);
    if (parsedPortion !== null) {
      setPortionServings(parsedPortion);
      setLogged(false);
      lastPortionFoodIdRef.current = identifiedFoodId;
      return;
    }
    if (lastPortionFoodIdRef.current !== identifiedFoodId) {
      setPortionServings(1);
      setLogged(false);
      lastPortionFoodIdRef.current = identifiedFoodId;
    }
  }, [identifiedFoodId, language, latestPatientUtterance]);

  const handlePortionChange = useCallback((servings: number) => {
    setPortionServings(servings);
    setLogged(false);
  }, []);

  const canLog = scaledFood !== null || lastAssistantRef.current !== null;

  const onLog = useCallback(() => {
    const scored = compassRef.current.score;
    const entry = buildMealLogEntry({
      patientId: stateRef.current.patient.id,
      food: foodRef.current,
      flags: flagsRef.current,
      lastAssistantText: lastAssistantRef.current,
      language,
      servings: portionServings,
      compassScore: scored ? { fcs: scored.fcs, band: scored.band, tier: scored.tier } : null
    });
    const parsed = mealLogEntrySchema.safeParse(entry);
    if (!parsed.success) {
      return;
    }
    dispatch({ type: "addMealLogEntry", entry });
    setLogged(true);
  }, [dispatch, language, portionServings]);

  // The barcode's own score is computed locally, so the badge reflects it directly rather
  // than waiting for the vision loop that stood down while the barcode is on screen.
  const badgeState = barcodeFood
    ? compass.carveOut
      ? ("carve_out" as const)
      : compass.score
        ? ("score" as const)
        : ("idle" as const)
    : live.badge;

  const recentMeals = state.mealLog.slice(-5).reverse();
  const scanChip = identifiedFood ? (identifiedFood.brand ? `${identifiedFood.brand} ${identifiedFood.name}` : identifiedFood.name) : activeBarcode;

  return (
    <AppShell title={t(language, "pageTitle")}>
      <div className="grid gap-4">
        <FoodViewfinder
          videoRef={camera.videoRef}
          cameraStatus={camera.status}
          sessionStatus={voice.status}
          idleLabel={identifiedFood ? undefined : t(language, "statusIdleNoFood")}
          onVoiceStatusTap={voice.status === "idle" || voice.status === "closed" ? () => void voice.start() : undefined}
          scanChip={scanChip}
          language={language}
          scoreBadge={badgeState}
          scoreBand={compass.score?.band}
          scoreFcs={compass.score?.fcs}
          scoreName={identifiedFood?.name}
          scoreTier={compass.score?.tier}
        />

        {voice.error ? (
          <div className="grid gap-2 rounded-control border border-pulse/30 bg-pulse/5 p-3">
            <p className="text-sm text-pulse">{voice.error}</p>
            <div className="flex gap-2">
              <button className="rounded-control border border-care px-3 py-2 text-sm font-semibold text-care" onClick={() => void voice.start()} type="button">
                {t(language, "retry")}
              </button>
            </div>
          </div>
        ) : null}

        <FoodGuidanceSource kind="personalized" language={language} />

        <FoodAskBar
          mode={voice.mode}
          dataMode={voice.dataMode}
          status={voice.status}
          onStart={() => void voice.start()}
          onStop={voice.stop}
          onSendText={voice.sendUserText}
          language={language}
        />

        <button
          className="min-h-14 w-full rounded-control border border-care bg-white px-4 py-2 font-semibold text-care disabled:opacity-40"
          onClick={() => void findPantryRecipes()}
          disabled={pantryLoading || camera.status !== "active"}
          type="button"
        >
          {pantryLoading ? t(language, "pantryScanning") : t(language, "pantryButton")}
        </button>

        {pantryResult ? (
          <PantryRecipes detectedItems={pantryResult.detectedItems} recipes={pantryResult.recipes} language={language} />
        ) : null}

        {scaledFood || flags.length > 0 ? (
          <FoodFactsCard
            compassAlternatives={compass.alternatives}
            compassCarveOut={compass.carveOut}
            compassScore={compass.score}
            food={scaledFood}
            flags={flags}
            logged={logged}
            canLog={canLog}
            onLog={onLog}
            language={language}
            portionServings={portionServings}
            onPortionChange={handlePortionChange}
          />
        ) : null}

        <FoodConversation
          messages={foodMessages}
          partialAssistantText={voice.partialAssistantText}
          language={language}
          clinic={{ name: state.patient.primaryClinicName, phone: state.patient.primaryClinicPhone }}
        />

        <MealLogList
          entries={recentMeals}
          language={language}
          onAmendTime={(entryId, loggedAt) => dispatch({ type: "amendMealLogTime", entryId, loggedAt })}
          onDelete={(entryId) => dispatch({ type: "deleteMealLogEntry", entryId })}
        />
      </div>
    </AppShell>
  );
}
