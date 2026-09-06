import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import { parseRouteToolArgs } from "@/domain/route-classifier";
import { usageOutcomeFromHref, usageSignature } from "@/domain/usage-event";
import { recordServerUsage } from "@/server/usage-log";

export const dynamic = "force-dynamic";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

type ClassifyRequest = { utterance?: string; allowedHrefs?: string[]; passcode?: string };

async function readBody(request: Request): Promise<ClassifyRequest> {
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as ClassifyRequest;
    }
  } catch {
    // no body / invalid JSON
  }
  return {};
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  const utterance = (body.utterance ?? "").trim();
  const allowedHrefs = Array.isArray(body.allowedHrefs) ? body.allowedHrefs.filter((href): href is string => typeof href === "string") : [];

  if (utterance.length === 0 || allowedHrefs.length === 0) {
    recordServerUsage({ kind: "problem", problem: "empty_result", where: "api.route.classify", code: "no_input" });
    return Response.json({ kind: "coach", confidence: 0 });
  }

  const provider = process.env.HEALTH_AI_PROVIDER;
  const apiKey = process.env.HEALTH_AI_API_KEY;
  const model = process.env.HEALTH_AI_MODEL || DEFAULT_MODEL;

  // No live model configured — defer to the Coach. The deterministic + mock
  // stages already ran on the client, so this is a graceful no-op, never a block.
  if (provider !== "openai" || !apiKey) {
    // Every deferral below answers the client identically, so without these four distinct
    // lines an unset key and a timed-out model are the same event from the outside -- the
    // route quietly degrades for days and nothing in the app looks broken.
    recordServerUsage({ kind: "problem", problem: "not_configured", where: "api.route.classify", code: "no_provider" });
    return Response.json({ kind: "coach", confidence: 0 });
  }

  // Demo cost gate, same as every other credit-spending route. This one matters
  // most: classify is reached on every home-composer submission, so an ungated
  // deploy spends on each typed utterance from any visitor. Falling back to
  // `coach` is the route's existing graceful degradation — the deterministic and
  // mock stages have already run on the client, so nothing is blocked.
  // Skipped when DEMO_PASSCODE is unset (local dev).
  const requiredPasscode = process.env.DEMO_PASSCODE;
  if (requiredPasscode && body.passcode !== requiredPasscode) {
    recordServerUsage({ kind: "problem", problem: "guard_blocked", where: "api.route.classify", code: "passcode" });
    return Response.json({ kind: "coach", confidence: 0 });
  }

  // The model is handed exactly one tool, `route`, whose only outcomes are
  // navigate / coach / clarify. There is deliberately no tool that writes or
  // changes data, so the model is structurally incapable of mutating the record.
  const tools = [
    {
      type: "function",
      function: {
        name: "route",
        description: "Route the patient's words to app navigation.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "confidence"],
          properties: {
            kind: { type: "string", enum: ["navigate", "coach", "clarify"] },
            href: { type: "string", enum: allowedHrefs },
            candidates: { type: "array", items: { type: "string", enum: allowedHrefs } },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  ];

  const messages = [
    {
      role: "system",
      content:
        "You route a patient's words to navigation in a home-health app. You may ONLY navigate to one of the allowed screens, defer to the coach, or ask to clarify. You cannot take actions or change any data. Navigate only when the person clearly wants to open a screen. For any question, worry, symptom, or medical concern, choose coach. When unsure, choose coach."
    },
    { role: "user", content: `Utterance: "${utterance}"\nAllowed screens: ${allowedHrefs.join(", ")}` }
  ];

  const askedAt = Date.now();
  try {
    const upstream = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": buildVoiceSafetyIdentifier("anonymous")
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: { type: "function", function: { name: "route" } },
        temperature: 0
      }),
      signal: AbortSignal.timeout(4000)
    });

    if (!upstream.ok) {
      recordServerUsage({
        kind: "problem",
        problem: "error",
        where: "api.route.classify",
        code: `http_${upstream.status}`
      });
      return Response.json({ kind: "coach", confidence: 0 });
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
    };
    const rawArgs = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = rawArgs ? (JSON.parse(rawArgs) as unknown) : {};
    const decided = parseRouteToolArgs(parsed, allowedHrefs);
    recordServerUsage({
      kind: "decision",
      decision: "route_classify",
      outcome: decided.kind === "navigate" ? usageOutcomeFromHref(decided.href ?? "") : `stage.${decided.kind}`,
      source: "model",
      inputSignature: usageSignature(utterance.toLowerCase()),
      confidence: Math.min(1, Math.max(0, decided.confidence ?? 0)),
      latencyMs: Math.round(Date.now() - askedAt)
    });
    return Response.json(decided);
  } catch (error) {
    recordServerUsage({
      kind: "problem",
      problem: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "error",
      where: "api.route.classify",
      code: error instanceof Error ? error.name.toLowerCase().slice(0, 40) : "unknown"
    });
    return Response.json({ kind: "coach", confidence: 0 });
  }
}
