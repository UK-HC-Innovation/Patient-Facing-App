import { describe, expect, it } from "vitest";
import { STEADI3_INSTRUMENT } from "./steadi3";

describe("STEADI three-question check", () => {
  it.each([
    [[1, 0, 0, 0], "fall"],
    [[0, 1, 0, -1], "unsteadiness"],
    [[0, 0, 1, -1], "worry"]
  ] as const)("classifies a single yes for %s as at risk", (responses, label) => {
    expect(STEADI3_INSTRUMENT.score([...responses]).band, label).toBe("at_risk");
  });

  it("distinguishes a fall with injury from a fall without injury", () => {
    expect(STEADI3_INSTRUMENT.score([1, 0, 0, 1]).band).toBe("fall_with_injury");
    expect(STEADI3_INSTRUMENT.score([1, 0, 0, 0]).band).toBe("at_risk");
  });

  it("classifies three no answers as lower risk and preserves the hidden sentinel", () => {
    expect(STEADI3_INSTRUMENT.score([0, 0, 0, -1])).toEqual({ totalScore: 0, band: "lower_risk" });
    expect(STEADI3_INSTRUMENT.items[3]).toMatchObject({
      conditionalOn: { itemId: "fallen", atLeast: 1 },
      notApplicableValue: -1
    });
  });

  it("locks the three official English core questions", () => {
    expect(STEADI3_INSTRUMENT.items.slice(0, 3).map(({ en }) => en)).toEqual([
      "Have you fallen in the past year?",
      "Do you feel unsteady when standing or walking?",
      "Are you worried about falling?"
    ]);
  });
});
