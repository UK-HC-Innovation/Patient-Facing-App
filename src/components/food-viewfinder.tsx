"use client";

import React, { type ReactNode, type RefObject } from "react";
import { t, type Language } from "@/i18n/strings";
import type { CameraStatus } from "@/hooks/use-food-camera";
import type { LiveSessionStatus } from "@/ai/types";
import type { CompassBand } from "@/domain/food-compass";
import type { LiveScanError } from "@/hooks/use-live-food-score";
import { CompassViewfinderBadge } from "./compass-score";

const statusKey: Record<LiveSessionStatus, Parameters<typeof t>[1]> = {
  idle: "statusIdle",
  connecting: "statusConnecting",
  listening: "statusListening",
  thinking: "statusThinking",
  speaking: "statusSpeaking",
  error: "statusError",
  closed: "statusIdle"
};

const scanErrorKey: Record<LiveScanError, Parameters<typeof t>[1]> = {
  camera_not_ready: "scanCameraNotReady",
  unconfigured: "scanUnconfigured",
  locked: "scanLocked",
  provider_quota: "scanProviderQuota",
  provider_rate_limit: "scanProviderRateLimit",
  provider_auth: "scanProviderAuth",
  provider_unavailable: "scanProviderUnavailable",
  network: "scanNetworkError"
};

export function FoodViewfinder({
  videoRef,
  cameraStatus,
  sessionStatus,
  scanChip,
  language,
  scoreBadge = "hidden",
  scoreFcs,
  scoreBand,
  scoreTier,
  scoreName,
  onScoreTap,
  onScan,
  scanPending = false,
  scanDisabled = false,
  scanError = null,
  hasScanResult = false,
  onCameraRetry,
  onVoiceStatusTap,
  showVoiceStatus = true,
  idleLabel,
  demoPreview = false,
  height = "55vh",
  trustPill
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  sessionStatus: LiveSessionStatus;
  scanChip: string | null;
  language: Language;
  scoreBadge?: "hidden" | "idle" | "pending" | "score" | "carve_out" | "scan_again";
  scoreFcs?: number;
  scoreBand?: CompassBand;
  scoreTier?: "T1" | "T2";
  scoreName?: string;
  onScoreTap?: () => void;
  /** The full camera surface is the explicit capture control. */
  onScan?: () => void;
  scanPending?: boolean;
  scanDisabled?: boolean;
  scanError?: LiveScanError | null;
  hasScanResult?: boolean;
  /** /food can retry camera permission or acquisition; /food/demo intentionally keeps its preview fallback. */
  onCameraRetry?: () => void;
  /** Makes an actionable voice-status message a real, touch-sized control. */
  onVoiceStatusTap?: () => void;
  /**
   * Some surfaces use an actionable voice pill. Others, including the automatic
   * Compass conversation, keep this as a status announcement only. Inside the scroll shell
   * the pinned voice bar owns the status instead, so this is off there.
   */
  showVoiceStatus?: boolean;
  /** Replaces food-specific idle copy before a food has been identified. */
  idleLabel?: string;
  /** Shows a deterministic sample scan instead of an empty panel when camera access is unavailable. */
  demoPreview?: boolean;
  /** The shell fixes this at 336px, the largest that still puts the verdict on screen one. */
  height?: string | number;
  /** Wordmark plus the guidance-source pill, the shell's top overlay. */
  trustPill?: ReactNode;
}) {
  const voiceStatus =
    idleLabel && (sessionStatus === "idle" || sessionStatus === "closed")
      ? idleLabel
      : t(language, statusKey[sessionStatus]);
  const voiceStatusClassName =
    "flex min-h-12 max-w-[calc(100%_-_1.5rem)] items-center gap-2 rounded-control border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-lg";
  const voiceStatusContent = (
    <>
      <span
        aria-hidden="true"
        className={`h-3 w-3 shrink-0 rounded-full ${
          sessionStatus === "listening"
            ? "animate-pulse bg-care"
            : sessionStatus === "speaking"
              ? "bg-care"
              : sessionStatus === "error"
                ? "bg-pulse"
                : onVoiceStatusTap
                  ? "bg-care"
                  : "bg-ink/45"
        }`}
      />
      <span>{voiceStatus}</span>
    </>
  );
  const scanLabel = t(
    language,
    scanPending ? "scanInProgress" : hasScanResult ? "tapToScanAgain" : "tapToScan"
  );

  return (
    <div className="relative overflow-clip bg-ink" style={{ height }}>
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label={t(language, "viewfinderHint")} />

      {demoPreview && cameraStatus !== "active" ? (
        <div
          aria-label={t(language, "demoPizzaPreview")}
          className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-black"
          role="img"
        >
          {/* A text-shadow, never a drop-shadow filter: a filtered glyph inside a scroll
              container re-rasterises on every frame of every scroll. */}
          <span aria-hidden="true" className="select-none text-8xl" style={{ textShadow: "0 14px 22px rgba(0,0,0,.65)" }}>
            🍕
          </span>
          <p className="absolute inset-x-4 bottom-16 rounded-control bg-black/80 px-3 py-2 text-center text-xs font-medium text-white">
            {t(language, "demoCameraUnavailable")}
          </p>
        </div>
      ) : null}

      {!demoPreview && cameraStatus === "denied" ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink/80 p-6 text-center text-sm text-white">
          <p>{t(language, "cameraDenied")}</p>
          {onCameraRetry ? (
            <button className="min-h-11 rounded-control bg-white px-4 py-2 font-semibold text-care" onClick={onCameraRetry} type="button">
              {t(language, "cameraRetry")}
            </button>
          ) : null}
        </div>
      ) : null}
      {!demoPreview && cameraStatus === "unavailable" ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink/80 p-6 text-center text-sm text-white">
          <p>{t(language, "cameraUnavailable")}</p>
          {onCameraRetry ? (
            <button className="min-h-11 rounded-control bg-white px-4 py-2 font-semibold text-care" onClick={onCameraRetry} type="button">
              {t(language, "cameraRetry")}
            </button>
          ) : null}
        </div>
      ) : null}

      {trustPill ? (
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-900/75 to-transparent p-3">
          <span className="pt-1 font-mono text-xs font-bold tracking-[.16em] text-white/90">
            {t(language, "shellWordmark")}
          </span>
          {trustPill}
        </div>
      ) : null}

      {onScan && cameraStatus === "active" && (!scanDisabled || scanPending) ? (
        <button
          aria-label={scanLabel}
          className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-transparent focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-white disabled:cursor-wait"
          disabled={scanPending}
          onClick={onScan}
          type="button"
        >
          <span className="flex min-h-12 items-center rounded-full border-2 border-white/90 bg-care px-6 py-3 text-base font-bold text-white shadow-lg transition active:scale-[0.98] motion-reduce:transition-none">
            {scanLabel}
          </span>
        </button>
      ) : null}

      {scanError ? (
        <p
          className="absolute inset-x-4 top-[64%] z-20 rounded-control bg-white px-3 py-2 text-center text-sm font-semibold text-pulse shadow-lg"
          role="alert"
        >
          {t(language, scanErrorKey[scanError])}
        </p>
      ) : null}

      {scanChip ? (
        <div
          className={`absolute left-3 z-20 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-ink ${
            trustPill ? "bottom-3 max-w-[70%] truncate" : "top-3"
          }`}
        >
          {scanChip}
        </div>
      ) : (
        <div className={`absolute left-3 z-20 rounded-control bg-black/75 px-3 py-1 text-xs font-medium text-white ${trustPill ? "bottom-3" : "top-3"}`}>
          {t(language, "scanHint")}
        </div>
      )}

      <CompassViewfinderBadge
        badge={scoreBadge}
        band={scoreBand}
        fcs={scoreFcs}
        language={language}
        name={scoreName}
        onTap={onScoreTap}
        placement={trustPill ? "bottom-right" : "top-right"}
        tier={scoreTier}
      />

      {showVoiceStatus ? (
        <div aria-live="polite" className="absolute inset-x-0 bottom-3 z-20 flex justify-center">
          {onVoiceStatusTap ? (
            <button
              className={`${voiceStatusClassName} cursor-pointer transition hover:bg-calm active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
              onClick={onVoiceStatusTap}
              type="button"
            >
              {voiceStatusContent}
            </button>
          ) : (
            <div className={voiceStatusClassName} role="status">
              {voiceStatusContent}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
