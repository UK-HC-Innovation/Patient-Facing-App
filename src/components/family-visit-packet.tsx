"use client";

import React, { useId, useMemo, useState } from "react";
import {
  PACKET_QUESTIONS,
  buildFamilyVisitSummary
} from "@/domain/family-visit-packet";
import type { FamilyNavigatorState } from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

// Same verified CDC page the appointment card's prep block cites (plan 14).
const PREP_SOURCE_URL = "https://www.cdc.gov/act-early/";

// The builder owns what the packet says; this view only decides how each of its
// lines looks. Section headings are matched by value against the same four keys
// the builder pushes, so the printed page keeps real headings and lists without
// re-deriving a single line of content.
const PACKET_HEADING_KEYS: readonly FamilyStringKey[] = [
  "packetNoticedHeading",
  "packetFlagsHeading",
  "packetServicesHeading",
  "packetQuestionsHeading"
];

type PacketBlock =
  | { kind: "heading"; key: string; text: string }
  | { kind: "paragraph"; key: string; text: string }
  | { kind: "list"; key: string; items: string[] };

function packetBlocks(bodyLines: string[], headings: Set<string>): PacketBlock[] {
  const blocks: PacketBlock[] = [];
  for (const [index, line] of bodyLines.entries()) {
    if (line.length === 0) {
      continue;
    }
    if (line.startsWith("- ")) {
      const item = line.slice(2);
      const last = blocks.at(-1);
      if (last?.kind === "list") {
        last.items.push(item);
      } else {
        blocks.push({ kind: "list", key: `list-${index}`, items: [item] });
      }
      continue;
    }
    blocks.push({
      kind: headings.has(line) ? "heading" : "paragraph",
      key: `line-${index}`,
      text: line
    });
  }
  return blocks;
}

export type FamilyVisitPacketProps = {
  family: FamilyNavigatorState;
  language: Language;
  /** Fixed by the caller in tests; the footer date is the only clock the packet reads. */
  now?: Date;
  onToggleQuestion: (questionId: string) => void;
  onExport: (verb: "printed" | "copied") => void;
};

export function FamilyVisitPacket({
  family,
  language,
  now = new Date(),
  onToggleQuestion,
  onExport
}: FamilyVisitPacketProps) {
  const pickerId = useId();
  const [copied, setCopied] = useState(false);
  const summary = useMemo(
    () => buildFamilyVisitSummary(family, language, now),
    [family, language, now]
  );
  const title = summary.split("\n")[0];
  const blocks = useMemo(() => {
    const headings = new Set(PACKET_HEADING_KEYS.map((key) => tFamily(language, key)));
    return packetBlocks(summary.split("\n").slice(1), headings);
  }, [language, summary]);

  // Best-effort, on-device only: the text is already on the family's phone, and
  // nothing here sends it anywhere.
  async function copyPacket(): Promise<void> {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        return;
      }
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      onExport("copied");
    } catch {
      // A blocked clipboard is not an error worth interrupting the family with —
      // the packet is still on screen to read from or print.
    }
  }

  return (
    <section
      id="family-visit-packet"
      data-testid="family-visit-packet"
      aria-labelledby="family-visit-packet-title"
      className="family-visit-packet rounded-control border border-care/20 bg-white p-4"
    >
      <h2 id="family-visit-packet-title" className="break-words text-xl font-semibold">
        {title}
      </h2>

      <div className="family-visit-packet__actions mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onExport("printed");
            window.print();
          }}
          className={`min-h-12 min-w-0 break-words rounded-control bg-care px-4 py-2 font-semibold text-white ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "packetPrint")}
        </button>
        <button
          type="button"
          onClick={() => {
            void copyPacket();
          }}
          className={`min-h-12 min-w-0 break-words rounded-control border border-care px-4 py-2 font-semibold text-care ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "packetCopy")}
        </button>
        <p aria-live="polite" className="min-h-12 self-center break-words text-sm font-semibold text-care">
          {copied ? tFamily(language, "packetCopied") : ""}
        </p>
      </div>

      <div className="family-visit-packet__prep mt-4 rounded-control bg-paper p-3">
        <h3 className="break-words text-lg font-semibold">{tFamily(language, "packetPrepTitle")}</h3>
        <p className="mt-1 break-words text-sm leading-6 text-ink/80">
          {tFamily(language, "packetBringPacket")}
        </p>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm leading-6 text-ink/80">
          <li>{tFamily(language, "apptPrepBullet1")}</li>
          <li>{tFamily(language, "apptPrepBullet2")}</li>
          <li>{tFamily(language, "apptPrepBullet3")}</li>
        </ul>
        <a
          href={PREP_SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className={`mt-2 inline-flex min-h-12 items-center break-words text-sm font-semibold text-care underline ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "apptPrepSource")}
        </a>
      </div>

      <fieldset className="family-visit-packet__picker mt-4 rounded-control border border-ink/10 p-3">
        <legend className="break-words px-1 font-semibold">
          {tFamily(language, "packetPickTitle")}
        </legend>
        <div className="grid gap-1">
          {PACKET_QUESTIONS.map((question) => {
            const label = tFamily(language, question.labelKey);
            const inputId = `${pickerId}-${question.id}`;
            return (
              <label
                key={question.id}
                htmlFor={inputId}
                className="flex min-h-12 min-w-0 items-center gap-2 text-sm leading-6"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={family.packetQuestionIds.includes(question.id)}
                  onChange={() => onToggleQuestion(question.id)}
                  className={CONTROL_FOCUS}
                />
                <span className="min-w-0 break-words">{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div data-testid="family-visit-packet-body" className="mt-4 grid gap-2">
        {blocks.map((block) => {
          if (block.kind === "heading") {
            return (
              <h3 key={block.key} className="mt-2 break-words text-lg font-semibold">
                {block.text}
              </h3>
            );
          }
          if (block.kind === "list") {
            return (
              <ul key={block.key} className="grid list-disc gap-1 pl-5 text-sm leading-6 text-ink/80">
                {block.items.map((item, index) => (
                  <li key={`${block.key}-${index}`} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={block.key} className="break-words text-sm leading-6 text-ink/80">
              {block.text}
            </p>
          );
        })}
      </div>
    </section>
  );
}
