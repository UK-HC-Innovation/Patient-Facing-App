import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { UsageBoundary } from "./usage-boundary";
import { __resetUsageRecorderForTests, __usageBufferForTests } from "./recorder";

let pathname = "/today";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname
}));

beforeEach(() => {
  __resetUsageRecorderForTests();
  pathname = "/today";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
});

afterEach(() => {
  __resetUsageRecorderForTests();
  vi.unstubAllGlobals();
});

describe("UsageBoundary", () => {
  it("records a view for the route it is mounted on", async () => {
    render(<UsageBoundary />);

    await waitFor(() => {
      expect(__usageBufferForTests().events).toEqual([
        expect.objectContaining({ kind: "view", route: "today" })
      ]);
    });
  });

  it("records the public Food Lens door under its own id, not as /food", async () => {
    pathname = "/food/demo";
    render(<UsageBoundary />);

    await waitFor(() => {
      expect(__usageBufferForTests().events).toEqual([
        expect.objectContaining({ kind: "view", route: "food_demo" })
      ]);
    });
  });

  it("reports an unrecognised path as unknown rather than emitting whatever is in it", async () => {
    pathname = "/patients/8f21-b7/summary";
    render(<UsageBoundary />);

    await waitFor(() => {
      expect(__usageBufferForTests().events).toEqual([
        expect.objectContaining({ kind: "view", route: "unknown" })
      ]);
    });
  });

  it("records a second view when the route changes", async () => {
    const view = render(<UsageBoundary />);
    await waitFor(() => expect(__usageBufferForTests().events).toHaveLength(1));

    pathname = "/glucose";
    view.rerender(<UsageBoundary />);

    await waitFor(() => {
      expect(__usageBufferForTests().events.map((event) => event.kind === "view" && event.route)).toEqual([
        "today",
        "glucose"
      ]);
    });
  });

  it("renders nothing, so it can sit in the root layout without affecting a single screen", () => {
    const { container } = render(<UsageBoundary />);

    expect(container).toBeEmptyDOMElement();
  });
});
