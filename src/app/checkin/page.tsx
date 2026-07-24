"use client";

import Link from "next/link";
import React from "react";
import { AppShell } from "@/components/app-shell";
import { INSTRUMENTS, getInstrument } from "@/domain/instruments/registry";
import { TIER0_BATTERY } from "@/domain/instruments/battery";
import { dueInstruments } from "@/domain/instruments/due";
import type { Language } from "@/i18n/strings";
import { useHealthState } from "@/state/store";
import { familyScreeningEntries } from "@/domain/family-screenings";

const COPY = {
  en: {
    title: "Screening hub",
    due: "Due now",
    upToDate: "You're up to date.",
    quickDueBelow: "Quick check is due below.",
    start: "Start",
    quick: "Quick check",
    quickBody: "Five short screens with follow-up questions only when needed.",
    quickStart: "Start the 2-minute check",
    worthChecking: "Worth checking",
    worthBody: "Optional adult health and screening checks.",
    draft: "Draft wording",
    family: "Ladder — family support",
    familyBody: "Continue to family and caregiver support.",
    forFamily: "For your family",
    forFamilyBody: "Age-appropriate child and teen check-ins based on the family profile.",
    preview: "Demo preview",
    history: "History",
    emptyHistory: "No completed check-ins yet.",
    historyResultFallback: "Result details unavailable.",
    fallbackTitle: "Check-in"
  },
  es: {
    title: "Centro de chequeos",
    due: "Para hacer ahora",
    upToDate: "Estás al día.",
    quickDueBelow: "El chequeo rápido está pendiente abajo.",
    start: "Comenzar",
    quick: "Chequeo rápido",
    quickBody: "Cinco chequeos breves con preguntas de seguimiento solo cuando sea necesario.",
    quickStart: "Comenzar el chequeo de 2 minutos",
    worthChecking: "Vale la pena revisar",
    worthBody: "Chequeos opcionales de salud y detección para adultos.",
    draft: "Redacción preliminar",
    family: "Ladder — apoyo familiar",
    familyBody: "Continúa al apoyo para familias y personas cuidadoras.",
    forFamily: "Para tu familia",
    forFamilyBody: "Chequeos infantiles y para adolescentes apropiados para la edad según el perfil familiar.",
    preview: "Vista previa de demostración",
    history: "Historial",
    emptyHistory: "Aún no hay chequeos completados.",
    historyResultFallback: "Los detalles del resultado no están disponibles.",
    fallbackTitle: "Chequeo"
  }
} satisfies Record<Language, Record<string, string>>;

export default function CheckinPage() {
  const { state } = useHealthState();
  const language = state.patient.language;
  const copy = COPY[language];
  const instruments = Object.values(INSTRUMENTS);
  const now = new Date();
  const dueCandidates = dueInstruments(state, now);
  const due = dueCandidates.flatMap((candidate) => {
    if (candidate.kind === "battery") {
      return [];
    }
    const instrument = getInstrument(candidate.id);
    return instrument ? [instrument] : [];
  });
  const dueIds = new Set(due.map(({ id }) => id));
  const batteryDue = dueCandidates.some((candidate) => candidate.kind === "battery");
  const worthChecking = instruments.filter(
    (instrument) =>
      instrument.tier === 2 &&
      instrument.licenseStatus === "clear" &&
      instrument.eligibility?.(state, now) !== false &&
      !dueIds.has(instrument.id)
  );
  const quickIsPreview = TIER0_BATTERY.some(
    (instrumentId) => getInstrument(instrumentId)?.licenseStatus !== "clear"
  );
  const history = [...state.assessmentEvents].sort(
    (left, right) => new Date(right.recordedAt).valueOf() - new Date(left.recordedAt).valueOf()
  );
  const familyEntries = state.family?.profile
    ? familyScreeningEntries(state.family.profile, now)
    : [];

  return (
    <AppShell title={copy.title}>
      <div className="grid gap-5">
        <section aria-label={copy.due} className="rounded-control border border-care/20 bg-calm p-5">
          <h2 className="text-xl font-semibold">{copy.due}</h2>
          {due.length === 0 ? (
            <p className="mt-2 text-sm text-ink/70">{batteryDue ? copy.quickDueBelow : copy.upToDate}</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {due.map((instrument) => (
                <Link
                  className="flex min-h-12 items-center justify-between gap-3 rounded-control bg-care px-4 py-3 font-semibold text-white"
                  href={`/checkin/${instrument.id}`}
                  key={instrument.id}
                >
                  <span>{instrument.title[language]}</span>
                  <span>{copy.start}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-control border border-ink/10 bg-white p-5">
          <h2 className="text-xl font-semibold">{copy.quick}</h2>
          {quickIsPreview || batteryDue ? (
            <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
              {quickIsPreview ? copy.preview : copy.due}
            </span>
          ) : null}
          <p className="mt-2 text-sm text-ink/70">{copy.quickBody}</p>
          <Link className="mt-3 inline-flex min-h-12 items-center rounded-control bg-care px-4 py-2 font-semibold text-white" href="/checkin/quick">
            {copy.quickStart}
          </Link>
        </section>

        <section aria-label={copy.worthChecking} className="rounded-control border border-ink/10 bg-white p-5">
          <h2 className="text-xl font-semibold">{copy.worthChecking}</h2>
          <p className="mt-2 text-sm text-ink/70">{copy.worthBody}</p>
          <div className="mt-3 grid gap-3">
            {worthChecking.map((instrument) => (
              <div className="rounded-control border border-ink/10 p-3" key={instrument.id}>
                <Link className="font-semibold text-care underline" href={`/checkin/${instrument.id}`}>
                  {instrument.title[language]}
                </Link>
                {!instrument.wordingVerified ? (
                  <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                    {copy.draft}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {familyEntries.length > 0 ? (
          <section
            aria-label={copy.forFamily}
            className="rounded-control border border-ink/10 bg-white p-5"
            id="for-family"
          >
            <h2 className="text-xl font-semibold">{copy.forFamily}</h2>
            <p className="mt-2 text-sm text-ink/70">{copy.forFamilyBody}</p>
            <div className="mt-3 grid gap-3">
              {familyEntries.map((entry) => {
                const familyInstrument = getInstrument(entry.routeId);
                if (!familyInstrument) {
                  return null;
                }
                return (
                  <div className="rounded-control border border-ink/10 p-3" key={entry.routeId}>
                    <Link className="font-semibold text-care underline" href={`/checkin/${entry.routeId}`}>
                      {familyInstrument.title[language]}
                    </Link>
                    {entry.exposure === "hub_preview" ? (
                      <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                        {copy.preview}
                      </span>
                    ) : null}
                    {!familyInstrument.wordingVerified ? (
                      <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                        {copy.draft}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {state.family ? (
          <section className="rounded-control border border-ink/10 bg-white p-5">
            <Link className="text-lg font-semibold text-care underline" href="/ladder">
              {copy.family}
            </Link>
            <p className="mt-2 text-sm text-ink/70">{copy.familyBody}</p>
          </section>
        ) : null}

        <section aria-label={copy.history} className="rounded-control border border-ink/10 bg-white p-5">
          <h2 className="text-xl font-semibold">{copy.history}</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-ink/70">{copy.emptyHistory}</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {history.map((event) => {
                const instrument = getInstrument(event.instrumentId);
                const bandSummary = instrument?.bandSummaries[event.severityBand]?.[language] ?? copy.historyResultFallback;
                return (
                  <li className="rounded-control border border-ink/10 p-3" key={event.id}>
                    <p className="font-medium">{instrument?.title[language] ?? copy.fallbackTitle}</p>
                    <p className="text-sm text-ink/70">{bandSummary}</p>
                    <time className="text-sm text-ink/60" dateTime={event.recordedAt}>
                      {new Date(event.recordedAt).toLocaleDateString(language === "es" ? "es-US" : "en-US", {
                        dateStyle: "medium"
                      })}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
