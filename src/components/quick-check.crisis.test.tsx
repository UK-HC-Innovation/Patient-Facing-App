import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CRISIS_ACTIONS } from "@/ai/safety-gate";
import { demoState } from "@/domain/fixtures";
import { tSafety } from "@/i18n/strings";
import { QuickCheck } from "./quick-check";

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn() }));

vi.mock("@/state/store", () => ({
  useHealthState: () => ({ state: demoState, dispatch })
}));

describe("QuickCheck crisis path", () => {
  beforeEach(() => dispatch.mockReset());

  it("records PHQ-2 then terminates after a positive PHQ-9 item 9 through the frozen crisis seam", async () => {
    const user = userEvent.setup({ delay: null });
    render(<QuickCheck />);

    await user.click(screen.getByRole("button", { name: "I understand — start" }));
    await user.click(screen.getAllByRole("radio", { name: "Nearly every day" })[0]);
    await user.click(screen.getAllByRole("radio", { name: "Not at all" })[1]);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: "addAssessmentEvent",
      event: { instrumentId: "phq2", itemResponses: [3, 0], totalScore: 3, severityBand: "positive" }
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "I understand — start the check-in" }));
    const zeroOptions = screen.getAllByRole("radio", { name: "Not at all" });
    for (const option of zeroOptions.slice(0, 8)) {
      await user.click(option);
    }
    await user.click(screen.getAllByRole("radio", { name: "Several days" })[8]);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(3));
    expect(dispatch.mock.calls[1][0]).toMatchObject({
      type: "addAssessmentEvent",
      event: { instrumentId: "phq9", itemResponses: [0, 0, 0, 0, 0, 0, 0, 0, 1], totalScore: 1 }
    });
    expect(dispatch.mock.calls[2][0]).toMatchObject({
      type: "addAiMessage",
      message: { content: tSafety("en", "crisisResponse"), safety: "crisis", actions: CRISIS_ACTIONS }
    });
    expect(screen.getByRole("link", { name: /Call 988/i })).toHaveAttribute("href", "tel:988");
    expect(screen.getByRole("link", { name: /Text 988/i })).toHaveAttribute("href", "sms:988");
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Check \d of 5/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing you reported/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kentucky food resources" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit/ })).not.toBeInTheDocument();
  });
});
