"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FoodAuthority } from "@/domain/food-authority";
import { foodLookupResponseSchema } from "@/domain/schemas";
import type { IdentifiedFood } from "@/domain/types";

const BARCODE_LOOKUP_TIMEOUT_MS = 15_000;

export type BarcodeReviewState =
  | { active: false; status: "idle"; code: null; food: null; resolvedFood: null }
  | { active: true; status: "looking_up"; code: string; food: null; resolvedFood: null }
  | { active: true; status: "review"; code: string; food: IdentifiedFood; resolvedFood: null }
  | { active: true; status: "miss"; code: string; food: null; resolvedFood: null }
  | { active: true; status: "error"; code: string; food: null; resolvedFood: null }
  | { active: true; status: "confirmed"; code: string; food: IdentifiedFood; resolvedFood: IdentifiedFood };

export type BarcodeReviewController = {
  state: BarcodeReviewState;
  confirm: () => void;
  reject: () => void;
  retry: () => Promise<void>;
  cancel: () => void;
};

export const initialBarcodeReviewState: BarcodeReviewState = {
  active: false,
  status: "idle",
  code: null,
  food: null,
  resolvedFood: null
};

/**
 * The always-available barcode path is intentionally independent from package-photo OCR.
 * A database hit is held as a visible candidate and cannot publish a score until confirmed.
 */
export function useBarcodeReview(args: {
  enabled: boolean;
  barcode: string | null;
  authority: FoodAuthority;
  suspendLive: () => void;
  resumeLive: () => void;
}): BarcodeReviewController {
  const { enabled, barcode, authority, suspendLive, resumeLive } = args;
  const [state, setState] = useState<BarcodeReviewState>(initialBarcodeReviewState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pinnedBarcodeRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);
  const requestRef = useRef<{
    controller: AbortController;
    epoch: number;
    sequence: number;
    code: string;
  } | null>(null);
  const mountedRef = useRef(true);
  const snapshotAuthority = authority.snapshot;
  const isAuthorityCurrent = authority.isCurrent;
  const invalidateAuthority = authority.invalidate;

  const lookup = useCallback(async (rawCode: string, force = false) => {
    if (!enabled) return;
    const code = rawCode.trim().slice(0, 64);
    if (!code || (!force && pinnedBarcodeRef.current === code)) return;

    pinnedBarcodeRef.current = code;
    requestRef.current?.controller.abort();
    const controller = new AbortController();
    const sequence = ++requestSequenceRef.current;
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, BARCODE_LOOKUP_TIMEOUT_MS);
    suspendLive();
    const epoch = snapshotAuthority();
    requestRef.current = { controller, epoch, sequence, code };
    setState({ active: true, status: "looking_up", code, food: null, resolvedFood: null });

    try {
      const response = await fetch(`/api/food/lookup?barcode=${encodeURIComponent(code)}`, {
        signal: controller.signal
      });
      const json = (await response.json()) as unknown;
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestSequenceRef.current !== sequence ||
        !isAuthorityCurrent(epoch)
      ) return;
      const parsed = foodLookupResponseSchema.safeParse(json);
      if (parsed.success && parsed.data.found) {
        setState({
          active: true,
          status: "review",
          code,
          food: parsed.data.food,
          resolvedFood: null
        });
      } else if (parsed.success) {
        setState({ active: true, status: "miss", code, food: null, resolvedFood: null });
      } else {
        setState({ active: true, status: "error", code, food: null, resolvedFood: null });
      }
    } catch {
      if (
        mountedRef.current &&
        (!controller.signal.aborted || timedOut) &&
        requestSequenceRef.current === sequence &&
        isAuthorityCurrent(epoch)
      ) {
        setState({ active: true, status: "error", code, food: null, resolvedFood: null });
      }
    } finally {
      globalThis.clearTimeout(timeout);
      if (requestRef.current?.sequence === sequence) requestRef.current = null;
    }
  }, [enabled, isAuthorityCurrent, snapshotAuthority, suspendLive]);

  useEffect(() => {
    if (!enabled || !barcode) return;
    void lookup(barcode);
  }, [barcode, enabled, lookup]);

  useEffect(() => {
    if (barcode !== null) return;
    if (stateRef.current.status === "miss" || stateRef.current.status === "error") {
      // Keep the visible result, but allow a deliberate remove-and-rescan gesture to retry.
      pinnedBarcodeRef.current = null;
    }
  }, [barcode]);

  useEffect(() => {
    if (enabled) return;
    requestSequenceRef.current += 1;
    requestRef.current?.controller.abort();
    requestRef.current = null;
    pinnedBarcodeRef.current = null;
    setState(initialBarcodeReviewState);
  }, [enabled]);

  useEffect(() => {
    const pending = requestRef.current;
    if (!pending || isAuthorityCurrent(pending.epoch)) return;
    requestSequenceRef.current += 1;
    pending.controller.abort();
    requestRef.current = null;
    pinnedBarcodeRef.current = null;
    setState({
      active: true,
      status: "error",
      code: pending.code,
      food: null,
      resolvedFood: null
    });
  }, [authority.epoch, isAuthorityCurrent]);

  const confirm = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== "review") return;
    setState({
      active: true,
      status: "confirmed",
      code: current.code,
      food: current.food,
      resolvedFood: current.food
    });
  }, []);

  const cancel = useCallback(() => {
    requestSequenceRef.current += 1;
    requestRef.current?.controller.abort();
    requestRef.current = null;
    pinnedBarcodeRef.current = null;
    invalidateAuthority();
    setState(initialBarcodeReviewState);
    resumeLive();
  }, [invalidateAuthority, resumeLive]);

  const retry = useCallback(async () => {
    const current = stateRef.current;
    if (current.status !== "error" && current.status !== "miss") return;
    await lookup(current.code, true);
  }, [lookup]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // React Strict Effects immediately runs setup again after its development-only
      // cleanup. Defer teardown one microtask so that rehearsal cannot strand a lookup;
      // a real unmount leaves mounted=false and still aborts before a response can commit.
      queueMicrotask(() => {
        if (mountedRef.current) return;
        requestSequenceRef.current += 1;
        requestRef.current?.controller.abort();
        requestRef.current = null;
        pinnedBarcodeRef.current = null;
      });
    };
  }, []);

  return { state, confirm, reject: cancel, retry, cancel };
}
