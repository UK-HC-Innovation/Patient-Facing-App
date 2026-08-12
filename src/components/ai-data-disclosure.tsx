import React from "react";
import type { AiDataMode } from "@/domain/privacy-disclosure";
import { tPrivacy, type Language, type PrivacyStringKey } from "@/i18n/strings";

const modeKeys: Record<AiDataMode, { title: PrivacyStringKey; body: PrivacyStringKey }> = {
  checking: { title: "checkingTitle", body: "checkingBody" },
  on_device: { title: "onDeviceTitle", body: "onDeviceBody" },
  cloud_text: { title: "cloudTitle", body: "cloudBody" },
  live_voice: { title: "liveTitle", body: "liveBody" }
};

const coachModeKeys: Record<AiDataMode, { title: PrivacyStringKey; body: PrivacyStringKey }> = {
  checking: { title: "coachCheckingTitle", body: "coachCheckingBody" },
  on_device: { title: "coachOnDeviceTitle", body: "coachOnDeviceBody" },
  cloud_text: { title: "coachCloudTitle", body: "coachCloudBody" },
  live_voice: { title: "coachLiveTitle", body: "coachLiveBody" }
};

export function AiDataDisclosure({
  mode,
  language,
  compact = false,
  scope = "feature"
}: {
  mode: AiDataMode;
  language: Language;
  compact?: boolean;
  scope?: "feature" | "coach";
}) {
  const keys = scope === "coach" ? coachModeKeys[mode] : modeKeys[mode];

  return (
    <div
      aria-label={tPrivacy(language, keys.title)}
      className={compact ? "rounded-control bg-calm p-3 text-sm" : "mt-3 rounded-control border border-care/20 bg-white/70 p-3"}
    >
      <p className="font-semibold text-care">{tPrivacy(language, keys.title)}</p>
      <p className="mt-1 text-sm leading-6 text-ink/80">{tPrivacy(language, keys.body)}</p>
      {mode === "live_voice" ? (
        <p className="mt-1 text-sm leading-6 text-ink/80">{tPrivacy(language, "transcriptStored")}</p>
      ) : null}
    </div>
  );
}
