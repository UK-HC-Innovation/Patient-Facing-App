import { describe, expect, it } from "vitest";
import { CRC_ELIGIBILITY_INSTRUMENT } from "./crc-eligibility";

describe("colorectal screening eligibility", () => {
  it.each([
    [44, "not_due"],
    [45, "due"],
    [75, "due"],
    [76, "not_due"]
  ] as const)("classifies age %i as %s when no recent screening is reported", (age, band) => {
    expect(CRC_ELIGIBILITY_INSTRUMENT.score([age, 0, 0, 0, 0, 0]).band).toBe(band);
  });

  it.each([
    [[60, 1, 0, 0, 0, 0], "colonoscopy"],
    [[60, 0, 1, 0, 0, 0], "FIT"],
    [[60, 0, 0, 1, 0, 0], "other modality"]
  ] as const)("marks recent %s screening not due", (responses, label) => {
    expect(CRC_ELIGIBILITY_INSTRUMENT.score([...responses]).band, label).toBe("not_due");
  });

  it.each([
    [[60, 0, 0, 0, 1, 0], "red flag"],
    [[60, 1, 1, 1, 0, 1], "family history"]
  ] as const)("routes a %s to clinician contact instead of routine screening", (responses, label) => {
    expect(CRC_ELIGIBILITY_INSTRUMENT.score([...responses]).band, label).toBe("see_clinician_now");
  });

  it("locks the combined other-modality wording and fixed response length", () => {
    expect(CRC_ELIGIBILITY_INSTRUMENT.items).toHaveLength(6);
    expect(CRC_ELIGIBILITY_INSTRUMENT.items[3].en).toBe(
      "Have you had another colon screening test — like a stool-DNA (Cologuard) test in the last 3 years, or a sigmoidoscopy or CT colonography in the last 5 years?"
    );
    expect(CRC_ELIGIBILITY_INSTRUMENT.items[3].es).toContain("ADN en heces (Cologuard)");
  });
});
