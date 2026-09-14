import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import { recordServerUsage } from "@/server/usage-log";
import { liveModel, voiceEngineFor } from "@/server/voice-engine";
import { NO_STORE, readVoiceBody, refuseVoiceRequest, voiceProvider } from "@/server/voice-session-guards";

export const dynamic = "force-dynamic";

/**
 * Starts a GPT-Live-1 voice session for a food door.
 *
 * GPT-Live has no ephemeral client secret. The browser sends its WebRTC offer here, this route
 * posts it to OpenAI with the key, and the answer goes back. So the key, the model and the
 * session shape never leave the server, and every start runs the same checks, in the same
 * order, as the realtime token route.
 */

const LIVE_SESSIONS_URL = "https://api.openai.com/v1/live/sessions";
/** A browser's offer is a few kilobytes. */
const MAX_SDP_CHARS = 64 * 1024;
/** The personal door's instructions carry the care plan and the meal digest. */
const MAX_INSTRUCTIONS_CHARS = 24_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

type LiveSessionRequestBody = {
  sdp: unknown;
  instructions: unknown;
  language: unknown;
  patientId: unknown;
  crisisOpen: unknown;
  passcode: unknown;
  nonce: unknown;
};

function refuse(status: number, message: string): Response {
  return Response.json({ mode: "error", message }, { status, headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readVoiceBody<LiveSessionRequestBody>(request);

  const refusal = refuseVoiceRequest(request, {
    crisisOpen: body.crisisOpen === true,
    requireNonce: true,
    bucket: "mint",
    nonce: body.nonce
  });
  if (refusal) return refusal;

  const provider = voiceProvider(body.passcode);
  if (provider.kind === "mock") {
    return Response.json({ mode: "mock", reason: provider.reason });
  }

  // The token route told the door which engine it gets. If the deployment changed in between,
  // this says so rather than starting a session nobody switched on.
  const language = body.language === "es" ? "es" : "en";
  if (voiceEngineFor(language) !== "live") {
    return refuse(409, "live_engine_off");
  }

  const sdp = typeof body.sdp === "string" ? body.sdp : "";
  if (!sdp.startsWith("v=0") || sdp.length > MAX_SDP_CHARS) {
    return refuse(400, "invalid_sdp");
  }
  const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
  if (instructions.length === 0 || instructions.length > MAX_INSTRUCTIONS_CHARS) {
    return refuse(400, "invalid_instructions");
  }

  const model = liveModel();
  try {
    const upstream = await fetch(LIVE_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": buildVoiceSafetyIdentifier(
          typeof body.patientId === "string" ? body.patientId : "anonymous"
        )
      },
      body: JSON.stringify({
        // OpenAI rejects any field it does not know, so this is the whole shape. No `store`:
        // no recording is kept. No image fields: GPT-Live refuses them, and the camera frame
        // stays with the identify route. Client delegation: the app answers, not a second model.
        session: {
          model,
          instructions,
          audio: { output: { voice: "marin" } },
          delegation: { type: "client" }
        },
        transport: { type: "webrtc", sdp }
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });

    if (!upstream.ok) {
      recordServerUsage({
        kind: "problem",
        problem: "error",
        where: "api.live.session",
        code: `http_${upstream.status}`
      });
      return refuse(502, "session_request_failed");
    }

    const data = (await upstream.json()) as { session?: { id?: unknown }; transport?: { sdp?: unknown } };
    const sessionId = typeof data.session?.id === "string" ? data.session.id : null;
    const answer = typeof data.transport?.sdp === "string" ? data.transport.sdp : null;
    if (!sessionId || !answer) {
      return refuse(502, "no_session");
    }

    return Response.json(
      { mode: "live", engine: "live", model, sessionId, sdp: answer },
      { headers: NO_STORE }
    );
  } catch {
    recordServerUsage({ kind: "problem", problem: "error", where: "api.live.session", code: "fetch_failed" });
    return refuse(502, "session_request_error");
  }
}
