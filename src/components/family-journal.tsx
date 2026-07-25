"use client";

import React, { useMemo, useState } from "react";
import { FamilyFactCard } from "@/components/family-fact-card";
import type { FamilyFact, FamilyInterview, FamilyNavigatorState } from "@/domain/types";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

/** Screen-answer facts carry no interview and so no date; they sort last. */
const EARLIER_GROUP = "earlier";
const NUDGE_EVERY_NOTES = 5;

type JournalGroup = {
  key: string;
  label: string;
  facts: FamilyFact[];
  interviews: FamilyInterview[];
};

function locale(language: Language): string {
  return language === "es" ? "es" : "en-US";
}

function monthKey(createdAt: string): string {
  return createdAt.slice(0, 7);
}

function monthLabel(createdAt: string, language: Language): string {
  return new Date(createdAt).toLocaleDateString(locale(language), {
    month: "long",
    year: "numeric"
  });
}

function dayLabel(createdAt: string, language: Language): string {
  return new Date(createdAt).toLocaleDateString(locale(language), {
    month: "short",
    day: "numeric"
  });
}

// Every fact the family ever gave us, grouped by the month of the note it came
// from, newest month first. Nothing is filtered — exclusion is a packet
// decision, and it stays visible here with its badge.
function buildJournalGroups(family: FamilyNavigatorState, language: Language): JournalGroup[] {
  const interviewsById = new Map(family.interviews.map((interview) => [interview.id, interview]));
  const groups = new Map<string, JournalGroup>();

  for (const fact of family.facts) {
    const interview = fact.interviewId ? interviewsById.get(fact.interviewId) : undefined;
    const key = interview ? monthKey(interview.createdAt) : EARLIER_GROUP;
    const existing = groups.get(key);
    const group =
      existing ??
      {
        key,
        label: interview
          ? monthLabel(interview.createdAt, language)
          : tFamily(language, "journalEarlierGroup"),
        facts: [],
        interviews: []
      };
    group.facts.push(fact);
    if (interview && !group.interviews.some(({ id }) => id === interview.id)) {
      group.interviews.push(interview);
    }
    groups.set(key, group);
  }

  return [...groups.values()].sort((left, right) => {
    if (left.key === EARLIER_GROUP) return 1;
    if (right.key === EARLIER_GROUP) return -1;
    return right.key.localeCompare(left.key);
  });
}

export type FamilyJournalProps = {
  family: FamilyNavigatorState;
  language: Language;
  onConfirm: (factId: string) => void;
  onToggleInclude: (factId: string, include: boolean) => void;
};

export function FamilyJournal({ family, language, onConfirm, onToggleInclude }: FamilyJournalProps) {
  const groups = useMemo(() => buildJournalGroups(family, language), [family, language]);
  const [nudgeShownFor, setNudgeShownFor] = useState<number | null>(null);
  const noteCount = family.interviews.filter(({ kind }) => kind === "note").length;
  const nudgeDue =
    noteCount > 0 && noteCount % NUDGE_EVERY_NOTES === 0 && nudgeShownFor !== noteCount;

  return (
    <section
      id="family-journal"
      data-testid="family-journal"
      aria-labelledby="family-journal-title"
      className="rounded-control border border-care/20 bg-paper p-4"
    >
      <h2 id="family-journal-title" className="text-xl font-semibold">
        {tFamily(language, "journalTitle")}
      </h2>
      <p className="mt-1 break-words text-sm leading-6 text-ink/75">
        {tFamily(language, "journalIntro")}
      </p>

      {nudgeDue ? (
        <a
          href="#family-visit-packet"
          data-testid="family-journal-nudge"
          onClick={() => setNudgeShownFor(noteCount)}
          className={`mt-3 inline-flex min-h-12 min-w-0 items-center break-words rounded-control border border-care px-4 py-2 text-sm font-semibold text-care ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "journalExportNudge", { count: noteCount })}
        </a>
      ) : null}

      {groups.map((group) => (
        <div key={group.key} className="mt-5" data-testid="family-journal-month">
          <h3 className="break-words text-lg font-semibold">
            {tFamily(language, "journalMonthNote", {
              month: group.label,
              count: group.facts.length
            })}
          </h3>
          <div className="mt-3 grid gap-3">
            {group.facts.map((fact) => (
              <FamilyFactCard
                key={fact.id}
                fact={fact}
                language={language}
                onConfirm={onConfirm}
                includeToggle={{
                  included: fact.includeInSummary !== false,
                  onToggle: (include) => onToggleInclude(fact.id, include)
                }}
              />
            ))}
          </div>
          {group.interviews.map((interview) => (
            <details
              key={interview.id}
              data-testid="family-journal-raw-note"
              className="mt-3 rounded-control border border-ink/10 bg-white p-3"
            >
              <summary className={`min-h-12 min-w-0 break-words text-sm font-semibold ${CONTROL_FOCUS}`}>
                {`${tFamily(language, "factSource")} · ${dayLabel(interview.createdAt, language)}`}
              </summary>
              <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-ink/80">
                {interview.rawText}
              </p>
            </details>
          ))}
        </div>
      ))}

      <p className="mt-5 break-words text-sm leading-6 text-ink/70">
        {tFamily(language, "journalDeviceLine")}
      </p>
    </section>
  );
}
