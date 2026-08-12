import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("releases terms added after expansion when that claimant unmounts", () => {
    function Harness() {
      const [expanded, setExpanded] = React.useState(false);
      const [showFirst, setShowFirst] = React.useState(true);
      return (
        <FamilyGlossSurface>
          {showFirst ? (
            <div data-testid="first">
              <FamilyGloss terms={expanded ? ["poe", "ifsp"] : ["poe"]} language="en" />
            </div>
          ) : (
            <div data-testid="second">
              <FamilyGloss terms={["ifsp"]} language="en" />
            </div>
          )}
          <button type="button" onClick={() => setExpanded(true)}>Expand</button>
          <button type="button" onClick={() => setShowFirst(false)}>Replace</button>
        </FamilyGlossSurface>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(within(screen.getByTestId("first")).getByText(/IFSP/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(within(screen.getByTestId("second")).getByText(/IFSP/)).toBeVisible();
  });

  it("hands a removed term to the next claimant on the same surface", () => {
    function Harness() {
      const [firstTerms, setFirstTerms] = React.useState<readonly ["poe"] | readonly []>(["poe"]);
      return (
        <FamilyGlossSurface>
          <div data-testid="first"><FamilyGloss terms={firstTerms} language="en" /></div>
          <div data-testid="second"><FamilyGloss terms={["poe"]} language="en" /></div>
          <button type="button" onClick={() => setFirstTerms([])}>Remove first</button>
        </FamilyGlossSurface>
      );
    }
    render(<Harness />);
    expect(within(screen.getByTestId("second")).queryByTestId("family-gloss")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove first" }));

    expect(within(screen.getByTestId("second")).getByText(/Point of Entry/)).toBeVisible();
  });

  it("does not make unrelated owners release each other when a third claimant unmounts", () => {
    function Harness() {
      const [showThird, setShowThird] = React.useState(true);
      return (
        <FamilyGlossSurface>
          <div data-testid="first"><FamilyGloss terms={["poe"]} language="en" /></div>
          <div data-testid="second"><FamilyGloss terms={["ifsp"]} language="en" /></div>
          {showThird ? <FamilyGloss terms={["iep"]} language="en" /> : null}
          <button type="button" onClick={() => setShowThird(false)}>Remove third</button>
        </FamilyGlossSurface>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Remove third" }));

    expect(within(screen.getByTestId("first")).getByText(/Point of Entry/)).toBeVisible();
    expect(within(screen.getByTestId("second")).getByText(/IFSP/)).toBeVisible();
  });
});
