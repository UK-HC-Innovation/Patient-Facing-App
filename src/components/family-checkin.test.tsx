import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import { FamilyCheckin } from "./family-checkin";

function renderCheckin(overrides: Partial<React.ComponentProps<typeof FamilyCheckin>> = {}) {
  const props: React.ComponentProps<typeof FamilyCheckin> = {
    family: schoolAgeFamilyState,
    language: "en",
    onOpenNote: vi.fn(),
    onProbeAnswer: vi.fn(),
    onPulse: vi.fn(),
    onSkip: vi.fn(),
    ...overrides
  };
  return { ...render(<FamilyCheckin {...props} />), props };
}

describe("FamilyCheckin", () => {
  it("opens on the note invite with the child's name", () => {
    renderCheckin();

    expect(screen.getByRole("heading", { name: "Monthly check-in" })).toBeVisible();
    expect(
      screen.getByText("It's been about a month. Anything new or different with Riley?")
    ).toBeVisible();
    expect(screen.getByTestId("family-checkin")).toHaveAttribute("id", "family-checkin");
  });

  it("falls back to a generic name when the profile has none", () => {
    renderCheckin({
      family: {
        ...schoolAgeFamilyState,
        profile: { ...schoolAgeFamilyState.profile!, childFirstName: "  " }
      }
    });

    expect(
      screen.getByText("It's been about a month. Anything new or different with your child?")
    ).toBeVisible();
  });

  // The three parts are strictly sequential: exactly one question is on screen.
  it("walks Nothing new to the probe and No to the pulse", async () => {
    const user = userEvent.setup();
    const { props } = renderCheckin();

    await user.click(screen.getByRole("button", { name: "Nothing new" }));

    expect(
      screen.getByText(
        "Compared with a few months ago, has Riley lost any skills — words, movements, things they could do?"
      )
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Nothing new" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "No" }));

    expect(props.onProbeAnswer).toHaveBeenCalledWith("no");
    expect(screen.getByText("How supported do you feel this month?")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Yes, I think so" })).toBeNull();
  });

  it("hands the standing note box over and queues the probe behind it", async () => {
    const user = userEvent.setup();
    const { props } = renderCheckin();

    await user.click(screen.getByRole("button", { name: "Add a note" }));

    expect(props.onOpenNote).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("family-checkin")).toHaveAttribute("data-checkin-part", "probe");
  });

  // "Not sure" is not an answer — it is a request for examples, cited.
  it("shows the cited examples for Not sure without answering the probe", async () => {
    const user = userEvent.setup();
    const { props } = renderCheckin();

    await user.click(screen.getByRole("button", { name: "Nothing new" }));
    await user.click(screen.getByRole("button", { name: "Not sure" }));

    expect(props.onProbeAnswer).not.toHaveBeenCalled();
    expect(screen.getByTestId("family-checkin-probe-examples")).toBeVisible();
    expect(
      screen.getByText(
        "Skill loss can look like: words that stopped, waving or pointing that went away, or steps backward in things like feeding or stairs."
      )
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Source: CDC, Learn the Signs. Act Early." })
    ).toHaveAttribute("href", "https://www.cdc.gov/act-early/");
    expect(screen.queryByRole("button", { name: "Not sure" })).toBeNull();
    expect(screen.getByRole("button", { name: "Yes, I think so" })).toBeVisible();
  });

  it("reports a yes from the probe", async () => {
    const user = userEvent.setup();
    const { props } = renderCheckin();

    await user.click(screen.getByRole("button", { name: "Nothing new" }));
    await user.click(screen.getByRole("button", { name: "Yes, I think so" }));

    expect(props.onProbeAnswer).toHaveBeenCalledWith("yes");
  });

  it("records a pulse tap and collapses to the thanks line", async () => {
    const user = userEvent.setup();
    const { props } = renderCheckin();

    await user.click(screen.getByRole("button", { name: "Nothing new" }));
    await user.click(screen.getByRole("button", { name: "No" }));
    await user.click(screen.getByRole("button", { name: "4" }));

    expect(props.onPulse).toHaveBeenCalledWith(4);
    expect(screen.getByText("Thanks — see you next month.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Skip check-in" })).toBeNull();
    expect(screen.getByTestId("family-checkin")).toHaveAttribute("data-checkin-part", "done");
  });

  it("skips from any part, including the pulse's own skip", async () => {
    const user = userEvent.setup();
    const first = renderCheckin();
    await user.click(screen.getByRole("button", { name: "Skip check-in" }));
    expect(first.props.onSkip).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderCheckin();
    await user.click(screen.getByRole("button", { name: "Nothing new" }));
    await user.click(screen.getByRole("button", { name: "Skip check-in" }));
    expect(second.props.onSkip).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "No" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(second.props.onSkip).toHaveBeenCalledTimes(2);
    expect(second.props.onPulse).not.toHaveBeenCalled();
  });

  it("keeps every answer tappable and focusable", () => {
    renderCheckin();

    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("min-h-12");
      expect(button.className).toContain("focus-visible:outline");
    }
  });

  it("renders the Spanish check-in", async () => {
    const user = userEvent.setup();
    renderCheckin({ language: "es" });

    expect(screen.getByRole("heading", { name: "Chequeo mensual" })).toBeVisible();
    expect(screen.getByText("Ha pasado como un mes. ¿Algo nuevo o diferente con Riley?")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Nada nuevo" }));

    expect(
      screen.getByText(
        "Comparado con hace unos meses, ¿Riley ha perdido habilidades — palabras, movimientos, cosas que ya hacía?"
      )
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Omitir el chequeo" })).toBeVisible();
  });
});
