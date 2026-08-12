import { z } from "zod";
import { FAMILY_AI_DISCLOSURE_VERSION } from "@/domain/family-ai-consent";
import {
  authorizeFamilyAiRequest,
  createFamilyAiConsentCapability,
  familyAiConsentCapabilityExpiresAt,
  familyAiServiceConfigured,
  readBoundedFamilyJson
} from "@/server/family-ai-auth";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({ disclosureVersion: z.literal(FAMILY_AI_DISCLOSURE_VERSION) })
  .strict();
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  if (!familyAiServiceConfigured()) {
    return Response.json({ capability: null }, { status: 503, headers: NO_STORE });
  }
  // Reject before reading even the disclosure acknowledgement when the
  // short-lived, same-origin service session is absent.
  if (!authorizeFamilyAiRequest(request)) {
    return Response.json({ capability: null }, { status: 401, headers: NO_STORE });
  }
  const payload = await readBoundedFamilyJson(request, 1024);
  if (!payload.ok) {
    return Response.json({ capability: null }, { status: payload.status, headers: NO_STORE });
  }
  const parsed = bodySchema.safeParse(payload.value);
  if (!parsed.success) {
    return Response.json({ capability: null }, { status: 400, headers: NO_STORE });
  }
  const capability = createFamilyAiConsentCapability(request, parsed.data.disclosureVersion);
  if (capability === null) {
    return Response.json({ capability: null }, { status: 503, headers: NO_STORE });
  }
  const expiresAt = familyAiConsentCapabilityExpiresAt(request, capability);
  if (expiresAt === null) {
    return Response.json({ capability: null }, { status: 503, headers: NO_STORE });
  }
  return Response.json({ capability, expiresAt }, { headers: NO_STORE });
}
