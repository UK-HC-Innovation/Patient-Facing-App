import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { familyDraftStorageKey, saveFamilyDraft } from "@/state/family-draft-storage";
import { useFamilyDraftPersistence } from "./use-family-draft-persistence";

beforeEach(() => localStorage.clear());

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useFamilyDraftPersistence", () => {
  it("batches rapid edits into one small recovery write before checkpointing AppState", () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const dispatch = vi.fn();
    const { result, rerender } = renderHook(
      ({ draft }) => useFamilyDraftPersistence("patient-draft", draft, dispatch),
      { initialProps: { draft: "" } }
    );

    act(() => {
      for (let index = 1; index <= 100; index += 1) {
        result.current.schedule(index === 100 ? "A longer draft" : `Draft ${index}`);
      }
      vi.advanceTimersByTime(249);
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(familyDraftStorageKey("patient-draft"))).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).not.toHaveBeenCalled();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(familyDraftStorageKey("patient-draft")) ?? "null")).toMatchObject({
      version: 1,
      patientId: "patient-draft",
      draft: "A longer draft"
    });

    act(() => vi.advanceTimersByTime(1750));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setFamilyInterviewDraft",
      draft: "A longer draft"
    });

    rerender({ draft: "A longer draft" });
    expect(localStorage.getItem(familyDraftStorageKey("patient-draft"))).toBeNull();
    act(() => {
      result.current.schedule("A longer draft");
      vi.runOnlyPendingTimers();
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("recovers a newer scoped draft once when the Ladder composer mounts", () => {
    saveFamilyDraft("patient-draft", "Recovered after a reload");
    const dispatch = vi.fn();
    const { rerender } = renderHook(() =>
      useFamilyDraftPersistence("patient-draft", "", dispatch)
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: "setFamilyInterviewDraft",
      draft: "Recovered after a reload"
    });
    rerender();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("can cancel a pending write when the draft is submitted", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useFamilyDraftPersistence("patient-draft", "", dispatch)
    );

    act(() => {
      result.current.schedule("Submitted words");
      result.current.cancel();
      vi.runOnlyPendingTimers();
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(familyDraftStorageKey("patient-draft")) ?? "null")).toMatchObject({
      status: "cleared"
    });
  });

  it("recovers a cleared tombstone over an older full-state draft", () => {
    saveFamilyDraft("patient-draft", "");
    const dispatch = vi.fn();
    renderHook(() => useFamilyDraftPersistence("patient-draft", "Old checkpoint", dispatch));

    expect(dispatch).toHaveBeenCalledWith({
      type: "setFamilyInterviewDraft",
      draft: ""
    });
  });

  it("flushes both recovery text and AppState when the page is leaving", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useFamilyDraftPersistence("patient-draft", "", dispatch)
    );

    act(() => {
      result.current.schedule("Keep this note");
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setFamilyInterviewDraft",
      draft: "Keep this note"
    });
    expect(JSON.parse(localStorage.getItem(familyDraftStorageKey("patient-draft")) ?? "null")).toMatchObject({
      draft: "Keep this note"
    });
  });
});
