"use client";

import React, { useState } from "react";
import { BTN_PRIMARY, CARD_SUBDUED, CONTROL_FOCUS } from "@/components/family-theme";
import type { FamilyResourcePreferences } from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const SCOPE_OPTIONS: ReadonlyArray<{
  value: FamilyResourcePreferences["scope"];
  key: FamilyStringKey;
}> = [
  { value: "no_preference", key: "preferencesScopeNone" },
  { value: "local_first", key: "preferencesScopeLocal" },
  { value: "statewide_first", key: "preferencesScopeStatewide" }
];

const CONTACT_OPTIONS: ReadonlyArray<{
  value: FamilyResourcePreferences["contact"];
  key: FamilyStringKey;
}> = [
  { value: "no_preference", key: "preferencesContactNone" },
  { value: "self_serve_first", key: "preferencesContactSelfServe" },
  { value: "call_first", key: "preferencesContactCall" },
  { value: "school_or_provider_first", key: "preferencesContactSchoolProvider" }
];

export type FamilyResourcePreferencesProps = {
  preferences: FamilyResourcePreferences;
  language: Language;
  onSave: (preferences: FamilyResourcePreferences) => void;
};

export function FamilyResourcePreferencesCard({
  preferences,
  language,
  onSave
}: FamilyResourcePreferencesProps) {
  const [scope, setScope] = useState(preferences.scope);
  const [contact, setContact] = useState(preferences.contact);
  const [saved, setSaved] = useState(false);

  return (
    <section data-testid="family-resource-preferences" className={CARD_SUBDUED}>
      <details>
        <summary className={`min-h-12 min-w-0 cursor-pointer rounded-control ${CONTROL_FOCUS}`}>
          <span className="block break-words font-semibold">{tFamily(language, "preferencesTitle")}</span>
          <span className="mt-1 block break-words text-sm leading-6 text-ink/70">
            {tFamily(language, "preferencesSummary")}
          </span>
        </summary>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ scope, contact });
            setSaved(true);
          }}
        >
          <p className="break-words text-sm leading-6 text-ink/80">
            {tFamily(language, "preferencesIntro")}
          </p>
          <p className="rounded-control bg-note/25 p-3 break-words text-sm leading-6 text-ink/80">
            {tFamily(language, "preferencesHonesty")}
          </p>
          <fieldset className="grid gap-2">
            <legend className="font-semibold">{tFamily(language, "preferencesScopeLegend")}</legend>
            {SCOPE_OPTIONS.map(({ value, key }) => (
              <label key={value} className="flex min-h-12 min-w-0 items-center gap-3">
                <input
                  type="radio"
                  name="family-resource-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => {
                    setScope(value);
                    setSaved(false);
                  }}
                  className={CONTROL_FOCUS}
                />
                <span className="min-w-0 break-words">{tFamily(language, key)}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="font-semibold">{tFamily(language, "preferencesContactLegend")}</legend>
            {CONTACT_OPTIONS.map(({ value, key }) => (
              <label key={value} className="flex min-h-12 min-w-0 items-center gap-3">
                <input
                  type="radio"
                  name="family-resource-contact"
                  value={value}
                  checked={contact === value}
                  onChange={() => {
                    setContact(value);
                    setSaved(false);
                  }}
                  className={CONTROL_FOCUS}
                />
                <span className="min-w-0 break-words">{tFamily(language, key)}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <button type="submit" className={BTN_PRIMARY}>
              {tFamily(language, "preferencesSave")}
            </button>
            {saved ? (
              <p role="status" className="mt-2 break-words text-sm text-care">
                {tFamily(language, "preferencesSaved")}
              </p>
            ) : null}
          </div>
        </form>
      </details>
    </section>
  );
}
