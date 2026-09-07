"use client";

import React from "react";
import { t, type Language } from "@/i18n/strings";
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

/**
 * A whole plate typed on one line, scored.
 *
 * Sunday dinner used to come back as "We don't have a score for that one. Try a simpler
 * name." (critique G4). Lowest first, because the lowest one is the answer to the question
 * Brenda actually asked and never got answered: what should I cut back on.
 */
export function FoodTypedPlate({
  items,
  language
}: {
  items: TypedPlateItem[];
  language: Language;
}) {
  const scored = items
    .map((item) => ({ ...item, fcs: score(item.match) }))
    .sort((a, b) => (a.fcs ?? 999) - (b.fcs ?? 999));
  const lowest = scored.find((item) => item.fcs !== null);

  if (scored.length === 0) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-2">
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
              <span className="shrink-0 text-xs text-ink/60">{t(language, "typedPlateNoScore")}</span>
            ) : (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold ${bandClass(item.fcs)}`}>
                {item.fcs}
              </span>
            )}
          </li>
        ))}
      </ul>
      {lowest?.match ? (
        <p className="text-sm font-semibold text-ink">
          {t(language, "typedPlateCutBack").replace("{food}", lowest.match.food.description)}
        </p>
      ) : null}
    </div>
  );
}
