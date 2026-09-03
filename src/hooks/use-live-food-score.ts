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
import type { FoodAuthority } from "@/domain/food-authority";
import { GATE_PAUSE_BELOW, GATE_RESUME_ABOVE } from "@/domain/viewfinder-gate";

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

export type LiveIdentityCandidate = {
  food: { code: string; description: string; group: string };
  candidates: LiveCandidate[];
};

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
export type LiveDisarmReason = "idle" | "provider" | "offscreen" | "crisis" | "review" | null;
export type LiveScanError =
  | "camera_not_ready"
  | "unconfigured"
  | "locked"
  | "provider_quota"
  | "provider_rate_limit"
  | "provider_auth"
  | "provider_unavailable"
  | "network";

/**
 * What the loop pill says. Four states, not two: no pill at all is a real answer, because a
 * permission error is not a loop state.
 */
export type LiveLoopState = "sending" | "searching" | "paused_offscreen" | "unavailable";

export type LiveScoreState = {
  badge: LiveScoreBadge;
  loopState: LiveLoopState;
  match: LiveMatch | null;
  /** An image-proposed database row. It has no score until the patient confirms it. */
  candidate: LiveIdentityCandidate | null;
  /** The route saw retail packaging and deliberately withheld an FNDDS candidate. */
  packageDetected: boolean;
  carveOut: NotScoreableReason | null;
  /**
   * Published category names to offer when nothing matched. FNDDS names read straight from
   * the table, so they need no translation of their own.
   */
  noMatchCandidates: LiveCandidate[];
  /** The route answered "none" for the current scene -- not the same as nothing seen yet. */
  noMatch: boolean;
  armed: boolean;
  disarmReason: LiveDisarmReason;
  /** A paid image-identify match has succeeded at least once during this mount. */
  liveIdentifySucceeded: boolean;
  scanError: LiveScanError | null;
  /** Capture and identify one frame after an explicit user action. */
  scan: () => Promise<void>;
  adoptMatch: (match: LiveMatch, options?: { pin?: boolean }) => void;
  /** Clear all current authority and stop paid identification until rearm(). */
  suspend: () => void;
  rearm: () => void;
  /**
   * How much of the viewfinder is on screen, 0-1. Imperative on purpose: the caller measures
   * into a ref and calls this once per animation frame, so a continuous scroll value never
   * reaches component state.
   */
  setVisibleRatio: (ratio: number) => void;
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
 * changed, when a call is already in flight, when the tab is hidden, when a barcode is
 * doing the identifying instead, or when the viewfinder is not on screen. At low image
 * detail that is roughly $0.5/hour worst case, and it is passcode-gated on top.
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
  /**
   * A crisis intercept unmounts the camera, so a naive visibility gate would read 0% and
   * pause -- correct by accident. Paused because you scrolled and stopped because we
   * intercepted must not share a code path.
   */
  crisis?: boolean;
  passcode?: string;
  enabled?: boolean;
  /** Disables the scheduler so image capture happens only through scan(). */
  manual?: boolean;
  authority?: FoodAuthority;
  now?: () => number;
}): LiveScoreState {
  const {
    videoRef,
    grabFrame,
    cameraActive,
    barcodeActive,
    crisis = false,
    passcode,
    enabled = true,
    manual = false
  } = args;
  const now = args.now ?? (() => Date.now());

  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [candidate, setCandidate] = useState<LiveIdentityCandidate | null>(null);
  const [packageDetected, setPackageDetected] = useState(false);
  const [carveOut, setCarveOut] = useState<NotScoreableReason | null>(null);
  const [noMatchCandidates, setNoMatchCandidates] = useState<LiveCandidate[]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [disarmReason, setDisarmReason] = useState<LiveDisarmReason>(null);
  const [liveIdentifySucceeded, setLiveIdentifySucceeded] = useState(false);
  const [scanError, setScanError] = useState<LiveScanError | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureRef = useRef<number[] | null>(null);
  const lastChangeRef = useRef<number>(0);
  const inFlightRef = useRef(false);
  const identifyAbortRef = useRef<AbortController | null>(null);
  const identifyEpochRef = useRef<number | null>(null);
  const disarmedRef = useRef(false);
  const disarmReasonRef = useRef<LiveDisarmReason>(null);
  const matchRef = useRef<LiveMatch | null>(null);
  const candidateRef = useRef<LiveIdentityCandidate | null>(null);
  const packageDetectedRef = useRef(false);
  const correctionPinnedUntilRef = useRef(0);
  const stashRef = useRef<{ match: LiveMatch | null; carveOut: NotScoreableReason | null; at: number } | null>(null);
  const barcodeActiveRef = useRef(barcodeActive);
  const cameraActiveRef = useRef(cameraActive);
  cameraActiveRef.current = cameraActive;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const nowRef = useRef(now);
  nowRef.current = now;
  // The continuous scroll value never reaches state -- storing it there renders on every
  // scroll event, and that render changes the geometry it was measuring.
  const visibleRatioRef = useRef(1);
  // Resuming holds for one full interval, so a flick past the camera costs no request.
  const resumeHoldUntilRef = useRef(0);
  const offscreenResumeRef = useRef(false);
  // Held in refs on purpose. If identify() depended on these by identity, a caller passing
  // an inline grabFrame would re-arm the loop on every state update -- and since arming
  // fires a call immediately, that is an unbounded request loop against a paid endpoint.
  const grabFrameRef = useRef(grabFrame);
  grabFrameRef.current = grabFrame;
  const passcodeRef = useRef(passcode);
  passcodeRef.current = passcode;
  const fallbackAuthorityRef = useRef(0);
  const externalAuthoritySnapshot = args.authority?.snapshot;
  const externalAuthorityIsCurrent = args.authority?.isCurrent;
  const externalAuthorityInvalidate = args.authority?.invalidate;
  const snapshotAuthority = useCallback(
    () => externalAuthoritySnapshot?.() ?? fallbackAuthorityRef.current,
    [externalAuthoritySnapshot]
  );
  const isAuthorityCurrent = useCallback(
    (epoch: number) => externalAuthorityIsCurrent?.(epoch) ?? fallbackAuthorityRef.current === epoch,
    [externalAuthorityIsCurrent]
  );
  const invalidateAuthority = useCallback(() => {
    if (externalAuthorityInvalidate) {
      return externalAuthorityInvalidate();
    }
    fallbackAuthorityRef.current += 1;
    return fallbackAuthorityRef.current;
  }, [externalAuthorityInvalidate]);

  const armed = enabled && cameraActive && disarmReason === null && !barcodeActive;

  const commitMatch = useCallback((next: LiveMatch | null) => {
    matchRef.current = next;
    setMatch(next);
  }, []);

  const commitCandidate = useCallback((next: LiveIdentityCandidate | null) => {
    candidateRef.current = next;
    setCandidate(next);
  }, []);

  const commitPackageDetected = useCallback((next: boolean) => {
    packageDetectedRef.current = next;
    setPackageDetected(next);
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
    (adopted: LiveMatch, options: { pin?: boolean } = {}) => {
      invalidateAuthority();
      const previousCandidates = candidateRef.current?.candidates ?? matchRef.current?.candidates ?? [];
      const suppliedCandidates = candidateList(adopted.candidates, adopted.food.code);
      const candidates =
        suppliedCandidates.length > 0
          ? suppliedCandidates
          : candidateList(previousCandidates, adopted.food.code);
      const next = { ...adopted, candidates };
      const pin = options.pin !== false;
      correctionPinnedUntilRef.current = pin ? nowRef.current() + CORRECTION_PIN_MS : 0;
      if (!pin) {
        // A confirmed camera proposal is not a 60-second manual correction. Resume the
        // scene loop without immediately proposing the same still frame again: the first
        // tick seeds its signature while this short hold is active, then a changed scene
        // can be identified normally.
        offscreenResumeRef.current = true;
        resumeHoldUntilRef.current = nowRef.current() + LIVE_INTERVAL_MS * 2;
      }
      commitCandidate(null);
      commitPackageDetected(false);
      commitMatch(next);
      setCarveOut(null);
      setNoMatchCandidates([]);
      setNoMatch(false);
      if (disarmReasonRef.current === "review") {
        disarmedRef.current = false;
        disarmReasonRef.current = null;
        setDisarmReason(null);
      }
      stashRef.current = { match: next, carveOut: null, at: nowRef.current() };
    },
    [candidateList, commitCandidate, commitMatch, commitPackageDetected, invalidateAuthority]
  );

  const identify = useCallback(async (options: { force?: boolean } = {}) => {
    const force = options.force === true;
    if (inFlightRef.current) {
      return;
    }
    if (!force && correctionPinnedUntilRef.current > nowRef.current()) {
      return;
    }
    // The viewfinder came back on screen less than an interval ago; hold the first send.
    if (!force && resumeHoldUntilRef.current > nowRef.current()) {
      return;
    }
    if (!force && candidateRef.current) {
      return;
    }
    if (!force && packageDetectedRef.current) {
      return;
    }
    const image = grabFrameRef.current();
    if (!image) {
      if (manual || force) setScanError("camera_not_ready");
      return;
    }
    if (force) invalidateAuthority();
    // A request is only launched after the scene-change gate has accepted a new frame.
    // The old scene must stop being authoritative at that point, even if this request
    // later times out, fails to parse, or returns an error. Keeping the prior match while
    // a different scene is being identified can expose and log a stale score indefinitely.
    correctionPinnedUntilRef.current = 0;
    stashRef.current = null;
    commitCandidate(null);
    commitMatch(null);
    setCarveOut(null);
    commitPackageDetected(false);
    setNoMatchCandidates([]);
    setNoMatch(false);
    inFlightRef.current = true;
    setInFlight(true);
    const requestEpoch = snapshotAuthority();
    identifyEpochRef.current = requestEpoch;
    const controller = new AbortController();
    identifyAbortRef.current?.abort();
    identifyAbortRef.current = controller;
    try {
      const response = await fetch("/api/food/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, passcode: passcodeRef.current }),
        signal: controller.signal
      });
      const json = (await response.json()) as {
        mode: string;
        reason?: NotScoreableReason | LiveScanError;
        match?: Omit<LiveMatch, "candidates">;
        candidate?: { food: LiveIdentityCandidate["food"] };
        candidates?: LiveCandidate[];
      };

      // Every authority transition advances synchronously. The old response is inert even
      // in the small window before React re-renders and aborts its fetch.
      if (controller.signal.aborted || !isAuthorityCurrent(requestEpoch) || barcodeActiveRef.current) {
        return;
      }

      if (json.mode === "unconfigured" || json.mode === "locked") {
        if (manual || force) {
          setScanError(json.mode);
          return;
        }
        disarmedRef.current = true;
        disarmReasonRef.current = "provider";
        setDisarmReason("provider");
        return;
      }
      if (json.mode === "candidate" || (json.mode === "match" && json.match)) {
        setLiveIdentifySucceeded(true);
      }
      if (json.mode === "error") {
        const reason = json.reason;
        setScanError(
          reason === "provider_quota" ||
            reason === "provider_rate_limit" ||
            reason === "provider_auth" ||
            reason === "provider_unavailable"
            ? reason
            : "network"
        );
        return;
      }
      // A correction may have landed while this paid request was in flight.
      if (correctionPinnedUntilRef.current > nowRef.current()) {
        return;
      }
      if (json.mode === "none" || json.mode === "carve_out") {
        // A semantic abstention belongs to the current scene. Keeping an older match here
        // would make the abstention invisible and could expose a stale score. A live image
        // is also never allowed to publish a carve-out without confirmation.
        correctionPinnedUntilRef.current = 0;
        stashRef.current = null;
        commitCandidate(null);
        commitMatch(null);
        setCarveOut(null);
        commitPackageDetected(false);
        setNoMatchCandidates(json.mode === "none" ? (json.candidates ?? []).slice(0, 3) : []);
        setNoMatch(true);
        return;
      }
      if (json.mode === "package") {
        invalidateAuthority();
        correctionPinnedUntilRef.current = 0;
        stashRef.current = null;
        commitCandidate(null);
        commitMatch(null);
        setCarveOut(null);
        setNoMatchCandidates([]);
        setNoMatch(false);
        commitPackageDetected(true);
        return;
      }
      setNoMatchCandidates([]);
      setNoMatch(false);
      commitPackageDetected(false);
      const proposedFood = json.candidate?.food ?? json.match?.food;
      if ((json.mode === "candidate" || json.mode === "match") && proposedFood) {
        invalidateAuthority();
        const next: LiveIdentityCandidate = {
          food: proposedFood,
          candidates: candidateList(json.candidates, proposedFood.code)
        };
        commitCandidate(next);
        commitMatch(null);
        setCarveOut(null);
        stashRef.current = null;
        disarmedRef.current = true;
        disarmReasonRef.current = "review";
        setDisarmReason("review");
      }
      // "error": the previous scene was cleared when this changed-scene request began.
    } catch {
      if ((manual || force) && !controller.signal.aborted) setScanError("network");
      // In scheduled mode a network hiccup is retried on the next tick.
    } finally {
      if (identifyAbortRef.current === controller) {
        identifyAbortRef.current = null;
        identifyEpochRef.current = null;
        inFlightRef.current = false;
        setInFlight(false);
      }
    }
  }, [candidateList, commitCandidate, commitMatch, commitPackageDetected, invalidateAuthority, isAuthorityCurrent, manual, snapshotAuthority]);

  const scan = useCallback(async () => {
    if (
      !manual ||
      !enabledRef.current ||
      !cameraActiveRef.current ||
      crisis ||
      barcodeActiveRef.current ||
      disarmReasonRef.current === "review" ||
      inFlightRef.current
    ) {
      return;
    }
    setScanError(null);
    await identify({ force: true });
  }, [crisis, identify, manual]);

  const rearm = useCallback(() => {
    if (disarmReasonRef.current === "provider" && !manual) {
      return;
    }
    invalidateAuthority();
    identifyAbortRef.current?.abort();
    identifyAbortRef.current = null;
    identifyEpochRef.current = null;
    inFlightRef.current = false;
    setInFlight(false);
    // "offscreen" and "crisis" each re-arm on their own condition alone. An explicit rearm
    // may clear the current food, but it must never claim the viewfinder is back on screen,
    // and it must never put a "Scan again" chip in front of a scroll.
    const gated = disarmReasonRef.current === "offscreen" || disarmReasonRef.current === "crisis";
    const wasDisarmed = disarmReasonRef.current !== null;
    correctionPinnedUntilRef.current = 0;
    // Dropping the stash too, or scrolling back would restore the food that was just plated.
    stashRef.current = null;
    commitCandidate(null);
    commitMatch(null);
    setCarveOut(null);
    commitPackageDetected(false);
    setNoMatchCandidates([]);
    setNoMatch(false);
    setScanError(null);
    if (gated) {
      return;
    }
    disarmedRef.current = false;
    disarmReasonRef.current = null;
    signatureRef.current = null;
    lastChangeRef.current = nowRef.current();
    setDisarmReason(null);
    if (
      !manual &&
      !wasDisarmed &&
      enabledRef.current &&
      cameraActiveRef.current &&
      !barcodeActiveRef.current &&
      !inFlightRef.current
    ) {
      void identify();
    }
  }, [commitCandidate, commitMatch, commitPackageDetected, identify, invalidateAuthority, manual]);

  const suspend = useCallback(() => {
    invalidateAuthority();
    identifyAbortRef.current?.abort();
    identifyAbortRef.current = null;
    identifyEpochRef.current = null;
    inFlightRef.current = false;
    setInFlight(false);
    correctionPinnedUntilRef.current = 0;
    stashRef.current = null;
    commitCandidate(null);
    commitMatch(null);
    commitPackageDetected(false);
    setCarveOut(null);
    setNoMatchCandidates([]);
    setNoMatch(false);
    disarmedRef.current = true;
    disarmReasonRef.current = "review";
    setDisarmReason("review");
  }, [commitCandidate, commitMatch, commitPackageDetected, invalidateAuthority]);

  const setVisibleRatio = useCallback(
    (ratio: number) => {
      visibleRatioRef.current = ratio;
      if (manual) {
        return;
      }
      if (disarmReasonRef.current === "offscreen") {
        if (ratio < GATE_RESUME_ABOVE) {
          return;
        }
        // Re-armed by ratio recovery, never by rearm(). Restore the stash first, so a scroll
        // inside the window re-shows the last match instead of buying a fresh identify.
        const stash = stashRef.current;
        if (stash && nowRef.current() - stash.at < VISION_RESTORE_MS) {
          commitMatch(stash.match);
          setCarveOut(stash.carveOut);
        }
        offscreenResumeRef.current = true;
        resumeHoldUntilRef.current = nowRef.current() + LIVE_INTERVAL_MS;
        disarmedRef.current = false;
        disarmReasonRef.current = null;
        setDisarmReason(null);
        return;
      }
      // Only the gate's own null state may pause. An idle, provider or crisis disarm keeps
      // its own reason and its own way back.
      if (disarmReasonRef.current === null && ratio < GATE_PAUSE_BELOW) {
        disarmedRef.current = true;
        disarmReasonRef.current = "offscreen";
        setDisarmReason("offscreen");
      }
    },
    [commitMatch, manual]
  );

  useEffect(() => {
    const identifyEpoch = identifyEpochRef.current;
    if (identifyEpoch === null || isAuthorityCurrent(identifyEpoch)) return;
    identifyAbortRef.current?.abort();
    identifyAbortRef.current = null;
    identifyEpochRef.current = null;
    inFlightRef.current = false;
    setInFlight(false);
  }, [args.authority?.epoch, isAuthorityCurrent]);

  useEffect(() => () => {
    identifyAbortRef.current?.abort();
    identifyAbortRef.current = null;
    identifyEpochRef.current = null;
  }, []);

  // --- crisis: an explicit disarm, never a side effect of an unmounted camera ---
  useEffect(() => {
    if (crisis) {
      invalidateAuthority();
      disarmedRef.current = true;
      disarmReasonRef.current = "crisis";
      setDisarmReason("crisis");
      return;
    }
    if (disarmReasonRef.current === "crisis") {
      disarmedRef.current = false;
      disarmReasonRef.current = null;
      setDisarmReason(null);
    }
  }, [crisis, invalidateAuthority]);

  // --- barcode preemption ---
  useEffect(() => {
    const wasActive = barcodeActiveRef.current;
    barcodeActiveRef.current = barcodeActive;
    if (barcodeActive && !wasActive) {
      // A detected barcode is a new authority claim. Never restore the preceding scene
      // after the code leaves the frame while its lookup or review is still in progress.
      correctionPinnedUntilRef.current = 0;
      stashRef.current = null;
      commitCandidate(null);
      commitMatch(null);
      setCarveOut(null);
      commitPackageDetected(false);
      setNoMatchCandidates([]);
      setNoMatch(false);
      return;
    }
    if (!barcodeActive && wasActive) {
      stashRef.current = null;
      commitCandidate(null);
      commitMatch(null);
      setCarveOut(null);
      commitPackageDetected(false);
      setNoMatchCandidates([]);
      setNoMatch(false);
    }
  }, [barcodeActive, commitCandidate, commitMatch, commitPackageDetected]);

  // --- the loop ---
  useEffect(() => {
    if (manual) {
      return;
    }
    if (!armed || disarmedRef.current) {
      return;
    }
    if (!canvasRef.current && typeof document !== "undefined") {
      canvasRef.current = document.createElement("canvas");
    }
    // Coming back from an off-screen pause is not a fresh arm. Keeping the scene signature
    // and the idle clock is what makes scrolling away and back cost zero calls, and it is
    // what keeps the gate from resetting AUTO_DISARM_MS bookkeeping.
    if (offscreenResumeRef.current) {
      offscreenResumeRef.current = false;
    } else {
      lastChangeRef.current = nowRef.current();
      signatureRef.current = null;
      // Fire immediately on arm so the first score does not wait a full interval.
      void identify();
    }

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
  }, [armed, identify, manual, videoRef]);

  const badge: LiveScoreBadge =
    !enabled ||
    !cameraActive ||
    packageDetected ||
    disarmReason === "provider" ||
    disarmReason === "crisis" ||
    disarmReason === "review"
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

  // An idle disarm already carries its own "Scan again" affordance on the badge, so it shows
  // no pill: the pill only ever reports a loop that is running, or one the gate paused.
  const loopState: LiveLoopState = manual
    ? !enabled ||
      !cameraActive ||
      barcodeActive ||
      packageDetected ||
      disarmReason === "crisis" ||
      disarmReason === "review"
      ? "unavailable"
      : inFlight
        ? "sending"
        : "searching"
    : !enabled ||
        !cameraActive ||
        barcodeActive ||
        packageDetected ||
        disarmReason === "provider" ||
        disarmReason === "crisis" ||
        disarmReason === "idle" ||
        disarmReason === "review"
      ? "unavailable"
      : disarmReason === "offscreen"
        ? "paused_offscreen"
        : match || carveOut || inFlight
          ? "sending"
          : "searching";

  return {
    badge,
    loopState,
    match,
    candidate,
    packageDetected,
    carveOut,
    noMatchCandidates,
    noMatch,
    armed,
    disarmReason,
    liveIdentifySucceeded,
    scanError,
    scan,
    adoptMatch,
    suspend,
    rearm,
    setVisibleRatio
  };
}
