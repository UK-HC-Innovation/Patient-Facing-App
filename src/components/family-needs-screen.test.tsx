import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { FamilyFact, FamilyScreenAnswer } from "@/domain/types";
import { FamilyNeedsScreen } from "./family-needs-screen";

const persistedAnswers: FamilyScreenAnswer[] = [
  { questionId: "family_early_intervention", domain: "early_intervention", response: "no" },
  { questionId: "family_therapies", domain: "therapies", response: "declined" },
  { questionId: "family_school_iep", domain: "school_iep", response: "yes" },
  { questionId: "family_waivers_financial", domain: "waivers_financial", response: "no" },
  { questionId: "family_respite", domain: "respite", response: "no" },
  { questionId: "family_parent_support", domain: "parent_support", response: "yes" },
  { questionId: "family_sibling_support", domain: "sibling_support", response: "no" },
  { questionId: "family_transportation", domain: "transportation", response: "no" }
];

describe("FamilyNeedsScreen", () => {
  it("renders eight semantic, re-entrant yes/no/declined questions", () => {
    render(<FamilyNeedsScreen language="en" initialAnswers={persistedAnswers} onSubmit={vi.fn()} />);

    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(8);
    expect(within(groups[1]).getByRole("radio", { name: "Prefer not to answer" })).toBeChecked();
    expect(within(groups[2]).getByRole("radio", { name: "Yes" })).toBeChecked();
  });

  it("submits all answers and localized facts together and announces the persisted save", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FamilyNeedsScreen language="es" initialAnswers={persistedAnswers} onSubmit={onSubmit} />);

    const firstQuestion = screen.getAllByRole("group")[0];
    await user.click(within(firstQuestion).getByRole("radio", { name: /S[ií]/ }));
    await user.click(screen.getByRole("button", { name: /Ver qué puede ayudar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [answers, facts] = onSubmit.mock.calls[0] as [FamilyScreenAnswer[], FamilyFact[]];
    expect(answers).toHaveLength(8);
    expect(answers[0].response).toBe("yes");
    expect(facts).toHaveLength(8);
    expect(facts.every(({ status }) => status === "patient_reported")).toBe(true);
    expect(facts[0].label).toMatch(/necesidad familiar/i);
    expect(facts[0].value).toMatch(/necesidad reportada/i);
    expect(facts[0].label).not.toMatch(/Family need/i);
    expect(screen.getByRole("status")).toHaveTextContent(/guardaron/i);
    expect(screen.getByRole("status")).toHaveFocus();
  });

  // F4a. This used to assert the opposite: the button stayed disabled until all
  // eight were answered, under copy that called them optional. The shorter path
  // exists for a caregiver who is running out of patience, and it was the one
  // place that demanded everything.
  it("submits with a partial set of answers, keeping only what was actually answered", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FamilyNeedsScreen language="en" initialAnswers={[]} onSubmit={onSubmit} />);

    const submit = screen.getByRole("button", { name: "See what can help" });
    expect(submit).toBeEnabled();

    const [first] = screen.getAllByRole("group");
    await user.click(within(first).getByRole("radio", { name: "Yes" }));
    await user.click(submit);

    const [answers, facts] = onSubmit.mock.calls[0];
    expect(answers).toHaveLength(1);
    expect(answers[0].response).toBe("yes");
    // An unanswered question contributes nothing rather than a silent "no".
    expect(facts).toHaveLength(1);
  });

  it("submits with no answers at all rather than trapping the caregiver", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FamilyNeedsScreen language="en" initialAnswers={[]} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "See what can help" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual([]);
  });
});
