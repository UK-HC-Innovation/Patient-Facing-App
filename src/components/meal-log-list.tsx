"use client";

import React, { useState } from "react";
import { t, type Language } from "@/i18n/strings";
import type { MealLogEntry } from "@/domain/types";

function formatTime(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(language === "es" ? "es-US" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function pastMealTime(value: string, now = new Date()): string | null {
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime()) || candidate.getTime() > now.getTime()) {
    return null;
  }
  return candidate.toISOString();
}

type MealLogListProps = {
  entries: MealLogEntry[];
  language: Language;
  onAmendTime: (entryId: string, loggedAt: string) => void;
  onDelete: (entryId: string) => void;
};

export function MealLogList({ entries, language, onAmendTime, onDelete }: MealLogListProps) {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState("");
  const [timeErrorEntryId, setTimeErrorEntryId] = useState<string | null>(null);
  const [deleteConfirmEntryId, setDeleteConfirmEntryId] = useState<string | null>(null);

  const closeTimeEditor = () => {
    setEditingEntryId(null);
    setCustomTime("");
    setTimeErrorEntryId(null);
  };

  const amendByMinutes = (entryId: string, minutes: number) => {
    onAmendTime(entryId, new Date(Date.now() - minutes * 60_000).toISOString());
    closeTimeEditor();
  };

  const amendToCustomTime = (entryId: string) => {
    const loggedAt = pastMealTime(customTime);
    if (!loggedAt) {
      setTimeErrorEntryId(entryId);
      return;
    }
    onAmendTime(entryId, loggedAt);
    closeTimeEditor();
  };

  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{t(language, "recentMealsTitle")}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-ink/65">{t(language, "noMealsYet")}</p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-control border border-ink/10 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{entry.food.brand ? `${entry.food.brand} ${entry.food.name}` : entry.food.name}</p>
                <span className="text-xs text-ink/60">{formatTime(entry.loggedAt, language)}</span>
              </div>
              {entry.flags[0] ? <p className="mt-1 text-sm text-ink/70">{entry.flags[0]}</p> : null}
              {entry.assistantSummary ? <p className="mt-1 text-sm text-ink/60">{entry.assistantSummary}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  aria-controls={`meal-time-${entry.id}`}
                  aria-expanded={editingEntryId === entry.id}
                  className="min-h-10 rounded-control border border-care/30 px-3 py-1 text-sm font-medium text-care"
                  onClick={() => {
                    const nextId = editingEntryId === entry.id ? null : entry.id;
                    setEditingEntryId(nextId);
                    setCustomTime(nextId ? toDatetimeLocalValue(entry.loggedAt) : "");
                    setTimeErrorEntryId(null);
                    setDeleteConfirmEntryId(null);
                  }}
                  type="button"
                >
                  {t(language, "mealAteEarlier")}
                </button>
                {deleteConfirmEntryId === entry.id ? (
                  <span className="flex flex-wrap gap-2">
                    <button
                      className="min-h-10 rounded-control bg-pulse px-3 py-1 text-sm font-semibold text-white"
                      onClick={() => {
                        onDelete(entry.id);
                        setDeleteConfirmEntryId(null);
                      }}
                      type="button"
                    >
                      {t(language, "mealConfirmDelete")}
                    </button>
                    <button
                      className="min-h-10 rounded-control border border-ink/20 px-3 py-1 text-sm"
                      onClick={() => setDeleteConfirmEntryId(null)}
                      type="button"
                    >
                      {t(language, "mealCancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    className="min-h-10 rounded-control border border-pulse/30 px-3 py-1 text-sm font-medium text-pulse"
                    onClick={() => {
                      setDeleteConfirmEntryId(entry.id);
                      closeTimeEditor();
                    }}
                    type="button"
                  >
                    {t(language, "mealDelete")}
                  </button>
                )}
              </div>
              {editingEntryId === entry.id ? (
                <div className="mt-3 grid gap-2 rounded-control bg-calm/45 p-3" id={`meal-time-${entry.id}`}>
                  <p className="text-xs text-ink/70">{t(language, "mealTimeReason")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-full border border-care/25 bg-white px-3 py-2 text-sm" onClick={() => amendByMinutes(entry.id, 30)} type="button">
                      {t(language, "mealThirtyMinutesAgo")}
                    </button>
                    <button className="rounded-full border border-care/25 bg-white px-3 py-2 text-sm" onClick={() => amendByMinutes(entry.id, 60)} type="button">
                      {t(language, "mealOneHourAgo")}
                    </button>
                    <button className="rounded-full border border-care/25 bg-white px-3 py-2 text-sm" onClick={() => amendByMinutes(entry.id, 120)} type="button">
                      {t(language, "mealTwoHoursAgo")}
                    </button>
                  </div>
                  <label className="grid gap-1 text-sm font-medium" htmlFor={`meal-custom-time-${entry.id}`}>
                    {t(language, "mealCustomTime")}
                    <input
                      className="min-h-11 rounded-control border border-ink/20 bg-white px-3 py-2 font-normal"
                      id={`meal-custom-time-${entry.id}`}
                      onChange={(event) => {
                        setCustomTime(event.target.value);
                        setTimeErrorEntryId(null);
                      }}
                      type="datetime-local"
                      value={customTime}
                    />
                  </label>
                  {timeErrorEntryId === entry.id ? (
                    <p className="text-sm text-pulse" role="alert">
                      {t(language, "mealTimePastError")}
                    </p>
                  ) : null}
                  <button
                    className="min-h-10 justify-self-start rounded-control bg-care px-3 py-1 text-sm font-semibold text-white"
                    onClick={() => amendToCustomTime(entry.id)}
                    type="button"
                  >
                    {t(language, "mealSaveTime")}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
