import { describe, expect, it } from "vitest";
import {
  PSC17_INSTRUMENT,
  PSC17_SUBSCALE_IDS,
  scorePsc17Subscales
} from "./psc17";

describe("PSC-17", () => {
  it("uses the locked common interleaved semantic order", () => {
    expect(PSC17_INSTRUMENT.items.map(({ id }) => id)).toEqual([
      "fidgety",
      "feels_sad",
      "daydreams_too_much",
      "refuses_to_share",
      "does_not_understand_feelings",
      "feels_hopeless",
      "trouble_concentrating",
      "fights_with_children",
      "down_on_self",
      "blames_others",
      "less_fun",
      "does_not_listen_to_rules",
      "driven_by_motor",
      "teases_others",
      "worries_a_lot",
      "takes_things",
      "distracted_easily"
    ]);
    expect(PSC17_INSTRUMENT.items).toHaveLength(17);
  });

  it("maps every semantic item to exactly one locked subscale", () => {
    const allIds = Object.values(PSC17_SUBSCALE_IDS).flat();
    expect(new Set(allIds).size).toBe(17);
    expect(allIds).toEqual(expect.arrayContaining(PSC17_INSTRUMENT.items.map(({ id }) => id)));
    expect(PSC17_SUBSCALE_IDS).toEqual({
      internalizing: ["feels_sad", "feels_hopeless", "down_on_self", "less_fun", "worries_a_lot"],
      attention: ["fidgety", "daydreams_too_much", "trouble_concentrating", "driven_by_motor", "distracted_easily"],
      externalizing: [
        "refuses_to_share",
        "does_not_understand_feelings",
        "fights_with_children",
        "blames_others",
        "does_not_listen_to_rules",
        "teases_others",
        "takes_things"
      ]
    });
  });

  it.each([
    ["internalizing", 4, 5],
    ["attention", 6, 7],
    ["externalizing", 6, 7]
  ] as const)("locks the %s one-below/at cutoff", (subscale, below, at) => {
    const ids: readonly string[] = PSC17_SUBSCALE_IDS[subscale];
    const makeResponses = (score: number) =>
      PSC17_INSTRUMENT.items.map(({ id }) => {
        const position = ids.indexOf(id);
        return position < 0 ? 0 : Math.max(0, Math.min(2, score - position * 2));
      });
    expect(scorePsc17Subscales(makeResponses(below))[subscale]).toBe(below);
    expect(PSC17_INSTRUMENT.score(makeResponses(below)).band).toBe("lower_risk");
    expect(scorePsc17Subscales(makeResponses(at))[subscale]).toBe(at);
    expect(PSC17_INSTRUMENT.score(makeResponses(at)).band).toBe("discuss");
  });

  it("locks the total 14/15 boundary independently of subscale cutoffs", () => {
    const fourteen = [2, 2, 2, 2, 2, 2, 2, ...Array(10).fill(0)];
    const fifteen = [2, 2, 2, 2, 2, 2, 2, 1, ...Array(9).fill(0)];
    expect(PSC17_INSTRUMENT.score(fourteen)).toEqual({ totalScore: 14, band: "lower_risk" });
    expect(PSC17_INSTRUMENT.score(fifteen)).toEqual({ totalScore: 15, band: "discuss" });
  });

  it("does not invent PSC-35 missing-data imputation for an incomplete PSC-17", () => {
    expect(() => scorePsc17Subscales(Array(16).fill(0))).toThrow(RangeError);
    expect(() => PSC17_INSTRUMENT.score(Array(16).fill(0))).toThrow(RangeError);
  });
});
