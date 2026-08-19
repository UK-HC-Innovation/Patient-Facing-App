import React from "react";
import type { Language } from "@/i18n/strings";

type GuidanceSource = "general" | "personalized";

const COPY: Record<Language, Record<GuidanceSource, string>> = {
  en: {
    general: "General nutrition: Food Compass only — no recent readings or health profile used.",
    personalized: "Personalized: considers your recent readings and health profile."
  },
  es: {
    general: "Nutrición general: solo Food Compass — no usa lecturas recientes ni tu perfil de salud.",
    personalized: "Personalizado: considera tus lecturas recientes y tu perfil de salud."
  }
};

export function FoodGuidanceSource({
  kind,
  language = "en"
}: {
  kind: GuidanceSource;
  language?: Language;
}) {
  return (
    <p
      aria-label="Guidance source"
      className={`w-fit max-w-full break-words rounded-full px-3 py-1.5 text-xs font-semibold ${
        kind === "general" ? "bg-calm text-care" : "bg-amber-100 text-amber-900"
      }`}
      data-guidance-scope={kind}
    >
      {COPY[language][kind]}
    </p>
  );
}
