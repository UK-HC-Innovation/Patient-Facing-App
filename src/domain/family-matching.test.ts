import { describe, expect, it } from "vitest";
import { buildRankCandidates, buildResourceMatches } from "./family-matching";
import { FAMILY_RESOURCE_CATALOG } from "./family-resources";
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

  it("keeps an enrolled LKLP ride after unenrolled statewide navigation", () => {
    const resourceIds = buildRankCandidates(jaylen, [...jaylenDomains], ["lklp_transportation_region_13"]).resources.map(
      ({ resource }) => resource.id
    );

    for (const statewideId of statewideNavigationIds) {
      expect(resourceIds.indexOf("lklp_transportation_region_13")).toBeGreaterThan(resourceIds.indexOf(statewideId));
    }
  });

  it("keeps another enrolled resource after deferred statewide navigation", () => {
    const resourceIds = buildRankCandidates(jaylen, [...jaylenDomains], ["ocshcn"]).resources.map(
      ({ resource }) => resource.id
    );

    expectLklpBeforeStatewide(resourceIds);
    for (const statewideId of statewideNavigationIds) {
      expect(resourceIds.indexOf("ocshcn")).toBeGreaterThan(resourceIds.indexOf(statewideId));
    }
  });

  it("preserves capped Perry candidates and unrelated cross-domain order", () => {
    const perry: FamilyProfile = { ...jaylen, county: "Perry" };
    const max = 6;
    const matchedIds = buildResourceMatches(perry, [...jaylenDomains], [], FAMILY_RESOURCE_CATALOG.length).resources
      .slice(0, max)
      .map(({ resource }) => resource.id);
    const rankedIds = buildRankCandidates(perry, [...jaylenDomains], [], max).resources.map(({ resource }) => resource.id);

    expect(rankedIds).toEqual(matchedIds);
  });
});
