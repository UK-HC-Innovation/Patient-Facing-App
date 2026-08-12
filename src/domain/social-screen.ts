import type { Language } from "@/i18n/strings";
import type { CareContextItem, ExtractedFact } from "./types";
import type { SdohNeedType } from "./sdoh-resources";

// Material-domain screening only (PRAPARE-core style). No suicidal-ideation,
// mood, or IPV items — plan 03 FR-16 still gates those on the F8 return channel
// even with the F4 crisis pathway built.
export type SocialDomain = "food" | "housing" | "utilities" | "transportation" | "financial";

export type SocialResponse = "yes" | "no" | "declined";

export type SocialAnswer = {
  questionId: string;
  domain: SocialDomain;
  response: SocialResponse;
};

export type SocialScreenQuestion = {
  id: string;
  domain: SocialDomain;
  en: string;
  es: string;
};

export const SOCIAL_DOMAIN_LABELS: Record<SocialDomain, { en: string; es: string }> = {
  food: { en: "Food", es: "Comida" },
  housing: { en: "Housing", es: "Vivienda" },
  utilities: { en: "Utilities", es: "Servicios" },
  transportation: { en: "Transportation", es: "Transporte" },
  financial: { en: "Finances", es: "Finanzas" }
};

export const SOCIAL_SCREEN_QUESTIONS: SocialScreenQuestion[] = [
  {
    id: "social_food",
    domain: "food",
    en: "In the last 12 months, did you worry your food would run out before you had money to buy more?",
    es: "En los últimos 12 meses, ¿te preocupó que la comida se acabara antes de tener dinero para comprar más?"
  },
  {
    id: "social_housing",
    domain: "housing",
    en: "Are you worried about losing your housing or not having a steady place to live?",
    es: "¿Te preocupa perder tu vivienda o no tener un lugar estable donde vivir?"
  },
  {
    id: "social_utilities",
    domain: "utilities",
    en: "In the last 12 months, has an electric, gas, water, or phone company threatened to shut off your service?",
    es: "En los últimos 12 meses, ¿una compañía de luz, gas, agua o teléfono amenazó con cortar tu servicio?"
  },
  {
    id: "social_transportation",
    domain: "transportation",
    en: "In the last 12 months, has a lack of transportation kept you from medical appointments or getting what you need?",
    es: "En los últimos 12 meses, ¿la falta de transporte te impidió ir a citas médicas u obtener lo que necesitas?"
  },
  {
    id: "social_financial",
    domain: "financial",
    en: "Do you have trouble paying for the basics like food, housing, or medicine?",
    es: "¿Tienes dificultad para pagar lo básico como comida, vivienda o medicinas?"
  }
];

// FR-3: pure flag computation — a domain is flagged only on an explicit "yes".
export function computeSocialFlags(answers: SocialAnswer[]): SocialDomain[] {
  const flagged = new Set<SocialDomain>();
  for (const answer of answers) {
    if (answer.response === "yes") {
      flagged.add(answer.domain);
    }
  }
  return SOCIAL_SCREEN_QUESTIONS.map((question) => question.domain).filter((domain) => flagged.has(domain));
}

// Material domains map straight onto the SDOH resource need types.
export function socialDomainToNeedType(domain: SocialDomain): SdohNeedType {
  return domain;
}

// FR-2: answers (including recorded declines, FR-14) become patient-reported
// extracted facts tied to a context item.
export function socialAnswersToFacts(answers: SocialAnswer[], contextItemId: string, language: Language): ExtractedFact[] {
  return answers.map((answer) => {
    const question = SOCIAL_SCREEN_QUESTIONS.find((item) => item.id === answer.questionId);
    const value =
      answer.response === "yes"
        ? "Reported a need"
        : answer.response === "no"
          ? "No need reported"
          : "Declined to answer";
    return {
      id: crypto.randomUUID(),
      contextItemId,
      label: `Social need — ${SOCIAL_DOMAIN_LABELS[answer.domain].en}`,
      value,
      confidence: "high",
      status: "patient_reported",
      sourceSnippet: question ? question[language] : answer.questionId
    };
  });
}

export function buildSocialScreenRecord(
  answers: SocialAnswer[],
  patientId: string,
  createdAt: string,
  language: Language
): { item: CareContextItem; facts: ExtractedFact[] } {
  const flagged = computeSocialFlags(answers)
    .map((domain) => SOCIAL_DOMAIN_LABELS[domain].en)
    .join(", ");
  const item: CareContextItem = {
    id: crypto.randomUUID(),
    patientId,
    title: "Social needs check-in",
    rawText: flagged.length > 0 ? `Reported needs: ${flagged}.` : "No material needs reported.",
    sourceLabel: "Support screen",
    createdAt
  };
  return { item, facts: socialAnswersToFacts(answers, item.id, language) };
}

const BASIC_NEEDS_EMERGENCY_PATTERNS = [
  /no food (?:today|left|right now|in the house|at all)/i,
  /\b(?:we(?:'re| are)|i(?:'m| am)) out of food\b/i,
  /\b(?:i|we) (?:(?:ran out of) food|(?:do not|don't) have (?:any )?food)(?: today| right now| at home| in the house)?\b/i,
  /nothing to eat/i,
  /(?:kids?|children|child|sons?|daughters?|bab(?:y|ies))\b[^.?!]{0,24}\bhungry/i,
  /no (?:hay|tengo|tenemos) comida (?:hoy|ahora|en (?:la )?casa)/i,
  /(?:hoy|ahora) no (?:hay|tengo|tenemos) comida\b/i,
  /en (?:la )?casa no (?:hay|tengo|tenemos) comida\b/i,
  /no queda comida (?:hoy|ahora|en (?:la )?casa)\b/i,
  /(?:me qued[eé]|nos quedamos) sin comida(?: hoy| ahora| en (?:la )?casa)?\b/i,
  /nada (?:para|que) comer/i,
  /(?:mi |mis |el |la |los |las )?(?:niño|niña|niños|niñas|hijo|hija|hijos|hijas|menor|menores)\b[^.?!]{0,24}\b(?:tiene|tienen) hambre/i
];

const MEDICATION_ACCESS_EMERGENCY_PATTERNS = [
  /out of (?:insulin|medicine|medication)/i,
  /(?:insulin|medicine|medication)s?\b[^.?!]{0,24}\b(?:none left|ran out|all gone)/i,
  /(?:have|has|there (?:is|are)) no (?:insulin|medicine|medication) left/i,
  /(?:no more|none left|ran out of)\s+(?:insulin|medicine|medication)/i,
  /(?:me qued[eé]|nos quedamos) sin (?:(?:mi|nuestra) )?(?:la )?(?:insulina|medicina|medicamento)/i,
  /no (?:me|nos) queda (?:insulina|medicina|medicamento)/i,
  /(?:no (?:hay|tengo|tenemos)|(?:me|nos) falta) (?:insulina|medicina|medicamento)/i,
  /se (?:(?:me|nos) )?(?:acab[oó]|agot[oó]) (?:la )?(?:insulina|medicina|medicamento)/i
];

export type SocialEmergencyKind =
  | "basic_needs"
  | "medication_access"
  | "basic_needs_and_medication_access";

function stripSocialNegations(input: string): string {
  return input
    // A resolved past interruption is not a current emergency. Mask the whole
    // event-through-resolution span before the positive patterns run, while
    // leaving any later, independent current disclosure scannable.
    .replace(
      /\b(?:my\s+)?(?:insulin|medicine|medication)s?\s+(?:ran out|was (?:all )?gone)\b[^.?!]{0,80}?\b(?:but|and)\b[^.?!]{0,40}?\b(?:(?:i|we)\s+(?:have\s+)?(?:refilled (?:it|them)|picked (?:it|them|more) up|got (?:more|a refill)|have (?:it|them) now)|(?:the\s+)?pharmacy\s+refilled (?:it|them))\b/gi,
      " "
    )
    .replace(
      /\b(?:i|we)\s+(?:(?:was|were)\s+out of|ran out of|had no)\s+(?:insulin|medicine|medication)\b[^.?!]{0,80}?\b(?:but|and)\b[^.?!]{0,40}?\b(?:(?:i|we)\s+(?:have\s+)?(?:refilled (?:it|them)|picked (?:it|them|more) up|got (?:more|a refill)|have (?:it|them) now)|(?:the\s+)?pharmacy\s+refilled (?:it|them))\b/gi,
      " "
    )
    .replace(
      /\b(?:se (?:(?:me|nos) )?(?:acab[oó]|agot[oó]) (?:la )?(?:insulina|medicina|medicamento)|(?:me qued[eé]|nos quedamos) sin (?:(?:mi|nuestra) )?(?:la )?(?:insulina|medicina|medicamento))\b[^.?!]{0,80}?\bpero\b[^.?!]{0,40}?\b(?:ya\s+)?(?:(?:la|lo)\s+recog[íi]|(?:la farmacia|el farmac[eé]utico)\s+(?:la|lo)\s+repuso|(?:tengo|tenemos) (?:la|lo|insulina|medicina|medicamento) ahora)(?=$|[\s,.!?])/gi,
      " "
    )
    .replace(/\b(?:will not|won't)\s+(?:be\s+out of|run out of)\s+(?:food|insulin|medicine|medication)\b/gi, " ")
    .replace(/\b(?:am|is|are)\s+not\s+going to\s+(?:be\s+out of|run out of)\s+(?:food|insulin|medicine|medication)\b/gi, " ")
    .replace(/\b(?:not|never|no longer)\s+(?:(?:actually|currently)\s+)?(?:out of (?:food|insulin|medicine|medication)|hungry)\b/gi, " ")
    .replace(/\b(?:isn't|aren't|wasn't|weren't)\s+(?:out of (?:insulin|medicine|medication)|hungry)\b/gi, " ")
    .replace(/\b(?:did not|didn't|never)\s+(?:run out of (?:food|insulin|medicine|medication)|go hungry)\b/gi, " ")
    .replace(/\b(?:no|nunca|ya no)\s+(?:tiene|tienen)\s+hambre\b/gi, " ")
    .replace(/\bno\s+(?:me qued[eé]|nos quedamos)\s+sin\s+comida\b/gi, " ")
    .replace(/\bno\s+(?:me|nos)\s+(?:falta|qued[eé]\s+sin)\s+(?:insulina|medicina|medicamento)\b/gi, " ")
    .replace(/\bno\s+se\s+(?:acab[oó]|agot[oó])\s+(?:la\s+)?(?:insulina|medicina|medicamento)\b/gi, " ");
}

// The safety banner needs to distinguish a local-resource need from interrupted
// access to medicine. Both block ordinary interpretation and network use, but
// the right first action is different: 211 for basic needs, a prescriber or
// pharmacist for medicine access.
export function classifySocialEmergency(input: string): SocialEmergencyKind | null {
  const scannable = stripSocialNegations(input);
  const medicationAccess = MEDICATION_ACCESS_EMERGENCY_PATTERNS.some((pattern) => pattern.test(scannable));
  const basicNeeds = BASIC_NEEDS_EMERGENCY_PATTERNS.some((pattern) => pattern.test(scannable));
  if (medicationAccess && basicNeeds) {
    return "basic_needs_and_medication_access";
  }
  if (medicationAccess) {
    return "medication_access";
  }
  if (basicNeeds) {
    return "basic_needs";
  }
  return null;
}

// FR-4: an acute material emergency (no food today, hungry children, out of
// insulin) escalates the same as a medical urgency.
export function screenSocialEmergency(input: string): boolean {
  return classifySocialEmergency(input) !== null;
}

export type ZCodeSuggestion = {
  code: string;
  description: string;
  status: "needs_review";
};

const Z_CODE_BY_DOMAIN: Record<SocialDomain, { code: string; description: string }> = {
  food: { code: "Z59.41", description: "Food insecurity" },
  housing: { code: "Z59.1", description: "Inadequate housing" },
  utilities: { code: "Z59.8", description: "Other problems related to housing and economic circumstances" },
  transportation: { code: "Z59.82", description: "Transportation insecurity" },
  financial: { code: "Z59.86", description: "Financial insecurity" }
};

// Deterministic Z-code suggestions, always needs_review, never auto-applied.
export function suggestZCodes(flags: SocialDomain[]): ZCodeSuggestion[] {
  return flags.map((domain) => ({ ...Z_CODE_BY_DOMAIN[domain], status: "needs_review" as const }));
}
