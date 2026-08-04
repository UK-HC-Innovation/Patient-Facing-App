import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  FamilyFoldSection,
  openFamilyFoldsFor,
  useFamilyFoldAnchors
} from "./family-fold-section";

function Harness({
  defaultOpen,
  withAnchors = false
}: {
  defaultOpen?: boolean;
  withAnchors?: boolean;
}) {
  return (
    <>
      {withAnchors ? <Anchors /> : null}
      <a href="#family-journal">Notes</a>
      <FamilyFoldSection
        id="family-journal"
        testId="family-journal"
        title="Your notes so far"
        titleId="family-journal-title"
        summaryLine="2 notes · latest August 2026"
        defaultOpen={defaultOpen}
        className="card"
      >
        <p>He only strings a couple of words together</p>
        <details>
          <summary>Details and source</summary>
          <p id="deep-target">Checked on 2026-07-25</p>
        </details>
      </FamilyFoldSection>
    </>
  );
}

function Anchors() {
  useFamilyFoldAnchors();
  return null;
}

afterEach(() => {
  // Otherwise the next mount reads this hash and treats it as a deep link.
  window.history.replaceState(null, "", window.location.pathname);
});

describe("FamilyFoldSection", () => {
  it("closes by default while keeping its anchor target, landmark, and heading in place", () => {
    render(<Harness />);

    const section = screen.getByTestId("family-journal");
    expect(section.id).toBe("family-journal");
    expect(section).toHaveAttribute("aria-labelledby", "family-journal-title");
    expect(screen.getByRole("region", { name: "Your notes so far" })).toBe(section);
    // The closed row still says something true about what is inside.
    expect(within(section).getByText("2 notes · latest August 2026")).toBeVisible();

    // Mounted, so nothing inside loses its state — just not on screen.
    const body = screen.getByText("He only strings a couple of words together");
    expect(body).toBeInTheDocument();
    expect(body).not.toBeVisible();
  });

  it("opens on the caregiver's tap, and starts open when the page has a reason to", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);

    await user.click(screen.getByTestId("family-journal-summary"));
    expect(screen.getByText("He only strings a couple of words together")).toBeVisible();
    unmount();

    render(<Harness defaultOpen />);
    expect(screen.getByText("He only strings a couple of words together")).toBeVisible();
  });

  it("re-folds when the page's reason to fold changes", () => {
    // The library is open while it is the answer, and folds once the thread
    // starts carrying it.
    const { rerender } = render(<Harness defaultOpen />);
    expect(screen.getByText("He only strings a couple of words together")).toBeVisible();

    rerender(<Harness defaultOpen={false} />);
    expect(screen.getByText("He only strings a couple of words together")).not.toBeVisible();
  });
});

describe("openFamilyFoldsFor", () => {
  it("opens the section a hash points at and focuses its heading", () => {
    render(<Harness />);

    act(() => openFamilyFoldsFor("#family-journal"));

    expect(screen.getByText("He only strings a couple of words together")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your notes so far" })).toHaveFocus();
  });

  it("opens every closed layer above a deep target, including a native details", () => {
    render(<Harness />);

    act(() => openFamilyFoldsFor("#deep-target"));

    expect(screen.getByText("Checked on 2026-07-25")).toBeVisible();
  });

  it("does nothing for a hash that names no element", () => {
    render(<Harness />);

    expect(() => act(() => openFamilyFoldsFor("#nothing-here"))).not.toThrow();
    expect(screen.getByText("He only strings a couple of words together")).not.toBeVisible();
  });
});

describe("useFamilyFoldAnchors", () => {
  it("opens the folded section an in-page link points at", async () => {
    const user = userEvent.setup();
    render(<Harness withAnchors />);

    await user.click(screen.getByRole("link", { name: "Notes" }));

    await waitFor(() =>
      expect(screen.getByText("He only strings a couple of words together")).toBeVisible()
    );
  });

  it("arrives open when the page is loaded with a hash already set", async () => {
    window.location.hash = "#family-journal";
    render(<Harness withAnchors />);

    await waitFor(() =>
      expect(screen.getByText("He only strings a couple of words together")).toBeVisible()
    );
  });
});
