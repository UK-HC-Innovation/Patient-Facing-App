/**
 * The frozen 100-case typed corpus, run straight through the route handler.
 *
 * Spec 30 section 10: the review's probe called this handler from a scratch vitest config
 * outside the tree and resolved 33 queries in under a second. This is that probe, committed,
 * so identity is a regression gate rather than a one-off measurement. No browser, no server,
 * no model spend: the typed branch answers before any provider or passcode check.
 *
 * `expect` in the fixture is what the route does today. `target` is what spec 30 A2 requires.
 * Where the two differ the case is reported as outstanding rather than failed, so this file
 * runs green at P0 and becomes A2's gate when the fixture's `expect` is refreshed to `target`.
 */
import { describe, expect, it } from "vitest";
import { isQuestionLine } from "@/domain/typed-food-line";
import corpus from "@/test/fixtures/food-typed-corpus.json";
import { POST } from "./route";

type CorpusCase = {
  id: string;
  category: "exact" | "compound" | "bilingual" | "replacement" | "exclusion";
  query: string;
  language: "en" | "es";
  plateItem?: boolean;
  note?: string;
  expect: {
    mode: string;
    code?: string;
    description?: string;
    fcs?: number;
    basis?: string | null;
    reason?: string;
    codes?: string[];
    descriptions?: string[];
    question?: boolean;
  };
  target: {
    mode: string;
    code?: string;
    basis?: string;
    reason?: string;
    codes?: string[];
  };
};

const CASES = corpus.cases as CorpusCase[];

async function resolve(entry: CorpusCase) {
  const response = await POST(
    new Request("http://localhost/api/food/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: entry.query, ...(entry.plateItem ? { plateItem: true } : {}) })
    })
  );
  const json = (await response.json()) as {
    mode?: string;
    reason?: string;
    match?: { food: { code: string }; basis?: string | null };
    candidates?: { code: string }[];
  };
  return {
    mode: json.mode ?? `http_${response.status}`,
    code: json.match?.food.code,
    basis: json.match?.basis ?? null,
    reason: json.reason,
    codes: (json.candidates ?? []).slice(0, 3).map((candidate) => candidate.code)
  };
}

describe("typed identity corpus", () => {
  it("holds 100 adjudicated cases, 20 in each category", () => {
    expect(CASES).toHaveLength(100);
    const counts = CASES.reduce<Record<string, number>>((totals, entry) => {
      totals[entry.category] = (totals[entry.category] ?? 0) + 1;
      return totals;
    }, {});
    expect(counts).toEqual({ exact: 20, compound: 20, bilingual: 20, replacement: 20, exclusion: 20 });
    expect(new Set(CASES.map((entry) => entry.id)).size).toBe(100);
  });

  it("resolves every case to its recorded outcome", async () => {
    const misses: string[] = [];
    for (const entry of CASES) {
      const actual = await resolve(entry);
      const wanted = entry.expect;
      if (actual.mode !== wanted.mode) {
        misses.push(`${entry.id}: mode ${actual.mode}, expected ${wanted.mode}`);
        continue;
      }
      if (wanted.mode === "match" && actual.code !== wanted.code) {
        misses.push(`${entry.id}: row ${actual.code}, expected ${wanted.code}`);
      }
      if (wanted.mode === "match" && wanted.basis !== undefined && actual.basis !== wanted.basis) {
        misses.push(`${entry.id}: basis ${actual.basis}, expected ${wanted.basis}`);
      }
      if (wanted.mode === "carve_out" && actual.reason !== wanted.reason) {
        misses.push(`${entry.id}: reason ${actual.reason}, expected ${wanted.reason}`);
      }
      if (wanted.codes && actual.codes.join(",") !== wanted.codes.join(",")) {
        misses.push(`${entry.id}: candidates ${actual.codes.join(",")}, expected ${wanted.codes.join(",")}`);
      }
    }
    expect(misses).toEqual([]);
  }, 60_000);

  it("classifies questions the way the fixture records", () => {
    const misses = CASES.filter(
      (entry) => entry.expect.question !== undefined && isQuestionLine(entry.query) !== entry.expect.question
    ).map((entry) => `${entry.id}: ${JSON.stringify(entry.query)}`);
    expect(misses).toEqual([]);
  });

  it("reports what spec 30 A2 still owes, by category", () => {
    const outstanding = CASES.filter((entry) => {
      if (entry.expect.mode !== entry.target.mode) return true;
      if (entry.target.mode === "match") {
        return entry.expect.code !== entry.target.code || entry.expect.basis !== entry.target.basis;
      }
      if (entry.target.codes) {
        return (entry.expect.codes ?? []).join(",") !== entry.target.codes.join(",");
      }
      return false;
    });
    const byCategory = outstanding.reduce<Record<string, number>>((totals, entry) => {
      totals[entry.category] = (totals[entry.category] ?? 0) + 1;
      return totals;
    }, {});
    // Not an assertion of correctness: a running count of the gap this corpus exists to close.
    console.log(
      `spec 30 A2 outstanding: ${outstanding.length}/100 ${JSON.stringify(byCategory)}\n` +
        outstanding.map((entry) => `  ${entry.id}: ${entry.expect.mode} -> ${entry.target.mode}`).join("\n")
    );
    expect(outstanding.length).toBeLessThanOrEqual(100);
  });
});
