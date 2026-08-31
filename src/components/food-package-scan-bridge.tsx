"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { FoodPackageScan } from "@/components/food-package-scan";
import type { FoodAuthority } from "@/domain/food-authority";
import type { IdentifiedFood } from "@/domain/types";
import { usePackageScan } from "@/hooks/use-package-scan";
import type { Language } from "@/i18n/strings";

export type PackageScanSnapshot = {
  active: boolean;
  resolvedFood: IdentifiedFood | null;
  barcode: string | null;
};

export function FoodPackageScanBridge({
  authority,
  barcode,
  captureDetailedFrame,
  language,
  onCancelChange,
  onStateChange,
  passcode,
  patientId,
  promoted,
  resumeLive,
  suspendLive
}: {
  authority: FoodAuthority;
  barcode: string | null;
  captureDetailedFrame: () => Promise<string | null>;
  language: Language;
  onCancelChange: (cancel: (() => void) | null) => void;
  onStateChange: (state: PackageScanSnapshot) => void;
  passcode?: string;
  patientId: string;
  promoted?: boolean;
  resumeLive: () => void;
  suspendLive: () => void;
}) {
  const controller = usePackageScan({
    enabled: true,
    authority,
    passcode,
    patientId,
    captureDetailedFrame,
    suspendLive,
    resumeLive
  });
  const { cancel, onBarcodeDetected, state } = controller;
  const barcodeHandlerRef = useRef(onBarcodeDetected);
  const observedBarcodeRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    barcodeHandlerRef.current = onBarcodeDetected;
  }, [onBarcodeDetected]);

  useLayoutEffect(() => {
    onCancelChange(cancel);
    return () => onCancelChange(null);
  }, [cancel, onCancelChange]);

  useLayoutEffect(() => {
    onStateChange({
      active: state.active,
      resolvedFood: state.resolvedFood,
      barcode: "code" in state.barcode ? state.barcode.code : null
    });
  }, [onStateChange, state.active, state.barcode, state.resolvedFood]);

  useEffect(() => {
    if (barcode === observedBarcodeRef.current) return;
    observedBarcodeRef.current = barcode;
    if (barcode) void barcodeHandlerRef.current(barcode);
  }, [barcode]);

  return (
    <FoodPackageScan
      cloudEnabled
      controller={controller}
      language={language}
      promoted={promoted}
    />
  );
}
