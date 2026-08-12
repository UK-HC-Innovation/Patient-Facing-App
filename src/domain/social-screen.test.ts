import { describe, expect, it } from "vitest";
import {
  buildSocialScreenRecord,
  classifySocialEmergency,
  computeSocialFlags,
  screenSocialEmergency,
  socialAnswersToFacts,
  suggestZCodes,
  type SocialAnswer
} from "./social-screen";

const answers: SocialAnswer[] = [
  { questionId: "social_food", domain: "food", response: "yes" },
  { questionId: "social_housing", domain: "housing", response: "no" },
  { questionId: "social_utilities", domain: "utilities", response: "no" },
  { questionId: "social_transportation", domain: "transportation", response: "declined" },
  { questionId: "social_financial", domain: "financial", response: "yes" }
];

describe("computeSocialFlags", () => {
  it("flags only the domains answered yes, in question order", () => {
    expect(computeSocialFlags(answers)).toEqual(["food", "financial"]);
  });

  it("flags nothing when there are no yes answers", () => {
    expect(
      computeSocialFlags([{ questionId: "social_food", domain: "food", response: "no" }])
    ).toEqual([]);
  });
});

describe("socialAnswersToFacts", () => {
  it("records every answer as a patient-reported fact, including declines", () => {
    const facts = socialAnswersToFacts(answers, "ctx-1", "en");

    expect(facts.every((fact) => fact.status === "patient_reported")).toBe(true);
    expect(facts.every((fact) => fact.contextItemId === "ctx-1")).toBe(true);
    const declined = facts.find((fact) => fact.label.includes("Transportation"));
    expect(declined?.value).toBe("Declined to answer");
  });

  it("keeps context-item relationships valid via buildSocialScreenRecord", () => {
    const record = buildSocialScreenRecord(answers, "patient-brent", "2026-07-06T12:00:00.000Z", "en");
    expect(record.facts.every((fact) => fact.contextItemId === record.item.id)).toBe(true);
    expect(record.item.title).toBe("Social needs check-in");
  });
});

describe("screenSocialEmergency", () => {
  it("escalates acute material emergencies", () => {
    expect(screenSocialEmergency("I have no food today")).toBe(true);
    expect(screenSocialEmergency("the children are hungry")).toBe(true);
    expect(screenSocialEmergency("My daughter is hungry")).toBe(true);
    expect(screenSocialEmergency("We are out of food")).toBe(true);
    expect(screenSocialEmergency("We ran out of food today")).toBe(true);
    expect(screenSocialEmergency("I do not have any food today")).toBe(true);
    expect(screenSocialEmergency("I'm out of insulin")).toBe(true);
    expect(screenSocialEmergency("my insulin is all gone")).toBe(true);
    expect(screenSocialEmergency("Hoy no tenemos comida")).toBe(true);
    expect(screenSocialEmergency("Ahora no hay comida")).toBe(true);
    expect(screenSocialEmergency("En casa no tenemos comida")).toBe(true);
    expect(screenSocialEmergency("No queda comida en casa")).toBe(true);
    expect(screenSocialEmergency("Nos quedamos sin comida hoy")).toBe(true);
    expect(screenSocialEmergency("Se me acabó la insulina")).toBe(true);
    expect(screenSocialEmergency("I have no insulin left")).toBe(true);
    expect(screenSocialEmergency("There is no insulin left")).toBe(true);
    expect(screenSocialEmergency("Me quedé sin mi insulina")).toBe(true);
  });

  it("keeps basic-needs and medicine-access actions distinct", () => {
    expect(classifySocialEmergency("I have no food today")).toBe("basic_needs");
    expect(classifySocialEmergency("I'm out of insulin")).toBe("medication_access");
    expect(classifySocialEmergency("We have no food today and I am out of insulin")).toBe(
      "basic_needs_and_medication_access"
    );
    expect(classifySocialEmergency("No hay comida hoy")).toBe("basic_needs");
    expect(classifySocialEmergency("No tengo comida hoy")).toBe("basic_needs");
    expect(classifySocialEmergency("Mis hijos tienen hambre")).toBe("basic_needs");
    expect(classifySocialEmergency("Mi hija tiene hambre")).toBe("basic_needs");
    expect(classifySocialEmergency("Me quedé sin insulina")).toBe("medication_access");
    expect(classifySocialEmergency("No tengo insulina")).toBe("medication_access");
    expect(classifySocialEmergency("No me queda medicamento")).toBe("medication_access");
    expect(classifySocialEmergency("I need a food pantry this week")).toBeNull();
  });

  it("does not escalate routine support requests", () => {
    expect(screenSocialEmergency("I need help finding a food pantry this week")).toBe(false);
    expect(screenSocialEmergency("can you help me with my electric bill")).toBe(false);
    expect(screenSocialEmergency("I am not out of insulin")).toBe(false);
    expect(screenSocialEmergency("I am not actually out of insulin")).toBe(false);
    expect(screenSocialEmergency("I am no longer out of insulin")).toBe(false);
    expect(screenSocialEmergency("I won't be out of insulin")).toBe(false);
    expect(screenSocialEmergency("My medicine ran out last week, but I refilled it")).toBe(false);
    expect(screenSocialEmergency("I was out of insulin, but I picked it up")).toBe(false);
    expect(screenSocialEmergency("We were out of insulin yesterday, but we have it now")).toBe(false);
    expect(screenSocialEmergency("My insulin ran out, but the pharmacy refilled it")).toBe(false);
    expect(screenSocialEmergency("Se me acabó la insulina, pero ya la recogí")).toBe(false);
    expect(screenSocialEmergency("my children are not hungry")).toBe(false);
    expect(screenSocialEmergency("mi hijo no tiene hambre")).toBe(false);
    expect(screenSocialEmergency("mi hijo nunca tiene hambre")).toBe(false);
    expect(screenSocialEmergency("no me falta insulina")).toBe(false);
  });
});

describe("suggestZCodes", () => {
  it("returns deterministic needs_review Z-codes for flagged domains", () => {
    const codes = suggestZCodes(["food", "financial"]);

    expect(codes.map((code) => code.code)).toEqual(["Z59.41", "Z59.86"]);
    expect(codes.every((code) => code.status === "needs_review")).toBe(true);
  });
});
