/**
 * The vocabulary of a usage event.
 *
 * This exists so the owner can answer two questions about a running build: did it give the
 * right answer, and where did it break. It is deliberately NOT the patient-facing audit
 * trail in `./audit.ts` -- that one is a transparency record the patient reads, exports and
 * deletes. This one is an operator's record the patient never sees.
 *
 * ## Why the shape is this restrictive
 *
 * The app is patient-facing, so the interesting failure mode is not "we forgot to log
 * something", it is "someone piped a symptom description into a log line". A scrubber that
 * runs after the fact only catches the patterns it knows. So the redaction boundary is the
 * vocabulary itself: there is no field here that can hold a sentence.
 *
 * Every string is one of exactly two kinds:
 *
 *   1. a closed literal union -- `route`, `kind`, `decision`, `source`, `problem`. The type
 *      checker rejects anything else at the call site and the schema rejects it at the sink.
 *   2. a bounded slug -- `action`, `where`, `code`, `outcome`, `tags[]`. Lowercase, no
 *      spaces, 40 characters, at least one letter, no run of four digits. Free text cannot
 *      pass, and neither can a date of birth, a reading, or a record number.
 *
 * `route` is the field a raw pathname would leak through (`/checkin/phq9`, an id in a
 * segment), so it is the strictest: callers pass a route id from a closed set, and no code
 * path derives it from `location.pathname` except the boundary component that reports it.
 *
 * `inputSignature` is a 32-bit FNV-1a digest of a decision's input, present so identical
 * inputs can be grouped across sessions and a junction that answers them differently can be
 * spotted. Thirty-two bits cannot encode a sentence, so the utterance is not recoverable
 * from it; it is a grouping key, not a payload.
 *
 * ## Why the runtime schema lives next door
 *
 * `./usage-event-schema.ts` holds the zod half. This file is reached from the client through
 * the root layout, so every byte here lands on the first load of every route -- and the Food
 * Lens bundle budget in `scripts/check-ladder-bundle.mjs` is what made that cost visible.
 * The browser needs the ids and the three helpers; only the sinks need to validate. The two
 * halves are pinned together by a type-parity check in `usage-event-schema.test.ts`, so
 * widening one without the other fails the build rather than silently drifting.
 */

export const USAGE_ROUTES = [
  "home",
  "chat",
  "checkin",
  "demo",
  "food",
  "food_demo",
  "glucose",
  "intake",
  "ladder",
  "learn",
  "medicines",
  "menu",
  "numbers",
  "onboarding",
  "plan",
  "privacy",
  "screening",
  "support",
  "today",
  "visits",
  "unknown"
] as const;
export type UsageRoute = (typeof USAGE_ROUTES)[number];

/**
 * The junctions worth auditing for correctness. Each one is a place where the app commits
 * to an answer a person then acts on, so a wrong answer there is the bug that matters.
 */
export const USAGE_DECISIONS = [
  "crisis_gate",
  "route_classify",
  "food_score",
  "carb_range",
  "plate_review",
  "package_scan",
  "barcode_lookup",
  "dr_triage",
  "family_recommend",
  "screening_extract",
  "coach_reply"
] as const;
export type UsageDecision = (typeof USAGE_DECISIONS)[number];

/** How the answer was reached. `fallback` and `mock` mean the real path did not run. */
export const USAGE_SOURCES = ["deterministic", "model", "cache", "mock", "fallback"] as const;
export type UsageSource = (typeof USAGE_SOURCES)[number];

export const USAGE_PROBLEMS = [
  "error",
  "empty_result",
  "timeout",
  "retry",
  "abandon",
  "guard_blocked",
  "not_configured",
  "permission_denied"
] as const;
export type UsageProblem = (typeof USAGE_PROBLEMS)[number];

/** What `recordUsage` is called with. The recorder stamps `seq` and `at`. */
export type UsageEventInput =
  | { kind: "view"; route: UsageRoute }
  | { kind: "action"; route: UsageRoute; action: string }
  | {
      kind: "decision";
      decision: UsageDecision;
      /** What the junction answered, as an id: `matched`, `tier2`, `coach`, `score_ok`. */
      outcome: string;
      source: UsageSource;
      /** Supporting ids the junction produced -- matched rule ids, guard names. */
      tags?: string[];
      /** FNV-1a of the input, for grouping identical inputs across sessions. */
      inputSignature?: string;
      confidence?: number;
      latencyMs?: number;
    }
  | {
      kind: "problem";
      problem: UsageProblem;
      /** The surface it happened on: `api.food.plate`, `voice_bar`, `barcode_scanner`. */
      where: string;
      /** A status code or error name, never a message: `http_502`, `aborterror`. */
      code?: string;
      attempt?: number;
    };

/** Ordering and timing live on the envelope, so every kind carries them. */
export type UsageEvent = UsageEventInput & {
  /** Monotonic within a session. A gap means a batch was dropped. */
  seq: number;
  /** Milliseconds since session start. Relative, so it is not a wall-clock fingerprint. */
  at: number;
};

export type UsageBatch = {
  /** Random per tab. Reconstructs one person's path without identifying them. */
  session: string;
  surface: "full" | "foodlens";
  build: string;
  lang: "en" | "es";
  /** Bucketed, because exact pixel dimensions are a fingerprint. */
  viewport: "narrow" | "wide";
  startedAt: string;
  /** Events the recorder threw away under back-pressure. Non-zero means gaps are expected. */
  dropped: number;
  events: UsageEvent[];
};

export const MAX_USAGE_BATCH_BYTES = 64 * 1024;

/**
 * FNV-1a, 32 bits, hex. Not a security hash and not trying to be: it groups identical
 * decision inputs so a junction that answers the same input two ways shows up in the report.
 */
export function usageSignature(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Pathname to route id. An allowlist rather than a sanitiser: anything unrecognised becomes
 * `unknown`, so a future route with an id in its path cannot leak that id by default.
 */
export function usageRouteFromPath(pathname: string): UsageRoute {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "home";
  if (segments[0] === "food") return segments[1] === "demo" ? "food_demo" : "food";
  const candidate = segments[0];
  return (USAGE_ROUTES as readonly string[]).includes(candidate) && candidate !== "food_demo"
    ? (candidate as UsageRoute)
    : "unknown";
}

/**
 * A route href as a decision outcome: `/checkin/phq9` becomes `checkin.phq9`.
 *
 * Hrefs the router can produce are a fixed catalog, so this is a formatter rather than a
 * sanitiser -- but it still falls back to `unknown` rather than emitting a shape the schema
 * would reject, because a rejected event costs the whole batch it travels in.
 */
export function usageOutcomeFromHref(href: string): string {
  const candidate = href.split("?")[0].split("/").filter(Boolean).join(".").toLowerCase();
  return /^[a-z][a-z0-9_.:-]{0,39}$/u.test(candidate) && !/\d{4}/u.test(candidate)
    ? candidate
    : "unknown";
}
