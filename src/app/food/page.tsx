"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/app-shell";
import { AiDataDisclosure } from "@/components/ai-data-disclosure";
import { FoodSavedPicks } from "@/components/food-saved-picks";
import { FoodGuidanceSource } from "@/components/food-guidance-source";
import type { LabelFallbackState } from "@/components/food-label-fallback";
import { FoodViewfinder } from "@/components/food-viewfinder";
import { FOOD_LENS_CAPABILITIES } from "@/components/food-lens-shell";
import {
  FoodLensExperience,
  sharedViewfinderProps,
  type FoodLensView
} from "@/components/food-lens-experience";
import { FoodLensVoiceBar } from "@/components/food-lens-voice-bar";
import { FoodAttribution, FoodCrisisLock } from "@/components/food-lens-blocks";
import {
  FoodActionsBlock,
  FoodCorrectionChips,
  FoodFavoriteButton,
  FoodFlagsBlock,
  FoodHistoryBlock,
  FoodNutrientsBlock,
  FoodTotalsBlock,
  foodTitle
} from "@/components/food-facts-card";
import { CompassAlternatives, resolveDomainBreakdown } from "@/components/compass-score";
import { NutritionCompass } from "@/components/nutrition-compass";
import { hasUnacknowledgedCrisis } from "@/state/selectors";
import { createSafeAiResponse } from "@/ai/safety-gate";
import { PantryProvider, PANTRY_REQUEST_TEXT } from "@/ai/pantry-provider";
import { activeConditions, selectLenses } from "@/domain/condition-lens";
import { formatDayTotalsContext, selectFoodLensDayTotals, summarizeDayTotals } from "@/domain/day-totals";
import { computeFoodFlags, type FoodFlag } from "@/domain/food-flags";
import { foodHistoryVoiceLine, lastTimeYouAte } from "@/domain/glucose-correlation";
import { buildMealLogEntry } from "@/domain/meal-log";
import { buildPlateEntries, formatPlateContext, summarizePlate, type PlateItem } from "@/domain/plate";
import { recentFoodPicks } from "@/domain/food-recents";
import { resolvePortionServings, scaleNutrition } from "@/domain/portion";
import { foodLookupResponseSchema, mealLogEntrySchema } from "@/domain/schemas";
import { t } from "@/i18n/strings";
import { useFoodLensEngine } from "@/hooks/use-food-lens-engine";
import { usePageHideTeardown } from "@/hooks/use-page-hide-teardown";
import { useWhyScore } from "@/hooks/use-why-score";
import { useFoodVoiceSession, type VoiceSafetyIntercept } from "@/hooks/use-food-voice-session";
import { useCompassScore } from "@/hooks/use-compass-score";
import type { LiveCandidate, LiveMatch } from "@/hooks/use-live-food-score";
import { toIdentifiedFood } from "@/domain/food-compass";
import { toCompassContext } from "@/domain/compass-context";
import { useHealthState } from "@/state/store";
import type { AiMessage, IdentifiedFood, PantryResult } from "@/domain/types";
import type { LiveSessionContext } from "@/ai/types";
import type { SpokenFoodSize } from "@/domain/food-order-intent";

// These below-the-fold/after-action surfaces do not belong in the camera-first
// critical bundle and load as independent client chunks.
const PantryRecipes = dynamic(
  () => import("@/components/pantry-recipes").then((module) => module.PantryRecipes),
  { ssr: false }
);
const FoodLabelFallback = dynamic(
  () => import("@/components/food-label-fallback").then((module) => module.FoodLabelFallback),
  { ssr: false }
);
const FoodConversation = dynamic(
  () => import("@/components/food-conversation").then((module) => module.FoodConversation),
  { ssr: false }
);
const MealLogList = dynamic(
  () => import("@/components/meal-log-list").then((module) => module.MealLogList),
  { ssr: false }
);
const PlateCard = dynamic(
  () => import("@/components/plate-card").then((module) => module.PlateCard),
  { ssr: false }
);

export default function FoodPage() {
  const { state, dispatch } = useHealthState();
  const language = state.patient.language;
  const conditions = useMemo(() => activeConditions(state.carePlan), [state.carePlan]);
  const lens = useMemo(() => selectLenses(conditions), [conditions]);
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

  const crisisOpen = useMemo(() => hasUnacknowledgedCrisis(state), [state]);

  const [barcodeFood, setBarcodeFood] = useState<IdentifiedFood | null>(null);
  const [labelFood, setLabelFood] = useState<IdentifiedFood | null>(null);
  const [barcodeLookupMiss, setBarcodeLookupMiss] = useState(false);
  const [labelFallbackState, setLabelFallbackState] = useState<LabelFallbackState>("idle");
  const [portionServings, setPortionServings] = useState(1);
  const [spokenSize, setSpokenSize] = useState<SpokenFoodSize | null>(null);
  const [plateItems, setPlateItems] = useState<PlateItem[]>([]);
  const [logged, setLogged] = useState(false);
  const loggedEntryIdRef = useRef<string | null>(null);
  const exactFoodRequestRef = useRef(0);
  const labelRequestRef = useRef(0);
  const labelReadingRef = useRef(false);
  const { camera, live, passcode, activeBarcode, cameraBlocked } = useFoodLensEngine({
    crisis: crisisOpen,
    barcode: { onDetect: () => setLogged(false) }
  });
  const adoptLiveMatch = live.adoptMatch;
  const rearmLiveScore = live.rearm;

  const scannedFood = barcodeFood ?? labelFood;

  // A barcode or its one-shot label transcription is authoritative while it is
  // on screen; otherwise the live vision match is.
  const identifiedFood = useMemo<IdentifiedFood | null>(() => {
    if (scannedFood) {
      return scannedFood;
    }
    return live.match ? toIdentifiedFood({ ...live.match.food, fcs2: live.match.score.fcs, fcs1: 0, nova: 1, hsr: 0, nutriScore: "C", ambiguous: live.match.score.ambiguous }, live.match.nutrients) : null;
  }, [live.match, scannedFood]);

  const identifiedFoodId = identifiedFood?.id ?? null;
  const { whyOpen, open: openWhyScore, close: closeWhyScore, markerRef } = useWhyScore(identifiedFoodId);
  const scaledFood = useMemo<IdentifiedFood | null>(() => {
    if (!identifiedFood?.nutrition) {
      return identifiedFood;
    }
    return { ...identifiedFood, nutrition: scaleNutrition(identifiedFood.nutrition, portionServings) };
  }, [identifiedFood, portionServings]);
  const priorMealLog = useMemo(() => {
    const currentEntryId = logged ? loggedEntryIdRef.current : null;
    return currentEntryId ? state.mealLog.filter((entry) => entry.id !== currentEntryId) : state.mealLog;
  }, [logged, state.mealLog]);
  const dayTotals = useMemo(() => summarizeDayTotals(state.mealLog, lens, new Date()), [lens, state.mealLog]);
  const flagDayTotals = useMemo(() => summarizeDayTotals(priorMealLog, lens, new Date()), [lens, priorMealLog]);
  const visibleDayTotals = useMemo(() => selectFoodLensDayTotals(dayTotals, conditions), [conditions, dayTotals]);
  // A slot with nothing to show renders nothing: three bars reading 0% before anything has
  // been eaten today is a heading with an empty body, which is exactly what the shell bans.
  const startedEatingToday = visibleDayTotals.some((total) => total.total > 0);
  const dayTotalsLine = formatDayTotalsContext(visibleDayTotals) ?? undefined;

  // Scored from identifiedFood, not scaledFood: scaleNutrition rounds to integers, and a
  // per-100-kcal score recomputed off rounded values would wobble as portions change.
  // The score is a property of the food; the flags are a property of the portion.
  const labelCompass = useCompassScore(scannedFood, { passcode });
  const compass = useMemo(
    () =>
      live.match && !scannedFood
        ? {
            score: live.match.score,
            carveOut: null,
            alternatives: live.match.alternatives,
            estimatedDomains: live.match.estimatedDomains ?? null,
            alternativesLoading: false
          }
        : { ...labelCompass, carveOut: labelCompass.carveOut ?? live.carveOut, estimatedDomains: null },
    [labelCompass, live.carveOut, live.match, scannedFood]
  );
  const compassRef = useRef(compass);
  compassRef.current = compass;

  const flags = useMemo<FoodFlag[]>(
    () =>
      computeFoodFlags(
        scaledFood,
        lens,
        { medications: state.medications, readings: state.readings },
        language,
        flagDayTotals
      ),
    [scaledFood, lens, state.medications, state.readings, language, flagDayTotals]
  );
  const plateSummary = useMemo(() => summarizePlate(plateItems), [plateItems]);
  const plateFlags = useMemo(
    () =>
      computeFoodFlags(
        plateSummary.flagsFood,
        lens,
        { medications: state.medications, readings: state.readings },
        language,
        dayTotals
      ),
    [dayTotals, language, lens, plateSummary.flagsFood, state.medications, state.readings]
  );
  const plateLine = useMemo(() => formatPlateContext(plateItems, plateSummary) ?? undefined, [plateItems, plateSummary]);
  const foodHistory = useMemo(() => {
    if (!identifiedFoodId) {
      return null;
    }
    return lastTimeYouAte(
      identifiedFoodId,
      priorMealLog,
      state.glucoseReadings
    );
  }, [identifiedFoodId, priorMealLog, state.glucoseReadings]);
  const historyDate = useMemo(() => {
    if (!foodHistory) {
      return null;
    }
    return new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
      month: "short",
      day: "numeric"
    }).format(new Date(foodHistory.loggedAt));
  }, [foodHistory, language]);
  const historyLine = foodHistory && historyDate ? foodHistoryVoiceLine(foodHistory, historyDate) : undefined;

  const foodRef = useRef<IdentifiedFood | null>(null);
  foodRef.current = scaledFood;
  const flagsRef = useRef<FoodFlag[]>([]);
  flagsRef.current = flags;
  const historyLineRef = useRef<string | undefined>(undefined);
  historyLineRef.current = historyLine;
  const dayTotalsLineRef = useRef<string | undefined>(undefined);
  dayTotalsLineRef.current = dayTotalsLine;
  const plateLineRef = useRef<string | undefined>(undefined);
  plateLineRef.current = plateLine;
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
      historyLine: historyLineRef.current,
      dayTotalsLine: dayTotalsLineRef.current,
      plateLine: plateLineRef.current,
      compass: current.carveOut
        ? { kind: "carve_out", reason: current.carveOut }
        : toCompassContext(current.score, current.alternatives, current.estimatedDomains)
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
    onSafetyIntercept: appendIntercept,
    probeOnMount: true
  });

  const [pantryResult, setPantryResult] = useState<PantryResult | null>(null);
  const [pantryLoading, setPantryLoading] = useState(false);

  const findPantryRecipes = useCallback(async () => {
    if (pantryLoading) {
      return;
    }
    setPantryLoading(true);
    setPantryResult(null);
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
  }, [appendIntercept, appendMessage, camera, passcode, pantryLoading]);

  usePageHideTeardown([camera.stop, voice.stop]);

  useEffect(() => {
    let cancelled = false;
    labelRequestRef.current += 1;
    labelReadingRef.current = false;
    setLabelFood(null);
    setBarcodeLookupMiss(false);
    setLabelFallbackState("idle");
    if (!activeBarcode) {
      // Only the barcode's own identification is cleared here. A vision match lives in
      // the live-score hook, which owns preemption and the 60 s restore window.
      setBarcodeFood(null);
      return;
    }
    setBarcodeFood(null);
    void fetch(`/api/food/lookup?barcode=${activeBarcode}`)
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) {
          return;
        }
        const parsed = foodLookupResponseSchema.safeParse(json);
        if (parsed.success && parsed.data.found) {
          setBarcodeFood(parsed.data.food);
          setBarcodeLookupMiss(false);
        } else {
          setBarcodeFood(null);
          // Only a validated `{ found:false }` may unlock the label-photo path.
          setBarcodeLookupMiss(parsed.success && !parsed.data.found);
        }
        setLogged(false);
      })
      .catch(() => {
        if (!cancelled) {
          setBarcodeFood(null);
          setBarcodeLookupMiss(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeBarcode]);

  const readLabelPhoto = useCallback(async () => {
    if (!activeBarcode || labelFallbackState !== "idle" || labelReadingRef.current) {
      return;
    }
    labelReadingRef.current = true;
    const requestId = ++labelRequestRef.current;
    setLabelFallbackState("reading");
    let result: Awaited<ReturnType<typeof import("@/ai/label-extraction")["extractNutritionLabel"]>>;
    try {
      // The transcription schema and provider are label-only; load them after the
      // explicit action so the camera-first /food bundle stays inside its budget.
      const { extractNutritionLabel } = await import("@/ai/label-extraction");
      result = await extractNutritionLabel({
        image: camera.grabFrame(),
        barcode: activeBarcode,
        patientId: stateRef.current.patient.id,
        language,
        passcode
      });
    } catch {
      if (requestId === labelRequestRef.current) {
        labelReadingRef.current = false;
        setLabelFallbackState("error");
      }
      return;
    }
    if (requestId !== labelRequestRef.current) {
      return;
    }
    labelReadingRef.current = false;
    if (!result.ok) {
      setLabelFallbackState("error");
      return;
    }
    setLabelFood(result.food);
    setBarcodeLookupMiss(false);
    setLogged(false);
  }, [activeBarcode, camera, labelFallbackState, language, passcode]);

  useEffect(() => {
    if (!identifiedFoodId) {
      lastPortionFoodIdRef.current = null;
      setPortionServings(1);
      setSpokenSize(null);
      return;
    }
    const resolvedPortion = resolvePortionServings(latestPatientUtterance, language);
    if (resolvedPortion !== null) {
      setPortionServings(resolvedPortion.servings);
      setSpokenSize(resolvedPortion.spokenSize);
      setLogged(false);
      lastPortionFoodIdRef.current = identifiedFoodId;
      return;
    }
    if (lastPortionFoodIdRef.current !== identifiedFoodId) {
      setPortionServings(1);
      setSpokenSize(null);
      setLogged(false);
      lastPortionFoodIdRef.current = identifiedFoodId;
    }
  }, [identifiedFoodId, language, latestPatientUtterance]);

  const handlePortionChange = useCallback((servings: number) => {
    setPortionServings(servings);
    setSpokenSize(null);
    setLogged(false);
  }, []);

  const correctCameraMatch = useCallback(
    async (foodId: string) => {
      const requestId = ++exactFoodRequestRef.current;
      try {
        const response = await fetch("/api/food/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foodId, passcode })
        });
        const json = (await response.json()) as {
          mode: string;
          match?: Omit<LiveMatch, "candidates">;
          candidates?: LiveCandidate[];
        };
        if (requestId === exactFoodRequestRef.current && json.mode === "match" && json.match) {
          adoptLiveMatch({ ...json.match, candidates: json.candidates ?? [] });
          // A saved-food tap is an explicit choice and temporarily wins over a
          // barcode that happens to remain in frame, just like a correction chip.
          setBarcodeFood(null);
          setLabelFood(null);
          setBarcodeLookupMiss(false);
          setLogged(false);
        }
      } catch {
        // Keep the current, still-grounded match when a deterministic correction request fails.
      }
    },
    [adoptLiveMatch, passcode]
  );

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
    loggedEntryIdRef.current = entry.id;
    setLogged(true);
  }, [dispatch, language, portionServings]);

  const onAddToPlate = useCallback(() => {
    if (!identifiedFood) {
      return;
    }
    const score = compassRef.current.score;
    setPlateItems((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        food: identifiedFood,
        servings: portionServings,
        compassScore: score ? { fcs: score.fcs, band: score.band, tier: score.tier } : null
      }
    ]);
    rearmLiveScore();
    setBarcodeFood(null);
    setLabelFood(null);
    setBarcodeLookupMiss(false);
    setPortionServings(1);
    setSpokenSize(null);
    setLogged(false);
    lastPortionFoodIdRef.current = null;
  }, [identifiedFood, portionServings, rearmLiveScore]);

  const changePlateServings = useCallback((index: number, servings: number) => {
    setPlateItems((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, servings } : item))
    );
  }, []);

  const removePlateItem = useCallback((index: number) => {
    setPlateItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const logPlate = useCallback(() => {
    if (plateItems.length === 0) {
      return;
    }
    const currentState = stateRef.current;
    const entries = buildPlateEntries({
      items: plateItems,
      patientId: currentState.patient.id,
      language,
      lastAssistantText: lastAssistantRef.current,
      flagsForFood: (food) =>
        computeFoodFlags(
          food,
          lens,
          { medications: currentState.medications, readings: currentState.readings },
          language,
          dayTotals
        )
    });
    const parsed = entries.map((entry) => mealLogEntrySchema.safeParse(entry));
    if (parsed.some((result) => !result.success)) {
      return;
    }
    for (const entry of entries) {
      dispatch({ type: "addMealLogEntry", entry });
    }
    setPlateItems([]);
    setLogged(false);
  }, [dayTotals, dispatch, language, lens, plateItems]);

  // Barcode and label-photo scores are computed locally, so the badge reflects
  // them directly while the vision loop stands down for the active barcode.
  const badgeState = scannedFood
    ? compass.carveOut
      ? ("carve_out" as const)
      : compass.score
        ? ("score" as const)
        : ("idle" as const)
    : live.badge;
  const labelProviderKnown = voice.dataMode === "live_voice" || live.liveIdentifySucceeded;
  const showLabelFallback =
    activeBarcode !== null &&
    barcodeLookupMiss &&
    (labelProviderKnown || labelFallbackState !== "idle");

  const recentMeals = state.mealLog.slice(-5).reverse();
  const savedRecents = useMemo(() => recentFoodPicks(state.mealLog), [state.mealLog]);
  const favoriteFoodCandidate =
    compass.score?.tier === "T1" && identifiedFood?.source === "fndds_lookup"
      ? identifiedFood.id.replace(/^fndds:/, "")
      : null;
  const favoriteFoodId = favoriteFoodCandidate && /^\d{8}$/.test(favoriteFoodCandidate) ? favoriteFoodCandidate : null;
  const isFavorite = favoriteFoodId
    ? state.foodFavorites.some((favorite) => favorite.foodId === favoriteFoodId)
    : false;
  const toggleFavorite = useCallback(() => {
    const score = compassRef.current.score;
    const food = foodRef.current;
    if (!favoriteFoodId || !food || score?.tier !== "T1") {
      return;
    }
    dispatch({
      type: "toggleFoodFavorite",
      favorite: {
        foodId: favoriteFoodId,
        description: food.brand ? `${food.brand} ${food.name}` : food.name,
        fcs: score.fcs,
        band: score.band,
        starredAt: new Date().toISOString()
      }
    });
  }, [dispatch, favoriteFoodId]);
  const scanChip = identifiedFood ? (identifiedFood.brand ? `${identifiedFood.brand} ${identifiedFood.name}` : identifiedFood.name) : activeBarcode;

  const domainBreakdown = resolveDomainBreakdown(compass.score, compass.estimatedDomains);
  const correctionCandidates = !scannedFood ? live.match?.candidates ?? [] : [];
  const showGeneralGuidance = compass.score !== null || compass.carveOut !== null;
  const savedPicks = (
    <FoodSavedPicks
      favorites={state.foodFavorites}
      recents={savedRecents}
      language={language}
      onSelect={(foodId) => void correctCameraMatch(foodId)}
    />
  );

  const lastAssistantTurn = useMemo(() => {
    for (let index = foodMessages.length - 1; index >= 0; index -= 1) {
      if (foodMessages[index].role === "assistant") {
        return foodMessages[index].content;
      }
    }
    return null;
  }, [foodMessages]);

  // Everything the shared layer is allowed to know: what the food is, never which of the
  // barcode, the label photo, a correction chip or the vision loop won the right to say so.
  // That precedence, and the 60-second pin it runs on, stay inside this door.
  const view: FoodLensView = {
    name: scanChip,
    identified: identifiedFood !== null,
    score: compass.score,
    carveOut: compass.carveOut,
    badge: badgeState,
    noMatchCandidates: live.noMatchCandidates,
    noMatch: false
  };

  const conversation = (
    <FoodConversation
      clinic={{ name: state.patient.primaryClinicName, phone: state.patient.primaryClinicPhone }}
      language={language}
      messages={foodMessages}
      partialAssistantText={voice.partialAssistantText}
    />
  );

  return (
    <FoodLensExperience
      capabilities={FOOD_LENS_CAPABILITIES}
      collapsedViewfinder={cameraBlocked}
      crisis={
        crisisOpen ? (
          <FoodCrisisLock language={language}>
            <FoodConversation
              clinic={{ name: state.patient.primaryClinicName, phone: state.patient.primaryClinicPhone }}
              language={language}
              messages={foodMessages}
              partialAssistantText=""
            />
          </FoodCrisisLock>
        ) : null
      }
      emptyStateChildren={savedPicks}
      language={language}
      loopState={live.loopState}
      onSelectCandidate={(foodId) => void correctCameraMatch(foodId)}
      onVisibleRatio={live.setVisibleRatio}
      view={view}
      viewfinder={
        <FoodViewfinder
          {...sharedViewfinderProps({ camera, view, language, sessionStatus: voice.status })}
          idleLabel={identifiedFood ? undefined : t(language, "statusIdleNoFood")}
          onCameraRetry={() => void camera.start()}
          onScoreTap={badgeState === "scan_again" ? live.rearm : undefined}
          // The chip beside it already carries the brand, so the badge names the food alone.
          scoreName={identifiedFood?.name}
          trustPill={<FoodGuidanceSource kind="personalized" language={language} />}
        />
      }
      voiceBar={
        <FoodLensVoiceBar
          idleLabel={identifiedFood ? undefined : t(language, "statusIdleNoFood")}
          keyboardPrimary={cameraBlocked}
          language={language}
          lastTurn={voice.partialAssistantText || lastAssistantTurn}
          mode={voice.mode}
          onSendText={voice.sendUserText}
          onStart={() => void voice.start()}
          onStop={voice.stop}
          status={voice.status}
          transcript={conversation}
          typedInput={FOOD_LENS_CAPABILITIES.typedInput}
        />
      }
      voiceBarOffsetPx={72}
      whyScore={{
        open: whyOpen,
        onClose: closeWhyScore,
        breakdown: domainBreakdown,
        tier: compass.score?.tier ?? "T1"
      }}
      wrapper={(children) => <AppShell title={t(language, "pageTitle")}>{children}</AppShell>}
      slots={{
        plate: (
          <PlateCard
            flags={plateFlags}
            items={plateItems}
            language={language}
            onLog={logPlate}
            onRemove={removePlateItem}
            onServingsChange={changePlateServings}
            summary={plateSummary}
          />
        ),
        chart:
          compass.score && !compass.carveOut ? (
            <NutritionCompass
              foodName={identifiedFood?.name ?? null}
              language={language}
              markerRef={markerRef}
              onMarkerTap={domainBreakdown ? openWhyScore : undefined}
              score={compass.score}
            />
          ) : null,
        weHeard:
          identifiedFood?.source === "fndds_lookup" && correctionCandidates.length > 0 ? (
            <FoodCorrectionChips
              candidates={correctionCandidates}
              language={language}
              onCorrection={(foodId) => void correctCameraMatch(foodId)}
            />
          ) : null,
        flags: <FoodFlagsBlock flags={flags} language={language} />,
        totals: (
          <>
            {foodHistory && historyDate ? (
              <FoodHistoryBlock
                history={{ ...foodHistory, date: historyDate }}
                language={language}
                showGlucoseHistory={conditions.includes("diabetes")}
              />
            ) : null}
            <FoodTotalsBlock dayTotals={startedEatingToday ? visibleDayTotals : []} language={language} />
          </>
        ),
        nutrients: scaledFood?.nutrition ? (
          <FoodNutrientsBlock
            food={scaledFood}
            language={language}
            onPortionChange={handlePortionChange}
            portionServings={portionServings}
            spokenSize={spokenSize}
          />
        ) : null,
        // Held back until the published list has actually arrived: an empty
        // CompassAlternatives says "already one of the best", which is not true yet.
        alternatives:
          compass.score && !compass.alternativesLoading ? (
            <section data-testid="food-alternatives">
              <h3 className="text-sm font-semibold text-ink/75">{t(language, "compassBetterOptions")}</h3>
              <div className="mt-2">
                <CompassAlternatives
                  alternatives={compass.alternatives}
                  currentFcs={compass.score.fcs}
                  language={language}
                />
              </div>
            </section>
          ) : null,
        actions: (
          <FoodActionsBlock
            canLog={canLog}
            language={language}
            logLabelKey={compass.carveOut ? "logItAnyway" : "logThis"}
            logged={logged}
            onAddToPlate={identifiedFood ? onAddToPlate : undefined}
            onLog={onLog}
          >
            {favoriteFoodId && compass.score?.tier === "T1" ? (
              <FoodFavoriteButton
                favorite={isFavorite}
                language={language}
                onToggle={toggleFavorite}
                title={foodTitle(identifiedFood, language)}
              />
            ) : null}

            {voice.error ? (
              <div className="grid gap-2 rounded-control border border-pulse/30 bg-pulse/5 p-3">
                <p className="text-sm text-pulse">{t(language, "voiceErrorLine")}</p>
                <button
                  className="min-h-11 rounded-control border border-care px-3 py-2 text-sm font-semibold text-care"
                  onClick={() => void voice.start()}
                  type="button"
                >
                  {t(language, "retry")}
                </button>
              </div>
            ) : null}

            {showLabelFallback ? (
              <FoodLabelFallback language={language} onRead={() => void readLabelPhoto()} state={labelFallbackState} />
            ) : null}

            {identifiedFood ? savedPicks : null}

            <button
              className="min-h-14 w-full rounded-control border border-care bg-white px-4 py-2 font-semibold text-care disabled:opacity-40"
              disabled={pantryLoading || camera.status !== "active"}
              onClick={() => void findPantryRecipes()}
              type="button"
            >
              {pantryLoading ? t(language, "pantryScanning") : t(language, "pantryButton")}
            </button>

            {pantryResult ? (
              <PantryRecipes
                detectedItems={pantryResult.detectedItems}
                language={language}
                recipes={pantryResult.recipes}
              />
            ) : null}

            <MealLogList
              entries={recentMeals}
              language={language}
              onAmendTime={(entryId, loggedAt) => dispatch({ type: "amendMealLogTime", entryId, loggedAt })}
              onDelete={(entryId) => dispatch({ type: "deleteMealLogEntry", entryId })}
            />
          </FoodActionsBlock>
        ),
        attribution: (
          <FoodAttribution language={language}>
            {showGeneralGuidance ? <FoodGuidanceSource kind="general" language={language} /> : null}
            <AiDataDisclosure compact language={language} mode={voice.dataMode} />
          </FoodAttribution>
        )
      }}
    />
  );
}
