import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import { liveModel, voiceEngineFor } from "@/server/voice-engine";
import { NO_STORE, readVoiceBody, refuseVoiceRequest, voiceProvider } from "@/server/voice-session-guards";

export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gpt-realtime-2";
const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

type TokenRequestBody = {
  patientId?: string;
  crisisOpen?: boolean;
  passcode?: string;
  probe?: boolean;
  nonce?: string;
  /** Sent by the food doors only, so they can be told which engine they get. */
  surface?: string;
  language?: string;
};

export async function POST(request: Request): Promise<Response> {
  const body = await readVoiceBody<TokenRequestBody>(request);
  const probe = body.probe === true;
  // A food door on the GPT-Live engine starts its session at /api/live/session with the
  // browser's offer, so its request here mints nothing and draws on the probe window. The
  // session route charges the mint window when it actually starts one.
  const engine = body.surface === "food" ? voiceEngineFor(body.language) : null;

  const refusal = refuseVoiceRequest(request, {
    crisisOpen: body.crisisOpen === true,
    requireNonce: !probe,
    bucket: probe || engine === "live" ? "probe" : "mint",
    nonce: body.nonce
  });
  if (refusal) return refusal;

  const provider = voiceProvider(body.passcode);
  if (provider.kind === "mock") {
    return Response.json({ mode: "mock", reason: provider.reason });
  }

  if (engine === "live") {
    return Response.json({ mode: "live", engine, model: liveModel() }, { headers: NO_STORE });
  }

  const model = process.env.HEALTH_AI_REALTIME_MODEL || DEFAULT_MODEL;
  // Only a food door is told its engine. /chat sends no surface and gets the answer it always has.
  const engineField = engine ? { engine } : {};

  if (probe) {
    return Response.json({ mode: "live", model, ...engineField });
  }

  try {
    const upstream = await fetch(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
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
      { mode: "live", clientSecret: data.value, model, expiresAt: data.expires_at ?? null, ...engineField },
      { headers: NO_STORE }
    );
  } catch {
    return Response.json({ mode: "error", message: "token_request_error" }, { status: 502 });
  }
}
