"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import type { MealLogEntry } from "@/domain/types";
import { t, type Language } from "@/i18n/strings";

export function postMealNudgeKey(meal: Pick<MealLogEntry, "id" | "mealId">): string {
  return `pm-nudge:${meal.mealId ?? meal.id}`;
}

function wasDismissed(key: string): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function PostMealNudge({ meal, language, now = new Date() }: { meal: MealLogEntry; language: Language; now?: Date }) {
  const storageKey = postMealNudgeKey(meal);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(wasDismissed(storageKey));
  }, [storageKey]);

  if (dismissed) {
    return null;
  }

  const elapsedHours = Math.max(1, Math.min(3, Math.round((now.valueOf() - new Date(meal.loggedAt).valueOf()) / 3_600_000)));
  const food = meal.food.brand ? `${meal.food.brand} ${meal.food.name}` : meal.food.name;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Per-tab persistence is a convenience; the visible dismissal still succeeds.
    }
    setDismissed(true);
  };

  return (
    <section className="rounded-control border border-care/30 bg-calm p-4">
      <h2 className="text-lg font-semibold">{t(language, "postMealNudgeTitle")}</h2>
      <p className="mt-1 text-sm leading-6 text-ink/80">
        {t(language, "postMealNudgeBody", { hours: elapsedHours, food })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link className="inline-flex min-h-11 items-center rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" href="/glucose#log-blood-sugar">
          {t(language, "postMealNudgeCta")}
        </Link>
        <button className="min-h-11 rounded-control border border-care px-4 py-2 text-sm font-semibold text-care" onClick={dismiss} type="button">
          {t(language, "postMealNudgeDismiss")}
        </button>
      </div>
    </section>
  );
}
