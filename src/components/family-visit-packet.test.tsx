import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { openAllFamilyFolds } from "@/test/family-folds";
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

// The packet is a folded reference section; these tests are about what is inside
// it, so every render opens it first.
function render(ui: React.ReactElement): ReturnType<typeof rtlRender> {
  const result = rtlRender(ui);
  openAllFamilyFolds();
  return result;
}

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

  // F3a. The receipt waits for the print flow, not for the tap: it used to be
  // written before the dialog even opened, so a dialog that never appeared —
  // and a dismissed one — both left "Printed" in the audit trail.
  it("records the print only once the print flow has run", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const { onExport } = renderPacket();

    await user.click(screen.getByRole("button", { name: "Print" }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(onExport).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("afterprint"));
    expect(onExport).toHaveBeenCalledExactlyOnceWith("printed");

    // The listener is one-shot: a second dialog closing is not a second receipt.
    window.dispatchEvent(new Event("afterprint"));
    expect(onExport).toHaveBeenCalledTimes(1);
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

  // F3a. A blocked clipboard used to be a tap that did nothing and said nothing.
  it("says so when the clipboard refuses, and records no export", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });
    const { onExport } = renderPacket();

    await user.click(screen.getByRole("button", { name: "Copy as text" }));

    expect(
      await within(screen.getByTestId("family-packet-receipt")).findByText(/would not let us copy/)
    ).toBeVisible();
    expect(onExport).not.toHaveBeenCalled();
  });

  it("says so when the phone has no clipboard at all", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const { onExport } = renderPacket();

    await user.click(screen.getByRole("button", { name: "Copy as text" }));

    expect(
      await within(screen.getByTestId("family-packet-receipt")).findByText(/would not let us copy/)
    ).toBeVisible();
    expect(onExport).not.toHaveBeenCalled();
  });

  // F3b. On-device export: a Blob and an anchor, no network (FR-8).
  it("saves a copy of exactly the packet text to the device", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn().mockReturnValue("blob:packet");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const clicked: Array<{ href: string; download: string }> = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push({ href: this.getAttribute("href") ?? "", download: this.download });
      });
    const { onExport } = renderPacket();

    await user.click(screen.getByTestId("family-packet-save"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blob] = createObjectURL.mock.calls[0] as [Blob];
    // jsdom's Blob has no text(); FileReader is what it does implement.
    const contents = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(contents).toBe(buildFamilyVisitSummary(fatFamily, "en", NOW));
    expect(blob.type).toContain("text/plain");
    expect(clicked).toEqual([{ href: "blob:packet", download: "visit-packet.txt" }]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:packet");
    expect(onExport).toHaveBeenCalledWith("saved");
    expect(
      await within(screen.getByTestId("family-packet-receipt")).findByText(/Saved to this device/)
    ).toBeVisible();
    click.mockRestore();
  });

  // FR-7. The one exit that leaves the device, behind a consent that names what
  // is in the text.
  it("requires an explicit consent naming the child's information before sharing", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const { onExport } = renderPacket();

    await user.click(screen.getByTestId("family-packet-share-open"));
    const shareButton = screen.getByTestId("family-packet-share");
    expect(shareButton).toBeEnabled();
    expect(shareButton).toHaveAttribute("data-blocked", "true");
    await user.click(shareButton);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check the consent box first — sharing needs your OK each time."
    );
    expect(share).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /this text includes my child's information and leaves this app/i
      })
    );
    await user.click(shareButton);

    expect(share).toHaveBeenCalledWith({
      title: "Our visit packet",
      text: buildFamilyVisitSummary(fatFamily, "en", NOW)
    });
    expect(onExport).toHaveBeenCalledWith("shared");
    expect(
      await within(screen.getByTestId("family-packet-receipt")).findByText(
        "Shared: the packet text, including your child's information."
      )
    ).toBeVisible();
  });

  it("leaves no receipt when the caregiver backs out of the share sheet", async () => {
    const user = userEvent.setup();
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(abort),
      configurable: true
    });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const { onExport } = renderPacket();

    await user.click(screen.getByTestId("family-packet-share-open"));
    await user.click(
      screen.getByRole("checkbox", {
        name: /this text includes my child's information and leaves this app/i
      })
    );
    await user.click(screen.getByTestId("family-packet-share"));

    expect(onExport).not.toHaveBeenCalled();
    expect(screen.getByTestId("family-packet-receipt")).toHaveTextContent("");
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
