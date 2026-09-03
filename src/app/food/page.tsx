"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/app-shell";
import { FoodViewfinder } from "@/components/food-viewfinder";
import { FOOD_LENS_CAPABILITIES } from "@/components/food-lens-shell";
import {
  FoodLensExperience,
  sharedViewfinderProps,
  type FoodLensView
} from "@/components/food-lens-experience";
import { FoodLensVoiceBar } from "@/components/food-lens-voice-bar";
import { FoodAttribution, FoodCrisisLock } from "@/components/food-lens-blocks";
import type { PlateScanOutcome } from "@/components/plate-scan-button";
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
import { hasUnacknowledgedCrisis } from "@/state/selectors";
import { activeConditions, selectLenses } from "@/domain/condition-lens";
import { formatDayTotalsContext, selectFoodLensDayTotals, summarizeDayTotals } from "@/domain/day-totals";
import { computeFoodFlags, type FoodFlag } from "@/domain/food-flags";
import { foodHistoryVoiceLine, lastTimeYouAte } from "@/domain/glucose-correlation";
import { buildMealLogEntry } from "@/domain/meal-log";
import { buildPlateEntries, formatPlateContext, summarizePlate, type PlateItem } from "@/domain/plate";
import { plateRefineQuestion } from "@/domain/plate-refine";
import { withPlateServings, type PlateCandidate, type PlateResponse } from "@/domain/plate-scan";
import { recentFoodPicks } from "@/domain/food-recents";
import { resolvePortionServings, scaleNutrition } from "@/domain/portion";
import { mealLogEntrySchema } from "@/domain/schemas";
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

const PACKAGE_SCAN_CLOUD_ENABLED = process.env.NEXT_PUBLIC_FOOD_PACKAGE_SCAN === "1";

type FoodResolutionSnapshot = {
  active: boolean;
  resolvedFood: IdentifiedFood | null;
  barcode: string | null;
};

const EMPTY_FOOD_RESOLUTION_SNAPSHOT: FoodResolutionSnapshot = {
  active: false,
  resolvedFood: null,
  barcode: null
};
const EMPTY_PLATE_SCAN_OUTCOME: PlateScanOutcome = { notice: null, skipped: [], unmatched: [] };

// These below-the-fold/after-action surfaces do not belong in the camera-first
// critical bundle and load as independent client chunks.
const PantryRecipes = dynamic(
  () => import("@/components/pantry-recipes").then((module) => module.PantryRecipes),
  { ssr: false }
);
const FoodSavedPicks = dynamic(
  () => import("@/components/food-saved-picks").then((module) => module.FoodSavedPicks),
  { ssr: false }
);
const PlateScanButton = dynamic(
  () => import("@/components/plate-scan-button").then((module) => module.PlateScanButton),
  { ssr: false }
);
const AiDataDisclosure = dynamic(
  () => import("@/components/ai-data-disclosure").then((module) => module.AiDataDisclosure),
  { ssr: false }
);
const FoodGuidanceSource = dynamic(
  () => import("@/components/food-guidance-source").then((module) => module.FoodGuidanceSource),
  { ssr: false }
);
const FoodBarcodeReviewBridge = dynamic(
  () => import("@/components/food-barcode-review-bridge").then((module) => module.FoodBarcodeReviewBridge),
  { ssr: false }
);
const FoodPackageScanBridge = PACKAGE_SCAN_CLOUD_ENABLED
  ? dynamic(
      () => import("@/components/food-package-scan-bridge").then((module) => module.FoodPackageScanBridge),
      { ssr: false }
    )
  : null;
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

  const [portionServings, setPortionServings] = useState(1);
  const [spokenSize, setSpokenSize] = useState<SpokenFoodSize | null>(null);
  const [plateItems, setPlateItems] = useState<PlateItem[]>([]);
  const [plateCandidates, setPlateCandidates] = useState<Record<string, PlateCandidate[]>>({});
  const [plateScanBusy, setPlateScanBusy] = useState(false);
  const [plateScanOutcome, setPlateScanOutcome] = useState<PlateScanOutcome | null>(null);
  const [logged, setLogged] = useState(false);
  const loggedEntryIdRef = useRef<string | null>(null);
  const plateScanRequestRef = useRef(0);
  const plateScanAbortRef = useRef<{ controller: AbortController; epoch: number } | null>(null);
  const plateChoiceAbortRef = useRef<{ controller: AbortController; epoch: number } | null>(null);
  const exactFoodRequestRef = useRef(0);
  const exactFoodAbortRef = useRef<{ controller: AbortController; epoch: number } | null>(null);
  const [barcodeReviewCode, setBarcodeReviewCode] = useState<string | null>(null);
  const [foodResolutionState, setFoodResolutionState] = useState<FoodResolutionSnapshot>(
    EMPTY_FOOD_RESOLUTION_SNAPSHOT
  );
  const foodResolutionCancelRef = useRef<(() => void) | null>(null);
  const {
    camera,
    live,
    passcode,
    activeBarcode,
    cameraBlocked,
    authority,
    scan,
    scanPending,
    clearBarcode
  } = useFoodLensEngine({
    crisis: crisisOpen,
    barcode: {
      onDetect: (barcode) => {
        setLogged(false);
        if (!PACKAGE_SCAN_CLOUD_ENABLED) {
          setBarcodeReviewCode(barcode);
          setFoodResolutionState({ active: true, resolvedFood: null, barcode });
        }
      }
    }
  });
  const adoptLiveMatch = live.adoptMatch;
  const rearmLiveScore = live.rearm;
  const suspendLiveScore = live.suspend;
  const updateFoodResolutionState = useCallback((next: FoodResolutionSnapshot) => {
    setFoodResolutionState(next);
  }, []);
  const updateFoodResolutionCancel = useCallback((cancel: (() => void) | null) => {
    foodResolutionCancelRef.current = cancel;
  }, []);
  const dismissBarcodeReview = useCallback(() => {
    foodResolutionCancelRef.current = null;
    clearBarcode();
    setBarcodeReviewCode(null);
    setFoodResolutionState(EMPTY_FOOD_RESOLUTION_SNAPSHOT);
  }, [clearBarcode]);
  const cancelFoodResolution = useCallback(() => {
    const cancel = foodResolutionCancelRef.current;
    if (cancel) {
      cancel();
    } else if (!PACKAGE_SCAN_CLOUD_ENABLED) {
      dismissBarcodeReview();
      rearmLiveScore();
    }
  }, [dismissBarcodeReview, rearmLiveScore]);
  const foodResolutionActive = foodResolutionState.active;
  const scannedFood = foodResolutionState.resolvedFood;
  const foodResolutionActiveRef = useRef(foodResolutionActive);
  foodResolutionActiveRef.current = foodResolutionActive;
  const packageDraftOpen = foodResolutionActive && scannedFood === null;
  const liveSceneUnconfirmed = live.candidate !== null || live.packageDetected || live.noMatch;
  const plateScanBlocked = foodResolutionActive || live.packageDetected || live.candidate !== null;

  // A barcode or its one-shot label transcription is authoritative while it is
  // on screen; otherwise the live vision match is.
  const identifiedFood = useMemo<IdentifiedFood | null>(() => {
    if (scannedFood) {
      return scannedFood;
    }
    if (packageDraftOpen || liveSceneUnconfirmed) {
      return null;
    }
    return live.match ? toIdentifiedFood({ ...live.match.food, fcs2: live.match.score.fcs, fcs1: 0, nova: 1, hsr: 0, nutriScore: "C", ambiguous: live.match.score.ambiguous }, live.match.nutrients) : null;
  }, [live.match, liveSceneUnconfirmed, packageDraftOpen, scannedFood]);

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
  // One question per scan, on the item where the answer moves the most calories. Two chips
  // under one plate item is a refinement; five is an interrogation.
  const plateRefine = useMemo(() => {
    let best: { itemId: string; question: ReturnType<typeof plateRefineQuestion>; calories: number } | null = null;
    for (const item of plateItems) {
      const rows = item.id ? plateCandidates[item.id] : undefined;
      if (!item.id || !rows) {
        continue;
      }
      const question = plateRefineQuestion(item.food.name, rows);
      if (!question) {
        continue;
      }
      const calories = (item.food.nutrition?.calories ?? 0) * item.servings;
      if (!best || calories > best.calories) {
        best = { itemId: item.id, question, calories };
      }
    }
    return best?.question ? { itemId: best.itemId, question: best.question } : null;
  }, [plateCandidates, plateItems]);
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
      frameDataUrl: null,
      identifiedFood: foodRef.current,
      flagTexts: flagsRef.current.map((flag) => flag.text),
      historyLine: historyLineRef.current,
      dayTotalsLine: dayTotalsLineRef.current,
      plateLine: plateLineRef.current,
      compass: current.carveOut
        ? { kind: "carve_out", reason: current.carveOut }
        : toCompassContext(current.score, current.alternatives, current.estimatedDomains)
    };
  }, []);

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
      const [{ createSafeAiResponse }, { PantryProvider, PANTRY_REQUEST_TEXT }] = await Promise.all([
        import("@/ai/safety-gate"),
        import("@/ai/pantry-provider")
      ]);
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

  usePageHideTeardown([
    camera.stop,
    voice.stop,
    () => {
      exactFoodAbortRef.current?.controller.abort();
      exactFoodAbortRef.current = null;
      cancelFoodResolution();
      live.suspend();
    }
  ]);

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

  const resolveCameraMatch = useCallback(
    async (foodId: string, pin: boolean) => {
      if (foodResolutionActive) {
        cancelFoodResolution();
      }
      exactFoodAbortRef.current?.controller.abort();
      const requestId = ++exactFoodRequestRef.current;
      const requestEpoch = authority.invalidate();
      const controller = new AbortController();
      exactFoodAbortRef.current = { controller, epoch: requestEpoch };
      try {
        const response = await fetch("/api/food/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foodId, passcode }),
          signal: controller.signal
        });
        const json = (await response.json()) as {
          mode: string;
          match?: Omit<LiveMatch, "candidates">;
          candidates?: LiveCandidate[];
        };
        if (
          requestId === exactFoodRequestRef.current &&
          !controller.signal.aborted &&
          authority.isCurrent(requestEpoch) &&
          json.mode === "match" &&
          json.match
        ) {
          adoptLiveMatch({ ...json.match, candidates: json.candidates ?? [] }, { pin });
          setLogged(false);
        }
      } catch {
        // Keep the current, still-grounded match when a deterministic correction request fails.
      } finally {
        if (exactFoodAbortRef.current?.controller === controller) {
          exactFoodAbortRef.current = null;
        }
      }
    },
    [adoptLiveMatch, authority, cancelFoodResolution, foodResolutionActive, passcode]
  );

  const correctCameraMatch = useCallback(
    (foodId: string) => resolveCameraMatch(foodId, true),
    [resolveCameraMatch]
  );

  const confirmCameraCandidate = useCallback(
    (foodId: string) => {
      if (live.candidate?.food.code !== foodId) return Promise.resolve();
      return resolveCameraMatch(foodId, false);
    },
    [live.candidate?.food.code, resolveCameraMatch]
  );

  const rejectCameraCandidate = useCallback(() => {
    exactFoodAbortRef.current?.controller.abort();
    exactFoodAbortRef.current = null;
    rearmLiveScore();
  }, [rearmLiveScore]);

  useEffect(() => {
    const pending = exactFoodAbortRef.current;
    if (pending && !authority.isCurrent(pending.epoch)) {
      pending.controller.abort();
      exactFoodAbortRef.current = null;
    }
  }, [authority.epoch, authority]);

  useEffect(() => () => exactFoodAbortRef.current?.controller.abort(), []);

  useEffect(() => {
    for (const pending of [plateScanAbortRef.current, plateChoiceAbortRef.current]) {
      if (pending && !authority.isCurrent(pending.epoch)) pending.controller.abort();
    }
    if (plateScanAbortRef.current && !authority.isCurrent(plateScanAbortRef.current.epoch)) {
      plateScanAbortRef.current = null;
      setPlateScanBusy(false);
    }
    if (plateChoiceAbortRef.current && !authority.isCurrent(plateChoiceAbortRef.current.epoch)) {
      plateChoiceAbortRef.current = null;
    }
  }, [authority.epoch, authority]);

  useEffect(() => {
    if (!foodResolutionActive) return;
    plateScanRequestRef.current += 1;
    plateScanAbortRef.current?.controller.abort();
    plateScanAbortRef.current = null;
    plateChoiceAbortRef.current?.controller.abort();
    plateChoiceAbortRef.current = null;
    setPlateScanBusy(false);
    setPlateScanOutcome(null);
  }, [foodResolutionActive]);

  useEffect(() => () => {
    plateScanAbortRef.current?.controller.abort();
    plateChoiceAbortRef.current?.controller.abort();
  }, []);

  const canLog =
    !packageDraftOpen &&
    !liveSceneUnconfirmed &&
    (scaledFood !== null || lastAssistantRef.current !== null);

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
    if (foodResolutionActive) {
      cancelFoodResolution();
    } else {
      rearmLiveScore();
    }
    setPortionServings(1);
    setSpokenSize(null);
    setLogged(false);
    lastPortionFoodIdRef.current = null;
  }, [cancelFoodResolution, foodResolutionActive, identifiedFood, portionServings, rearmLiveScore]);

  const changePlateServings = useCallback((index: number, servings: number) => {
    setPlateItems((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? withPlateServings(item, servings) : item))
    );
  }, []);

  const removePlateItem = useCallback(
    (index: number) => {
      const removedId = plateItems[index]?.id;
      setPlateItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
      if (removedId) {
        setPlateCandidates((current) => {
          const next = { ...current };
          delete next[removedId];
          return next;
        });
      }
    },
    [plateItems]
  );

  /**
   * One photo, up to five scored plate items. Every number still comes from the ledger row
   * each name resolved to; the model contributed the names and a rough mass, nothing else.
   */
  const scanPlate = useCallback(async () => {
    if (plateScanBusy || plateScanBlocked) {
      return;
    }
    const image = camera.grabFrame();
    if (!image) {
      setPlateScanOutcome({ ...EMPTY_PLATE_SCAN_OUTCOME, notice: "plateScanFailed" });
      return;
    }
    const requestId = ++plateScanRequestRef.current;
    suspendLiveScore();
    const requestEpoch = authority.snapshot();
    const controller = new AbortController();
    plateScanAbortRef.current?.controller.abort();
    plateScanAbortRef.current = { controller, epoch: requestEpoch };
    setPlateScanBusy(true);
    setPlateScanOutcome(null);
    try {
      const response = await fetch("/api/food/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, passcode, patientId: stateRef.current.patient.id }),
        signal: controller.signal
      });
      const json = (await response.json()) as PlateResponse;
      if (
        requestId !== plateScanRequestRef.current ||
        controller.signal.aborted ||
        !authority.isCurrent(requestEpoch) ||
        foodResolutionActiveRef.current
      ) {
        return;
      }
      if (json.mode === "unconfigured" || json.mode === "locked") {
        setPlateScanOutcome({ ...EMPTY_PLATE_SCAN_OUTCOME, notice: "plateScanUnavailable" });
        return;
      }
      if (json.mode !== "plate") {
        setPlateScanOutcome({
          ...EMPTY_PLATE_SCAN_OUTCOME,
          notice: json.mode === "none" ? "plateScanEmpty" : "plateScanFailed"
        });
        return;
      }
      const outcome: PlateScanOutcome = { notice: null, skipped: [], unmatched: [] };
      for (const item of json.items) {
        if (item.kind === "carve_out") {
          outcome.skipped.push(item.name);
          continue;
        }
        if (item.kind === "none") {
          if (item.candidates.length === 0) {
            outcome.skipped.push(item.name);
          } else {
            outcome.unmatched.push({
              id: `${item.name}-${outcome.unmatched.length}`,
              name: item.name,
              candidates: item.candidates
            });
          }
          continue;
        }
        // Image matches are review candidates. The route may resolve a ledger row, but its
        // score stays hidden until the patient explicitly chooses that named row.
        outcome.unmatched.push({
          id: crypto.randomUUID(),
          name: item.match.food.description,
          candidates: item.candidates,
          proposedServings: item.proposedServings,
          basis: item.basis
        });
      }
      const foundNothing = outcome.skipped.length === 0 && outcome.unmatched.length === 0;
      setPlateScanOutcome(foundNothing ? { ...outcome, notice: "plateScanEmpty" } : outcome);
    } catch {
      if (
        requestId === plateScanRequestRef.current &&
        !controller.signal.aborted &&
        authority.isCurrent(requestEpoch) &&
        !foodResolutionActiveRef.current
      ) {
        setPlateScanOutcome({ ...EMPTY_PLATE_SCAN_OUTCOME, notice: "plateScanFailed" });
      }
    } finally {
      if (plateScanAbortRef.current?.controller === controller) plateScanAbortRef.current = null;
      if (requestId === plateScanRequestRef.current && authority.isCurrent(requestEpoch)) {
        setPlateScanBusy(false);
        if (!foodResolutionActiveRef.current) rearmLiveScore();
      }
    }
  }, [authority, camera, passcode, plateScanBlocked, plateScanBusy, rearmLiveScore, suspendLiveScore]);

  const fetchExactMatch = useCallback(
    async (foodId: string, signal?: AbortSignal): Promise<Omit<LiveMatch, "candidates"> | null> => {
      try {
        const response = await fetch("/api/food/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foodId, passcode }),
          signal
        });
        const json = (await response.json()) as { mode: string; match?: Omit<LiveMatch, "candidates"> };
        return json.mode === "match" && json.match ? json.match : null;
      } catch {
        // Keep whatever is already on screen: it is still grounded.
        return null;
      }
    },
    [passcode]
  );

  /** The `page.tsx:124` transform, per item: FcsFood needs the filler fields to typecheck. */
  const scoredFromMatch = useCallback(
    (match: Omit<LiveMatch, "candidates">): Pick<PlateItem, "food" | "compassScore"> => ({
      food: toIdentifiedFood(
        {
          ...match.food,
          fcs2: match.score.fcs,
          fcs1: 0,
          nova: 1,
          hsr: 0,
          nutriScore: "C",
          ambiguous: match.score.ambiguous
        },
        match.nutrients
      ),
      compassScore: { fcs: match.score.fcs, band: match.score.band, tier: match.score.tier }
    }),
    []
  );

  /**
   * A swap chip on a scanned item. Deterministic re-score, zero model spend -- and
   * deliberately not `adoptMatch`: pinning here would silence the camera for 60 seconds.
   */
  const correctPlateItem = useCallback(
    async (itemId: string, foodId: string) => {
      if (foodResolutionActiveRef.current) return;
      suspendLiveScore();
      const requestEpoch = authority.snapshot();
      const controller = new AbortController();
      // Shared with addPlateItemByFoodId on purpose: one plate choice may be in flight at a
      // time, so two quick taps cannot land in the order their responses happen to return.
      plateChoiceAbortRef.current?.controller.abort();
      plateChoiceAbortRef.current = { controller, epoch: requestEpoch };
      try {
        const match = await fetchExactMatch(foodId, controller.signal);
        if (
          !match ||
          controller.signal.aborted ||
          !authority.isCurrent(requestEpoch) ||
          foodResolutionActiveRef.current
        ) {
          return;
        }
        const scored = scoredFromMatch(match);
        setPlateItems((items) => items.map((item) => (item.id === itemId ? { ...item, ...scored } : item)));
        setPlateCandidates((current) => {
          const next = { ...current };
          delete next[itemId];
          return next;
        });
        setLogged(false);
      } finally {
        if (plateChoiceAbortRef.current?.controller === controller) plateChoiceAbortRef.current = null;
        if (authority.isCurrent(requestEpoch) && !foodResolutionActiveRef.current) rearmLiveScore();
      }
    },
    [authority, fetchExactMatch, rearmLiveScore, scoredFromMatch, suspendLiveScore]
  );

  /** An unmatched scan name resolved by chip: the row lands as a fresh plate item. */
  const addPlateItemByFoodId = useCallback(
    async (reviewId: string, foodId: string) => {
      if (foodResolutionActiveRef.current) return;
      const pending = plateScanOutcome?.unmatched.find((item) => item.id === reviewId);
      if (!pending) return;
      suspendLiveScore();
      const requestEpoch = authority.snapshot();
      const controller = new AbortController();
      plateChoiceAbortRef.current?.controller.abort();
      plateChoiceAbortRef.current = { controller, epoch: requestEpoch };
      try {
        const match = await fetchExactMatch(foodId, controller.signal);
        if (
          !match ||
          controller.signal.aborted ||
          !authority.isCurrent(requestEpoch) ||
          foodResolutionActiveRef.current
        ) {
          return;
        }
        const itemId = crypto.randomUUID();
        setPlateItems((items) => [
          ...items,
          {
            id: itemId,
            servings: pending.proposedServings ?? 1,
            portion: { origin: "vision", basis: pending.basis ?? null },
            ...scoredFromMatch(match)
          }
        ]);
        setPlateCandidates((current) => ({ ...current, [itemId]: pending.candidates }));
        setPlateScanOutcome((current) =>
          current ? { ...current, unmatched: current.unmatched.filter((item) => item.id !== reviewId) } : current
        );
        setLogged(false);
      } finally {
        if (plateChoiceAbortRef.current?.controller === controller) plateChoiceAbortRef.current = null;
        if (authority.isCurrent(requestEpoch) && !foodResolutionActiveRef.current) rearmLiveScore();
      }
    },
    [authority, fetchExactMatch, plateScanOutcome, rearmLiveScore, scoredFromMatch, suspendLiveScore]
  );

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
    setPlateCandidates({});
    setPlateScanOutcome(null);
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
  const pinnedBarcode = foodResolutionState.barcode;
  const scanChip = identifiedFood
    ? identifiedFood.brand
      ? `${identifiedFood.brand} ${identifiedFood.name}`
      : identifiedFood.name
    : pinnedBarcode ?? activeBarcode;

  const domainBreakdown = resolveDomainBreakdown(compass.score, compass.estimatedDomains);
  const correctionCandidates = !scannedFood ? live.match?.candidates ?? [] : [];
  const packageProvenance = scannedFood
    ? t(language, "packageConfirmed", {
        food: [scannedFood.brand, scannedFood.name].filter(Boolean).join(" ")
      })
    : null;
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
    name: scanChip ?? live.candidate?.food.description ?? null,
    identified: identifiedFood !== null,
    score: compass.score,
    carveOut: compass.carveOut,
    badge: badgeState,
    noMatchCandidates: live.noMatchCandidates,
    noMatch: live.noMatch,
    candidate: identifiedFood ? null : live.candidate,
    packageDetected: identifiedFood === null && live.packageDetected
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
      chart={{
        markerRef,
        onMarkerTap: domainBreakdown ? openWhyScore : undefined
      }}
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
      onConfirmIdentity={(foodId) => void confirmCameraCandidate(foodId)}
      onRejectIdentity={rejectCameraCandidate}
      onSelectCandidate={(foodId) => void correctCameraMatch(foodId)}
      onVisibleRatio={live.setVisibleRatio}
      view={view}
      viewfinder={
        <FoodViewfinder
          {...sharedViewfinderProps({ camera, view, language, sessionStatus: voice.status })}
          idleLabel={identifiedFood ? undefined : t(language, "statusIdleNoFood")}
          onCameraRetry={() => void camera.start()}
          hasScanResult={Boolean(identifiedFood || live.candidate || live.noMatch || live.packageDetected)}
          onScan={() => void scan()}
          scanDisabled={foodResolutionActive || live.candidate !== null || live.packageDetected}
          scanError={live.scanError}
          scanPending={scanPending}
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
      wrapper={(children) => (
        <AppShell brand="one-good-choice" title={t(language, "pageTitle")}>
          {children}
        </AppShell>
      )}
      slots={{
        plate: (
          <PlateCard
            candidates={plateCandidates}
            flags={plateFlags}
            items={plateItems}
            language={language}
            onLog={logPlate}
            onRemove={removePlateItem}
            onSelectCandidate={(itemId, foodId) => void correctPlateItem(itemId, foodId)}
            onServingsChange={changePlateServings}
            refine={plateRefine}
            summary={plateSummary}
          />
        ),
        weHeard:
          packageProvenance || (identifiedFood?.source === "fndds_lookup" && correctionCandidates.length > 0) ? (
            <div className="grid gap-2">
              {packageProvenance ? <p className="text-sm font-semibold text-ink/75">{packageProvenance}</p> : null}
              {identifiedFood?.source === "fndds_lookup" && correctionCandidates.length > 0 ? (
                <FoodCorrectionChips
                  candidates={correctionCandidates}
                  language={language}
                  onCorrection={(foodId) => void correctCameraMatch(foodId)}
                />
              ) : null}
            </div>
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
        ) : identifiedFood && compass.score ? (
          // About a third of published foods predate FNDDS 2017-18 and have no panel at all.
          // Saying so is better than a scored food that silently shows no numbers.
          <p className="text-xs text-ink/70">{t(language, "compassNoNutrientPanel")}</p>
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
            {PACKAGE_SCAN_CLOUD_ENABLED && FoodPackageScanBridge ? (
              <FoodPackageScanBridge
                authority={authority}
                barcode={activeBarcode}
                captureDetailedFrame={camera.captureDetailedFrame}
                language={language}
                onCancelChange={updateFoodResolutionCancel}
                onStateChange={updateFoodResolutionState}
                passcode={passcode}
                patientId={state.patient.id}
                promoted={live.packageDetected}
                resumeLive={live.rearm}
                suspendLive={live.suspend}
              />
            ) : barcodeReviewCode ? (
              <FoodBarcodeReviewBridge
                authority={authority}
                barcode={barcodeReviewCode}
                language={language}
                onCancelChange={updateFoodResolutionCancel}
                onDismiss={dismissBarcodeReview}
                onStateChange={updateFoodResolutionState}
                resumeLive={live.rearm}
                suspendLive={live.suspend}
              />
            ) : null}

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

            {identifiedFood ? savedPicks : null}

            <PlateScanButton
              busy={plateScanBusy}
              disabled={camera.status !== "active" || plateScanBlocked}
              language={language}
              onScan={() => void scanPlate()}
              onSelectCandidate={(itemId, foodId) => void addPlateItemByFoodId(itemId, foodId)}
              outcome={plateScanOutcome}
              unavailable={live.disarmReason === "provider"}
            />

            <button
              className="min-h-14 w-full rounded-control border border-care bg-white px-4 py-2 font-semibold text-care disabled:opacity-40"
              disabled={pantryLoading || camera.status !== "active" || packageDraftOpen}
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
