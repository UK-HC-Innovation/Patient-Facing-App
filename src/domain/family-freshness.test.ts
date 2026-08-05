import { describe, expect, it } from "vitest";
import {
  FRESHNESS_BUDGET_DAYS,
  STALE_ACCEPTED,
  expiredStaleAcceptances,
  staleCatalogEntries,
  type FreshnessSubject
} from "./family-freshness";
import { FAMILY_GUIDE_CATALOG } from "./family-guides";
import { FAMILY_RESOURCE_CATALOG } from "./family-resources";
import { KENTUCKY_SDOH_RESOURCE_CATALOG } from "./sdoh-resources";

function subjects(): FreshnessSubject[] {
  return [
    ...FAMILY_RESOURCE_CATALOG.map((entry) => ({
      id: entry.id,
      catalog: "family-resources",
      verifiedAt: entry.verifiedAt,
      humanVerify: entry.humanVerify
    })),
    ...FAMILY_GUIDE_CATALOG.map((entry) => ({
      id: entry.id,
      catalog: "family-guides",
      verifiedAt: entry.verifiedAt,
      humanVerify: entry.humanVerify
    })),
    ...KENTUCKY_SDOH_RESOURCE_CATALOG.map((entry) => ({
      id: entry.id,
      catalog: "sdoh-resources",
      verifiedAt: entry.verifiedAt
    }))
  ];
}

describe("staleCatalogEntries", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");

  it("names anything past the budget, oldest first", () => {
    const stale = staleCatalogEntries(
      [
        { id: "fresh", catalog: "x", verifiedAt: "2026-08-01" },
        { id: "old", catalog: "x", verifiedAt: "2026-01-01" },
        { id: "older", catalog: "x", verifiedAt: "2025-01-01" }
      ],
      now,
      []
    );

    expect(stale.map(({ id }) => id)).toEqual(["older", "old"]);
    expect(stale[0].ageDays).toBeGreaterThan(FRESHNESS_BUDGET_DAYS);
  });

  it("leaves owner-owned entries alone — humanVerify is cleared by a person (FR-6)", () => {
    expect(
      staleCatalogEntries([{ id: "x", catalog: "x", verifiedAt: "2020-01-01", humanVerify: true }], now, [])
    ).toEqual([]);
  });

  it("honours a live allowlist entry and stops honouring an expired one", () => {
    const subject = [{ id: "blocked", catalog: "x", verifiedAt: "2020-01-01" }];
    const reason = "the host refuses scripts";

    expect(staleCatalogEntries(subject, now, [{ id: "blocked", until: "2026-10-01", reason }])).toEqual([]);
    expect(
      staleCatalogEntries(subject, now, [{ id: "blocked", until: "2026-07-01", reason }]).map(({ id }) => id)
    ).toEqual(["blocked"]);
  });
});

describe("the allowlist itself", () => {
  it("gives every entry a reason and a review-by date", () => {
    for (const entry of STALE_ACCEPTED) {
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(entry.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.until))).toBe(false);
    }
  });

  it("names only entries that exist", () => {
    const ids = new Set(subjects().map(({ id }) => id));
    for (const entry of STALE_ACCEPTED) {
      expect(ids.has(entry.id)).toBe(true);
    }
  });

  // The allowlist may not quietly become the permanent answer.
  it("has not itself gone stale", () => {
    const expired = expiredStaleAcceptances(new Date());
    expect(
      expired.map(({ id, until, reason }) => `${id} (review-by ${until}): ${reason}`),
      "STALE_ACCEPTED entries are past their review-by date. Re-verify them, or move the date with a fresh reason."
    ).toEqual([]);
  });
});

/**
 * The time bomb. This is the only thing in the app that will ever notice a
 * catalog fact going stale, and it is meant to fail: when it does, re-run
 * `node scripts/verify-catalog.mjs`, check what it could not confirm by hand,
 * and either move the dates or add a dated STALE_ACCEPTED entry with a reason.
 * Widening FRESHNESS_BUDGET_DAYS to make it pass is the one wrong answer.
 */
describe("the catalogs are fresh", () => {
  it(`has nothing older than ${FRESHNESS_BUDGET_DAYS} days`, () => {
    const stale = staleCatalogEntries(subjects(), new Date());

    expect(
      stale.map(({ catalog, id, verifiedAt, ageDays }) => `${catalog}/${id} checked ${verifiedAt} (${Math.floor(ageDays)}d ago)`),
      "Catalog entries are past the freshness budget. Re-verify them (scripts/verify-catalog.mjs plus the human checks in docs/ops/catalog-verification/), do not widen the budget."
    ).toEqual([]);
  });

  it("dates every entry in a form the budget can read", () => {
    for (const subject of subjects()) {
      expect(subject.verifiedAt, `${subject.catalog}/${subject.id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(subject.verifiedAt))).toBe(false);
      // A date in the future would be a claim we cannot have made.
      expect(Date.parse(subject.verifiedAt)).toBeLessThanOrEqual(Date.now());
    }
  });
});
