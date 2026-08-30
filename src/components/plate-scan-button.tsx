"use client";

import React from "react";
import type { PlateCandidate } from "@/domain/plate-scan";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";

/**
 * Door-local: only /food imports this, so the shared Food Lens layer and the store-free
 * witness are untouched. The public door has no plate and keeps not having one.
 */
export type PlateScanOutcome = {
  /** One inline line: the scan failed, saw nothing, or cannot run without a key. */
  notice: Extract<
    FoodLensStringKey,
    "plateScanFailed" | "plateScanEmpty" | "plateScanUnavailable"
  > | null;
  /** Carve-outs and dead ends, named once so the patient knows what did not land. */
  skipped: string[];
  /** Named but unmatched: the ledger rows worth offering as a one-tap add. */
  unmatched: Array<{ id: string; name: string; candidates: PlateCandidate[] }>;
};

export const EMPTY_PLATE_SCAN_OUTCOME: PlateScanOutcome = { notice: null, skipped: [], unmatched: [] };

export function PlateScanButton({
  language,
  busy,
  unavailable,
  disabled = false,
  onScan,
  outcome,
  onSelectCandidate
}: {
  language: Language;
  busy: boolean;
  /** The camera key is missing, so a tap could only ever fail. Say so beside the button. */
  unavailable: boolean;
  disabled?: boolean;
  onScan: () => void;
  outcome?: PlateScanOutcome | null;
  onSelectCandidate?: (foodId: string) => void;
}) {
  // A button that silently does nothing is banned; an unavailable scan says why instead.
  const notice = unavailable ? "plateScanUnavailable" : (outcome?.notice ?? null);
  const skipped = outcome?.skipped ?? [];
  const unmatched = outcome?.unmatched ?? [];

  return (
    <div className="grid gap-2" data-testid="plate-scan">
      <button
        className="min-h-14 w-full rounded-control border border-care bg-white px-4 py-2 font-semibold text-care disabled:opacity-40"
        disabled={busy || unavailable || disabled}
        onClick={onScan}
        type="button"
      >
        {t(language, busy ? "plateScanBusy" : "plateScanButton")}
      </button>

      {notice ? <p className="text-xs text-ink/70">{t(language, notice)}</p> : null}

      {skipped.length > 0 ? (
        <p className="text-xs text-ink/70">{t(language, "plateSkipped", { items: skipped.join(", ") })}</p>
      ) : null}

      {unmatched.map((item) => (
        <div className="grid gap-1" key={item.id}>
          <p className="text-[13px] font-semibold text-ink/70">{item.name}</p>
          <div className="flex flex-wrap gap-2">
            {item.candidates.slice(0, 3).map((candidate) => (
              <button
                className="min-h-11 max-w-full break-words rounded-full border border-care/25 bg-white px-3 py-1 text-left text-sm font-medium text-care"
                key={candidate.code}
                onClick={() => onSelectCandidate?.(candidate.code)}
                type="button"
              >
                {candidate.description}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
