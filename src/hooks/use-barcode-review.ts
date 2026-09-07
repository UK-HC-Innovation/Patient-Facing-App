"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { CompassScore } from "@/domain/food-compass";
import type { FoodAuthority } from "@/domain/food-authority";
import { foodLookupResponseSchema } from "@/domain/schemas";
import type { IdentifiedFood } from "@/domain/types";

const BARCODE_LOOKUP_TIMEOUT_MS = 15_000;

/** The published Table S5 row the scanned product maps to, when it maps to one. */
export type PublishedFoodMatch = {
  code: string;
  description: string;
  group: string;
  score: CompassScore;
};

const publishedTableMatchSchema = z.object({
  published: z.object({
    code: z.string().min(1),
    description: z.string().min(1),
    group: z.string(),
    score: z.object({
      fcs: z.number().int().min(1).max(100),
      band: z.enum(["encourage", "moderate", "minimize"]),
      tier: z.literal("T1"),
      ambiguous: z.boolean().default(false),
      range: z.tuple([z.number(), z.number()]).nullable().default(null),
      calorieDensity: z
        .object({
          kcalPer100g: z.number().nullable(),
          band: z.enum(["very_low", "low", "medium", "high", "unknown"])
        })
        .default({ kcalPer100g: null, band: "unknown" })
    })
  })
});

const askBoxPrefillSchema = z.object({ prefill: z.string().min(1).max(120) });

/**
 * The published score is what the card must show when the product has a row: one food,
 * one number. The label estimate is the fallback, not the headline.
 */
function readPublishedMatch(json: unknown): PublishedFoodMatch | null {
  const parsed = publishedTableMatchSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  const { code, description, group, score } = parsed.data.published;
  return { code, description, group, score: { ...score, domains: null, coverage: null } };
}

function readPrefill(json: unknown): string | null {
  const parsed = askBoxPrefillSchema.safeParse(json);
  return parsed.success ? parsed.data.prefill : null;
}

// `published` and `prefill` are optional so that a state literal written before spec 29
// still type-checks; the hook always sets them.
export type BarcodeReviewState =
  | { active: false; status: "idle"; code: null; food: null; resolvedFood: null; published?: null; prefill?: null }
  | { active: true; status: "looking_up"; code: string; food: null; resolvedFood: null; published?: null; prefill?: null }
  | {
      active: true;
      status: "review";
      code: string;
      food: IdentifiedFood;
      resolvedFood: null;
      published?: PublishedFoodMatch | null;
      prefill?: null;
    }
  | { active: true; status: "miss"; code: string; food: null; resolvedFood: null; published?: null; prefill?: string | null }
  | { active: true; status: "error"; code: string; food: null; resolvedFood: null; published?: null; prefill?: null }
  | {
      active: true;
      status: "confirmed";
      code: string;
      food: IdentifiedFood;
      resolvedFood: IdentifiedFood;
      published?: PublishedFoodMatch | null;
      prefill?: null;
    };

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
  resolvedFood: null,
  published: null,
  prefill: null
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
    setState({ active: true, status: "looking_up", code, food: null, resolvedFood: null, published: null, prefill: null });

    try {
      const response = await fetch("/api/food/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
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
          resolvedFood: null,
          published: readPublishedMatch(json),
          prefill: null
        });
      } else if (parsed.success) {
        // A barcode nobody carries still has a maker; the ask box starts from its name.
        setState({ active: true, status: "miss", code, food: null, resolvedFood: null, published: null, prefill: readPrefill(json) });
      } else {
        setState({ active: true, status: "error", code, food: null, resolvedFood: null, published: null, prefill: null });
      }
    } catch {
      if (
        mountedRef.current &&
        (!controller.signal.aborted || timedOut) &&
        requestSequenceRef.current === sequence &&
        isAuthorityCurrent(epoch)
      ) {
        setState({ active: true, status: "error", code, food: null, resolvedFood: null, published: null, prefill: null });
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
      resolvedFood: null,
      published: null,
      prefill: null
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
      resolvedFood: current.food,
      published: current.published ?? null,
      prefill: null
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
