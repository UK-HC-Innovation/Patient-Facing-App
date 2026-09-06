import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetServerUsageForTests, recordServerUsage } from "./usage-log";

let lines: Array<Record<string, unknown>>;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  lines = [];
  __resetServerUsageForTests();
  log = vi.spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(JSON.parse(line) as Record<string, unknown>);
  });
});

afterEach(() => {
  log.mockRestore();
  delete process.env.NEXT_PUBLIC_BUILD_ID;
});

describe("recordServerUsage", () => {
  it("writes a line the report reads as part of the same feed as client events", () => {
    process.env.NEXT_PUBLIC_BUILD_ID = "6181f82";

    recordServerUsage({
      kind: "problem",
      problem: "not_configured",
      where: "api.route.classify",
      code: "no_provider"
    });

    expect(lines[0]).toMatchObject({
      log: "usage",
      session: "server",
      build: "6181f82",
      kind: "problem",
      problem: "not_configured",
      where: "api.route.classify",
      code: "no_provider"
    });
    expect(typeof lines[0].receivedAt).toBe("string");
  });

  it("numbers its events so a truncated log still reads in order", () => {
    recordServerUsage({ kind: "problem", problem: "timeout", where: "api.coach" });
    recordServerUsage({ kind: "problem", problem: "timeout", where: "api.coach" });

    expect(lines.map((line) => line.seq)).toEqual([0, 1]);
  });

  it("records a rejection instead of the event when a call site outgrows the vocabulary", () => {
    recordServerUsage({
      kind: "problem",
      problem: "error",
      where: "api.coach",
      // A message rather than a code -- the exact mistake the vocabulary exists to catch.
      code: "Upstream returned 502 for patient 8f21" as never
    });

    expect(lines[0]).toMatchObject({ event: "server_event_rejected", reason: "schema" });
    expect(lines[0].paths).toEqual(["code"]);
    expect(JSON.stringify(lines[0])).not.toContain("8f21");
  });

  it("never throws into the request, even when the sink itself fails", () => {
    log.mockImplementation(() => {
      throw new Error("stdout closed");
    });

    expect(() =>
      recordServerUsage({ kind: "problem", problem: "error", where: "api.coach" })
    ).not.toThrow();
  });

  it("falls back to a valid build id rather than emitting an envelope the report cannot group", () => {
    recordServerUsage({ kind: "problem", problem: "error", where: "api.coach" });

    expect(lines[0].build).toBe("dev");
  });
});
