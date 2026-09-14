import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CRISIS_ACTIONS } from "@/ai/safety-gate";
import { demoState } from "@/domain/fixtures";
import type { AppState } from "@/domain/types";
import PerinatalCheckPage from "./page";

const { context } = vi.hoisted(() => ({
  context: { state: {} as AppState, dispatch: vi.fn() }
}));
const dispatch = context.dispatch;

vi.mock("@/state/store", () => ({
  useHealthState: () => context
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  )
}));

async function submitPhq2(first: "Not at all" | "Nearly every day", second = "Not at all") {
  const user = userEvent.setup({ delay: null });
  await user.click(screen.getByRole("button", { name: "I understand — start" }));
  await user.click(screen.getAllByRole("radio", { name: first })[0]);
  await user.click(screen.getAllByRole("radio", { name: second })[1]);
  await user.click(screen.getByRole("button", { name: "Submit" }));
  return user;
}

async function openPhq9() {
  const user = await submitPhq2("Nearly every day");
  await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
  expect(screen.getByText(/longer mood check could help/i)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Continue to the 9-question check" }));
  await user.click(screen.getByRole("button", { name: "I understand — start the check-in" }));
  return user;
}

describe("perinatal check-in route", () => {
  beforeEach(() => {
    context.state = demoState;
    dispatch.mockReset();
  });

  it("ends after a below-threshold PHQ-2 result without opening PHQ-9", async () => {
    render(<PerinatalCheckPage />);

    expect(
      screen.getByText("Having a new baby is a lot. This 2-question check is for you, not just the baby.")
    ).toBeVisible();
    await submitPhq2("Not at all");

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: "addAssessmentEvent",
      event: { instrumentId: "phq2", itemResponses: [0, 0], totalScore: 0, severityBand: "negative" }
    });
    expect(screen.getByText(/did not reach the follow-up threshold/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /9-question/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "PHQ-9 mood check-in" })).not.toBeInTheDocument();
  });

  it("offers PHQ-9 only after showing a threshold PHQ-2 result", async () => {
    render(<PerinatalCheckPage />);
    const user = await submitPhq2("Nearly every day");

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/longer mood check could help/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue to the 9-question check" }));

    expect(screen.getByRole("button", { name: "I understand — start the check-in" })).toBeVisible();
  });

  it("renders Spanish framing and the routed below-threshold PHQ-2 result", async () => {
    const user = userEvent.setup({ delay: null });
    context.state = {
      ...demoState,
      patient: { ...demoState.patient, language: "es" }
    };
    render(<PerinatalCheckPage />);

    expect(
      screen.getByText("Tener un bebé nuevo es mucho. Este chequeo de 2 preguntas es para ti, no solo para el bebé.")
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Entiendo — comenzar" }));
    const zeroOptions = screen.getAllByRole("radio", { name: "Ningún día" });
    await user.click(zeroOptions[0]);
    await user.click(zeroOptions[1]);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/no alcanzaron el umbral de seguimiento/i)).toBeVisible();
  });

  it("adds OB or pediatrician guidance for a non-crisis PHQ-9 score of at least 10", async () => {
    render(<PerinatalCheckPage />);
    const user = await openPhq9();
    const highOptions = screen.getAllByRole("radio", { name: "Nearly every day" });
    const zeroOptions = screen.getAllByRole("radio", { name: "Not at all" });
    for (const option of highOptions.slice(0, 4)) {
      await user.click(option);
    }
    for (const option of zeroOptions.slice(4)) {
      await user.click(option);
    }
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
    expect(dispatch.mock.calls[1][0]).toMatchObject({
      type: "addAssessmentEvent",
      event: { instrumentId: "phq9", totalScore: 12, severityBand: "moderate" }
    });
    expect(
      screen.getByText("Talk with your OB or pediatrician — they expect this conversation.")
    ).toBeVisible();
  });

  it("records one event per instrument and only the shared crisis response when PHQ-9 item 9 is positive", async () => {
    render(<PerinatalCheckPage />);
    const user = await openPhq9();
    const zeroOptions = screen.getAllByRole("radio", { name: "Not at all" });
    for (const option of zeroOptions.slice(0, 8)) {
      await user.click(option);
    }
    await user.click(screen.getAllByRole("radio", { name: "Several days" })[8]);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(3));
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: "addAssessmentEvent",
      event: { instrumentId: "phq2", itemResponses: [3, 0], totalScore: 3 }
    });
    expect(dispatch.mock.calls[1][0]).toMatchObject({
      type: "addAssessmentEvent",
      event: { instrumentId: "phq9", itemResponses: [0, 0, 0, 0, 0, 0, 0, 0, 1], totalScore: 1 }
    });
    expect(dispatch.mock.calls[2][0]).toMatchObject({
      type: "addAiMessage",
      message: { safety: "crisis", actions: CRISIS_ACTIONS }
    });
    expect(screen.getByRole("link", { name: /Call 988/i })).toHaveAttribute("href", "tel:988");
    expect(screen.getByRole("link", { name: /Text 988/i })).toHaveAttribute("href", "sms:988");
    expect(screen.getByRole("link", { name: /Call 911/i })).toHaveAttribute("href", "tel:911");
    expect(screen.queryByText(/Having a new baby/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Thanks for checking in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/OB or pediatrician/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue|Submit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /PHQ-/i })).not.toBeInTheDocument();
  });
});
