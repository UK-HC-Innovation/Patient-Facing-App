export type SourceFactKind =
  | "care_plan"
  | "medication"
  | "reading"
  | "extracted_fact"
  | "context_item"
  | "goal"
  | "meal_log"
  | "screening_result";

export type SourceFactConfidence =
  | "confirmed"
  | "patient_reported"
  | "imported"
  | "inferred"
  | "needs_review";

// A trimmed source fact: the grounding verifier only reads id/label/value, but
// the provenance fields travel with each fact for future surfacing.
export interface SourceFact {
  id: string;
  label: string;
  value: string;
  sourceKind: SourceFactKind;
  sourceName: string;
  confidence: SourceFactConfidence;
  patientConfirmed: boolean;
  effectiveDate: string;
}

export type GroundingFindingCode =
  | "missing_citation"
  | "unknown_citation"
  | "numeric_mismatch"
  | "unsupported_result_claim"
  | "diagnosis_claim"
  | "medication_change"
  | "dose_calculation"
  | "clearance_claim"
  // Dormant: retained for API parity with the source module; never emitted here.
  | "unsupported_claim";

export interface GroundingFinding {
  code: GroundingFindingCode;
  severity: "block";
  status: "blocked";
  message: string;
  reason: string;
}

export interface QuantitativeClaim {
  kind: "a1c";
  value: string;
}

export interface BloodPressureClaim {
  systolic: string;
  diastolic: string;
}

export interface GlucoseClaim {
  value: string;
}

export interface GroundingVerificationInput {
  answer: string;
  sourceFacts: SourceFact[];
  citationIds?: string[];
}

export interface GroundingVerificationResult {
  allowed: boolean;
  findings: GroundingFinding[];
  blockedReasons: string[];
  supportedSourceFactIds: string[];
}

// Clinical-adjacent triggers are intentionally conservative: generic words like
// "medication" are excluded (only specific drug names count) so a legitimate
// "I see multiple medications in your plan" answer is not treated as an
// uncited clinical claim.
const CLINICAL_ADJACENT_PATTERNS = [
  /\ba1c\b/i,
  /\bblood\s+sugar\b/i,
  /\bblood\s+pressure\b/i,
  /\bbp\b/i,
  /\breadings?\b/i,
  /\bcall\s+threshold\b/i,
  /\b(?:lisinopril|amlodipine|metformin|insulin|losartan|hydrochlorothiazide|hctz)\b/i
];

const DIAGNOSIS_CLAIM_PATTERNS = [
  /\byou\s+(?:definitely\s+)?have\s+(?:hypertension|high\s+blood\s+pressure|diabetes|kidney\s+disease)\b/i,
  /\byou\s+do\s+not\s+have\s+(?:hypertension|high\s+blood\s+pressure|diabetes|kidney\s+disease)\b/i,
  /\byou\s+are\s+diagnosed\s+with\b/i,
  /\bi\s+diagnos(?:e|ed)\b/i
];

// Conservative medication-change shapes with local drug names. There is
// deliberately NO "change the dose" variant: the mock why-mode answer embeds the
// safety note "Do not stop or change the dose…", which must keep passing.
const MEDICATION_CHANGE_PATTERNS = [
  /\b(?:stop|start|change|lower|raise|increase|decrease)\s+(?:your\s+)?(?:lisinopril|amlodipine|metformin|insulin|medicine|medication|dose)\b/i,
  /\byou\s+should\s+(?:stop|start|change|lower|raise|increase|decrease)\b/i,
  /\btake\s+\d+(?:\.\d+)?\s*(?:mg|units?)\b/i
];

// Photo-derived carb numbers must never become insulin arithmetic. The anchor is dose math
// inside ONE sentence -- an insulin term, a computation verb, and a digit -- never proximity
// to a bare "for". That is what lets the hedge this app prints itself ("Never use them for
// insulin math; follow your care team's plan") and the mock safety note both keep passing.
const INSULIN_TERM = /\b(?:insulin|insulina|bolus|bolo)\b/i;
const DOSE_COMPUTE_VERB =
  /\b(?:calcul\w+|comput\w+|figure\s+out|work\s+out|cover\w*|cubr\w+|divid\w+|multipl\w+)\b/i;
const CARB_RATIO_TERM =
  /\b(?:insulin[-\s]?to[-\s]?carb(?:ohydrate)?|carb(?:ohydrate)?|carbohidratos?)[-\s](?:ratio|raz[oó]n)\b|\braz[oó]n\s+de\s+carbohidratos\b/i;

function splitSentences(answer: string): string[] {
  return answer.split(/(?<=[.!?;])\s+|\n+/);
}

/** Dose-calculation help, in either language. Stated doses are already blocked upstream. */
export function containsDoseCalculationHelp(answer: string): boolean {
  return splitSentences(answer).some((sentence) => {
    if (!/\d/.test(sentence)) {
      return false;
    }
    if (CARB_RATIO_TERM.test(sentence)) {
      return true;
    }
    return INSULIN_TERM.test(sentence) && DOSE_COMPUTE_VERB.test(sentence);
  });
}

// Ingredient recall from a photo is wrong about a third of the time, so the coach never
// clears a food for an allergy or a child. Shape-anchored, not keyword-anchored, so a plain
// nutrition statement -- "this is high in peanuts" -- still passes.
const CLEARANCE_CLAIM_PATTERNS = [
  /\b(?:safe|fine|okay|ok)\s+(?:for|with)\s+(?:your|his|her|their|the)\s+[\w\s-]{0,30}\b(?:allerg\w+|celiac|coeliac|intolerance)\b/i,
  /\b(?:safe|fine|okay|ok)\s+(?:for|to\s+give)\s+(?:your|a|his|her|their)\s+(?:child|kid|son|daughter|baby|toddler|\d+[-\s]?year[-\s]?old)\b/i,
  /\b(?:your|his|her|their)\s+(?:child|kid|son|daughter|baby|toddler|\d+[-\s]?year[-\s]?old)\s+(?:can|may|could)\s+(?:safely\s+)?(?:eat|have|drink|try)\b/i,
  /\b(?:does\s+not|does\s?n['’]?t|will\s+not|wo\s?n['’]?t)\s+contain\s+(?:any\s+)?(?:peanut|tree\s*nut|nut|gluten|dairy|milk|egg|soy|shellfish|wheat|sesame)\w*\b/i,
  /\b(?:seguro|segura|est[aá]\s+bien|no\s+hay\s+problema)\s+para\s+(?:su|tu)\s+[\w\s-]{0,30}\b(?:alergia|celiaqu[ií]a|intolerancia)\b/i,
  /\b(?:su|tu)\s+(?:hij[oa]|ni[ñn][oa]|beb[eé])\s+(?:puede|podr[ií]a)\s+(?:comer|tomar|probar)\b/i
];

export function containsClearanceClaim(answer: string): boolean {
  return CLEARANCE_CLAIM_PATTERNS.some((pattern) => pattern.test(answer));
}

const NORMAL_RESULT_PATTERNS = [
  /\b(?:reading|readings|blood\s+pressure|bp)\s+(?:came\s+back|is|are|was|were)\s+(?:normal|fine|healthy|in\s+range|great|perfect)\b/i,
  /\bcame\s+back\s+normal\b/i
];

export function containsClinicalAdjacentClaim(answer: string): boolean {
  return CLINICAL_ADJACENT_PATTERNS.some((pattern) => pattern.test(answer));
}

export function extractQuantitativeClaims(answer: string): QuantitativeClaim[] {
  const claims: QuantitativeClaim[] = [];
  const a1cPattern = /\bA1C\s+(?:is|of|was)\s+(\d+(?:\.\d+)?)%?/gi;

  for (const match of answer.matchAll(a1cPattern)) {
    const value = match[1];
    if (value) {
      claims.push({ kind: "a1c", value });
    }
  }

  return claims;
}

export function extractBloodPressureClaims(answer: string): BloodPressureClaim[] {
  const claims: BloodPressureClaim[] = [];
  const bpPattern = /\b(?:blood\s+pressure|bp|reading)\s*(?:is|was|of|at)?\s*(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})\b/gi;

  for (const match of answer.matchAll(bpPattern)) {
    if (match[1] && match[2]) {
      claims.push({ systolic: match[1], diastolic: match[2] });
    }
  }

  return claims;
}

// Requires a "blood sugar" / "glucose" prefix (never a bare "sugar"), so a food
// answer that mentions "65 g of added sugar" is not misread as a glucose claim.
export function extractGlucoseClaims(answer: string): GlucoseClaim[] {
  const claims: GlucoseClaim[] = [];
  const glucosePattern = /\b(?:blood\s+sugar|glucose)\s*(?:is|was|of|at|reading|:)?\s*(\d{2,3})\b/gi;

  for (const match of answer.matchAll(glucosePattern)) {
    if (match[1]) {
      claims.push({ value: match[1] });
    }
  }

  return claims;
}

function normalizeText(value: string): string {
  return value.toLowerCase();
}

function hasCitedSupport(citedFacts: SourceFact[], pattern: RegExp): boolean {
  return citedFacts.some((fact) => pattern.test(`${fact.label} ${fact.value}`));
}

function sourceA1cValues(citedFacts: SourceFact[]): number[] {
  return citedFacts.flatMap((fact) => {
    if (!/a1c/i.test(`${fact.label} ${fact.value}`)) return [];

    const match = fact.value.match(/(\d+(?:\.\d+)?)/);
    return match ? [Number(match[1])] : [];
  });
}

function citedReadingPairs(citedFacts: SourceFact[]): Array<[number, number]> {
  return citedFacts.flatMap((fact) => {
    if (fact.sourceKind !== "reading") return [];
    const match = fact.value.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
    return match ? [[Number(match[1]), Number(match[2])] as [number, number]] : [];
  });
}

function citedGlucoseValues(citedFacts: SourceFact[]): number[] {
  return citedFacts.flatMap((fact) => {
    const text = `${fact.label} ${fact.value}`;
    if (!/mg\/?dl|glucose|blood\s+sugar/i.test(text)) return [];
    const match = fact.value.match(/\b(\d{2,3})\b/);
    return match ? [Number(match[1])] : [];
  });
}

function valuesMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.05;
}

function finding(code: GroundingFindingCode, reason: string, message: string): GroundingFinding {
  return {
    code,
    severity: "block",
    status: "blocked",
    reason,
    message
  };
}

export function verifyGrounding(input: GroundingVerificationInput): GroundingVerificationResult {
  const citationIds = input.citationIds ?? input.sourceFacts.map((fact) => fact.id);
  const citedFacts = input.sourceFacts.filter((fact) => citationIds.includes(fact.id));
  const findings: GroundingFinding[] = [];
  const answer = normalizeText(input.answer);

  if (containsClinicalAdjacentClaim(input.answer) && citedFacts.length === 0) {
    findings.push(
      finding(
        "missing_citation",
        "clinical_adjacent_claim_without_sources",
        "Clinical-adjacent claims require trusted source facts."
      )
    );
  }

  const missingCitationIds = citationIds.filter(
    (citationId) => citationId.length > 0 && !input.sourceFacts.some((fact) => fact.id === citationId)
  );
  if (missingCitationIds.length > 0) {
    findings.push(
      finding(
        "unknown_citation",
        `unknown_citation:${missingCitationIds.join(",")}`,
        `Unknown citation ids: ${missingCitationIds.join(", ")}`
      )
    );
  }

  if (DIAGNOSIS_CLAIM_PATTERNS.some((pattern) => pattern.test(input.answer))) {
    findings.push(
      finding("diagnosis_claim", "diagnosis_claim", "The coach cannot diagnose a condition.")
    );
  }

  if (MEDICATION_CHANGE_PATTERNS.some((pattern) => pattern.test(input.answer))) {
    findings.push(
      finding(
        "medication_change",
        "medication_change_claim",
        "The coach cannot recommend medication or dose changes."
      )
    );
  }

  if (containsDoseCalculationHelp(input.answer)) {
    findings.push(
      finding(
        "dose_calculation",
        "insulin_dose_calculation",
        "The coach cannot help work out an insulin dose."
      )
    );
  }

  if (containsClearanceClaim(input.answer)) {
    findings.push(
      finding(
        "clearance_claim",
        "allergy_or_child_clearance",
        "The coach cannot clear a food for an allergy or for a child."
      )
    );
  }

  if (NORMAL_RESULT_PATTERNS.some((pattern) => pattern.test(input.answer))) {
    const hasNormalResultSupport = hasCitedSupport(citedFacts, /\bnormal\b|\bin\s+range\b|\bfine\b/i);
    if (!hasNormalResultSupport) {
      findings.push(
        finding(
          "unsupported_result_claim",
          "unsupported_normal_result_claim",
          "A normal-reading claim must be supported by a cited result fact."
        )
      );
    }
  }

  for (const claim of extractQuantitativeClaims(input.answer)) {
    const claimValue = Number(claim.value);
    const sourceValues = sourceA1cValues(citedFacts);
    if (!sourceValues.some((value) => valuesMatch(value, claimValue))) {
      findings.push(
        finding(
          "numeric_mismatch",
          `unsupported_numeric_claim:${claim.kind}:${claim.value}`,
          `Claimed ${claim.kind} ${claim.value} does not match cited source facts.`
        )
      );
    }
  }

  const readingPairs = citedReadingPairs(citedFacts);
  for (const claim of extractBloodPressureClaims(input.answer)) {
    const systolic = Number(claim.systolic);
    const diastolic = Number(claim.diastolic);
    const matched = readingPairs.some(([s, d]) => s === systolic && d === diastolic);
    if (!matched) {
      findings.push(
        finding(
          "numeric_mismatch",
          `unsupported_numeric_claim:blood_pressure:${claim.systolic}/${claim.diastolic}`,
          `Claimed blood pressure ${claim.systolic}/${claim.diastolic} does not match a cited reading.`
        )
      );
    }
  }

  const glucoseValues = citedGlucoseValues(citedFacts);
  for (const claim of extractGlucoseClaims(input.answer)) {
    const claimValue = Number(claim.value);
    if (!glucoseValues.some((value) => value === claimValue)) {
      findings.push(
        finding(
          "numeric_mismatch",
          `unsupported_numeric_claim:glucose:${claim.value}`,
          `Claimed blood sugar ${claim.value} does not match a cited reading.`
        )
      );
    }
  }

  const claimsDiabetes = citedFacts.length > 0 && /type\s+2\s+diabetes|diabetes\s+diagnos/.test(answer);
  if (claimsDiabetes && !hasCitedSupport(citedFacts, /diabetes|blood\s+sugar|a1c|metformin/i)) {
    findings.push(
      finding(
        "missing_citation",
        "unsupported_diabetes_claim",
        "The diabetes claim is not supported by cited facts."
      )
    );
  }

  return {
    allowed: findings.length === 0,
    findings,
    blockedReasons: findings.map((item) => item.reason),
    supportedSourceFactIds: citedFacts.map((fact) => fact.id)
  };
}
