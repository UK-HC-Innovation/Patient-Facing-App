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

export type FamilyNarrativeSupport = "supported" | "excluded_only" | "absent";
export type FamilyNarrativeTarget =
  | "early_intervention"
  | "therapies"
  | "school_iep";

export type FamilyNarrativeAnalysis = {
  facts: FamilyInterviewFact[];
  targetFacts: Record<"therapies" | "school_iep", FamilyInterviewFact[]>;
  support: Record<FamilyNarrativeTarget, FamilyNarrativeSupport>;
};

export type FamilyNarrativeContext = {
  rawText: string;
  profile: FamilyProfile;
  language: Language;
  now: Date;
};

type NarrativeActor = "child" | "caregiver" | "clinician" | "unclear";
type ServiceStatus =
  | "current"
  | "historical"
  | "resolved"
  | "recommended"
  | "requested"
  | "replacement"
  | "unavailable"
  | "inaccessible"
  | "lost"
  | "insufficient"
  | "none";
type EvidenceRole =
  | "regression"
  | "functional_burden"
  | "pending_evaluation"
  | "observation"
  | "other_concern"
  | "professional_recommendation"
  | "caregiver_accessibility"
  | "positive_change";
type NarrativeConcernTarget =
  | "regression"
  | "speech"
  | "motor"
  | "therapy_service"
  | "school_learning"
  | "evaluation"
  | "behavior";
type NarrativeSegment = {
  text: string;
  start: number;
  end: number;
  sentenceText: string;
  sentenceStart: number;
  order: number;
};
type EvidenceCandidate = {
  target: NarrativeConcernTarget;
  actor: NarrativeActor;
  serviceStatus: ServiceStatus;
  earlyInterventionEligible: boolean;
  role: EvidenceRole;
  disposition: "supported" | "excluded";
  segment: NarrativeSegment;
  factKeys: {
    labelKey: FamilyStringKey;
    valueKey: FamilyStringKey;
  } | null;
};
type FamilyNarrativeComputation = FamilyNarrativeAnalysis & {
  supportByConcern: Record<
    NarrativeConcernTarget,
    FamilyNarrativeSupport
  >;
  factsByConcern: Record<NarrativeConcernTarget, FamilyInterviewFact[]>;
};

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

type NarrativeSentence = {
  text: string;
  start: number;
  end: number;
};

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+|\n+/gu;
const CLAUSE_BOUNDARY = /,\s+(?:but|and|pero|y)\s+/giu;

function trimNarrativeSpan(
  source: string,
  start: number,
  end: number
): NarrativeSentence | null {
  const raw = source.slice(start, end);
  const leading = raw.match(/^\s*/u)?.[0].length ?? 0;
  const trailing = raw.match(/\s*$/u)?.[0].length ?? 0;
  const trimmedStart = start + leading;
  const trimmedEnd = end - trailing;
  return trimmedStart < trimmedEnd
    ? {
        text: source.slice(trimmedStart, trimmedEnd),
        start: trimmedStart,
        end: trimmedEnd
      }
    : null;
}

function sentenceSpans(text: string): NarrativeSentence[] {
  const sentences: NarrativeSentence[] = [];
  let cursor = 0;
  for (const boundary of text.matchAll(SENTENCE_BOUNDARY)) {
    const boundaryStart = boundary.index ?? cursor;
    const span = trimNarrativeSpan(text, cursor, boundaryStart);
    if (span) sentences.push(span);
    cursor = boundaryStart + boundary[0].length;
  }
  const finalSpan = trimNarrativeSpan(text, cursor, text.length);
  if (finalSpan) sentences.push(finalSpan);
  return sentences;
}

function narrativeSegments(text: string): NarrativeSegment[] {
  let order = 0;
  return sentenceSpans(text).flatMap((sentence) => {
    const segments: NarrativeSegment[] = [];
    let cursor = 0;
    for (const boundary of sentence.text.matchAll(CLAUSE_BOUNDARY)) {
      const boundaryStart = boundary.index ?? cursor;
      const span = trimNarrativeSpan(
        text,
        sentence.start + cursor,
        sentence.start + boundaryStart
      );
      if (span) {
        segments.push({
          ...span,
          sentenceText: sentence.text,
          sentenceStart: sentence.start,
          order
        });
        order += 1;
      }
      cursor = boundaryStart + boundary[0].length;
    }
    const finalSpan = trimNarrativeSpan(
      text,
      sentence.start + cursor,
      sentence.end
    );
    if (finalSpan) {
      segments.push({
        ...finalSpan,
        sentenceText: sentence.text,
        sentenceStart: sentence.start,
        order
      });
      order += 1;
    }
    return segments;
  });
}

/** Splits into sentences whose text stays a literal substring of the original. */
function splitSentences(text: string): string[] {
  return sentenceSpans(text).map(({ text: sentence }) => sentence);
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

const FUNCTIONAL_BURDEN_CUES: Record<Language, RegExp> = {
  en: /(?=.*\b(?:read\w*|homework|schoolwork)\b)(?=.*\b(?:takes?\s+hours?|hours?\s+(?:every|each)\s+(?:day|night)|all\s+(?:day|night))\b)/iu,
  es: /(?=.*\b(?:lectura|leer|tarea|trabajo\s+escolar)\b)(?=.*\b(?:toma(?:n)?\s+horas?|horas?\s+cada\s+(?:d[ií]a|noche)|todo\s+el\s+(?:d[ií]a|tiempo))\b)/iu
};

const PENDING_EVALUATION_CUES: Record<Language, RegExp> = {
  en: /\b(?:wait(?:ing)?\s+for|pending|has\s+not(?:\s+yet)?\s+(?:happened|been\s+completed)|not\s+(?:yet\s+)?completed)\b[^.!?]{0,60}\b(?:evaluation|assessment|testing)\b|\b(?:evaluation|assessment|testing)\b[^.!?]{0,60}\b(?:pending|has\s+not(?:\s+yet)?\s+(?:happened|been\s+completed)|(?:is\s+)?not\s+(?:yet\s+)?completed)\b/iu,
  es: /\b(?:esperando|esperamos|pendiente|no\s+se\s+ha\s+hecho|no\s+se\s+ha\s+completado)\b[^.!?]{0,60}\b(?:evaluaci[oó]n|valoraci[oó]n|pruebas?)\b|\b(?:evaluaci[oó]n|valoraci[oó]n|pruebas?)\b[^.!?]{0,60}\b(?:pendiente|(?:(?:todav[ií]a|a[uú]n)\s+)?no\s+se\s+ha\s+completado)\b/iu
};

const LIMITED_LANGUAGE_CONTEXT: Record<Language, RegExp> = {
  en: /\b(?:not\s+much\s+else|only\s+(?:says?\s+)?(?:a\s+)?few\s+words?|few\s+words?|cannot\s+tell\s+us|can'?t\s+tell\s+us)\b/iu,
  es: /\b(?:nada\s+m[aá]s|solo\s+dice\s+unas?\s+pocas?\s+palabras?|pocas?\s+palabras?|no\s+puede\s+decir(?:nos|\s+lo))\b/iu
};

const ELLIPTICAL_LIMITED_LANGUAGE_CONTEXT: Record<Language, RegExp> = {
  en: /^(?:not\s+much\s+else|(?:only\s+)?(?:a\s+)?few\s+words?)[.!?]?$/iu,
  es: /^(?:nada\s+m[aá]s|(?:solo\s+)?unas?\s+pocas?\s+palabras?)[.!?]?$/iu
};

type DirectConcernDefinition = {
  target: Exclude<
    NarrativeConcernTarget,
    "regression" | "therapy_service" | "evaluation"
  >;
  labelKey: FamilyStringKey;
  valueKey: FamilyStringKey;
  earlyInterventionEligible: boolean;
};

const DIRECT_CONCERN_DEFINITIONS: readonly DirectConcernDefinition[] = [
  {
    target: "school_learning",
    labelKey: "factConcernSchoolLabel",
    valueKey: "factConcernSchoolValue",
    earlyInterventionEligible: false
  },
  {
    target: "speech",
    labelKey: "factConcernSpeechLabel",
    valueKey: "factConcernSpeechValue",
    earlyInterventionEligible: true
  },
  {
    target: "behavior",
    labelKey: "factConcernBehaviorLabel",
    valueKey: "factConcernBehaviorValue",
    earlyInterventionEligible: false
  },
  {
    target: "motor",
    labelKey: "factConcernMotorLabel",
    valueKey: "factConcernMotorValue",
    earlyInterventionEligible: true
  }
];

const CHILD_SAY_CUES: Record<Language, RegExp> = {
  en: /\b(?:say|says|saying)\b/iu,
  es: /\b(?:dice|diciendo)\b/iu
};

const SPEECH_REGRESSION_TARGET_CUES: Record<Language, RegExp> = {
  en: /(?:stopped\s+(?:saying|talking|speaking|babbling)\b|lost\s+(?:words?|speech|language|the\s+words?|his\s+words?|her\s+words?)\b|used\s+to\s+(?:say|talk|speak|babble)\b[^.]{0,40}?(?:no\s+longer|doesn'?t|does\s+not|don'?t|won'?t|can'?t|stopped|quit)|no\s+longer\s+(?:says?|talks?|speaks?|babbles?)\b|forgot\s+how\s+to\s+(?:say|talk|speak)\b)/iu,
  es: /(?:dej(?:[oó]|[eé])\s+de\s+(?:hablar|decir)\b|perd(?:i[oó]|[ií])\s+(?:palabras|habla|lenguaje|las\s+palabras)\b|antes\s+(?:hablaba|dec[ií]a)\b[^.]{0,40}?ya\s+no\b|ya\s+no\s+(?:habla|dice)\b|olvid(?:[oó]|[eé])\s+c[oó]mo\s+(?:hablar|decir)\b)/iu
};

const MOTOR_REGRESSION_TARGET_CUES: Record<Language, RegExp> = {
  en: /(?:stopped\s+(?:walking|crawling)\b|used\s+to\s+(?:walk|crawl)\b[^.]{0,40}?(?:no\s+longer|doesn'?t|does\s+not|don'?t|won'?t|can'?t|stopped|quit)|no\s+longer\s+(?:walks?|crawls?)\b|forgot\s+how\s+to\s+(?:walk|crawl|climb\s+(?:the\s+)?stairs?|balance|use\s+(?:his|her|their)\s+grip)\b)/iu,
  es: /(?:dej(?:[oó]|[eé])\s+de\s+(?:caminar|gatear)\b|antes\s+caminaba\b[^.]{0,40}?ya\s+no\b|ya\s+no\s+camina\b|olvid(?:[oó]|[eé])\s+c[oó]mo\s+(?:caminar|gatear|subir\s+(?:las?\s+)?escaleras?|mantener\s+el\s+equilibrio|agarrar)\b)/iu
};

const THERAPY_LANGUAGE: Record<Language, RegExp> = {
  en: /\b(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)\b|\bOT\b/iu,
  es: /\bterapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?\b|\bterapeuta\b/iu
};

const SPEECH_THERAPY_LANGUAGE: Record<Language, RegExp> = {
  en: /\bspeech\s+therap(?:y|ies|ist)\b/iu,
  es: /\bterapia(?:s)?\s+del\s+habla\b/iu
};

const CLINICIAN_STATEMENT_CUES: Record<Language, RegExp> = {
  en: /\b(?:doctor|pediatrician|therapist|clinician|provider)\b[^.!?]{0,60}\b(?:said|says?|told|thinks?|recommended?|suggested?)\b/iu,
  es: /\b(?:doctor|doctora|pediatra|terapeuta|profesional|proveedor)\b[^.!?]{0,60}\b(?:dijo|dice|coment[oó]|piensa|recomend[oó]|sugiri[oó])\b/iu
};

const EVIDENCE_PRIORITY: Record<EvidenceRole, number> = {
  regression: 0,
  functional_burden: 1,
  pending_evaluation: 1,
  observation: 2,
  other_concern: 3,
  professional_recommendation: 4,
  caregiver_accessibility: 5,
  positive_change: 5
};

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

function extractProfileFacts(
  text: string,
  profile: FamilyProfile,
  language: Language
): FamilyInterviewFact[] {
  const facts: FamilyInterviewFact[] = [];
  const grade = text.match(language === "es" ? SPANISH_GRADE : GRADE)?.[0];
  if (grade) {
    facts.push({
      label: tFamily(language, "factGradeLabel"),
      value: grade,
      sourceSnippet: grade
    });
  }

  const diagnosis = text.match(diagnosisStatement(profile, language));
  if (diagnosis?.[0] && diagnosis[1]) {
    facts.push({
      label: tFamily(language, "factReportedDiagnosisLabel"),
      value: diagnosis[1],
      sourceSnippet: diagnosis[0]
    });
  }

  return facts;
}

function concernPattern(
  labelKey: FamilyStringKey,
  language: Language
): RegExp | null {
  return (
    CONCERN_CATEGORIES.find(
      (category) => category.labelKey === labelKey
    )?.patterns[language] ?? null
  );
}

function regressionConcernTarget(
  text: string,
  language: Language
): Extract<NarrativeConcernTarget, "regression" | "speech" | "motor"> {
  if (MOTOR_REGRESSION_TARGET_CUES[language].test(text)) return "motor";
  if (SPEECH_REGRESSION_TARGET_CUES[language].test(text)) return "speech";
  return "regression";
}

function sentenceSegment(
  sentence: NarrativeSentence,
  order: number
): NarrativeSegment {
  return {
    ...sentence,
    sentenceText: sentence.text,
    sentenceStart: sentence.start,
    order
  };
}

function evidenceCandidate(
  segment: NarrativeSegment,
  target: NarrativeConcernTarget,
  actor: NarrativeActor,
  serviceStatus: ServiceStatus,
  role: EvidenceRole,
  disposition: "supported" | "excluded",
  factKeys: EvidenceCandidate["factKeys"],
  earlyInterventionEligible = false
): EvidenceCandidate {
  return {
    target,
    actor,
    serviceStatus,
    role,
    disposition,
    segment,
    factKeys,
    earlyInterventionEligible
  };
}

function candidateFact(
  candidate: EvidenceCandidate,
  language: Language
): FamilyInterviewFact | null {
  if (!candidate.factKeys) return null;
  return {
    label: tFamily(language, candidate.factKeys.labelKey),
    value: tFamily(language, candidate.factKeys.valueKey),
    sourceSnippet: candidate.segment.text
  };
}

type SelectedEvidence = {
  candidate: EvidenceCandidate;
  fact: FamilyInterviewFact;
};

function selectEvidence(
  candidates: readonly EvidenceCandidate[],
  language: Language
): SelectedEvidence[] {
  const seen = new Set<string>();
  return [...candidates]
    .filter(({ disposition }) => disposition === "supported")
    .sort(
      (left, right) =>
        EVIDENCE_PRIORITY[left.role] - EVIDENCE_PRIORITY[right.role] ||
        left.segment.start - right.segment.start
    )
    .flatMap((candidate) => {
      const fact = candidateFact(candidate, language);
      if (!fact) return [];
      const identity = [
        candidate.role,
        fact.label,
        fact.value,
        fact.sourceSnippet
      ]
        .join("\u0000")
        .toLocaleLowerCase();
      if (seen.has(identity)) return [];
      seen.add(identity);
      return [{ candidate, fact }];
    })
    .slice(0, CONCERN_FACT_LIMIT);
}

function buildNarrativeCandidates(
  text: string,
  language: Language
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];
  const sentences = sentenceSpans(text);
  const segments = narrativeSegments(text);
  const serviceSentences = new Set<number>();
  const directTargets = new Set<NarrativeConcernTarget>();

  for (const [index, sentence] of sentences.entries()) {
    const whole = sentenceSegment(sentence, index);
    if (REGRESSION_CUES[language].test(sentence.text)) {
      const target = regressionConcernTarget(sentence.text, language);
      candidates.push(
        evidenceCandidate(
          whole,
          target,
          "unclear",
          "none",
          "regression",
          "supported",
          {
            labelKey: "factRegressionLabel",
            valueKey: "factRegressionValue"
          },
          target !== "regression"
        )
      );
    }
    if (THERAPY_LANGUAGE[language].test(sentence.text)) {
      serviceSentences.add(sentence.start);
      candidates.push(
        evidenceCandidate(
          whole,
          "therapy_service",
          "unclear",
          "none",
          "other_concern",
          "supported",
          null,
          SPEECH_THERAPY_LANGUAGE[language].test(sentence.text) ||
            (concernPattern("factConcernSpeechLabel", language)?.test(
              sentence.text
            ) ??
              false)
        )
      );
    }
  }

  for (const [segmentIndex, segment] of segments.entries()) {
    const burden = FUNCTIONAL_BURDEN_CUES[language].test(segment.text);
    const pending = PENDING_EVALUATION_CUES[language].test(segment.text);
    if (burden) {
      candidates.push(
        evidenceCandidate(
          segment,
          "school_learning",
          "unclear",
          "none",
          "functional_burden",
          "supported",
          {
            labelKey: "factFunctionalBurdenLabel",
            valueKey: "factFunctionalBurdenValue"
          }
        )
      );
    }
    if (pending) {
      candidates.push(
        evidenceCandidate(
          segment,
          "evaluation",
          "unclear",
          "none",
          "pending_evaluation",
          "supported",
          {
            labelKey: "factPendingEvaluationLabel",
            valueKey: "factPendingEvaluationValue"
          }
        )
      );
    }

    const nextSegment = segments[segmentIndex + 1];
    const adjacentLimitedContext =
      nextSegment !== undefined &&
      nextSegment.sentenceStart === segment.sentenceStart &&
      ELLIPTICAL_LIMITED_LANGUAGE_CONTEXT[language].test(
        nextSegment.text
      );
    const limitedSpeech =
      CHILD_SAY_CUES[language].test(segment.text) &&
      (LIMITED_LANGUAGE_CONTEXT[language].test(segment.text) ||
        adjacentLimitedContext);
    if (limitedSpeech) {
      candidates.push(
        evidenceCandidate(
          segment,
          "speech",
          "child",
          "none",
          "observation",
          "supported",
          {
            labelKey: "factConcernSpeechLabel",
            valueKey: "factConcernSpeechValue"
          },
          true
        )
      );
      directTargets.add("speech");
    }

    for (const definition of DIRECT_CONCERN_DEFINITIONS) {
      if (directTargets.has(definition.target)) continue;
      if (
        definition.target === "school_learning" &&
        (burden || pending)
      ) {
        continue;
      }
      if (
        (definition.target === "speech" ||
          definition.target === "motor") &&
        serviceSentences.has(segment.sentenceStart)
      ) {
        continue;
      }
      if (
        definition.target === "speech" &&
        limitedSpeech
      ) {
        continue;
      }
      const pattern = concernPattern(definition.labelKey, language);
      if (!pattern?.test(segment.text)) continue;
      const clinicianStatement =
        CLINICIAN_STATEMENT_CUES[language].test(segment.text);
      candidates.push(
        evidenceCandidate(
          segment,
          definition.target,
          clinicianStatement ? "clinician" : "unclear",
          "none",
          clinicianStatement
            ? "professional_recommendation"
            : "other_concern",
          "supported",
          {
            labelKey: definition.labelKey,
            valueKey: definition.valueKey
          },
          definition.earlyInterventionEligible
        )
      );
      if (!clinicianStatement) {
        directTargets.add(definition.target);
      }
    }
  }
  return candidates;
}

function candidatesFor(
  candidates: readonly EvidenceCandidate[],
  targets: readonly NarrativeConcernTarget[]
): EvidenceCandidate[] {
  const targetSet = new Set<NarrativeConcernTarget>(targets);
  return candidates.filter(({ target }) => targetSet.has(target));
}

function aggregateNarrativeSupport(
  candidates: readonly EvidenceCandidate[]
): FamilyNarrativeSupport {
  if (
    candidates.some(({ disposition }) => disposition === "supported")
  ) {
    return "supported";
  }
  return candidates.length > 0 ? "excluded_only" : "absent";
}

function earlyInterventionSupport(
  candidates: readonly EvidenceCandidate[],
  profile: FamilyProfile,
  now: Date
): FamilyNarrativeSupport {
  const therapySignals = candidatesFor(candidates, [
    "speech",
    "motor",
    "therapy_service"
  ]);
  const actionable = therapySignals.some(
    ({ disposition, earlyInterventionEligible }) =>
      disposition === "supported" && earlyInterventionEligible
  );
  if (actionable && isConservativelyUnderThree(profile, now)) {
    return "supported";
  }
  return therapySignals.length > 0 ? "excluded_only" : "absent";
}

function computeFamilyNarrative(
  text: string,
  profile: FamilyProfile,
  now: Date,
  language: Language
): FamilyNarrativeComputation {
  const candidates = buildNarrativeCandidates(text, language);
  const selected = selectEvidence(candidates, language);
  const supportByConcern: FamilyNarrativeComputation["supportByConcern"] = {
    regression: aggregateNarrativeSupport(
      candidates.filter(({ role }) => role === "regression")
    ),
    speech: aggregateNarrativeSupport(
      candidatesFor(candidates, ["speech"])
    ),
    motor: aggregateNarrativeSupport(
      candidatesFor(candidates, ["motor"])
    ),
    therapy_service: aggregateNarrativeSupport(
      candidatesFor(candidates, ["therapy_service"])
    ),
    school_learning: aggregateNarrativeSupport(
      candidatesFor(candidates, ["school_learning"])
    ),
    evaluation: aggregateNarrativeSupport(
      candidatesFor(candidates, ["evaluation"])
    ),
    behavior: aggregateNarrativeSupport(
      candidatesFor(candidates, ["behavior"])
    )
  };
  const factsByConcern: FamilyNarrativeComputation["factsByConcern"] = {
    regression: [],
    speech: [],
    motor: [],
    therapy_service: [],
    school_learning: [],
    evaluation: [],
    behavior: []
  };
  const targetFacts: FamilyNarrativeAnalysis["targetFacts"] = {
    therapies: [],
    school_iep: []
  };

  for (const { candidate, fact } of selected) {
    factsByConcern[candidate.target].push(fact);
    if (
      candidate.role === "regression" &&
      candidate.target !== "regression"
    ) {
      factsByConcern.regression.push(fact);
    }
    if (
      candidate.target === "speech" ||
      candidate.target === "motor" ||
      candidate.target === "therapy_service"
    ) {
      targetFacts.therapies.push(fact);
    }
    if (
      candidate.target === "school_learning" ||
      candidate.target === "evaluation"
    ) {
      targetFacts.school_iep.push(fact);
    }
  }

  return {
    facts: [
      ...extractProfileFacts(text, profile, language),
      ...selected.map(({ fact }) => fact)
    ],
    targetFacts,
    support: {
      early_intervention: earlyInterventionSupport(
        candidates,
        profile,
        now
      ),
      therapies: aggregateNarrativeSupport(
        candidatesFor(candidates, [
          "speech",
          "motor",
          "therapy_service"
        ])
      ),
      school_iep: aggregateNarrativeSupport(
        candidatesFor(candidates, [
          "school_learning",
          "evaluation"
        ])
      )
    },
    supportByConcern,
    factsByConcern
  };
}

export function analyzeFamilyNarrative(
  text: string,
  profile: FamilyProfile,
  now: Date,
  language: Language
): FamilyNarrativeAnalysis {
  const { facts, targetFacts, support } = computeFamilyNarrative(
    text,
    profile,
    now,
    language
  );
  return { facts, targetFacts, support };
}

export function extractFamilyInterviewMock(
  text: string,
  profile: FamilyProfile,
  now = new Date(),
  language: Language = "en"
): FamilyInterviewResult {
  const matched = new Set<DevNeedDomain>();
  const analysis = analyzeFamilyNarrative(text, profile, now, language);
  for (const domain of [
    "early_intervention",
    "therapies",
    "school_iep"
  ] satisfies FamilyNarrativeTarget[]) {
    if (analysis.support[domain] === "supported") {
      matched.add(domain);
    }
  }
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
    facts: analysis.facts,
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
