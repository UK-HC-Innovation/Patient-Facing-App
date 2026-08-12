"use client";

import React from "react";
import { Mic } from "lucide-react";
import { FamilyJournal } from "@/components/family-journal";
import {
  FamilyVisitPacket,
  type FamilyPacketOutputEvent
} from "@/components/family-visit-packet";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION_PAPER
} from "@/components/family-theme";
import type { FamilyNavigatorState } from "@/domain/types";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type LadderNotesSurfaceProps = {
  family: FamilyNavigatorState | null;
  durableFamily: FamilyNavigatorState | null;
  language: Language;
  childName: string;
  onOpenComposer: () => void;
  onConfirmFact: (factId: string) => void;
  onToggleFact: (factId: string, include: boolean) => void;
  onRejectFact: (factId: string) => void;
  onToggleQuestion: (questionId: string) => void;
  onPacketExport: (output: FamilyPacketOutputEvent) => void;
};

/**
 * The Notes surface is deliberately its own client chunk. Its journal grouping,
 * packet renderer, and export helpers are useful only after a caregiver opens
 * Notes, so Home should not pay their parse/evaluation cost.
 */
export function LadderNotesSurface({
  family,
  durableFamily,
  language,
  childName,
  onOpenComposer,
  onConfirmFact,
  onToggleFact,
  onRejectFact,
  onToggleQuestion,
  onPacketExport
}: LadderNotesSurfaceProps) {
  return (
    <>
      {family?.profile && family.facts.length === 0 ? (
        <section data-testid="family-notes-empty" className={CARD_SECTION_PAPER}>
          <h2 className="break-words text-lg font-semibold">
            {tFamily(language, "notesEmptyTitle")}
          </h2>
          <p className="mt-1 break-words leading-relaxed text-ink/80">
            {tFamily(language, "notesEmptyBody", { name: childName })}
          </p>
          <button
            type="button"
            data-testid="family-notes-add"
            onClick={onOpenComposer}
            className={`mt-4 inline-flex items-center gap-2 ${BTN_PRIMARY}`}
          >
            <Mic aria-hidden="true" className="h-5 w-5 shrink-0" />
            {tFamily(language, "notesEmptyCta")}
          </button>
        </section>
      ) : null}

      {family && family.facts.length > 0 ? (
        <FamilyJournal
          family={family}
          language={language}
          onConfirm={onConfirmFact}
          onToggleInclude={onToggleFact}
          onReject={onRejectFact}
        />
      ) : null}

      {family?.profile && family.facts.length > 0 ? (
        <p>
          <button
            type="button"
            data-testid="family-notes-add"
            onClick={onOpenComposer}
            className={BTN_SECONDARY}
          >
            {tFamily(language, "homeComposerCtaNamed", { name: childName })}
          </button>
        </p>
      ) : null}

      {durableFamily?.profile ? (
        <FamilyVisitPacket
          family={durableFamily}
          language={language}
          onToggleQuestion={onToggleQuestion}
          onExport={onPacketExport}
        />
      ) : null}
    </>
  );
}
