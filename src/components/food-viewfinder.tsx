"use client";

import React, { type RefObject } from "react";
import { t, type Language } from "@/i18n/strings";
import type { CameraStatus } from "@/hooks/use-food-camera";
import type { LiveSessionStatus } from "@/ai/types";
import type { CompassBand } from "@/domain/food-compass";
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
  showVoiceStatus = true
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  sessionStatus: LiveSessionStatus;
  scanChip: string | null;
  language: Language;
  scoreBadge?: "hidden" | "idle" | "pending" | "score" | "carve_out";
  scoreFcs?: number;
  scoreBand?: CompassBand;
  scoreTier?: "T1" | "T2";
  scoreName?: string;
  onScoreTap?: () => void;
  /**
   * The pill reads "Tap start to talk about this food". On a surface with no voice
   * control it points at a button that is not on screen, so it is suppressed there.
   */
  showVoiceStatus?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-control border border-ink/10 bg-ink" style={{ height: "55vh" }}>
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label={t(language, "viewfinderHint")} />

      {cameraStatus === "denied" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/80 p-6 text-center text-sm text-white">
          {t(language, "cameraDenied")}
        </div>
      ) : null}
      {cameraStatus === "unavailable" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/80 p-6 text-center text-sm text-white">
          {t(language, "cameraUnavailable")}
        </div>
      ) : null}

      {scanChip ? (
        <div className="absolute left-3 top-3 rounded-control bg-white/90 px-3 py-1 text-xs font-semibold text-ink">{scanChip}</div>
      ) : (
        <div className="absolute left-3 top-3 rounded-control bg-black/40 px-3 py-1 text-xs font-medium text-white">
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
        tier={scoreTier}
      />

      {showVoiceStatus ? (
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <div className="flex items-center gap-2 rounded-control bg-white/90 px-4 py-2 text-sm font-semibold text-ink">
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-full ${
              sessionStatus === "listening"
                ? "animate-pulse bg-care"
                : sessionStatus === "speaking"
                  ? "bg-care"
                  : sessionStatus === "error"
                    ? "bg-pulse"
                    : "bg-ink/30"
            }`}
          />
          {t(language, statusKey[sessionStatus])}
        </div>
      </div>
      ) : null}
    </div>
  );
}
