import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { FamilyGloss, FamilyGlossSurface, familyGlossTermsIn } from "./family-gloss";

describe("familyGlossTermsIn", () => {
  it("finds the systems words a piece of catalog copy actually uses", () => {
    expect(
      familyGlossTermsIn(
        "First Steps — Big Sandy Point of Entry",
        "The POE receives referrals and starts the initial IFSP process."
      )
    ).toEqual(["poe", "ifsp"]);
  });

  it("reads a 504 plan and an ARC meeting", () => {
    expect(familyGlossTermsIn("Ask the ARC team about a 504 plan or an IEP.")).toEqual([
      "plan504",
      "iep",
      "arc"
    ]);
  });

  // "arc" is an ordinary English word; only the acronym earns an explanation.
  it("does not explain an ordinary word that happens to spell one", () => {
    expect(familyGlossTermsIn("Search the arc of services in your area.")).toEqual([]);
    expect(familyGlossTermsIn("Marching band and archery are on the list.")).toEqual([]);
  });

  it("says nothing about copy that uses none of them", () => {
    expect(familyGlossTermsIn("A parent line that answers when you don't know who to ask.")).toEqual(
      []
    );
  });
});

describe("FamilyGloss", () => {
  // P7: one line each, the first time the term appears on a screen. Repeating
  // the definition under every card is its own kind of noise.
  it("explains a term once per surface, at its first use", () => {
    render(
      <FamilyGlossSurface>
        <div data-testid="first">
          <FamilyGloss terms={["poe", "ifsp"]} language="en" />
        </div>
        <div data-testid="second">
          <FamilyGloss terms={["poe"]} language="en" />
        </div>
      </FamilyGlossSurface>
    );

    const first = within(screen.getByTestId("first"));
    expect(first.getByText(/Point of Entry — the local office/)).toBeVisible();
    expect(first.getByText(/IFSP — the written plan/)).toBeVisible();
    expect(within(screen.getByTestId("second")).queryByTestId("family-gloss")).not.toBeInTheDocument();
  });

  it("explains it again on a different surface, because each screen is read on its own", () => {
    render(
      <>
        <FamilyGlossSurface>
          <div data-testid="home">
            <FamilyGloss terms={["poe"]} language="en" />
          </div>
        </FamilyGlossSurface>
        <FamilyGlossSurface>
          <div data-testid="programs">
            <FamilyGloss terms={["poe"]} language="en" />
          </div>
        </FamilyGlossSurface>
      </>
    );

    expect(within(screen.getByTestId("home")).getByTestId("family-gloss")).toBeVisible();
    expect(within(screen.getByTestId("programs")).getByTestId("family-gloss")).toBeVisible();
  });

  it("explains everything when there is no surface to defer to", () => {
    render(<FamilyGloss terms={["iep", "arc"]} language="en" />);
    expect(screen.getByText(/IEP — the written plan the school must follow/)).toBeVisible();
    expect(screen.getByText(/ARC — Kentucky's name for the school meeting/)).toBeVisible();
  });

  it("speaks Spanish", () => {
    render(<FamilyGloss terms={["poe"]} language="es" />);
    expect(screen.getByText(/Punto de entrada — la oficina local/)).toBeVisible();
  });

  it("renders nothing at all for no terms", () => {
    render(<FamilyGloss terms={[]} language="en" />);
    expect(screen.queryByTestId("family-gloss")).not.toBeInTheDocument();
  });
});
