import { classifyCrisis, classifySafety } from "./safety";
import { screenSocialEmergency } from "./social-screen";
import { CLASSIFIER_HREFS, mockRouteClassifier, type RouteClassifier } from "./route-classifier";
import type { Language } from "@/i18n/strings";
import type { AppState } from "./types";

export type FrontDoorRoute =
  | { kind: "coach"; ask: string; reason: "safety" | "no_match" }
  | { kind: "navigate"; href: string; label: string };

// Labels for routes reached via the classifier stage. Kept in lockstep with the
// menu route catalog by front-door.test.ts, so a renamed route can't silently
// produce a dead classifier destination.
const ROUTE_LABELS: Record<string, string> = {
  "/numbers": "My Numbers",
  "/glucose": "My Blood Sugar",
  "/medicines": "My Medicines",
  "/food": "Food",
  "/plan": "My Plan",
  "/visits": "My Visits",
  "/chat": "Coach",
  "/checkin": "Check-ins & screenings",
  "/checkin/phq9": "Mood check-in",
  "/support": "Support",
  "/ladder": "Ladder — your child's development",
  "/intake": "Add Instructions",
  "/privacy": "Privacy",
  "/screening": "Eye Check",
  "/learn/retinopathy": "Diabetic Eye Disease"
};

const CLASSIFIER_CONFIDENCE_FLOOR = 0.75;

type NavRule = { test: RegExp; href: string; label: string };

const FAMILY_RELATIONSHIP_EN =
  /\b(?:help|support|resources?|services?)(?:\s+(?:for|with))?\s+(?:my|our)\s+(?:child|daughter|son|kid)\b/;
const FAMILY_RELATIONSHIP_ES =
  /\b(?:ayuda|apoyo|recursos?|servicios?)(?:\s+(?:para|con|a))?\s+(?:mi|nuestro|nuestra)\s+(?:hij[oa]|niñ[oa])\b/;
const FAMILY_DEVELOPMENT_EN =
  /\b(?:development(?:al)?|diagnos(?:is|es|ed)|iep|arc|therap(?:y|ies)|speech|language|autism|adhd|dyslexia|early intervention)\b/;
const FAMILY_DEVELOPMENT_ES =
  /\b(?:desarrollo|diagn[oó]stico|iep|arc|terapia|habla|lenguaje|autismo|tdah|dislexia|intervenci[oó]n temprana)\b/;
const FAMILY_RESOURCE_SEARCH_EN = /\b(?:find|need|looking for)\b.*\bresources?\b/;
const FAMILY_RESOURCE_SEARCH_ES = /\b(?:encontrar|buscar|necesito)\b.*\brecursos?\b/;
const FAMILY_ORDINARY_CONTEXT_EN = /\b(?:homework|schoolwork|soccer|football|baseball|basketball|sports?|practice|game|activities?)\b/;
const FAMILY_ORDINARY_CONTEXT_ES = /\b(?:tarea|f[uú]tbol|b[eé]isbol|baloncesto|deportes?|pr[aá]ctica|juego|actividades?)\b/;
const FAMILY_SDOH_EN = /\b(?:rent|housing|utilit(?:y|ies)|food stamps?|electric(?:ity)? bill|water bill)\b/;
const FAMILY_SDOH_ES = /\b(?:renta|alquiler|vivienda|servicios p[uú]blicos|facturas?|luz|agua|comida)\b/;

// Verb rules land the patient on the real feature screen (chat proposes, the
// form commits) — never a silent write. Checked before the broader nav lexicon.
const VERB_RULES: NavRule[] = [
  { test: /\b(help|support|resources?|services?)\b\s+(for|with)\s+(my|our)\s+(child|daughter|son|kid)\b/, href: "/ladder", label: "Ladder — your child's development" },
  { test: /\b(log|record|add|enter|save|track)\b.*\b(bp|blood pressure|reading|readings|systolic|pressure)\b/, href: "/numbers", label: "Log a blood pressure reading" },
  { test: /\b(log|record|add|enter|save|track|check)\b.*\b(blood sugar|glucose|a1c|sugar)\b/, href: "/glucose", label: "Log a blood sugar reading" },
  { test: /\b(took|take|taken|log|logged|mark)\b.*\b(medicine|medication|meds?|pill|pills|dose)\b/, href: "/medicines", label: "Your medicines" },
  { test: /\b(learn|read|understand)\b.*\b(diabetic eye disease|retinopathy)\b/, href: "/learn/retinopathy", label: "Learn about diabetic eye disease" },
  { test: /\b(book|schedule|find|get)\b.*\b(eye (check|exam|screening|photo|test)|screening|retinopathy)\b/, href: "/screening", label: "Book an eye screening" }
];

const NAV_LEXICON: NavRule[] = [
  { test: /\b(family navigator|(?:help|support|resources?|services?) (?:for|with) (?:my|our) (?:child|daughter|son|kid))\b/, href: "/ladder", label: "Ladder — your child's development" },
  { test: /\b(numbers|blood pressure|readings)\b/, href: "/numbers", label: "My Numbers" },
  { test: /\b(blood sugar|glucose|a1c|glucometer)\b/, href: "/glucose", label: "My Blood Sugar" },
  { test: /\b(medicines?|medications?|pills?|meds)\b/, href: "/medicines", label: "My Medicines" },
  { test: /\b(care )?plan\b/, href: "/plan", label: "My Plan" },
  { test: /\b(visits?|appointments?)\b/, href: "/visits", label: "My Visits" },
  { test: /\b(food|meals?|scan)\b/, href: "/food", label: "Food" },
  { test: /\b(diabetic eye disease|retinopathy)\b/, href: "/learn/retinopathy", label: "Diabetic Eye Disease" },
  { test: /\b(check ?in|mood)\b/, href: "/checkin/phq9", label: "Mood check-in" },
  { test: /\b(support|resources?|rent|utilities|food stamps)\b/, href: "/support", label: "Support" },
  { test: /\b(privacy|my data)\b/, href: "/privacy", label: "Privacy" },
  { test: /\b(add instructions|instructions|paste)\b/, href: "/intake", label: "Add Instructions" },
  { test: /\b(eye check|eye exam|eye screening|eye photo|eyes?|vision|screening)\b/, href: "/screening", label: "Eye Check" },
  { test: /\b(health check|wellness check|questionnaire)\b/, href: "/checkin", label: "Check-ins & screenings" }
];

const NAV_VERB = /\b(show|open|see|view|go to|take me to|where'?s|where is|bring up|pull up)\b/;

// Spanish equivalents. The es verb/nav lexicon is deterministic like the English
// one; fuzzier es phrasings fall through to the multilingual live LLM classifier
// (the English-synonym mock is skipped for es).
const VERB_RULES_ES: NavRule[] = [
  { test: /\b(ayuda|apoyo|recursos?|servicios?)\b\s+(para|con)\s+(mi|nuestro|nuestra)\s+(hij[oa]|niñ[oa])\b/, href: "/ladder", label: "Ladder — el desarrollo de tu hijo o hija" },
  { test: /\b(registr|anot|apunt|guard|agreg)\w*\b.*\b(presi[oó]n|lectura|lecturas|sist[oó]lica)\b/, href: "/numbers", label: "Registrar una lectura de presión" },
  { test: /\b(registr|anot|apunt|guard|agreg)\w*\b.*\b(az[uú]car|glucosa)\b/, href: "/glucose", label: "Registrar tu azúcar en sangre" },
  { test: /\b(tom[eé]|tomad|tom[oó]|registr)\w*\b.*\b(medicina|medicamento|medicinas|medicamentos|pastilla|pastillas|p[ií]ldora|dosis)\b/, href: "/medicines", label: "Tus medicinas" },
  { test: /\b(aprend|leer|lee|entend)\w*\b.*\b(retinopat(?:ia|ía)|enfermedad diab(?:e|é)tica del ojo)\b/, href: "/learn/retinopathy", label: "Aprender sobre la retinopatía diabética" },
  { test: /\b(reserv|agend|busc|program)\w*\b.*\b(ojos?|vista|retinopat[ií]a|examen de ojos)\b/, href: "/screening", label: "Reservar un examen de ojos" }
];

const NAV_LEXICON_ES: NavRule[] = [
  { test: /\b(navegador para familias|(?:ayuda|apoyo|recursos?|servicios?) (?:para|con) (?:mi|nuestro|nuestra) (?:hij[oa]|niñ[oa]))\b/, href: "/ladder", label: "Ladder — el desarrollo de tu hijo o hija" },
  { test: /\b(n[uú]meros|presi[oó]n|lecturas?)\b/, href: "/numbers", label: "Mis Números" },
  { test: /\b(az[uú]car|glucosa)\b/, href: "/glucose", label: "Mi Azúcar en Sangre" },
  { test: /\b(medicinas?|medicamentos?|pastillas?|dosis)\b/, href: "/medicines", label: "Mis Medicinas" },
  { test: /\bplan\b/, href: "/plan", label: "Mi Plan" },
  { test: /\b(visitas?|citas?)\b/, href: "/visits", label: "Mis Visitas" },
  { test: /\b(comidas?|comer)\b/, href: "/food", label: "Comida" },
  { test: /\b(retinopat(?:ia|ía)|enfermedad diab(?:e|é)tica del ojo)\b/, href: "/learn/retinopathy", label: "Retinopatía diabética" },
  // Eye and health checks belong to their routes below, not the mood check-in.
  { test: /\b(chequeo(?!\s+de\s+(?:ojos|salud))|[aá]nimo)\b/, href: "/checkin/phq9", label: "Chequeo de ánimo" },
  { test: /\b(apoyo|recursos?|renta|servicios)\b/, href: "/support", label: "Apoyo" },
  { test: /\b(privacidad|mis datos)\b/, href: "/privacy", label: "Privacidad" },
  { test: /\binstrucciones\b/, href: "/intake", label: "Agregar Instrucciones" },
  { test: /\b(ojos?|vista)\b/, href: "/screening", label: "Chequeo de Ojos" },
  { test: /\bchequeo de salud\b/, href: "/checkin", label: "Chequeos y evaluaciones" }
];

const NAV_VERB_ES = /\b(mostrar|mu[eé]strame|abrir|abre|ver|ir a|ll[eé]vame a|d[oó]nde est[aá]|d[oó]nde)\b/;

type Lexicon = { verbRules: NavRule[]; navLexicon: NavRule[]; navVerb: RegExp; useMock: boolean };

const LEXICONS: Record<Language, Lexicon> = {
  en: { verbRules: VERB_RULES, navLexicon: NAV_LEXICON, navVerb: NAV_VERB, useMock: true },
  es: { verbRules: VERB_RULES_ES, navLexicon: NAV_LEXICON_ES, navVerb: NAV_VERB_ES, useMock: false }
};

// Deterministic, safety-first front-door router. Order is load-bearing: any
// utterance that trips crisis / urgent-symptom / dangerous-reading / med-change
// / social-emergency screening is handed to the Coach (which re-runs the full
// safety gate and shows crisis UI) and can NEVER be routed to a feature screen.
// A "clean" utterance is eligible for that language's verb/nav lexicon; write
// verbs land on the real form (no silent write). The English-synonym mock
// classifier runs only for English; Spanish defers fuzzier phrasings to the
// multilingual live LLM classifier in the caller. No LLM is involved here.
export function decideFrontDoor(
  utterance: string,
  state: AppState,
  classifier: RouteClassifier = mockRouteClassifier
): FrontDoorRoute {
  const text = utterance.trim();

  if (classifyCrisis(text).matched || classifySafety(text).level !== "allowed" || screenSocialEmergency(text)) {
    return { kind: "coach", ask: text, reason: "safety" };
  }

  const language = state.patient.language;
  const lower = text.toLowerCase();
  const familyRelationship =
    language === "es" ? FAMILY_RELATIONSHIP_ES.test(lower) : FAMILY_RELATIONSHIP_EN.test(lower);

  if (familyRelationship && (language === "es" ? FAMILY_SDOH_ES.test(lower) : FAMILY_SDOH_EN.test(lower))) {
    return { kind: "navigate", href: "/support", label: language === "es" ? "Apoyo" : "Support" };
  }

  if (
    familyRelationship &&
    (language === "es" ? FAMILY_ORDINARY_CONTEXT_ES.test(lower) : FAMILY_ORDINARY_CONTEXT_EN.test(lower))
  ) {
    return { kind: "coach", ask: text, reason: "no_match" };
  }

  const explicitDevelopmentalIntent =
    language === "es"
      ? FAMILY_DEVELOPMENT_ES.test(lower) || FAMILY_RESOURCE_SEARCH_ES.test(lower)
      : FAMILY_DEVELOPMENT_EN.test(lower) || FAMILY_RESOURCE_SEARCH_EN.test(lower);
  if (familyRelationship && explicitDevelopmentalIntent) {
    return {
      kind: "navigate",
      href: "/ladder",
      label: language === "es" ? "Ladder — el desarrollo de tu hijo o hija" : "Ladder — your child's development"
    };
  }

  const lex = LEXICONS[language];

  for (const rule of lex.verbRules) {
    if (rule.test.test(lower)) {
      return { kind: "navigate", href: rule.href, label: rule.label };
    }
  }

  const isShort = lower.split(/\s+/).filter(Boolean).length <= 3;
  if (lex.navVerb.test(lower) || isShort) {
    for (const rule of lex.navLexicon) {
      if (rule.test.test(lower)) {
        return { kind: "navigate", href: rule.href, label: rule.label };
      }
    }
  }

  // Final deterministic stage: the constrained mock classifier catches fuzzier
  // English phrasings the lexicon missed. It can only navigate or defer — never
  // write — and we act on it only above the confidence floor.
  if (lex.useMock) {
    const decision = classifier.classify(text, CLASSIFIER_HREFS);
    if (decision.kind === "navigate" && decision.confidence >= CLASSIFIER_CONFIDENCE_FLOOR) {
      return { kind: "navigate", href: decision.href, label: ROUTE_LABELS[decision.href] ?? decision.href };
    }
  }

  // No deterministic route; the caller may refine with the live LLM classifier
  // (safety has already cleared), else it reaches the Coach.
  return { kind: "coach", ask: text, reason: "no_match" };
}
