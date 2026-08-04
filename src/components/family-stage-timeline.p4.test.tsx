import { render as rtlRender, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { eighteenMonthFamilyState } from "@/domain/family-fixtures";
import { openAllFamilyFolds } from "@/test/family-folds";
import { FamilyStageTimeline } from "./family-stage-timeline";

// The timeline is a folded reference section; these tests are about what is
// inside it, so every render opens it first.
function render(ui: React.ReactElement): ReturnType<typeof rtlRender> {
  const result = rtlRender(ui);
  openAllFamilyFolds();
  return result;
}

describe("P4 FamilyStageTimeline", () => {
  it.each([
    ["en", "Open family check-ins"],
    ["es", "Abrir chequeos familiares"]
  ] as const)("links the development CTA to the hub in %s", (language, label) => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    render(<FamilyStageTimeline family={eighteenMonthFamilyState(now)} language={language} now={now} />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", "/checkin#for-family");
    expect(screen.getByRole("heading", { name: language === "es" ? /desarrollo de 18 meses/i : /18-month development/i })).toBeVisible();
  });

  it("links the 30-month development CTA to the family hub section", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const eighteenMonthFamily = eighteenMonthFamilyState(now);
    const thirtyMonthFamily = {
      ...eighteenMonthFamily,
      profile: {
        ...eighteenMonthFamily.profile!,
        birthYear: 2024,
        birthMonth: 1
      }
    };
    render(<FamilyStageTimeline family={thirtyMonthFamily} language="en" now={now} />);

    expect(screen.getByRole("heading", { name: /30-month development/i })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open family check-ins" })).toHaveAttribute(
      "href",
      "/checkin#for-family"
    );
  });
});
