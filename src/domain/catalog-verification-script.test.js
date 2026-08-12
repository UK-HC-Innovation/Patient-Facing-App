import { describe, expect, it } from "vitest";
import { classify, findSignal, groupResults, signalsFor } from "../../scripts/verify-catalog.mjs";

const entry = {
  name: "Bluegrass Access Collaborative",
  contact: "Call 800-772-1213",
  sourceUrl: "https://example.org/program"
};

describe("catalog verification content signals", () => {
  it("recognizes a formatted or digits-only copy of the catalog phone", () => {
    expect(findSignal(entry, "Questions? Call 1-800-772-1213 today.")).toEqual({
      kind: "phone",
      value: "800-772-1213"
    });
  });

  it("does not confirm a page from one generic name word", () => {
    const generic = {
      ...entry,
      name: "First Steps Parent Support Center",
      contact: ""
    };
    expect(signalsFor(generic).words).toEqual([]);
    expect(findSignal(generic, "First steps for every parent in our support center.")).toBeNull();
  });

  it("accepts two exact meaningful name terms but rejects a substring", () => {
    expect(findSignal({ ...entry, contact: "" }, "Welcome to the Bluegrass Access Collaborative.")).toEqual({
      kind: "name_terms",
      value: "bluegrass + access + collaborative"
    });
    expect(findSignal({ ...entry, contact: "" }, "A collaborator can access the form.")).toBeNull();
  });

  it("does not promote a generic topic or place from one long name term", () => {
    expect(findSignal({ ...entry, name: "Kentucky Disability Guide", contact: "" }, "Disability resources.")).toBeNull();
    expect(findSignal({ ...entry, name: "FEAT Louisville", contact: "" }, "Serving Louisville.")).toBeNull();
  });
});

describe("catalog verification reachability", () => {
  it("allows a formerly blocked host to pass when it actually returns 200", () => {
    const ssa = { ...entry, sourceUrl: "https://www.ssa.gov/ssi/" };
    expect(classify(ssa, { code: 200, finalUrl: ssa.sourceUrl })).toEqual({ reach: "ok" });
  });

  it("keeps explicit blocking and blocked-host timeouts on the human path", () => {
    expect(classify(entry, { code: 403, finalUrl: entry.sourceUrl })).toEqual({ reach: "needs_human" });
    const ssa = { ...entry, sourceUrl: "https://www.ssa.gov/ssi/" };
    expect(classify(ssa, { code: 0, finalUrl: ssa.sourceUrl })).toEqual({ reach: "needs_human" });
  });

  it("treats an ordinary timeout as dead and a successful redirect as moved", () => {
    expect(classify(entry, { code: 0, finalUrl: entry.sourceUrl })).toEqual({ reach: "dead" });
    expect(classify(entry, { code: 200, finalUrl: "https://example.org/new-program" })).toEqual({
      reach: "moved"
    });
  });
});

describe("catalog verification report groups", () => {
  it("accounts for owner-only checks without double-counting any result", () => {
    const results = [
      { id: "confirmed", reach: "ok", signal: { kind: "phone" }, humanVerify: false },
      { id: "unconfirmed", reach: "ok", signal: null, humanVerify: false },
      { id: "owner", reach: "ok", signal: { kind: "phone" }, humanVerify: true },
      { id: "blocked", reach: "needs_human", signal: null, humanVerify: false },
      { id: "moved", reach: "moved", signal: null, humanVerify: false },
      { id: "dead", reach: "dead", signal: null, humanVerify: false }
    ];

    const groups = groupResults(results);
    expect(groups.needsHuman.map(({ id }) => id)).toEqual(["owner", "blocked"]);
    expect(Object.values(groups).flat()).toHaveLength(results.length);
    expect(new Set(Object.values(groups).flat().map(({ id }) => id)).size).toBe(results.length);
  });
});
