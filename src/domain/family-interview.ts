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
      es: /(?<!\p{L})(?:lee|leer|lectura|tarea|escuela|escolar|maestr|clase|escrib|deletre|matem|iep|grado|nota|aprend)\p{L}*/iu
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

const CHILD_SAY_CUES: Record<Language, RegExp> = {
  en: /\b(?:say|says|saying)\b/iu,
  es: /\b(?:dice|diciendo)\b/iu
};

const SPEECH_REGRESSION_TARGET_CUES: Record<Language, RegExp> = {
  en: /(?:stopped\s+(?:saying|talking|speaking|babbling)\b|lost\s+(?:words?|speech|language|the\s+words?|his\s+words?|her\s+words?)\b|used\s+to\s+(?:say|talk|speak|babble)\b[^.]{0,40}?(?:no\s+longer|doesn'?t|does\s+not|don'?t|won'?t|can'?t|stopped|quit)|no\s+longer\s+(?:says?|talks?|speaks?|babbles?)\b|forgot\s+how\s+to\s+(?:say|talk|speak)\b)/iu,
  es: /(?:dej(?:[oó]|[eé])\s+de\s+(?:hablar|decir)\b|perd(?:i[oó]|[ií])\s+(?:palabras|habla|lenguaje|las\s+palabras)\b|antes\s+(?:hablaba|dec[ií]a)\b[^.]{0,40}?ya\s+no\b|ya\s+no\s+(?:habla|hablo|dice|digo)\b|olvid(?:[oó]|[eé])\s+c[oó]mo\s+(?:hablar|decir)\b)/iu
};

const MOTOR_REGRESSION_TARGET_CUES: Record<Language, RegExp> = {
  en: /(?:stopped\s+(?:walking|crawling)\b|used\s+to\s+(?:walk|crawl)\b[^.]{0,40}?(?:no\s+longer|doesn'?t|does\s+not|don'?t|won'?t|can'?t|stopped|quit)|no\s+longer\s+(?:walks?|crawls?)\b|forgot\s+how\s+to\s+(?:walk|crawl|climb\s+(?:the\s+)?stairs?|balance|use\s+(?:his|her|their)\s+grip)\b)/iu,
  es: /(?:dej(?:[oó]|[eé])\s+de\s+(?:caminar|gatear)\b|antes\s+caminaba\b[^.]{0,40}?ya\s+no\b|ya\s+no\s+camina\b|olvid(?:[oó]|[eé])\s+c[oó]mo\s+(?:caminar|gatear|subir\s+(?:las?\s+)?escaleras?|mantener\s+el\s+equilibrio|agarrar)\b)/iu
};

const SPANNING_REGRESSION_LEAD_CUES: Record<Language, RegExp> = {
  en: /\bused\s+to\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)\b/iu,
  es: /\bantes\s+(?:hablaba|dec[ií]a|caminaba|señalaba|saludaba)\b/iu
};

type ServiceRule = {
  status: Exclude<ServiceStatus, "none">;
  disposition: "supported" | "excluded";
  pattern: RegExp;
};

type ServiceModality = "speech" | "motor" | "generic";

type ClassifiedServiceSignal = {
  segment: NarrativeSegment;
  serviceStatus: Exclude<ServiceStatus, "none">;
  disposition: "supported" | "excluded";
  modalities: ServiceModality[];
  caregiverOwned: boolean;
};

const SERVICE_LANGUAGE: Record<Language, RegExp> = {
  en: /\b(?:speech|occupational|physical|behavioral)?\s*therap(?:y|ies|ist)|\bOT\b/iu,
  es: /\bterapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|\bterapeuta\b/iu
};

const SERVICE_SPEECH_DISCIPLINE: Record<Language, RegExp> = {
  en: /\bspeech\b/iu,
  es: /\b(?:habla|lenguaje)\b/iu
};

const SERVICE_MOTOR_DISCIPLINE: Record<Language, RegExp> = {
  en: /\b(?:occupational|physical|OT)\b/iu,
  es: /\b(?:ocupacional|f[ií]sica)\b/iu
};

const SERVICE_ADMIN_PHRASES: Record<Language, RegExp> = {
  en: /\b(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)\s+(?:appointments?|forms?|paperwork)\b/giu,
  es: /(?<![\p{L}\p{N}_])(?:(?:formularios?|papeleo|citas?)\s+(?:de|para)\s+(?:la\s+)?(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)|(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\s+(?:formularios?|papeleo|citas?))(?![\p{L}\p{N}_])/giu
};

const CHILD_REFERENT_CUES: Record<Language, RegExp> = {
  en: /\b(?:he|she|they|him|them|his|her|their|my\s+child|my\s+son|my\s+daughter|our\s+child|our\s+son|our\s+daughter)\b/iu,
  es: /(?<![\p{L}\p{N}_])(?:él|ella|su|mi\s+hij[oa]|nuestro\s+hij[oa])(?![\p{L}\p{N}_])/iu
};

const SPANNING_TERMINAL_SUBJECT_CUES: Record<
  Language,
  { caregiver: RegExp; child: RegExp }
> = {
  en: {
    caregiver: /^(?:(?:now|then)\s+)?(?:I|we)\b/iu,
    child: /^(?:(?:now|then)\s+)?(?:he|she|they|(?:my|our)\s+(?:child|son|daughter))\b/iu
  },
  es: {
    caregiver: /^(?:(?:ahora|luego)\s+)?(?:yo|nosotr[oa]s)\b/iu,
    child: /^(?:(?:ahora|luego)\s+)?(?:él|ella|ellos|ellas|mi\s+hij[oa]|nuestr[oa]\s+hij[oa])\b/iu
  }
};

function spanningTerminalActor(
  segment: NarrativeSegment,
  profile: FamilyProfile,
  language: Language
): Extract<NarrativeActor, "child" | "caregiver"> | null {
  const cues = SPANNING_TERMINAL_SUBJECT_CUES[language];
  if (cues.caregiver.test(segment.text)) return "caregiver";
  if (cues.child.test(segment.text)) return "child";
  const childName = profile.childFirstName?.trim();
  const discoursePrefix =
    language === "es"
      ? "(?:(?:ahora|luego)\\s+)?"
      : "(?:(?:now|then)\\s+)?";
  return childName &&
    new RegExp(
      `^${discoursePrefix}${escapeRegExp(childName)}(?![\\p{L}\\p{N}_-])`,
      "iu"
    ).test(segment.text)
    ? "child"
    : null;
}

const SERVICE_CHILD_BENEFICIARY_CUES: Record<Language, RegExp> = {
  en: /\b(?:(?:his|her|their|(?:my|our)\s+(?:child|son|daughter)(?:['’]s)?)\s+(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)|(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)\s+for\s+(?:him|her|them|(?:my|our)\s+(?:child|son|daughter)))\b/iu,
  es: /(?<![\p{L}\p{N}_])(?:su\s+(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)|(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\s+(?:de|para)\s+(?:él|ella|mi\s+hij[oa]|nuestro\s+hij[oa]))(?![\p{L}\p{N}_])/iu
};

const CAREGIVER_SELF_REGRESSION_CUES: Record<Language, RegExp> = {
  en: /\b(?:I\s+(?:(?:stopped|quit)\s+(?:saying|talking|speaking|walking|pointing|signing|waving|babbling|crawling)\b|lost\s+(?:words?|skills?|speech|language|the\s+words?)\b|used\s+to\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)\b[^.]{0,40}?(?:no\s+longer|doesn'?t|does\s+not|don'?t|won'?t|can'?t|stopped|quit)|no\s+longer\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)\b|forgot\s+how\s+to\b)|I\s+(?:had|have)\s+(?:a\s+)?stroke(?:\s+(?:recently|last\s+(?:week|month|year)))?\s*,?\s+and\s+(?:then\s+)?(?:(?:stopped|quit)\s+(?:saying|talking|speaking|walking|pointing|signing|waving|babbling|crawling)\b|lost\s+(?:words?|skills?|speech|language|the\s+words?)\b|no\s+longer\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)\b|forgot\s+how\s+to\b))/iu,
  es: /(?<![\p{L}\p{N}_])(?:(?:yo\s+)?(?:dej[eé]\s+de\s+(?:hablar|decir|caminar|señalar)\b|perd[ií]\s+(?:palabras|habilidades|las\s+palabras)\b|ya\s+no\s+(?:hablo|digo|camino|señalo)\b|olvid[eé]\s+c[oó]mo\b)|yo\s+antes\s+(?:hablaba|dec[ií]a|caminaba|señalaba|saludaba)\b[^.]{0,40}?ya\s+no\b|(?:yo\s+)?tuve\s+(?:un\s+)?(?:derrame(?:\s+cerebral)?|ictus)(?:\s+(?:recientemente|el\s+(?:mes|año)\s+pasado))?\s*,?\s+y\s+(?:luego\s+)?(?:dej[eé]\s+de\s+(?:hablar|decir|caminar|señalar)\b|perd[ií]\s+(?:palabras|habilidades|las\s+palabras)\b|ya\s+no\s+(?:hablo|digo|camino|señalo)\b|olvid[eé]\s+c[oó]mo\b))(?![\p{L}\p{N}_])/iu
};

const CAREGIVER_SELF_PREDICATE_CUES: Record<Language, RegExp> = {
  en: /\b(?:I\s+(?:(?:had|have)\s+(?:a\s+)?stroke|(?:have|am\s+having)\s+(?:trouble|difficulty)\s+(?:speaking|talking|walking|reading|writing)|(?:cannot|can'?t)\s+(?:speak|talk|walk|read|write)|struggle\s+(?:to\s+)?(?:speak|talk|walk|read|write)|am\s+struggling\s+(?:to\s+)?(?:speak|talk|walk|read|write)|barely\s+(?:talk|speak|walk|read|write)|am\s+(?:barely|not)\s+(?:talking|speaking|walking|reading|writing)|am\s+waiting\s+for\s+my\s+(?:own\s+)?evaluation)|(?:speaking|talking|walking|reading|writing)\b[^.!?]{0,50}\b(?:is|are)\s+hard\s+for\s+me|hard\s+for\s+me\s+to\s+(?:speak|talk|walk|read|write)|my\s+own\s+(?:condition|evaluation))\b/iu,
  es: /(?<![\p{L}\p{N}_])(?:(?:yo\s+)?tuve\s+(?:un\s+)?(?:derrame(?:\s+cerebral)?|ictus)|me\s+cuesta\s+(?:hablar|caminar|leer|escribir)|tengo\s+dificultad\s+para\s+(?:hablar|caminar|leer|escribir)|(?:yo\s+)?no\s+puedo\s+(?:hablar|caminar|leer|escribir)|(?:yo\s+)?(?:casi\s+no|no)\s+(?:hablo|camino|leo|escribo)|(?:yo\s+)?estoy\s+(?:luchando|batallando)\s+(?:para\s+)?(?:hablar|caminar|leer|escribir)|(?:hablar|caminar|leer|escribir)[^.!?]{0,50}(?:es|son)\s+dif[ií]cil(?:es)?\s+para\s+m[ií]|(?:estoy\s+)?esperando\s+mi\s+propi[oa]\s+(?:evaluaci[oó]n|valoraci[oó]n)|mi\s+propi[oa]\s+(?:condici[oó]n|evaluaci[oó]n|valoraci[oó]n))(?![\p{L}\p{N}_])/iu
};

function caregiverOwnsClinicalPredicate(
  text: string,
  language: Language
): boolean {
  return (
    CAREGIVER_SELF_REGRESSION_CUES[language].test(text) ||
    CAREGIVER_SELF_PREDICATE_CUES[language].test(text)
  );
}

function hasNarrativeRegressionCue(
  text: string,
  language: Language
): boolean {
  return (
    REGRESSION_CUES[language].test(text) ||
    CAREGIVER_SELF_REGRESSION_CUES[language].test(text)
  );
}

const CAREGIVER_EXPLICIT_SERVICE_TARGET_CUES: Record<Language, RegExp> = {
  en: /\b(?:(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)\s+for\s+(?:me|myself)|my\s+own\s+(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT))\b/iu,
  es: /(?<![\p{L}\p{N}_])(?:(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\s+para\s+mí|mi\s+propi[oa]\s+(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta))(?![\p{L}\p{N}_])/iu
};

const CAREGIVER_SELF_SERVICE_CUES: Record<Language, RegExp> = {
  en: /\b(?:(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)\s+for\s+(?:me|myself)|my\s+own\s+(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)|I\s+(?:(?:do\s+not|don'?t)\s+need|no\s+longer\s+needs?)\s+(?:it|(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT))|I\s+(?:(?:already|currently)\s+)?(?:receive|get|go\s+to|see|am\s+in|had|completed|finished)\s+(?:(?:a|my)\s+)?(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT))\b/iu,
  es: /(?<![\p{L}\p{N}_])(?:(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\s+para\s+mí|mi\s+propi[oa]\s+(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)|(?:yo\s+)?ya\s+no\s+(?:la|lo)?\s*necesito|(?:yo\s+)?(?:(?:actualmente|ya)\s+)?(?:recibo|voy\s+a|veo|estoy\s+en|tuve|termin[eé]|complet[eé])\s+(?:(?:a\s+)?(?:un[oa]|mi)\s+|a\s+)?(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta))(?![\p{L}\p{N}_])/iu
};

const CAREGIVER_POSSESSIVE_SERVICE_CUES: Record<Language, RegExp> = {
  en: /\bmy\s+(?!(?:child|son|daughter)(?:['’]s)?\b)(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ist)|OT)\b(?!\s+for\s+(?:(?:my|our)\s+)?(?:child|son|daughter|him|her)\b)/iu,
  es: /(?<![\p{L}\p{N}_])mi\s+(?!hij[oa]\b)(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?)(?!\s+(?:(?:del\s+habla)\s+)?(?:de|para)\s+mi\s+hij[oa]\b)/iu
};

const IMPLIED_SERVICE_REQUEST_CUES: Record<Language, RegExp> = {
  en: /^(?:(?:(?:still|currently|now|already|also)\s+){0,2}(?:(?:need|needs|want|wants)|(?:(?:am|is|are)\s+)?looking\s+for))\s+(?:(?:(?:help|support)\s+(?:finding|accessing)\s+)|(?:(?:help|support)\s+with\s+(?:speech|language)\s+and\s+))?(?:(?:my\s+(?:child|son|daughter)(?:['’]s)|my\s+own|my|his|her|their|our|a|an|another|new)\s+)?(?:(?:speech|occupational|physical|behavioral)(?:\s+and\s+(?:speech|occupational|physical|behavioral))*\s+)?(?:therap(?:y|ies|ist)|OT)\b/iu,
  es: /^(?:(?:(?:todav[ií]a|a[uú]n|actualmente|ahora|ya|tambi[eé]n)\s+){0,2}(?:(?:necesito|necesita|necesitamos|quiero|quiere|queremos)|(?:(?:estoy|est[aá]|estamos|est[aá]n)\s+)?buscando|busc(?:o|a|amos|an)))\s+(?:(?:(?:ayuda|apoyo)\s+para\s+(?:encontrar|acceder\s+a)\s+)|(?:apoyo\s+con\s+el\s+(?:habla|lenguaje)\s+y\s+))?(?:(?:mi\s+propi[oa]|mi|su|nuestr[oa]|un|una|otra|otro|nueva|nuevo|la|el|las|los)\s+)?(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\b/iu
};

function caregiverOwnsServiceText(
  text: string,
  language: Language
): boolean {
  return (
    CAREGIVER_SELF_SERVICE_CUES[language].test(text) ||
    CAREGIVER_POSSESSIVE_SERVICE_CUES[language].test(text)
  );
}

function serviceExplicitlyTargetsCaregiver(
  text: string,
  language: Language
): boolean {
  return (
    CAREGIVER_EXPLICIT_SERVICE_TARGET_CUES[language].test(text) ||
    CAREGIVER_POSSESSIVE_SERVICE_CUES[language].test(text)
  );
}

function namesProfileChild(
  text: string,
  profile: FamilyProfile
): boolean {
  const childName = profile.childFirstName?.trim();
  return (
    childName !== undefined &&
    childName.length > 0 &&
    new RegExp(
      `(?<![\\p{L}\\p{N}_-])${escapeRegExp(childName)}(?![\\p{L}\\p{N}_-])`,
      "iu"
    ).test(text)
  );
}

function childSubjectRequestsService(
  text: string,
  profile: FamilyProfile,
  language: Language
): boolean {
  const childName = profile.childFirstName?.trim();
  const subjectParts =
    language === "es"
      ? [
          "él",
          "ella",
          "ellos",
          "ellas",
          "mi\\s+hij[oa]",
          "nuestr[oa]\\s+hij[oa]"
        ]
      : [
          "he",
          "she",
          "they",
          "(?:my|our)\\s+(?:child|son|daughter)"
        ];
  if (childName) subjectParts.push(escapeRegExp(childName));
  const subjectRequest = text.match(
    new RegExp(
      `^(?:${subjectParts.join("|")})(?![\\p{L}\\p{N}_-])\\s+(.+)$`,
      "iu"
    )
  );
  return (
    subjectRequest?.[1] !== undefined &&
    IMPLIED_SERVICE_REQUEST_CUES[language].test(subjectRequest[1])
  );
}

function namedSubjectRequestsService(
  text: string,
  language: Language
): boolean {
  const namedSubject = text.match(
    /^([\p{Lu}][\p{L}\p{M}'’-]*(?:\s+[\p{Lu}][\p{L}\p{M}'’-]*)*)\s+(.+)$/u
  );
  if (!namedSubject?.[1] || !namedSubject[2]) return false;
  const reservedSubjects =
    language === "es"
      ? new Set([
          "actualmente",
          "ahora",
          "aún",
          "todavía",
          "ya",
          "también",
          "yo",
          "nosotros",
          "nosotras"
        ])
      : new Set([
          "currently",
          "now",
          "still",
          "already",
          "also",
          "i",
          "we"
        ]);
  if (reservedSubjects.has(namedSubject[1].toLocaleLowerCase())) {
    return false;
  }
  return IMPLIED_SERVICE_REQUEST_CUES[language].test(namedSubject[2]);
}

function serviceTargetsChild(
  text: string,
  profile: FamilyProfile,
  language: Language
): boolean {
  if (serviceExplicitlyTargetsCaregiver(text, language)) return false;
  const childName = profile.childFirstName?.trim();
  const namesChildBeneficiary =
    childName !== undefined &&
    childName.length > 0 &&
    new RegExp(
      language === "es"
        ? `(?<![\\p{L}\\p{N}_-])(?:terapia(?:s)?(?:\\s+(?:del\\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\\s+(?:para|de)\\s+${escapeRegExp(childName)}(?![\\p{L}\\p{N}_-])`
        : `\\b(?:(?:(?:speech|occupational|physical|behavioral)\\s+)?therap(?:y|ies|ist)|OT)\\s+for\\s+${escapeRegExp(childName)}(?![\\p{L}\\p{N}_-])|(?<![\\p{L}\\p{N}_-])${escapeRegExp(childName)}(?:['’]s)?\\s+(?:(?:(?:speech|occupational|physical|behavioral)\\s+)?therap(?:y|ies|ist)|OT)\\b`,
      "iu"
    ).test(text);
  return (
    namesChildBeneficiary ||
    SERVICE_CHILD_BENEFICIARY_CUES[language].test(text) ||
    childSubjectRequestsService(text, profile, language)
  );
}

const SERVICE_STATUS_CARRYOVER: Record<Language, RegExp> = {
  en: /^(?:(?:it|that|this|the\s+service)\s+(?:is|was)\s+(?:not\s+enough|insufficient)|(?:it\s+)?(?:has\s+not|hasn'?t|is\s+not)\s+(?:started|begun)|(?:(?:we|they)\s+still\s+need|(?:he|she)\s+still\s+needs)\s+it|we\s+need\s+another\s+one)\b/iu,
  es: /^(?:no\s+es\s+suficiente|eso\s+no\s+es\s+suficiente|la\s+terapia\s+no\s+es\s+suficiente|todav[ií]a\s+no\s+ha\s+(?:empezado|comenzado)|todav[ií]a\s+(?:la|lo)\s+necesitamos|(?:él|ella)\s+(?:todav[ií]a|a[uú]n)\s+(?:la|lo)\s+necesita|necesitamos\s+otra)\b/iu
};

const SERVICE_RESOLUTION_CUES: Record<Language, RegExp> = {
  en: /\b(?:does\s+not|doesn'?t|no\s+longer)\s+needs?\b/iu,
  es: /(?<![\p{L}\p{N}_])ya\s+no\s+(?:la|lo)?\s*necesit(?:o|a|amos|an)(?![\p{L}\p{N}_])/iu
};

const SERVICE_CONTRAST_BOUNDARY =
  /\s+(?:but|pero)\s+|\s+and\s+(?=(?:(?:(?:we|I|he|she|they)\s+)?(?:(?:still|currently|now|already|also)\s+){0,2}(?:need|needs|want|wants|cannot|can't)|(?:(?:we|I|he|she|they)\s+)?(?:(?:still|currently|now|already|also)\s+){0,2}(?:(?:am|is|are)\s+)?looking\s+for|(?:(?:still|currently|now|already|also)\s+)?(?:(?:has|have)\s+(?:trouble|difficulty)|(?:cannot|can't)\s+(?:talk|speak|walk|read|write)|struggl(?:e|es)|(?:barely|not)\s+(?:talking|speaking|walking))|(?:he|she|they|I|we)\s+(?:(?:still\s+)?(?:fall|falls|struggle|struggles)|(?:has|have)\s+(?:trouble|difficulty)|(?:only\s+)?says?|is\s+saying))\b)|\s+y\s+(?=(?:(?:(?:yo|nosotros|nosotras|él|ella|ellos|ellas)\s+)?(?:(?:todavía|aún|actualmente|ahora|ya|también)\s+){0,2}(?:necesito|necesita|necesitamos|quiero|quiere|queremos|no\s+puedo|no\s+podemos)|(?:(?:yo|nosotros|nosotras|él|ella|ellos|ellas)\s+)?(?:(?:todavía|aún|actualmente|ahora|ya|también)\s+){0,2}(?:(?:(?:estoy|est[aá]|estamos|est[aá]n)\s+)?buscando|busc(?:o|a|amos|an))|(?:(?:todavía|aún|actualmente|ahora|ya|también)\s+)?(?:tiene(?:n)?\s+dificultad|tengo\s+dificultad|tenemos\s+dificultad|no\s+puede(?:n)?|no\s+puedo|no\s+podemos|(?:casi\s+no|no)\s+(?:habla|hablo|camina|camino))|(?:él|ella|ellos|ellas|yo|nosotros|nosotras)\s+(?:(?:todavía|aún)\s+)?(?:se\s+cae(?:n)?|tiene(?:n)?\s+dificultad|tengo\s+dificultad|tenemos\s+dificultad|no\s+puede(?:n)?|(?:solo\s+)?(?:dice|digo|decimos)|est[aá]\s+diciendo))\b)/giu;

const SERVICE_CURRENT_STATUS_BOUNDARY: Record<Language, RegExp> = {
  en: /\s+and\s+(?=(?:(?:I|we|he|she|they)\s+)?(?:(?:currently|already|now|also)\s+)?(?:receive(?:s)?|get(?:s)?|go(?:es)?\s+to|see(?:s)?|(?:am|is|are)\s+in)\s+(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)\b)/giu,
  es: /\s+y\s+(?=(?:(?:yo|nosotr[oa]s|él|ella|ellos|ellas)\s+)?(?:(?:actualmente|ya|ahora|tambi[eé]n)\s+)?(?:recib(?:o|e|imos|en)|v(?:oy|a|amos|an)\s+a|v(?:eo|e|emos|en)|(?:estoy|est[aá]|estamos|est[aá]n)\s+en)\s+(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\b)/giu
};

const SERVICE_HISTORICAL_STATUS_BOUNDARY: Record<Language, RegExp> = {
  en: /\s+and\s+(?=(?:(?:I|we|he|she|they)\s+)?(?:completed|finished|had|used\s+to\s+receive)\s+(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)\b)/giu,
  es: /\s+y\s+(?=(?:(?:yo|nosotr[oa]s|él|ella|ellos|ellas)\s+)?(?:termin(?:[eé]|[oó]|amos|aron)|complet(?:[eé]|[oó]|amos|aron)|recib(?:[ií]|i[oó]|imos|ieron)|tuve|tuvimos|antes\s+recib(?:[ií]a|[ií]amos))\s+(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\b)/giu
};

const SERVICE_EXPLICIT_OWNERSHIP_BOUNDARY: Record<Language, RegExp> = {
  en: /\s+and\s+(?=(?:(?:my\s+(?:own\s+)?|his\s+|her\s+|their\s+|(?:my|our)\s+(?:child|son|daughter)(?:['’]s)?\s+)(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)|(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)\s+for\s+(?:me|myself|him|her|them|(?:my|our)\s+(?:child|son|daughter)))\b)/giu,
  es: /\s+y\s+(?=(?:(?:mi\s+propi[oa]|mi|su|la|el)\s+(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)|(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\s+(?:para|de)\s+(?:m[ií]|él|ella|mi\s+hij[oa]|nuestro\s+hij[oa]))\b)/giu
};

const SERVICE_ACTORLESS_REGRESSION_BOUNDARY: Record<Language, RegExp> = {
  en: /\s+and\s+(?=(?:(?:then|still|currently|now|already|also)\s+)?(?:(?:stopped|quit)\s+(?:saying|talking|speaking|walking|pointing|signing|waving|babbling|crawling)|lost\s+(?:words?|skills?|speech|language|the\s+words?)|used\s+to\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)\b[^.]{0,40}?(?:no\s+longer|doesn'?t|does\s+not|don'?t|won'?t|can'?t|stopped|quit)|no\s+longer\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)|forgot\s+how\s+to)\b)/giu,
  es: /\s+y\s+(?=(?:(?:luego|todav[ií]a|a[uú]n|actualmente|ahora|ya|tambi[eé]n)\s+)?(?:dej[eé]\s+de\s+(?:hablar|decir|caminar|señalar)|perd[ií]\s+(?:palabras|habilidades|las\s+palabras)|yo\s+antes\s+(?:hablaba|dec[ií]a|caminaba|señalaba|saludaba)\b[^.]{0,40}?ya\s+no|ya\s+no\s+(?:hablo|digo|camino|señalo)|olvid[eé]\s+c[oó]mo)\b)/giu
};

const BARE_EXPLICIT_SERVICE_TARGET: Record<Language, RegExp> = {
  en: /^(?:(?:(?:my\s+(?:own\s+)?|his\s+|her\s+|their\s+|(?:my|our)\s+(?:child|son|daughter)(?:['’]s)?\s+)(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT))|(?:(?:(?:speech|occupational|physical|behavioral)\s+)?therap(?:y|ies|ist)|OT)\s+for\s+(?:me|myself|him|her|them|(?:my|our)\s+(?:child|son|daughter)|[\p{L}][\p{L}\p{M}'’-]*(?:\s+[\p{L}][\p{L}\p{M}'’-]*)*))[.!?]?$/iu,
  es: /^(?:(?:(?:mi\s+propi[oa]|mi|su|la|el)\s+(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta))|(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\s+(?:para|de)\s+(?:m[ií]|él|ella|mi\s+hij[oa]|nuestro\s+hij[oa]|[\p{L}][\p{L}\p{M}'’-]*(?:\s+[\p{L}][\p{L}\p{M}'’-]*)*))[.!?]?$/iu
};

const ACTOR_SWITCH_BOUNDARY: Record<Language, RegExp> = {
  en: /\s+(?:and|but)\s+(?=(?:I|we|he|she|they|my\s+(?:child|son|daughter|own)|our\s+(?:child|son|daughter)|his|her|their|(?:(?:the|his|her|their)\s+)?(?:doctor|clinician|provider|therapist))\b)/giu,
  es: /\s+(?:y|pero)\s+(?=(?:yo|nosotr[oa]s|él|ella|ellos|ellas|mi\s+(?:hij[oa]|propi[oa])|nuestr[oa]\s+hij[oa]|su|(?:(?:el|la|su)\s+)?(?:m[eé]dic[oa]|profesional|proveedor|terapeuta))\b)/giu
};

function splitNarrativeSegmentAt(
  segment: NarrativeSegment,
  boundaryPattern: RegExp
): NarrativeSegment[] {
  const parts: NarrativeSegment[] = [];
  let cursor = 0;
  for (const boundary of segment.text.matchAll(boundaryPattern)) {
    const boundaryStart = boundary.index ?? cursor;
    const local = trimNarrativeSpan(
      segment.text,
      cursor,
      boundaryStart
    );
    if (local) {
      parts.push({
        ...segment,
        text: local.text,
        start: segment.start + local.start,
        end: segment.start + local.end
      });
    }
    cursor = boundaryStart + boundary[0].length;
  }
  const finalPart = trimNarrativeSpan(
    segment.text,
    cursor,
    segment.text.length
  );
  if (finalPart) {
    parts.push({
      ...segment,
      text: finalPart.text,
      start: segment.start + finalPart.start,
      end: segment.start + finalPart.end
    });
  }
  return parts;
}

function splitActorSwitches(
  segment: NarrativeSegment,
  profile: FamilyProfile,
  language: Language
): NarrativeSegment[] {
  const explicitActorParts = splitNarrativeSegmentAt(
    segment,
    ACTOR_SWITCH_BOUNDARY[language]
  );
  const childName = profile.childFirstName?.trim();
  if (!childName) return explicitActorParts;
  const conjunction = language === "es" ? "(?:y|pero)" : "(?:and|but)";
  const namedChildBoundary = new RegExp(
    `\\s+${conjunction}\\s+(?=${escapeRegExp(childName)}(?![\\p{L}\\p{N}_-]))`,
    "giu"
  );
  return explicitActorParts.flatMap((part) =>
    splitNarrativeSegmentAt(part, namedChildBoundary)
  );
}

function splitServiceContrasts(
  segment: NarrativeSegment,
  profile: FamilyProfile,
  language: Language
): NarrativeSegment[] {
  if (!SERVICE_LANGUAGE[language].test(segment.text)) return [segment];
  const childName = profile.childFirstName?.trim();
  const profileTargetBoundary =
    childName && childName.length > 0
      ? new RegExp(
          language === "es"
            ? `\\s+y\\s+(?=(?:terapia(?:s)?(?:\\s+(?:del\\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\\s+(?:para|de)\\s+${escapeRegExp(childName)}(?![\\p{L}\\p{N}_-]))`
            : `\\s+and\\s+(?=(?:(?:(?:speech|occupational|physical|behavioral)\\s+)?therap(?:y|ies|ist)|OT)\\s+for\\s+${escapeRegExp(childName)}(?![\\p{L}\\p{N}_-])|${escapeRegExp(childName)}(?:['’]s)?\\s+(?:(?:(?:speech|occupational|physical|behavioral)\\s+)?therap(?:y|ies|ist)|OT)\\b)`,
          "giu"
        )
      : null;
  const boundaries = [
    SERVICE_CONTRAST_BOUNDARY,
    SERVICE_CURRENT_STATUS_BOUNDARY[language],
    SERVICE_HISTORICAL_STATUS_BOUNDARY[language],
    SERVICE_EXPLICIT_OWNERSHIP_BOUNDARY[language],
    SERVICE_ACTORLESS_REGRESSION_BOUNDARY[language],
    ...(profileTargetBoundary ? [profileTargetBoundary] : [])
  ];
  return boundaries.reduce<NarrativeSegment[]>(
    (parts, boundary) =>
      parts.flatMap((part) => splitNarrativeSegmentAt(part, boundary)),
    [segment]
  );
}

const ENGLISH_SERVICE_RULES: ServiceRule[] = [
  {
    status: "resolved",
    disposition: "excluded",
    pattern: SERVICE_RESOLUTION_CUES.en
  },
  {
    status: "lost",
    disposition: "supported",
    pattern: /\b(?:therapist|provider|service)\b[^.!?]{0,40}\b(?:stopped\s+coming|stopped|ended|was\s+lost)\b|\blost\b[^.!?]{0,30}\btherap/iu
  },
  {
    status: "unavailable",
    disposition: "supported",
    pattern: /\b(?:cannot|can'?t)\s+find\b[^.!?]{0,40}\b(?:therap(?:y|ies|ist)|OT|provider)\b|\b(?:therap(?:y|ies|ist)|OT|provider)\b[^.!?]{0,40}\b(?:unavailable|not\s+available|no\s+provider)\b/iu
  },
  {
    status: "inaccessible",
    disposition: "supported",
    pattern: /\b(?:cannot|can'?t)\s+(?:access|get\s+to|reach)\b[^.!?]{0,50}\btherap|\btherap[^.!?]{0,50}\b(?:inaccessible|out\s+of\s+reach)\b/iu
  },
  {
    status: "insufficient",
    disposition: "supported",
    pattern: /\b(?:not\s+enough|insufficient)\b|\b(?:we|he|she|they)\s+still\s+(?:need|needs)\s+it\b|\bstill\s+(?:need|needs)\b[^.!?]{0,35}\b(?:therap(?:y|ies|ist)|OT|it)\b/iu
  },
  {
    status: "replacement",
    disposition: "supported",
    pattern: /\b(?:another|different|new)\s+therapist\b|\bwe\s+need\s+another\s+one\b/iu
  },
  {
    status: "recommended",
    disposition: "supported",
    pattern: /\brecommend(?:ed|ation)?\b[^.!?]{0,50}\b(?:not|hasn'?t|has\s+not|waiting\s+to)\b[^.!?]{0,20}\b(?:start|started|begin|begun)\b/iu
  },
  {
    status: "recommended",
    disposition: "supported",
    pattern: /\b(?:doctor|clinician|provider|therapist)\b[^.!?]{0,50}\b(?:said|recommended)\b[^.!?]{0,60}\btherap[^.!?]{0,30}\b(?:help|benefit)\b/iu
  },
  {
    status: "requested",
    disposition: "supported",
    pattern: IMPLIED_SERVICE_REQUEST_CUES.en
  },
  {
    status: "requested",
    disposition: "supported",
    pattern: /\b(?:we|I|he|she|they)\s+(?:(?:still|currently|now|already|also)\s+){0,2}(?:need|needs|want|wants)\s+(?:(?:help|support)\s+(?:finding|accessing)\s+)?(?:(?:my\s+(?:child|son|daughter)(?:['’]s)|my\s+own|my|his|her|their|our|a|an|another|new)\s+)?(?:(?:speech|occupational|physical|behavioral)(?:\s+and\s+(?:speech|occupational|physical|behavioral))*\s+)?(?:therap(?:y|ies|ist)|OT)\b|\b(?:looking\s+for|help\s+finding)\s+(?:(?:my\s+(?:child|son|daughter)(?:['’]s)|my\s+own|my|his|her|their|our|a|an|another|new)\s+)?(?:(?:speech|occupational|physical|behavioral)(?:\s+and\s+(?:speech|occupational|physical|behavioral))*\s+)?(?:therap(?:y|ies|ist)|OT)\b/iu
  },
  {
    status: "current",
    disposition: "excluded",
    pattern: /\b(?:already|currently)\b|\b(?:go(?:es)?\s+to|receive(?:s)?|get(?:s)?|see(?:s)?|(?:am|is|are)\s+in)\b[^.!?]{0,50}\b(?:therap(?:y|ies|ist)|OT)\b/iu
  },
  {
    status: "historical",
    disposition: "excluded",
    pattern: /\b(?:completed|finished|had|used\s+to\s+receive)\b/iu
  }
];

const SPANISH_SERVICE_RULES: ServiceRule[] = [
  {
    status: "resolved",
    disposition: "excluded",
    pattern: SERVICE_RESOLUTION_CUES.es
  },
  {
    status: "lost",
    disposition: "supported",
    pattern: /\b(?:terapeuta|proveedor|servicio)\b[^.!?]{0,40}\b(?:dej[oó]\s+de\s+venir|par[oó]|termin[oó]|se\s+perdi[oó])(?![\p{L}\p{N}_])/iu
  },
  {
    status: "unavailable",
    disposition: "supported",
    pattern: /\bno\s+podemos\s+encontrar\b[^.!?]{0,40}\b(?:terapia|terapeuta|proveedor)\b|\b(?:terapia|terapeuta|proveedor)\b[^.!?]{0,40}\b(?:no\s+est[aá]\s+disponible|no\s+hay\s+proveedor)\b/iu
  },
  {
    status: "inaccessible",
    disposition: "supported",
    pattern: /\b(?:no\s+podemos\s+(?:acceder|llegar)|no\s+se\s+puede\s+acceder)\b[^.!?]{0,50}\bterapia|\bterapia[^.!?]{0,50}\binaccesible\b/iu
  },
  {
    status: "insufficient",
    disposition: "supported",
    pattern: /\bno\s+es\s+suficiente\b|\btodav[ií]a\s+(?:la|lo)\s+necesitamos\b|(?:él|ella)\s+(?:todav[ií]a|a[uú]n)\s+(?:la|lo)\s+necesita\b|\b(?:todav[ií]a|a[uú]n)\s+necesitamos?\b[^.!?]{0,35}\b(?:terapia|terapeuta|la)\b/iu
  },
  {
    status: "replacement",
    disposition: "supported",
    pattern: /\b(?:otra|otro|nueva|nuevo|diferente)\s+terapeuta\b|\b(?:necesitamos?|queremos?)\s+otra\b/iu
  },
  {
    status: "recommended",
    disposition: "supported",
    pattern: /\brecomendaron\b[^.!?]{0,60}\b(?:no|todav[ií]a\s+no)\b[^.!?]{0,20}\b(?:empezado|comenzado)\b/iu
  },
  {
    status: "recommended",
    disposition: "supported",
    pattern: /\b(?:m[eé]dic[oa]|profesional|terapeuta)\b[^.!?]{0,50}\b(?:dijo|recomend[oó])(?![\p{L}\p{N}_])[^.!?]{0,60}\bterapia[^.!?]{0,30}\b(?:ayudar|beneficiar)\b/iu
  },
  {
    status: "requested",
    disposition: "supported",
    pattern: IMPLIED_SERVICE_REQUEST_CUES.es
  },
  {
    status: "requested",
    disposition: "supported",
    pattern: /\b(?:(?:todav[ií]a|a[uú]n|actualmente|ahora|ya|tambi[eé]n)\s+){0,2}(?:necesito|necesita|necesitamos|quiero|quiere|queremos)\s+(?:ayuda\s+para\s+(?:encontrar|acceder\s+a)\s+)?(?:(?:mi\s+propi[oa]|mi|su|nuestra|nuestro|un|una|otra|otro|la|el|las|los)\s+)?(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\b|\b(?:busco|busca|buscamos|estoy\s+buscando|est[aá]\s+buscando|estamos\s+buscando|ayuda\s+para\s+encontrar)\s+(?:(?:mi\s+propi[oa]|mi|un|una|otra|otro|la|el|las|los)\s+)?(?:terapia(?:s)?(?:\s+(?:del\s+habla|ocupacional|f[ií]sica|conductual))?|terapeuta)\b/iu
  },
  {
    status: "current",
    disposition: "excluded",
    pattern: /(?<![\p{L}\p{N}_])(?:actualmente|ya\s+va|v(?:a|oy|amos|an)\s+a|recib(?:e|o|imos|en)|v(?:e|eo|emos|en)|(?:estoy|est[aá]|estamos|est[aá]n)\s+en)(?![\p{L}\p{N}_])[^.!?]{0,50}(?<![\p{L}\p{N}_])(?:terapia|terapeuta)(?![\p{L}\p{N}_])/iu
  },
  {
    status: "historical",
    disposition: "excluded",
    pattern: /(?<![\p{L}\p{N}_])(?:termin(?:[eé]|[oó]|amos|aron)|complet(?:[eé]|[oó]|amos|aron)|recib(?:[ií]|i[oó]|imos|ieron)|tuve|tuvimos|antes\s+recib(?:[ií]a|[ií]amos))(?![\p{L}\p{N}_])/iu
  }
];

const SERVICE_RULES: Record<Language, ServiceRule[]> = {
  en: ENGLISH_SERVICE_RULES,
  es: SPANISH_SERVICE_RULES
};

function classifyServiceContext(
  context: string,
  language: Language
): {
  serviceStatus: Exclude<ServiceStatus, "none">;
  disposition: "supported" | "excluded";
} | null {
  const rule = SERVICE_RULES[language].find(({ pattern }) =>
    pattern.test(context)
  );
  return rule
    ? { serviceStatus: rule.status, disposition: rule.disposition }
    : null;
}

function serviceModalities(
  segment: NarrativeSegment,
  language: Language
): ServiceModality[] {
  const clinicalText = segment.text.replace(
    SERVICE_ADMIN_PHRASES[language],
    " "
  );
  if (!SERVICE_LANGUAGE[language].test(clinicalText)) return [];
  const modalities: ServiceModality[] = [];
  if (SERVICE_SPEECH_DISCIPLINE[language].test(clinicalText)) {
    modalities.push("speech");
  }
  if (SERVICE_MOTOR_DISCIPLINE[language].test(clinicalText)) {
    modalities.push("motor");
  }
  return modalities.length > 0 ? modalities : ["generic"];
}

function sameServiceOwnership(
  current: NarrativeSegment,
  next: NarrativeSegment,
  language: Language
): boolean {
  const currentIsCaregiverOwned =
    caregiverOwnsServiceText(current.text, language);
  const nextIsCaregiverOwned =
    caregiverOwnsServiceText(next.text, language);
  return currentIsCaregiverOwned === nextIsCaregiverOwned;
}

function sameServiceEpisode(
  current: NarrativeSegment,
  next: NarrativeSegment,
  language: Language
): boolean {
  if (current.sentenceStart !== next.sentenceStart) return false;
  if (!sameServiceOwnership(current, next, language)) return false;
  const currentModalities = serviceModalities(current, language);
  const nextModalities = serviceModalities(next, language);
  return (
    currentModalities.includes("generic") ||
    nextModalities.includes("generic") ||
    currentModalities.some((modality) => nextModalities.includes(modality))
  );
}

function modalityMatchesResolution(
  modality: ServiceModality,
  resolvedModalities: readonly ServiceModality[]
): boolean {
  return (
    modality === "generic" ||
    resolvedModalities.includes("generic") ||
    resolvedModalities.includes(modality)
  );
}

function serviceSignalCaregiverOwned(
  segments: readonly NarrativeSegment[],
  index: number,
  profile: FamilyProfile,
  language: Language
): boolean {
  const segment = segments[index];
  if (!segment) return false;
  if (serviceTargetsChild(segment.text, profile, language)) return false;
  if (caregiverOwnsServiceText(segment.text, language)) return true;
  const previous = segments[index - 1];
  return (
    previous !== undefined &&
    previous.sentenceStart === segment.sentenceStart &&
    IMPLIED_SERVICE_REQUEST_CUES[language].test(segment.text) &&
    (caregiverOwnsServiceText(previous.text, language) ||
      caregiverOwnsClinicalPredicate(previous.text, language))
  );
}

function classifyServiceSegments(
  clauses: readonly NarrativeSegment[],
  profile: FamilyProfile,
  language: Language
): ClassifiedServiceSignal[] {
  const serviceStatusSegments = clauses.flatMap((segment) =>
    splitServiceContrasts(segment, profile, language)
  );
  return serviceStatusSegments.flatMap((segment, index) => {
    if (!SERVICE_LANGUAGE[language].test(segment.text)) return [];
    const modalities = serviceModalities(segment, language);
    if (modalities.length === 0) return [];
    const caregiverOwned = serviceSignalCaregiverOwned(
      serviceStatusSegments,
      index,
      profile,
      language
    );
    const previous = serviceStatusSegments[index - 1];
    const next = serviceStatusSegments[index + 1];
    const adjacentNext =
      next !== undefined &&
      next.sentenceStart === segment.sentenceStart
        ? next
        : null;
    const resolvedCarryover =
      adjacentNext !== null &&
      SERVICE_RESOLUTION_CUES[language].test(adjacentNext.text) &&
      sameServiceEpisode(segment, adjacentNext, language);
    const serviceFreeCarryover =
      adjacentNext !== null &&
      !SERVICE_LANGUAGE[language].test(adjacentNext.text) &&
      SERVICE_STATUS_CARRYOVER[language].test(adjacentNext.text);

    if (resolvedCarryover && adjacentNext !== null) {
      const resolvedModalities = serviceModalities(
        adjacentNext,
        language
      );
      const resolved = modalities.filter((modality) =>
        modalityMatchesResolution(modality, resolvedModalities)
      );
      const remaining = modalities.filter(
        (modality) => !resolved.includes(modality)
      );
      const unresolvedClassification = classifyServiceContext(
        segment.text,
        language
      );
      const signals: ClassifiedServiceSignal[] = [];
      if (resolved.length > 0) {
        signals.push({
          segment,
          serviceStatus: "resolved",
          disposition: "excluded",
          modalities: resolved,
          caregiverOwned
        });
      }
      if (remaining.length > 0 && unresolvedClassification) {
        signals.push({
          segment,
          serviceStatus: unresolvedClassification.serviceStatus,
          disposition: unresolvedClassification.disposition,
          modalities: remaining,
          caregiverOwned
        });
      }
      return signals;
    }

    const context = serviceFreeCarryover
      ? `${segment.text}, ${adjacentNext?.text ?? ""}`
      : segment.text;
    const childSubjectRequest = childSubjectRequestsService(
      segment.text,
      profile,
      language
    );
    const namedSubjectRequest = namedSubjectRequestsService(
      segment.text,
      language
    );
    const namedSubjectTargetsChild =
      namedSubjectRequest &&
      serviceTargetsChild(segment.text, profile, language);
    const directClassification =
      childSubjectRequest || namedSubjectTargetsChild
      ? {
          serviceStatus: "requested" as const,
          disposition: "supported" as const
        }
      : namedSubjectRequest
        ? {
            serviceStatus: "requested" as const,
            disposition: "excluded" as const
          }
        : classifyServiceContext(context, language);
    const previousClassification =
      previous !== undefined &&
      previous.sentenceStart === segment.sentenceStart
        ? classifyServiceContext(previous.text, language)
        : null;
    const inheritsRequestedStatus =
      directClassification === null &&
      previousClassification?.serviceStatus === "requested" &&
      BARE_EXPLICIT_SERVICE_TARGET[language].test(segment.text) &&
      (serviceExplicitlyTargetsCaregiver(segment.text, language) ||
        serviceTargetsChild(segment.text, profile, language));
    const classification = directClassification ??
      (inheritsRequestedStatus
        ? {
            serviceStatus: "requested" as const,
            disposition: "supported" as const
          }
        : null);
    return classification
      ? [
          {
            segment,
            serviceStatus: classification.serviceStatus,
            disposition: classification.disposition,
            modalities,
            caregiverOwned
          }
        ]
      : [];
  });
}

const CAREGIVER_READING_CUES: Record<Language, RegExp> = {
  en: /\b(?:reading|long\s+pages?|forms?)\b[^.!?]{0,40}\b(?:is|are)\s+hard\s+for\s+me\b|\bhard\s+for\s+me\s+to\s+read\b/iu,
  es: /\bme\s+cuesta\s+leer\b|\b(?:lectura|p[aá]ginas?|formularios?)\b[^.!?]{0,40}\bdif[ií]cil(?:es)?\s+para\s+m[ií](?![\p{L}\p{N}_])/iu
};

const POSITIVE_SPEECH_CUES: Record<Language, RegExp> = {
  en: /\b(?:using|saying)\s+more\s+words\b|\b(?:speech|language|talking)\b[^.!?]{0,30}\b(?:improving|getting\s+better)\b/iu,
  es: /\b(?:usando|diciendo)\s+m[aá]s\s+palabras\b|\b(?:habla|lenguaje)\b[^.!?]{0,30}\b(?:mejorando|est[aá]\s+mejor)\b/iu
};

const CONTINUING_SPEECH_DIFFICULTY_CUES: Record<Language, RegExp> = {
  en: /\b(?:(?:still\s+(?:(?:cannot|can'?t)\s+(?:talk|speak|say|tell\s+us)|needs?\s+(?:speech|language|communication|help\s+(?:talking|speaking|communicating))))|(?:speech|language|communication)\b[^.!?]{0,30}\b(?:not\s+enough|still\s+(?:hard|difficult))|(?:cannot|can'?t)\s+tell\s+us)\b/iu,
  es: /\b(?:(?:(?:todav[ií]a|a[uú]n)\s+(?:no\s+puede\s+(?:hablar|decir(?:nos)?|comunicarse)|necesita\s+(?:terapia\s+del\s+habla|ayuda\s+para\s+(?:hablar|comunicarse)|apoyo\s+(?:del\s+habla|de\s+lenguaje))))|(?:habla|lenguaje|comunicaci[oó]n)\b[^.!?]{0,30}\bno\s+es\s+suficiente|no\s+puede\s+decir(?:nos|\s+lo))\b/iu
};

const SPEECH_DIFFICULTY_CUES: Record<Language, RegExp> = {
  en: /\b(?:(?:trouble|difficulty)\s+(?:speaking|talking|communicating)|struggl\w*\s+(?:(?:to|with)\s+)?(?:speak\w*|talk\w*|communicat\w*)|barely\s+(?:talks?|speaks?|says?)|(?:cannot|can'?t)\s+(?:talk|speak|say|tell)|not\s+(?:talking|speaking))\b/iu,
  es: /(?<![\p{L}\p{N}_])(?:(?:tiene|tengo)\s+dificultad\s+para\s+(?:hablar|comunicarse)|(?:le|me)\s+cuesta\s+(?:hablar|comunicarse)|(?:estoy|est[aá])\s+(?:luchando|batallando)\s+(?:para\s+)?(?:hablar|comunicarse)|casi\s+no\s+(?:habla|hablo)|no\s+puede\s+(?:hablar|comunicarse)|no\s+(?:habla|hablo))(?![\p{L}\p{N}_])/iu
};

const MOTOR_DIFFICULTY_CUES: Record<Language, RegExp> = {
  en: /\b(?:(?:trouble|difficulty)\s+(?:walking|crawling|balancing|climbing)|struggl\w*\s+(?:(?:to|with)\s+)?(?:walk\w*|crawl\w*|balanc\w*|climb\w*)|barely\s+(?:walks?|crawls?)|(?:cannot|can'?t)\s+(?:walk|crawl|balance|climb)|not\s+(?:walking|crawling))\b/iu,
  es: /(?<![\p{L}\p{N}_])(?:(?:tiene|tengo)\s+dificultad\s+para\s+(?:caminar|gatear|mantener\s+el\s+equilibrio|subir)|(?:le|me)\s+cuesta\s+(?:caminar|gatear|mantener\s+el\s+equilibrio|subir)|casi\s+no\s+(?:camina|camino|gatea|gateo)|no\s+puede\s+(?:caminar|gatear|mantener\s+el\s+equilibrio|subir)|no\s+(?:camina|camino|gatea|gateo))(?![\p{L}\p{N}_])/iu
};

const CAREGIVER_SELF_BEHAVIOR_CUES: Record<Language, RegExp> = {
  en: /\bI\s+(?:have|am|feel)\b[^.!?]{0,50}\b(?:anxiety|anxious|sleeping|sleep)\b/iu,
  es: /\b(?:tengo|estoy|me\s+siento)\b[^.!?]{0,50}\b(?:ansiedad|ansios[oa]|dormir|sueño)\b/iu
};

const CAREGIVER_SELF_CLINICAL_CUES: Record<Language, RegExp> = {
  en: /\b(?:I\s+(?:have|had|am|cannot|can'?t|(?:only\s+)?say|speak|talk|walk|struggle)|my\s+own|hard\s+for\s+me|waiting\s+for\s+my)\b/iu,
  es: /\b(?:tengo|tuve|estoy|no\s+puedo|me\s+cuesta|yo\s+(?:solo\s+)?(?:digo|hablo|camino)|mi\s+propia|mi\s+propio|esperando\s+mi)\b/iu
};

const ACTORLESS_CAREGIVER_CONTINUATION_CUES: Record<Language, RegExp> = {
  en: /^(?:(?:(?:then|still|currently|now|already|also)\s+)?(?:(?:have|am\s+having)\s+(?:trouble|difficulty)\s+(?:speaking|talking|walking|reading|writing)|(?:cannot|can'?t)\s+(?:speak|talk|walk|read|write)|struggle\s+(?:to\s+)?(?:speak|talk|walk|read|write)|am\s+struggling\s+(?:to\s+)?(?:speak|talk|walk|read|write)|barely\s+(?:talk|speak|walk|read|write)|am\s+(?:barely|not)\s+(?:talking|speaking|walking|reading|writing)|(?:stopped|quit)\s+(?:saying|talking|speaking|walking|pointing|signing|waving|babbling|crawling)|lost\s+(?:words?|skills?|speech|language|the\s+words?)|used\s+to\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)\b[^.]{0,40}?(?:no\s+longer|doesn'?t|does\s+not|don'?t|won'?t|can'?t|stopped|quit)|no\s+longer\s+(?:say|talk|speak|walk|point|sign|wave|babble|crawl)|forgot\s+how\s+to))\b/iu,
  es: /^(?:(?:(?:luego|todav[ií]a|a[uú]n|actualmente|ahora|ya|tambi[eé]n)\s+)?(?:tengo\s+dificultad\s+para\s+(?:hablar|caminar|leer|escribir)|me\s+cuesta\s+(?:hablar|caminar|leer|escribir)|no\s+puedo\s+(?:hablar|caminar|leer|escribir)|(?:casi\s+no|no)\s+(?:hablo|camino|leo|escribo)|dej[eé]\s+de\s+(?:hablar|decir|caminar|señalar)|perd[ií]\s+(?:palabras|habilidades|las\s+palabras)|yo\s+antes\s+(?:hablaba|dec[ií]a|caminaba|señalaba|saludaba)\b[^.]{0,40}?ya\s+no|ya\s+no\s+(?:hablo|digo|camino|señalo)|olvid[eé]\s+c[oó]mo))\b/iu
};

function inheritsCaregiverActor(
  segment: NarrativeSegment,
  previous: NarrativeSegment | undefined,
  profile: FamilyProfile,
  language: Language
): boolean {
  return (
    previous !== undefined &&
    previous.sentenceStart === segment.sentenceStart &&
    ACTORLESS_CAREGIVER_CONTINUATION_CUES[language].test(segment.text) &&
    resolveNarrativeActor(previous, profile, language) === "caregiver"
  );
}

function inheritsLimitedLanguageActor(
  segment: NarrativeSegment,
  previous: NarrativeSegment | undefined,
  profile: FamilyProfile,
  language: Language
): Extract<NarrativeActor, "child" | "caregiver"> | null {
  if (
    previous === undefined ||
    previous.sentenceStart !== segment.sentenceStart ||
    !ELLIPTICAL_LIMITED_LANGUAGE_CONTEXT[language].test(segment.text)
  ) {
    return null;
  }
  const previousActor = resolveNarrativeActor(
    previous,
    profile,
    language
  );
  return previousActor === "child" || previousActor === "caregiver"
    ? previousActor
    : null;
}

function resolveNarrativeActor(
  segment: NarrativeSegment,
  profile: FamilyProfile,
  language: Language,
  previous?: NarrativeSegment
): NarrativeActor {
  const clause = segment.text;
  const clinician =
    language === "es"
      ? /\b(?:doctor(?:a)?|pediatra|m[eé]dic[oa]|profesional|proveedor|terapeuta)\b[^.!?]{0,35}\b(?:dijo|dice|recomend[oó])(?![\p{L}\p{N}_])/iu
      : /\b(?:doctor|pediatrician|clinician|provider|therapist)\b[^.!?]{0,35}\b(?:said|says|recommended)\b/iu;
  if (
    caregiverOwnsClinicalPredicate(clause, language) ||
    caregiverOwnsServiceText(clause, language) ||
    inheritsCaregiverActor(segment, previous, profile, language)
  ) {
    return "caregiver";
  }
  if (clinician.test(clause)) return "clinician";

  const hasChildReferent =
    namesProfileChild(clause, profile) ||
    CHILD_REFERENT_CUES[language].test(clause);
  if (hasChildReferent) return "child";
  if (CAREGIVER_SELF_CLINICAL_CUES[language].test(clause)) {
    return "caregiver";
  }
  const inheritedLimitedLanguageActor = inheritsLimitedLanguageActor(
    segment,
    previous,
    profile,
    language
  );
  if (inheritedLimitedLanguageActor) {
    return inheritedLimitedLanguageActor;
  }
  return "unclear";
}

function actorDisposition(
  actor: NarrativeActor
): "supported" | "excluded" {
  return actor === "caregiver" ? "excluded" : "supported";
}

function actorEvidenceRole(actor: NarrativeActor): EvidenceRole {
  if (actor === "clinician") return "professional_recommendation";
  if (actor === "child") return "observation";
  return "other_concern";
}

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
  const seenFacts = new Set<string>();
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
      const factIdentity = [fact.label, fact.value]
        .join("\u0000")
        .toLocaleLowerCase();
      if (seen.has(identity) || seenFacts.has(factIdentity)) return [];
      seen.add(identity);
      seenFacts.add(factIdentity);
      return [{ candidate, fact }];
    })
    .slice(0, CONCERN_FACT_LIMIT);
}

function buildNarrativeCandidates(
  text: string,
  profile: FamilyProfile,
  language: Language
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];
  const sentences = sentenceSpans(text);
  const segments = narrativeSegments(text)
    .flatMap((segment) => splitActorSwitches(segment, profile, language))
    .flatMap((segment) =>
      splitServiceContrasts(segment, profile, language)
    );
  const serviceSegmentStarts = new Set(
    segments
      .filter(({ text: segmentText }) =>
        SERVICE_LANGUAGE[language].test(segmentText)
      )
      .map(({ start }) => start)
  );
  const spanningRegressionLeadStarts = new Set<number>();

  for (const [index, sentence] of sentences.entries()) {
    const whole = sentenceSegment(sentence, index);
    const clauses = segments.filter(
      ({ sentenceStart }) => sentenceStart === sentence.start
    );
    const regressionClauses = clauses.flatMap(
      (clause, regressionClauseIndex) =>
        hasNarrativeRegressionCue(clause.text, language)
          ? [{ clause, regressionClauseIndex, actorOverride: null }]
          : []
    );
    const hasSpanningRegressionFallback =
      regressionClauses.length === 0 &&
      hasNarrativeRegressionCue(sentence.text, language);
    if (hasSpanningRegressionFallback) {
      for (const clause of clauses) {
        if (SPANNING_REGRESSION_LEAD_CUES[language].test(clause.text)) {
          spanningRegressionLeadStarts.add(clause.start);
        }
      }
    }
    const terminalClause = clauses[clauses.length - 1];
    const regressionEvidence =
      regressionClauses.length > 0
        ? regressionClauses
        : hasSpanningRegressionFallback
          ? [
              {
                clause: whole,
                regressionClauseIndex: -1,
                actorOverride: terminalClause
                  ? spanningTerminalActor(
                      terminalClause,
                      profile,
                      language
                    )
                  : null
              }
            ]
          : [];
    for (const {
      clause: regressionClause,
      regressionClauseIndex,
      actorOverride
    } of regressionEvidence) {
      const target = regressionConcernTarget(
        regressionClause.text,
        language
      );
      const actor =
        actorOverride ??
        resolveNarrativeActor(
          regressionClause,
          profile,
          language,
          regressionClauseIndex > 0
            ? clauses[regressionClauseIndex - 1]
            : undefined
        );
      candidates.push(
        evidenceCandidate(
          regressionClause,
          target,
          actor,
          "none",
          "regression",
          actorDisposition(actor),
          {
            labelKey: "factRegressionLabel",
            valueKey: "factRegressionValue"
          },
          target !== "regression"
        )
      );
    }

    const services = classifyServiceSegments(clauses, profile, language);
    if (services.length === 0) continue;
    for (const service of services) {
      const serviceClause = service.segment;
      const childTargeted = serviceTargetsChild(
        serviceClause.text,
        profile,
        language
      );
      const actor = childTargeted
        ? "child"
        : resolveNarrativeActor(serviceClause, profile, language);
      const role =
        service.serviceStatus === "recommended"
          ? "professional_recommendation"
          : "other_concern";
      const caregiverOwned =
        !childTargeted &&
        (service.caregiverOwned ||
          actor === "caregiver" ||
          caregiverOwnsServiceText(serviceClause.text, language));
      const disposition = caregiverOwned
        ? "excluded"
        : service.disposition;

      candidates.push(
        evidenceCandidate(
          serviceClause,
          "therapy_service",
          actor,
          service.serviceStatus,
          role,
          disposition,
          null
        )
      );

      const speechService = service.modalities.includes("speech");
      const motorService = service.modalities.includes("motor");
      if (speechService) {
        candidates.push(
          evidenceCandidate(
            serviceClause,
            "speech",
            actor,
            service.serviceStatus,
            role,
            disposition,
            null,
            true
          )
        );
      }
      if (motorService) {
        candidates.push(
          evidenceCandidate(
            serviceClause,
            "motor",
            actor,
            service.serviceStatus,
            role,
            disposition,
            null,
            false
          )
        );
      }
      if (
        service.serviceStatus === "recommended" &&
        disposition === "supported"
      ) {
        if (speechService) {
          candidates.push(
            evidenceCandidate(
              serviceClause,
              "speech",
              actor,
              service.serviceStatus,
              "professional_recommendation",
              "supported",
              {
                labelKey: "factConcernSpeechLabel",
                valueKey: "factConcernSpeechValue"
              },
              true
            )
          );
        }
        if (motorService) {
          candidates.push(
            evidenceCandidate(
              serviceClause,
              "motor",
              actor,
              service.serviceStatus,
              "professional_recommendation",
              "supported",
              {
                labelKey: "factConcernMotorLabel",
                valueKey: "factConcernMotorValue"
              }
            )
          );
        }
      }
    }
  }

  for (const [segmentIndex, segment] of segments.entries()) {
    const actor = resolveNarrativeActor(
      segment,
      profile,
      language,
      segments[segmentIndex - 1]
    );
    const burden = FUNCTIONAL_BURDEN_CUES[language].test(segment.text);
    const pending = PENDING_EVALUATION_CUES[language].test(segment.text);
    if (burden) {
      candidates.push(
        evidenceCandidate(
          segment,
          "school_learning",
          actor,
          "none",
          "functional_burden",
          actorDisposition(actor),
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
          actor,
          "none",
          "pending_evaluation",
          actorDisposition(actor),
          {
            labelKey: "factPendingEvaluationLabel",
            valueKey: "factPendingEvaluationValue"
          }
        )
      );
    }

    const schoolPattern = concernPattern(
      "factConcernSchoolLabel",
      language
    );
    if (schoolPattern?.test(segment.text) && !burden && !pending) {
      const caregiverAccess =
        CAREGIVER_READING_CUES[language].test(segment.text);
      candidates.push(
        evidenceCandidate(
          segment,
          "school_learning",
          actor,
          "none",
          caregiverAccess
            ? "caregiver_accessibility"
            : actorEvidenceRole(actor),
          caregiverAccess ? "excluded" : actorDisposition(actor),
          {
            labelKey: "factConcernSchoolLabel",
            valueKey: "factConcernSchoolValue"
          }
        )
      );
    }

    const segmentHasService = serviceSegmentStarts.has(segment.start);
    const segmentHasRegression = hasNarrativeRegressionCue(
      segment.text,
      language
    ) || spanningRegressionLeadStarts.has(segment.start);
    const speechDifficulty =
      SPEECH_DIFFICULTY_CUES[language].test(segment.text) ||
      CONTINUING_SPEECH_DIFFICULTY_CUES[language].test(segment.text);
    const nextSegment = segments[segmentIndex + 1];
    const adjacentLimitedContext =
      nextSegment !== undefined &&
      nextSegment.sentenceStart === segment.sentenceStart &&
      ELLIPTICAL_LIMITED_LANGUAGE_CONTEXT[language].test(
        nextSegment.text
      );
    const limitedSpeech =
      actor === "child" &&
      CHILD_SAY_CUES[language].test(segment.text) &&
      (LIMITED_LANGUAGE_CONTEXT[language].test(segment.text) ||
        adjacentLimitedContext);
    const speechPattern = concernPattern(
      "factConcernSpeechLabel",
      language
    );
    const communicationDifficulty =
      LIMITED_LANGUAGE_CONTEXT[language].test(segment.text);
    const ellipticalLimitedTail =
      ELLIPTICAL_LIMITED_LANGUAGE_CONTEXT[language].test(segment.text);
    const speechMatches =
      (speechPattern?.test(segment.text) ?? false) ||
      speechDifficulty ||
      limitedSpeech ||
      communicationDifficulty ||
      CONTINUING_SPEECH_DIFFICULTY_CUES[language].test(segment.text);
    if (
      !segmentHasRegression &&
      speechMatches &&
      (!ellipticalLimitedTail || actor === "caregiver") &&
      (!segmentHasService || speechDifficulty || limitedSpeech)
    ) {
      const positiveOnly =
        POSITIVE_SPEECH_CUES[language].test(segment.text) &&
        !speechDifficulty &&
        !CONTINUING_SPEECH_DIFFICULTY_CUES[language].test(segment.text);
      candidates.push(
        evidenceCandidate(
          segment,
          "speech",
          actor,
          "none",
          positiveOnly
            ? "positive_change"
            : actorEvidenceRole(actor),
          positiveOnly ? "excluded" : actorDisposition(actor),
          {
            labelKey: "factConcernSpeechLabel",
            valueKey: "factConcernSpeechValue"
          },
          true
        )
      );
    }

    const motorDifficulty =
      MOTOR_DIFFICULTY_CUES[language].test(segment.text);
    const motorPattern = concernPattern(
      "factConcernMotorLabel",
      language
    );
    const motorMatches =
      (motorPattern?.test(segment.text) ?? false) || motorDifficulty;
    if (
      !segmentHasRegression &&
      motorMatches &&
      (!segmentHasService || motorDifficulty)
    ) {
      candidates.push(
        evidenceCandidate(
          segment,
          "motor",
          actor,
          "none",
          actorEvidenceRole(actor),
          actorDisposition(actor),
          {
            labelKey: "factConcernMotorLabel",
            valueKey: "factConcernMotorValue"
          },
          true
        )
      );
    }

    const behaviorPattern = concernPattern(
      "factConcernBehaviorLabel",
      language
    );
    if (behaviorPattern?.test(segment.text)) {
      const caregiverSelf =
        CAREGIVER_SELF_BEHAVIOR_CUES[language].test(segment.text);
      candidates.push(
        evidenceCandidate(
          segment,
          "behavior",
          actor,
          "none",
          caregiverSelf
            ? "caregiver_accessibility"
            : actorEvidenceRole(actor),
          caregiverSelf ? "excluded" : actorDisposition(actor),
          {
            labelKey: "factConcernBehaviorLabel",
            valueKey: "factConcernBehaviorValue"
          }
        )
      );
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

export function shouldRaiseFamilyRegressionFlag(
  text: string,
  profile: FamilyProfile,
  language: Language
): boolean {
  if (detectRegressionCue(text, language) === null) return false;

  return buildNarrativeCandidates(text, profile, language).some(
    ({ role, disposition }) =>
      role === "regression" && disposition === "supported"
  );
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
  const candidates = buildNarrativeCandidates(text, profile, language);
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
