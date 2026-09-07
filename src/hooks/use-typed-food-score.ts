"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PLATE_ITEMS, isQuestionLine, splitPlateLine } from "@/domain/typed-food-line";
import type { NotScoreableReason } from "@/domain/food-compass";
import type { LiveCandidate, LiveMatch } from "@/hooks/use-live-food-score";

export type TypedPlateItem = {
  /** What the person typed for this part of the plate. */
  query: string;
  match: LiveMatch | null;
};

export type TypedFoodResult =
  | { kind: "match"; match: LiveMatch }
  | { kind: "plate"; items: TypedPlateItem[] }
  | { kind: "none"; candidates: LiveCandidate[] }
  | { kind: "carve_out"; reason: NotScoreableReason }
  /** Not a food. The caller opens a session, or hands it to the local coach. */
  | { kind: "question"; text: string }
  /**
   * A newer submission replaced this one before it finished. The caller must do nothing
   * with it: acting on it would adopt a stale match, or open a session and send a line the
   * person has already replaced.
   */
  | { kind: "superseded" };

export type TypedFoodScoreState = {
  result: TypedFoodResult | null;
  pending: boolean;
  /** The last line submitted, so a door can echo it into its transcript. */
  lastQuery: string | null;
  submit: (text: string) => Promise<TypedFoodResult>;
  clear: () => void;
};

type IdentifyResponse = {
  mode: string;
  reason?: unknown;
  match?: Omit<LiveMatch, "candidates">;
  candidates?: LiveCandidate[];
};

async function lookupOne(
  text: string,
  passcode: string | undefined,
  signal: AbortSignal
): Promise<TypedFoodResult> {
  const response = await fetch("/api/food/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, passcode }),
    signal
  });
  const json = (await response.json()) as IdentifyResponse;

  if (json.mode === "carve_out") {
    return { kind: "carve_out", reason: json.reason as NotScoreableReason };
  }
  if (json.mode === "match" && json.match) {
    return { kind: "match", match: { ...json.match, candidates: (json.candidates ?? []).slice(0, 4) } };
  }
  // Typed text always resolves to the best-ranked row or to nothing. The camera's
  // "candidate, please confirm" shape does not apply: the person said the words, so the
  // row is the answer and the alternatives list is how they re-pick.
  return { kind: "none", candidates: (json.candidates ?? []).slice(0, 3) };
}

/**
 * Scores what someone typed, without a microphone, a camera, or a voice session.
 *
 * The identify route has always answered typed text deterministically, before any provider
 * or passcode check, in single-digit milliseconds. No door called it. Typed food names went
 * to a live session instead, which is why Brenda's "honey nut cheerios" produced
 * "Listening, just talk." and nothing else (critique G2, G3).
 */
export function useTypedFoodScore(options: { passcode?: string; enabled?: boolean } = {}): TypedFoodScoreState {
  const { passcode, enabled = true } = options;
  const passcodeRef = useRef(passcode);
  passcodeRef.current = passcode;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const [result, setResult] = useState<TypedFoodResult | null>(null);
  const [pending, setPending] = useState(false);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (!mountedRef.current) return;
    setResult(null);
    setPending(false);
    setLastQuery(null);
  }, []);

  const submit = useCallback(async (text: string): Promise<TypedFoodResult> => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || !enabledRef.current) {
      return { kind: "question", text: trimmed };
    }
    if (isQuestionLine(trimmed)) {
      const question: TypedFoodResult = { kind: "question", text: trimmed };
      if (mountedRef.current) {
        setLastQuery(trimmed);
        setResult(question);
      }
      return question;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (mountedRef.current) {
      setLastQuery(trimmed);
      setPending(true);
    }

    try {
      const parts = splitPlateLine(trimmed);
      let next: TypedFoodResult;

      if (parts.length > 1) {
        const looked = await Promise.all(
          parts.slice(0, MAX_PLATE_ITEMS).map(async (query) => {
            const one = await lookupOne(query, passcodeRef.current, controller.signal);
            return { query, match: one.kind === "match" ? one.match : null };
          })
        );
        // A plate nobody could match at all is a miss, not a plate of blanks.
        next = looked.some((item) => item.match !== null)
          ? { kind: "plate", items: looked }
          : { kind: "none", candidates: [] };
      } else {
        next = await lookupOne(trimmed, passcodeRef.current, controller.signal);
      }

      if (controller.signal.aborted) {
        return { kind: "superseded" };
      }
      if (mountedRef.current) setResult(next);
      return next;
    } catch {
      if (controller.signal.aborted) {
        return { kind: "superseded" };
      }
      // A lookup that could not run is not a "no such food". Let the caller ask instead.
      const fallback: TypedFoodResult = { kind: "question", text: trimmed };
      if (mountedRef.current) setResult(fallback);
      return fallback;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        if (mountedRef.current) setPending(false);
      }
    }
  }, []);

  return { result, pending, lastQuery, submit, clear };
}
