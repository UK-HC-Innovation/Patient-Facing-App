import { z } from "zod";
import {
  FOOD_PACKAGE_DISCLOSURE_VERSION,
  FOOD_PACKAGE_SESSION_MAX_BODY_BYTES,
  allowFoodPackageSessionIssuance,
  createFoodPackageSessionToken,
  foodPackageServiceStatus,
  foodPackageSessionCookie,
  foodPackageSessionExpiresAt,
  foodPackageSessionTokenExpiresAt,
  isSameOriginFoodPackageRequest,
  readBoundedFoodPackageJson,
  validFoodPackageInvite
} from "@/server/food-package-auth";
import { packageLabelEvalHeaders } from "@/server/eval-attestation";

export const dynamic = "force-dynamic";

const sessionSchema = z
  .object({
    passcode: z.string().min(1).max(200),
    disclosureVersion: z.literal(FOOD_PACKAGE_DISCLOSURE_VERSION)
  })
  .strict();

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    ...packageLabelEvalHeaders(),
    ...extra
  };
}

function response(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: headers(extraHeaders) });
}

export async function GET(request: Request): Promise<Response> {
  const serviceStatus = foodPackageServiceStatus();
  if (serviceStatus !== "ready") {
    return response(
      { authorized: false, mode: serviceStatus },
      serviceStatus === "disabled" ? 200 : 503
    );
  }

  const expiresAt = foodPackageSessionExpiresAt(request);
  return response({ authorized: expiresAt !== null, ...(expiresAt === null ? {} : { expiresAt }) });
}

export async function POST(request: Request): Promise<Response> {
  const serviceStatus = foodPackageServiceStatus();
  if (serviceStatus !== "ready") {
    return response(
      { authorized: false, mode: serviceStatus },
      serviceStatus === "disabled" ? 200 : 503
    );
  }
  if (!isSameOriginFoodPackageRequest(request)) {
    return response({ authorized: false }, 403);
  }
  if (!allowFoodPackageSessionIssuance(request)) {
    return response({ authorized: false }, 429, { "Retry-After": "60" });
  }

  const payload = await readBoundedFoodPackageJson(request, FOOD_PACKAGE_SESSION_MAX_BODY_BYTES);
  if (!payload.ok) {
    return response({ authorized: false }, payload.status);
  }
  const parsed = sessionSchema.safeParse(payload.value);
  if (!parsed.success) {
    return response({ authorized: false }, 400);
  }
  if (!validFoodPackageInvite(parsed.data.passcode)) {
    return response({ authorized: false, mode: "locked" }, 401);
  }

  const token = createFoodPackageSessionToken();
  if (token === null) {
    return response({ authorized: false, mode: "unconfigured" }, 503);
  }
  const expiresAt = foodPackageSessionTokenExpiresAt(token);
  if (expiresAt === null) {
    return response({ authorized: false, mode: "unconfigured" }, 503);
  }

  return response(
    { authorized: true, expiresAt },
    200,
    { "Set-Cookie": foodPackageSessionCookie(token) }
  );
}
