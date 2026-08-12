import { render, screen, within } from "@testing-library/react";
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FAMILY_GUIDE_CATALOG, type FamilyGuide } from "@/domain/family-guides";
import { FamilyGuideCard } from "./family-guide-card";

function guideById(id: string): FamilyGuide {
  const guide = FAMILY_GUIDE_CATALOG.find((entry) => entry.id === id);
  if (!guide) throw new Error(`Missing seeded guide: ${id}`);
  return guide;
}

describe("FamilyGuideCard", () => {
  it("renders the guide's steps with its source and the date that source was checked", () => {
    const guide = guideById("firststeps_family_guide");
    render(<FamilyGuideCard guide={guide} language="en" />);

    const card = screen.getByTestId("family-guide-card");
    expect(card).toHaveAttribute("data-guide-id", "firststeps_family_guide");
    expect(within(card).getByRole("heading", { name: guide.title })).toBeVisible();
    expect(within(card).getByText(guide.plainSummary)).toBeVisible();

    const steps = within(card).getAllByRole("listitem");
    expect(steps.map((item) => item.textContent)).toEqual(guide.steps);

    expect(screen.getByTestId("family-guide-source")).toHaveTextContent(
      `Source: ${guide.sourceName} · Checked on ${guide.verifiedAt}`
    );
  });

  // F5e. The KY-SPIN parent line used to live inside a step's prose, where it
  // was untappable and invisible to the sweep that guarantees every digit
  // Ladder renders is in the verified catalog (FR-1).
  it("makes a guide's phone line tappable and keeps it out of the prose", () => {
    const guide = guideById("kyspin_resources");
    render(<FamilyGuideCard guide={guide} language="en" />);

    const call = screen.getByTestId("family-guide-call");
    expect(call).toHaveAttribute("href", "tel:8005257746");
    expect(call).toHaveTextContent("Call 800-525-7746");
    expect(call.className).toContain("min-h-12");
    // The number is the button, not a sentence a caregiver has to retype.
    for (const step of guide.steps) {
      expect(step).not.toMatch(/\d{3}-\d{3}-\d{4}/);
    }
  });

  it("shows no call control for a guide with no phone line", () => {
    render(<FamilyGuideCard guide={guideById("cdc_milestones_help")} language="en" />);

    expect(screen.queryByTestId("family-guide-call")).toBeNull();
  });

  it("links out to the cited page with a named, tappable control", () => {
    const guide = guideById("cdc_milestones_help");
    render(<FamilyGuideCard guide={guide} language="en" />);

    const link = screen.getByRole("link", { name: `See their official page: ${guide.title}` });
    expect(link).toHaveAttribute("href", guide.sourceUrl);
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link.className).toContain("min-h-12");
    expect(link.className).toContain("focus-visible:outline");
  });

  it("keeps guide text in its source language and labels the date in Spanish", () => {
    const guide = guideById("medline_sleep_kids");
    render(<FamilyGuideCard guide={guide} language="es" />);

    expect(screen.getByRole("heading", { name: guide.title })).toBeVisible();
    expect(screen.getByTestId("family-guide-source")).toHaveTextContent(
      `Fuente: ${guide.sourceName} · Revisado el ${guide.verifiedAt}`
    );
    expect(screen.getByRole("link", { name: `Ver su página oficial: ${guide.title}` })).toBeVisible();
  });

  it("shows the call-and-check notice only for a guide still awaiting a human check", () => {
    const guide = guideById("kyspin_resources");
    const { rerender } = render(<FamilyGuideCard guide={guide} language="en" />);

    expect(screen.queryByText("Call and check before you count on this. Details change.")).toBeNull();

    rerender(<FamilyGuideCard guide={{ ...guide, humanVerify: true }} language="en" />);
    expect(screen.getByText("Call and check before you count on this. Details change.")).toBeVisible();
  });

  it("replaces the normal notice with a stronger warning after the check window expires", () => {
    const guide = { ...guideById("kyspin_resources"), verifiedAt: "2020-01-01", humanVerify: true };
    render(<FamilyGuideCard guide={guide} language="en" />);

    expect(screen.getByTestId("family-guide-stale")).toHaveTextContent(/past Ladder's 45-day check window/i);
    expect(screen.queryByText("Call and check before you count on this. Details change.")).toBeNull();
  });

  it("keeps static HTML neutral until the client takes its freshness snapshot", () => {
    const guide = { ...guideById("kyspin_resources"), verifiedAt: "2020-01-01" };
    const html = renderToString(<FamilyGuideCard guide={guide} language="en" />);

    expect(html).not.toContain("45-day check window");
  });
});
