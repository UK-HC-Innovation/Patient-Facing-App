"use client";

import React, { useMemo, useState } from "react";
import { FamilyFactCard } from "@/components/family-fact-card";
import { FamilyFoldSection } from "@/components/family-fold-section";
import type { FamilyFact, FamilyInterview, FamilyNavigatorState } from "@/domain/types";
import { traceFamilyFact } from "@/domain/family-evidence-provenance";
import { CARD_SECTION_PAPER, CONTROL_FOCUS } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

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

// The key and the label are read off the same local instant. Slicing the ISO
// string would file a note written late on the last evening of a month under
// the next month while the heading still said the previous one.
function monthKey(createdAt: string): string {
  const date = new Date(createdAt);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
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
  onReject: (factId: string) => void;
};

export function FamilyJournal({
  family,
  language,
  onConfirm,
  onToggleInclude,
  onReject
}: FamilyJournalProps) {
  const groups = useMemo(() => buildJournalGroups(family, language), [family, language]);
  const [nudgeShownFor, setNudgeShownFor] = useState<number | null>(null);
  const noteCount = family.interviews.filter(({ kind }) => kind === "note").length;
  const nudgeDue =
    noteCount > 0 && noteCount % NUDGE_EVERY_NOTES === 0 && nudgeShownFor !== noteCount;
  // The closed row counts what the month headings inside count — every entry the
  // family wrote, orientation included — and dates the newest, so it says
  // something true without being opened. Groups are newest-first already.
  const entryCount = family.interviews.length;
  const latestMonth = groups[0]?.label ?? "";
  const summaryLine =
    entryCount === 0
      ? tFamily(language, "journalIntro")
      : tFamily(language, entryCount === 1 ? "foldJournalSummaryOne" : "foldJournalSummary", {
          count: entryCount,
          month: latestMonth
        });

  return (
    <FamilyFoldSection
      id="family-journal"
      testId="family-journal"
      title={tFamily(language, "journalTitle")}
      titleId="family-journal-title"
      summaryLine={summaryLine}
      className={CARD_SECTION_PAPER}
    >
      <p className="mt-1 break-words leading-relaxed text-ink/80">
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
          {/* The count is the notes in this group — the ones opened below — not
              the facts they produced. Screen answers are nobody's note, so that
              group is named and left uncounted. */}
          <h3 className="break-words text-lg font-semibold">
            {group.interviews.length === 0
              ? group.label
              : tFamily(
                  language,
                  group.interviews.length === 1 ? "journalMonthNoteOne" : "journalMonthNote",
                  { month: group.label, count: group.interviews.length }
                )}
          </h3>
          {/* A checklist, not a stack of cards: one line per thing we wrote
              down, with the yes/no beside it and everything else one tap in. */}
          <ul
            data-testid="family-journal-checklist"
            className="mt-3 rounded-control border border-ink/10 bg-white px-3"
          >
            {group.facts.map((fact) => (
              <FamilyFactCard
                key={fact.id}
                fact={fact}
                evidenceTrace={traceFamilyFact(family, fact)}
                language={language}
                variant="row"
                onConfirm={onConfirm}
                includeToggle={{
                  included: fact.includeInSummary !== false,
                  onToggle: (include) => onToggleInclude(fact.id, include)
                }}
                onReject={onReject}
              />
            ))}
          </ul>
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
      <p className="mt-3 border-t border-ink/10 pt-3">
        <a
          /* F8.1: #family-experience is mapped to Home, so this link used to
             switch tabs out from under the reader. It stays on Notes. */
          href="#family-journal-title"
          className={`inline-flex min-h-12 min-w-0 items-center text-sm font-semibold text-ink/70 underline underline-offset-4 ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "backToTop")}
        </a>
      </p>
    </FamilyFoldSection>
  );
}
