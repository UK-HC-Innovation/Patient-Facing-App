"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DoseCard } from "@/components/dose-card";
import { DoseReminderCard } from "@/components/dose-reminder-card";
import { HomeComposer } from "@/components/home-composer";
import { LanguageToggle } from "@/components/language-toggle";
import { TodayGreeting } from "@/components/today-greeting";
import { PostMealNudge } from "@/components/post-meal-nudge";
import { WeekInFoodCard } from "@/components/week-in-food-card";
import {
  getAdherenceStreak,
  getAdherenceRate,
  getDoseForDate,
  summarizeBpTrend,
  summarizeGlucoseTrend,
  toDateKey,
  type TrendSummary
} from "@/domain/adherence";
import { isDiabetesMedication, pickFeaturedMedication } from "@/domain/featured-medication";
import { activeConditions } from "@/domain/condition-lens";
import { summarizeWeekInFood } from "@/domain/food-week";
import { postMealCheckDue } from "@/domain/glucose-correlation";
import { isDoseReminderDue } from "@/domain/reminders";
import { screeningLens, screeningLensHref, screeningLensLine } from "@/domain/screening-status";
import { buildTodayTasks } from "@/domain/tasks";
import type { DoseEvent, MedicationBarrier } from "@/domain/types";
import { tScreening } from "@/i18n/strings";
import { useDoseReminder } from "@/hooks/use-dose-reminder";
import { useHealthState } from "@/state/store";

export default function TodayPage() {
  const { state, dispatch } = useHealthState();
  const tasks = buildTodayTasks(state);
  const featuredMedication = pickFeaturedMedication(state);
  const featuredIsDiabetes = featuredMedication ? isDiabetesMedication(featuredMedication) : false;
  const now = new Date();
  const todayKey = toDateKey(now);
  const todayDose = featuredMedication
    ? getDoseForDate(state.doseEvents, featuredMedication.id, todayKey)
    : undefined;
  const reminderDue = featuredMedication
    ? isDoseReminderDue(state.doseReminder, state.doseEvents, featuredMedication.id, now)
    : false;
  const { requestPermission } = useDoseReminder({
    preference: state.doseReminder,
    doseEvents: state.doseEvents,
    medicationId: featuredMedication?.id ?? null
  });
  const streak = featuredMedication ? getAdherenceStreak(state.doseEvents, featuredMedication.id, now) : 0;
  const rate = featuredMedication
    ? getAdherenceRate(state.doseEvents, featuredMedication.id, 7, now)
    : { taken: 0, of: 7 };
  // The featured medicine's own domain trend: blood sugar for a diabetes medicine,
  // blood pressure otherwise. When the card already shows glucose we do not repeat
  // it in the standalone panel below.
  const featuredTrend: TrendSummary | null = featuredIsDiabetes
    ? summarizeGlucoseTrend(state.glucoseReadings)
    : summarizeBpTrend(state.readings);
  const standaloneGlucoseTrend = featuredIsDiabetes ? null : summarizeGlucoseTrend(state.glucoseReadings);
  // The eye-care tile follows the glucose-tile idiom: the diabetes condition
  // lens says where the screening loop stands (due / booked / referred /
  // all-clear) and only renders when there is something to say.
  const eyeLens = screeningLens(state, now);
  const eyeLensHref = eyeLens ? screeningLensHref(eyeLens) : null;
  const weekInFood = summarizeWeekInFood(state.mealLog, now);
  const postMealNudge = activeConditions(state.carePlan).includes("diabetes")
    ? postMealCheckDue(state.mealLog, state.glucoseReadings, now)
    : null;

  function recordDose(status: DoseEvent["status"], barrier: MedicationBarrier | null) {
    if (!featuredMedication) {
      return;
    }

    const event: DoseEvent = {
      id: crypto.randomUUID(),
      patientId: state.patient.id,
      medicationId: featuredMedication.id,
      date: todayKey,
      status,
      barrier,
      recordedAt: new Date().toISOString()
    };
    dispatch({ type: "logDose", event });
  }

  return (
    <AppShell title="Today">
      <div className="space-y-4">
        <div className="flex justify-end">
          <LanguageToggle
            compact
            language={state.patient.language}
            onChange={(language) => dispatch({ type: "setLanguage", language })}
          />
        </div>
        <TodayGreeting patientName={state.patient.preferredName} tasks={tasks} language={state.patient.language} />
        <HomeComposer />
        {weekInFood ? <WeekInFoodCard summary={weekInFood} language={state.patient.language} /> : null}
        {postMealNudge ? <PostMealNudge meal={postMealNudge} language={state.patient.language} now={now} /> : null}
        {featuredMedication ? (
          <>
            <DoseCard
              medication={featuredMedication}
              todayDose={todayDose}
              streak={streak}
              rate={rate}
              readingCount={featuredIsDiabetes ? state.glucoseReadings.length : state.readings.length}
              trend={featuredTrend}
              onTake={() => recordDose("taken", null)}
              onSkip={(barrier) => recordDose("skipped", barrier)}
              onUndo={() => dispatch({ type: "undoDose", medicationId: featuredMedication.id, date: todayKey })}
            />
            <DoseReminderCard
              preference={state.doseReminder}
              due={reminderDue}
              onChange={(preference) => dispatch({ type: "setDoseReminder", preference })}
              onEnableNotifications={requestPermission}
            />
          </>
        ) : null}
        {standaloneGlucoseTrend ? (
          <section className="rounded-control border border-ink/10 bg-white p-4">
            <p className="text-sm font-medium text-care">Your blood sugar</p>
            <p className="mt-1 text-sm leading-6 text-ink/80">{standaloneGlucoseTrend.message}</p>
          </section>
        ) : null}
        {eyeLens ? (
          <section className="rounded-control border border-care/30 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-care">
              <Eye aria-hidden="true" className="h-4 w-4" />
              {tScreening(state.patient.language, eyeLens.kind === "due" ? "tileEyeCheckTitle" : "lensTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink/80">
              {screeningLensLine(eyeLens, state.patient.language)}
            </p>
            {eyeLensHref ? (
              <Link
                className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-control border border-care px-4 py-2 text-sm font-semibold text-care hover:bg-calm"
                href={eyeLensHref}
              >
                {eyeLens.kind === "due"
                  ? tScreening(state.patient.language, "tileEyeCheckCta")
                  : eyeLens.kind === "repeat"
                    ? tScreening(state.patient.language, "rebookNow")
                    : eyeLens.kind === "referred"
                      ? tScreening(state.patient.language, "seeLatestResult")
                      : tScreening(state.patient.language, "pageTitle")}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
