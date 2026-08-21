"use client";

import { AppShell } from "@/components/app-shell";
import { GlucoseInsights } from "@/components/glucose-insights";
import { GlucoseLogForm } from "@/components/glucose-log-form";
import { GlucoseReadingRow } from "@/components/glucose-reading-row";
import { PostMealNudge } from "@/components/post-meal-nudge";
import { interpretGlucose } from "@/domain/blood-glucose";
import { summarizeGlucoseTrend } from "@/domain/adherence";
import { activeConditions, selectLenses } from "@/domain/condition-lens";
import { postMealCheckDue, summarizeFoodGlucoseLink } from "@/domain/glucose-correlation";
import { annotateGlucoseWithMedContext } from "@/domain/glucose-med-context";
import { computeTimeInRange } from "@/domain/glucose-range";
import type { GlucoseReading } from "@/domain/types";
import { useHealthState } from "@/state/store";
import { VoiceCaptureCard, type GlucoseVoiceCaptureValues } from "@/voice/voice-capture-card";

export default function GlucosePage() {
  const { state, dispatch } = useHealthState();
  const latest = state.glucoseReadings.at(-1);
  const insight = latest ? interpretGlucose(latest, state.glucoseReadings.slice(0, -1), state.carePlan) : null;
  const trend = summarizeGlucoseTrend(state.glucoseReadings);
  const timeInRange = computeTimeInRange(state.glucoseReadings);
  const foodInsight = summarizeFoodGlucoseLink(
    state.mealLog,
    state.glucoseReadings,
    selectLenses(activeConditions(state.carePlan))
  );
  const now = new Date();
  const postMealNudge = activeConditions(state.carePlan).includes("diabetes")
    ? postMealCheckDue(state.mealLog, state.glucoseReadings, now)
    : null;
  const medContextByReadingId = new Map(
    annotateGlucoseWithMedContext(state.glucoseReadings, state.doseEvents, state.medications).map((context) => [
      context.reading.id,
      context
    ])
  );

  function saveReading(values: GlucoseVoiceCaptureValues): void {
    const reading: GlucoseReading = {
      id: crypto.randomUUID(),
      patientId: state.patient.id,
      valueMgDl: values.valueMgDl,
      measuredAt: new Date().toISOString(),
      contexts: values.contexts,
      note: values.note
    };
    dispatch({ type: "addGlucoseReading", reading });
  }

  return (
    <AppShell title="My Blood Sugar">
      <div className="grid gap-5">
        <section id="log-blood-sugar">
          <h2 className="text-xl font-semibold">Log blood sugar</h2>
          <p className="mt-1 text-sm leading-6 text-ink/75">
            Use the number from your meter. The app helps you notice patterns and prepare for visits.
          </p>
        </section>
        {postMealNudge ? <PostMealNudge meal={postMealNudge} language={state.patient.language} now={now} /> : null}
        <VoiceCaptureCard
          kind="glucose"
          language={state.patient.language}
          onSave={saveReading}
          voiceEntryContext={{ patientId: state.patient.id, dispatch }}
        />
        <GlucoseLogForm onSubmit={saveReading} />
        {insight ? (
          <section className="rounded-control border border-care/30 bg-calm p-4">
            <h2 className="text-lg font-semibold">
              Latest insight {insight.source === "care_plan" ? "from your care plan" : "from health education"}
            </h2>
            <p className="mt-2 text-sm leading-6">{insight.message}</p>
          </section>
        ) : null}
        {trend ? (
          <section className="rounded-control border border-ink/10 bg-white p-4">
            <h2 className="text-lg font-semibold">Your trend</h2>
            <p className="mt-2 text-sm leading-6">{trend.message}</p>
          </section>
        ) : null}
        <GlucoseInsights timeInRange={timeInRange} foodInsight={foodInsight} />
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Recent readings</h2>
          <p className="text-sm leading-6 text-ink/65">
            Tags show what your dose log says for that day - not medical advice.
          </p>
          {state.glucoseReadings.slice(-5).reverse().map((reading) => (
            <GlucoseReadingRow
              key={reading.id}
              reading={reading}
              status={medContextByReadingId.get(reading.id)?.status ?? "unknown"}
              medNames={medContextByReadingId.get(reading.id)?.medNames ?? []}
            />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
