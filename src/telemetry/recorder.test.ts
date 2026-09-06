import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetUsageRecorderForTests,
  __usageBufferForTests,
  recordUsage,
  setUsageContext,
  startUsageRecorder
} from "./recorder";
import { usageBatchSchema } from "@/domain/usage-event-schema";

type Sent = { body: string; via: "beacon" | "fetch" };

let sent: Sent[];

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

function batches() {
  return sent.map((entry) => JSON.parse(entry.body) as unknown);
}

beforeEach(() => {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push({ body: String(init.body), via: "fetch" });
      return new Response(null, { status: 204 });
    })
  );
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    writable: true,
    value: vi.fn((_url: string, blob: Blob) => {
      // jsdom Blobs do not expose text() synchronously, so capture what was serialised.
      sent.push({ body: (blob as Blob & { __text?: string }).__text ?? "", via: "beacon" });
      return true;
    })
  });
  const RealBlob = globalThis.Blob;
  vi.stubGlobal(
    "Blob",
    class extends RealBlob {
      __text: string;
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        this.__text = parts.map(String).join("");
      }
    }
  );
});

afterEach(() => {
  __resetUsageRecorderForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("usage recorder", () => {
  it("buffers before it starts, so events on the first paint are not lost", () => {
    recordUsage({ kind: "view", route: "today" });
    expect(__usageBufferForTests().events).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });

  it("stamps a monotonic sequence so a gap in the log reads as a dropped batch", () => {
    recordUsage({ kind: "view", route: "today" });
    recordUsage({ kind: "action", route: "today", action: "open_glucose" });
    recordUsage({ kind: "view", route: "glucose" });

    expect(__usageBufferForTests().events.map((event) => event.seq)).toEqual([0, 1, 2]);
  });

  it("sends a batch that satisfies the sink's own schema", () => {
    startUsageRecorder();
    setUsageContext({ lang: "es" });
    recordUsage({ kind: "view", route: "food_demo" });
    setVisibility("hidden");

    const [batch] = batches();
    expect(usageBatchSchema.safeParse(batch).success).toBe(true);
    expect(batch).toMatchObject({ lang: "es", surface: "full" });
  });

  it("flushes when the tab is backgrounded, which is the only unload signal mobile gives", () => {
    startUsageRecorder();
    recordUsage({ kind: "view", route: "today" });
    setVisibility("hidden");

    expect(sent).toHaveLength(1);
  });

  it("does not flush when the tab merely comes back into view", () => {
    startUsageRecorder();
    recordUsage({ kind: "view", route: "today" });
    setVisibility("visible");

    expect(sent).toHaveLength(0);
  });

  it("flushes once the buffer reaches the size threshold without waiting for the timer", () => {
    startUsageRecorder();
    for (let index = 0; index < 25; index += 1) {
      recordUsage({ kind: "view", route: "today" });
    }

    expect(sent).toHaveLength(1);
    expect(__usageBufferForTests().events).toHaveLength(0);
  });

  it("flushes on the interval so a quiet screen still reports", () => {
    vi.useFakeTimers();
    startUsageRecorder();
    recordUsage({ kind: "view", route: "today" });
    expect(sent).toHaveLength(0);

    vi.advanceTimersByTime(10_000);

    expect(sent).toHaveLength(1);
  });

  it("prefers sendBeacon when the page is going away", () => {
    startUsageRecorder();
    recordUsage({ kind: "view", route: "today" });
    window.dispatchEvent(new Event("pagehide"));

    expect(sent.map((entry) => entry.via)).toEqual(["beacon"]);
  });

  it("falls back to fetch when the browser has no sendBeacon", () => {
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: undefined });
    startUsageRecorder();
    recordUsage({ kind: "view", route: "today" });
    window.dispatchEvent(new Event("pagehide"));

    expect(sent.map((entry) => entry.via)).toEqual(["fetch"]);
  });

  it("drops the oldest events past the ceiling and reports the count rather than hiding it", () => {
    for (let index = 0; index < 205; index += 1) {
      recordUsage({ kind: "view", route: "today" });
    }

    const { events, dropped } = __usageBufferForTests();
    expect(events).toHaveLength(200);
    expect(dropped).toBe(5);
    expect(events[0].seq).toBe(5);
  });

  it("carries the drop count to the sink so a gap is visible in the report", () => {
    for (let index = 0; index < 205; index += 1) {
      recordUsage({ kind: "view", route: "today" });
    }
    startUsageRecorder();
    window.dispatchEvent(new Event("pagehide"));

    expect(batches()[0]).toMatchObject({ dropped: 5 });
  });

  it("does not queue a second listener or timer when started twice", () => {
    vi.useFakeTimers();
    startUsageRecorder();
    startUsageRecorder();
    recordUsage({ kind: "view", route: "today" });
    vi.advanceTimersByTime(10_000);

    expect(sent).toHaveLength(1);
  });

  it("swallows a transport failure instead of surfacing it to the app", () => {
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("blocked by extension"); }));
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: undefined });
    startUsageRecorder();

    expect(() => {
      recordUsage({ kind: "view", route: "today" });
      window.dispatchEvent(new Event("pagehide"));
    }).not.toThrow();
  });

  it("keeps a session id stable across the tab's events", () => {
    startUsageRecorder();
    recordUsage({ kind: "view", route: "today" });
    window.dispatchEvent(new Event("pagehide"));
    recordUsage({ kind: "view", route: "glucose" });
    window.dispatchEvent(new Event("pagehide"));

    const [first, second] = batches() as Array<{ session: string }>;
    expect(first.session).toBe(second.session);
    expect(first.session).toMatch(/^[a-z0-9][a-z0-9_.:-]{0,39}$/u);
  });
});
