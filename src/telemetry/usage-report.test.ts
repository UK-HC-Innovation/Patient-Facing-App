import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The report is the half of this feature an operator actually reads, so it is tested
 * end to end through the real process rather than by importing pieces of it. `--json` is
 * the seam: the same findings the printed report is built from, in a shape a test can
 * assert on.
 */

const workspace = mkdtempSync(join(tmpdir(), "usage-report-"));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

const envelope = {
  surface: "full",
  build: "6181f82",
  lang: "en",
  viewport: "narrow",
  startedAt: "2026-09-06T11:59:00.000Z",
  dropped: 0
};

function line(record: Record<string, unknown>): string {
  return JSON.stringify({ log: "usage", receivedAt: "2026-09-06T12:00:00.000Z", ...record });
}

type Counted = Array<[string, number]>;
type Findings = {
  totals: { events: number; sessions: number; droppedByBackPressure: number; rejectedBatches: number };
  views: Counted;
  problems: Counted;
  deadEnds: Counted;
  rejectedPaths: Counted;
  junctions: Array<{ decision: string; total: number; outcomes: Counted; p50: number | null; p95: number | null }>;
  disagreements: Array<{
    decision: string;
    signature: string;
    outcomes: string[];
    builds: string[];
    sessions: string[];
    occurrences: number;
  }>;
};

function report(lines: string[], flags: string[] = []): Findings {
  const path = join(workspace, `${Math.random().toString(36).slice(2)}.jsonl`);
  writeFileSync(path, `${lines.join("\n")}\n`);
  const stdout = execFileSync(process.execPath, ["scripts/usage-report.mjs", path, "--json", ...flags], {
    encoding: "utf8"
  });
  return JSON.parse(stdout) as Findings;
}

describe("usage-report", () => {
  it("flags a junction that answered the same input two different ways", () => {
    const findings = report([
      line({ ...envelope, session: "sa1", seq: 0, at: 0, kind: "decision", decision: "route_classify", outcome: "glucose", source: "deterministic", inputSignature: "aa11bb22" }),
      line({ ...envelope, session: "sb2", build: "7ae12cc", seq: 0, at: 0, kind: "decision", decision: "route_classify", outcome: "coach.no_match", source: "deterministic", inputSignature: "aa11bb22" })
    ]);

    expect(findings.disagreements).toHaveLength(1);
    expect(findings.disagreements[0]).toMatchObject({
      decision: "route_classify",
      signature: "aa11bb22",
      occurrences: 2
    });
    expect(findings.disagreements[0].outcomes.sort()).toEqual(["coach.no_match", "glucose"]);
    expect(findings.disagreements[0].builds.sort()).toEqual(["6181f82", "7ae12cc"]);
  });

  it("does not flag a junction that answered consistently", () => {
    const findings = report([
      line({ ...envelope, session: "sa1", seq: 0, at: 0, kind: "decision", decision: "crisis_gate", outcome: "matched", source: "deterministic", inputSignature: "aa11bb22" }),
      line({ ...envelope, session: "sb2", seq: 0, at: 0, kind: "decision", decision: "crisis_gate", outcome: "matched", source: "deterministic", inputSignature: "aa11bb22" })
    ]);

    expect(findings.disagreements).toEqual([]);
  });

  it("does not confuse two junctions that happen to share an input signature", () => {
    const findings = report([
      line({ ...envelope, session: "sa1", seq: 0, at: 0, kind: "decision", decision: "crisis_gate", outcome: "clear", source: "deterministic", inputSignature: "aa11bb22" }),
      line({ ...envelope, session: "sa1", seq: 1, at: 1, kind: "decision", decision: "route_classify", outcome: "glucose", source: "deterministic", inputSignature: "aa11bb22" })
    ]);

    expect(findings.disagreements).toEqual([]);
  });

  it("names a session that ended on a problem rather than burying it in the totals", () => {
    const findings = report([
      line({ ...envelope, session: "sc3", seq: 0, at: 0, kind: "view", route: "food_demo" }),
      line({ ...envelope, session: "sc3", seq: 1, at: 9, kind: "problem", problem: "empty_result", where: "barcode_lookup", code: "not_found" }),
      line({ ...envelope, session: "sd4", seq: 0, at: 0, kind: "problem", problem: "timeout", where: "api.coach" }),
      line({ ...envelope, session: "sd4", seq: 1, at: 9, kind: "view", route: "today" })
    ]);

    expect(findings.deadEnds).toEqual([["barcode_lookup empty_result (not_found)", 1]]);
    expect(findings.problems).toContainEqual(["api.coach timeout", 1]);
  });

  it("counts a session's dropped events once, not once per line it rides on", () => {
    const findings = report([
      line({ ...envelope, dropped: 4, session: "sc3", seq: 0, at: 0, kind: "view", route: "today" }),
      line({ ...envelope, dropped: 4, session: "sc3", seq: 1, at: 1, kind: "view", route: "glucose" }),
      line({ ...envelope, dropped: 4, session: "sc3", seq: 2, at: 2, kind: "view", route: "menu" })
    ]);

    expect(findings.totals.droppedByBackPressure).toBe(4);
  });

  it("reads a line that a container platform wrapped in its own envelope", () => {
    const findings = report([
      "2026-09-06T12:00:01Z stdout F starting server on :3000",
      JSON.stringify({
        TimeGenerated: "2026-09-06T12:00:02Z",
        Log: line({ ...envelope, session: "sd4", seq: 0, at: 0, kind: "view", route: "food_demo" })
      })
    ]);

    expect(findings.views).toEqual([["food_demo", 1]]);
    expect(findings.totals.sessions).toBe(1);
  });

  it("surfaces rejected batches, since a rejection means a call site is emitting junk", () => {
    const findings = report([
      line({ ...envelope, session: "sa1", seq: 0, at: 0, kind: "view", route: "today" }),
      line({ event: "batch_rejected", reason: "schema", paths: ["events.0.action"] })
    ]);

    expect(findings.totals.rejectedBatches).toBe(1);
    expect(findings.rejectedPaths).toEqual([["events.0.action", 1]]);
  });

  it("keeps server lines out of the client session count while still reporting them", () => {
    const findings = report([
      line({ ...envelope, session: "sa1", seq: 0, at: 0, kind: "view", route: "today" }),
      line({ session: "server", build: "6181f82", seq: 0, kind: "problem", problem: "not_configured", where: "api.route.classify", code: "no_provider" })
    ]);

    expect(findings.totals.sessions).toBe(1);
    expect(findings.problems).toEqual([["api.route.classify not_configured (no_provider)", 1]]);
  });

  it("honours --since so a report can be scoped to one test run", () => {
    const findings = report(
      [
        JSON.stringify({ log: "usage", receivedAt: "2026-09-01T00:00:00.000Z", ...envelope, session: "old", seq: 0, at: 0, kind: "view", route: "today" }),
        JSON.stringify({ log: "usage", receivedAt: "2026-09-06T00:00:00.000Z", ...envelope, session: "new", seq: 0, at: 0, kind: "view", route: "glucose" })
      ],
      ["--since", "2026-09-05T00:00:00.000Z"]
    );

    expect(findings.views).toEqual([["glucose", 1]]);
  });

  it("reports decision latency percentiles so a slow junction is visible", () => {
    const findings = report(
      Array.from({ length: 10 }, (_, index) =>
        line({
          ...envelope,
          session: "sa1",
          seq: index,
          at: index,
          kind: "decision",
          decision: "route_classify",
          outcome: "glucose",
          source: "model",
          latencyMs: (index + 1) * 100
        })
      )
    );

    const [junction] = findings.junctions;
    expect(junction.total).toBe(10);
    expect(junction.p50).toBe(600);
    expect(junction.p95).toBe(1000);
  });
});
