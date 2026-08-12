import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { openFamilyFoldsFor } from "@/components/family-fold-section";
import { useLadderSurfaceNavigation } from "@/components/ladder/use-ladder-surface-navigation";
import {
  LadderPanel,
  LadderShell,
  ladderSurfaceForAnchor,
  useLadderAnchorSurface,
  type LadderSurface
} from "./ladder-shell";

function Harness({
  surfaces = ["home", "programs", "notes", "visit"] as LadderSurface[],
  showTabs = true,
  crisis,
  onLanguageChange = vi.fn()
}: {
  surfaces?: LadderSurface[];
  showTabs?: boolean;
  crisis?: React.ReactNode;
  onLanguageChange?: (language: "en" | "es") => void;
}) {
  const [surface, setSurface] = React.useState<LadderSurface>("home");
  return (
    <LadderShell
      language="en"
      onLanguageChange={onLanguageChange}
      subtitle="Mateo · Pike County"
      crisis={crisis}
      surfaces={surfaces}
      surface={surface}
      onSurfaceChange={setSurface}
      showTabs={showTabs}
    >
      {/* Panels track navigation exactly, the way the page does: a named region
          whose control has not rendered would point `aria-labelledby` at nothing. */}
      <LadderPanel surface="home" active={surface === "home"}>
        <p>front door</p>
        <input aria-label="a note" defaultValue="" />
      </LadderPanel>
      {surfaces.includes("programs") ? (
        <LadderPanel surface="programs" active={surface === "programs"}>
          <p>the library</p>
        </LadderPanel>
      ) : null}
      {surfaces.includes("notes") ? (
        <LadderPanel surface="notes" active={surface === "notes"}>
          <p>your words</p>
        </LadderPanel>
      ) : null}
      {surfaces.includes("visit") ? (
        <LadderPanel surface="visit" active={surface === "visit"}>
          <p>appointment companion</p>
        </LadderPanel>
      ) : null}
    </LadderShell>
  );
}

function AnchorHarness() {
  const [surface, setSurface] = React.useState<LadderSurface>("home");
  const navigation = useLadderSurfaceNavigation({
    requestedSurface: surface,
    available: ["home", "programs"],
    onSurfaceChange: setSurface
  });
  useLadderAnchorSurface({
    activeSurface: navigation.activeSurface,
    pendingAnchor: navigation.pendingAnchor,
    selectAnchor: navigation.selectAnchor,
    settleAnchor: navigation.settleAnchor,
    openAnchor: openFamilyFoldsFor
  });
  return (
    <LadderShell
      language="en"
      onLanguageChange={vi.fn()}
      subtitle="Mateo · Pike County"
      surfaces={["home", "programs"]}
      surface={navigation.activeSurface}
      onSurfaceChange={navigation.selectSurface}
      pendingAnchor={navigation.pendingAnchor}
      showTabs
    >
      <LadderPanel surface="home" active={navigation.activeSurface === "home"}>
        <a href="#family-resources">Open programs</a>
      </LadderPanel>
      <LadderPanel surface="programs" active={navigation.activeSurface === "programs"}>
        <h2 id="family-resources">Program matches</h2>
      </LadderPanel>
    </LadderShell>
  );
}

function DelayedAnchorHarness() {
  const [surface, setSurface] = React.useState<LadderSurface>("home");
  const [showTarget, setShowTarget] = React.useState(false);
  const navigation = useLadderSurfaceNavigation({
    requestedSurface: surface,
    available: ["home"],
    onSurfaceChange: setSurface
  });
  useLadderAnchorSurface({
    activeSurface: navigation.activeSurface,
    pendingAnchor: navigation.pendingAnchor,
    selectAnchor: navigation.selectAnchor,
    settleAnchor: navigation.settleAnchor,
    openAnchor: openFamilyFoldsFor
  });
  return (
    <LadderShell
      language="en"
      onLanguageChange={vi.fn()}
      subtitle="Mateo · Pike County"
      surfaces={["home"]}
      surface={navigation.activeSurface}
      onSurfaceChange={navigation.selectSurface}
      pendingAnchor={navigation.pendingAnchor}
      showTabs={false}
    >
      <LadderPanel surface="home" active>
        <a href="#family-checkin">Open later check-in</a>
        <button type="button" onClick={() => setShowTarget(true)}>Show check-in</button>
        {showTarget ? <h2 id="family-checkin">Monthly check-in</h2> : null}
      </LadderPanel>
    </LadderShell>
  );
}

/** Every `aria-labelledby` token on the page resolves to an element that exists. */
function danglingLabelReferences(root: HTMLElement): string[] {
  return [...root.querySelectorAll("[aria-labelledby]")]
    .flatMap((node) => (node.getAttribute("aria-labelledby") ?? "").split(/\s+/))
    .filter((id) => id.length > 0 && root.ownerDocument.getElementById(id) === null);
}

function surfaceButton(name: string): HTMLElement {
  return within(screen.getByTestId("ladder-tabs")).getByRole("button", { name });
}

describe("LadderShell", () => {
  it("shows one panel at a time and keeps the rest in the document", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText("front door")).toBeVisible();
    expect(screen.queryByText("the library")).not.toBeInTheDocument();

    await user.click(surfaceButton("Programs"));
    expect(screen.getByText("the library")).toBeVisible();
    expect(screen.getByText("front door")).not.toBeVisible();
    expect(surfaceButton("Programs")).toHaveAttribute("aria-current", "page");
    expect(surfaceButton("Home")).not.toHaveAttribute("aria-current");
  });

  it("lazy-mounts a surface on first visit and keeps it mounted afterward", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByText("the library")).not.toBeInTheDocument();

    await user.click(surfaceButton("Programs"));
    expect(screen.getByText("the library")).toBeVisible();
    await user.click(surfaceButton("Home"));
    expect(screen.getByText("the library")).toBeInTheDocument();
    expect(screen.getByText("the library")).not.toBeVisible();
  });

  // The panel is hidden, not unmounted: a caregiver who taps away mid-sentence
  // and comes back finds their draft where they left it.
  it("keeps what a hidden panel was holding", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("a note"), "he points at what he wants");
    await user.click(surfaceButton("Notes"));
    await user.click(surfaceButton("Home"));

    expect(screen.getByLabelText("a note")).toHaveValue("he points at what he wants");
  });

  // jsdom honours the `hidden` attribute on its own, but a real browser applies
  // the author's display class over the UA stylesheet — so the class has to move
  // with the state or a "hidden" panel keeps painting.
  it("takes its display from the same state as its hidden attribute", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const programs = screen.getByTestId("ladder-panel-programs");
    expect(programs.className).toContain("hidden");
    expect(programs.className).not.toContain("grid");

    await user.click(surfaceButton("Programs"));
    expect(programs.className).toContain("grid");
    expect(programs.className).not.toContain("hidden");
  });

  it("names only the surfaces this family has", () => {
    render(<Harness surfaces={["home", "notes"]} />);
    expect(
      within(screen.getByTestId("ladder-tabs")).getAllByRole("button").map((button) => button.textContent)
    ).toEqual(["Home", "Notes"]);
  });

  it("keeps the bar away while Home is the only surface", () => {
    render(<Harness surfaces={["home"]} showTabs={false} />);
    expect(screen.queryByTestId("ladder-tabs")).not.toBeInTheDocument();
    expect(screen.getByText("front door")).toBeVisible();
  });

  // F1b. On a first run there is one tab and there was one bug: three panels
  // labelled by tab ids no tab had rendered.
  it("leaves no panel region labelled by navigation that does not exist", () => {
    const { container, rerender } = render(<Harness surfaces={["home"]} showTabs={false} />);
    // No bar yet, so no named region either — the panel is simply the page.
    expect(document.querySelectorAll('[data-ladder-panel][role="region"]')).toHaveLength(0);
    expect(screen.getByText("front door")).toBeVisible();
    expect(danglingLabelReferences(container)).toEqual([]);

    rerender(<Harness surfaces={["home", "notes"]} />);
    expect(document.querySelectorAll('[data-ladder-panel][role="region"]')).toHaveLength(2);
    expect(danglingLabelReferences(container)).toEqual([]);

    rerender(<Harness />);
    expect(document.querySelectorAll('[data-ladder-panel][role="region"]')).toHaveLength(4);
    expect(danglingLabelReferences(container)).toEqual([]);
  });

  it("uses ordinary bottom-navigation focus and does not consume scroll arrows", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    surfaceButton("Home").focus();
    await user.keyboard("{ArrowRight}");
    expect(surfaceButton("Home")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(surfaceButton("Home")).toHaveFocus();
    expect(within(screen.getByTestId("ladder-tabs")).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByTestId("ladder-tabs").querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  // P4: the language control is chrome, not a setting. It is in the header of
  // every surface, both labels always visible, each its own target.
  it("carries the language control in the header, on every surface", async () => {
    const onLanguageChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onLanguageChange={onLanguageChange} />);

    const header = screen.getByRole("banner");
    const group = within(header).getByRole("group", { name: "Language / Idioma" });
    const [en, es] = within(group).getAllByRole("button");
    expect(en).toHaveTextContent("EN");
    expect(es).toHaveTextContent("Español");
    expect(en).toHaveAttribute("aria-pressed", "true");

    await user.click(surfaceButton("Visit"));
    expect(within(screen.getByRole("banner")).getByRole("group", { name: "Language / Idioma" })).toBeVisible();

    await user.click(es);
    expect(onLanguageChange).toHaveBeenCalledWith("es");
  });

  // 1i: layer 0. The banner leads whatever surface is open, above its header.
  it("puts the crisis layer above the header and keeps it there across tabs", async () => {
    const user = userEvent.setup();
    render(<Harness crisis={<p>Your safety comes first.</p>} />);

    const layer = screen.getByTestId("ladder-crisis-layer");
    expect(layer).toHaveTextContent("Your safety comes first.");
    expect(
      layer.compareDocumentPosition(screen.getByRole("banner")) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await user.click(surfaceButton("Programs"));
    expect(screen.getByTestId("ladder-crisis-layer")).toBeVisible();
  });

  // F8.2. The language control is on every surface, including the crisis state,
  // and neither variant had a visible focus ring.
  it("gives the language control a focus ring in the header variant", () => {
    render(<Harness />);

    const group = within(screen.getByRole("banner")).getByRole("group", {
      name: "Language / Idioma"
    });
    for (const button of within(group).getAllByRole("button")) {
      expect(button.className).toContain("focus-visible:outline");
    }
  });

  // F8.8. The bar is sticky, so it overlays the end of the scroll; on an iPhone
  // its last row also sat under the home indicator.
  it("pads the sticky bar and the exit link clear of the home indicator", () => {
    render(<Harness />);

    expect(screen.getByTestId("ladder-tabs").getAttribute("style")).toContain(
      "env(safe-area-inset-bottom)"
    );
    const exit = screen.getByRole("link", { name: "All my health" }).closest("p");
    expect(exit?.getAttribute("style")).toContain("env(safe-area-inset-bottom)");
  });

  it("offers a way back to the rest of the app", () => {
    render(<Harness />);
    expect(screen.getByRole("link", { name: "All my health" })).toHaveAttribute("href", "/menu");
  });

  it("activates, scrolls to, and focuses a target owned by another surface", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, "", "/ladder?surface=home");
    render(<AnchorHarness />);

    await user.click(screen.getByRole("link", { name: "Open programs" }));
    const target = await screen.findByRole("heading", { name: "Program matches" });
    await waitFor(() => expect(target).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });

    await user.click(surfaceButton("Home"));
    expect(surfaceButton("Home")).toHaveAttribute("aria-current", "page");
    expect(window.location.hash).toBe("");
    expect(target).not.toBeVisible();

    window.history.replaceState(null, "", window.location.pathname);
    HTMLElement.prototype.scrollIntoView = original;
  });

  it("settles an anchor whose conditional target mounts after the first frames", async () => {
    const user = userEvent.setup();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<DelayedAnchorHarness />);

    await user.click(screen.getByRole("link", { name: "Open later check-in" }));
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    await user.click(screen.getByRole("button", { name: "Show check-in" }));

    const target = await screen.findByRole("heading", { name: "Monthly check-in" });
    await waitFor(() => expect(target).toHaveFocus());
    HTMLElement.prototype.scrollIntoView = original;
  });
});

describe("ladderSurfaceForAnchor", () => {
  it("routes an in-page link to the surface that owns its target", () => {
    expect(ladderSurfaceForAnchor("#family-resources")).toBe("programs");
    expect(ladderSurfaceForAnchor("#family-visit-packet")).toBe("notes");
    expect(ladderSurfaceForAnchor("#family-appt-title")).toBe("visit");
    expect(ladderSurfaceForAnchor("#family-checkin")).toBe("home");
  });

  it("leaves the caregiver where they are for anything it does not own", () => {
    expect(ladderSurfaceForAnchor("#something-else")).toBeUndefined();
    expect(ladderSurfaceForAnchor("#")).toBeUndefined();
    expect(ladderSurfaceForAnchor("#%E0%A4%A")).toBeUndefined();
  });
});
