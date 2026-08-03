import type { FamilyResource } from "./family-resources";
import type { DevNeedDomain, FamilyProfile } from "./types";

export type FamilyResourceIntent =
  | "early_intervention_access"
  | "therapy_access"
  | "transportation_access"
  | "developmental_evaluation"
  | "school_evaluation"
  | "school_removal"
  | "school_behavior_plan"
  | "school_dispute"
  | "waiver_planning"
  | "supported_decision_making"
  | "respite"
  | "sibling_support"
  | "recreation";

export type StructuredFamilyIntent = {
  intents: ReadonlySet<FamilyResourceIntent>;
  diagnoses: ReadonlySet<string>;
  domains: ReadonlySet<DevNeedDomain>;
  physicalDisabilityBasis: boolean;
};

const has = (text: string, pattern: RegExp): boolean => pattern.test(text);

function diagnosisBasis(text: string, profile: FamilyProfile): Set<string> {
  const basis = new Set(profile.diagnoses.map(({ label }) => label.toLowerCase()));
  const reported =
    /\b(?:diagnosed|diagnosis|diagnóstico|diagnosticad[oa])\b/i.test(text) &&
    !/\b(?:not|never|no) (?:been )?diagnosed\b|\bno (?:has|tiene) (?:a )?diagnosis\b/i.test(text);
  if (!reported) return basis;
  if (/\bautis(?:m|mo)\b/i.test(text)) basis.add("autism");
  if (/\badhd\b|\btdah\b|attention[- ]deficit/i.test(text)) basis.add("adhd");
  if (/\bdyslex(?:ia|ic)\b|\bdislexia\b/i.test(text)) basis.add("dyslexia");
  if (/\bintellectual disabilit/i.test(text)) basis.add("intellectual_disability");
  if (/\bdown syndrome\b/i.test(text)) basis.add("down_syndrome");
  if (/\bdevelopmental delay\b/i.test(text)) basis.add("developmental_delay");
  return basis;
}

function hasPhysicalDisabilityBasis(text: string, profile: FamilyProfile): boolean {
  const basis = [
    text,
    ...profile.diagnoses.flatMap(({ label, otherLabel }) => [label, otherLabel ?? ""])
  ].join(" ");
  return /\bphysical disabilit|mobility impairment|nursing facility|cerebral palsy|spina bifida\b/i.test(basis);
}

/**
 * A small, deterministic vocabulary for what the family is trying to do. It is
 * deliberately not persisted and never changes facts, diagnoses, or domains.
 */
export function deriveStructuredFamilyIntent(
  rawText: string,
  profile: FamilyProfile,
  domains: readonly DevNeedDomain[]
): StructuredFamilyIntent {
  const text = rawText.normalize("NFKC");
  const intents = new Set<FamilyResourceIntent>();

  if (
    domains.includes("early_intervention") ||
    has(text, /\bfirst steps\b|\bearly intervention\b|\bpoint of entry\b|\bbefore (?:the )?deadline\b/i)
  ) intents.add("early_intervention_access");
  if (
    has(text, /\b(?:speech|occupational|physical) therap(?:y|ist)\b|\btherapy referral\b|\bterapia\b/i) &&
    !has(text, /\balready (?:goes?|gets?|receives?|in)\b|\bcurrently (?:gets?|receives?|in)\b/i)
  ) intents.add("therapy_access");
  if (
    domains.includes("transportation") ||
    has(text, /\b(?:ride|transportation|reliable car|do not drive|don't drive|no tenemos transporte)\b/i)
  ) intents.add("transportation_access");
  if (
    has(text, /\bdevelopmental (?:evaluation|assessment|pediatric)/i) ||
    has(text, /\b(?:speech|occupational) therapy and (?:a )?developmental evaluation\b/i)
  ) intents.add("developmental_evaluation");
  if (
    has(text, /\b(?:ask(?:ing)? for|waiting for|need|want|request) (?:an? )?evaluation\b/i) ||
    has(text, /\b(?:evaluation|iep)\b.{0,30}\b504\b|\b504\b.{0,30}\b(?:evaluation|iep)\b/i)
  ) intents.add("school_evaluation");
  if (
    has(text, /\b(?:kicked out|suspend(?:ed|sion)?|expel(?:led|sion)?|remov(?:e|al|ed)|sent home|sends? him home|sends? her home|pick (?:him|her|them) up)\b/i) ||
    has(text, /\b(?:lo mandan|la mandan) a casa\b/i)
  ) intents.add("school_removal");
  if (
    has(text, /\b(?:fba|bip|behavior intervention plan|functional behavior|behaviou?r plan)\b/i) ||
    (intents.has("school_removal") && has(text, /\b(?:iep|plan|overloaded|behavior|working)\b/i))
  ) intents.add("school_behavior_plan");
  if (
    has(text, /\b(?:complaint|mediation|due process|dispute|lawyer|legal action)\b/i) ||
    (has(text, /\b(?:iep|plan|meetings?|reuniones)\b/i) &&
      has(
        text,
        /(?:\b(?:not|isn't|is not)\b|no\s+est[aá]).{0,20}(?:\bworking\b|funcionando|funciona)/i
      ))
  ) intents.add("school_dispute");
  const waiverMention = has(text, /\bwaivers?\b|\bmedicaid waiver\b/i);
  const waiverNegated = has(text, /\b(?:do not|don't|not|no) (?:need|want|ask(?:ing)? (?:about|for)) (?:a )?waivers?\b/i);
  if (domains.includes("waivers_financial") || (waiverMention && !waiverNegated)) {
    intents.add("waiver_planning");
  }
  if (has(text, /\bsupported decision[- ]making\b|\bdecision(?:es)? con apoyo\b/i)) {
    intents.add("supported_decision_making");
  }
  if (domains.includes("respite") || has(text, /\b(?:need a break|respite)\b/i)) intents.add("respite");
  if (
    domains.includes("sibling_support") ||
    has(text, /\b(?:sister|brother|sibling|herman[oa])\b.{0,35}\b(?:support|help|apoyo)\b/i)
  ) intents.add("sibling_support");
  if (domains.includes("recreation") || has(text, /\b(?:sports?|recreation|recreational|camp|activity)\b/i)) {
    intents.add("recreation");
  }

  return {
    intents,
    diagnoses: diagnosisBasis(text, profile),
    domains: new Set(domains),
    physicalDisabilityBasis: hasPhysicalDisabilityBasis(text, profile)
  };
}

const WAIVER_IDS = new Set(["michelle_p_waiver", "scl_waiver", "hcb_waiver", "child_waiver"]);
const DIAGNOSIS_SPECIFIC: Readonly<Record<string, readonly string[]>> = {
  kentucky_autism_training_center: ["autism"],
  autism_society_bluegrass: ["autism"],
  chadd_kentucky_connections: ["adhd"],
  dsack: ["down_syndrome"],
  down_syndrome_louisville: ["down_syndrome"]
};

export function resourceEligibleForIntent(
  resource: FamilyResource,
  structured: StructuredFamilyIntent,
  rawText: string
): boolean {
  const { intents, diagnoses, physicalDisabilityBasis } = structured;
  if (WAIVER_IDS.has(resource.id) && !intents.has("waiver_planning")) return false;
  if (
    resource.id === "hcb_waiver" &&
    !physicalDisabilityBasis &&
    !/\bage 65|older adult\b/i.test(rawText)
  ) return false;
  const developmentalDiagnosisBasis = [
    "autism",
    "adhd",
    "developmental_delay",
    "intellectual_disability"
  ].some((diagnosis) => diagnoses.has(diagnosis));
  if (
    resource.id === "uk_developmental_pediatrics" &&
    !intents.has("developmental_evaluation") &&
    !developmentalDiagnosisBasis
  ) return false;
  if (
    resource.id === "ocshcn" &&
    intents.has("early_intervention_access") &&
    !intents.has("developmental_evaluation")
  ) return false;
  if (resource.id === "idea_school_discipline" && !intents.has("school_removal")) return false;
  if (
    resource.id === "fba_bip_request" &&
    !intents.has("school_removal") &&
    !intents.has("school_behavior_plan")
  ) return false;
  if (resource.id === "kde_dispute_resolution" && !intents.has("school_dispute")) return false;

  const diagnosisRequirements = DIAGNOSIS_SPECIFIC[resource.id];
  if (diagnosisRequirements && !diagnosisRequirements.some((diagnosis) => diagnoses.has(diagnosis))) return false;
  return true;
}

const RESOURCE_INTENT_PRIORITY: Readonly<Partial<Record<FamilyResourceIntent, readonly string[]>>> = {
  early_intervention_access: [
    "first_steps_statewide",
    "kde_age_three_transition",
    "help_me_grow_ky"
  ],
  therapy_access: ["ocshcn", "uk_developmental_pediatrics", "kentucky_211", "kynect_resources"],
  transportation_access: ["lklp_transportation_region_13", "kentucky_211", "kynect_resources"],
  developmental_evaluation: ["uk_developmental_pediatrics", "ocshcn", "help_me_grow_ky"],
  school_evaluation: ["kde_evaluation_request", "kde_parent_toolbox", "ky_spin", "lda_kentucky"],
  school_removal: ["idea_school_discipline", "fba_bip_request", "kde_dispute_resolution"],
  school_behavior_plan: ["fba_bip_request", "idea_school_discipline", "kde_parent_toolbox"],
  school_dispute: ["kde_dispute_resolution", "kentucky_protection_advocacy"],
  waiver_planning: ["scl_waiver", "michelle_p_waiver", "child_waiver", "stable_kentucky"],
  supported_decision_making: ["my_choice_kentucky"],
  sibling_support: ["sibling_support_project", "ky_spin"],
  recreation: ["kentucky_211", "kynect_resources"],
  respite: ["ky_spin", "kentucky_211", "kynect_resources"]
};

function explicitPriority(resourceId: string, structured: StructuredFamilyIntent): number {
  let best = Number.POSITIVE_INFINITY;
  for (const intent of structured.intents) {
    const position = RESOURCE_INTENT_PRIORITY[intent]?.indexOf(resourceId) ?? -1;
    if (position >= 0) best = Math.min(best, position);
  }
  return best;
}

export function intentScore(
  resource: FamilyResource,
  structured: StructuredFamilyIntent,
  county: string
): number {
  const normalizedCounty = county.trim().replace(/\s+County$/i, "");
  const countyScore = resource.counties.includes(normalizedCounty) ? -1_000 : 0;
  const priority = explicitPriority(resource.id, structured);
  let explicitScore = Number.isFinite(priority) ? -500 + priority : 0;
  if (structured.intents.has("supported_decision_making") && resource.id === "my_choice_kentucky") {
    explicitScore = -950;
  } else if (structured.intents.has("sibling_support") && resource.id === "sibling_support_project") {
    explicitScore = -950;
  } else if (structured.intents.has("school_removal")) {
    const removalOrder = ["idea_school_discipline", "fba_bip_request", "kde_dispute_resolution"];
    const removalPosition = removalOrder.indexOf(resource.id);
    if (removalPosition >= 0) explicitScore = -900 + removalPosition;
  } else if (structured.intents.has("school_evaluation")) {
    const evaluationOrder = ["kde_evaluation_request", "kde_parent_toolbox", "ky_spin", "lda_kentucky"];
    const evaluationPosition = evaluationOrder.indexOf(resource.id);
    if (evaluationPosition >= 0) explicitScore = -900 + evaluationPosition;
  }
  const pointOfEntryScore =
    structured.intents.has("early_intervention_access") &&
    resource.id.startsWith("first_steps_") &&
    resource.id !== "first_steps_statewide"
      ? -700
      : 0;
  return countyScore + pointOfEntryScore + explicitScore;
}

export function actionDomainForIntent(
  resource: FamilyResource,
  originalDomain: DevNeedDomain,
  structured: StructuredFamilyIntent
): DevNeedDomain {
  const direct: ReadonlyArray<[FamilyResourceIntent, DevNeedDomain]> = [
    ["sibling_support", "sibling_support"],
    ["recreation", "recreation"],
    ["transportation_access", "transportation"],
    ["supported_decision_making", "future_planning"],
    ["waiver_planning", "waivers_financial"],
    ["respite", "respite"],
    ["school_evaluation", "school_iep"],
    ["school_removal", "school_iep"],
    ["therapy_access", "therapies"],
    ["developmental_evaluation", "diagnosis_education"],
    ["early_intervention_access", "early_intervention"]
  ];
  for (const [intent, domain] of direct) {
    if (structured.intents.has(intent) && resource.domains.includes(domain)) return domain;
  }
  return originalDomain;
}

export type FamilyResourceServiceArea =
  | { kind: "county"; county: string }
  | { kind: "statewide" };

export function familyResourceServiceArea(
  resource: FamilyResource,
  county: string
): FamilyResourceServiceArea {
  const normalizedCounty = county.trim().replace(/\s+County$/i, "");
  return resource.counties.includes(normalizedCounty)
    ? { kind: "county", county: normalizedCounty }
    : { kind: "statewide" };
}
