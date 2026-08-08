import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useReducer } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { brentState } from "@/domain/fixtures";
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
 * F2. The review's sharpest finding was that a caregiver reporting their child
 * wanted to die was answered in the coach's first-person adult voice — asked
 * whether *they* felt unsafe, told to put things they might hurt themselves with
 * out of reach — while the same message was quietly filed as an ordinary note.
 *
 * These cases are written from the caregiver's side of that: what the words say,
 * and what the app keeps afterwards.
 */
const CAREGIVER_CRISIS = "My son told me he wants to die and I do not know what to do.";

function withFamily(family: FamilyNavigatorState | null): AppState {
  return { ...brentState, family };
}

function Harness() {
  const [state, dispatch] = useReducer(healthReducer, withFamily(null));
  return (
    <>
      <FamilyExperience state={state} dispatch={dispatch} passcode="demo-passcode" />
      <output data-testid="family-state">{JSON.stringify(state.family)}</output>
    </>
  );
}

function familyState(): FamilyNavigatorState {
  return JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
}

async function disclose(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const box = await screen.findByRole("textbox", { name: /what would you like help with/i });
  fireEvent.change(box, { target: { value: text } });
  await user.click(screen.getByRole("button", { name: /find help/i }));
}

beforeEach(() => {
  push.mockReset();
  requestFamilyInterview.mockReset();
  requestFamilyInterview.mockResolvedValue(null);
  requestFamilyRecommendations.mockReset();
  requestFamilyRecommendations.mockResolvedValue(null);
});

describe("a caregiver discloses a crisis about their child", { timeout: 20_000 }, () => {
  it("answers in words that fit the household rather than the coach's adult voice", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await disclose(user, CAREGIVER_CRISIS);

    const banner = await screen.findByTestId("family-crisis-banner");

    // The heading no longer asks the parent whether they feel unsafe.
    expect(within(banner).getByRole("heading", { name: "Someone may need urgent help" })).toBeVisible();
    expect(banner).not.toHaveTextContent(/Feeling unsafe right now/i);
    expect(banner).not.toHaveTextContent(/you may be going through something/i);
    expect(banner).not.toHaveTextContent(/hurt yourself out of reach/i);

    // It names both possibilities, because the detector reports a domain and
    // never a subject — it cannot know who is at risk.
    expect(banner).toHaveTextContent(/whether that is your child or you/i);

    // Every route the old copy offered is still one tap away.
    expect(within(banner).getByRole("link", { name: "Call 988 — Crisis Lifeline" })).toBeVisible();
    expect(within(banner).getByRole("link", { name: "Text 988" })).toBeVisible();
    expect(within(banner).getByRole("link", { name: "Call 911" })).toBeVisible();

    // And it says plainly what Ladder cannot do.
    expect(banner).toHaveTextContent(/cannot watch for this or contact anyone for you/i);
  });

  it("does not file the disclosure as a note, a fact, or anything a clinician would print", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await disclose(user, CAREGIVER_CRISIS);
    await screen.findByTestId("family-crisis-banner");

    const family = familyState();
    // The words are not kept: nothing to surface in the Journal, the Notes tab,
    // or the visit packet, and nothing left behind on a shared phone.
    expect(family.interviews).toEqual([]);
    expect(family.facts).toEqual([]);
    expect(JSON.stringify(family)).not.toContain("wants to die");

    // The event itself is still recorded — the audit trail is the one thing a
    // crisis turn does leave.
    expect(family.safetyEvents).toHaveLength(1);
  });

  it("does not present the disclosure back as an interpretation", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await disclose(user, CAREGIVER_CRISIS);
    await screen.findByTestId("family-crisis-banner");

    // No "Sounds like…" strip, no topic recap, no confirm-these-facts card.
    expect(screen.queryByTestId("family-heard-strip")).toBeNull();
    expect(screen.getByTestId("family-safety-no-interpretation")).toBeVisible();
  });

  it("keeps the urgent contacts reachable after the banner stands down", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await disclose(user, CAREGIVER_CRISIS);

    const banner = await screen.findByTestId("family-crisis-banner");
    expect(banner).toHaveTextContent(/reopen these contacts any time/i);

    await user.click(
      within(banner).getByRole("button", { name: "I understand — return to Ladder" })
    );
    await waitFor(() => expect(screen.queryByTestId("family-crisis-banner")).toBeNull());

    // The banner is gone; the way back is not. This is the whole of F2c: the old
    // acknowledge button removed every 988/911 route with nothing saying how to
    // get them back.
    const control = screen.getByTestId("family-urgent-help-control");
    await user.click(control);
    const panel = screen.getByTestId("family-urgent-help-panel");
    expect(within(panel).getByRole("link", { name: "Call 988 — Crisis Lifeline" })).toBeVisible();
    expect(within(panel).getByRole("link", { name: "Call 911" })).toBeVisible();
  });

  it("moves focus to the alert instead of leaving the caret below it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await disclose(user, CAREGIVER_CRISIS);

    const banner = await screen.findByTestId("family-crisis-banner");
    await waitFor(() =>
      expect(document.activeElement).toBe(within(banner).getByRole("heading", { level: 2 }))
    );
  });

  it("still routes a disclosure that also names a developmental concern", async () => {
    // Spec 11's motivating case in miniature: suppressing everything would answer
    // a caregiver's hardest message with a blank page.
    const user = userEvent.setup();
    render(<Harness />);
    await disclose(
      user,
      "My son was kicked out of school again for hitting, and he has hurt our cat. He is 7."
    );

    await screen.findByTestId("family-crisis-banner");
    const family = familyState();
    expect(family.activeDomains.length).toBeGreaterThan(0);
    // Routing survived, but the words still were not written down.
    expect(family.interviews).toEqual([]);
  });
});
