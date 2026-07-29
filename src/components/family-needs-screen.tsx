"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FAMILY_SCREEN_QUESTIONS,
  familyAnswersToFacts
} from "@/domain/family-screen";
import type { FamilyFact, FamilyScreenAnswer } from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyNeedsScreenProps = {
  language: Language;
  initialAnswers: FamilyScreenAnswer[];
  onSubmit: (answers: FamilyScreenAnswer[], facts: FamilyFact[]) => void;
};

const RESPONSE_CHOICES: FamilyScreenAnswer["response"][] = ["yes", "no", "declined"];

const QUESTION_KEYS: Record<string, FamilyStringKey> = {
  family_early_intervention: "screenEarlyIntervention",
  family_therapies: "screenTherapies",
  family_school_iep: "screenSchoolIep",
  family_waivers_financial: "screenWaiversFinancial",
  family_respite: "screenRespite",
  family_parent_support: "screenParentSupport",
  family_sibling_support: "screenSiblingSupport",
  family_transportation: "screenTransportation"
};

const RESPONSE_KEYS: Record<FamilyScreenAnswer["response"], FamilyStringKey> = {
  yes: "answerYes",
  no: "answerNo",
  declined: "answerDeclined"
};

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

export function FamilyNeedsScreen({ language, initialAnswers, onSubmit }: FamilyNeedsScreenProps) {
  const [responses, setResponses] = useState<Record<string, FamilyScreenAnswer["response"]>>(() =>
    Object.fromEntries(initialAnswers.map(({ questionId, response }) => [questionId, response]))
  );
  const [saved, setSaved] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const isComplete = FAMILY_SCREEN_QUESTIONS.every(({ id }) => responses[id] !== undefined);

  useEffect(() => {
    if (saved) {
      statusRef.current?.focus();
    }
  }, [saved]);

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!isComplete) return;
    const answers = FAMILY_SCREEN_QUESTIONS.map(({ id, domain }) => ({
      questionId: id,
      domain,
      response: responses[id]!
    }));
    onSubmit(answers, familyAnswersToFacts(answers, language));
    setSaved(true);
  }

  return (
    <section className="rounded-control border border-ink/10 bg-white p-4" aria-labelledby="family-screen-title">
      <h2 id="family-screen-title" tabIndex={-1} className="text-lg font-semibold">
        {tFamily(language, "screenTitle")}
      </h2>
      <p className="mt-1 leading-relaxed text-ink/80">{tFamily(language, "screenIntro")}</p>
      <form className="mt-4 grid gap-4" onSubmit={submit}>
        {FAMILY_SCREEN_QUESTIONS.map((question) => (
          <fieldset key={question.id} className="grid gap-2 rounded-control border border-ink/10 bg-paper p-4">
            <legend className="px-1 text-sm font-medium">
              {tFamily(language, QUESTION_KEYS[question.id])}
            </legend>
            <div className="flex flex-wrap gap-2">
              {RESPONSE_CHOICES.map((response) => {
                const inputId = `${question.id}-${response}`;
                return (
                  <label
                    key={response}
                    htmlFor={inputId}
                    className="inline-flex min-h-12 min-w-0 items-center gap-2 rounded-control border border-ink/15 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={question.id}
                      value={response}
                      checked={responses[question.id] === response}
                      onChange={() => {
                        setSaved(false);
                        setResponses((current) => ({ ...current, [question.id]: response }));
                      }}
                      className={CONTROL_FOCUS}
                    />
                    <span className="min-w-0 break-words">{tFamily(language, RESPONSE_KEYS[response])}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!isComplete}
            className={`min-h-12 min-w-0 break-words rounded-control bg-care px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "screenSubmit")}
          </button>
          <p
            ref={statusRef}
            role="status"
            tabIndex={-1}
            aria-live="polite"
            className="text-sm font-medium text-care"
          >
            {saved ? tFamily(language, "screenSaved") : ""}
          </p>
        </div>
      </form>
    </section>
  );
}
