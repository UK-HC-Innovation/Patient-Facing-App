import { z } from "zod";
import { normalizePackageFront, validatePackageNutrition } from "@/domain/package-scan";
import {
  FOOD_PACKAGE_MAX_BODY_BYTES,
  acquireFoodPackageConcurrencyLease,
  allowFoodPackageProviderRequest,
  authorizeFoodPackageRequest,
  foodPackageProviderConfig,
  foodPackageServiceStatus,
  readBoundedFoodPackageJson
} from "@/server/food-package-auth";
import {
  FOOD_PACKAGE_MAX_IMAGE_CHARS,
  callFoodPackageProvider,
  foodPackageProviderMetadata,
  responseOutputText,
  verifyFoodPackageImage
} from "@/server/food-package-vision";
import { packageLabelEvalHeaders } from "@/server/eval-attestation";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    kind: z.enum(["front", "nutrition"]),
    image: z.string().min(1).max(FOOD_PACKAGE_MAX_IMAGE_CHARS),
    patientId: z.string().min(1).max(200).optional()
  })
  .strict();

const NO_STORE = { "Cache-Control": "no-store" };

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      ...NO_STORE,
      ...packageLabelEvalHeaders(),
      ...headers
    }
  });
}

export async function POST(request: Request): Promise<Response> {
  const serviceStatus = foodPackageServiceStatus();
  if (serviceStatus !== "ready") {
    return response(
      { mode: serviceStatus },
      serviceStatus === "disabled" ? 200 : 503
    );
  }
  if (!authorizeFoodPackageRequest(request)) {
    return response({ mode: "locked" }, 401);
  }

  const raw = await readBoundedFoodPackageJson(request, FOOD_PACKAGE_MAX_BODY_BYTES);
  if (!raw.ok) return response({ mode: "error", message: "Invalid package scan request." }, raw.status);
  const parsed = requestSchema.safeParse(raw.value);
  if (!parsed.success) return response({ mode: "error", message: "Invalid package scan request." }, 400);
  const image = verifyFoodPackageImage(parsed.data.image);
  if (!image) return response({ mode: "error", message: "Use a clear JPEG photo and try again." }, 400);

  if (!allowFoodPackageProviderRequest(request)) {
    return response(
      { mode: "error", message: "Too many scans. Wait a minute and try again." },
      429,
      { "Retry-After": "60" }
    );
  }
  const lease = acquireFoodPackageConcurrencyLease(request);
  if (!lease) {
    return response(
      { mode: "error", message: "Another package scan is still running. Try again shortly." },
      429,
      { "Retry-After": "2" }
    );
  }

  let providerHeaders: Record<string, string> = {};
  try {
    const provider = foodPackageProviderConfig();
    if (!provider) return response({ mode: "unconfigured" }, 503);
    providerHeaders = {
      "X-Ladder-Package-Model": provider.model,
      "X-Ladder-Model-Complete": "0",
      "X-Ladder-Service-Tier": "unknown",
      "X-Ladder-Service-Tier-Complete": "0",
      "X-Ladder-Upstream-Calls": "1",
      "X-Ladder-Usage-Complete": "0"
    };
    const providerResponse = await callFoodPackageProvider({
      kind: parsed.data.kind,
      image,
      patientId: parsed.data.patientId,
      provider,
      requestSignal: request.signal
    });
    const metadata = foodPackageProviderMetadata(providerResponse, provider.model);
    providerHeaders = {
      ...providerHeaders,
      "X-Ladder-Package-Model": metadata.model,
      "X-Ladder-Model-Complete": metadata.modelComplete ? "1" : "0",
      "X-Ladder-Service-Tier": metadata.serviceTier,
      "X-Ladder-Service-Tier-Complete": metadata.serviceTierComplete ? "1" : "0",
      "X-Ladder-Usage-Complete": metadata.usage ? "1" : "0",
      ...(metadata.usage
        ? {
            "X-Ladder-Input-Tokens": String(metadata.usage.inputTokens),
            "X-Ladder-Output-Tokens": String(metadata.usage.outputTokens),
            "X-Ladder-Total-Tokens": String(metadata.usage.totalTokens)
          }
        : {})
    };
    const outputText = responseOutputText(providerResponse);
    if (!outputText) return response({ mode: "error", message: "The scan could not be read. Try again." }, 502, providerHeaders);

    let output: unknown;
    try {
      output = JSON.parse(outputText) as unknown;
    } catch {
      return response({ mode: "error", message: "The scan could not be read. Try again." }, 502, providerHeaders);
    }

    if (parsed.data.kind === "front") {
      const decision = normalizePackageFront(output);
      return decision.accepted
        ? response({ mode: "front", candidate: decision.candidate }, 200, providerHeaders)
        : response({ mode: "needs_rescan", kind: "front", reason: decision.reason }, 200, providerHeaders);
    }

    const decision = validatePackageNutrition(output);
    return decision.accepted
      ? response({ mode: "nutrition", draft: decision.draft }, 200, providerHeaders)
      : response({ mode: "needs_rescan", kind: "nutrition", reason: decision.reason }, 200, providerHeaders);
  } catch {
    return response({ mode: "error", message: "Package scanning is unavailable right now." }, 502, providerHeaders);
  } finally {
    lease.release();
  }
}
