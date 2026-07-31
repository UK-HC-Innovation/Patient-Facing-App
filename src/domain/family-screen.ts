import type { Language } from "@/i18n/strings";
import type { DevNeedDomain, FamilyFact, FamilyScreenAnswer } from "./types";

export type FamilyScreenQuestion = {
  id: string;
  domain: DevNeedDomain;
  en: string;
  es: string;
};

export const FAMILY_DOMAIN_LABELS: Record<DevNeedDomain, { en: string; es: string }> = {
  early_intervention: { en: "Early intervention", es: "Intervención temprana" },
  therapies: { en: "Therapies", es: "Terapias" },
  school_iep: { en: "School and IEP support", es: "Apoyo escolar y de IEP" },
  waivers_financial: { en: "Waivers and financial support", es: "Exenciones y apoyo económico" },
  respite: { en: "Respite", es: "Relevo" },
  parent_support: { en: "Parent support", es: "Apoyo para padres" },
  sibling_support: { en: "Sibling support", es: "Apoyo para hermanos" },
  transportation: { en: "Transportation", es: "Transporte" },
  future_planning: { en: "Future planning", es: "Planificación para el futuro" },
  diagnosis_education: { en: "Diagnosis education", es: "Educación sobre el diagnóstico" },
  recreation: { en: "Recreation", es: "Recreación" }
};

export const FAMILY_SCREEN_QUESTIONS: FamilyScreenQuestion[] = [
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
];

const FAMILY_SCREEN_DOMAIN_SET = new Set<DevNeedDomain>(
  FAMILY_SCREEN_QUESTIONS.map(({ domain }) => domain)
);

export function applyFamilyScreenRetractions(
  answers: FamilyScreenAnswer[],
  interviewDomains: DevNeedDomain[]
): DevNeedDomain[] {
  const retracted = new Set(
    answers.flatMap(({ domain, response }) =>
      response === "no" && FAMILY_SCREEN_DOMAIN_SET.has(domain)
        ? [domain]
        : []
    )
  );
  return interviewDomains.filter((domain) => !retracted.has(domain));
}

export function computeFamilyFlags(answers: FamilyScreenAnswer[]): DevNeedDomain[] {
  const flagged = new Set(
    answers.filter(({ response }) => response === "yes").map(({ domain }) => domain)
  );

  return FAMILY_SCREEN_QUESTIONS.map(({ domain }) => domain).filter((domain) => flagged.has(domain));
}

const SCREEN_ANSWER_VALUES: Record<Language, Record<FamilyScreenAnswer["response"], string>> = {
  en: { yes: "Reported a need", no: "No need reported", declined: "Declined to answer" },
  es: {
    yes: "Necesidad reportada",
    no: "No se reportó una necesidad",
    declined: "Prefirió no responder"
  }
};

const SCREEN_LABEL_PREFIX: Record<Language, string> = { en: "Family need", es: "Necesidad familiar" };

/**
 * A screen fact records an answer, not testimony, and its value is the only
 * thing on the fact that says which answer it was — written in whichever
 * language the family was answering in. Only a yes is a need worth carrying to
 * the clinic.
 */
export function isFamilyReportedNeed(value: string): boolean {
  const trimmed = value.trim();
  return Object.values(SCREEN_ANSWER_VALUES).some((values) => values.yes === trimmed);
}

export function familyAnswersToFacts(answers: FamilyScreenAnswer[], language: Language): FamilyFact[] {
  return answers.map((answer) => {
    const question = FAMILY_SCREEN_QUESTIONS.find(({ id }) => id === answer.questionId);

    return {
      id: crypto.randomUUID(),
      label: `${SCREEN_LABEL_PREFIX[language]} — ${FAMILY_DOMAIN_LABELS[answer.domain][language]}`,
      value: SCREEN_ANSWER_VALUES[language][answer.response],
      status: "patient_reported",
      sourceSnippet: question ? question[language] : answer.questionId
    };
  });
}

export function mergeFamilyDomains(
  answers: FamilyScreenAnswer[],
  latestInterviewDomains: DevNeedDomain[]
): DevNeedDomain[] {
  return [...new Set([...computeFamilyFlags(answers), ...latestInterviewDomains])];
}
