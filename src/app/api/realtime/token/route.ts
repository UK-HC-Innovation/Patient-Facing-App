import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";

export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gpt-realtime-2";
const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

type TokenRequestBody = {
  patientId?: string;
  crisisOpen?: boolean;
  passcode?: string;
  probe?: boolean;
};

async function readBody(request: Request): Promise<TokenRequestBody> {
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as TokenRequestBody;
    }
  } catch {
    // no body / invalid JSON — treated as an empty attestation
  }
  return {};
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);

  // Attestation gate: the server cannot see localStorage, so the client attests
  // whether an unacknowledged crisis is open. Routine voice cannot start while it
  // is — documented as an attestation, not a server-verified guarantee.
  if (body.crisisOpen === true) {
    return Response.json({ mode: "blocked", reason: "open_red_flag" }, { status: 409 });
  }

  const provider = process.env.HEALTH_AI_PROVIDER;
  const apiKey = process.env.HEALTH_AI_API_KEY;
  const model = process.env.HEALTH_AI_REALTIME_MODEL || DEFAULT_MODEL;

  if (provider !== "openai") {
    return Response.json({ mode: "mock", reason: "provider_mock" });
  }
  if (!apiKey) {
    return Response.json({ mode: "mock", reason: "no_api_key" });
  }

  // Demo cost gate: on a public deployment, only mint a real OpenAI session when
  // the request carries the shared passcode. Without it, fall back to mock (typed)
  // so a stray visitor cannot spend credits. Skipped entirely when DEMO_PASSCODE is unset.
  const requiredPasscode = process.env.DEMO_PASSCODE;
  if (requiredPasscode && body.passcode !== requiredPasscode) {
    return Response.json({ mode: "mock", reason: "locked" });
  }

  if (body.probe === true) {
    return Response.json({ mode: "live", model });
  }

  try {
    const upstream = await fetch(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": buildVoiceSafetyIdentifier(body.patientId ?? "anonymous")
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          audio: { output: { voice: "marin" } }
        }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      return Response.json({ mode: "error", message: "token_request_failed" }, { status: 502 });
    }

    const data = (await upstream.json()) as { value?: string; expires_at?: number };
    if (!data.value) {
      return Response.json({ mode: "error", message: "no_client_secret" }, { status: 502 });
    }

    // The body carries a short-lived client secret, so it gets at least the same
    // no-store treatment the coach and vision text responses already have.
    return Response.json(
      { mode: "live", clientSecret: data.value, model, expiresAt: data.expires_at ?? null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json({ mode: "error", message: "token_request_error" }, { status: 502 });
  }
}
