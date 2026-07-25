import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import { buildFamilyVisitSummary } from "@/domain/family-visit-packet";
import type {
  FamilyAppointment,
  FamilyFact,
  FamilyInterview,
  FamilyNavigatorState,
  FamilyResourceStep
} from "@/domain/types";
import { FamilyVisitPacket } from "./family-visit-packet";

const NOW = new Date("2026-07-17T12:00:00.000Z");

function interview(id: string, createdAt: string): FamilyInterview {
  return {
    id,
    rawText: "Note text for the packet fixture.",
    source: "typed",
    createdAt,
    extraction: "mock",
    kind: "note"
  };
}

function fact(id: string, overrides: Partial<FamilyFact> = {}): FamilyFact {
  return {
    id,
    label: "What we noticed",
    value: "reading is hard",
    status: "patient_reported",
    sourceSnippet: "reading is really hard for him",
    ...overrides
  };
}

function step(overrides: Partial<FamilyResourceStep> = {}): FamilyResourceStep {
  const plannedAt = overrides.plannedAt ?? overrides.updatedAt ?? "2026-05-04T12:00:00.000Z";
  return {
    id: "step-1",
    resourceId: "first_steps_statewide",
    domain: "early_intervention",
    status: "in_touch",
    plannedAt,
    updatedAt: plannedAt,
    ...overrides
  };
}

function appointment(overrides: Partial<FamilyAppointment> = {}): FamilyAppointment {
  return {
    id: "appointment-1",
    clinic: "UK Developmental Pediatrics",
    offeredSlots: [],
    status: "booked",
    barriers: [],
    barriersAsked: true,
    reminderAcks: [],
    createdAt: "2026-06-01T12:00:00.000Z",
    ...overrides
  };
}

/** Every packet section populated, so one fixture exercises the whole view. */
const fatFamily: FamilyNavigatorState = {
  ...schoolAgeFamilyState,
  interviews: [
    interview("interview-may", "2026-05-09T12:00:00.000Z"),
    interview("interview-june", "2026-06-12T12:00:00.000Z")
  ],
  facts: [
    fact("fact-may", { interviewId: "interview-may" }),
    fact("fact-june", {
      interviewId: "interview-june",
      sourceSnippet: "he stopped asking for help at school"
    }),
    fact("fact-guess", {
      interviewId: "interview-may",
      status: "inferred",
      sourceSnippet: "maybe he needs an IEP"
    }),
    fact("fact-excluded", {
      interviewId: "interview-june",
      includeInSummary: false,
      sourceSnippet: "I said that wrong"
    })
  ],
  flags: [
    { id: "flag-1", type: "regression", source: "probe", raisedAt: "2026-06-20T12:00:00.000Z" }
  ],
  steps: [step({ id: "step-first-steps", updatedAt: "2026-06-02T12:00:00.000Z" })],
  appointments: [appointment({ barriers: ["ride"] })],
  packetQuestionIds: ["results_school"]
};

function renderPacket(
  overrides: Partial<FamilyNavigatorState> = {},
  props: Partial<React.ComponentProps<typeof FamilyVisitPacket>> = {}
) {
  const onToggleQuestion = vi.fn();
  const onExport = vi.fn();
  render(
    <FamilyVisitPacket
      family={{ ...fatFamily, ...overrides }}
      language="en"
      now={NOW}
      onToggleQuestion={onToggleQuestion}
      onExport={onExport}
      {...props}
    />
  );
  return { onToggleQuestion, onExport };
}

describe("FamilyVisitPacket", () => {
  it("renders every line the builder writes, with real headings and lists", () => {
    renderPacket();

    const packet = screen.getByTestId("family-visit-packet");
    const printed = packet.textContent ?? "";
    for (const line of buildFamilyVisitSummary(fatFamily, "en", NOW).split("\n")) {
      const content = line.startsWith("- ") ? line.slice(2) : line;
      if (content.length > 0) {
        expect(printed).toContain(content);
      }
    }

    expect(screen.getByRole("heading", { level: 2, name: "Our visit packet" })).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 3, name: "What we noticed, over time" })
    ).toBeVisible();
    const body = screen.getByTestId("family-visit-packet-body");
    expect(within(body).getByText(/reading is really hard for him/).tagName).toBe("LI");
    // Testimony only: the guess and the excluded line stay in the journal.
    expect(printed).not.toContain("maybe he needs an IEP");
    expect(printed).not.toContain("I said that wrong");
  });

  it("shows the prep cover with the packet in the list of what to bring", () => {
    renderPacket();

    expect(screen.getByRole("heading", { name: "Getting ready for the visit" })).toBeVisible();
    expect(screen.getByText("Bring this packet — it's your notes in your words.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: 'Learn more: CDC, "Learn the Signs. Act Early."' })
    ).toHaveAttribute("href", "https://www.cdc.gov/act-early/");
  });

  it("toggles a starter question by id and reflects what is already picked", async () => {
    const user = userEvent.setup();
    const { onToggleQuestion } = renderPacket();

    const picked = screen.getByRole("checkbox", { name: "What do the results mean for school?" });
    const unpicked = screen.getByRole("checkbox", { name: "Who coordinates the next steps?" });
    expect(picked).toBeChecked();
    expect(unpicked).not.toBeChecked();

    await user.click(unpicked);
    expect(onToggleQuestion).toHaveBeenCalledTimes(1);
    expect(onToggleQuestion).toHaveBeenCalledWith("coordinates_next");

    await user.click(picked);
    expect(onToggleQuestion).toHaveBeenLastCalledWith("results_school");
  });

  it("prints only the questions the family picked", () => {
    renderPacket();

    const body = within(screen.getByTestId("family-visit-packet-body"));
    expect(body.getByText("Questions we want to ask")).toBeVisible();
    expect(body.getByText("What do the results mean for school?")).toBeVisible();
    expect(body.queryByText("Who coordinates the next steps?")).toBeNull();
  });

  it("prints the packet and records the export", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const { onExport } = renderPacket();

    await user.click(screen.getByRole("button", { name: "Print" }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith("printed");
    print.mockRestore();
  });

  it("copies the builder's text, confirms it, and records the export", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });
    const { onExport } = renderPacket();

    expect(screen.queryByText("Copied.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Copy as text" }));

    expect(writeText).toHaveBeenCalledWith(buildFamilyVisitSummary(fatFamily, "en", NOW));
    expect(onExport).toHaveBeenCalledWith("copied");
    expect(await screen.findByText("Copied.")).toBeVisible();
  });

  it("renders the packet in Spanish", () => {
    renderPacket({}, { language: "es" });

    expect(screen.getByRole("heading", { level: 2, name: "Nuestro paquete para la visita" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Lo que notamos, con el tiempo" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Prepararse para la visita" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Imprimir" })).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "¿Qué significan los resultados para la escuela?" })
    ).toBeChecked();
  });

  it("keeps empty sections out of the printed page", () => {
    renderPacket({
      facts: [],
      flags: [],
      steps: [],
      appointments: [],
      packetQuestionIds: []
    });

    expect(screen.queryByText("What we noticed, over time")).toBeNull();
    expect(screen.queryByText("Changes we're flagging")).toBeNull();
    expect(screen.queryByText("Services already in motion")).toBeNull();
    expect(screen.queryByText("Questions we want to ask")).toBeNull();
    expect(screen.queryByText("We may need help with transportation.")).toBeNull();
    // The picker still offers every starter question, picked or not.
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    expect(
      screen.getByText(/Written from our own notes in Ladder · printed 7\/17\/2026/)
    ).toBeVisible();
  });
});
