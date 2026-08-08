import { render, screen } from "@testing-library/react";
import React, { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brentState } from "@/domain/fixtures";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { AppState, FamilyNavigatorState } from "@/domain/types";
import { healthReducer } from "@/state/store";
import { FamilyExperience } from "@/components/family-experience";

const { push, requestFamilyInterview, requestFamilyRecommendations } = vi.hoisted(() => ({
  push: vi.fn(),
  requestFamilyInterview: vi.fn(),
  requestFamilyRecommendations: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/ai/family-interview-provider", () => ({ requestFamilyInterview }));
vi.mock("@/ai/family-recommend-provider", () => ({ requestFamilyRecommendations }));

/**
 * F3. Ladder ships two postures out of one codebase. The stakeholder demo keeps
 * the simulation — the waitlist seed, the pretend month, the movable visit —
 * because that apparatus is what is being shown. A build a real family touches
 * must not offer a control that looks like it booked an appointment.
 *
 * The flag defaults on, so these are the cases that could regress silently: the
 * off posture is the one nobody runs by hand.
 */
function withFamily(family: FamilyNavigatorState | null): AppState {
  return { ...brentState, family };
}

function Harness({ initialState }: { initialState: AppState }) {
  const [state, dispatch] = useReducer(healthReducer, initialState);
  return <FamilyExperience state={state} dispatch={dispatch} passcode="demo-passcode" />;
}

beforeEach(() => {
  requestFamilyInterview.mockReset();
  requestFamilyInterview.mockResolvedValue(null);
  requestFamilyRecommendations.mockReset();
  requestFamilyRecommendations.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the family posture (NEXT_PUBLIC_LADDER_SIM off)", () => {
  it("mounts no simulated care action anywhere on the page", () => {
    vi.stubEnv("NEXT_PUBLIC_LADDER_SIM", "0");
    render(<Harness initialState={withFamily(schoolAgeFamilyState)} />);

    // The waitlist seed and the month-skipper are the two that reach a family
    // from the front door.
    expect(screen.queryByTestId("family-referral-demo")).toBeNull();
    expect(screen.queryByTestId("family-checkin-demo")).toBeNull();

    // Nothing labelled as a demo control survives either.
    expect(screen.queryByRole("button", { name: /demo/i })).toBeNull();
  });

  it("still says plainly what Ladder does not do", () => {
    vi.stubEnv("NEXT_PUBLIC_LADDER_SIM", "0");
    render(<Harness initialState={withFamily(schoolAgeFamilyState)} />);

    expect(screen.getAllByText(/does not contact any clinic/i).length).toBeGreaterThan(0);
  });
});

describe("the stakeholder demo posture (default)", () => {
  it("keeps the simulation exactly as it was", () => {
    render(<Harness initialState={withFamily(schoolAgeFamilyState)} />);

    // The control that puts a family on a waitlist is the demo's way in, and
    // spec 20 kept it deliberately. If this goes red the default flipped.
    expect(screen.getByTestId("family-referral-demo")).toBeVisible();
  });
});
