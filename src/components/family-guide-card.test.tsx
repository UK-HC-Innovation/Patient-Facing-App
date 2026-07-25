import { render, screen, within } from "@testing-library/react";
import React from "react";
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
});
