"use client";

import React, { useState } from "react";
import { AiDataDisclosure } from "@/components/ai-data-disclosure";
import type { AiDataMode } from "@/domain/privacy-disclosure";
import { t, type Language } from "@/i18n/strings";
import type { LiveSessionStatus } from "@/ai/types";
import type { VoiceMode } from "@/hooks/use-food-voice-session";

export function FoodAskBar({
  mode,
  dataMode,
  status,
  onStart,
  onStop,
  onSendText,
  language
}: {
  mode: VoiceMode;
  dataMode: AiDataMode;
  status: LiveSessionStatus;
  onStart: () => void;
  onStop: () => void;
  onSendText: (text: string) => void;
  language: Language;
}) {
  const [text, setText] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    onSendText(trimmed);
    setText("");
  };

  if (mode === "unknown") {
    return (
      <div className="grid gap-2">
        <AiDataDisclosure compact language={language} mode={dataMode} />
        <button className="min-h-14 w-full rounded-control bg-care px-4 py-2 font-semibold text-white" onClick={onStart} type="button">
          {t(language, "tapToStart")}
        </button>
      </div>
    );
  }

  if (mode === "live") {
    return (
      <form className="grid gap-2" onSubmit={submit}>
        <AiDataDisclosure compact language={language} mode={dataMode} />
        <p className="text-sm text-ink/70">{t(language, "holdToTalkHint")}</p>
        <p className="text-sm text-ink/70">{t(language, "liveTypedHint")}</p>
        <input
          aria-label={t(language, "askPlaceholder")}
          className="min-h-14 rounded-control border border-ink/20 px-3 py-2"
          onChange={(event) => setText(event.target.value)}
          placeholder={t(language, "askPlaceholder")}
          value={text}
        />
        <button
          className="min-h-14 w-full rounded-control bg-care px-4 py-2 font-semibold text-white disabled:opacity-40"
          disabled={status === "thinking"}
          type="submit"
        >
          {t(language, "askButton")}
        </button>
        <button
          className="min-h-14 w-full rounded-control border border-care px-4 py-2 font-semibold text-care"
          onClick={onStop}
          type="button"
        >
          {t(language, "endSession")}
        </button>
      </form>
    );
  }

  return (
    <form className="grid gap-2" onSubmit={submit}>
      <AiDataDisclosure compact language={language} mode={dataMode} />
      <p className="text-sm text-ink/70">{t(language, "fallbackNotice")}</p>
      <input
        aria-label={t(language, "askPlaceholder")}
        className="min-h-14 rounded-control border border-ink/20 px-3 py-2"
        onChange={(event) => setText(event.target.value)}
        placeholder={t(language, "askPlaceholder")}
        value={text}
      />
      <button
        className="min-h-14 w-full rounded-control bg-care px-4 py-2 font-semibold text-white disabled:opacity-40"
        disabled={status === "thinking"}
        type="submit"
      >
        {t(language, "askButton")}
      </button>
    </form>
  );
}
