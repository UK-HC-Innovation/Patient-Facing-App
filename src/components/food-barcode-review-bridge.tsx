"use client";

import React, { useCallback, useLayoutEffect, useMemo } from "react";
import { FoodBarcodeReview } from "@/components/food-barcode-review";
import type { FoodAuthority } from "@/domain/food-authority";
import type { IdentifiedFood } from "@/domain/types";
import { useBarcodeReview } from "@/hooks/use-barcode-review";
import type { Language } from "@/i18n/strings";

export type BarcodeReviewSnapshot = {
  active: boolean;
  resolvedFood: IdentifiedFood | null;
  barcode: string | null;
};

export function FoodBarcodeReviewBridge({
  authority,
  barcode,
  language,
  onCancelChange,
  onDismiss,
  onStateChange,
  resumeLive,
  suspendLive
}: {
  authority: FoodAuthority;
  barcode: string;
  language: Language;
  onCancelChange: (cancel: (() => void) | null) => void;
  onDismiss: () => void;
  onStateChange: (state: BarcodeReviewSnapshot) => void;
  resumeLive: () => void;
  suspendLive: () => void;
}) {
  const controller = useBarcodeReview({
    enabled: true,
    barcode,
    authority,
    suspendLive,
    resumeLive
  });
  const { state } = controller;
  const cancelReview = controller.cancel;
  const dismiss = useCallback(() => {
    cancelReview();
    onDismiss();
  }, [cancelReview, onDismiss]);
  const visibleController = useMemo(
    () => ({ ...controller, cancel: dismiss, reject: dismiss }),
    [controller, dismiss]
  );

  useLayoutEffect(() => {
    onCancelChange(dismiss);
    return () => onCancelChange(null);
  }, [dismiss, onCancelChange]);

  useLayoutEffect(() => {
    // The parent already blocks competing actions synchronously on detection. Do not
    // replace that hold with the hook's pre-effect idle state while this chunk mounts.
    if (!state.active) return;
    onStateChange({
      active: true,
      resolvedFood: state.resolvedFood,
      barcode: state.code
    });
  }, [onStateChange, state.active, state.code, state.resolvedFood]);

  return <FoodBarcodeReview controller={visibleController} language={language} />;
}
