import { z } from "zod";
import { familyRankSystemPrompt, familyRankUserPrompt } from "@/ai/family-rank-prompt";
import { familyInterviewInputSchema } from "@/domain/family-interview";
import { familyRankResultSchema, parseFamilyRankPayload } from "@/domain/family-rank";
import { getFamilyResourceById } from "@/domain/family-resources";
import { MAX_RANK_CANDIDATES } from "@/domain/family-matching";
import { screenFamilySafety } from "@/domain/family-safety";
import { readBoundedFamilyJson } from "@/server/family-ai-auth";
import {
  beginFamilyAiEgress,
  requestFamilyAiJsonCompletion
} from "@/server/family-ai-egress";

export const dynamic = "force-dynamic";

// Ranking is the judgment step and gets the stronger tier; extraction stays on mini.
const DEFAULT_RANK_MODEL = "gpt-4o";

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
    language: z.enum(["en", "es"]),
    candidateIds: z.array(z.string().min(1).max(120)).min(1).max(MAX_RANK_CANDIDATES)
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const egress = beginFamilyAiEgress(request, "recommend");
  if (!egress.ok && egress.mode === "limited") {
    return Response.json(
      { mode: "limited", data: null },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } }
    );
  }
  if (!egress.ok) return Response.json({ mode: egress.mode, data: null });
  const payload = await readBoundedFamilyJson(request);
  if (!payload.ok) {
    return Response.json({ data: null }, { status: payload.status });
  }
  const parsedBody = bodySchema.safeParse(payload.value);
  if (!parsedBody.success) {
    return Response.json({ data: null }, { status: 400 });
  }
  const body = parsedBody.data;
  if (screenFamilySafety(body.text) !== null) {
    return Response.json({ mode: "safety", data: null });
  }

  // Unknown ids are dropped before the model ever sees them, so a stale client
  // cannot widen the candidate set past what the catalog actually contains.
  // Runs after the configuration/session gates so an unconfigured deploy still reports
  // `unconfigured` rather than masking it as an empty-candidate success.
  const candidateIds = body.candidateIds.filter((id) => getFamilyResourceById(id) !== undefined);
  if (candidateIds.length === 0) {
    return Response.json({ mode: "success", data: null });
  }

  const completion = await requestFamilyAiJsonCompletion(egress.context, {
    model: process.env.HEALTH_AI_RANK_MODEL || DEFAULT_RANK_MODEL,
    maxTokens: 2000,
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
  });
  if (!completion.ok) return Response.json({ data: null }, { status: 502 });

    const ranked = parseFamilyRankPayload(completion.data);
    if (!ranked) {
      // Field paths only — never the model text or the caregiver's words. A
      // silent fallback with no signal is how a broken contract hides for weeks.
      const issues = familyRankResultSchema.safeParse(completion.data);
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
}
