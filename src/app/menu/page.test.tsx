import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuPage from "./page";

const mockValues = vi.hoisted(() => ({
  dispatch: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockValues.replace })
}));

vi.mock("@/state/store", async () => {
  const { demoState } = await vi.importActual<typeof import("@/domain/fixtures")>("@/domain/fixtures");
  return {
    useHealthState: () => ({
      state: demoState,
      dispatch: mockValues.dispatch
    })
  };
});

describe("MenuPage", () => {
  beforeEach(() => {
    mockValues.dispatch.mockClear();
    mockValues.replace.mockClear();
  });

  it("lets the phone user load the sample patient into the eye-screening walkthrough", () => {
    render(<MenuPage />);

    fireEvent.click(screen.getByRole("button", { name: "Load a sample patient (Brent)" }));

    expect(mockValues.dispatch).toHaveBeenCalledWith({ type: "resetDemo", patient: "brent" });
    expect(mockValues.replace).toHaveBeenCalledWith("/screening?entry=sms");
  });

  // Nothing loads a sample patient by default any more, so "Start over" has to mean
  // start over on nobody (critique H3, N1).
  it("starts over on an empty patient", () => {
    render(<MenuPage />);

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    expect(mockValues.dispatch).toHaveBeenCalledWith({ type: "resetDemo" });
    expect(mockValues.replace).toHaveBeenCalledWith("/today");
  });
});
