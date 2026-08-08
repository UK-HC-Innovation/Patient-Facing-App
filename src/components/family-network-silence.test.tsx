import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useReducer } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { brentState } from "@/domain/fixtures";
import { SAMPLE_CAREGIVER_TEXT, schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { AppState, FamilyNavigatorState } from "@/domain/types";
import { healthReducer } from "@/state/store";
import { FamilyExperience } from "@/components/family-experience";

/**
 * F1a's proof, and the reason it lives in its own file: every other Ladder suite
 * does `vi.mock("@/ai/family-interview-provider")`, so a "nothing was sent"
 * assertion inside them would pass whether or not the gate exists — the module
 * that owns `fetch` is not even loaded. Here the real providers run and `fetch`
 * itself is the spy, which is the only place the promise ("nothing is sent
 * unless you turn on the online helper") can actually be checked.
 *
 * Note the shape of the pair below. The silence test alone would be vacuous: it
 * would also pass if the composer never submitted, or if the render died early.
 * The consented test is its control — same interaction, same fixture, one flag
 * different — so a passing pair means the send is gated, not merely absent.
 */
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fetchSpy = vi.fn();

function withFamily(family: FamilyNavigatorState | null): AppState {
  return { ...brentState, family };
}

function Harness({
  consent,
  passcode
}: {
  consent: "unset" | "granted" | "declined";
  passcode?: string;
}) {
  const [state, dispatch] = useReducer(healthReducer, withFamily(null));
  return (
    <FamilyExperience
      state={state}
      dispatch={dispatch}
      passcode={passcode}
      initialAiConsent={consent}
    />
  );
}

async function describeTheChild(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const box = await screen.findByRole("textbox", { name: /what would you like help with/i });
  // fireEvent rather than user.type: this file is about which requests leave the
  // page, not about keystroke handling, and typing the whole sample character by
  // character is slow enough to make the suite's timing flakier under load.
  fireEvent.change(box, { target: { value: SAMPLE_CAREGIVER_TEXT } });
  await user.click(screen.getByRole("button", { name: /find help/i }));
}

beforeEach(() => {
  fetchSpy.mockReset();
  // Any real call would reach the family routes; answer as an unconfigured
  // deployment so a leak shows up as a spy call rather than a crash.
  fetchSpy.mockResolvedValue({
    ok: true,
    json: async () => ({ mode: "unconfigured", data: null })
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function familyRouteCalls(): string[] {
  return fetchSpy.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/family/"));
}

// Typing the full caregiver sample through userEvent is slow, and slower still
// when the whole suite is running in parallel — the same reason page.test.tsx
// carries a raised timeout.
describe("Ladder network silence", { timeout: 20_000 }, () => {
  it("sends nothing at all when the caregiver has not accepted the online helper", async () => {
    const user = userEvent.setup();
    render(<Harness consent="unset" passcode="demo-passcode" />);

    await describeTheChild(user);

    // The answer still arrives — the on-device extractor carries the whole flow.
    await screen.findByTestId("family-heard-strip");
    expect(familyRouteCalls()).toEqual([]);

    // And the ask is on screen rather than assumed.
    expect(screen.getByTestId("family-ai-consent")).toBeVisible();
  });

  it("sends nothing when the caregiver declines, and says so", async () => {
    const user = userEvent.setup();
    render(<Harness consent="declined" passcode="demo-passcode" />);

    await describeTheChild(user);

    await screen.findByTestId("family-heard-strip");
    expect(familyRouteCalls()).toEqual([]);
    expect(screen.queryByTestId("family-ai-consent")).toBeNull();
    expect(screen.getByTestId("family-ai-declined")).toBeVisible();
  });

  it("sends nothing when the deployment has no passcode, whatever the consent says", async () => {
    const user = userEvent.setup();
    render(<Harness consent="granted" passcode={undefined} />);

    await describeTheChild(user);

    await screen.findByTestId("family-heard-strip");
    expect(familyRouteCalls()).toEqual([]);
  });

  it("does send once the caregiver has accepted — the control that keeps the others honest", async () => {
    const user = userEvent.setup();
    render(<Harness consent="granted" passcode="demo-passcode" />);

    await describeTheChild(user);

    await waitFor(() => expect(familyRouteCalls().length).toBeGreaterThan(0));
    expect(familyRouteCalls().some((url) => url.includes("/api/family/interview"))).toBe(true);
  });

  it("keeps a returning family's stored narrative off the ranking route on mount", async () => {
    // The recommend call is an effect, not a submit handler: a returning visitor
    // with a stored interview and no stored ranking used to POST on page load,
    // with no action of their own and no chance to be asked.
    // The fixture alone is not enough, and this test used to prove nothing
    // because of it: schoolAgeFamilyState carries no interviews and no active
    // domains, so the ranking effect dies at its first guard and never reaches
    // the gate. A mutation test confirmed it — deleting the entire gate left the
    // whole suite green. The state below is the one that actually reaches it.
    const returning: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep"],
      latestInterviewDomains: ["school_iep"],
      interviews: [
        {
          id: "interview-returning",
          rawText: SAMPLE_CAREGIVER_TEXT,
          source: "typed",
          createdAt: "2026-07-01T12:00:00.000Z",
          extraction: "mock",
          kind: "orientation"
        }
      ],
      recommendations: null
    };
    render(
      <FamilyExperience
        state={withFamily(returning)}
        dispatch={vi.fn()}
        passcode="demo-passcode"
        initialAiConsent="unset"
      />
    );

    await screen.findByTestId("ladder-tabs");
    await waitFor(() => expect(familyRouteCalls()).toEqual([]));
  });
});
