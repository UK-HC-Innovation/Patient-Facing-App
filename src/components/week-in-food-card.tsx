"use client";

import React from "react";
import Link from "next/link";
import { bandForScore, type CompassBand } from "@/domain/food-compass";
import type { WeekInFoodSummary } from "@/domain/food-week";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";

const bandClass: Record<CompassBand, string> = {
  encourage: "border-emerald-300 bg-emerald-50",
  moderate: "border-amber-300 bg-amber-50",
  minimize: "border-pulse/30 bg-pulse/5"
};

const bandLabel: Record<CompassBand, FoodLensStringKey> = {
  encourage: "compassBandEncourage",
  moderate: "compassBandModerate",
  minimize: "compassBandMinimize"
};

export function WeekInFoodCard({ summary, language }: { summary: WeekInFoodSummary; language: Language }) {
  const averageBand = bandForScore(summary.avgFcs);
  const bands: CompassBand[] = ["encourage", "moderate", "minimize"];

  return (
    <section className={`rounded-control border p-4 ${bandClass[averageBand]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t(language, "weekInFoodTitle")}</h2>
          <p className="text-sm text-ink/70">{t(language, "weekMealsLogged", { count: summary.meals })}</p>
        </div>
        <div className="rounded-control bg-white px-3 py-2 text-center shadow-sm">
          <p className="text-2xl font-semibold text-care">{summary.avgFcs}</p>
          <p className="text-[11px] font-medium text-ink/65">{t(language, "weekAverageItemScore")}</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">{t(language, "weekBandMix")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {bands.map((band) => (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink/75" key={band}>
              {t(language, bandLabel[band])}: {summary.bandCounts[band]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-1 text-sm text-ink/75 sm:grid-cols-2">
        <p>{t(language, "weekBest", { food: summary.best.name, score: summary.best.fcs })}</p>
        <p>{t(language, "weekRoom", { food: summary.worst.name, score: summary.worst.fcs })}</p>
      </div>

      <Link className="mt-3 inline-flex min-h-11 items-center rounded-control border border-care px-4 py-2 text-sm font-semibold text-care" href="/food">
        {t(language, "weekOpenFood")}
      </Link>
    </section>
  );
}
