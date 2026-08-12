import { z } from "zod";
import { devNeedDomainSchema, familyInterviewInputSchema, parseFamilyInterviewPayload } from "@/domain/family-interview";
import { screenFamilySafety } from "@/domain/family-safety";
import { readBoundedFamilyJson } from "@/server/family-ai-auth";
import {
  beginFamilyAiEgress,
  requestFamilyAiJsonCompletion
} from "@/server/family-ai-egress";

export const dynamic = "force-dynamic";

const DEFAULT_INTERVIEW_MODEL = "gpt-4o-mini";

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
    // 0 is the pre-basics sentinel for an unknown birth year.
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
    language: z.enum(["en", "es"])
  })
  .strict();

const domainValues = devNeedDomainSchema.options.join(", ");

function systemPrompt(): string {
  return [
    "Extract only facts explicitly reported by the caregiver and developmental support domains from the interview.",
    'Return JSON only with exactly: {"facts":[{"label":"","value":"","sourceSnippet":""}],"domains":[{"domain":"","rationale":""}],"followUps":[{"question":"","options":["",""]}]}.',
    `Allowed domain values: ${domainValues}.`,
    "followUps: at most 3 short orientation questions, each with 2 to 4 suggested short answers under 60 characters in options; questions under 200 characters, plain language, ending with a question mark.",
    'In the caregiver interview, lines beginning with "Q:" are questions the navigator already asked and lines beginning with "A:" are the caregiver\'s replies. Extract facts and domains only from the caregiver\'s words; never repeat a question already asked.',
    "Every sourceSnippet must quote the caregiver text exactly. Never invent a fact or diagnosis.",
    "never state that the child has a condition; say the concerns you described unless the caregiver explicitly reports a diagnosis.",
    "Use diagnosis_education only when the caregiver explicitly asks for neutral information about evaluation, screening, consultation, or no-label options. Concern words, a possible condition, or saying there is no diagnosis are not enough.",
    "Use cautious, plain-language rationales. Do not name or recommend organizations, programs, services, or providers in rationales, followUps questions, or options."
  ].join("\n");
}

function userPrompt(body: z.infer<typeof bodySchema>): string {
  const minimalProfile = {
    childFirstName: body.profile.childFirstName ?? null,
    birthYear: body.profile.birthYear || null,
    birthMonth: body.profile.birthMonth ?? null,
    // A sentinel birth year means the basics were never provided, so the default school stage is not a real answer.
    schoolStage: body.profile.birthYear === 0 ? null : body.profile.schoolStage,
    county: body.profile.county || null,
    reportedDiagnoses: body.profile.diagnoses.map(({ label }) => label),
    language: body.language
  };
  return `Profile: ${JSON.stringify(minimalProfile)}\nCaregiver interview: ${JSON.stringify(body.text)}`;
}

export async function POST(request: Request): Promise<Response> {
  const egress = beginFamilyAiEgress(request, "interview");
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

  const completion = await requestFamilyAiJsonCompletion(egress.context, {
    model: process.env.HEALTH_AI_INTERVIEW_MODEL || DEFAULT_INTERVIEW_MODEL,
    maxTokens: 1200,
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(body) }
    ]
  });
  if (!completion.ok) return Response.json({ data: null }, { status: 502 });
  return Response.json(
    { mode: "success", data: parseFamilyInterviewPayload(completion.data) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
