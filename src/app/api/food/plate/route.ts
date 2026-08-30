import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import { classifyQueryScoreability, lookupScore, type FcsFood } from "@/domain/food-compass";
import { matchFood, type FoodMatch } from "@/domain/food-compass-search";
import {
  MAX_PLATE_FOODS,
  normalizePlateFoods,
  plateChoiceRows,
  servingsFromGrams,
  type PlateCandidate,
  type PlateItemResult,
  type PlateVisionFood
} from "@/domain/plate-scan";
import { loadFoodCompassData, type FoodCompassData } from "@/server/food-compass-data";

export const dynamic = "force-dynamic";

const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const MAX_IMAGE_CHARS = 1_500_000;
const CANDIDATE_LIMIT = 10;
/** Chips under a matched item: four is as many as a phone row holds without wrapping twice. */
const MATCH_CANDIDATE_LIMIT = 4;
/** Chips under an unmatched item, matching the FoodNoMatch pattern the door already uses. */
const NONE_CANDIDATE_LIMIT = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const NO_STORE = { "Cache-Control": "no-store" };

// The decomposition prompt does one job: name the separate foods and say roughly how much
// of each is on the plate. Grams of food are a portion, not a nutrient — which is the line
// that keeps the closing sentence (copied verbatim from IDENTIFY_SYSTEM) true.
const PLATE_SYSTEM = [
  "You break one photo of a meal into the separate foods on the plate.",
  'Reply with JSON only: {"foods":[{"name": string, "grams": number, "note": string, "confidence": number}]}.',
  `List at most ${MAX_PLATE_FOODS} foods, most prominent first, in plain English, with the qualifiers a`,
  'nutrition database would use (for example "chicken breast, grilled" or "rice, white, cooked").',
  "A mixed or integrated dish -- a curry, casserole, stew, soup, sandwich, burrito, salad or",
  "smoothie -- is ONE entry, named as the dish. Only foods sitting physically separate on the",
  "plate are separate entries.",
  '"grams" is your estimate of the edible mass of that food on the plate. "note" is a short',
  'household phrase for that amount, for example "about two cups". "confidence" is 0 to 1.',
  'If there is no food in the frame, reply {"foods":[]}.',
  "Never state or estimate a nutrition score, calorie count or nutrient amount."
].join(" ");

const PLATE_DISAMBIGUATE_SYSTEM = [
  "You pick which database row best matches each food seen on one plate.",
  'Reply with JSON only: {"choices":[{"item": number, "row": number}]}, one entry per item listed,',
  "using that item's number and the 0-based index of the best row for it,",
  'or {"row": -1} for an item where none of the rows is the same food.',
  "Never state or estimate a nutrition score, calorie count or nutrient amount."
].join(" ");

type PlateBody = {
  image?: string | null;
  passcode?: string;
  patientId?: string;
};

async function readBody(request: Request): Promise<PlateBody> {
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as PlateBody;
    }
  } catch {
    // no body / invalid JSON -> treated as an empty request
  }
  return {};
}

async function askModel(args: {
  apiKey: string;
  model: string;
  system: string;
  text: string;
  image?: string;
  maxTokens: number;
  patientId?: string;
}): Promise<string | null> {
  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [{ type: "text", text: args.text }];
  if (args.image) {
    // "high" detail, unlike the live loop's "low": this is one user-initiated call, not a
    // 2.5 s cadence, and telling two side dishes apart is exactly what the extra tiles buy.
    // The ~768 px source frame keeps the cost bounded.
    content.push({ type: "image_url", image_url: { url: args.image, detail: "high" } });
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
      max_tokens: args.maxTokens,
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

/** The chosen row first, then the rest, deduped by code. */
function toCandidates(primary: FcsFood | null, matches: FoodMatch[], limit: number): PlateCandidate[] {
  const ordered: PlateCandidate[] = [];
  const seen = new Set<string>();
  for (const food of [...(primary ? [primary] : []), ...matches.map((match) => match.food)]) {
    if (seen.has(food.code)) {
      continue;
    }
    seen.add(food.code);
    ordered.push({ code: food.code, description: food.description, fcs: food.fcs2 });
    if (ordered.length === limit) {
      break;
    }
  }
  return ordered;
}

function buildMatchItem(
  data: FoodCompassData,
  food: FcsFood,
  matches: FoodMatch[],
  vision: PlateVisionFood
): PlateItemResult {
  const siblings = data.byCode.get(food.code) ?? [food];
  const nutrients = data.nutrients[food.code] ?? null;
  return {
    kind: "match",
    match: {
      food: { code: food.code, description: food.description, group: food.group },
      tier: "T1",
      score: lookupScore(food, siblings, nutrients),
      nutrients
    },
    candidates: toCandidates(food, matches, MATCH_CANDIDATE_LIMIT),
    proposedServings: servingsFromGrams(vision.grams),
    basis: vision.note
  };
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  const hasImage =
    typeof body.image === "string" && body.image.startsWith("data:image/") && body.image.length <= MAX_IMAGE_CHARS;

  // Image-only route: there is no text path to decompose, so a bodyless probe is a 400 and
  // buys no model call. That is also the deploy probe.
  if (!hasImage) {
    return Response.json({ mode: "error", message: "empty_request" }, { status: 400, headers: NO_STORE });
  }

  // Gate order copied from the identify route: provider first, passcode second, both at 200.
  const provider = process.env.HEALTH_AI_PROVIDER;
  const apiKey = process.env.HEALTH_AI_API_KEY;
  const model = process.env.HEALTH_AI_VISION_MODEL || DEFAULT_VISION_MODEL;
  if (provider !== "openai" || !apiKey) {
    return Response.json({ mode: "unconfigured" }, { headers: NO_STORE });
  }
  const requiredPasscode = process.env.DEMO_PASSCODE;
  if (requiredPasscode && body.passcode !== requiredPasscode) {
    return Response.json({ mode: "locked" }, { headers: NO_STORE });
  }

  try {
    const foods = normalizePlateFoods(
      parseJson(
        await askModel({
          apiKey,
          model,
          system: PLATE_SYSTEM,
          text: "What separate foods are on this plate, and roughly how much of each?",
          image: body.image as string,
          maxTokens: 500,
          patientId: body.patientId
        })
      )
    );
    if (foods.length === 0) {
      return Response.json({ mode: "none" }, { headers: NO_STORE });
    }

    const data = loadFoodCompassData();
    const items: Array<PlateItemResult | null> = foods.map(() => null);
    const unresolved: Array<{ slot: number; vision: PlateVisionFood; matches: FoodMatch[] }> = [];

    foods.forEach((vision, slot) => {
      const carveOut = classifyQueryScoreability(vision.name);
      if (carveOut && !carveOut.scoreable) {
        items[slot] = { kind: "carve_out", name: vision.name, reason: carveOut.reason };
        return;
      }
      const { candidates, confident } = matchFood(data.index, vision.name, CANDIDATE_LIMIT);
      if (candidates.length === 0) {
        items[slot] = { kind: "none", name: vision.name, candidates: [] };
        return;
      }
      if (confident) {
        items[slot] = buildMatchItem(data, confident, candidates, vision);
        return;
      }
      unresolved.push({ slot, vision, matches: candidates });
    });

    // Every unconfident name rides ONE second call. Total model spend per scan is 1 when the
    // whole plate is confident and 2 otherwise, never more.
    if (unresolved.length > 0) {
      const listing = unresolved
        .map(
          (entry, item) =>
            `Item ${item}: ${entry.vision.name}\nRows:\n${entry.matches
              .map((match, row) => `${row}. ${match.food.description}`)
              .join("\n")}`
        )
        .join("\n\n");
      const rows = plateChoiceRows(
        parseJson(
          await askModel({
            apiKey,
            model,
            system: PLATE_DISAMBIGUATE_SYSTEM,
            text: listing,
            maxTokens: 200,
            patientId: body.patientId
          })
        )
      );
      unresolved.forEach((entry, item) => {
        const row = rows.get(item) ?? -1;
        items[entry.slot] =
          row >= 0 && row < entry.matches.length
            ? buildMatchItem(data, entry.matches[row].food, entry.matches, entry.vision)
            : {
                kind: "none",
                name: entry.vision.name,
                candidates: toCandidates(null, entry.matches, NONE_CANDIDATE_LIMIT)
              };
      });
    }

    const resolved = items.filter((item): item is PlateItemResult => item !== null);
    if (resolved.length === 0) {
      return Response.json({ mode: "none" }, { headers: NO_STORE });
    }
    return Response.json({ mode: "plate", items: resolved }, { headers: NO_STORE });
  } catch {
    return Response.json({ mode: "error", message: "plate_request_error" }, { status: 502, headers: NO_STORE });
  }
}
