"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FoodAuthority } from "@/domain/food-authority";
import type {
  LiveCandidate,
  LiveIdentityCandidate,
  LiveMatch,
  LiveScanError,
  LiveScoreState
} from "@/hooks/use-live-food-score";

type ManualState = Pick<
  LiveScoreState,
  | "match"
  | "candidate"
  | "packageDetected"
  | "carveOut"
  | "noMatchCandidates"
  | "noMatch"
  | "disarmReason"
  | "liveIdentifySucceeded"
  | "scanError"
> & { inFlight: boolean };

const INITIAL_STATE: ManualState = {
  match: null,
  candidate: null,
  packageDetected: false,
  carveOut: null,
  noMatchCandidates: [],
  noMatch: false,
  disarmReason: null,
  liveIdentifySucceeded: false,
  scanError: null,
  inFlight: false
};

function scanError(value: unknown): LiveScanError {
  return value === "provider_quota" ||
    value === "provider_rate_limit" ||
    value === "provider_auth" ||
    value === "provider_unavailable"
    ? value
    : "network";
}

export function useManualFoodScore(args: {
  grabFrame: () => string | null;
  cameraActive: boolean;
  barcodeActive: boolean;
  crisis?: boolean;
  passcode?: string;
  enabled?: boolean;
  authority?: FoodAuthority;
}): LiveScoreState {
  const {
    grabFrame,
    cameraActive,
    barcodeActive,
    crisis = false,
    passcode,
    enabled = true
  } = args;
  const [state, setState] = useState<ManualState>(INITIAL_STATE);
  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  const grabFrameRef = useRef(grabFrame);
  grabFrameRef.current = grabFrame;
  const passcodeRef = useRef(passcode);
  passcodeRef.current = passcode;
  const barcodeActiveRef = useRef(barcodeActive);
  barcodeActiveRef.current = barcodeActive;
  const cameraActiveRef = useRef(cameraActive);
  cameraActiveRef.current = cameraActive;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const abortRef = useRef<AbortController | null>(null);
  const requestEpochRef = useRef<number | null>(null);
  const fallbackAuthorityRef = useRef(0);

  const snapshotAuthority = useCallback(
    () => args.authority?.snapshot() ?? fallbackAuthorityRef.current,
    [args.authority]
  );
  const isAuthorityCurrent = useCallback(
    (epoch: number) => args.authority?.isCurrent(epoch) ?? fallbackAuthorityRef.current === epoch,
    [args.authority]
  );
  const invalidateAuthority = useCallback(() => {
    if (args.authority) return args.authority.invalidate();
    fallbackAuthorityRef.current += 1;
    return fallbackAuthorityRef.current;
  }, [args.authority]);

  const commit = useCallback((patch: Partial<ManualState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  const clearResult = useCallback((patch: Partial<ManualState> = {}) => {
    commit({
      match: null,
      candidate: null,
      packageDetected: false,
      carveOut: null,
      noMatchCandidates: [],
      noMatch: false,
      ...patch
    });
  }, [commit]);

  const candidateList = useCallback((candidates: LiveCandidate[] | undefined, matchedCode: string) => {
    const seen = new Set<string>();
    const normalized: LiveCandidate[] = [];
    for (const candidate of candidates ?? []) {
      if (candidate.code === matchedCode || seen.has(candidate.code)) continue;
      seen.add(candidate.code);
      normalized.push(candidate);
      if (normalized.length === 4) break;
    }
    return normalized;
  }, []);

  const scan = useCallback(async () => {
    if (
      !enabledRef.current ||
      !cameraActiveRef.current ||
      barcodeActiveRef.current ||
      stateRef.current.disarmReason === "review" ||
      stateRef.current.disarmReason === "crisis" ||
      stateRef.current.inFlight
    ) return;

    const image = grabFrameRef.current();
    if (!image) {
      commit({ scanError: "camera_not_ready" });
      return;
    }
    invalidateAuthority();
    const requestEpoch = snapshotAuthority();
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    requestEpochRef.current = requestEpoch;
    clearResult({ inFlight: true, scanError: null });

    try {
      const response = await fetch("/api/food/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, passcode: passcodeRef.current }),
        signal: controller.signal
      });
      const json = await response.json() as {
        mode: string;
        reason?: unknown;
        match?: Omit<LiveMatch, "candidates">;
        candidate?: { food: LiveIdentityCandidate["food"] };
        candidates?: LiveCandidate[];
      };
      if (
        controller.signal.aborted ||
        !isAuthorityCurrent(requestEpoch) ||
        barcodeActiveRef.current
      ) return;

      if (json.mode === "unconfigured" || json.mode === "locked") {
        commit({ scanError: json.mode });
        return;
      }
      if (json.mode === "error") {
        commit({ scanError: scanError(json.reason) });
        return;
      }
      if (json.mode === "none" || json.mode === "carve_out") {
        clearResult({
          noMatch: true,
          noMatchCandidates: json.mode === "none" ? (json.candidates ?? []).slice(0, 3) : []
        });
        return;
      }
      if (json.mode === "package") {
        clearResult({ packageDetected: true });
        return;
      }

      const food = json.candidate?.food ?? json.match?.food;
      if ((json.mode === "candidate" || json.mode === "match") && food) {
        clearResult({
          candidate: { food, candidates: candidateList(json.candidates, food.code) },
          disarmReason: "review",
          liveIdentifySucceeded: true
        });
        return;
      }
      commit({ scanError: "provider_unavailable" });
    } catch {
      if (!controller.signal.aborted) commit({ scanError: "network" });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        requestEpochRef.current = null;
        commit({ inFlight: false });
      }
    }
  }, [candidateList, clearResult, commit, invalidateAuthority, isAuthorityCurrent, snapshotAuthority]);

  const rearm = useCallback(() => {
    invalidateAuthority();
    abortRef.current?.abort();
    abortRef.current = null;
    requestEpochRef.current = null;
    clearResult({
      disarmReason: stateRef.current.disarmReason === "crisis" ? "crisis" : null,
      inFlight: false,
      scanError: null
    });
  }, [clearResult, invalidateAuthority]);

  const suspend = useCallback(() => {
    invalidateAuthority();
    abortRef.current?.abort();
    abortRef.current = null;
    requestEpochRef.current = null;
    clearResult({ disarmReason: "review", inFlight: false, scanError: null });
  }, [clearResult, invalidateAuthority]);

  const adoptMatch = useCallback((match: LiveMatch) => {
    invalidateAuthority();
    const previous = stateRef.current.candidate?.candidates ?? stateRef.current.match?.candidates;
    const supplied = candidateList(match.candidates, match.food.code);
    clearResult({
      match: { ...match, candidates: supplied.length > 0 ? supplied : candidateList(previous, match.food.code) },
      disarmReason: null,
      inFlight: false,
      scanError: null
    });
  }, [candidateList, clearResult, invalidateAuthority]);

  useEffect(() => {
    if (crisis) {
      invalidateAuthority();
      abortRef.current?.abort();
      abortRef.current = null;
      requestEpochRef.current = null;
      clearResult({ disarmReason: "crisis", inFlight: false, scanError: null });
    } else if (stateRef.current.disarmReason === "crisis") {
      commit({ disarmReason: null });
    }
  }, [clearResult, commit, crisis, invalidateAuthority]);

  useEffect(() => {
    const requestEpoch = requestEpochRef.current;
    if (requestEpoch === null || isAuthorityCurrent(requestEpoch)) return;
    abortRef.current?.abort();
    abortRef.current = null;
    requestEpochRef.current = null;
    commit({ inFlight: false });
  }, [args.authority?.epoch, commit, isAuthorityCurrent]);

  useEffect(() => () => {
    mountedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const armed = enabled && cameraActive && !barcodeActive && state.disarmReason === null;
  const badge =
    !armed || state.packageDetected
      ? "hidden"
      : state.match
        ? "score"
        : state.inFlight
          ? "pending"
          : "idle";
  const loopState =
    !armed || state.packageDetected
      ? "unavailable"
      : state.inFlight
        ? "sending"
        : "searching";

  return {
    badge,
    loopState,
    match: state.match,
    candidate: state.candidate,
    packageDetected: state.packageDetected,
    carveOut: state.carveOut,
    noMatchCandidates: state.noMatchCandidates,
    noMatch: state.noMatch,
    armed,
    disarmReason: state.disarmReason,
    liveIdentifySucceeded: state.liveIdentifySucceeded,
    scanError: state.scanError,
    scan,
    adoptMatch,
    suspend,
    rearm,
    setVisibleRatio: () => undefined
  };
}
