"use client";

import React, { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { PackageNutritionDraft } from "@/domain/package-scan";
import type { PackageScanController } from "@/hooks/use-package-scan";
import { pt as t, type PackageStringKey as FoodLensStringKey } from "@/i18n/package-strings";
import type { Language } from "@/i18n/strings";

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

function rescanMessage(reason: string): FoodLensStringKey {
  if (["ambiguous_columns", "multiple_columns", "per_container_column", "unclear_column"].includes(reason)) {
    return "packageRescanColumns";
  }
  if (reason === "missing_serving_size") return "packageRescanServing";
  if (["duplicate_rows", "missing_required_rows", "relationship_mismatch", "macro_factor_mismatch", "insufficient_domains"].includes(reason)) {
    return "packageRescanRows";
  }
  if (reason === "multiple_packages") return "packageRescanSinglePackage";
  if (reason === "not_package") return "packageRescanNotPackage";
  return "packageRescanBody";
}

function PhotoInput({
  label,
  onPhoto
}: {
  label: string;
  onPhoto: (file: File) => void;
}) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) onPhoto(file);
    event.currentTarget.value = "";
  };
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-care bg-white px-4 py-2 text-center text-sm font-semibold text-care focus-within:ring-2 focus-within:ring-care focus-within:ring-offset-2">
      {label}
      <input accept={PHOTO_ACCEPT} capture="environment" className="sr-only" onChange={change} type="file" />
    </label>
  );
}

function NutritionReadback({ draft, language }: { draft: PackageNutritionDraft; language: Language }) {
  return (
    <div className="grid gap-3 rounded-xl border border-ink/15 bg-white p-3" data-testid="package-nutrition-readback">
      <p className="text-sm font-semibold text-ink">{t(language, "packageServing", { serving: draft.servingSize })}</p>
      {draft.servingsPerContainer ? (
        <p className="text-xs text-ink/65">
          {t(language, "packageServingsPerContainer", { servings: draft.servingsPerContainer })}
        </p>
      ) : null}
      <p className="text-xs text-ink/65">{t(language, "packageBasisPerServing")}</p>
      {draft.selectedColumnHeading ? <p className="text-xs text-ink/65">{draft.selectedColumnHeading}</p> : null}
      <dl className="grid gap-2">
        {draft.rows.map((row) => (
          <div className="flex min-w-0 items-baseline justify-between gap-3 border-t border-ink/10 pt-2" key={row.field}>
            <dt className="min-w-0 break-words text-sm text-ink/80">{row.printedLabel}</dt>
            <dd className="min-w-0 break-words text-right text-sm font-semibold text-ink">
              {row.printedAmount}{row.printedUnit ? ` ${row.printedUnit}` : ""}
            </dd>
          </div>
        ))}
        {draft.unusableRows.map((row) => (
          <div className="flex min-w-0 items-baseline justify-between gap-3 border-t border-ink/10 pt-2" key={`unusable-${row.field}`}>
            <dt className="min-w-0 break-words text-sm text-ink/65">{row.printedLabel}</dt>
            <dd className="min-w-0 break-words text-right text-xs text-pulse">
              {row.printedAmount}{row.printedUnit ? ` ${row.printedUnit}` : ""} · {t(language, "packageUnavailableValue")}
            </dd>
          </div>
        ))}
      </dl>
      {draft.omittedFields.length > 0 ? (
        <p className="text-xs leading-normal text-ink/65">
          {t(language, "packageOmitted", { fields: draft.omittedFields.join(", ") })}
        </p>
      ) : null}
      {draft.ingredientText ? (
        <div>
          <p className="text-xs font-semibold text-ink/70">{t(language, "packageIngredients")}</p>
          <p className="mt-1 break-words text-xs leading-normal text-ink/70">{draft.ingredientText}</p>
        </div>
      ) : null}
      {draft.warnings.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-ink/70">{t(language, "packageWarnings")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-ink/65">
            {draft.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                {warning.code === "upper_bound_normalized_to_null"
                  ? `${warning.field}: ${t(language, "packageUnavailableValue")}`
                  : language === "es"
                    ? "Las calorías impresas y los macronutrientes necesitan una revisión cuidadosa."
                    : "The printed calories and macronutrients need a careful check."}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function FoodPackageScan({
  controller,
  cloudEnabled,
  language,
  promoted = false
}: {
  controller: PackageScanController;
  cloudEnabled: boolean;
  language: Language;
  promoted?: boolean;
}) {
  const { state } = controller;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const launchButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasActiveRef = useRef(state.active);
  const [identityName, setIdentityName] = useState("");
  const reviewCandidate = state.identity.status === "review" ? state.identity.candidate : null;

  useEffect(() => {
    if (reviewCandidate) setIdentityName(reviewCandidate.displayName);
  }, [reviewCandidate]);

  const focusKey = `${state.session.status}:${state.identity.status}:${state.nutrition.status}:${state.barcode.status}:${state.error ?? ""}`;
  useEffect(() => {
    if (state.active) headingRef.current?.focus();
  }, [focusKey, state.active]);

  useEffect(() => {
    if (wasActiveRef.current && !state.active) launchButtonRef.current?.focus();
    wasActiveRef.current = state.active;
  }, [state.active]);

  if (!state.active) {
    return cloudEnabled ? (
      <section aria-label={t(language, "packageScanRegion")} className="grid gap-2" data-testid="food-package-scan">
        <button
          className={`min-h-12 w-full rounded-control border px-4 py-2 font-semibold ${promoted ? "border-care bg-care text-white" : "border-care bg-white text-care"}`}
          onClick={controller.begin}
          ref={launchButtonRef}
          type="button"
        >
          {t(language, "packageScanAction")}
        </button>
      </section>
    ) : null;
  }

  const barcode = state.barcode;
  const barcodeName =
    barcode.status === "review" || barcode.status === "conflict" || barcode.status === "confirmed"
      ? [barcode.food.brand, barcode.food.name].filter(Boolean).join(" ")
      : null;
  const frontIdentityName = state.identity.status === "confirmed"
    ? state.identity.identity.displayName
    : state.identity.status === "review"
      ? state.identity.candidate.displayName
      : null;

  if (barcode.status === "looking_up") {
    return (
      <section aria-label={t(language, "packageScanRegion")} className="grid gap-3 rounded-xl border border-care/20 bg-calm/40 p-3.5" data-testid="food-package-scan">
        <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>{t(language, "packageScanRegion")}</h2>
        <p aria-live="polite" className="text-sm text-ink/75">{t(language, "packageBarcodeLooking", { barcode: barcode.code })}</p>
        <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={controller.cancel} type="button">
          {t(language, "packageDisclosureNotNow")}
        </button>
      </section>
    );
  }

  if (barcode.status === "review" || barcode.status === "conflict") {
    return (
      <section aria-label={t(language, "packageScanRegion")} className="grid gap-3 rounded-xl border border-care/25 bg-calm/40 p-3.5" data-testid="food-package-scan">
        <div>
          <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>
            {barcode.status === "conflict" ? t(language, "packageBarcodeConflictTitle") : t(language, "packageScanRegion")}
          </h2>
          <p className="mt-1 text-[18px] font-semibold leading-tight">{t(language, "packageBarcodeFound", { food: barcodeName ?? barcode.food.name })}</p>
          <p className="mt-1 break-all text-xs text-ink/60">{barcode.code}</p>
          {barcode.status === "conflict" ? (
            <div className="mt-2 grid gap-1 text-sm">
              <p className="font-semibold text-ink">
                {t(language, "packageConflictFrontIdentity", { food: frontIdentityName ?? t(language, "packageUnavailableValue") })}
              </p>
              <p className="font-semibold text-ink">
                {t(language, "packageConflictBarcodeIdentity", { food: barcodeName ?? barcode.food.name })}
              </p>
              <p className="text-pulse">{t(language, "packageBarcodeConflictBody")}</p>
            </div>
          ) : null}
        </div>
        <div className={`grid grid-cols-1 gap-2 ${barcode.status === "conflict" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={controller.confirmBarcode} type="button">
            {t(language, "packageBarcodeUse")}
          </button>
          <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={controller.rejectBarcode} type="button">
            {t(language, "packageBarcodeReject")}
          </button>
          {barcode.status === "conflict" ? (
            <button
              className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
              onClick={() => {
                controller.rejectBarcode();
                void controller.scanFront();
              }}
              type="button"
            >
              {t(language, "packageRetake")}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (state.resolvedFood) {
    const name = [state.resolvedFood.brand, state.resolvedFood.name].filter(Boolean).join(" ");
    return (
      <section aria-label={t(language, "packageScanRegion")} className="grid gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5" data-testid="food-package-scan">
        <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>
          {t(language, "packageConfirmed", { food: name })}
        </h2>
        <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={controller.cancel} type="button">
          {t(language, "packageScanAnother")}
        </button>
      </section>
    );
  }

  const barcodeNotice = barcode.status === "miss"
    ? t(language, "packageBarcodeMiss")
    : barcode.status === "error"
      ? t(language, "packageBarcodeError")
      : null;
  const barcodeRetry = barcode.status === "error" ? (
    <button
      className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
      onClick={() => void controller.onBarcodeDetected(barcode.code)}
      type="button"
    >
      {t(language, "retry")}
    </button>
  ) : null;
  if (state.session.status === "idle") {
    return (
      <section aria-label={t(language, "packageScanRegion")} className="grid gap-3 rounded-xl border border-care/20 bg-calm/40 p-3.5" data-testid="food-package-scan">
        <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>{t(language, "packageScanRegion")}</h2>
        {barcodeNotice ? <p className="text-sm text-ink/75">{barcodeNotice}</p> : null}
        {barcodeRetry}
        {cloudEnabled ? (
          <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={controller.begin} type="button">
            {t(language, "packagePhotoFlow")}
          </button>
        ) : null}
        <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={controller.cancel} type="button">
          {t(language, "packageDisclosureNotNow")}
        </button>
      </section>
    );
  }

  if (state.session.status === "disclosure") {
    return (
      <section aria-label={t(language, "packageScanRegion")} className="grid gap-3 rounded-xl border border-care/25 bg-calm/40 p-3.5" data-testid="food-package-scan">
        <div>
          <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>{t(language, "packageDisclosureTitle")}</h2>
          <p className="mt-2 text-sm leading-normal text-ink/75">{t(language, "packageDisclosureBody")}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={() => void controller.authorize()} type="button">
            {t(language, "packageDisclosureContinue")}
          </button>
          <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={controller.cancel} type="button">
            {t(language, "packageDisclosureNotNow")}
          </button>
        </div>
      </section>
    );
  }

  if (state.session.status === "authorizing") {
    return (
      <section aria-label={t(language, "packageScanRegion")} className="grid gap-3 rounded-xl border border-care/20 bg-calm/40 p-3.5" data-testid="food-package-scan">
        <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>{t(language, "packageScanRegion")}</h2>
        <p aria-live="polite" className="text-sm text-ink/75">{t(language, "packageAuthorizing")}</p>
        <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={controller.cancel} type="button">
          {t(language, "packageDisclosureNotNow")}
        </button>
      </section>
    );
  }

  if (state.session.status === "error") {
    return (
      <section aria-label={t(language, "packageScanRegion")} className="grid gap-3 rounded-xl border border-pulse/30 bg-pulse/5 p-3.5" data-testid="food-package-scan">
        <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>{t(language, "packageScanRegion")}</h2>
        <p role="alert" className="text-sm text-pulse">{state.session.message}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={() => void controller.authorize()} type="button">
            {t(language, "retry")}
          </button>
          <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={controller.cancel} type="button">
            {t(language, "packageDisclosureNotNow")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={t(language, "packageScanRegion")} className="grid gap-4 rounded-xl border border-care/25 bg-calm/40 p-3.5" data-testid="food-package-scan">
      <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>{t(language, "packageScanRegion")}</h2>
      {barcodeNotice ? <p className="text-sm text-ink/75">{barcodeNotice}</p> : null}
      {barcodeRetry}
      {state.error ? <p className="text-sm text-pulse" role="alert">{state.error}</p> : null}

      <div className="grid gap-3 border-t border-care/15 pt-3">
        <h3 className="text-[17px] font-semibold">{t(language, "packageFrontTitle")}</h3>
        {state.identity.status === "reading" ? <p aria-live="polite" className="text-sm text-ink/75">{t(language, "packageFrontReading")}</p> : null}
        {state.identity.status === "review" ? (
          <>
            <p className="text-sm font-semibold">{t(language, "packageFrontRead", { food: state.identity.candidate.displayName })}</p>
            <div className="flex flex-wrap gap-1.5">
              {state.identity.candidate.visibleText.slice(0, 6).map((text) => <span className="min-w-0 max-w-full break-all rounded-full bg-white px-2 py-1 text-xs text-ink/70" key={text}>{text}</span>)}
            </div>
            <label className="grid gap-1 text-sm font-semibold text-ink/75">
              {t(language, "packageIdentityEdit")}
              <input className="min-h-11 rounded-control border border-ink/20 bg-white px-3 text-base text-ink" maxLength={240} onChange={(event) => setIdentityName(event.target.value)} value={identityName} />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!identityName.trim()} onClick={() => controller.confirmIdentity(identityName)} type="button">{t(language, "packageIdentityConfirm")}</button>
              <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={() => void controller.scanFront()} type="button">{t(language, "packageRetake")}</button>
            </div>
          </>
        ) : state.identity.status === "confirmed" ? (
          <>
            <p className="text-sm font-semibold text-ink">{state.identity.identity.displayName}</p>
            <button className="min-h-11 justify-self-start rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={() => void controller.scanFront()} type="button">{t(language, "packageRetake")}</button>
          </>
        ) : state.identity.status === "needs_rescan" ? (
          <>
            <p className="text-sm text-pulse" role="alert">{t(language, rescanMessage(state.identity.reason))}</p>
            <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={() => void controller.scanFront()} type="button">{t(language, "packageRetake")}</button>
          </>
        ) : state.identity.status === "idle" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={() => void controller.scanFront()} type="button">{t(language, "packageFrontAction")}</button>
            <PhotoInput label={t(language, "packageChooseFrontPhoto")} onPhoto={(file) => void controller.scanFront(file)} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 border-t border-care/15 pt-3">
        <h3 className="text-[17px] font-semibold">{t(language, "packageNutritionTitle")}</h3>
        {state.nutrition.status === "reading" ? <p aria-live="polite" className="text-sm text-ink/75">{t(language, "packageNutritionReading")}</p> : null}
        {state.nutrition.status === "review" ? (
          <>
            <p className="text-sm font-semibold text-ink">{t(language, "packageNutritionReview")}</p>
            <NutritionReadback draft={state.nutrition.draft} language={language} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={controller.confirmNutrition} type="button">{t(language, "packageNutritionConfirm")}</button>
              <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={() => void controller.scanNutrition()} type="button">{t(language, "packageRetake")}</button>
            </div>
          </>
        ) : state.nutrition.status === "confirmed" ? (
          <>
            <NutritionReadback draft={state.nutrition.draft} language={language} />
            <button className="min-h-11 justify-self-start rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={() => void controller.scanNutrition()} type="button">{t(language, "packageRetake")}</button>
          </>
        ) : state.nutrition.status === "needs_rescan" ? (
          <>
            <p className="text-sm text-pulse" role="alert">{t(language, rescanMessage(state.nutrition.reason))}</p>
            <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={() => void controller.scanNutrition()} type="button">{t(language, "packageRetake")}</button>
          </>
        ) : state.nutrition.status === "idle" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white" onClick={() => void controller.scanNutrition()} type="button">{t(language, "packageNutritionAction")}</button>
            <PhotoInput label={t(language, "packageChooseNutritionPhoto")} onPhoto={(file) => void controller.scanNutrition(file)} />
          </div>
        ) : null}
      </div>

      <button className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care" onClick={controller.cancel} type="button">
        {t(language, "packageDisclosureNotNow")}
      </button>
    </section>
  );
}
