"use client";

import { LifeBuoy, MessageCircle, Phone, ShieldAlert, Share2 } from "lucide-react";
import React, { useState } from "react";
import { tSafety, type Language } from "@/i18n/strings";
import type { AiMessageAction } from "@/domain/types";

type MessageActionsProps = {
  actions: AiMessageAction[];
  language: Language;
  clinic?: { name: string; phone: string };
  onDraft?: () => void;
};

// Shared action-button block for assistant messages, used by both the Coach
// conversation panel and the Food Lens conversation. Crisis and emergency
// actions are offline-safe tel:/sms: deep links that never depend on a stored
// clinic phone number.
export function MessageActions({ actions, language, clinic, onDraft }: MessageActionsProps) {
  const [safetyPlanOpen, setSafetyPlanOpen] = useState(false);

  if (actions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.includes("crisis_call_988") ? (
          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-control bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            href="tel:988"
          >
            <Phone aria-hidden="true" className="h-4 w-4" />
            {tSafety(language, "crisisCall988")}
          </a>
        ) : null}
        {actions.includes("crisis_text_988") ? (
          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-control border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-700"
            href="sms:988"
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            {tSafety(language, "crisisText988")}
          </a>
        ) : null}
        {actions.includes("call_emergency") ? (
          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-control bg-rose-700 px-4 py-2 text-sm font-semibold text-white"
            href="tel:911"
          >
            <ShieldAlert aria-hidden="true" className="h-4 w-4" />
            {tSafety(language, "callEmergency")}
          </a>
        ) : null}
        {actions.includes("call_poison_control") ? (
          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-control border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-700"
            href="tel:18002221222"
          >
            <Phone aria-hidden="true" className="h-4 w-4" />
            {tSafety(language, "poisonControlCall")}
          </a>
        ) : null}
        {actions.includes("safety_plan") ? (
          <button
            className="inline-flex min-h-12 items-center gap-2 rounded-control border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-700"
            onClick={() => setSafetyPlanOpen((open) => !open)}
            type="button"
            aria-expanded={safetyPlanOpen}
          >
            <LifeBuoy aria-hidden="true" className="h-4 w-4" />
            {tSafety(language, "safetyPlanLabel")}
          </button>
        ) : null}
        {actions.includes("call_clinic") && clinic && clinic.phone ? (
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white"
            href={`tel:${clinic.phone}`}
          >
            <Phone aria-hidden="true" className="h-4 w-4" />
            Call {clinic.name}
          </a>
        ) : null}
        {actions.includes("draft_message") && onDraft ? (
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-care px-4 py-2 text-sm font-semibold text-care"
            onClick={onDraft}
            type="button"
          >
            <Share2 aria-hidden="true" className="h-4 w-4" />
            Draft a message
          </button>
        ) : null}
      </div>
      {actions.includes("safety_plan") && safetyPlanOpen ? (
        <div className="mt-2 rounded-control border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-semibold">{tSafety(language, "safetyPlanLabel")}</p>
          <p className="mt-1 leading-6">{tSafety(language, "safetyPlanBody")}</p>
        </div>
      ) : null}
    </>
  );
}
