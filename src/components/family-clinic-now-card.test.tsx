import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { FamilyFlag } from "@/domain/types";
import { FamilyClinicNowCard } from "./family-clinic-now-card";

const flag: FamilyFlag = {
  id: "flag-1",
  type: "regression",
  source: "text",
  raisedAt: "2026-07-17T12:00:00.000Z"
};

function renderCard(overrides: Partial<React.ComponentProps<typeof FamilyClinicNowCard>> = {}) {
  const props: React.ComponentProps<typeof FamilyClinicNowCard> = {
    flag,
    language: "en",
    clinic: "UK Developmental Pediatrics",
    onAcknowledge: vi.fn(),
    ...overrides
  };
  return { ...render(<FamilyClinicNowCard {...props} />), props };
}

describe("FamilyClinicNowCard", () => {
  it("names the clinic and says why calling now matters", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: "Worth telling the clinic now" })).toBeVisible();
    expect(
      screen.getByText(
        "Losing skills is worth reporting now — not waiting for the visit. Call UK Developmental Pediatrics. It can matter for how soon your child is seen."
      )
    ).toBeVisible();
  });

  it("acknowledges with the flag id", async () => {
    const user = userEvent.setup();
    const { props } = renderCard();

    await user.click(screen.getByRole("button", { name: "I've noted this" }));

    expect(props.onAcknowledge).toHaveBeenCalledWith("flag-1");
  });

  // The clinic-now tier is not the crisis tier: no alert role, no page lock, no
  // voice lock — a plain labelled region the caregiver reads on their own terms.
  it("is a plain labelled region, never the crisis banner", () => {
    renderCard();

    expect(screen.queryByRole("alert")).toBeNull();
    const card = screen.getByTestId("family-clinic-now-card");
    expect(card.tagName).toBe("SECTION");
    expect(card).toHaveAttribute("id", "family-clinic-now");
    expect(card).toHaveAttribute("aria-labelledby", "family-clinic-now-flag-1");
    expect(card.className).not.toContain("rose");
    expect(screen.getByRole("region", { name: "Worth telling the clinic now" })).toBe(card);
  });

  it("keeps the acknowledge control reachable and tall enough to tap", () => {
    renderCard();

    const button = screen.getByRole("button", { name: "I've noted this" });
    expect(button.className).toContain("min-h-12");
    expect(button.className).toContain("focus-visible:outline");
  });

  it("renders the Spanish copy with the clinic interpolated", () => {
    renderCard({ language: "es", flag: { ...flag, source: "probe" } });

    expect(screen.getByRole("heading", { name: "Vale la pena avisar a la clínica ahora" })).toBeVisible();
    expect(
      screen.getByText(
        "Perder habilidades vale la pena reportarlo ahora — sin esperar la visita. Llama a UK Developmental Pediatrics. Puede influir en qué tan pronto atienden a tu hijo o hija."
      )
    ).toBeVisible();
    expect(screen.getByTestId("family-clinic-now-card")).toHaveAttribute("data-flag-source", "probe");
  });
});
