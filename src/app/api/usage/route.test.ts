import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const validBatch = {
  session: "s7f2a913c",
  surface: "full",
  build: "6181f82",
  lang: "en",
  viewport: "narrow",
  startedAt: "2026-09-06T12:00:00.000Z",
  dropped: 0,
  events: [
    { seq: 0, at: 0, kind: "view", route: "today" },
    {
      seq: 1,
      at: 812,
      kind: "decision",
      decision: "crisis_gate",
      outcome: "matched",
      source: "deterministic",
      tags: ["self_harm.explicit"],
      inputSignature: "3a9f01bc",
      latencyMs: 2
    }
  ]
};

let lines: string[];
let log: ReturnType<typeof vi.spyOn>;

function post(body: BodyInit, headers: Record<string, string> = { "Content-Type": "application/json" }) {
  return POST(new Request("https://example.test/api/usage", { method: "POST", headers, body }));
}

function parsed(): Array<Record<string, unknown>> {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

beforeEach(() => {
  lines = [];
  log = vi.spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(line);
  });
});

afterEach(() => {
  log.mockRestore();
});

describe("POST /api/usage", () => {
  it("writes one line per event with the envelope flattened onto each", async () => {
    const response = await post(JSON.stringify(validBatch));

    expect(response.status).toBe(204);
    expect(lines).toHaveLength(2);
    expect(parsed()[0]).toMatchObject({
      log: "usage",
      session: "s7f2a913c",
      build: "6181f82",
      surface: "full",
      kind: "view",
      route: "today"
    });
    expect(parsed()[1]).toMatchObject({
      session: "s7f2a913c",
      kind: "decision",
      decision: "crisis_gate",
      outcome: "matched",
      tags: ["self_harm.explicit"]
    });
  });

  it("stamps a server-side receive time so client clock skew never reorders the feed", async () => {
    await post(JSON.stringify(validBatch));
    for (const line of parsed()) {
      expect(typeof line.receivedAt).toBe("string");
    }
  });

  it("rejects the whole batch when one event is malformed, rather than recording the rest", async () => {
    const poisoned = {
      ...validBatch,
      events: [
        validBatch.events[0],
        { seq: 1, at: 1, kind: "action", route: "chat", action: "I have chest pain" }
      ]
    };

    const response = await post(JSON.stringify(poisoned));

    expect(response.status).toBe(204);
    expect(parsed()).toEqual([
      expect.objectContaining({ log: "usage", event: "batch_rejected", reason: "schema" })
    ]);
  });

  it("names the failing path but never echoes the value that failed", async () => {
    await post(
      JSON.stringify({
        ...validBatch,
        events: [{ seq: 0, at: 0, kind: "action", route: "chat", action: "ending my life" }]
      })
    );

    const [line] = parsed();
    expect(line.paths).toEqual(["events.0.action"]);
    expect(JSON.stringify(line)).not.toContain("ending my life");
  });

  it("refuses a body over the size bound without parsing it", async () => {
    const response = await post(JSON.stringify({ ...validBatch, pad: "x".repeat(70_000) }));

    expect(response.status).toBe(204);
    expect(parsed()).toEqual([
      expect.objectContaining({ event: "batch_rejected", reason: "unreadable" })
    ]);
  });

  it.each([
    ["a non-JSON media type", "not-json", { "Content-Type": "text/plain" }],
    ["a body that is not JSON at all", "{{{", { "Content-Type": "application/json" }]
  ])("refuses %s", async (_name, body, headers) => {
    const response = await post(body, headers);

    expect(response.status).toBe(204);
    expect(parsed()).toEqual([
      expect.objectContaining({ event: "batch_rejected", reason: "unreadable" })
    ]);
  });

  it("answers 204 with no body so a caller learns nothing about the schema", async () => {
    const response = await post(JSON.stringify(validBatch));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
  });
});
