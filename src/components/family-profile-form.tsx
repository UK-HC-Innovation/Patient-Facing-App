"use client";

import React, { useId, useState } from "react";
import { KY_COUNTIES } from "@/domain/family-resources";
import type { ChildDiagnosis, DevDiagnosis, FamilyProfile } from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyProfileFormProps = {
  language: Language;
  initialProfile: FamilyProfile | null;
  defaultCounty?: string;
  onSave: (profile: FamilyProfile) => void;
};

const DIAGNOSIS_OPTIONS: ReadonlyArray<{ label: DevDiagnosis; key: FamilyStringKey }> = [
  { label: "autism", key: "diagnosisAutism" },
  { label: "adhd", key: "diagnosisAdhd" },
  { label: "dyslexia", key: "diagnosisDyslexia" },
  { label: "speech_language", key: "diagnosisSpeechLanguage" },
  { label: "developmental_delay", key: "diagnosisDevelopmentalDelay" },
  { label: "intellectual_disability", key: "diagnosisIntellectualDisability" },
  { label: "down_syndrome", key: "diagnosisDownSyndrome" },
  { label: "other", key: "diagnosisOther" }
];

const SCHOOL_OPTIONS: ReadonlyArray<{ value: FamilyProfile["schoolStage"]; key: FamilyStringKey }> = [
  { value: "not_school_age", key: "schoolNotSchoolAge" },
  { value: "preschool", key: "schoolPreschool" },
  { value: "elementary", key: "schoolElementary" },
  { value: "middle", key: "schoolMiddle" },
  { value: "high", key: "schoolHigh" },
  { value: "post_high", key: "schoolPostHigh" }
];

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

function normalizedCounty(value?: string): string {
  const normalized = value?.trim().replace(/\s+County$/i, "") ?? "";
  return KY_COUNTIES.includes(normalized) ? normalized : "";
}

function monthLabel(language: Language, diagnosisLabel: string): string {
  const suffix = tFamily(language, "profileDiagnosisDateLabel");
  return `${diagnosisLabel} ${suffix.charAt(0).toLocaleLowerCase(language === "es" ? "es" : "en")}${suffix.slice(1)}`;
}

export function FamilyProfileForm({
  language,
  initialProfile,
  defaultCounty,
  onSave
}: FamilyProfileFormProps) {
  // The strip disclosure and the setup panel can both mount this form at once;
  // fixed ids would bind every label to whichever copy came first in the document.
  const uid = useId();
  const [county, setCounty] = useState(
    normalizedCounty(initialProfile?.county) || normalizedCounty(defaultCounty)
  );
  const [childFirstName, setChildFirstName] = useState(initialProfile?.childFirstName ?? "");
  const [birthYear, setBirthYear] = useState(initialProfile ? String(initialProfile.birthYear) : "");
  const [birthMonth, setBirthMonth] = useState(
    initialProfile?.birthMonth === undefined ? "" : String(initialProfile.birthMonth)
  );
  const [schoolStage, setSchoolStage] = useState<FamilyProfile["schoolStage"]>(
    initialProfile?.schoolStage ?? "not_school_age"
  );
  const [diagnoses, setDiagnoses] = useState<ChildDiagnosis[]>(
    () => initialProfile?.diagnoses.map((diagnosis) => ({ ...diagnosis })) ?? []
  );
  const [birthYearError, setBirthYearError] = useState(false);
  const [otherDiagnosisError, setOtherDiagnosisError] = useState(false);
  const [saved, setSaved] = useState(false);

  function markEdited(): void {
    setSaved(false);
  }

  function toggleDiagnosis(label: DevDiagnosis): void {
    markEdited();
    if (label === "other") {
      setOtherDiagnosisError(false);
    }
    setDiagnoses((current) => {
      const existing = current.find((diagnosis) => diagnosis.label === label);
      if (existing) {
        return current.filter((diagnosis) => diagnosis.id !== existing.id);
      }
      return [...current, { id: crypto.randomUUID(), label }];
    });
  }

  function updateDiagnosis(label: DevDiagnosis, update: Partial<ChildDiagnosis>): void {
    markEdited();
    setDiagnoses((current) =>
      current.map((diagnosis) => (diagnosis.label === label ? { ...diagnosis, ...update } : diagnosis))
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsedBirthYear = Number(birthYear);
    const currentYear = new Date().getFullYear();
    const invalidBirthYear =
      !/^\d{4}$/.test(birthYear) ||
      !Number.isInteger(parsedBirthYear) ||
      parsedBirthYear < 1900 ||
      parsedBirthYear > currentYear;
    const invalidOtherDiagnosis = diagnoses.some(
      (diagnosis) => diagnosis.label === "other" && !diagnosis.otherLabel?.trim()
    );
    setBirthYearError(invalidBirthYear);
    setOtherDiagnosisError(invalidOtherDiagnosis);
    if (invalidBirthYear || invalidOtherDiagnosis || county.length === 0) {
      return;
    }

    const trimmedFirstName = childFirstName.trim();
    const normalizedDiagnoses = diagnoses.map((diagnosis) => {
      const diagnosedAt = diagnosis.diagnosedAt?.trim();
      const otherLabel = diagnosis.otherLabel?.trim();
      return {
        id: diagnosis.id,
        label: diagnosis.label,
        ...(diagnosis.label === "other" && otherLabel ? { otherLabel } : {}),
        ...(diagnosedAt ? { diagnosedAt } : {})
      };
    });
    onSave({
      ...(trimmedFirstName ? { childFirstName: trimmedFirstName } : {}),
      birthYear: parsedBirthYear,
      ...(birthMonth ? { birthMonth: Number(birthMonth) } : {}),
      schoolStage,
      county,
      diagnoses: normalizedDiagnoses
    });
    setSaved(true);
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-1 text-sm font-medium" htmlFor={`${uid}-county`}>
          {tFamily(language, "profileCountyLabel")}
          <select
            id={`${uid}-county`}
            required
            value={county}
            onChange={(event) => {
              markEdited();
              setCounty(event.target.value);
            }}
            className={`min-h-12 rounded-control border border-ink/20 bg-white px-3 py-2 ${CONTROL_FOCUS}`}
          >
            <option value="">{tFamily(language, "profileCountyPlaceholder")}</option>
            {KY_COUNTIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium" htmlFor={`${uid}-child-first-name`}>
          {tFamily(language, "profileChildNameLabel")}
          <input
            id={`${uid}-child-first-name`}
            value={childFirstName}
            placeholder={tFamily(language, "profileChildNamePlaceholder")}
            onChange={(event) => {
              markEdited();
              setChildFirstName(event.target.value);
            }}
            className={`min-h-12 rounded-control border border-ink/20 px-3 py-2 ${CONTROL_FOCUS}`}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium" htmlFor={`${uid}-birth-year`}>
            {tFamily(language, "profileBirthYearLabel")}
            <input
              id={`${uid}-birth-year`}
              inputMode="numeric"
              aria-invalid={birthYearError}
              aria-describedby={birthYearError ? `${uid}-birth-year-error` : undefined}
              value={birthYear}
              placeholder={tFamily(language, "profileBirthYearPlaceholder")}
              onChange={(event) => {
                markEdited();
                setBirthYearError(false);
                setBirthYear(event.target.value);
              }}
              className={`min-h-12 rounded-control border border-ink/20 px-3 py-2 ${CONTROL_FOCUS}`}
            />
            {birthYearError ? (
              <span id={`${uid}-birth-year-error`} role="alert" className="text-sm font-medium text-rose-700">
                {tFamily(language, "profileBirthYearError")}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1 text-sm font-medium" htmlFor={`${uid}-birth-month`}>
            {tFamily(language, "profileBirthMonthLabel")}
            <select
              id={`${uid}-birth-month`}
              value={birthMonth}
              onChange={(event) => {
                markEdited();
                setBirthMonth(event.target.value);
              }}
              className={`min-h-12 rounded-control border border-ink/20 bg-white px-3 py-2 ${CONTROL_FOCUS}`}
            >
              <option value="">{tFamily(language, "profileBirthMonthOptional")}</option>
              {Array.from({ length: 12 }, (_, offset) => String(offset + 1)).map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-sm font-medium" htmlFor={`${uid}-school-stage`}>
          {tFamily(language, "profileSchoolStageLabel")}
          <select
            id={`${uid}-school-stage`}
            value={schoolStage}
            onChange={(event) => {
              markEdited();
              setSchoolStage(event.target.value as FamilyProfile["schoolStage"]);
            }}
            className={`min-h-12 rounded-control border border-ink/20 bg-white px-3 py-2 ${CONTROL_FOCUS}`}
          >
            {SCHOOL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {tFamily(language, option.key)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="grid gap-3 rounded-control border border-ink/10 p-3">
          <legend className="px-1 text-sm font-semibold">{tFamily(language, "profileDiagnosesLabel")}</legend>
          {DIAGNOSIS_OPTIONS.map((option) => {
            const diagnosis = diagnoses.find((candidate) => candidate.label === option.label);
            const diagnosisLabel = tFamily(language, option.key);
            const checkboxId = `${uid}-diagnosis-${option.label}`;
            return (
              <div key={option.label} className="grid gap-2 rounded-control bg-paper p-3">
                <label className="flex min-h-12 items-center gap-2 text-sm font-medium" htmlFor={checkboxId}>
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={diagnosis !== undefined}
                    onChange={() => toggleDiagnosis(option.label)}
                    className={CONTROL_FOCUS}
                  />
                  <span className="min-w-0 break-words">{diagnosisLabel}</span>
                </label>
                {diagnosis ? (
                  <div className="grid gap-3 pl-6 sm:grid-cols-2">
                    {option.label === "other" ? (
                      <label className="grid gap-1 text-sm" htmlFor={`${uid}-other-diagnosis-label`}>
                        {tFamily(language, "profileOtherDiagnosisLabel")}
                        <input
                          id={`${uid}-other-diagnosis-label`}
                          aria-required="true"
                          aria-invalid={otherDiagnosisError}
                          aria-describedby={
                            otherDiagnosisError ? `${uid}-other-diagnosis-error` : undefined
                          }
                          value={diagnosis.otherLabel ?? ""}
                          placeholder={tFamily(language, "profileOtherDiagnosisPlaceholder")}
                          onChange={(event) => {
                            setOtherDiagnosisError(false);
                            updateDiagnosis(option.label, { otherLabel: event.target.value });
                          }}
                          className={`min-h-12 rounded-control border border-ink/20 px-3 py-2 ${CONTROL_FOCUS}`}
                        />
                        {otherDiagnosisError ? (
                          <span
                            id={`${uid}-other-diagnosis-error`}
                            role="alert"
                            className="text-sm font-medium text-rose-700"
                          >
                            {tFamily(language, "profileOtherDiagnosisError")}
                          </span>
                        ) : null}
                      </label>
                    ) : null}
                    <label className="grid gap-1 text-sm">
                      {monthLabel(language, diagnosisLabel)}
                      <input
                        type="month"
                        aria-label={monthLabel(language, diagnosisLabel)}
                        min="1900-01"
                        max={`${new Date().getFullYear()}-12`}
                        value={diagnosis.diagnosedAt ?? ""}
                        onChange={(event) => updateDiagnosis(option.label, { diagnosedAt: event.target.value })}
                        className={`min-h-12 rounded-control border border-ink/20 px-3 py-2 ${CONTROL_FOCUS}`}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={`min-h-12 min-w-0 break-words rounded-control bg-care px-4 py-2 font-semibold text-white ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "profileSave")}
          </button>
          <p role="status" aria-live="polite" className="text-sm font-medium text-care">
            {saved ? tFamily(language, "profileSaved") : ""}
          </p>
        </div>
    </form>
  );
}
