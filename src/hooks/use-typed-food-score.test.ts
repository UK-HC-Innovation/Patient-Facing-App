import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTypedFoodScore, type TypedFoodResult } from "./use-typed-food-score";

function matchResponse(description: string, fcs: number) {
  return {
    mode: "match",
    match: {
      food: { code: `code-${description}`, description, group: "grain" },
      tier: "T1",
      score: { fcs, band: fcs >= 70 ? "encourage" : "minimize", tier: "T1", ambiguous: false, range: null },
      alternatives: [],
      nutrients: null
    },
    candidates: []
  };
}

describe("useTypedFoodScore", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Brenda in the cereal aisle: no mic, no camera, one typed name.
  it("scores a typed food from the lookup route, with no session", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(matchResponse("Cereal, Cheerios Honey Nut", 58))));
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("honey nut cheerios");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/food/identify");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).text).toBe("honey nut cheerios");
    expect(outcome).toMatchObject({ kind: "match" });
    expect(result.current.result).toMatchObject({ kind: "match" });
  });

  // Darnell holding a pen. A question must never be spent on a lookup.
  it("classifies a question without calling the lookup at all", async () => {
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("how many units for this?");
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: "question", text: "how many units for this?" });
  });

  it("scores every item on a typed plate", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(matchResponse("Pizza, pepperoni", 22))))
      .mockResolvedValueOnce(new Response(JSON.stringify(matchResponse("Salad, with ranch", 61))))
      .mockResolvedValueOnce(new Response(JSON.stringify(matchResponse("Soft drink", 1))));
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit(
        "2 slices of pepperoni pizza, side salad with ranch, and a Mountain Dew"
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(outcome).toMatchObject({ kind: "plate" });
    expect(outcome?.kind === "plate" ? outcome.items : []).toHaveLength(3);
  });

  it("reports a plate nobody could match as a miss, not a plate of blanks", async () => {
    // A fresh Response per call: a body can only be read once.
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ mode: "none", candidates: [] })))
    );
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("bojangles combo, some other thing");
    });

    expect(outcome).toMatchObject({ kind: "none" });
  });

  it("passes a carve-out through rather than inventing a number", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mode: "carve_out", reason: "alcohol" })));
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("bourbon");
    });

    expect(outcome).toEqual({ kind: "carve_out", reason: "alcohol" });
  });

  // A lookup that could not run is not proof the food does not exist.
  it("falls back to asking when the lookup cannot run", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("cheerios");
    });

    expect(outcome).toMatchObject({ kind: "question" });
  });

  // A second ask must not let the first one open a session and send the line the person
  // has already replaced, or adopt a match they have moved on from.
  it("marks a lookup that a newer submission replaced", async () => {
    let release: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((resolve, reject) => {
          release = resolve;
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
    );
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify(matchResponse("Cereal, Cheerios", 77))))
    );
    const { result } = renderHook(() => useTypedFoodScore());

    let first: TypedFoodResult | undefined;
    let second: TypedFoodResult | undefined;
    await act(async () => {
      const pending = result.current.submit("fried chicken").then((value) => {
        first = value;
      });
      second = await result.current.submit("cheerios");
      release?.(new Response(JSON.stringify(matchResponse("Chicken, fried", 50))));
      await pending;
    });

    expect(first).toEqual({ kind: "superseded" });
    expect(second).toMatchObject({ kind: "match" });
  });
});
