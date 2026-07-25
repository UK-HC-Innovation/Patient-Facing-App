"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FamilyNavigatorState, FamilyPulse } from "@/domain/types";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const PROBE_SOURCE_URL = "https://www.cdc.gov/act-early/";

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

const ANSWER_BUTTON = `min-h-12 min-w-0 break-words rounded-control border border-care/30 bg-care/5 px-4 py-2 text-left font-semibold text-care ${CONTROL_FOCUS}`;

const PULSE_SCORES: ReadonlyArray<FamilyPulse["score"]> = [1, 2, 3, 4, 5];

export type CheckinPart = "note" | "probe" | "pulse" | "done";

export type FamilyCheckinProps = {
  family: FamilyNavigatorState;
  language: Language;
  /**
   * Where the sequence stands. The page owns it, not this card: a probe yes
   * hands the page to the clinic-now card and unmounts the check-in, and the
   * caregiver must come back to the part they had not answered yet — never to
   * the top, which would re-ask the probe and raise a second flag.
   */
  part: CheckinPart;
  onPartChange: (part: CheckinPart) => void;
  /**
   * True when this mount continues a check-in the caregiver already started, so
   * a fresh mount (the return from the clinic-now card) puts focus back on the
   * card instead of leaving it on the body.
   */
  resuming: boolean;
  /** Opens the standing interview box for a `checkin` note. */
  onOpenNote: () => void;
  onProbeAnswer: (answer: "no" | "yes") => void;
  onPulse: (score: FamilyPulse["score"]) => void;
  onSkip: () => void;
};

/**
 * One month, three short parts, one question on screen at a time. Nothing here
 * gates anything: every part can be skipped, and skipping still counts as an
 * answer so the check-in does not come back tomorrow.
 */
export function FamilyCheckin({
  family,
  language,
  part,
  onPartChange,
  resuming,
  onOpenNote,
  onProbeAnswer,
  onPulse,
  onSkip
}: FamilyCheckinProps) {
  const [showingExamples, setShowingExamples] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // What was on screen last commit. A change means the caregiver just answered
  // and the control they pressed is gone, so focus has to be given somewhere.
  const shownRef = useRef<{ part: CheckinPart; showingExamples: boolean } | null>(null);
  // "Add a note" deliberately sends focus to the standing interview box; the
  // probe queued behind it must not snatch focus back out of the caregiver's
  // typing.
  const handedOffRef = useRef(false);
  const givenName = family.profile?.childFirstName?.trim() ?? "";
  const name = givenName.length > 0 ? givenName : tFamily(language, "checkinChildFallback");

  const question =
    part === "note"
      ? tFamily(language, "checkinNoteInvite", { name })
      : part === "probe"
        ? showingExamples
          ? `${tFamily(language, "probeExamples")} ${tFamily(language, "checkinProbe", { name })}`
          : tFamily(language, "checkinProbe", { name })
        : part === "pulse"
          ? tFamily(language, "pulseQuestion")
          : "";

  useEffect(() => {
    const previous = shownRef.current;
    shownRef.current = { part, showingExamples };
    const movedOn =
      previous === null
        ? resuming
        : previous.part !== part || previous.showingExamples !== showingExamples;
    const handedOff = handedOffRef.current;
    handedOffRef.current = false;
    if (movedOn && !handedOff) {
      headingRef.current?.focus();
    }
  }, [part, resuming, showingExamples]);

  function openNote(): void {
    // The note lands in the standing interview box, which stamps a touch and
    // would otherwise close this card mid-sequence — so the probe is queued up
    // for when the caregiver comes back down the page.
    handedOffRef.current = true;
    onPartChange("probe");
    onOpenNote();
  }

  function answerProbe(answer: "no" | "yes"): void {
    onPartChange("pulse");
    onProbeAnswer(answer);
  }

  function recordPulse(score: FamilyPulse["score"]): void {
    onPartChange("done");
    onPulse(score);
  }

  return (
    <section
      id="family-checkin"
      data-testid="family-checkin"
      data-checkin-part={part}
      aria-labelledby="family-checkin-title"
      className="rounded-control border border-care/20 bg-white p-4"
    >
      <h2
        id="family-checkin-title"
        ref={headingRef}
        tabIndex={-1}
        className={`text-xl font-semibold ${CONTROL_FOCUS}`}
      >
        {tFamily(language, "checkinTitle")}
      </h2>
      {/* The question that replaced the button the caregiver just pressed. */}
      <p
        data-testid="family-checkin-live-turn"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {question ? `${tFamily(language, "checkinTitle")}: ${question}` : ""}
      </p>

      {part === "note" ? (
        <div className="mt-3">
          <p className="break-words font-semibold">
            {tFamily(language, "checkinNoteInvite", { name })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={openNote} className={ANSWER_BUTTON}>
              {tFamily(language, "checkinAddNote")}
            </button>
            <button type="button" onClick={() => onPartChange("probe")} className={ANSWER_BUTTON}>
              {tFamily(language, "checkinNothingNew")}
            </button>
          </div>
        </div>
      ) : null}

      {part === "probe" ? (
        <div className="mt-3">
          <p className="break-words font-semibold">{tFamily(language, "checkinProbe", { name })}</p>
          {showingExamples ? (
            <div
              data-testid="family-checkin-probe-examples"
              className="mt-3 rounded-control bg-note/30 p-3"
            >
              <p className="break-words text-sm leading-6">{tFamily(language, "probeExamples")}</p>
              <a
                href={PROBE_SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className={`mt-2 inline-flex min-h-12 min-w-0 items-center break-words rounded-control text-sm font-semibold text-care underline ${CONTROL_FOCUS}`}
              >
                {tFamily(language, "probeExamplesSource")}
              </a>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => answerProbe("no")} className={ANSWER_BUTTON}>
              {tFamily(language, "checkinProbeNo")}
            </button>
            {showingExamples ? null : (
              <button
                type="button"
                onClick={() => setShowingExamples(true)}
                className={ANSWER_BUTTON}
              >
                {tFamily(language, "checkinProbeUnsure")}
              </button>
            )}
            <button type="button" onClick={() => answerProbe("yes")} className={ANSWER_BUTTON}>
              {tFamily(language, "checkinProbeYes")}
            </button>
          </div>
        </div>
      ) : null}

      {part === "pulse" ? (
        <div className="mt-3">
          <p id="family-checkin-pulse-question" className="break-words font-semibold">
            {tFamily(language, "pulseQuestion")}
          </p>
          <div
            role="group"
            aria-labelledby="family-checkin-pulse-question"
            className="mt-3 flex flex-wrap gap-2"
          >
            {PULSE_SCORES.map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => recordPulse(score)}
                className={`min-h-12 min-w-12 rounded-control border border-care/30 bg-care/5 px-4 py-2 font-semibold text-care ${CONTROL_FOCUS}`}
              >
                {score}
              </button>
            ))}
            <button type="button" onClick={onSkip} className={ANSWER_BUTTON}>
              {tFamily(language, "pulseSkip")}
            </button>
          </div>
        </div>
      ) : null}

      {part === "done" ? (
        <p role="status" className="mt-3 break-words text-sm leading-6">
          {tFamily(language, "checkinDone")}
        </p>
      ) : (
        <button
          type="button"
          onClick={onSkip}
          className={`mt-3 min-h-12 min-w-0 break-words rounded-control text-sm font-semibold text-ink/70 underline ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "checkinSkip")}
        </button>
      )}
    </section>
  );
}
