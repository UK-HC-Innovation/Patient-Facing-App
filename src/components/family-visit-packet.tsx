"use client";

import React, { useId, useMemo, useState } from "react";
import { downloadTextFile } from "@/components/family-download";
import { FamilyFoldSection } from "@/components/family-fold-section";
import { shareFamilyPacketText } from "@/components/family-share";
import {
  PACKET_QUESTIONS,
  buildFamilyVisitSummary
} from "@/domain/family-visit-packet";
import type { FamilyNavigatorState } from "@/domain/types";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, CONTROL_FOCUS } from "@/components/family-theme";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

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

export type FamilyPacketExportVerb = "printed" | "copied" | "saved" | "shared";

export type FamilyVisitPacketProps = {
  family: FamilyNavigatorState;
  language: Language;
  /** Fixed by the caller in tests; the footer date is the only clock the packet reads. */
  now?: Date;
  onToggleQuestion: (questionId: string) => void;
  onExport: (verb: FamilyPacketExportVerb) => void;
};

/** Every receipt this card can show, success and failure alike. */
type PacketReceipt =
  | "packetCopied"
  | "packetCopyFailed"
  | "packetSaved"
  | "packetSaveFailed"
  | "packetShareReceipt"
  | "packetShareCopiedReceipt"
  | "packetShareUnavailable";

export function FamilyVisitPacket({
  family,
  language,
  now = new Date(),
  onToggleQuestion,
  onExport
}: FamilyVisitPacketProps) {
  const pickerId = useId();
  const consentId = useId();
  const [receipt, setReceipt] = useState<PacketReceipt | null>(null);
  const [sharing, setSharing] = useState(false);
  const [consented, setConsented] = useState(false);
  const [shareBlocked, setShareBlocked] = useState(false);
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
      if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
        setReceipt("packetCopyFailed");
        return;
      }
      await navigator.clipboard.writeText(summary);
      setReceipt("packetCopied");
      onExport("copied");
    } catch {
      // A blocked clipboard used to fail silently into an empty live region —
      // a caregiver tapped Copy, nothing happened, and nothing said so.
      setReceipt("packetCopyFailed");
    }
  }

  /**
   * The audit line is a receipt, so it waits for the print flow to finish
   * instead of firing on the tap — a dialog that never opened used to leave
   * "Printed" behind it. Honest limitation, stated where it lives: `afterprint`
   * also fires when the dialog is dismissed, and no browser exposes a
   * "paper actually came out" signal, so this narrows the false receipt to
   * "the dialog ran" rather than eliminating it.
   */
  function printPacket(): void {
    if (typeof window === "undefined") return;
    if ("onafterprint" in window) {
      const settle = (): void => {
        window.removeEventListener("afterprint", settle);
        onExport("printed");
      };
      window.addEventListener("afterprint", settle);
    } else {
      // Older engine with no event: keep the receipt rather than lose it.
      onExport("printed");
    }
    window.print();
  }

  /**
   * F3b. A plain-text file of exactly what is on screen — included,
   * non-rejected facts and nothing else. Built from a Blob and revoked
   * immediately: no network, no endpoint, no copy anywhere but this device
   * (FR-8).
   */
  function savePacket(): void {
    if (!downloadTextFile(`${tFamily(language, "packetFileName")}.txt`, summary)) {
      setReceipt("packetSaveFailed");
      return;
    }
    setReceipt("packetSaved");
    onExport("saved");
  }

  /**
   * The one exit that leaves the device. Behind the same two-tap consent the
   * resource cards use, with copy that names what is in the text rather than
   * calling it "a summary" (FR-7).
   */
  async function sharePacket(): Promise<void> {
    if (!consented) {
      setShareBlocked(true);
      return;
    }
    const outcome = await shareFamilyPacketText({ title, text: summary });
    setSharing(false);
    setConsented(false);
    setShareBlocked(false);
    if (outcome === "cancelled") return;
    if (outcome === "unavailable") {
      setReceipt("packetShareUnavailable");
      return;
    }
    setReceipt(outcome === "shared" ? "packetShareReceipt" : "packetShareCopiedReceipt");
    onExport("shared");
  }

  return (
    <FamilyFoldSection
      id="family-visit-packet"
      testId="family-visit-packet"
      title={title}
      titleId="family-visit-packet-title"
      summaryLine={tFamily(language, "foldPacketSummary")}
      className={`family-visit-packet ${CARD_SECTION}`}
    >
      <div className="family-visit-packet__actions mt-3 grid gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={printPacket} className={BTN_PRIMARY}>
            {tFamily(language, "packetPrint")}
          </button>
          <button
            type="button"
            onClick={() => {
              void copyPacket();
            }}
            className={BTN_SECONDARY}
          >
            {tFamily(language, "packetCopy")}
          </button>
          <button
            type="button"
            data-testid="family-packet-save"
            onClick={savePacket}
            className={BTN_SECONDARY}
          >
            {tFamily(language, "packetSave")}
          </button>
          {sharing ? null : (
            <button
              type="button"
              data-testid="family-packet-share-open"
              aria-expanded={false}
              onClick={() => setSharing(true)}
              className={BTN_SECONDARY}
            >
              {tFamily(language, "packetShare")}
            </button>
          )}
        </div>

        {/* Two taps, one consent — and the consent names what is in the text.
            This is the only exit that leaves the device. */}
        {sharing ? (
          <div
            data-testid="family-packet-share-consent"
            className="grid gap-2 rounded-control border border-ink/15 bg-paper p-3"
          >
            <label htmlFor={consentId} className="flex min-h-12 min-w-0 items-start gap-2 text-sm leading-6">
              <input
                id={consentId}
                type="checkbox"
                checked={consented}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setConsented(checked);
                  if (checked) setShareBlocked(false);
                }}
                className={`mt-1 ${CONTROL_FOCUS}`}
              />
              <span className="min-w-0 break-words">{tFamily(language, "packetShareConsent")}</span>
            </label>
            {shareBlocked ? (
              <p role="alert" className="break-words text-sm font-medium text-pulse">
                {tFamily(language, "resourceShareConsentRequired")}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-blocked={!consented ? "true" : undefined}
                data-testid="family-packet-share"
                onClick={() => {
                  void sharePacket();
                }}
                className={`${BTN_SECONDARY} ${!consented ? "opacity-50" : ""}`}
              >
                {tFamily(language, "packetShare")}
              </button>
            </div>
          </div>
        ) : null}

        {/* One live region for every outcome, success and failure alike: a
            blocked clipboard used to be a tap that did nothing and said nothing. */}
        <p
          role="status"
          aria-live="polite"
          data-testid="family-packet-receipt"
          className="min-h-12 break-words text-sm font-semibold text-care"
        >
          {receipt === null ? "" : tFamily(language, receipt)}
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
    </FamilyFoldSection>
  );
}
