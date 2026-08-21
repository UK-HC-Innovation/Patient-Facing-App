"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type {
  CompassAlternative,
  CompassScore,
  FnddsRecord,
  NotScoreableReason,
  ScoreDomainBreakdown
} from "@/domain/food-compass";
import type { FoodMatchProvenance, FoodOrderIntent } from "@/domain/food-order-intent";

export const LIVE_INTERVAL_MS = 2_500;
/** Mean absolute difference (0-255) between two 32x32 grayscale frames that counts as a new scene. */
export const SCENE_CHANGE_THRESHOLD = 6;
/** Stop burning frames on a camera pointed at nothing. */
export const AUTO_DISARM_MS = 3 * 60_000;
/** How long a vision identification survives a barcode interruption. */
export const VISION_RESTORE_MS = 60_000;
/** How long a user-selected correction wins over subsequent vision results. */
export const CORRECTION_PIN_MS = 60_000;

const SIGNATURE_EDGE = 32;

export type LiveCandidate = { code: string; description: string; fcs: number };

export type LiveMatch = {
  food: { code: string; description: string; group: string };
  score: CompassScore;
  alternatives: CompassAlternative[];
  nutrients: FnddsRecord | null;
  estimatedDomains?: ScoreDomainBreakdown;
  candidates: LiveCandidate[];
  interpretation?: FoodOrderIntent;
  provenance?: FoodMatchProvenance;
};

export type LiveScoreBadge = "hidden" | "idle" | "pending" | "score" | "carve_out" | "scan_again";
export type LiveDisarmReason = "idle" | "provider" | null;

export type LiveScoreState = {
  badge: LiveScoreBadge;
  match: LiveMatch | null;
  carveOut: NotScoreableReason | null;
  armed: boolean;
  disarmReason: LiveDisarmReason;
  adoptMatch: (match: LiveMatch) => void;
  rearm: () => void;
};

/** Mean absolute difference between two equal-length grayscale signatures. */
export function meanAbsoluteDifference(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i] - b[i]);
  }
  return total / a.length;
}

function frameSignature(video: HTMLVideoElement | null, canvas: HTMLCanvasElement | null): number[] | null {
  if (!video || !canvas || video.videoWidth === 0) {
    return null;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  canvas.width = SIGNATURE_EDGE;
  canvas.height = SIGNATURE_EDGE;
  ctx.drawImage(video, 0, 0, SIGNATURE_EDGE, SIGNATURE_EDGE);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SIGNATURE_EDGE, SIGNATURE_EDGE).data;
  } catch {
    return null;
  }
  const signature: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    signature.push((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
  }
  return signature;
}

/**
 * Continuous camera scoring.
 *
 * Cost discipline is the whole design: one grab immediately on arm so the first score
 * lands fast, then at most one call every 2.5 s, skipped entirely when the scene has not
 * changed, when a call is already in flight, when the tab is hidden, or when a barcode is
 * doing the identifying instead. At low image detail that is roughly $0.5/hour worst case,
 * and it is passcode-gated on top.
 *
 * There is no separate provider probe: the first identify call is the probe. If it comes
 * back "unconfigured" or "locked" the loop disarms for good and the badge hides, which
 * costs one request rather than two.
 */
export function useLiveFoodScore(args: {
  videoRef: RefObject<HTMLVideoElement | null>;
  grabFrame: () => string | null;
  cameraActive: boolean;
  /** While a barcode is active it is authoritative and the vision loop stands down. */
  barcodeActive: boolean;
  passcode?: string;
  enabled?: boolean;
  now?: () => number;
}): LiveScoreState {
  const { videoRef, grabFrame, cameraActive, barcodeActive, passcode, enabled = true } = args;
  const now = args.now ?? (() => Date.now());

  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [carveOut, setCarveOut] = useState<NotScoreableReason | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [disarmReason, setDisarmReason] = useState<LiveDisarmReason>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureRef = useRef<number[] | null>(null);
  const lastChangeRef = useRef<number>(0);
  const inFlightRef = useRef(false);
  const disarmedRef = useRef(false);
  const disarmReasonRef = useRef<LiveDisarmReason>(null);
  const matchRef = useRef<LiveMatch | null>(null);
  const correctionPinnedUntilRef = useRef(0);
  const stashRef = useRef<{ match: LiveMatch | null; carveOut: NotScoreableReason | null; at: number } | null>(null);
  const barcodeActiveRef = useRef(barcodeActive);
  const cameraActiveRef = useRef(cameraActive);
  cameraActiveRef.current = cameraActive;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const nowRef = useRef(now);
  nowRef.current = now;
  // Held in refs on purpose. If identify() depended on these by identity, a caller passing
  // an inline grabFrame would re-arm the loop on every state update -- and since arming
  // fires a call immediately, that is an unbounded request loop against a paid endpoint.
  const grabFrameRef = useRef(grabFrame);
  grabFrameRef.current = grabFrame;
  const passcodeRef = useRef(passcode);
  passcodeRef.current = passcode;

  const armed = enabled && cameraActive && disarmReason === null && !barcodeActive;

  const commitMatch = useCallback((next: LiveMatch | null) => {
    matchRef.current = next;
    setMatch(next);
  }, []);

  const candidateList = useCallback((candidates: LiveCandidate[] | undefined, matchedCode: string) => {
    const seen = new Set<string>();
    const normalized: LiveCandidate[] = [];
    for (const candidate of candidates ?? []) {
      if (candidate.code === matchedCode || seen.has(candidate.code)) {
        continue;
      }
      seen.add(candidate.code);
      normalized.push(candidate);
      if (normalized.length === 4) {
        break;
      }
    }
    return normalized;
  }, []);

  const adoptMatch = useCallback(
    (adopted: LiveMatch) => {
      const previousCandidates = matchRef.current?.candidates ?? [];
      const suppliedCandidates = candidateList(adopted.candidates, adopted.food.code);
      const candidates =
        suppliedCandidates.length > 0
          ? suppliedCandidates
          : candidateList(previousCandidates, adopted.food.code);
      const next = { ...adopted, candidates };
      correctionPinnedUntilRef.current = nowRef.current() + CORRECTION_PIN_MS;
      commitMatch(next);
      setCarveOut(null);
      stashRef.current = { match: next, carveOut: null, at: nowRef.current() };
    },
    [candidateList, commitMatch]
  );

  const identify = useCallback(async () => {
    if (correctionPinnedUntilRef.current > nowRef.current()) {
      return;
    }
    const image = grabFrameRef.current();
    if (!image) {
      return;
    }
    inFlightRef.current = true;
    setInFlight(true);
    try {
      const response = await fetch("/api/food/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, passcode: passcodeRef.current })
      });
      const json = (await response.json()) as {
        mode: string;
        reason?: NotScoreableReason;
        match?: Omit<LiveMatch, "candidates">;
        candidates?: LiveCandidate[];
      };

      // A barcode may have taken over while this was in flight; its answer wins.
      if (barcodeActiveRef.current) {
        return;
      }

      if (json.mode === "unconfigured" || json.mode === "locked") {
        disarmedRef.current = true;
        disarmReasonRef.current = "provider";
        setDisarmReason("provider");
        return;
      }
      // A correction may have landed while this paid request was in flight.
      if (correctionPinnedUntilRef.current > nowRef.current()) {
        return;
      }
      if (json.mode === "carve_out" && json.reason) {
        setCarveOut(json.reason);
        commitMatch(null);
        stashRef.current = { match: null, carveOut: json.reason, at: nowRef.current() };
        return;
      }
      if (json.mode === "match" && json.match) {
        const next: LiveMatch = {
          ...json.match,
          candidates: candidateList(json.candidates, json.match.food.code)
        };
        commitMatch(next);
        setCarveOut(null);
        stashRef.current = { match: next, carveOut: null, at: nowRef.current() };
      }
      // "none" and "error": keep whatever was last shown rather than flashing empty.
    } catch {
      // network hiccup — the next tick tries again
    } finally {
      inFlightRef.current = false;
      setInFlight(false);
    }
  }, [candidateList, commitMatch]);

  const rearm = useCallback(() => {
    if (disarmReasonRef.current === "provider") {
      return;
    }
    const wasDisarmed = disarmReasonRef.current !== null;
    disarmedRef.current = false;
    disarmReasonRef.current = null;
    correctionPinnedUntilRef.current = 0;
    signatureRef.current = null;
    lastChangeRef.current = nowRef.current();
    commitMatch(null);
    setCarveOut(null);
    setDisarmReason(null);
    if (
      !wasDisarmed &&
      enabledRef.current &&
      cameraActiveRef.current &&
      !barcodeActiveRef.current &&
      !inFlightRef.current
    ) {
      void identify();
    }
  }, [commitMatch, identify]);

  // --- barcode preemption and restore ---
  useEffect(() => {
    const wasActive = barcodeActiveRef.current;
    barcodeActiveRef.current = barcodeActive;
    if (barcodeActive && !wasActive) {
      // Stand down; the stash keeps the vision answer for a short while.
      correctionPinnedUntilRef.current = 0;
      commitMatch(null);
      setCarveOut(null);
      return;
    }
    if (!barcodeActive && wasActive) {
      const stash = stashRef.current;
      if (stash && nowRef.current() - stash.at < VISION_RESTORE_MS) {
        commitMatch(stash.match);
        setCarveOut(stash.carveOut);
      } else {
        stashRef.current = null;
        commitMatch(null);
        setCarveOut(null);
      }
    }
  }, [barcodeActive, commitMatch]);

  // --- the loop ---
  useEffect(() => {
    if (!armed || disarmedRef.current) {
      return;
    }
    if (!canvasRef.current && typeof document !== "undefined") {
      canvasRef.current = document.createElement("canvas");
    }
    lastChangeRef.current = nowRef.current();
    signatureRef.current = null;

    // Fire immediately on arm so the first score does not wait a full interval.
    void identify();

    const tick = () => {
      if (disarmedRef.current || inFlightRef.current) {
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      const signature = frameSignature(videoRef.current, canvasRef.current);
      if (signature) {
        const previous = signatureRef.current;
        signatureRef.current = signature;
        if (previous && meanAbsoluteDifference(previous, signature) < SCENE_CHANGE_THRESHOLD) {
          if (nowRef.current() - lastChangeRef.current >= AUTO_DISARM_MS) {
            disarmedRef.current = true;
            disarmReasonRef.current = "idle";
            setDisarmReason("idle");
          }
          return;
        }
      }
      lastChangeRef.current = nowRef.current();
      void identify();
    };

    const timer = setInterval(tick, LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [armed, identify, videoRef]);

  const badge: LiveScoreBadge = !enabled || !cameraActive || disarmReason === "provider"
    ? "hidden"
    : disarmReason === "idle"
      ? "scan_again"
    : carveOut
      ? "carve_out"
      : match
        ? "score"
        : inFlight
          ? "pending"
          : "idle";

  return { badge, match, carveOut, armed, disarmReason, adoptMatch, rearm };
}
