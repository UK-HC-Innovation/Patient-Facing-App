import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { FamilyFact, FamilyInterview, FamilyNavigatorState } from "@/domain/types";
import { FamilyJournal } from "./family-journal";

function interview(id: string, createdAt: string, rawText: string): FamilyInterview {
  return { id, rawText, source: "typed", createdAt, extraction: "mock", kind: "note" };
}

function fact(id: string, interviewId: string | undefined, overrides: Partial<FamilyFact> = {}): FamilyFact {
  return {
    id,
    interviewId,
    label: "About school and learning",
    value: "reading is hard",
    status: "patient_reported",
    sourceSnippet: "reading is really hard for him",
    ...overrides
  };
}

const juneInterview = interview("interview-june", "2026-06-04T12:00:00.000Z", "June: he read a whole page.");
const julyInterview = interview("interview-july", "2026-07-09T12:00:00.000Z", "July: homework was calmer.");

function familyState(overrides: Partial<FamilyNavigatorState> = {}): FamilyNavigatorState {
  return {
    ...schoolAgeFamilyState,
    interviews: [juneInterview, julyInterview],
    facts: [
      fact("fact-june", "interview-june", { label: "Grade" }),
      fact("fact-july", "interview-july")
    ],
    ...overrides
  };
}

describe("FamilyJournal", () => {
  it("groups every fact by the month of its note, newest month first", () => {
    render(
      <FamilyJournal
        family={familyState()}
        language="en"
        onConfirm={vi.fn()}
        onToggleInclude={vi.fn()}
      />
    );

    const months = screen.getAllByTestId("family-journal-month");
    expect(months).toHaveLength(2);
    expect(within(months[0]).getByRole("heading", { name: "July 2026 — 1 notes" })).toBeVisible();
    expect(within(months[1]).getByRole("heading", { name: "June 2026 — 1 notes" })).toBeVisible();
    expect(within(months[1]).getByText("Grade")).toBeVisible();
    // The raw note stays collapsed until asked for, but it is the June group's.
    expect(within(months[1]).getByText("June: he read a whole page.")).toBeInTheDocument();
    expect(within(months[1]).getByText(/^You wrote · Jun/)).toBeVisible();
  });

  it("keeps undated screen-answer facts in a trailing group", () => {
    render(
      <FamilyJournal
        family={familyState({ facts: [fact("fact-screen", undefined), fact("fact-july", "interview-july")] })}
        language="en"
        onConfirm={vi.fn()}
        onToggleInclude={vi.fn()}
      />
    );

    const months = screen.getAllByTestId("family-journal-month");
    expect(within(months[0]).getByRole("heading", { name: "July 2026 — 1 notes" })).toBeVisible();
    expect(within(months[1]).getByRole("heading", { name: "Earlier — 1 notes" })).toBeVisible();
  });

  it("toggles a fact out of the packet without hiding it from the journal", async () => {
    const user = userEvent.setup();
    const onToggleInclude = vi.fn();
    const { rerender } = render(
      <FamilyJournal
        family={familyState()}
        language="en"
        onConfirm={vi.fn()}
        onToggleInclude={onToggleInclude}
      />
    );

    await user.click(screen.getByLabelText("Include in visit packet: Grade"));
    expect(onToggleInclude).toHaveBeenCalledWith("fact-june", false);
    expect(screen.queryByText("Not in packet")).not.toBeInTheDocument();

    rerender(
      <FamilyJournal
        family={familyState({
          facts: [
            fact("fact-june", "interview-june", { label: "Grade", includeInSummary: false }),
            fact("fact-july", "interview-july")
          ]
        })}
        language="en"
        onConfirm={vi.fn()}
        onToggleInclude={onToggleInclude}
      />
    );

    expect(screen.getByText("Not in packet")).toBeVisible();
    expect(screen.getByText("Grade")).toBeVisible();
    expect(screen.getByLabelText("Include in visit packet: Grade")).not.toBeChecked();
  });

  it("always states where the notes actually live", () => {
    render(
      <FamilyJournal
        family={familyState({ facts: [fact("fact-july", "interview-july")] })}
        language="en"
        onConfirm={vi.fn()}
        onToggleInclude={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Notes stay on this device. Print or share a copy sometimes so you don't lose them."
      )
    ).toBeVisible();
  });

  it("points at the visit packet after every fifth note, once", async () => {
    const user = userEvent.setup();
    const notes = Array.from({ length: 5 }, (_unused, index) =>
      interview(`note-${index}`, "2026-07-09T12:00:00.000Z", `Note ${index}`)
    );
    render(
      <FamilyJournal
        family={familyState({ interviews: notes, facts: [fact("fact-note", "note-0")] })}
        language="en"
        onConfirm={vi.fn()}
        onToggleInclude={vi.fn()}
      />
    );

    const nudge = screen.getByTestId("family-journal-nudge");
    expect(nudge).toHaveTextContent(
      "You have 5 notes now — a good moment to print or copy your visit packet."
    );
    expect(nudge).toHaveAttribute("href", "#family-visit-packet");

    await user.click(nudge);
    expect(screen.queryByTestId("family-journal-nudge")).not.toBeInTheDocument();
  });

  it("stays quiet between nudge milestones", () => {
    const notes = Array.from({ length: 4 }, (_unused, index) =>
      interview(`note-${index}`, "2026-07-09T12:00:00.000Z", `Note ${index}`)
    );
    render(
      <FamilyJournal
        family={familyState({ interviews: notes, facts: [fact("fact-note", "note-0")] })}
        language="en"
        onConfirm={vi.fn()}
        onToggleInclude={vi.fn()}
      />
    );

    expect(screen.queryByTestId("family-journal-nudge")).not.toBeInTheDocument();
  });

  it("renders in Spanish", () => {
    render(
      <FamilyJournal
        family={familyState()}
        language="es"
        onConfirm={vi.fn()}
        onToggleInclude={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Tus notas hasta ahora" })).toBeVisible();
    expect(screen.getAllByText("Incluir en el paquete de la visita")[0]).toBeVisible();
    expect(
      screen.getByText(
        "Las notas se quedan en este dispositivo. Imprime o comparte una copia de vez en cuando para no perderlas."
      )
    ).toBeVisible();
  });
});
