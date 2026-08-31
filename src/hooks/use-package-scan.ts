"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { FoodAuthority } from "@/domain/food-authority";
import {
  packageDraftToIdentifiedFood,
  packageIdentityTokensOverlap,
  FOOD_PACKAGE_DISCLOSURE_VERSION,
  type ConfirmedPackageIdentity,
  type PackageIdentityCandidate,
  type PackageNutritionDraft,
  type PackageScanResponse
} from "@/domain/package-scan";
import { foodLookupResponseSchema } from "@/domain/schemas";
import type { IdentifiedFood } from "@/domain/types";
import { normalizeFoodLabelImage } from "@/hooks/use-food-camera";

const PACKAGE_CLIENT_TIMEOUT_MS = 15_000;
const SESSION_INTERRUPTED_MESSAGE = "Package authorization was interrupted. Try again.";

export type PackageSessionAxis =
  | { status: "idle" }
  | { status: "disclosure" }
  | { status: "authorizing" }
  | { status: "ready"; expiresAt: number }
  | { status: "error"; message: string };

export type PackageIdentityAxis =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "review"; candidate: PackageIdentityCandidate }
  | { status: "confirmed"; identity: ConfirmedPackageIdentity; candidate: PackageIdentityCandidate }
  | { status: "needs_rescan"; reason: string };

export type PackageNutritionAxis =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "review"; draft: PackageNutritionDraft }
  | { status: "confirmed"; draft: PackageNutritionDraft }
  | { status: "needs_rescan"; reason: string };

export type PackageBarcodeAxis =
  | { status: "idle" }
  | { status: "looking_up"; code: string }
  | { status: "miss"; code: string }
  | { status: "review"; code: string; food: IdentifiedFood }
  | { status: "confirmed"; code: string; food: IdentifiedFood }
  | { status: "conflict"; code: string; food: IdentifiedFood }
  | { status: "error"; code: string };

export type PackageScanState = {
  active: boolean;
  epoch: number;
  session: PackageSessionAxis;
  identity: PackageIdentityAxis;
  nutrition: PackageNutritionAxis;
  barcode: PackageBarcodeAxis;
  resolvedFood: IdentifiedFood | null;
  error: string | null;
};

type PackageScanAction =
  | { type: "begin"; epoch: number }
  | { type: "cancel"; epoch: number }
  | { type: "session_authorizing"; epoch: number }
  | { type: "session_ready"; epoch: number; expiresAt: number }
  | { type: "session_error"; epoch: number; message: string }
  | { type: "front_reading"; epoch: number }
  | { type: "front_review"; epoch: number; candidate: PackageIdentityCandidate }
  | { type: "front_rescan"; epoch: number; reason: string }
  | { type: "identity_confirmed"; epoch: number; identity: ConfirmedPackageIdentity; resolvedFood: IdentifiedFood | null }
  | { type: "nutrition_reading"; epoch: number }
  | { type: "nutrition_review"; epoch: number; draft: PackageNutritionDraft }
  | { type: "nutrition_rescan"; epoch: number; reason: string }
  | { type: "nutrition_confirmed"; epoch: number; resolvedFood: IdentifiedFood | null }
  | { type: "barcode_looking"; epoch: number; code: string; sessionInterrupted: boolean }
  | { type: "barcode_miss"; epoch: number; code: string }
  | { type: "barcode_review"; epoch: number; code: string; food: IdentifiedFood; conflict: boolean }
  | { type: "barcode_confirmed"; epoch: number; code: string; food: IdentifiedFood }
  | { type: "barcode_rejected"; epoch: number; resolvedFood: IdentifiedFood | null }
  | { type: "barcode_error"; epoch: number; code: string }
  | { type: "request_error"; epoch: number; kind: "front" | "nutrition"; message: string };

export const initialPackageScanState: PackageScanState = {
  active: false,
  epoch: 0,
  session: { status: "idle" },
  identity: { status: "idle" },
  nutrition: { status: "idle" },
  barcode: { status: "idle" },
  resolvedFood: null,
  error: null
};

function stale(state: PackageScanState, action: PackageScanAction): boolean {
  return action.epoch < state.epoch;
}

export function packageScanReducer(state: PackageScanState, action: PackageScanAction): PackageScanState {
  if (stale(state, action)) return state;
  switch (action.type) {
    case "begin":
      return {
        ...state,
        active: true,
        epoch: action.epoch,
        session: state.session.status === "ready" ? state.session : { status: "disclosure" },
        resolvedFood: null,
        error: null
      };
    case "cancel":
      return { ...initialPackageScanState, epoch: action.epoch };
    case "session_authorizing":
      return { ...state, epoch: action.epoch, session: { status: "authorizing" }, error: null };
    case "session_ready":
      return { ...state, epoch: action.epoch, session: { status: "ready", expiresAt: action.expiresAt }, error: null };
    case "session_error":
      return { ...state, epoch: action.epoch, session: { status: "error", message: action.message }, error: action.message };
    case "front_reading":
      return {
        ...state,
        epoch: action.epoch,
        active: true,
        identity: { status: "reading" },
        nutrition: state.nutrition.status === "reading"
          ? { status: "needs_rescan", reason: "That nutrition scan was interrupted. Try again." }
          : state.nutrition,
        barcode: state.barcode.status === "looking_up" ? { status: "idle" } : state.barcode,
        resolvedFood: null,
        error: null
      };
    case "front_review":
      return { ...state, epoch: action.epoch, identity: { status: "review", candidate: action.candidate }, resolvedFood: null, error: null };
    case "front_rescan":
      return { ...state, epoch: action.epoch, identity: { status: "needs_rescan", reason: action.reason }, resolvedFood: null };
    case "identity_confirmed": {
      const candidate = state.identity.status === "review" ? state.identity.candidate : state.identity.status === "confirmed" ? state.identity.candidate : null;
      if (!candidate) return state;
      const conflict =
        (state.barcode.status === "review" || state.barcode.status === "conflict") &&
        !packageIdentityTokensOverlap(
          [action.identity.displayName, action.identity.brand],
          [state.barcode.food.brand, state.barcode.food.name]
        );
      return {
        ...state,
        epoch: action.epoch,
        identity: { status: "confirmed", identity: action.identity, candidate },
        barcode: conflict && (state.barcode.status === "review" || state.barcode.status === "conflict")
          ? { ...state.barcode, status: "conflict" }
          : state.barcode.status === "looking_up"
            ? { status: "idle" }
            : state.barcode,
        resolvedFood: conflict ? null : action.resolvedFood,
        error: null
      };
    }
    case "nutrition_reading":
      return {
        ...state,
        epoch: action.epoch,
        active: true,
        identity: state.identity.status === "reading"
          ? { status: "needs_rescan", reason: "That front-label scan was interrupted. Try again." }
          : state.identity,
        nutrition: { status: "reading" },
        barcode: state.barcode.status === "looking_up" ? { status: "idle" } : state.barcode,
        resolvedFood: null,
        error: null
      };
    case "nutrition_review":
      return { ...state, epoch: action.epoch, nutrition: { status: "review", draft: action.draft }, resolvedFood: null, error: null };
    case "nutrition_rescan":
      return { ...state, epoch: action.epoch, nutrition: { status: "needs_rescan", reason: action.reason }, resolvedFood: null };
    case "nutrition_confirmed": {
      if (state.nutrition.status !== "review") return state;
      return {
        ...state,
        epoch: action.epoch,
        nutrition: { status: "confirmed", draft: state.nutrition.draft },
        barcode: state.barcode.status === "looking_up" ? { status: "idle" } : state.barcode,
        resolvedFood: action.resolvedFood,
        error: null
      };
    }
    case "barcode_looking":
      return {
        ...state,
        active: true,
        epoch: action.epoch,
        session: action.sessionInterrupted
          ? { status: "error", message: SESSION_INTERRUPTED_MESSAGE }
          : state.session,
        identity: state.identity.status === "reading"
          ? { status: "needs_rescan", reason: "That front-label scan was interrupted by the barcode. Try again." }
          : state.identity,
        nutrition: state.nutrition.status === "reading"
          ? { status: "needs_rescan", reason: "That nutrition scan was interrupted by the barcode. Try again." }
          : state.nutrition,
        barcode: { status: "looking_up", code: action.code },
        resolvedFood: null,
        error: action.sessionInterrupted ? SESSION_INTERRUPTED_MESSAGE : null
      };
    case "barcode_miss":
      return (() => {
        const next = { ...state, epoch: action.epoch, barcode: { status: "miss", code: action.code } as const };
        return { ...next, resolvedFood: confirmedLabelFood(next) };
      })();
    case "barcode_review":
      return {
        ...state,
        epoch: action.epoch,
        barcode: action.conflict
          ? { status: "conflict", code: action.code, food: action.food }
          : { status: "review", code: action.code, food: action.food },
        resolvedFood: null,
        error: null
      };
    case "barcode_confirmed":
      return {
        ...state,
        epoch: action.epoch,
        active: true,
        barcode: { status: "confirmed", code: action.code, food: action.food },
        resolvedFood: action.food,
        error: null
      };
    case "barcode_rejected":
      return { ...state, epoch: action.epoch, barcode: { status: "idle" }, resolvedFood: action.resolvedFood, error: null };
    case "barcode_error":
      return (() => {
        const next = { ...state, epoch: action.epoch, barcode: { status: "error", code: action.code } as const };
        return { ...next, resolvedFood: confirmedLabelFood(next) };
      })();
    case "request_error":
      return {
        ...state,
        epoch: action.epoch,
        identity: action.kind === "front" && state.identity.status === "reading"
          ? { status: "needs_rescan", reason: action.message }
          : state.identity,
        nutrition: action.kind === "nutrition" && state.nutrition.status === "reading"
          ? { status: "needs_rescan", reason: action.message }
          : state.nutrition,
        error: action.message
      };
  }
}

function confirmedLabelFood(state: PackageScanState, identity?: ConfirmedPackageIdentity, draft?: PackageNutritionDraft): IdentifiedFood | null {
  const confirmedIdentity = identity ?? (state.identity.status === "confirmed" ? state.identity.identity : null);
  const confirmedDraft = draft ?? (state.nutrition.status === "confirmed" ? state.nutrition.draft : null);
  if (
    !confirmedIdentity ||
    !confirmedDraft ||
    state.barcode.status === "looking_up" ||
    state.barcode.status === "review" ||
    state.barcode.status === "conflict" ||
    state.barcode.status === "confirmed"
  ) return null;
  const barcode = "code" in state.barcode ? state.barcode.code : null;
  return packageDraftToIdentifiedFood({ identity: confirmedIdentity, draft: confirmedDraft, barcode });
}

export type PackageScanController = {
  state: PackageScanState;
  begin: () => void;
  authorize: () => Promise<void>;
  scanFront: (file?: Blob) => Promise<void>;
  confirmIdentity: (displayName: string) => void;
  scanNutrition: (file?: Blob) => Promise<void>;
  confirmNutrition: () => void;
  onBarcodeDetected: (code: string) => Promise<void>;
  confirmBarcode: () => void;
  rejectBarcode: () => void;
  cancel: () => void;
};

export function usePackageScan(args: {
  enabled: boolean;
  authority: FoodAuthority;
  passcode?: string;
  patientId: string;
  captureDetailedFrame: () => Promise<string | null>;
  suspendLive: () => void;
  resumeLive: () => void;
}): PackageScanController {
  const {
    authority,
    captureDetailedFrame,
    enabled,
    passcode,
    patientId,
    resumeLive,
    suspendLive
  } = args;
  const [state, dispatch] = useReducer(packageScanReducer, initialPackageScanState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const requestAbortRef = useRef<{
    controller: AbortController;
    epoch: number;
    kind: "session" | "front" | "nutrition";
  } | null>(null);
  const barcodeAbortRef = useRef<{ controller: AbortController; epoch: number; code: string } | null>(null);
  const pinnedBarcodeRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  if (state.barcode.status !== "idle" && state.barcode.status !== "error") {
    pinnedBarcodeRef.current = state.barcode.code;
  }

  const beginAuthority = useCallback(() => {
    requestAbortRef.current?.controller.abort();
    requestAbortRef.current = null;
    const barcodeRequest = barcodeAbortRef.current;
    barcodeRequest?.controller.abort();
    barcodeAbortRef.current = null;
    if (barcodeRequest && pinnedBarcodeRef.current === barcodeRequest.code) {
      pinnedBarcodeRef.current = null;
    }
    suspendLive();
    return authority.snapshot();
  }, [authority, suspendLive]);

  const begin = useCallback(() => {
    if (!enabled) return;
    const epoch = beginAuthority();
    dispatch({ type: "begin", epoch });
  }, [enabled, beginAuthority]);

  const authorize = useCallback(async () => {
    if (!enabled) return;
    const epoch = beginAuthority();
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PACKAGE_CLIENT_TIMEOUT_MS);
    requestAbortRef.current = { controller, epoch, kind: "session" };
    dispatch({ type: "session_authorizing", epoch });
    try {
      const response = await fetch("/api/food/package/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          passcode: passcode ?? "",
          disclosureVersion: FOOD_PACKAGE_DISCLOSURE_VERSION
        }),
        signal: controller.signal
      });
      const json = (await response.json()) as { authorized?: boolean; expiresAt?: number; mode?: string };
      if (!mountedRef.current || controller.signal.aborted || !authority.isCurrent(epoch)) return;
      if (response.ok && json.authorized && typeof json.expiresAt === "number") {
        dispatch({ type: "session_ready", epoch, expiresAt: json.expiresAt });
      } else {
        dispatch({ type: "session_error", epoch, message: json.mode === "locked" ? "The invite code could not authorize package scanning." : "Package scanning is not available." });
      }
    } catch {
      if (mountedRef.current && (!controller.signal.aborted || timedOut) && authority.isCurrent(epoch)) {
        dispatch({ type: "session_error", epoch, message: "Package scanning is not available." });
      }
    } finally {
      globalThis.clearTimeout(timeout);
      if (requestAbortRef.current?.controller === controller) requestAbortRef.current = null;
    }
  }, [authority, beginAuthority, enabled, passcode]);

  const detailedImage = useCallback(
    async (file?: Blob) => file ? normalizeFoodLabelImage(file) : captureDetailedFrame(),
    [captureDetailedFrame]
  );

  const scan = useCallback(async (kind: "front" | "nutrition", file?: Blob) => {
    const session = stateRef.current.session;
    if (!enabled || session.status !== "ready") return;
    if (session.expiresAt <= Date.now() + 5_000) {
      const epoch = beginAuthority();
      dispatch({
        type: "session_error",
        epoch,
        message: "Your package scan session expired. Authorize it again to keep your review."
      });
      return;
    }
    const epoch = beginAuthority();
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PACKAGE_CLIENT_TIMEOUT_MS);
    requestAbortRef.current = { controller, epoch, kind };
    dispatch({ type: kind === "front" ? "front_reading" : "nutrition_reading", epoch });
    try {
      const image = await detailedImage(file);
      if (!image || controller.signal.aborted || !authority.isCurrent(epoch)) {
        if (mountedRef.current && timedOut && authority.isCurrent(epoch)) {
          dispatch({ type: "request_error", epoch, kind, message: "I could not prepare that photo in time. Try again." });
        } else if (!controller.signal.aborted && authority.isCurrent(epoch)) {
          dispatch({ type: "request_error", epoch, kind, message: "I could not prepare that photo. Use the camera or choose a clear image." });
        }
        return;
      }
      const response = await fetch("/api/food/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ kind, image, patientId }),
        signal: controller.signal
      });
      const json = (await response.json()) as PackageScanResponse;
      if (!mountedRef.current || controller.signal.aborted || !authority.isCurrent(epoch)) return;
      if (response.status === 401 || json.mode === "locked") {
        dispatch({
          type: "request_error",
          epoch,
          kind,
          message: "That scan was not sent because the package session expired."
        });
        dispatch({
          type: "session_error",
          epoch,
          message: "Your package scan session expired. Authorize it again to keep your review."
        });
      } else if (kind === "front" && json.mode === "front") {
        dispatch({ type: "front_review", epoch, candidate: json.candidate });
      } else if (kind === "nutrition" && json.mode === "nutrition") {
        dispatch({ type: "nutrition_review", epoch, draft: json.draft });
      } else if (json.mode === "needs_rescan" && json.kind === kind) {
        dispatch({ type: kind === "front" ? "front_rescan" : "nutrition_rescan", epoch, reason: json.reason });
      } else {
        dispatch({ type: "request_error", epoch, kind, message: json.mode === "error" ? json.message : "I could not read that photo. Try again." });
      }
    } catch {
      if (mountedRef.current && (!controller.signal.aborted || timedOut) && authority.isCurrent(epoch)) {
        dispatch({ type: "request_error", epoch, kind, message: "I could not read that photo. Try again." });
      }
    } finally {
      globalThis.clearTimeout(timeout);
      if (requestAbortRef.current?.controller === controller) requestAbortRef.current = null;
    }
  }, [authority, beginAuthority, detailedImage, enabled, patientId]);

  const scanFront = useCallback((file?: Blob) => scan("front", file), [scan]);
  const scanNutrition = useCallback((file?: Blob) => scan("nutrition", file), [scan]);

  const confirmIdentity = useCallback((displayName: string) => {
    const current = stateRef.current;
    if (current.identity.status !== "review") return;
    const trimmed = displayName.trim().slice(0, 240);
    if (!trimmed) return;
    const epoch = beginAuthority();
    const identity: ConfirmedPackageIdentity = {
      displayName: trimmed,
      brand: current.identity.candidate.brand,
      category: null
    };
    const resolutionState = current.barcode.status === "looking_up"
      ? { ...current, barcode: { status: "idle" } as const }
      : current;
    const resolvedFood = current.nutrition.status === "confirmed"
      ? confirmedLabelFood(resolutionState, identity, current.nutrition.draft)
      : null;
    dispatch({ type: "identity_confirmed", epoch, identity, resolvedFood });
  }, [beginAuthority]);

  const confirmNutrition = useCallback(() => {
    const current = stateRef.current;
    if (current.nutrition.status !== "review") return;
    const epoch = beginAuthority();
    const resolutionState = current.barcode.status === "looking_up"
      ? { ...current, barcode: { status: "idle" } as const }
      : current;
    const resolvedFood = current.identity.status === "confirmed"
      ? confirmedLabelFood(resolutionState, current.identity.identity, current.nutrition.draft)
      : null;
    dispatch({ type: "nutrition_confirmed", epoch, resolvedFood });
  }, [beginAuthority]);

  const onBarcodeDetected = useCallback(async (code: string) => {
    if (!enabled) return;
    if (pinnedBarcodeRef.current === code) return;
    pinnedBarcodeRef.current = code;
    const interruptedRequest = requestAbortRef.current;
    interruptedRequest?.controller.abort();
    requestAbortRef.current = null;
    barcodeAbortRef.current?.controller.abort();
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PACKAGE_CLIENT_TIMEOUT_MS);
    suspendLive();
    const requestEpoch = authority.snapshot();
    barcodeAbortRef.current = { controller, epoch: requestEpoch, code };
    dispatch({
      type: "barcode_looking",
      epoch: requestEpoch,
      code,
      sessionInterrupted: interruptedRequest?.kind === "session"
    });
    try {
      const response = await fetch(`/api/food/lookup?barcode=${encodeURIComponent(code)}`, { signal: controller.signal });
      const json = await response.json() as unknown;
      if (!mountedRef.current || controller.signal.aborted || !authority.isCurrent(requestEpoch)) return;
      const parsed = foodLookupResponseSchema.safeParse(json);
      if (parsed.success && parsed.data.found) {
        const identity = stateRef.current.identity;
        const conflict = identity.status === "confirmed" && !packageIdentityTokensOverlap(
          [identity.identity.displayName, identity.identity.brand],
          [parsed.data.food.brand, parsed.data.food.name]
        );
        dispatch({ type: "barcode_review", epoch: requestEpoch, code, food: parsed.data.food, conflict });
      } else if (parsed.success) {
        dispatch({ type: "barcode_miss", epoch: requestEpoch, code });
      } else {
        if (pinnedBarcodeRef.current === code) pinnedBarcodeRef.current = null;
        dispatch({ type: "barcode_error", epoch: requestEpoch, code });
      }
    } catch {
      if (mountedRef.current && (!controller.signal.aborted || timedOut) && authority.isCurrent(requestEpoch)) {
        if (pinnedBarcodeRef.current === code) pinnedBarcodeRef.current = null;
        dispatch({ type: "barcode_error", epoch: requestEpoch, code });
      }
    } finally {
      globalThis.clearTimeout(timeout);
      if (barcodeAbortRef.current?.controller === controller) barcodeAbortRef.current = null;
    }
  }, [authority, enabled, suspendLive]);

  const confirmBarcode = useCallback(() => {
    const current = stateRef.current;
    if (current.barcode.status !== "review" && current.barcode.status !== "conflict") return;
    const epoch = beginAuthority();
    dispatch({ type: "barcode_confirmed", epoch, code: current.barcode.code, food: current.barcode.food });
  }, [beginAuthority]);

  const rejectBarcode = useCallback(() => {
    const current = stateRef.current;
    if (!("code" in current.barcode)) return;
    pinnedBarcodeRef.current = null;
    barcodeAbortRef.current?.controller.abort();
    barcodeAbortRef.current = null;
    const hasLabelWork = current.identity.status !== "idle" || current.nutrition.status !== "idle";
    if (!hasLabelWork) {
      resumeLive();
      dispatch({ type: "cancel", epoch: authority.snapshot() });
      return;
    }
    const epoch = authority.invalidate();
    const resolvedFood = confirmedLabelFood({ ...current, barcode: { status: "idle" } });
    dispatch({ type: "barcode_rejected", epoch, resolvedFood });
  }, [authority, resumeLive]);

  const cancel = useCallback(() => {
    requestAbortRef.current?.controller.abort();
    requestAbortRef.current = null;
    barcodeAbortRef.current?.controller.abort();
    barcodeAbortRef.current = null;
    pinnedBarcodeRef.current = null;
    const epoch = authority.invalidate();
    dispatch({ type: "cancel", epoch });
    resumeLive();
  }, [authority, resumeLive]);

  useEffect(() => {
    const currentEpoch = authority.snapshot();
    const pending = requestAbortRef.current;
    if (pending && !authority.isCurrent(pending.epoch)) {
      pending.controller.abort();
      requestAbortRef.current = null;
      if (pending.kind === "session") {
        dispatch({ type: "session_error", epoch: currentEpoch, message: "Package scanning was interrupted. Try again." });
      } else {
        dispatch({
          type: "request_error",
          epoch: currentEpoch,
          kind: pending.kind,
          message: "That package scan was interrupted. Try again."
        });
      }
    }

    const barcode = barcodeAbortRef.current;
    if (barcode && !authority.isCurrent(barcode.epoch)) {
      barcode.controller.abort();
      barcodeAbortRef.current = null;
      if (pinnedBarcodeRef.current === barcode.code) pinnedBarcodeRef.current = null;
      dispatch({ type: "barcode_error", epoch: currentEpoch, code: barcode.code });
    }
  }, [authority.epoch, authority]);

  useEffect(() => {
    // React Strict Effects runs setup -> cleanup -> setup in development. Resetting this
    // guard in every setup keeps the second, real lifetime able to commit async results.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestAbortRef.current?.controller.abort();
      barcodeAbortRef.current?.controller.abort();
    };
  }, []);

  return {
    state,
    begin,
    authorize,
    scanFront,
    confirmIdentity,
    scanNutrition,
    confirmNutrition,
    onBarcodeDetected,
    confirmBarcode,
    rejectBarcode,
    cancel
  };
}
