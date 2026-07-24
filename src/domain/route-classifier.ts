// Models the constrained LLM route classifier that runs only after the
// deterministic stages miss. The crucial property is structural: RouteDecision
// has NO write/action variant, so — exactly like the function schema a real LLM
// would be given — this stage is INCAPABLE of mutating the clinical record. The
// worst a mis-route can do is open the wrong screen or defer to the Coach (which
// re-runs the full safety gate). The implementation here is a deterministic mock
// standing in for the model, in the same spirit as MockHealthAiProvider.
export type RouteDecision =
  | { kind: "navigate"; href: string; confidence: number }
  | { kind: "coach"; confidence: number }
  | { kind: "clarify"; candidates: string[]; confidence: number };

export interface RouteClassifier {
  classify(utterance: string, allowedHrefs: readonly string[]): RouteDecision;
}

const ROUTE_SYNONYMS: Record<string, string[]> = {
  "/numbers": ["blood pressure", "bp", "pressure", "reading", "readings", "vitals", "numbers"],
  "/glucose": ["blood sugar", "glucose", "a1c", "glucometer", "fingerstick", "sugar level"],
  "/medicines": ["medicine", "medication", "meds", "pill", "pills", "prescription", "prescriptions", "dose", "doses"],
  "/food": ["food", "eat", "eating", "meal", "meals", "diet", "nutrition", "snack"],
  "/plan": ["care plan", "my plan", "goals"],
  "/visits": ["visit", "visits", "appointment", "appointments", "checkup"],
  "/chat": ["coach"],
  "/checkin": ["screening hub", "check-in history", "health check", "wellness check", "questionnaire"],
  "/checkin/phq9": ["mood", "check in", "check-in", "how i feel", "how i'm feeling"],
  "/support": ["support", "resource", "resources", "rent", "housing", "utilities", "food stamps"],
  "/family": [
    "ladder",
    "family navigator",
    "help for my daughter",
    "help for my son",
    "help for my child",
    "support for my daughter",
    "support for my son",
    "support for my child",
    "resources for my daughter",
    "resources for my son",
    "resources for my child",
    "developmental resources for my kid"
  ],
  "/intake": ["add instructions", "paste", "upload instructions"],
  "/privacy": ["privacy", "my data", "delete my", "export my", "download my"],
  "/screening": ["eye", "eyes", "eye check", "eye exam", "eye screening", "eye photo", "vision check", "eye doctor"],
  "/learn/retinopathy": ["diabetic eye disease", "retinopathy", "learn retinopathy", "eye disease"]
};

export const CLASSIFIER_HREFS: readonly string[] = Object.keys(ROUTE_SYNONYMS);

const QUESTION_START = /^(why|what|how|should|could|would|does|is|are|when|do)\b/;
const CONCERN = /\b(confus|understand|worried|worry|scared|nervous|explain)/;
const ENGLISH_CAREGIVER_RELATIONSHIP =
  /\b(?:help|support|resources?|services?)\s+(?:for|with)\s+my\s+(?:child|daughter|son|kid)\b/;
const ENGLISH_CAREGIVER_SDOH =
  /\b(?:rent|housing|utilit(?:y|ies)|food stamps?|electric(?:ity)? bill|water bill)\b/;

export const mockRouteClassifier: RouteClassifier = {
  classify(utterance, allowedHrefs) {
    const text = utterance.toLowerCase().trim();

    // Deliberately conservative: a question or an expression of concern belongs
    // with the Coach, not a feature screen.
    if (QUESTION_START.test(text) || CONCERN.test(text) || text.endsWith("?")) {
      return { kind: "coach", confidence: 0.3 };
    }

    if (ENGLISH_CAREGIVER_RELATIONSHIP.test(text)) {
      if (ENGLISH_CAREGIVER_SDOH.test(text) && allowedHrefs.includes("/support")) {
        return { kind: "navigate", href: "/support", confidence: 0.8 };
      }
      if (allowedHrefs.includes("/family")) {
        return { kind: "navigate", href: "/family", confidence: 0.8 };
      }
    }

    if (text === "screening" && allowedHrefs.includes("/screening")) {
      return { kind: "navigate", href: "/screening", confidence: 0.8 };
    }

    const matches = allowedHrefs
      .map((href) => ({ href, score: (ROUTE_SYNONYMS[href] ?? []).filter((syn) => text.includes(syn)).length }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    if (matches.length === 0) {
      return { kind: "coach", confidence: 0.3 };
    }

    if (matches.length > 1 && matches[1].score === matches[0].score) {
      return {
        kind: "clarify",
        candidates: matches.filter((entry) => entry.score === matches[0].score).map((entry) => entry.href),
        confidence: 0.5
      };
    }

    return { kind: "navigate", href: matches[0].href, confidence: 0.8 };
  }
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

// Validates the raw arguments a live LLM returns from its `route` tool call into
// a trusted RouteDecision. This is the structural guard: even if the model
// hallucinates a destination, a navigate to any href outside the allowed set is
// rejected down to `coach`, and there is no code path that could turn tool
// output into a write. Used by the /api/route/classify handler.
export function parseRouteToolArgs(raw: unknown, allowedHrefs: readonly string[]): RouteDecision {
  const args = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const confidence = typeof args.confidence === "number" ? clamp01(args.confidence) : 0;

  if (args.kind === "navigate" && typeof args.href === "string" && allowedHrefs.includes(args.href)) {
    return { kind: "navigate", href: args.href, confidence };
  }

  if (args.kind === "clarify" && Array.isArray(args.candidates)) {
    const candidates = args.candidates.filter((entry): entry is string => typeof entry === "string" && allowedHrefs.includes(entry));
    if (candidates.length > 0) {
      return { kind: "clarify", candidates, confidence };
    }
  }

  return { kind: "coach", confidence };
}
