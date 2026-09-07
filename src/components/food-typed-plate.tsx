"use client";

import React from "react";
import { t, type Language } from "@/i18n/strings";
import type { CompassBand } from "@/domain/food-compass";
import type { LiveMatch } from "@/hooks/use-live-food-score";
import type { TypedPlateItem } from "@/hooks/use-typed-food-score";

function bandClass(fcs: number): string {
  if (fcs >= 70) return "bg-emerald-100 text-emerald-900";
  if (fcs >= 31) return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-900";
}

function score(match: LiveMatch | null): number | null {
  return match ? match.score.fcs : null;
}

function band(match: LiveMatch | null): CompassBand | null {
  return match ? match.score.band : null;
}

/**
 * A whole plate typed on one line, scored.
 *
 * Sunday dinner used to come back as "We don't have a score for that one. Try a simpler
 * name." (critique G4). Lowest first, because the lowest one is the answer to the question
 * Brenda actually asked and never got answered: what should I cut back on.
 *
 * The directive is the interim rule in spec 30 R6, pending the nutrition lead: at least two
 * scored items, every item resolved, and the lowest one in the minimize band. `apple, banana`
 * printed "Cut back on Banana, raw first" over two of the highest scores in the table (E04).
 */
export function FoodTypedPlate({
  items,
  dropped = [],
  language,
  onRetry
}: {
  items: TypedPlateItem[];
  /** Names past the five-item cap, so a partial answer is never shown as a complete one. */
  dropped?: string[];
  language: Language;
  onRetry?: (query: string) => void;
}) {
  const scored = items
    .map((item) => ({ ...item, fcs: score(item.match), band: band(item.match) }))
    .sort((a, b) => (a.fcs ?? 999) - (b.fcs ?? 999));
  const lowest = scored.find((item) => item.fcs !== null);
  const scoredCount = scored.filter((item) => item.fcs !== null).length;
  const everyItemResolved = scored.every((item) => item.match !== null) && dropped.length === 0;
  const showDirective =
    scoredCount >= 2 && everyItemResolved && lowest?.match !== undefined && lowest?.band === "minimize";

  if (scored.length === 0) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-2" data-testid="food-typed-plate">
      <ul className="grid min-w-0 gap-1">
        {scored.map((item) => (
          <li
            className="flex min-w-0 items-center justify-between gap-3 rounded-control bg-white px-3 py-2 text-sm"
            key={`${item.query}-${item.match?.food.code ?? "none"}`}
          >
            <span className="min-w-0 truncate text-ink">
              {item.match?.food.description ?? item.query}
            </span>
            {item.fcs === null ? (
              item.failed && onRetry ? (
                <button
                  className="min-h-11 shrink-0 rounded-md border border-care/25 bg-white px-3 text-xs font-semibold text-care"
                  onClick={() => onRetry(item.query)}
                  type="button"
                >
                  {t(language, "retry")}
                </button>
              ) : (
                <span className="shrink-0 text-xs text-ink/70">{t(language, "typedPlateNoScore")}</span>
              )
            ) : (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold ${bandClass(item.fcs)}`}>
                {item.fcs}
              </span>
            )}
          </li>
        ))}
      </ul>
      {dropped.length > 0 ? (
        <p className="text-[13px] text-ink/70">
          {t(language, "typedPlateNotScored", { names: dropped.join(", ") })}
        </p>
      ) : null}
      {showDirective && lowest?.match ? (
        <p className="text-sm font-semibold text-ink">
          {t(language, "typedPlateCutBack", { food: lowest.match.food.description })}
        </p>
      ) : null}
    </div>
  );
}
