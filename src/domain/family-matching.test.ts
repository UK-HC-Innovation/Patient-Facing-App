import { describe, expect, it } from "vitest";
import { buildRankCandidates, buildResourceMatches } from "./family-matching";
import type { FamilyProfile } from "./types";

const jaylen: FamilyProfile = {
  childFirstName: "Jaylen",
  birthYear: 2018,
  birthMonth: 3,
  schoolStage: "elementary",
  county: "Breathitt",
  diagnoses: []
};

const jaylenDomains = ["therapies", "transportation"] as const;
const statewideNavigationIds = ["kynect_resources", "kentucky_211"] as const;

function expectLklpBeforeStatewide(resourceIds: string[]) {
  const lklpPosition = resourceIds.indexOf("lklp_transportation_region_13");

  expect(lklpPosition).toBeGreaterThanOrEqual(0);
  for (const statewideId of statewideNavigationIds) {
    expect(lklpPosition).toBeLessThan(resourceIds.indexOf(statewideId));
  }
}

describe("L02 Breathitt transportation retrieval", () => {
  it("shows Jaylen the Breathitt-serving LKLP ride before statewide navigation", () => {
    const resourceIds = buildResourceMatches(jaylen, [...jaylenDomains], []).resources.map(({ resource }) => resource.id);

    expectLklpBeforeStatewide(resourceIds);
  });

  it("offers the Breathitt-serving LKLP ride to the ranking layer before statewide navigation", () => {
    const resourceIds = buildRankCandidates(jaylen, [...jaylenDomains], []).resources.map(({ resource }) => resource.id);

    expectLklpBeforeStatewide(resourceIds);
  });

  it("does not offer the Region 13 ride to Pike County", () => {
    const pike: FamilyProfile = { ...jaylen, county: "Pike" };
    const resourceIds = buildRankCandidates(pike, [...jaylenDomains], []).resources.map(({ resource }) => resource.id);

    expect(resourceIds).not.toContain("lklp_transportation_region_13");
  });
});
