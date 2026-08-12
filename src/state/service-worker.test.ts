import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerRequest = {
  method: string;
  mode: string;
  url: string;
};

type WorkerHarnessOptions = {
  cache: {
    match: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
  fetch: ReturnType<typeof vi.fn>;
  open?: ReturnType<typeof vi.fn>;
};

const workerSource = readFileSync(
  resolve(process.cwd(), "public", "sw.js"),
  "utf8"
);

function workerHarness({ cache, fetch, open = vi.fn().mockResolvedValue(cache) }: WorkerHarnessOptions) {
  const handlers = new Map<string, (event: unknown) => void>();
  const workerSelf = {
    location: { origin: "https://ladder.test" },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn()
    },
    addEventListener: vi.fn((name: string, handler: (event: unknown) => void) => {
      handlers.set(name, handler);
    })
  };

  runInNewContext(workerSource, {
    self: workerSelf,
    caches: {
      open,
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn()
    },
    fetch,
    URL,
    Promise,
    Set
  });

  return {
    fetch(request: WorkerRequest): Promise<unknown> {
      const handler = handlers.get("fetch");
      if (!handler) throw new Error("Worker did not register a fetch handler");
      let response: Promise<unknown> | undefined;
      handler({
        request,
        respondWith(value: Promise<unknown>) {
          response = Promise.resolve(value);
        }
      });
      if (!response) throw new Error("Worker did not handle the request");
      return response;
    }
  };
}

function networkResponse() {
  return {
    ok: true,
    type: "basic",
    clone: vi.fn().mockReturnValue({ copy: true })
  };
}

describe("Ladder service worker cache failures", () => {
  it("returns a static network response when cache.put rejects", async () => {
    const network = networkResponse();
    const cache = {
      match: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockRejectedValue(new Error("Quota exceeded"))
    };
    const fetch = vi.fn().mockResolvedValue(network);
    const worker = workerHarness({ cache, fetch });

    await expect(worker.fetch({
      method: "GET",
      mode: "no-cors",
      url: "https://ladder.test/_next/static/chunk.js"
    })).resolves.toBe(network);
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it("returns a fresh navigation instead of stale cache when cache.put rejects", async () => {
    const network = networkResponse();
    const stale = { ok: true, type: "basic", stale: true };
    const cache = {
      match: vi.fn().mockResolvedValue(stale),
      put: vi.fn().mockRejectedValue(new Error("Cache blocked"))
    };
    const fetch = vi.fn().mockResolvedValue(network);
    const worker = workerHarness({ cache, fetch });

    await expect(worker.fetch({
      method: "GET",
      mode: "navigate",
      url: "https://ladder.test/ladder?surface=resources"
    })).resolves.toBe(network);
    expect(cache.put).toHaveBeenCalledWith("/ladder", expect.anything());
    expect(cache.match).not.toHaveBeenCalled();
  });

  it("keeps successful network requests usable when CacheStorage cannot open", async () => {
    const network = networkResponse();
    const cache = { match: vi.fn(), put: vi.fn() };
    const fetch = vi.fn().mockResolvedValue(network);
    const open = vi.fn().mockRejectedValue(new Error("CacheStorage disabled"));
    const worker = workerHarness({ cache, fetch, open });

    await expect(worker.fetch({
      method: "GET",
      mode: "navigate",
      url: "https://ladder.test/ladder"
    })).resolves.toBe(network);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
