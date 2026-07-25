import { z } from "zod";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";
import { stripUnsafeFamilyRationales } from "./family-diagnosis-lint";
import type { DevNeedDomain, FamilyEvidenceStatus, FamilyProfile } from "./types";

export const devNeedDomainSchema = z.enum([
  "early_intervention",
  "therapies",
  "school_iep",
  "waivers_financial",
  "respite",
  "parent_support",
  "sibling_support",
  "transportation",
  "future_planning",
  "diagnosis_education",
  "recreation"
]);

export const familyInterviewInputSchema = z
  .string()
  .max(5000)
  .refine((value) => value.trim().length >= 10, "Interview text must contain at least 10 characters.");

const familyInterviewFactSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
    sourceSnippet: z.string().min(1)
  })
  .strict();

const familyInterviewDomainSchema = z
  .object({
    domain: devNeedDomainSchema,
    rationale: z.string()
  })
  .strict();

const familyFollowUpSchema = z
  .object({
    question: z.string().min(1).max(200),
    options: z.array(z.string().min(1).max(60)).max(4)
  })
  .strict();

export const familyInterviewResultSchema = z
  .object({
    facts: z.array(familyInterviewFactSchema),
    domains: z.array(familyInterviewDomainSchema),
    followUps: z.array(familyFollowUpSchema).max(3)
  })
  .strict();

export type FamilyInterviewFact = z.infer<typeof familyInterviewFactSchema>;
export type FamilyInterviewDomain = z.infer<typeof familyInterviewDomainSchema>;
export type FamilyFollowUp = z.infer<typeof familyFollowUpSchema>;
export type FamilyInterviewResult = z.infer<typeof familyInterviewResultSchema>;

const DOMAIN_ORDER: readonly DevNeedDomain[] = [
  "early_intervention",
  "therapies",
  "school_iep",
  "waivers_financial",
  "respite",
  "parent_support",
  "sibling_support",
  "transportation",
  "future_planning",
  "diagnosis_education",
  "recreation"
];

const DOMAIN_RATIONALE_KEYS: Record<DevNeedDomain, FamilyStringKey> = {
  early_intervention: "rationaleEarlyIntervention",
  therapies: "rationaleTherapies",
  school_iep: "rationaleSchoolIep",
  waivers_financial: "rationaleWaiversFinancial",
  respite: "rationaleRespite",
  parent_support: "rationaleParentSupport",
  sibling_support: "rationaleSiblingSupport",
  transportation: "rationaleTransportation",
  future_planning: "rationaleFuturePlanning",
  diagnosis_education: "rationaleDiagnosisEducation",
  recreation: "rationaleRecreation"
};

type MockFollowUpKeySet = {
  question: FamilyStringKey;
  options: [FamilyStringKey, FamilyStringKey, FamilyStringKey];
};

const MOCK_FOLLOW_UPS: Array<{ domains: DevNeedDomain[]; keys: MockFollowUpKeySet }> = [
  {
    domains: ["school_iep"],
    keys: {
      question: "followUpSchoolIepQuestion",
      options: ["followUpSchoolIepChip1", "followUpSchoolIepChip2", "followUpSchoolIepChip3"]
    }
  },
  {
    domains: ["therapies"],
    keys: {
      question: "followUpTherapiesQuestion",
      options: ["followUpTherapiesChip1", "followUpTherapiesChip2", "followUpTherapiesChip3"]
    }
  },
  {
    domains: ["waivers_financial"],
    keys: {
      question: "followUpWaiversQuestion",
      options: ["followUpWaiversChip1", "followUpWaiversChip2", "followUpWaiversChip3"]
    }
  },
  {
    domains: ["respite", "parent_support"],
    keys: {
      question: "followUpRespiteQuestion",
      options: ["followUpRespiteChip1", "followUpRespiteChip2", "followUpRespiteChip3"]
    }
  }
];

const GENERIC_MOCK_FOLLOW_UPS: MockFollowUpKeySet[] = [
  {
    question: "followUpGenericDayQuestion",
    options: ["followUpGenericDayChip1", "followUpGenericDayChip2", "followUpGenericDayChip3"]
  },
  {
    question: "followUpGenericHelpQuestion",
    options: ["followUpGenericHelpChip1", "followUpGenericHelpChip2", "followUpGenericHelpChip3"]
  }
];

function localizeMockFollowUp(keys: MockFollowUpKeySet, language: Language): FamilyFollowUp {
  return {
    question: tFamily(language, keys.question),
    options: keys.options.map((key) => tFamily(language, key))
  };
}

export function buildMockFollowUps(domains: DevNeedDomain[], language: Language): FamilyFollowUp[] {
  const matched = new Set(domains);
  const keys = domains.length
    ? MOCK_FOLLOW_UPS.filter(({ domains: candidateDomains }) => candidateDomains.some((domain) => matched.has(domain))).map(
        ({ keys: candidateKeys }) => candidateKeys
      )
    : GENERIC_MOCK_FOLLOW_UPS;

  return keys.slice(0, 3).map((candidateKeys) => localizeMockFollowUp(candidateKeys, language));
}

const DIAGNOSIS_TERM =
  "(?:autism|autistic|ADHD|attention\\s+deficit\\s+hyperactivity\\s+disorder|dyslexia|dyslexic|speech(?:\\s+or|\\s*\\/)?\\s*language\\s+disorder|speech\\s+disorder|language\\s+disorder|developmental\\s+delay|intellectual\\s+disability|Down\\s+syndrome)";
const DIAGNOSIS_LIST = `${DIAGNOSIS_TERM}(?:(?:\\s*,\\s*|\\s+and\\s+|\\s*,?\\s+and\\s+)${DIAGNOSIS_TERM})*`;
const SPANISH_DIAGNOSIS_TERM =
  "(?:autismo|autista|TDAH|trastorno\\s+por\\s+d[eé]ficit\\s+de\\s+atenci[oó]n(?:\\s+e\\s+hiperactividad)?|dislexia|disl[eé]xic[oa]|trastorno\\s+(?:del|de)\\s+(?:habla|lenguaje)|retraso\\s+del\\s+desarrollo|discapacidad\\s+intelectual|s[ií]ndrome\\s+de\\s+Down)";
const SPANISH_DIAGNOSIS_LIST = `${SPANISH_DIAGNOSIS_TERM}(?:(?:\\s*,\\s*|\\s+y\\s+|\\s*,?\\s+y\\s+)${SPANISH_DIAGNOSIS_TERM})*`;
// Developmental-concern categories, matched against whatever the caregiver
// actually wrote. Each fact quotes their own sentence — never a canned phrase.
type ConcernCategory = {
  labelKey: FamilyStringKey;
  valueKey: FamilyStringKey;
  patterns: Record<Language, RegExp>;
};

// Skill regression is a "tell the clinic now" signal, not a crisis and not a
// diagnosis. Precision is the property being protected: a false "your child is
// losing skills" is the most expensive sentence this app can say, and it lands
// permanently in the packet a clinician reads.
//
// Every branch is anchored to BOTH a named skill verb and a loss direction, and
// each spells out the verb forms that branch actually takes ("stopped talking",
// "used to talk", "no longer talks"). Two rules earned by real misfires:
//   - never a bare `\w+` verb slot — "used to hate the bath but now he loves it"
//     is a gain, and an open slot cannot tell the difference;
//   - never a self-care verb (use/usar, hace) — "no longer uses diapers" and
//     "ya no usa pañales" are gains, not losses.
// Recall deliberately loses to precision here; the check-in probe backstops the
// phrasings these patterns miss. family-regression.corpus.ts is the contract.
export const REGRESSION_CUES: Record<Language, RegExp> = {
  en: /(?:stopped\s+(?:saying|talking|speaking|walking|pointing|signing|waving|babbling|crawling)\b|lost\s+(?:words?|skills?|the\s+words?|his\s+words?|her\s+words?)|used\s+to\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)\b[^.]{0,40}?(?:no\s+longer|doesn'?t|does\s+not|don'?t|won'?t|can'?t|stopped|quit)|no\s+longer\s+(?:says?|talks?|speaks?|walks?|points?|signs?|waves?|babbles?|crawls?)\b|forgot\s+how\s+to)/i,
  es: /(?:dej[oó]\s+de\s+(?:hablar|decir|caminar|señalar)\b|perdi[oó]\s+(?:palabras|habilidades|las\s+palabras)|antes\s+(?:hablaba|dec[ií]a|caminaba|señalaba|saludaba)\b[^.]{0,40}?ya\s+no\b|ya\s+no\s+(?:habla|dice|camina|señala)\b|olvid[oó]\s+c[oó]mo)/i
};

/** The caregiver's own sentence that reads as loss of an acquired skill. */
export function detectRegressionCue(text: string, language: Language): string | null {
  const sentence = splitSentences(text).find((candidate) => REGRESSION_CUES[language].test(candidate));
  return sentence ? clampSnippet(sentence) : null;
}

const CONCERN_CATEGORIES: readonly ConcernCategory[] = [
  {
    // First on purpose: when a family describes lost skills, that sentence is
    // the one the journal and the visit packet must carry, verbatim.
    labelKey: "factRegressionLabel",
    valueKey: "factRegressionValue",
    patterns: REGRESSION_CUES
  },
  {
    labelKey: "factConcernSchoolLabel",
    valueKey: "factConcernSchoolValue",
    patterns: {
      en: /(?<!\p{L})(?:read|homework|school|class|teacher|writ|spell|math|iep|grade|letter|learn)\p{L}*/iu,
      es: /(?<!\p{L})(?:lee|leer|lectura|tarea|escuela|maestr|clase|escrib|deletre|matem|iep|grado|nota|aprend)\p{L}*/iu
    }
  },
  {
    labelKey: "factConcernSpeechLabel",
    valueKey: "factConcernSpeechValue",
    patterns: {
      en: /(?<!\p{L})(?:talk|speak|speech|word|languag|stutter|nonverbal|babbl|verbal)\p{L}*/iu,
      es: /(?<!\p{L})(?:habla|hablar|palabra|lenguaje|tartamud|balbuce|verbal)\p{L}*/iu
    }
  },
  {
    labelKey: "factConcernBehaviorLabel",
    valueKey: "factConcernBehaviorValue",
    patterns: {
      en: /(?<!\p{L})(?:behav|melt|tantrum|focus|attention|hyper|sleep|eating|routine|aggress|anxious|anxiety|scream|cry|bite|biting|hitting)\p{L}*/iu,
      es: /(?<!\p{L})(?:comport|conduct|berrinche|rabieta|atenci|concentr|hiperactiv|duerme|dormir|comer|rutina|ansi|llora|grita|pega|muerde)\p{L}*/iu
    }
  },
  {
    labelKey: "factConcernMotorLabel",
    valueKey: "factConcernMotorValue",
    patterns: {
      en: /(?<!\p{L})(?:walk|crawl|balance|coordinat|motor|clums|stairs|grip)\p{L}*/iu,
      es: /(?<!\p{L})(?:camina|caminar|gatea|equilibrio|coordinaci|motor|torpe|escalera|agarr)\p{L}*/iu
    }
  }
];

const CONCERN_FACT_LIMIT = 2;
const CONCERN_SNIPPET_MAX = 160;

/** Splits into sentences whose text stays a literal substring of the original. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Shortens at a word boundary so the snippet remains verbatim caregiver text. */
function clampSnippet(sentence: string): string {
  if (sentence.length <= CONCERN_SNIPPET_MAX) return sentence;
  const cut = sentence.slice(0, CONCERN_SNIPPET_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

const GRADE = /\b(?:kindergarten|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d{1,2}(?:st|nd|rd|th))\s+grade|grade\s+(?:[1-9]|1[0-2]))\b/i;
const SPANISH_GRADE = /\b(?:(?:primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo|und[eé]cimo|duod[eé]cimo|\d{1,2}(?:\.?º|\.?ª)?)\s+grado|grado\s+(?:[1-9]|1[0-2]))\b/iu;

export function parseFamilyInterviewPayload(payload: unknown): FamilyInterviewResult | null {
  const parsed = familyInterviewResultSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function isConservativelyUnderThree(profile: FamilyProfile, now: Date): boolean {
  const calendarAge = now.getUTCFullYear() - profile.birthYear;
  if (profile.birthMonth === undefined) {
    return calendarAge >= 0 && calendarAge <= 3;
  }
  const months = calendarAge * 12 + (now.getUTCMonth() + 1 - profile.birthMonth);
  return months >= 0 && months < 36;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function diagnosisStatement(profile: FamilyProfile, language: Language): RegExp {
  if (language === "es") {
    const subjects = [
      "mi\\s+hij[oa]",
      "nuestro\\s+hij[oa]",
      "el\\s+niño",
      "la\\s+niña"
    ];
    const childFirstName = profile.childFirstName?.trim();
    if (childFirstName) {
      subjects.push(escapeRegExp(childFirstName));
    }
    const subject = `(?:${subjects.join("|")})`;
    return new RegExp(
      `(?<![\\p{L}\\p{N}_-])(?:a\\s+${subject}\\s+le\\s+diagnosticaron|${subject}\\s+(?:fue|ha\\s+sido)\\s+diagnosticad[oa]\\s+con)\\s+(${SPANISH_DIAGNOSIS_LIST})`,
      "iu"
    );
  }

  const subjects = [
    "he",
    "she",
    "they",
    "my\\s+child",
    "our\\s+child",
    "my\\s+son",
    "our\\s+son",
    "my\\s+daughter",
    "our\\s+daughter",
    "the\\s+child"
  ];
  const childFirstName = profile.childFirstName?.trim();
  if (childFirstName) {
    subjects.push(escapeRegExp(childFirstName));
  }
  return new RegExp(
    `(?<![\\p{L}\\p{N}_-])(?:${subjects.join("|")})(?![\\p{L}\\p{N}_-])\\s+(?:(?:was|were|is|has been|have been)\\s+(?:just\\s+)?diagnosed\\s+with|has\\s+(?:a\\s+)?diagnosis\\s+of)\\s+(${DIAGNOSIS_LIST})`,
    "iu"
  );
}

function extractExplicitFacts(text: string, profile: FamilyProfile, language: Language): FamilyInterviewFact[] {
  const facts: FamilyInterviewFact[] = [];
  const grade = text.match(language === "es" ? SPANISH_GRADE : GRADE)?.[0];
  if (grade) {
    facts.push({ label: tFamily(language, "factGradeLabel"), value: grade, sourceSnippet: grade });
  }

  const diagnosis = text.match(diagnosisStatement(profile, language));
  if (diagnosis?.[0] && diagnosis[1]) {
    facts.push({
      label: tFamily(language, "factReportedDiagnosisLabel"),
      value: diagnosis[1],
      sourceSnippet: diagnosis[0]
    });
  }

  const sentences = splitSentences(text);
  let concernsAdded = 0;
  for (const { labelKey, valueKey, patterns } of CONCERN_CATEGORIES) {
    if (concernsAdded === CONCERN_FACT_LIMIT) break;
    const sentence = sentences.find((candidate) => patterns[language].test(candidate));
    if (!sentence) continue;
    facts.push({
      label: tFamily(language, labelKey),
      value: tFamily(language, valueKey),
      sourceSnippet: clampSnippet(sentence)
    });
    concernsAdded += 1;
  }
  return facts;
}

export function extractFamilyInterviewMock(
  text: string,
  profile: FamilyProfile,
  now = new Date(),
  language: Language = "en"
): FamilyInterviewResult {
  const matched = new Set<DevNeedDomain>();
  const categoryMatches = (labelKey: FamilyStringKey): boolean => {
    const category = CONCERN_CATEGORIES.find((candidate) => candidate.labelKey === labelKey);
    return category ? category.patterns[language].test(text) : false;
  };
  const speechConcern = categoryMatches("factConcernSpeechLabel");
  const motorConcern = categoryMatches("factConcernMotorLabel");
  const therapyConcern =
    language === "es" ? /\bterapias?\b/iu.test(text) : /\btherap(?:y|ies)\b/i.test(text);
  if (speechConcern || therapyConcern || motorConcern) {
    matched.add("therapies");
    if ((speechConcern || motorConcern) && isConservativelyUnderThree(profile, now)) {
      matched.add("early_intervention");
    }
  }
  if (categoryMatches("factConcernSchoolLabel")) matched.add("school_iep");
  const waiverConcern =
    language === "es"
      ? /\b(?:exenciones?|dinero|econ[oó]mic[oa]s?|pagar)\b/iu.test(text)
      : /\b(?:waivers?|money|afford)\b/i.test(text);
  if (waiverConcern) matched.add("waivers_financial");
  const breakConcern =
    language === "es"
      ? /\b(?:descanso|agotad[oa]s?|abrumad[oa]s?)\b/iu.test(text)
      : /\b(?:break|exhausted|overwhelmed)\b/i.test(text);
  if (breakConcern) {
    matched.add("respite");
    matched.add("parent_support");
  }
  const siblingConcern =
    language === "es"
      ? /\bherman[oa]s?\b/iu.test(text)
      : /\b(?:sibling|siblings|brother|sister)\b/i.test(text);
  if (siblingConcern) matched.add("sibling_support");
  const transportationConcern =
    language === "es"
      ? /\b(?:transporte|transportaci[oó]n|traslado)\b/iu.test(text)
      : /\b(?:ride|rides|transport|transportation)\b/i.test(text);
  if (transportationConcern) matched.add("transportation");
  const futureConcern =
    language === "es"
      ? /\b(?:transici[oó]n\s+a\s+la\s+adultez|tutela|ABLE)\b/iu.test(text)
      : /\b(?:adult[ -]?transition|guardianship|ABLE)\b/i.test(text);
  if (futureConcern) matched.add("future_planning");
  const recreationConcern =
    language === "es"
      ? /\b(?:clubes?|deportes?|caballos?|recreaci[oó]n)\b/iu.test(text)
      : /\b(?:clubs?|sports?|horses?|recreation)\b/i.test(text);
  if (recreationConcern) matched.add("recreation");
  const unsureConcern =
    language === "es"
      ? /\bno\s+s[eé][^.!?]{0,50}\bempezar\b|\bno\s+tengo\s+idea\b[^.!?]{0,50}\bempezar\b/iu.test(text)
      : /\b(?:don't|do not) know\b|\bno idea (?:where|how)\b|\bunsure where to start\b/i.test(text);
  // A caregiver at the end of their rope names no "need" the other rules can
  // see. Without this they got an empty resource list at the worst moment.
  const collapseConcern =
    language === "es"
      ? /\bya\s+no\s+puedo\s+(?:hacer\s+esto|m[aá]s)\b|\bno\s+aguanto\s+m[aá]s\b|\bnada\s+(?:de\s+lo\s+)?que\s+intento\s+funciona\b/iu.test(text)
      : /\bcan'?t\s+do\s+this\s+anymore\b|\bnothing\s+(?:i\s+try|else)\s+works\b|\bat\s+the\s+end\s+of\s+my\s+rope\b/i.test(text);
  if (unsureConcern || collapseConcern) {
    matched.add("parent_support");
  }

  const domains = DOMAIN_ORDER.filter((domain) => matched.has(domain)).map((domain) => ({
    domain,
    rationale: tFamily(language, DOMAIN_RATIONALE_KEYS[domain])
  }));
  const sanitizedDomains = stripUnsafeFamilyRationales(domains, profile.childFirstName).map(({ domain, rationale }) => ({
    domain,
    rationale: rationale ?? ""
  }));

  return {
    facts: extractExplicitFacts(text, profile, language),
    domains: sanitizedDomains,
    followUps: buildMockFollowUps(
      sanitizedDomains.map(({ domain }) => domain),
      language
    )
  };
}

export function familyFactStatus(sourceSnippet: string, rawText: string): FamilyEvidenceStatus {
  return sourceSnippet.length > 0 && rawText.includes(sourceSnippet) ? "patient_reported" : "inferred";
}
