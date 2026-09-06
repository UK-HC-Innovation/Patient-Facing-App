import { describe, expect, it } from "vitest";
import { usageBatchSchema, usageEventSchema } from "./usage-event-schema";
import {
  usageOutcomeFromHref,
  usageRouteFromPath,
  usageSignature,
  type UsageBatch,
  type UsageEvent
} from "./usage-event";
import type { z } from "zod";

/**
 * Strings that must never survive the schema. These are the shapes a real leak takes: a
 * symptom typed into the composer, a name, a date of birth, a raw pathname carrying an id.
 * If any of them starts passing, the redaction boundary has a hole in it.
 */
const MUST_NOT_PASS = [
  "I have been thinking about ending my life",
  "chest pain since this morning",
  "Brent Halloway",
  "1962-04-11",
  "brent.halloway@example.com",
  "(859) 555-0134",
  "/checkin/phq9?patient=8f21",
  "blood sugar was 312 after dinner",
  "a1c 9.2",
  "Metformin 500mg twice daily",
  "8595550134",
  "mrn0099481",
  "312",
  "2026",
  "  ",
  "x".repeat(41)
];

function decisionWith(overrides: Record<string, unknown>) {
  return {
    seq: 0,
    at: 0,
    kind: "decision",
    decision: "crisis_gate",
    outcome: "matched",
    source: "deterministic",
    ...overrides
  };
}

function problemWith(overrides: Record<string, unknown>) {
  return { seq: 0, at: 0, kind: "problem", problem: "error", where: "api.coach", ...overrides };
}

describe("usage event redaction boundary", () => {
  it.each(MUST_NOT_PASS)("rejects %j in the decision outcome", (value) => {
    expect(usageEventSchema.safeParse(decisionWith({ outcome: value })).success).toBe(false);
  });

  it.each(MUST_NOT_PASS)("rejects %j in decision tags", (value) => {
    expect(usageEventSchema.safeParse(decisionWith({ tags: [value] })).success).toBe(false);
  });

  it.each([...MUST_NOT_PASS, "3a9f01b", "3a9f01bcd", "3A9F01BC", "zzzzzzzz"])(
    "rejects %j in the input signature",
    (value) => {
      expect(usageEventSchema.safeParse(decisionWith({ inputSignature: value })).success).toBe(false);
    }
  );

  it.each(MUST_NOT_PASS)("rejects %j in a problem code", (value) => {
    expect(usageEventSchema.safeParse(problemWith({ code: value })).success).toBe(false);
  });

  it.each(MUST_NOT_PASS)("rejects %j in a problem location", (value) => {
    expect(usageEventSchema.safeParse(problemWith({ where: value })).success).toBe(false);
  });

  it.each(MUST_NOT_PASS)("rejects %j as an action id", (value) => {
    expect(
      usageEventSchema.safeParse({ seq: 0, at: 0, kind: "action", route: "chat", action: value })
        .success
    ).toBe(false);
  });

  it("rejects a route that is not in the closed set, rather than passing it through", () => {
    expect(
      usageEventSchema.safeParse({ seq: 0, at: 0, kind: "view", route: "/checkin/phq9" }).success
    ).toBe(false);
  });

  it("caps tags so a junction cannot spray a long list into the sink", () => {
    const tags = Array.from({ length: 9 }, (_, index) => `rule_${index}`);
    expect(usageEventSchema.safeParse(decisionWith({ tags })).success).toBe(false);
  });

  it("accepts the identifier-shaped values the call sites actually pass", () => {
    expect(
      usageEventSchema.safeParse(
        decisionWith({
          outcome: "matched",
          tags: ["self_harm.explicit", "crisis-1"],
          inputSignature: "3a9f01bc",
          confidence: 0.82,
          latencyMs: 41
        })
      ).success
    ).toBe(true);
  });
});

describe("usageRouteFromPath", () => {
  it.each([
    ["/", "home"],
    ["/chat", "chat"],
    ["/food", "food"],
    ["/food/demo", "food_demo"],
    ["/screening/result", "screening"],
    ["/checkin/phq9", "checkin"]
  ])("maps %s to %s", (pathname, expected) => {
    expect(usageRouteFromPath(pathname)).toBe(expected);
  });

  it("falls back to unknown so a new route cannot leak an id in its first segment", () => {
    expect(usageRouteFromPath("/patient/8f21-b7/summary")).toBe("unknown");
  });

  it("does not let a caller name the food_demo id directly through a first segment", () => {
    expect(usageRouteFromPath("/food_demo")).toBe("unknown");
  });
});

describe("usageSignature", () => {
  it("gives the same key for the same input so a junction can be grouped across sessions", () => {
    expect(usageSignature("chest pain")).toBe(usageSignature("chest pain"));
  });

  it("separates different inputs", () => {
    expect(usageSignature("chest pain")).not.toBe(usageSignature("chest pains"));
  });

  it("emits a fixed-width slug that the schema accepts", () => {
    const signature = usageSignature("I have been thinking about ending my life");
    expect(signature).toMatch(/^[0-9a-f]{8}$/u);
    expect(usageEventSchema.safeParse(decisionWith({ inputSignature: signature })).success).toBe(true);
  });
});

describe("usageBatchSchema", () => {
  const batch = {
    session: "s7f2a913c",
    surface: "full",
    build: "dev",
    lang: "en",
    viewport: "narrow",
    startedAt: "2026-09-06T12:00:00.000Z",
    dropped: 0,
    events: [{ seq: 0, at: 0, kind: "view", route: "today" }]
  };

  it("accepts a well formed batch", () => {
    expect(usageBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("rejects an empty batch so the sink never records a bare envelope", () => {
    expect(usageBatchSchema.safeParse({ ...batch, events: [] }).success).toBe(false);
  });

  it("rejects a batch whose events exceed the cap", () => {
    const events = Array.from({ length: 201 }, (_, seq) => ({ seq, at: seq, kind: "view", route: "today" }));
    expect(usageBatchSchema.safeParse({ ...batch, events }).success).toBe(false);
  });

  it("rejects a session id that is not slug shaped", () => {
    expect(usageBatchSchema.safeParse({ ...batch, session: "user brent halloway" }).success).toBe(false);
  });
});

/**
 * The two halves of the vocabulary drifting apart is the failure this split invites: the
 * client compiles against the hand-written type while the sink validates against the zod
 * one, so a field added to only one of them type-checks everywhere and then silently
 * rejects every batch that carries it in production.
 *
 * These are assignments in both directions, so widening either half alone fails `tsc`.
 */
describe("schema and type parity", () => {
  it("accepts a value typed by hand and a value inferred from the schema interchangeably", () => {
    const fromSchema: z.infer<typeof usageEventSchema> = {
      seq: 0,
      at: 0,
      kind: "decision",
      decision: "crisis_gate",
      outcome: "matched",
      source: "deterministic"
    };
    const asDomain: UsageEvent = fromSchema;
    const backToSchema: z.infer<typeof usageEventSchema> = asDomain;

    const batchFromSchema: z.infer<typeof usageBatchSchema> = {
      session: "s7f2a913c",
      surface: "full",
      build: "dev",
      lang: "en",
      viewport: "narrow",
      startedAt: "2026-09-06T12:00:00.000Z",
      dropped: 0,
      events: [backToSchema]
    };
    const asDomainBatch: UsageBatch = batchFromSchema;

    expect(usageBatchSchema.safeParse(asDomainBatch).success).toBe(true);
  });
});

describe("usageOutcomeFromHref", () => {
  it.each([
    ["/glucose", "glucose"],
    ["/checkin/phq9", "checkin.phq9"],
    ["/learn/retinopathy", "learn.retinopathy"],
    ["/chat?ask=hello", "chat"]
  ])("turns %s into %s", (href, expected) => {
    expect(usageOutcomeFromHref(href)).toBe(expected);
  });

  it("falls back to unknown rather than emitting a value that would reject the batch", () => {
    expect(usageOutcomeFromHref("/patients/1962-04-11")).toBe("unknown");
    expect(usageOutcomeFromHref("")).toBe("unknown");
  });

  it("only ever emits values the schema accepts", () => {
    for (const href of ["/glucose", "/checkin/phq9", "/patients/1962-04-11", "//", "/A B"]) {
      const outcome = usageOutcomeFromHref(href);
      const event = {
        seq: 0,
        at: 0,
        kind: "decision",
        decision: "route_classify",
        outcome,
        source: "deterministic"
      };
      expect(usageEventSchema.safeParse(event).success).toBe(true);
    }
  });
});
