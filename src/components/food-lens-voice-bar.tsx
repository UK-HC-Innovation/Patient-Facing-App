"use client";

import React, { useState, type ReactNode } from "react";
import { t, type Language } from "@/i18n/strings";
import type { LiveSessionStatus } from "@/ai/types";
import type { VoiceMode } from "@/hooks/use-food-voice-session";

const STATUS_KEY: Record<LiveSessionStatus, Parameters<typeof t>[1]> = {
  idle: "statusIdle",
  connecting: "statusConnecting",
  listening: "statusListening",
  thinking: "statusThinking",
  speaking: "statusSpeaking",
  error: "statusError",
  closed: "statusIdle"
};

function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

/**
 * Pinned, not dragged.
 *
 * It sticks to the bottom of the viewport at every scroll position, so the mic is always in
 * the thumb arc without a gesture to learn. The transcript grows upward from the same bar
 * -- it is rendered above the control row, so opening it never moves the mic.
 *
 * Where live voice is not available, or the camera is denied, the bar inverts: the keyboard
 * becomes the primary control and the mic the secondary one, which is what the shipped
 * fallback copy already promises.
 */
export function FoodLensVoiceBar({
  language,
  mode,
  status,
  onStart,
  onStop,
  onSendText,
  typedInput,
  keyboardPrimary = false,
  idleLabel,
  lastTurn,
  transcript
}: {
  language: Language;
  mode: VoiceMode;
  status: LiveSessionStatus;
  onStart: () => void;
  onStop: () => void;
  onSendText?: (text: string) => void;
  /** /compass renders no text box at all -- not a hidden one. */
  typedInput: boolean;
  keyboardPrimary?: boolean;
  idleLabel?: string;
  lastTurn?: string | null;
  transcript?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const live = mode === "live";
  const listening = status === "listening" || status === "speaking";
  const statusLabel =
    idleLabel && (status === "idle" || status === "closed") ? idleLabel : t(language, STATUS_KEY[status]);
  // Typed input is a capability, and where voice cannot run it is the primary one. While a
  // live session is up the mic leads and the text box lives in the expanded transcript.
  const showTypedRow = typedInput && (keyboardPrimary || !live);
  const showTypedInPanel = typedInput && !showTypedRow;
  const expandable = transcript !== undefined || showTypedInPanel;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length === 0 || !onSendText) {
      return;
    }
    onSendText(trimmed);
    setText("");
  };

  const typedForm = (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <input
        aria-label={t(language, "askPlaceholder")}
        className="min-h-11 min-w-0 flex-1 rounded-md border border-white/25 bg-white px-3 text-sm text-ink"
        onChange={(event) => setText(event.target.value)}
        placeholder={t(language, "askPlaceholder")}
        value={text}
      />
      <button
        className="min-h-11 shrink-0 rounded-md bg-care px-4 text-sm font-semibold text-white disabled:opacity-40"
        disabled={status === "thinking"}
        type="submit"
      >
        {t(language, "askButton")}
      </button>
    </form>
  );

  return (
    // [&>*]:min-w-0 is load-bearing: a grid item's default `min-width: auto` is its
    // min-content width, and the truncated last-turn line is one unbreakable string. Without
    // it the bar takes the width of the whole sentence and the phone shrink-to-fits the page.
    <div className="grid gap-3 [&>*]:min-w-0">
      {open ? (
        <div className="grid max-h-[180px] gap-2 overflow-y-auto border-b border-white/15 pb-3">
          {transcript ?? <p className="text-sm text-white/70">{t(language, "compassConversationWaiting")}</p>}
          {showTypedInPanel ? (
            <>
              <p className="text-xs text-white/70">{t(language, "liveTypedHint")}</p>
              {typedForm}
            </>
          ) : null}
        </div>
      ) : null}

      {showTypedRow ? (
        <>
          <p className="text-xs text-white/70">
            {keyboardPrimary ? t(language, "micReadyOrType") : t(language, "fallbackNotice")}
          </p>
          {typedForm}
        </>
      ) : null}

      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="flex h-6 shrink-0 items-end gap-[3px]">
          {[0, 1, 2, 3, 4].map((bar) => (
            <span
              className={`w-1 rounded-sm ${
                listening ? "h-6 animate-pulse bg-emerald-300 motion-reduce:animate-none" : "h-5 bg-white/30"
              }`}
              key={bar}
              style={listening ? { animationDelay: `${bar * 120}ms` } : undefined}
            />
          ))}
        </div>
        {/* Collapsed, the second line previews the last turn. Expanded, the log below is
            the turn, so the preview steps aside rather than printing it twice. Where the
            surface keeps its transcript as a content block instead, this is a status
            readout and not a control at all -- a toggle with nothing to toggle is worse
            than no toggle. */}
        {expandable ? (
          <button
            aria-expanded={open}
            className="min-h-11 min-w-0 flex-1 text-left"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <span className="block text-sm font-semibold text-white/65">
              {open ? t(language, "transcriptCollapse") : t(language, "transcriptExpand")}
            </span>
            <span className="block truncate text-[15px] font-semibold text-white">
              {open ? statusLabel : lastTurn ?? statusLabel}
            </span>
          </button>
        ) : (
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white" role="status">
            {lastTurn ?? statusLabel}
          </p>
        )}
        <button
          aria-label={listening ? t(language, "endSession") : t(language, "tapToStart")}
          className={`grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full text-white ${
            listening ? "bg-care" : "bg-white/15"
          }`}
          onClick={listening ? onStop : onStart}
          type="button"
        >
          <MicIcon />
        </button>
      </div>
    </div>
  );
}
