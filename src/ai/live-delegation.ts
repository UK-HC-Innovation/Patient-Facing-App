import type { CompassContext } from "@/domain/compass-context";
import { isQuestionLine } from "@/domain/typed-food-line";
import type { Language } from "@/i18n/strings";
import { recordUsage } from "@/telemetry/recorder";
import { buildCompassContext } from "./food-instructions";
import { liveLine } from "./live-strings";
import type { LiveSessionContext } from "./types";

/**
 * How GPT-Live's questions come back to the app, and how the app answers them.
 *
 * GPT-Live-1 runs with client delegation: when the person names a food or asks about a score,
 * it hands the turn to the app instead of answering from its own knowledge. The app answers
 * from the same deterministic paths the typed box uses, so a score it speaks is one the
 * published table holds. The delegation event carries no text, so the app reads the person's
 * last turn from the transcript and works out what was asked here.
 */

/** Appended to each door's own instructions. The Realtime instructions are left alone. */
export const LIVE_VOICE_POLICY = [
  "Rules for this live voice session:",
  "- The person can interrupt you. When they start talking, stop and listen.",
  "- Do not make listening sounds while the person is talking.",
  "- Do not speak first. Wait for the person, or for a line the app gives you to say.",
  "- Delegate to the app whenever the person names a food, asks about a score, asks for a better choice, or asks about the food on screen. While you wait, say at most a short acknowledgment. Never guess the result.",
  "- When the app's result arrives, say it plainly and briefly. Use any number in it exactly.",
  "- Answer anything else yourself in one or two short sentences, using only facts the app has given you.",
  "- Never state a score or any other number the app did not give you. If you need a number you do not have, delegate."
].join("\n");

export function withLiveVoicePolicy(instructions: string): string {
  return `${instructions.trim()}\n\n${LIVE_VOICE_POLICY}`;
}

export type SpokenAsk = { kind: "current" } | { kind: "food"; query: string } | { kind: "other" };

const FILLERS = /^(?:um+|uh+|so|okay|ok|well|hey|oh|and|y|pues|bueno|entonces|oye)\b[,\s]*/i;
const ARTICLES = /^(?:a|an|the|some|el|la|los|las|un|una|unos|unas)\s+/i;
const TRAILING = /[\s,]+(?:instead|then|too|also|please|today|tonight|now|for (?:lunch|dinner|breakfast)|por favor|tambi[eé]n|entonces|hoy)$/i;
/** A phrase that points at the food on screen rather than naming another one. */
const POINTS_AT_SCREEN = /^(?:this|that|it|these|those|esto|eso|este|esta|ese|esa)\b/i;

/** Asks that name a food. The captured group is the food. Checked before CURRENT_ASKS. */
const FOOD_ASKS: RegExp[] = [
  /^(?:what|how)\s+about\s+(.+)$/i,
  /^what(?:'s|\s+is)\s+the\s+score\s+(?:for|of|on)\s+(.+)$/i,
  /^how\s+(?:does|do|would|did)\s+(.+?)\s+score$/i,
  /^(?:is|are)\s+(.+?)\s+(?:any\s+)?(?:good|better|healthy|healthier|ok|okay|all right|alright|a good choice|a better choice)\b/i,
  /^(?:can|could|should)\s+i\s+(?:have|eat|get|drink)\s+(.+)$/i,
  /^(?:score|check|look up)\s+(.+)$/i,
  /^qu[eé]\s+tal\s+(.+)$/i,
  /^cu[aá]l\s+es\s+el\s+puntaje\s+de\s+(.+)$/i,
  /^(?:es|son)\s+(?:mejor(?:es)?|buen[oa]s?|san[oa]s?)\s+(.+)$/i,
  /^(?:es|son)\s+(.+?)\s+(?:buen[oa]s?|mejor(?:es)?|san[oa]s?)\b/i,
  /^puedo\s+(?:comer|tomar)\s+(.+)$/i
];

/** Asks about the food already on screen. */
const CURRENT_ASKS: RegExp[] = [
  /^(?:is|are|was|were)\s+(?:this|that|it|these|those)\b/i,
  /^(?:this|that|it)\s+(?:is|was|came|comes|has)\b/i,
  /^what(?:'s|\s+is)\s+(?:this|that|it)\b/i,
  /^what(?:'s|\s+is)\s+(?:the|its|this|that)\s+score\b/i,
  /^how\s+(?:does|did|is|would)\s+(?:this|that|it)\b/i,
  // A detail about the food on screen: "with sausage", "con queso".
  /^(?:with|con)\s+/i,
  /\bwhy\b/i,
  /\b(?:better|healthier|swap|instead|alternative)\b/i,
  /^(?:esto|este|esta|eso|ese|esa)\b/i,
  /^qu[eé]\s+es\s+(?:esto|eso)\b/i,
  // No \b after an accented letter: JavaScript counts é as a word boundary on both sides.
  /\bpor\s*qu[eé](?![a-z])/i,
  /\b(?:mejor|m[aá]s\s+san[oa]|cambio|en\s+vez)\b/i
];

function normalize(text: string): string {
  let value = text
    .replace(/[¿¡?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  for (let pass = 0; pass < 3 && FILLERS.test(value); pass += 1) {
    value = value.replace(FILLERS, "").trim();
  }
  return value.replace(/^[,\s]+|[,\s]+$/g, "");
}

function cleanPhrase(phrase: string): string {
  let value = phrase.trim().replace(/^[,\s]+|[,\s]+$/g, "");
  for (let pass = 0; pass < 2; pass += 1) {
    value = value.replace(TRAILING, "").replace(ARTICLES, "").trim();
  }
  return value;
}

function askFromPhrase(phrase: string): SpokenAsk {
  const cleaned = cleanPhrase(phrase);
  if (cleaned.length === 0 || POINTS_AT_SCREEN.test(cleaned)) {
    return { kind: "current" };
  }
  return { kind: "food", query: cleaned };
}

/**
 * What a spoken turn asked for. Deterministic and local: a model call to decide what the
 * model was asked would be the thing delegation exists to avoid.
 */
export function extractSpokenAsk(turnText: string): SpokenAsk {
  const text = normalize(turnText);
  // GPT-Live can delegate with nothing heard, straight after the opening line.
  if (text.length === 0) {
    return { kind: "current" };
  }
  for (const pattern of FOOD_ASKS) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      return askFromPhrase(match[1]);
    }
  }
  if (CURRENT_ASKS.some((pattern) => pattern.test(text))) {
    return { kind: "current" };
  }
  // A short line that is not a question is a food name: "peanut butter", "pan dulce".
  if (text.split(" ").length <= 5 && !isQuestionLine(text)) {
    return askFromPhrase(text);
  }
  return { kind: "other" };
}

export type CurrentFood = { name: string | null; compass: CompassContext | null };

export type SpokenLookup =
  | {
      kind: "match";
      description: string;
      fcs: number;
      band: string;
      alternatives: { description: string; fcs: number }[];
    }
  | { kind: "candidate"; descriptions: string[] }
  | { kind: "carve_out" }
  | { kind: "none" };

export type DelegationBranch =
  | "current"
  | "current_carve_out"
  | "nothing_on_screen"
  | "lookup_match"
  | "lookup_candidate"
  | "lookup_carve_out"
  | "lookup_none"
  | "other"
  | "timeout"
  | "error";

export type DelegationAnswer = { text: string; branch: DelegationBranch };

function bandLine(band: string, language: Language): string | null {
  if (band === "encourage") return liveLine(language, "bandEncourage");
  if (band === "moderate") return liveLine(language, "bandModerate");
  if (band === "minimize") return liveLine(language, "bandMinimize");
  return null;
}

function scoreSentence(
  name: string,
  fcs: number,
  band: string,
  alternatives: { description: string; fcs: number }[],
  language: Language
): string {
  // The swap the screen leads with, when it scores higher. Never one the screen does not show.
  const better = alternatives.find((option) => option.fcs > fcs) ?? null;
  // Nothing scores higher and the food is already one to encourage: say so, and do not invent
  // an improvement (spec 30 R10).
  const swap = better
    ? liveLine(language, "betterOption", { food: better.description, score: better.fcs })
    : band === "encourage"
      ? null
      : liveLine(language, "noCloseSwap");
  return [liveLine(language, "score", { food: name, score: fcs }), bandLine(band, language), swap]
    .filter((part): part is string => part !== null)
    .join(" ");
}

function sentenceCase(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

/** The food on screen, in the app's words. Built after every await, so it is always current. */
export function describeCurrent(food: CurrentFood, language: Language): DelegationAnswer {
  const compass = food.compass;
  if (!compass) {
    return { text: liveLine(language, "nothingOnScreen"), branch: "nothing_on_screen" };
  }
  const name = food.name ?? liveLine(language, "thisFood");
  if (compass.kind === "carve_out") {
    return { text: liveLine(language, "noScore", { food: name }), branch: "current_carve_out" };
  }
  return {
    text: scoreSentence(name, compass.fcs, compass.band, compass.alternatives, language),
    branch: "current"
  };
}

export function describeLookup(result: SpokenLookup, query: string, language: Language): DelegationAnswer {
  switch (result.kind) {
    case "match":
      return {
        text: scoreSentence(result.description, result.fcs, result.band, result.alternatives, language),
        branch: "lookup_match"
      };
    case "candidate": {
      const options = result.descriptions.slice(0, 3);
      if (options.length === 0) {
        return { text: liveLine(language, "notFound"), branch: "lookup_none" };
      }
      // A candidate is a proposal, never a score (spec 30 R4).
      const text =
        options.length === 1
          ? liveLine(language, "didYouMean", { food: options[0] })
          : liveLine(language, "whichOne", {
              options: `${options.slice(0, -1).join(", ")} ${liveLine(language, "or")} ${options[options.length - 1]}`
            });
      return { text, branch: "lookup_candidate" };
    }
    case "carve_out":
      return { text: liveLine(language, "noScore", { food: sentenceCase(query) }), branch: "lookup_carve_out" };
    default:
      return { text: liveLine(language, "notFound"), branch: "lookup_none" };
  }
}

type IdentifyAnswer = {
  mode?: string;
  match?: {
    food?: { description?: unknown };
    score?: { fcs?: unknown; band?: unknown };
    alternatives?: { description?: unknown; fcs?: unknown }[];
  };
  candidates?: { description?: unknown }[];
  candidate?: { food?: { description?: unknown } };
};

/** The typed box's lookup, for a food named out loud. The route owns the table. */
export async function lookupSpokenFood(query: string, passcode?: string): Promise<SpokenLookup> {
  const response = await fetch("/api/food/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: query, passcode })
  });
  const json = (await response.json()) as IdentifyAnswer;
  if (json.mode === "match") {
    const description = json.match?.food?.description;
    const fcs = json.match?.score?.fcs;
    if (typeof description === "string" && typeof fcs === "number") {
      return {
        kind: "match",
        description,
        fcs,
        band: typeof json.match?.score?.band === "string" ? json.match.score.band : "",
        alternatives: (json.match?.alternatives ?? []).flatMap((alternative) =>
          typeof alternative.description === "string" && typeof alternative.fcs === "number"
            ? [{ description: alternative.description, fcs: alternative.fcs }]
            : []
        )
      };
    }
  }
  if (json.mode === "candidate") {
    const descriptions = [
      ...(json.candidates ?? []).map((candidate) => candidate.description),
      json.candidate?.food?.description
    ].filter((description): description is string => typeof description === "string" && description.length > 0);
    return { kind: "candidate", descriptions };
  }
  if (json.mode === "carve_out") {
    return { kind: "carve_out" };
  }
  return { kind: "none" };
}

export type DelegationContext = {
  language: Language;
  currentFood: () => CurrentFood;
  /** The public door's order refinement: "Papa John's, pepperoni" rescopes the pizza on screen. */
  prepare?: (text: string) => Promise<void>;
  lookup: (query: string) => Promise<SpokenLookup>;
};

function identity(food: CurrentFood): string {
  const compass = food.compass;
  return `${food.name ?? ""}|${compass?.kind ?? "none"}|${compass?.kind === "score" ? compass.fcs : ""}`;
}

export async function answerDelegation(turnText: string, context: DelegationContext): Promise<DelegationAnswer> {
  if (context.prepare) {
    const before = identity(context.currentFood());
    await context.prepare(turnText);
    const after = context.currentFood();
    if (identity(after) !== before) {
      return describeCurrent(after, context.language);
    }
  }
  const ask = extractSpokenAsk(turnText);
  if (ask.kind === "current") {
    return describeCurrent(context.currentFood(), context.language);
  }
  if (ask.kind === "food") {
    return describeLookup(await context.lookup(ask.query), ask.query, context.language);
  }
  return { text: liveLine(context.language, "onlyFoodOnScreen"), branch: "other" };
}

const DELEGATION_DEADLINE_MS = 5000;

/**
 * The answerer the Live session calls. It never rejects and never runs past the deadline: a
 * lookup that fails or stalls answers with a fixed line rather than leaving GPT-Live to guess.
 */
export function createDelegationAnswerer(
  context: DelegationContext,
  deadlineMs = DELEGATION_DEADLINE_MS
): (turnText: string) => Promise<string> {
  return async (turnText) => {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let answer: DelegationAnswer;
    try {
      const settled = await Promise.race([
        answerDelegation(turnText, context),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), deadlineMs);
        })
      ]);
      answer = settled ?? { text: liveLine(context.language, "couldNotCheck"), branch: "timeout" };
    } catch {
      answer = { text: liveLine(context.language, "couldNotCheck"), branch: "error" };
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
    recordUsage({
      kind: "decision",
      decision: "voice_delegation",
      outcome: answer.branch,
      source: answer.branch === "timeout" || answer.branch === "error" ? "fallback" : "deterministic",
      latencyMs: Math.min(600_000, Math.max(0, Date.now() - startedAt))
    });
    return answer.text;
  };
}

/**
 * The facts GPT-Live gets as quiet context. The rule goes first and the least important lines
 * go last, because an append is capped and anything past the cap is cut.
 */
export function buildLiveFacts(context: LiveSessionContext, foodName: string | null): string | null {
  const compass = buildCompassContext(context.compass ?? null);
  const food = context.identifiedFood;
  const name = foodName ?? (food ? [food.brand, food.name].filter(Boolean).join(" ") : null);
  if (!name && !compass) {
    return null;
  }
  return [
    `[camera context, not spoken by the user] Food on screen: ${name ?? "none identified yet"}.`,
    "Use these numbers exactly; do not recompute them.",
    ...(compass ? [compass] : []),
    ...(context.flagTexts.length > 0 ? [`Precomputed flags: ${context.flagTexts.join("; ")}.`] : []),
    ...(context.plateLine ? [context.plateLine] : []),
    ...(context.dayTotalsLine ? [context.dayTotalsLine] : []),
    ...(context.historyLine ? [context.historyLine] : [])
  ].join("\n");
}
