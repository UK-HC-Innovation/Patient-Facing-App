"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import { AppShell } from "@/components/app-shell";
import { MenuGrid } from "@/components/menu-grid";
import { tHome } from "@/i18n/home-strings";
import { useHealthState } from "@/state/store";

export default function MenuPage() {
  const router = useRouter();
  const { state, dispatch } = useHealthState();
  const language = state.patient.language;

  function startOver() {
    dispatch({ type: "resetDemo" });
    router.replace("/today");
  }

  // The one place a sample patient can be loaded, and it takes a deliberate tap.
  // Nothing loads Brent by default any more (critique H3, N1).
  function loadSamplePatient() {
    dispatch({ type: "resetDemo", patient: "brent" });
    router.replace("/screening?entry=sms");
  }

  return (
    <AppShell title={tHome(language, "navMenu")}>
      <div className="space-y-6">
        <section className="rounded-control border border-care/20 bg-white p-4">
          <p className="text-sm font-semibold text-care">{tHome(language, "menuDemoResetTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-ink/70">{tHome(language, "menuDemoResetBody")}</p>
          <button
            className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white"
            onClick={startOver}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {tHome(language, "menuDemoResetButton")}
          </button>
          <button
            className="mt-3 block text-sm font-semibold text-care underline"
            onClick={loadSamplePatient}
            type="button"
          >
            {tHome(language, "menuSamplePatientButton")}
          </button>
        </section>
        <MenuGrid language={language} />
      </div>
    </AppShell>
  );
}
