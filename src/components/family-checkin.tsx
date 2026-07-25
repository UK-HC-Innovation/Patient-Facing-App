"use client";

import React, { useState } from "react";
import type { FamilyNavigatorState, FamilyPulse } from "@/domain/types";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const PROBE_SOURCE_URL = "https://www.cdc.gov/act-early/";

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

const ANSWER_BUTTON = `min-h-12 min-w-0 break-words rounded-control border border-care/30 bg-care/5 px-4 py-2 text-left font-semibold text-care ${CONTROL_FOCUS}`;

const PULSE_SCORES: ReadonlyArray<FamilyPulse["score"]> = [1, 2, 3, 4, 5];

type CheckinPart = "note" | "probe" | "pulse" | "done";

export type FamilyCheckinProps = {
  family: FamilyNavigatorState;
  language: Language;
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
  onOpenNote,
  onProbeAnswer,
  onPulse,
  onSkip
}: FamilyCheckinProps) {
  const [part, setPart] = useState<CheckinPart>("note");
  const [showingExamples, setShowingExamples] = useState(false);
  const givenName = family.profile?.childFirstName?.trim() ?? "";
  const name = givenName.length > 0 ? givenName : tFamily(language, "checkinChildFallback");

  function openNote(): void {
    // The note lands in the standing interview box, which stamps a touch and
    // would otherwise close this card mid-sequence — so the probe is queued up
    // for when the caregiver comes back down the page.
    setPart("probe");
    onOpenNote();
  }

  function answerProbe(answer: "no" | "yes"): void {
    setPart("pulse");
    onProbeAnswer(answer);
  }

  function recordPulse(score: FamilyPulse["score"]): void {
    setPart("done");
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
      <h2 id="family-checkin-title" className="text-xl font-semibold">
        {tFamily(language, "checkinTitle")}
      </h2>

      {part === "note" ? (
        <div className="mt-3">
          <p className="break-words font-semibold">
            {tFamily(language, "checkinNoteInvite", { name })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={openNote} className={ANSWER_BUTTON}>
              {tFamily(language, "checkinAddNote")}
            </button>
            <button type="button" onClick={() => setPart("probe")} className={ANSWER_BUTTON}>
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
