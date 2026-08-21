"use client";

import React from "react";
import type { FoodFavorite } from "@/domain/types";
import type { RecentFoodPick } from "@/domain/food-recents";
import { t, type Language } from "@/i18n/strings";

function PickChips({
  items,
  language,
  onSelect
}: {
  items: Array<Pick<FoodFavorite, "foodId" | "description" | "fcs">>;
  language: Language;
  onSelect: (foodId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          aria-label={t(language, "savedFoodRescore", { food: item.description })}
          className="min-h-11 rounded-full border border-care/25 bg-white px-3 py-2 text-sm font-semibold text-care"
          key={item.foodId}
          onClick={() => onSelect(item.foodId)}
          type="button"
        >
          {item.description} · {item.fcs}
        </button>
      ))}
    </div>
  );
}

export function FoodSavedPicks({
  favorites,
  recents,
  language,
  onSelect
}: {
  favorites: FoodFavorite[];
  recents: RecentFoodPick[];
  language: Language;
  onSelect: (foodId: string) => void;
}) {
  if (favorites.length === 0 && recents.length === 0) {
    return null;
  }
  return (
    <section
      aria-label={t(language, "savedFoodsTitle")}
      className="grid gap-3 rounded-control border border-ink/10 bg-calm/40 p-3"
    >
      <h2 className="text-sm font-semibold">{t(language, "savedFoodsTitle")}</h2>
      {favorites.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/60">{t(language, "favoritesTitle")}</h3>
          <PickChips items={favorites} language={language} onSelect={onSelect} />
        </div>
      ) : null}
      {recents.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/60">{t(language, "foodRecentsTitle")}</h3>
          <PickChips items={recents} language={language} onSelect={onSelect} />
        </div>
      ) : null}
    </section>
  );
}
