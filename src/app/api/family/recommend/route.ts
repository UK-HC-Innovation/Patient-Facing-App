import { z } from "zod";
import { familyRankSystemPrompt, familyRankUserPrompt } from "@/ai/family-rank-prompt";
import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import { familyInterviewInputSchema } from "@/domain/family-interview";
import { familyRankResultSchema, parseFamilyRankPayload } from "@/domain/family-rank";
import { getFamilyResourceById } from "@/domain/family-resources";
import { MAX_RANK_CANDIDATES } from "@/domain/family-matching";

export const dynamic = "force-dynamic";

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
// Ranking is the judgment step and gets the stronger tier; extraction stays on mini.
const DEFAULT_RANK_MODEL = "gpt-4o";
const RANK_TIMEOUT_MS = 15_000;

const diagnosisSchema = z
  .object({
    id: z.string().min(1).max(200),
    label: z.enum([
      "autism",
      "adhd",
      "dyslexia",
      "speech_language",
      "developmental_delay",
      "intellectual_disability",
      "down_syndrome",
      "other"
    ]),
    otherLabel: z.string().min(1).max(200).optional(),
    diagnosedAt: z.string().min(1).max(40).optional()
  })
  .strict();

const profileSchema = z
  .object({
    childFirstName: z.string().min(1).max(100).optional(),
    birthYear: z.union([z.literal(0), z.number().int().min(1900).max(2100)]),
    birthMonth: z.number().int().min(1).max(12).optional(),
    schoolStage: z.enum(["not_school_age", "preschool", "elementary", "middle", "high", "post_high"]),
    county: z.string().max(100),
    diagnoses: z.array(diagnosisSchema).max(30)
  })
  .strict();

const bodySchema = z
  .object({
    text: familyInterviewInputSchema,
    profile: profileSchema,
    passcode: z.string().max(200).optional(),
    language: z.enum(["en", "es"]),
    candidateIds: z.array(z.string().min(1).max(120)).min(1).max(MAX_RANK_CANDIDATES)
  })
  .strict();

const providerEnvelopeSchema = z
  .object({
    choices: z
      .array(
        z
          .object({ message: z.object({ content: z.string() }).passthrough() })
          .passthrough()
      )
      .min(1)
  })
  .passthrough();

async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const parsedBody = bodySchema.safeParse(await readJson(request));
  if (!parsedBody.success) {
    return Response.json({ data: null }, { status: 400 });
  }
  const body = parsedBody.data;

  const provider = process.env.HEALTH_AI_PROVIDER;
  const apiKey = process.env.HEALTH_AI_API_KEY;
  if (provider !== "openai" || !apiKey) {
    return Response.json({ mode: "unconfigured", data: null });
  }

  const requiredPasscode = process.env.DEMO_PASSCODE;
  if (requiredPasscode && body.passcode !== requiredPasscode) {
    return Response.json({ mode: "locked", data: null });
  }

  // Unknown ids are dropped before the model ever sees them, so a stale client
  // cannot widen the candidate set past what the catalog actually contains.
  // Runs after the env/passcode gates so an unconfigured deploy still reports
  // `unconfigured` rather than masking it as an empty-candidate success.
  const candidateIds = body.candidateIds.filter((id) => getFamilyResourceById(id) !== undefined);
  if (candidateIds.length === 0) {
    return Response.json({ mode: "success", data: null });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RANK_TIMEOUT_MS);
  try {
    const upstream = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": buildVoiceSafetyIdentifier("anonymous")
      },
      body: JSON.stringify({
        model: process.env.HEALTH_AI_RANK_MODEL || DEFAULT_RANK_MODEL,
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: familyRankSystemPrompt() },
          {
            role: "user",
            content: familyRankUserPrompt({
              text: body.text,
              profile: body.profile,
              language: body.language,
              candidateIds
            })
          }
        ]
      }),
      signal: controller.signal
    });
    if (!upstream.ok) {
      return Response.json({ data: null }, { status: 502 });
    }

    const envelope = providerEnvelopeSchema.safeParse((await upstream.json()) as unknown);
    if (!envelope.success) {
      return Response.json({ mode: "success", data: null });
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(envelope.data.choices[0].message.content) as unknown;
    } catch {
      decoded = null;
    }

    const ranked = parseFamilyRankPayload(decoded);
    if (!ranked) {
      // Field paths only — never the model text or the caregiver's words. A
      // silent fallback with no signal is how a broken contract hides for weeks.
      const issues = familyRankResultSchema.safeParse(decoded);
      console.warn(
        "family/recommend: reply rejected, falling back to deterministic order. Fields:",
        issues.success ? "unknown" : issues.error.issues.map((issue) => issue.path.join(".")).join(", ")
      );
      return Response.json({ mode: "success", data: null });
    }
    // Second server-side pass: a hallucinated id never leaves this route.
    const allowed = new Set(candidateIds);
    return Response.json(
      {
        mode: "success",
        data: { ...ranked, recommendations: ranked.recommendations.filter(({ id }) => allowed.has(id)) }
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json({ data: null }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
