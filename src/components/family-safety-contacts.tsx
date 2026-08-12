"use client";

import { MessageCircle, Phone, ShieldAlert } from "lucide-react";
import React from "react";
import type { FamilySafetyEvent } from "@/domain/types";
import { tFamily } from "@/i18n/family-strings";
import { tSafety, type Language } from "@/i18n/strings";

type FamilySafetyContact = "kysafe" | "211" | "ncmec" | "988" | "911";

function contactsForEvents(
  events: readonly FamilySafetyEvent[],
  directory: boolean
): Set<FamilySafetyContact> {
  if (directory) return new Set(["kysafe", "211", "ncmec", "988", "911"]);
  const contacts = new Set<FamilySafetyContact>();

  for (const event of events) {
    // Every safety branch keeps an emergency route. The more specific routes
    // below are additive; they never replace 911 when someone is in danger.
    contacts.add("911");

    if (event.guidance === "missing_child") {
      contacts.add("ncmec");
    }
    if (
      event.guidance === "basic_needs" ||
      event.guidance === "basic_needs_and_medication_access"
    ) {
      contacts.add("211");
    }

    if (event.domain === "abuse") {
      contacts.add("kysafe");
    }
    if (event.domain === "social" && event.guidance !== "medication_access") {
      // Events written before guidance existed remain useful after an upgrade.
      contacts.add("211");
    }
    if (
      event.domain === "self_harm" ||
      event.domain === "caregiver_collapse" ||
      event.domain === "harm_to_others" ||
      (event.tier === "crisis" && event.domain !== "abuse")
    ) {
      contacts.add("988");
    }
  }

  return contacts;
}

const primaryAction =
  "inline-flex min-h-12 items-center gap-2 rounded-control bg-rose-600 px-4 py-2 text-sm font-semibold text-white";
const emergencyAction =
  "inline-flex min-h-12 items-center gap-2 rounded-control bg-rose-700 px-4 py-2 text-sm font-semibold text-white";
const secondaryAction =
  "inline-flex min-h-12 items-center gap-2 rounded-control border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-700";

export function FamilySafetyContacts({
  events,
  language,
  summary,
  directory = false
}: {
  events: readonly FamilySafetyEvent[];
  language: Language;
  summary: string;
  directory?: boolean;
}) {
  const contacts = contactsForEvents(events, directory);
  const missingChild = !directory && events.some(({ guidance }) => guidance === "missing_child");
  const emergencyActionLink = (
    <a className={emergencyAction} href="tel:911">
      <ShieldAlert aria-hidden="true" className="h-4 w-4" />
      {tSafety(language, "callEmergency")}
    </a>
  );

  return (
    <section aria-label={summary} className="rounded-control border border-rose-300 bg-rose-50 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-rose-800">
        <ShieldAlert aria-hidden="true" className="h-4 w-4" />
        {summary}
      </p>
      {directory ? (
        <p className="mt-2 text-sm leading-6 text-ink/80">
          {tFamily(language, "safetyDirectory")}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {missingChild && contacts.has("911") ? emergencyActionLink : null}
        {contacts.has("kysafe") ? (
          <a className={primaryAction} href="tel:18775972331">
            <Phone aria-hidden="true" className="h-4 w-4" />
            {tFamily(language, "safetyCallKySafe")}
          </a>
        ) : null}
        {contacts.has("211") ? (
          <a className={primaryAction} href="tel:211">
            <Phone aria-hidden="true" className="h-4 w-4" />
            {tFamily(language, "safetyCall211")}
          </a>
        ) : null}
        {contacts.has("ncmec") ? (
          <a className={primaryAction} href="tel:18008435678">
            <Phone aria-hidden="true" className="h-4 w-4" />
            {tFamily(language, "safetyCallNcmec")}
          </a>
        ) : null}
        {contacts.has("988") ? (
          <>
            <a className={primaryAction} href="tel:988">
              <Phone aria-hidden="true" className="h-4 w-4" />
              {tSafety(language, "crisisCall988")}
            </a>
            <a className={secondaryAction} href={language === "es" ? "sms:988?body=AYUDA" : "sms:988"}>
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              {tFamily(language, "safetyText988")}
            </a>
          </>
        ) : null}
        {!missingChild && contacts.has("911") ? emergencyActionLink : null}
      </div>
    </section>
  );
}
