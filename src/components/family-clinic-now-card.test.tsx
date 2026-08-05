import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { FamilyClinicNowTarget } from "@/domain/family-clinic-now";
import type { FamilyFlag } from "@/domain/types";
import { FamilyClinicNowCard } from "./family-clinic-now-card";

const flag: FamilyFlag = {
  id: "flag-1",
  type: "regression",
  source: "text",
  raisedAt: "2026-07-17T12:00:00.000Z"
};

const referralTarget: FamilyClinicNowTarget = {
  kind: "referral",
  clinic: "UK Developmental Pediatrics"
};

function renderCard(overrides: Partial<React.ComponentProps<typeof FamilyClinicNowCard>> = {}) {
  const props: React.ComponentProps<typeof FamilyClinicNowCard> = {
    flag,
    language: "en",
    target: referralTarget,
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

  // F2a. The referral branch names a real relationship; the catalog's UK entry
  // carries no dialable line, so this card carries no number rather than one it
  // made up.
  it("renders no call button when the catalog has no number for the clinic", () => {
    renderCard();

    expect(screen.queryByTestId("family-clinic-now-call")).toBeNull();
    expect(screen.getByTestId("family-clinic-now-card")).toHaveAttribute(
      "data-clinic-now-target",
      "referral"
    );
  });

  it("offers the clinic's number as a tappable link when the catalog has one", () => {
    renderCard({
      target: { kind: "referral", clinic: "Cardinal Hill", number: "859-254-5701", tel: "tel:8592545701" }
    });

    const call = screen.getByTestId("family-clinic-now-call");
    expect(call).toHaveAttribute("href", "tel:8592545701");
    expect(call).toHaveTextContent("Call 859-254-5701");
  });

  // No referral, but a First Steps clock is running: their county's point of
  // entry, with the catalog's number.
  it("routes a no-referral family on the First Steps clock to their county POE", () => {
    renderCard({
      target: {
        kind: "first_steps",
        office: "Big Sandy",
        number: "606-886-4417",
        tel: "tel:6068864417"
      }
    });

    expect(
      screen.getByText(
        "Losing skills is worth reporting now — not waiting for the visit. Call Big Sandy — the First Steps point of entry for your county. It can matter for how soon your child is seen."
      )
    ).toBeVisible();
    expect(screen.getByTestId("family-clinic-now-call")).toHaveAttribute("href", "tel:6068864417");
    expect(screen.getByTestId("family-clinic-now-card")).toHaveAttribute(
      "data-clinic-now-target",
      "first_steps"
    );
  });

  // Nothing we can name honestly. The previously untested fallback path used to
  // print the hardcoded demo clinic here.
  it("names no clinic at all when the family has no relationship we know of", () => {
    renderCard({ target: { kind: "generic" } });

    expect(
      screen.getByText(
        "Losing skills is worth reporting now — not waiting for the visit. Call your child's doctor or clinic. It can matter for how soon your child is seen."
      )
    ).toBeVisible();
    expect(screen.queryByText(/UK Developmental Pediatrics/)).toBeNull();
    expect(screen.queryByTestId("family-clinic-now-call")).toBeNull();
  });

  it("renders the Spanish generic and First Steps branches", () => {
    const { unmount } = renderCard({ language: "es", target: { kind: "generic" } });
    expect(
      screen.getByText(
        "Perder habilidades vale la pena reportarlo ahora — sin esperar la visita. Llama al doctor o a la clínica de tu hijo o hija. Puede influir en qué tan pronto atienden a tu hijo o hija."
      )
    ).toBeVisible();
    unmount();

    renderCard({ language: "es", target: { kind: "first_steps", office: "Big Sandy" } });
    expect(
      screen.getByText(
        "Perder habilidades vale la pena reportarlo ahora — sin esperar la visita. Llama a Big Sandy — el punto de entrada de First Steps para tu condado. Puede influir en qué tan pronto atienden a tu hijo o hija."
      )
    ).toBeVisible();
  });
});
