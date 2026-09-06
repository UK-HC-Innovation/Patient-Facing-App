"use client";

import React from "react";
import { MessageActions } from "./message-actions";
import type { Language } from "@/i18n/strings";
import type { AiMessage } from "@/domain/types";

const bannerClass: Record<AiMessage["safety"], string> = {
  allowed: "border-ink/15 bg-calm text-ink",
  escalate: "border-amber-300 bg-amber-50 text-amber-900",
  blocked: "border-rose-300 bg-rose-50 text-rose-900",
  crisis: "border-rose-400 bg-rose-100 text-rose-900"
};

export function FoodConversation({
  messages,
  partialAssistantText,
  language = "en",
  clinic
}: {
  messages: AiMessage[];
  partialAssistantText: string;
  language?: Language;
  clinic?: { name: string; phone: string };
}) {
  if (messages.length === 0 && partialAssistantText.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      {messages.map((message) => {
        const isIntercept = message.role === "assistant" && message.safety !== "allowed";
        return (
          <article
            key={message.id}
            // Explicit ink on both bubbles. The transcript renders inside the dark voice
            // bar, so an inherited color made every answer white on white (critique F4).
            className={`rounded-control p-3 text-sm leading-6 whitespace-pre-line ${
              message.role === "assistant" ? "bg-white text-ink" : "bg-calm text-ink"
            }`}
          >
            {isIntercept && message.banner ? (
              <p className={`mb-2 rounded-control border p-2 text-sm font-medium ${bannerClass[message.safety]}`} role="alert">
                {message.banner}
              </p>
            ) : null}
            <p>{message.content}</p>
            {isIntercept && message.actions && message.actions.length > 0 ? (
              <MessageActions actions={message.actions} language={language} clinic={clinic} />
            ) : null}
          </article>
        );
      })}
      {partialAssistantText.length > 0 ? (
        <article className="rounded-control bg-white p-3 text-sm leading-6 text-ink/70">
          <p>{partialAssistantText}</p>
        </article>
      ) : null}
    </div>
  );
}
