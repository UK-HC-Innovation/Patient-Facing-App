import { describe, expect, it } from "vitest";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import { applyLadderSimulation, withoutLadderSimulation } from "@/components/ladder/ladder-simulation";
import { createLadderSessionState } from "@/components/ladder/ladder-session-reducer";

describe("Ladder simulation projection", () => {
  it("overlays diagnosis dates without mutating the durable profile", () => {
    const family = structuredClone(schoolAgeFamilyState);
    const session = createLadderSessionState("unset");
    session.simulation.diagnosisDates = { [family.profile!.diagnoses[0].id]: "2026-07" };

    const projected = applyLadderSimulation(family, session.simulation);
    expect(projected.profile!.diagnoses[0].diagnosedAt).toBe("2026-07");
    expect(family.profile!.diagnoses[0].diagnosedAt).not.toBe("2026-07");
  });

  it("strips legacy visit simulation fields from a durable projection", () => {
    const family = {
      ...schoolAgeFamilyState,
      referral: { clinic: "Demo", referredAt: "2026-08-08T12:00:00.000Z" }
    };
    expect(withoutLadderSimulation(family)).toMatchObject({
      referral: null,
      appointments: [],
      soonerList: null
    });
  });
});
