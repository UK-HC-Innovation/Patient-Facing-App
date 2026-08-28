import React from "react";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";

type GuidanceSource = "general" | "personalized";

const COPY_KEY: Record<GuidanceSource, FoodLensStringKey> = {
  general: "guidanceGeneral",
  personalized: "guidancePersonalized"
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
      className={`w-fit max-w-full break-words rounded-full px-3 py-1.5 text-xs font-semibold ${
        kind === "general" ? "bg-calm text-care" : "bg-amber-100 text-amber-900"
      }`}
      data-guidance-scope={kind}
    >
      {t(language, COPY_KEY[kind])}
    </p>
  );
}
