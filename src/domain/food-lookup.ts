import { normalizeFdcFood, normalizeOffProduct, withSource } from "./food-normalize";
import type { IdentifiedFood } from "./types";

export type FoodLookupResult = { found: true; food: IdentifiedFood } | { found: false };

export type FoodLookupDeps = {
  fetchImpl?: typeof fetch;
  cache: Map<string, IdentifiedFood>;
  seed: Record<string, IdentifiedFood>;
  fdcApiKey: string | null;
  signal?: AbortSignal;
};

const OFF_TIMEOUT_MS = 3500;
const FDC_TIMEOUT_MS = 3500;

function throwIfRequestAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("The barcode lookup was aborted.", "AbortError");
  }
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  requestSignal?: AbortSignal
): Promise<unknown | null> {
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(requestSignal?.reason);
  if (requestSignal?.aborted) abortFromRequest();
  else requestSignal?.addEventListener("abort", abortFromRequest, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("barcode_lookup_timeout")), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    throwIfRequestAborted(requestSignal);
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as unknown;
    throwIfRequestAborted(requestSignal);
    return json;
  } catch {
    throwIfRequestAborted(requestSignal);
    return null;
  } finally {
    clearTimeout(timeout);
    requestSignal?.removeEventListener("abort", abortFromRequest);
  }
}

async function lookupOff(fetchImpl: typeof fetch, barcode: string, signal?: AbortSignal): Promise<IdentifiedFood | null> {
  const json = await fetchJson(fetchImpl, `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, OFF_TIMEOUT_MS, signal);
  return json ? normalizeOffProduct(barcode, json) : null;
}

async function lookupFdc(fetchImpl: typeof fetch, barcode: string, apiKey: string, signal?: AbortSignal): Promise<IdentifiedFood | null> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${barcode}&dataType=Branded&pageSize=5&api_key=${apiKey}`;
  const json = await fetchJson(fetchImpl, url, FDC_TIMEOUT_MS, signal);
  return json ? normalizeFdcFood(barcode, json) : null;
}

export async function resolveBarcode(barcode: string, deps: FoodLookupDeps): Promise<FoodLookupResult> {
  throwIfRequestAborted(deps.signal);
  const cached = deps.cache.get(barcode);
  if (cached) {
    return { found: true, food: cached };
  }

  const seeded = deps.seed[barcode];
  if (seeded) {
    deps.cache.set(barcode, seeded);
    return { found: true, food: seeded };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;

  const off = await lookupOff(fetchImpl, barcode, deps.signal);
  if (off) {
    deps.cache.set(barcode, off);
    return { found: true, food: off };
  }

  if (deps.fdcApiKey) {
    throwIfRequestAborted(deps.signal);
    const fdc = await lookupFdc(fetchImpl, barcode, deps.fdcApiKey, deps.signal);
    if (fdc) {
      const normalized = withSource(fdc, "barcode_fdc");
      deps.cache.set(barcode, normalized);
      return { found: true, food: normalized };
    }
  }

  return { found: false };
}
