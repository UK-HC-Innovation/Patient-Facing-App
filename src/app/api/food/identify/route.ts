import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import {
  classifyQueryScoreability,
  findAlternatives,
  lookupScore,
  type CompassScore,
  type FcsFood
} from "@/domain/food-compass";
import { matchFood, type FoodMatch, type FoodSearchIndex } from "@/domain/food-compass-search";
import {
  buildFoodMatchProvenance,
  foodOrderCorrectionQueries,
  parseFoodOrderIntent,
  type FoodOrderIntent
} from "@/domain/food-order-intent";
import { findFoodByCode, loadFoodCompassData } from "@/server/food-compass-data";

export const dynamic = "force-dynamic";

const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const MAX_TEXT_CHARS = 200;
const MAX_IMAGE_CHARS = 1_500_000;
const CANDIDATE_LIMIT = 10;
const REQUEST_TIMEOUT_MS = 15_000;

// The identification prompt does one job: name the food. It never sees a score and is
// never asked for one -- every number in the response below comes from the lookup table.
const IDENTIFY_SYSTEM = [
  "You identify food from a photo. Reply with JSON only: {\"food\": string, \"confidence\": number}.",
  "Name the single MOST PROMINENT food in the frame, in plain English, with the qualifiers a",
  "nutrition database would use (for example \"banana, raw\" or \"tortilla chips, nacho cheese\").",
  "Order the words by prominence. If there is no food in the frame, reply {\"food\": \"\", \"confidence\": 0}.",
  "Never state or estimate a nutrition score, calorie count or nutrient amount."
].join(" ");

const DISAMBIGUATE_SYSTEM = [
  "You pick which database row best matches a food description.",
  "Reply with JSON only: {\"index\": number} using the 0-based index of the best row,",
  "or {\"index\": -1} if none of them is the same food.",
  "Never state or estimate a nutrition score."
].join(" ");

type IdentifyBody = {
  text?: string;
  foodId?: string;
  image?: string | null;
  passcode?: string;
  patientId?: string;
  preferHigherScore?: boolean;
  preferLowerCalorieDensity?: boolean;
};

type Candidate = { code: string; description: string; fcs: number };

async function readBody(request: Request): Promise<IdentifyBody> {
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as IdentifyBody;
    }
  } catch {
    // no body / invalid JSON -> treated as an empty request
  }
  return {};
}

function buildMatch(
  food: FcsFood,
  body: IdentifyBody,
  candidates: Candidate[],
  interpretation: FoodOrderIntent | null = null
): Response {
  const data = loadFoodCompassData();
  const siblings = data.byCode.get(food.code) ?? [food];
  const nutrients = data.nutrients[food.code] ?? null;
  const score: CompassScore = lookupScore(food, siblings, nutrients);
  const alternatives = findAlternatives(food, data.foods, data.nutrients, {
    preferHigherScore: body.preferHigherScore === true,
    preferLowerCalorieDensity: body.preferLowerCalorieDensity === true
  });

  return Response.json(
    {
      mode: "match",
      match: {
        food: { code: food.code, description: food.description, group: food.group },
        tier: "T1",
        score,
        alternatives,
        nutrients,
        ...(interpretation
          ? {
              interpretation,
              provenance: buildFoodMatchProvenance(interpretation, food.description)
            }
          : {})
      },
      candidates
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function toCandidates(matches: { food: FcsFood }[]): Candidate[] {
  return matches.map((m) => ({ code: m.food.code, description: m.food.description, fcs: m.food.fcs2 }));
}

function resolveTextCandidates(
  index: FoodSearchIndex,
  query: string,
  interpretation: FoodOrderIntent | null
): FoodMatch[] {
  const primary = matchFood(index, query, CANDIDATE_LIMIT).candidates;
  if (!interpretation || primary.length === 0) {
    return primary;
  }

  // Keep the best match first, then add one deterministic result for each correction
  // category before filling the rest with the ordinary fuzzy-search candidates.
  const correctionMatches = foodOrderCorrectionQueries(interpretation).flatMap(
    (candidateQuery) => matchFood(index, candidateQuery, 1).candidates
  );
  const ordered: FoodMatch[] = [];
  const seen = new Set<string>();
  for (const candidate of [primary[0], ...correctionMatches, ...primary.slice(1)]) {
    if (!candidate || seen.has(candidate.food.code)) {
      continue;
    }
    seen.add(candidate.food.code);
    ordered.push(candidate);
    if (ordered.length === CANDIDATE_LIMIT) {
      break;
    }
  }
  return ordered;
}

async function askModel(args: {
  apiKey: string;
  model: string;
  system: string;
  text: string;
  image?: string;
  patientId?: string;
}): Promise<string | null> {
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "low" } }> =
    [{ type: "text", text: args.text }];
  if (args.image) {
    // "low" detail is ~2.8k tokens per frame. Identifying one prominent food survives it,
    // and it is what keeps the live camera loop affordable.
    content.push({ type: "image_url", image_url: { url: args.image, detail: "low" } });
  }

  const upstream = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": buildVoiceSafetyIdentifier(args.patientId ?? "anonymous")
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content }
      ]
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!upstream.ok) {
    return null;
  }
  const data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

function parseJson(content: string | null): Record<string, unknown> | null {
  if (!content) {
    return null;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  const data = loadFoodCompassData();
  const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT_CHARS).trim() : "";
  const interpretation = text ? parseFoodOrderIntent(text) : null;

  // --- foodId: a correction-chip tap re-scores an exact row. Fully deterministic. ---
  if (typeof body.foodId === "string" && body.foodId.length > 0) {
    const food = findFoodByCode(data, body.foodId);
    if (!food) {
      return Response.json({ mode: "none", candidates: [] });
    }
    const candidates = interpretation
      ? resolveTextCandidates(data.index, interpretation.matchQuery, interpretation)
      : [];
    return buildMatch(food, body, toCandidates(candidates), interpretation);
  }

  const hasImage =
    typeof body.image === "string" && body.image.startsWith("data:image/") && body.image.length <= MAX_IMAGE_CHARS;

  // --- text: served BEFORE the provider and passcode checks. No model spend, so this is
  // the path that works in mock/locked mode and under Playwright. ---
  if (text.length > 0 && !hasImage) {
    const searchText = interpretation?.matchQuery ?? text;
    const carveOut = classifyQueryScoreability(searchText);
    if (carveOut && !carveOut.scoreable) {
      return Response.json({ mode: "carve_out", reason: carveOut.reason });
    }
    const candidates = resolveTextCandidates(data.index, searchText, interpretation);
    if (candidates.length === 0) {
      return Response.json({ mode: "none", candidates: [] });
    }
    // A typed query always resolves to the best-ranked row: the user can see the
    // alternatives list and re-pick, which is cheaper and more honest than a model call.
    return buildMatch(candidates[0].food, body, toCandidates(candidates), interpretation);
  }

  if (!hasImage) {
    return Response.json({ mode: "error", message: "empty_request" }, { status: 400 });
  }

  // --- image: gated exactly like /api/food/vision ---
  const provider = process.env.HEALTH_AI_PROVIDER;
  const apiKey = process.env.HEALTH_AI_API_KEY;
  const model = process.env.HEALTH_AI_VISION_MODEL || DEFAULT_VISION_MODEL;
  if (provider !== "openai" || !apiKey) {
    return Response.json({ mode: "unconfigured" });
  }
  const requiredPasscode = process.env.DEMO_PASSCODE;
  if (requiredPasscode && body.passcode !== requiredPasscode) {
    return Response.json({ mode: "locked" });
  }

  try {
    const identified = parseJson(
      await askModel({
        apiKey,
        model,
        system: IDENTIFY_SYSTEM,
        text: "What food is this?",
        image: body.image as string,
        patientId: body.patientId
      })
    );
    const name = typeof identified?.food === "string" ? identified.food.trim() : "";
    if (name.length === 0) {
      return Response.json({ mode: "none", candidates: [] });
    }

    const carveOut = classifyQueryScoreability(name);
    if (carveOut && !carveOut.scoreable) {
      return Response.json({ mode: "carve_out", reason: carveOut.reason });
    }

    const { candidates, confident } = matchFood(data.index, name, CANDIDATE_LIMIT);
    if (candidates.length === 0) {
      return Response.json({ mode: "none", candidates: [] });
    }
    if (confident) {
      // Deterministic short-circuit: the top hit leads clearly, so no second model call.
      return buildMatch(confident, body, toCandidates(candidates));
    }

    const disambiguated = parseJson(
      await askModel({
        apiKey,
        model,
        system: DISAMBIGUATE_SYSTEM,
        text: `Food seen: ${name}\n\nRows:\n${candidates.map((c, i) => `${i}. ${c.food.description}`).join("\n")}`,
        patientId: body.patientId
      })
    );
    const index = typeof disambiguated?.index === "number" ? disambiguated.index : -1;
    if (index < 0 || index >= candidates.length) {
      return Response.json({ mode: "none", candidates: toCandidates(candidates) });
    }
    return buildMatch(candidates[index].food, body, toCandidates(candidates));
  } catch {
    return Response.json({ mode: "error", message: "identify_request_error" }, { status: 502 });
  }
}
