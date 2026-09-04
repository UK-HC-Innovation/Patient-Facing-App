"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FoodBarcodeReviewBridge, type BarcodeReviewSnapshot } from "@/components/food-barcode-review-bridge";
import { FoodIdentityReview } from "@/components/food-identity-review";
import type { FoodAuthority } from "@/domain/food-authority";
import type { LiveIdentityCandidate, LiveMatch } from "@/hooks/use-live-food-score";
import type { Language } from "@/i18n/strings";

function ignoreCancelChange(): void {
  // The review owns its cancel button. The public door has no competing package panel.
}

export function PublicFoodBarcodeReview({
  authority,
  barcode,
  language,
  onMatch,
  onDismiss,
  passcode,
  resumeLive,
  suspendLive
}: {
  authority: FoodAuthority;
  barcode: string;
  language: Language;
  onMatch: (match: LiveMatch, options?: { pin?: boolean }) => void;
  onDismiss: () => void;
  passcode?: string;
  resumeLive: () => void;
  suspendLive: () => void;
}) {
  const reportedRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [candidate, setCandidate] = useState<LiveIdentityCandidate | null>(null);
  const handleStateChange = useCallback((state: BarcodeReviewSnapshot) => {
    const food = state.resolvedFood;
    if (!food || !state.barcode) return;
    const key = `${state.barcode}:${food.id}`;
    if (reportedRef.current === key) return;
    reportedRef.current = key;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const epoch = authority.snapshot();
    void fetch("/api/food/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: [food.brand, food.name].filter(Boolean).join(" "),
        requireConfirmation: true,
        passcode
      }),
      signal: controller.signal
    })
      .then((response) => response.json())
      .then((json: { mode?: string; candidate?: { food: LiveIdentityCandidate["food"] } }) => {
        if (
          controller.signal.aborted ||
          !authority.isCurrent(epoch) ||
          json.mode !== "candidate" ||
          !json.candidate
        ) return;
        setCandidate({ food: json.candidate.food, candidates: [] });
      })
      .catch(() => undefined)
      .finally(() => {
        if (requestRef.current === controller) requestRef.current = null;
      });
  }, [authority, passcode]);

  const confirmCandidate = useCallback((foodId: string) => {
    if (!candidate || candidate.food.code !== foodId) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const epoch = authority.invalidate();
    void fetch("/api/food/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodId, passcode }),
      signal: controller.signal
    })
      .then((response) => response.json())
      .then((json: { mode?: string; match?: Omit<LiveMatch, "candidates">; candidates?: LiveMatch["candidates"] }) => {
        if (controller.signal.aborted || !authority.isCurrent(epoch) || json.mode !== "match" || !json.match) return;
        setCandidate(null);
        onMatch({ ...json.match, candidates: json.candidates ?? [] }, { pin: false });
      })
      .catch(() => undefined)
      .finally(() => {
        if (requestRef.current === controller) requestRef.current = null;
      });
  }, [authority, candidate, onMatch, passcode]);

  const rejectCandidate = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setCandidate(null);
    onDismiss();
    resumeLive();
  }, [onDismiss, resumeLive]);

  useEffect(() => () => requestRef.current?.abort(), []);

  return (
    <div className="grid gap-3">
      <FoodBarcodeReviewBridge
        authority={authority}
        barcode={barcode}
        language={language}
        onCancelChange={ignoreCancelChange}
        onDismiss={onDismiss}
        onStateChange={handleStateChange}
        resumeLive={resumeLive}
        suspendLive={suspendLive}
      />
      {candidate ? (
        <FoodIdentityReview
          candidate={candidate}
          language={language}
          onConfirm={confirmCandidate}
          onReject={rejectCandidate}
        />
      ) : null}
    </div>
  );
}
