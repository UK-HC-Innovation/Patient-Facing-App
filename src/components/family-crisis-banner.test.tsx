import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { FamilySafetyEvent } from "@/domain/types";
import { FamilyCrisisBanner } from "./family-crisis-banner";
import { FamilyUrgentHelpControl } from "./family-urgent-help-control";

const createdAt = "2026-08-08T12:00:00.000Z";

function safetyEvent(
  event: Pick<FamilySafetyEvent, "domain" | "tier"> & Partial<Pick<FamilySafetyEvent, "guidance">>
): FamilySafetyEvent {
  return { id: crypto.randomUUID(), createdAt, ...event };
}

describe("FamilyCrisisBanner action routing", () => {
  it.each([
    ["en", /check this medicine question with the care team/i, /prescriber or care team/i],
    ["es", /consulta esta pregunta sobre medicamentos/i, /equipo de salud/i]
  ] as const)("renders a calm %s medication soft block without emergency contacts", (language, heading, body) => {
    render(
      <FamilyCrisisBanner
        event={safetyEvent({ domain: "medication_change", tier: "blocked" })}
        language={language}
        onAcknowledge={vi.fn()}
      />
    );

    const banner = screen.getByTestId("family-crisis-banner");
    expect(banner).toHaveAttribute("data-safety-tier", "blocked");
    expect(within(banner).getByRole("heading", { name: heading })).toBeVisible();
    expect(banner).toHaveTextContent(body);
    expect(banner).not.toHaveTextContent(/911|988|urgent help|ayuda urgente/i);
    expect(within(banner).queryByRole("link")).toBeNull();
    expect(within(banner).getByRole("button")).toBeVisible();
  });

  it("routes a missing child to law enforcement and NCMEC, not medical-emergency copy", () => {
    const { rerender } = render(
      <FamilyCrisisBanner
        event={safetyEvent({ domain: "acute_danger", tier: "emergency", guidance: "missing_child" })}
        language="en"
        onAcknowledge={vi.fn()}
      />
    );

    const banner = screen.getByTestId("family-crisis-banner");
    expect(banner).toHaveTextContent(/contact local law enforcement first/i);
    expect(within(banner).getByRole("link", { name: /ncmec/i })).toHaveAttribute(
      "href",
      "tel:18008435678"
    );
    expect(within(banner).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "tel:911",
      "tel:18008435678"
    ]);
    expect(banner).not.toHaveTextContent(/nearest emergency department/i);

    rerender(
      <FamilyCrisisBanner
        event={safetyEvent({ domain: "self_harm", tier: "crisis", guidance: "missing_child" })}
        language="en"
        onAcknowledge={vi.fn()}
      />
    );
    expect(screen.getByRole("link", { name: /ncmec/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /crisis lifeline/i })).toBeVisible();
    expect(screen.getByTestId("family-crisis-banner")).toHaveTextContent(/988 Suicide & Crisis Lifeline/i);
    expect(screen.getByTestId("family-safety-steps")).toBeVisible();
  });

  it("offers Kentucky's direct abuse-reporting route", () => {
    render(
      <FamilyCrisisBanner
        event={safetyEvent({ domain: "abuse", tier: "crisis" })}
        language="en"
        onAcknowledge={vi.fn()}
      />
    );

    const banner = screen.getByTestId("family-crisis-banner");
    expect(banner).toHaveTextContent("1-877-KYSAFE1");
    expect(within(banner).getByRole("link", { name: /kysafe1/i })).toHaveAttribute(
      "href",
      "tel:18775972331"
    );
  });

  it("separates a 211 basic-needs route from medicine-access guidance", () => {
    const { rerender } = render(
      <FamilyCrisisBanner
        event={safetyEvent({ domain: "social", tier: "emergency", guidance: "basic_needs" })}
        language="en"
        onAcknowledge={vi.fn()}
      />
    );

    expect(screen.getByRole("link", { name: /211/i })).toHaveAttribute("href", "tel:211");

    rerender(
      <FamilyCrisisBanner
        event={safetyEvent({ domain: "social", tier: "emergency", guidance: "medication_access" })}
        language="en"
        onAcknowledge={vi.fn()}
      />
    );

    expect(screen.getByTestId("family-crisis-banner")).toHaveTextContent(/prescriber or pharmacist now/i);
    expect(screen.getByTestId("family-crisis-banner")).not.toHaveTextContent(/no food today|call 211/i);
    expect(screen.queryByRole("link", { name: /211/i })).toBeNull();

    rerender(
      <FamilyCrisisBanner
        event={safetyEvent({
          domain: "social",
          tier: "emergency",
          guidance: "basic_needs_and_medication_access"
        })}
        language="en"
        onAcknowledge={vi.fn()}
      />
    );

    expect(screen.getByTestId("family-crisis-banner")).toHaveTextContent(/prescriber or pharmacist now/i);
    expect(screen.getByRole("link", { name: /211/i })).toBeVisible();
  });

  it("uses the official Spanish 988 text keyword", () => {
    render(
      <FamilyCrisisBanner
        event={safetyEvent({ domain: "self_harm", tier: "crisis" })}
        language="es"
        onAcknowledge={vi.fn()}
      />
    );

    expect(screen.getByRole("link", { name: /envía ayuda al 988/i })).toHaveAttribute(
      "href",
      "sms:988?body=AYUDA"
    );
  });
});

describe("FamilyUrgentHelpControl", () => {
  it("reopens a fixed directory without revealing the earlier disclosure category", async () => {
    const user = userEvent.setup();
    render(<FamilyUrgentHelpControl language="en" />);

    await user.click(screen.getByTestId("family-urgent-help-control"));
    const panel = screen.getByTestId("family-urgent-help-panel");
    expect(within(panel).getByRole("link", { name: /kysafe1/i })).toBeVisible();
    expect(within(panel).getByRole("link", { name: /211/i })).toBeVisible();
    expect(within(panel).getByRole("link", { name: /ncmec/i })).toBeVisible();
    expect(within(panel).getByRole("link", { name: /crisis lifeline/i })).toBeVisible();
    expect(within(panel).getByRole("link", { name: /911/i })).toBeVisible();
    expect(panel).toHaveTextContent(/same directory after every urgent message/i);
    expect(panel).toHaveTextContent(/prescriber or pharmacist for missing medicine/i);
  });
});
