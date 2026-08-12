import { z } from "zod";
import {
  allowFamilyAiSessionIssuance,
  createFamilyAiSessionToken,
  familyAiServiceConfigured,
  familyAiSessionCookie,
  familyAiSessionExpiresAt,
  familyAiSessionTokenExpiresAt,
  isSameOriginFamilyAiRequest,
  readBoundedFamilyJson,
  validFamilyAiInvite
} from "@/server/family-ai-auth";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({ passcode: z.string().min(1).max(200) }).strict();
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const expiresAt = familyAiServiceConfigured() ? familyAiSessionExpiresAt(request) : null;
  return Response.json(
    { authorized: expiresAt !== null, ...(expiresAt === null ? {} : { expiresAt }) },
    { headers: NO_STORE }
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!familyAiServiceConfigured()) {
    return Response.json({ authorized: false }, { status: 503, headers: NO_STORE });
  }
  if (!isSameOriginFamilyAiRequest(request)) {
    return Response.json({ authorized: false }, { status: 403, headers: NO_STORE });
  }
  if (!allowFamilyAiSessionIssuance(request)) {
    return Response.json(
      { authorized: false },
      { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } }
    );
  }
  const payload = await readBoundedFamilyJson(request, 1024);
  if (!payload.ok) {
    return Response.json({ authorized: false }, { status: payload.status, headers: NO_STORE });
  }
  const parsed = inviteSchema.safeParse(payload.value);
  if (!parsed.success || !validFamilyAiInvite(parsed.data.passcode)) {
    return Response.json({ authorized: false }, { status: 401, headers: NO_STORE });
  }
  const token = createFamilyAiSessionToken();
  if (token === null) {
    return Response.json({ authorized: false }, { status: 503, headers: NO_STORE });
  }
  const expiresAt = familyAiSessionTokenExpiresAt(token);
  if (expiresAt === null) {
    return Response.json({ authorized: false }, { status: 503, headers: NO_STORE });
  }
  return Response.json(
    { authorized: true, expiresAt },
    { headers: { ...NO_STORE, "Set-Cookie": familyAiSessionCookie(token) } }
  );
}
