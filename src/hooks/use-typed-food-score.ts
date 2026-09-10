"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_PLATE_ITEMS,
  isQuestionLine,
  splitConjunctionLine,
  splitPlateLine,
  stripCorrectionPrefix
} from "@/domain/typed-food-line";
import type { FoodAuthority } from "@/domain/food-authority";
import type { NotScoreableReason } from "@/domain/food-compass";
import type { LiveCandidate, LiveMatch } from "@/hooks/use-live-food-score";

export type TypedPlateItem = {
  /** What the person typed for this part of the plate. */
  query: string;
  match: LiveMatch | null;
  /**
   * The lookup could not run. Distinct from a food the table does not carry: one is worth
   * retrying and the other is not.
   */
  failed?: boolean;
};

export type TypedFoodResult =
  | { kind: "match"; match: LiveMatch }
  /**
   * Rows the search found and the promotion policy would not publish (spec 30 R4).
   *
   * One candidate is a proposal to confirm; several are chips to pick from. Neither carries
   * a score, because a number beside an unconfirmed name is the confident wrong answer.
   */
  | { kind: "candidate"; candidates: LiveCandidate[]; query: string; corrected: boolean }
  | {
      kind: "plate";
      items: TypedPlateItem[];
      /** Names past the five-item cap. Visible, never silently clipped (spec 30 R5). */
      dropped: string[];
    }
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
  /** Re-runs one plate item whose lookup could not complete. */
  retryItem: (query: string) => Promise<void>;
  clear: () => void;
};

type IdentifyResponse = {
  mode: string;
  reason?: unknown;
  match?: Omit<LiveMatch, "candidates">;
  candidates?: LiveCandidate[];
  corrected?: boolean;
  /** The route found no single dish covering both sides of an "and" (spec 30 R5 step 5). */
  splitSuggested?: boolean;
};

type Lookup = { result: TypedFoodResult; splitSuggested: boolean };

async function lookupOne(
  text: string,
  passcode: string | undefined,
  signal: AbortSignal,
  options: { bestRow?: boolean } = {}
): Promise<Lookup> {
  const response = await fetch("/api/food/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, passcode, ...(options.bestRow ? { bestRow: true } : {}) }),
    signal
  });
  const json = (await response.json()) as IdentifyResponse;
  const splitSuggested = json.splitSuggested === true;

  if (json.mode === "carve_out") {
    return { result: { kind: "carve_out", reason: json.reason as NotScoreableReason }, splitSuggested };
  }
  if (json.mode === "match" && json.match) {
    // An alias basis means the person's word and the row's word are different on purpose:
    // manzana is Apple, raw, coca-cola is Soft drink, cola. Their word is the familiar
    // display name spec 30 R4 asks for, so it leads and the row is named beneath it. Every
    // other basis matched the words they already used, and repeating them adds nothing.
    const readName = json.match.basis === "alias" ? text.trim() || null : null;
    return {
      result: {
        kind: "match",
        match: { ...json.match, readName, candidates: (json.candidates ?? []).slice(0, 4) }
      },
      splitSuggested
    };
  }
  if (json.mode === "candidate") {
    return {
      result: {
        kind: "candidate",
        candidates: (json.candidates ?? []).slice(0, 3),
        query: text,
        corrected: json.corrected === true
      },
      splitSuggested
    };
  }
  return { result: { kind: "none", candidates: (json.candidates ?? []).slice(0, 3) }, splitSuggested };
}

/**
 * Scores what someone typed, without a microphone, a camera, or a voice session.
 *
 * The identify route has always answered typed text deterministically, before any provider
 * or passcode check, in single-digit milliseconds. No door called it. Typed food names went
 * to a live session instead, which is why Brenda's "honey nut cheerios" produced
 * "Listening, just talk." and nothing else (critique G2, G3).
 *
 * It holds the door's authority (spec 30 R1). A typed food is a replacement, so submitting
 * one invalidates whatever the camera or a barcode had in flight, and a result whose epoch
 * is no longer current is `superseded` rather than published. A question does not invalidate
 * -- it keeps the confirmed food as context -- but it does abort the lookup it interrupted,
 * so a late row cannot swap the food under discussion (R2, finding E12).
 */
export function useTypedFoodScore(
  options: { passcode?: string; enabled?: boolean; authority?: FoodAuthority } = {}
): TypedFoodScoreState {
  const { passcode, enabled = true, authority } = options;
  const passcodeRef = useRef(passcode);
  passcodeRef.current = passcode;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const authorityRef = useRef(authority);
  authorityRef.current = authority;

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

    // Above the question branch, deliberately. A question used to return before this, so an
    // in-flight lookup finished and replaced the very food the question was about (E12).
    abortRef.current?.abort();
    abortRef.current = null;

    // A correction is stripped before anything else (spec 30 R5 step 2). "No, it is a
    // tamale" split on its comma into a two-item plate whose first item, "No", scored as
    // Beef and noodles, no sauce -- the splitter never saw a correction, only a list.
    const { text: line } = stripCorrectionPrefix(trimmed);

    if (isQuestionLine(line)) {
      const question: TypedFoodResult = { kind: "question", text: trimmed };
      if (mountedRef.current) {
        setLastQuery(trimmed);
        setPending(false);
        setResult(question);
      }
      return question;
    }

    // A typed food replaces the current choice. Anything the camera, a barcode or a package
    // has in flight is no longer about the food this person is asking about.
    const requestEpoch = authorityRef.current?.invalidate() ?? null;
    const isCurrent = () =>
      requestEpoch === null || authorityRef.current?.isCurrent(requestEpoch) !== false;
    const controller = new AbortController();
    abortRef.current = controller;
    if (mountedRef.current) {
      setLastQuery(trimmed);
      setPending(true);
    }

    /**
     * Every component of a plate, looked up as a plate component (spec 30 R4/R5).
     *
     * allSettled, not all: one item the network could not reach used to reject the whole
     * line into the catch below, which turned a plate into a question and opened a paid
     * voice session (finding E04).
     */
    const lookupPlate = async (parts: string[], dropped: string[]): Promise<TypedFoodResult> => {
      const settled = await Promise.allSettled(
        parts
          .slice(0, MAX_PLATE_ITEMS)
          .map((query) => lookupOne(query, passcodeRef.current, controller.signal, { bestRow: true }))
      );
      const looked: TypedPlateItem[] = settled.map((outcome, index) => {
        const query = parts[index];
        if (outcome.status === "rejected") {
          return { query, match: null, failed: true };
        }
        return { query, match: outcome.value.result.kind === "match" ? outcome.value.result.match : null };
      });
      // A plate nobody could match at all is a miss, not a plate of blanks -- unless the
      // reason nothing matched is that the lookups could not run, which is worth a retry.
      return looked.some((item) => item.match !== null || item.failed === true)
        ? { kind: "plate", items: looked, dropped }
        : { kind: "none", candidates: [] };
    };

    try {
      const { items: parts, dropped } = splitPlateLine(line);
      let next: TypedFoodResult;

      if (parts.length > 1) {
        next = await lookupPlate(parts, dropped);
      } else {
        // Whole dish first (spec 30 R5 step 4). "chicken and dumplings" and "mac and cheese"
        // used to be split before the row for the dish itself was ever tried, which turned
        // mac into a Big Mac. Only a line the route could not resolve as one dish, and whose
        // top row does not cover both sides of its "and", becomes two foods.
        const whole = await lookupOne(line, passcodeRef.current, controller.signal);
        if (whole.splitSuggested) {
          const conjoined = splitConjunctionLine(line);
          next =
            conjoined.items.length > 1
              ? await lookupPlate(conjoined.items, conjoined.dropped)
              : whole.result;
        } else {
          next = whole.result;
        }
      }

      if (controller.signal.aborted || !isCurrent()) {
        return { kind: "superseded" };
      }
      if (mountedRef.current) setResult(next);
      return next;
    } catch {
      if (controller.signal.aborted || !isCurrent()) {
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

  const retryItem = useCallback(async (query: string): Promise<void> => {
    const controller = new AbortController();
    const requestEpoch = authorityRef.current?.snapshot() ?? null;
    let next: TypedFoodResult;
    try {
      next = (await lookupOne(query, passcodeRef.current, controller.signal, { bestRow: true })).result;
    } catch {
      return;
    }
    if (!mountedRef.current) return;
    if (requestEpoch !== null && authorityRef.current?.isCurrent(requestEpoch) === false) return;
    setResult((current) => {
      if (current?.kind !== "plate") return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.query === query
            ? { query, match: next.kind === "match" ? next.match : null, failed: false }
            : item
        )
      };
    });
  }, []);

  return { result, pending, lastQuery, submit, retryItem, clear };
}
