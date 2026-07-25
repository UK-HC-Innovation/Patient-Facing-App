import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import { FamilyCheckin, type CheckinPart } from "./family-checkin";

// The page owns the sequence position, so the tests do too: this harness stands
// in for FamilyExperience's checkinPart state.
type CheckinFixedProps = Omit<React.ComponentProps<typeof FamilyCheckin>, "part" | "onPartChange">;

function renderCheckin(
  overrides: Partial<CheckinFixedProps> & { initialPart?: CheckinPart } = {}
) {
  const { initialPart = "note", ...rest } = overrides;
  const props: CheckinFixedProps = {
    family: schoolAgeFamilyState,
    language: "en",
    resuming: false,
    onOpenNote: vi.fn(),
    onProbeAnswer: vi.fn(),
    onPulse: vi.fn(),
    onSkip: vi.fn(),
    ...rest
  };

  function Harness() {
    const [part, setPart] = useState<CheckinPart>(initialPart);
    return <FamilyCheckin {...props} part={part} onPartChange={setPart} />;
  }

  return { ...render(<Harness />), props };
}

function liveTurn(): HTMLElement {
  return screen.getByTestId("family-checkin-live-turn");
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

  // The page can hand the card back at any part — it never restarts at the top.
  it("starts wherever the page says the sequence stands", () => {
    renderCheckin({ initialPart: "pulse" });

    expect(screen.getByText("How supported do you feel this month?")).toBeVisible();
    expect(
      screen.queryByText("It's been about a month. Anything new or different with Riley?")
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Yes, I think so" })).toBeNull();
  });

  describe("focus and announcement", () => {
    it("announces the question that replaced the button in a polite live region", async () => {
      const user = userEvent.setup();
      renderCheckin();

      expect(liveTurn()).toHaveAttribute("aria-live", "polite");
      expect(liveTurn()).toHaveClass("sr-only");
      expect(liveTurn()).toHaveTextContent(
        "Monthly check-in: It's been about a month. Anything new or different with Riley?"
      );

      await user.click(screen.getByRole("button", { name: "Nothing new" }));
      expect(liveTurn()).toHaveTextContent(
        "Monthly check-in: Compared with a few months ago, has Riley lost any skills"
      );

      await user.click(screen.getByRole("button", { name: "No" }));
      expect(liveTurn()).toHaveTextContent("Monthly check-in: How supported do you feel this month?");
    });

    it("announces the cited examples when the caregiver asks what skill loss looks like", async () => {
      const user = userEvent.setup();
      renderCheckin();

      await user.click(screen.getByRole("button", { name: "Nothing new" }));
      await user.click(screen.getByRole("button", { name: "Not sure" }));

      expect(liveTurn()).toHaveTextContent("Skill loss can look like: words that stopped");
    });

    it("moves focus onto the card instead of dropping it on the body at every step", async () => {
      const user = userEvent.setup();
      renderCheckin();

      const heading = screen.getByRole("heading", { name: "Monthly check-in" });
      expect(heading).toHaveAttribute("tabindex", "-1");
      // Nothing is stolen on the first paint — the card arrives unasked for.
      expect(heading).not.toHaveFocus();

      await user.click(screen.getByRole("button", { name: "Nothing new" }));
      expect(heading).toHaveFocus();
      expect(document.body).not.toHaveFocus();

      await user.click(screen.getByRole("button", { name: "Not sure" }));
      expect(heading).toHaveFocus();

      await user.click(screen.getByRole("button", { name: "No" }));
      expect(heading).toHaveFocus();

      await user.click(screen.getByRole("button", { name: "4" }));
      expect(heading).toHaveFocus();
    });

    // The card comes back after the clinic-now card was acknowledged: focus has
    // nowhere to be, so the resumed question takes it.
    it("takes focus on a resumed mount, never on a fresh one", () => {
      const resumed = renderCheckin({ initialPart: "pulse", resuming: true });
      expect(screen.getByRole("heading", { name: "Monthly check-in" })).toHaveFocus();
      resumed.unmount();

      renderCheckin({ initialPart: "pulse", resuming: false });
      expect(screen.getByRole("heading", { name: "Monthly check-in" })).not.toHaveFocus();
    });

    it("leaves focus in the note box it just handed the caregiver", async () => {
      const user = userEvent.setup();
      const box = document.createElement("textarea");
      document.body.append(box);
      renderCheckin({ onOpenNote: () => box.focus() });

      await user.click(screen.getByRole("button", { name: "Add a note" }));

      expect(box).toHaveFocus();
      expect(screen.getByRole("heading", { name: "Monthly check-in" })).not.toHaveFocus();
      box.remove();
    });
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
    expect(liveTurn()).toHaveTextContent("Chequeo mensual: Comparado con hace unos meses");
    expect(screen.getByRole("button", { name: "Omitir el chequeo" })).toBeVisible();
  });
});
