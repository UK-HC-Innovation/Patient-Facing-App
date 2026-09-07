"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { t, type Language } from "@/i18n/strings";
import type { LiveSessionStatus } from "@/ai/types";

const STATUS_KEY: Record<LiveSessionStatus, Parameters<typeof t>[1]> = {
  idle: "statusIdle",
  connecting: "statusConnecting",
  listening: "statusListening",
  thinking: "statusThinking",
  speaking: "statusSpeaking",
  error: "statusError",
  closed: "statusIdle"
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-white/70 ${open ? "rotate-180" : ""}`}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

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
  status,
  onStart,
  onStop,
  onSendText,
  typedInput,
  idleLabel,
  lastTurn,
  micAvailable = true,
  openSignal = 0,
  transcript
}: {
  language: Language;
  status: LiveSessionStatus;
  onStart: () => void;
  onStop: () => void;
  onSendText?: (text: string) => void;
  /** The public door renders no text box at all -- not a hidden one. */
  typedInput: boolean;
  idleLabel?: string;
  lastTurn?: string | null;
  /**
   * A build with no live provider renders no mic at all. A button that says "Listening,
   * just talk." to nobody is worse than no button (critique H8, H9, and the project rule
   * that a key-dependent feature must fail visibly).
   */
  micAvailable?: boolean;
  /**
   * Bumped by the door whenever something new arrives that the person has to see: an
   * answer, or a safety intercept. Every persona who typed a question in the critique got
   * their reply into a panel that was closed, behind a tap they had no reason to make.
   */
  openSignal?: number;
  transcript?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const listening = status === "listening" || status === "speaking";

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);
  const statusLabel =
    idleLabel && (status === "idle" || status === "closed") ? idleLabel : t(language, STATUS_KEY[status]);
  // Typed input is a capability, and where it exists it is always reachable. It used to
  // live inside the collapsed transcript panel while a live session was up, which is how
  // a hung session took the keyboard away with it (critique F5, G2, H2).
  const showTypedRow = typedInput;
  const expandable = transcript !== undefined;

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

  const statusLine = (
    <span className="block min-w-0 truncate text-[13px] font-semibold text-white/85">
      {open ? statusLabel : lastTurn ?? statusLabel}
    </span>
  );

  return (
    // [&>*]:min-w-0 is load-bearing: a grid item's default `min-width: auto` is its
    // min-content width, and the truncated last-turn line is one unbreakable string. Without
    // it the bar takes the width of the whole sentence and the phone shrink-to-fits the page.
    <div className="grid gap-2 [&>*]:min-w-0">
      {open ? (
        <div className="grid max-h-[180px] gap-2 overflow-y-auto border-b border-white/15 pb-3">
          {transcript ?? <p className="text-sm text-white/70">{t(language, "compassConversationWaiting")}</p>}
        </div>
      ) : null}

      {/* One slim line, not two. "Show the conversation" was a whole row of its own, and
          with the panel open the bar plus nav took 45% of an 812px phone (critique N7). */}
      {expandable ? (
        <button
          aria-expanded={open}
          aria-label={open ? t(language, "transcriptCollapse") : t(language, "transcriptExpand")}
          className="flex min-w-0 items-center gap-1 text-left"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <ChevronIcon open={open} />
          {statusLine}
        </button>
      ) : (
        <p className="min-w-0 truncate text-[13px] font-semibold text-white/85" role="status">
          {lastTurn ?? statusLabel}
        </p>
      )}

      <div className="flex items-center gap-2">
        {showTypedRow ? (
          <div className="min-w-0 flex-1">{typedForm}</div>
        ) : (
          <>
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
            <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white" role="status">
              {lastTurn ?? statusLabel}
            </p>
          </>
        )}
        {micAvailable ? (
          <button
            aria-label={listening ? t(language, "endSession") : t(language, "tapToStart")}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white ${
              listening ? "bg-care" : "bg-white/15"
            }`}
            onClick={listening ? onStop : onStart}
            type="button"
          >
            <MicIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}
