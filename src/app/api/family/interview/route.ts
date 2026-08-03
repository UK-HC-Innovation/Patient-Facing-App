import { z } from "zod";
import { devNeedDomainSchema, familyInterviewInputSchema, parseFamilyInterviewPayload } from "@/domain/family-interview";

export const dynamic = "force-dynamic";

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_INTERVIEW_MODEL = "gpt-4o-mini";
const INTERVIEW_TIMEOUT_MS = 15_000;

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
    passcode: z.string().max(200).optional(),
    language: z.enum(["en", "es"])
  })
  .strict();

const providerEnvelopeSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string()
              })
              .passthrough()
          })
          .passthrough()
      )
      .min(1)
  })
  .passthrough();

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INTERVIEW_TIMEOUT_MS);
  try {
    const upstream = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.HEALTH_AI_INTERVIEW_MODEL || DEFAULT_INTERVIEW_MODEL,
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: userPrompt(body) }
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
    const content = envelope.data.choices[0].message.content;
    let decoded: unknown;
    try {
      decoded = JSON.parse(content) as unknown;
    } catch {
      decoded = null;
    }
    return Response.json({ mode: "success", data: parseFamilyInterviewPayload(decoded) });
  } catch {
    return Response.json({ data: null }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
