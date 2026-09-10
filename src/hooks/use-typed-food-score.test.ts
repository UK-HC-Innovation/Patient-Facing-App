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

function aliasMatchResponse(description: string) {
  const base = matchResponse(description, 1);
  return { ...base, match: { ...base.match, basis: "alias" } };
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

  // Table S5 has no Coca-Cola row. The alias basis says the person's word and the row's
  // word are different on purpose, so their word is what the screen leads with (spec 30 R4).
  it("keeps the typed words as the display name when a reviewed alias resolved the row", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(aliasMatchResponse("Soft drink, cola"))));
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("coca-cola");
    });

    expect(outcome?.kind).toBe("match");
    expect(outcome?.kind === "match" ? outcome.match.readName : null).toBe("coca-cola");
    expect(outcome?.kind === "match" ? outcome.match.food.description : null).toBe("Soft drink, cola");
  });

  it("adds no display name when the row already carries the words that were typed", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(matchResponse("Banana, raw", 95))));
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("banana");
    });

    expect(outcome?.kind === "match" ? outcome.match.readName : "unset").toBeNull();
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

  // Spec 30 R5, A05. Items six and seven used to be sliced off inside the splitter, so no
  // caller could count them and a plate of seven was answered as if it were a plate of five.
  it("names what it could not score past the five-item cap", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(matchResponse("Rice, white", 40))))
    );
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("rice, beans, chicken, salad, bread, cake, soda");
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(outcome).toMatchObject({ kind: "plate", dropped: ["cake", "soda"] });
    expect(outcome?.kind === "plate" ? outcome.items : []).toHaveLength(5);
  });

  // Spec 30 R5, A14. Promise.all rejected the whole line into the catch below, which turned
  // a plate into a question and opened a paid voice session over one unreachable lookup.
  it("keeps a plate a plate when one item's lookup cannot run", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(matchResponse("Apple, raw", 95))))
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTypedFoodScore());

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      outcome = await result.current.submit("apple, banana");
    });

    expect(outcome?.kind).toBe("plate");
    const items = outcome?.kind === "plate" ? outcome.items : [];
    expect(items[0]).toMatchObject({ query: "apple" });
    expect(items[1]).toMatchObject({ query: "banana", match: null, failed: true });
  });

  it("re-runs one failed item without touching the rest of the plate", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(matchResponse("Apple, raw", 95))))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify(matchResponse("Banana, raw", 83))));
    const { result } = renderHook(() => useTypedFoodScore());

    await act(async () => {
      await result.current.submit("apple, banana");
    });
    await act(async () => {
      await result.current.retryItem("banana");
    });

    const items = result.current.result?.kind === "plate" ? result.current.result.items : [];
    expect(items[0].match?.food.description).toBe("Apple, raw");
    expect(items[1].match?.food.description).toBe("Banana, raw");
    expect(items[1].failed).toBe(false);
  });

  // Spec 30 R2, finding E12. The question branch returned before the abort, so an in-flight
  // lookup finished and replaced the very food the question was about.
  it("aborts an in-flight lookup when the next line is a question", async () => {
    let aborted = false;
    fetchMock.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );
    const { result } = renderHook(() => useTypedFoodScore());

    let first: TypedFoodResult | undefined;
    let question: TypedFoodResult | undefined;
    await act(async () => {
      const pending = result.current.submit("pizza").then((value) => {
        first = value;
      });
      question = await result.current.submit("how many calories?");
      await pending;
    });

    expect(aborted).toBe(true);
    expect(question).toEqual({ kind: "question", text: "how many calories?" });
    expect(first).toEqual({ kind: "superseded" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Spec 30 R1. A camera or barcode replacement advances the door's epoch, and a lookup that
  // captured the old one may not publish over it.
  it("supersedes its own result when the door's authority has moved on", async () => {
    let release: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => {
        release = resolve;
      })
    );
    let epoch = 0;
    const authority = {
      epoch,
      snapshot: () => epoch,
      isCurrent: (value: number) => value === epoch,
      invalidate: () => {
        epoch += 1;
        return epoch;
      }
    };
    const { result } = renderHook(() => useTypedFoodScore({ authority }));

    let outcome: TypedFoodResult | undefined;
    await act(async () => {
      const pending = result.current.submit("cheerios").then((value) => {
        outcome = value;
      });
      // The camera confirms a different food while the typed lookup is still out.
      authority.invalidate();
      release?.(new Response(JSON.stringify(matchResponse("Cereal, Cheerios", 77))));
      await pending;
    });

    expect(outcome).toEqual({ kind: "superseded" });
    expect(result.current.result).toBeNull();
  });
});
