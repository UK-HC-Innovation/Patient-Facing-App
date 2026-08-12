import { describe, expect, it } from "vitest";
import { classifySafety, normalizeSpokenReading } from "./safety";

describe("classifySafety", () => {
  it("blocks medication change advice", () => {
    const result = classifySafety("Should I stop taking lisinopril?");

    expect(result.level).toBe("blocked");
    expect(result.response).toContain("I cannot tell you to stop");
  });

  it("escalates warning symptoms", () => {
    const result = classifySafety("I have chest pain and my blood pressure is high.");

    expect(result.level).toBe("escalate");
    expect(result.response).toContain("seek urgent help now");
  });

  it("escalates dangerous blood-pressure-only readings", () => {
    const result = classifySafety("My BP is 200/120");

    expect(result.level).toBe("escalate");
    expect(result.response).toContain("seek urgent help now");
  });

  it("escalates very low blood-pressure readings", () => {
    expect(classifySafety("My BP is 82/50").level).toBe("escalate");
    expect(classifySafety("systolic 85 diastolic 55").level).toBe("escalate");
  });

  it("escalates unlabeled dangerous readings like bare numbers", () => {
    expect(classifySafety("200/120").level).toBe("escalate");
    expect(classifySafety("My reading is 200/120").level).toBe("escalate");
    expect(classifySafety("systolic 200 diastolic 120").level).toBe("escalate");
  });

  it("escalates breathing-related distress language", () => {
    expect(classifySafety("I can't breathe").level).toBe("escalate");
    expect(classifySafety("I cannot breathe").level).toBe("escalate");
    expect(classifySafety("I'm having trouble breathing").level).toBe("escalate");
  });

  it("recognizes urgent symptoms, severe hypoglycemia, and medication changes in Spanish", () => {
    expect(classifySafety("Tengo dolor en el pecho").level).toBe("escalate");
    expect(classifySafety("No puedo respirar").level).toBe("escalate");
    expect(classifySafety("Mi glucosa es 45").level).toBe("escalate");
    expect(classifySafety("¿Debo dejar de tomar lisinopril?").level).toBe("blocked");
  });

  it("does not escalate explicitly negated urgent symptoms", () => {
    expect(classifySafety("My child has no chest pain and is breathing normally").level).toBe("allowed");
    expect(classifySafety("No shortness of breath").level).toBe("allowed");
    expect(classifySafety("No new confusion").level).toBe("allowed");
    expect(classifySafety("He is not fainting").level).toBe("allowed");
    expect(classifySafety("I have no chest pain, but I cannot breathe").level).toBe("escalate");
  });

  it("still escalates an active symptom after an earlier denial of the same symptom", () => {
    expect(classifySafety("No chest pain earlier, but now I have chest pain").level).toBe("escalate");
    expect(classifySafety("I don't have shortness of breath, but I can't breathe").level).toBe("escalate");
  });

  it("allows repeated denials after every denied symptom span is removed", () => {
    expect(classifySafety("No chest pain earlier and no chest pain now").level).toBe("allowed");
    expect(classifySafety("No shortness of breath and no trouble breathing").level).toBe("allowed");
  });

  it("blocks common medication-adjustment phrasing", () => {
    expect(classifySafety("should I increase my dose").level).toBe("blocked");
    expect(classifySafety("can I take two").level).toBe("blocked");
    expect(classifySafety("Can I stop for a day").level).toBe("blocked");
  });

  it("escalates spoken and 'over' word-form dangerous readings", () => {
    expect(classifySafety("my blood pressure is 200 over 130").level).toBe("escalate");
    expect(classifySafety("one eighty over one twenty").level).toBe("escalate");
    expect(classifySafety("two hundred over one ten").level).toBe("escalate");
  });

  it("still ignores implausible or non-dangerous 'over' readings", () => {
    expect(classifySafety("my blood pressure was 150 over 95 after the stairs").level).toBe("allowed");
    expect(classifySafety("I walked over 100 steps today").level).toBe("allowed");
  });

  it("allows education questions", () => {
    const result = classifySafety("Why does blood pressure medicine matter?");

    expect(result.level).toBe("allowed");
  });

  it("escalates a severe low blood-sugar utterance", () => {
    expect(classifySafety("my blood sugar is 45").level).toBe("escalate");
    expect(classifySafety("glucose reading of 48 this morning").level).toBe("escalate");
  });

  it("escalates a very high reading only alongside a ketoacidosis symptom cue", () => {
    expect(classifySafety("my blood sugar is 260 and I keep vomiting").level).toBe("escalate");
    expect(classifySafety("blood sugar 260").level).toBe("allowed");
  });

  it("does not treat a bare number without a glucose cue as dangerous", () => {
    expect(classifySafety("180").level).toBe("allowed");
    expect(classifySafety("I walked 45 minutes today").level).toBe("allowed");
  });

  it("does not misread honest metformin logging as an escalation", () => {
    expect(classifySafety("I took all my metformin this morning").level).not.toBe("escalate");
  });
});

describe("normalizeSpokenReading", () => {
  it("rewrites spoken and digit blood-pressure phrases to S/D", () => {
    expect(normalizeSpokenReading("200 over 130")).toBe("200/130");
    expect(normalizeSpokenReading("one eighty over one twenty")).toBe("180/120");
    expect(normalizeSpokenReading("ninety over sixty")).toBe("90/60");
  });

  it("leaves ordinary 'over' prose untouched", () => {
    expect(normalizeSpokenReading("I climbed over the fence")).toBe("I climbed over the fence");
  });
});
