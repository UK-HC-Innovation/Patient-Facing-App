import { describe, expect, it } from "vitest";
import type { DevNeedDomain, FamilyScreenAnswer } from "./types";
import {
  FAMILY_DOMAIN_LABELS,
  FAMILY_SCREEN_QUESTIONS,
  applyFamilyScreenRetractions,
  computeFamilyFlags,
  familyAnswersToFacts,
  mergeFamilyDomains
} from "./family-screen";

const answers: FamilyScreenAnswer[] = [
  { questionId: "family_early_intervention", domain: "early_intervention", response: "no" },
  { questionId: "family_therapies", domain: "therapies", response: "declined" },
  { questionId: "family_school_iep", domain: "school_iep", response: "yes" },
  { questionId: "family_waivers_financial", domain: "waivers_financial", response: "no" },
  { questionId: "family_respite", domain: "respite", response: "no" },
  { questionId: "family_parent_support", domain: "parent_support", response: "yes" },
  { questionId: "family_sibling_support", domain: "sibling_support", response: "no" },
  { questionId: "family_transportation", domain: "transportation", response: "no" }
];

describe("family screening questions", () => {
  it("defines all eight English and Spanish questions in domain order", () => {
    expect(FAMILY_SCREEN_QUESTIONS).toEqual([
      {
        id: "family_early_intervention",
        domain: "early_intervention",
        en: "Do you want help starting services before your child's third birthday?",
        es: "¿Quiere ayuda para comenzar servicios antes del tercer cumpleaños de su hijo?"
      },
      {
        id: "family_therapies",
        domain: "therapies",
        en: "Would help finding speech, occupational, physical, or behavioral therapies be useful?",
        es: "¿Le serviría ayuda para encontrar terapias del habla, ocupacionales, físicas o conductuales?"
      },
      {
        id: "family_school_iep",
        domain: "school_iep",
        en: "Do you want help with school supports, an ARC meeting, an IEP, or a 504 plan?",
        es: "¿Quiere ayuda con apoyos escolares, una reunión ARC, un IEP o un plan 504?"
      },
      {
        id: "family_waivers_financial",
        domain: "waivers_financial",
        en: "Do you want help with waivers or other financial supports?",
        es: "¿Quiere ayuda con exenciones de Medicaid u otros apoyos económicos?"
      },
      {
        id: "family_respite",
        domain: "respite",
        en: "Would a break from caregiving or respite support help your family?",
        es: "¿Un descanso del cuidado o apoyo de relevo ayudaría a su familia?"
      },
      {
        id: "family_parent_support",
        domain: "parent_support",
        en: "Would you like to meet other parents or a peer mentor?",
        es: "¿Le gustaría conocer a otros padres o a un mentor de pares?"
      },
      {
        id: "family_sibling_support",
        domain: "sibling_support",
        en: "Would support for your child's siblings be helpful?",
        es: "¿Sería útil recibir apoyo para los hermanos de su hijo?"
      },
      {
        id: "family_transportation",
        domain: "transportation",
        en: "Does transportation make it hard to get to services or appointments?",
        es: "¿El transporte dificulta llegar a servicios o citas?"
      }
    ]);
    expect(FAMILY_SCREEN_QUESTIONS.map(({ domain }) => FAMILY_DOMAIN_LABELS[domain].en)).toEqual([
      "Early intervention",
      "Therapies",
      "School and IEP support",
      "Waivers and financial support",
      "Respite",
      "Parent support",
      "Sibling support",
      "Transportation"
    ]);
  });
});

describe("computeFamilyFlags", () => {
  it("returns only yes domains in canonical question order", () => {
    expect(computeFamilyFlags([...answers].reverse())).toEqual(["school_iep", "parent_support"]);
  });

  it("retracts a flag when a question is reanswered no", () => {
    const reanswered = answers.map((answer) =>
      answer.domain === "school_iep" ? { ...answer, response: "no" as const } : answer
    );

    expect(computeFamilyFlags(reanswered)).toEqual(["parent_support"]);
  });
});

describe("familyAnswersToFacts", () => {
  it("turns every answer, including declines, into a screen-scoped patient-reported fact", () => {
    const facts = familyAnswersToFacts(answers, "en");

    expect(facts).toHaveLength(8);
    expect(facts.every(({ status }) => status === "patient_reported")).toBe(true);
    expect(facts.every((fact) => !("interviewId" in fact))).toBe(true);
    expect(facts.find(({ label }) => label.includes("Therapies"))).toMatchObject({
      value: "Declined to answer",
      sourceSnippet: FAMILY_SCREEN_QUESTIONS[1].en
    });
  });

  it("uses the selected language for the source question", () => {
    const facts = familyAnswersToFacts([answers[0]], "es");

    expect(facts[0].sourceSnippet).toBe(FAMILY_SCREEN_QUESTIONS[0].es);
    expect(facts[0]).toMatchObject({
      label: "Necesidad familiar — Intervención temprana",
      value: "No se reportó una necesidad"
    });
    expect(facts[0].label).not.toContain("Family need");
  });
});

describe("mergeFamilyDomains", () => {
  it("puts screen flags first and appends deduplicated latest-interview domains", () => {
    expect(mergeFamilyDomains(answers, ["waivers_financial", "school_iep", "waivers_financial"])).toEqual([
      "school_iep",
      "parent_support",
      "waivers_financial"
    ]);
  });

  it("replaces both screen and interview contributions instead of accumulating stale domains", () => {
    const reanswered = answers.map((answer) => ({ ...answer, response: "no" as const }));

    expect(mergeFamilyDomains(reanswered, ["waivers_financial"])).toEqual(["waivers_financial"]);
  });
});

describe("applyFamilyScreenRetractions", () => {
  it("applies only explicit screen-domain retractions in stable order", () => {
    const carried = [
      "school_iep",
      "parent_support",
      "future_planning",
      "diagnosis_education",
      "recreation"
    ] satisfies DevNeedDomain[];
    const screenAnswers: FamilyScreenAnswer[] = [
      {
        questionId: "family_school_iep",
        domain: "school_iep",
        response: "no"
      },
      {
        questionId: "family_parent_support",
        domain: "parent_support",
        response: "declined"
      },
      {
        questionId: "fabricated-future",
        domain: "future_planning",
        response: "no"
      },
      {
        questionId: "fabricated-diagnosis",
        domain: "diagnosis_education",
        response: "no"
      },
      {
        questionId: "fabricated-recreation",
        domain: "recreation",
        response: "no"
      }
    ];

    expect(
      applyFamilyScreenRetractions(screenAnswers, carried)
    ).toEqual([
      "parent_support",
      "future_planning",
      "diagnosis_education",
      "recreation"
    ]);
    expect(
      applyFamilyScreenRetractions(
        [
          {
            questionId: "family_school_iep",
            domain: "school_iep",
            response: "yes"
          }
        ],
        carried
      )
    ).toEqual(carried);
  });
});
