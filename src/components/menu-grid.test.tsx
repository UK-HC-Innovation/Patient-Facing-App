import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { MenuGrid, MENU_GROUPS } from "./menu-grid";

// Every route the old flat bottom bar reached, except the home (/today), which
// is the persistent Home nav item. /screening joined at the end in the DR
// sprint (plan 09).
const REQUIRED_ROUTES = [
  "/numbers",
  "/glucose",
  "/medicines",
  "/food",
  "/screening",
  "/learn/retinopathy",
  "/plan",
  "/visits",
  "/chat",
  "/checkin",
  "/checkin/phq9",
  "/support",
  "/ladder",
  "/intake",
  "/privacy"
];

describe("MenuGrid reachability", () => {
  it("renders a link to every destination so collapsing the tab bar orphans no route", () => {
    render(<MenuGrid />);
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    for (const route of REQUIRED_ROUTES) {
      expect(hrefs, `menu must reach ${route}`).toContain(route);
    }
  });

  it("keeps exactly the catalog routes grouped, with no duplicates", () => {
    const flat = MENU_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(flat.length).toBe(REQUIRED_ROUTES.length);
    expect(new Set(flat)).toEqual(new Set(REQUIRED_ROUTES));
  });

  it("renders the localized family navigator entry", () => {
    const { rerender } = render(<MenuGrid language="en" />);
    expect(document.querySelector('a[href="/ladder"]')).toHaveTextContent("Ladder — your child's development");
    expect(document.querySelector('a[href="/ladder"]')).toHaveTextContent("Find developmental resources for your child");

    rerender(<MenuGrid language="es" />);
    expect(document.querySelector('a[href="/ladder"]')).toHaveTextContent("Ladder — el desarrollo de tu hijo o hija");
    expect(document.querySelector('a[href="/ladder"]')).toHaveTextContent("Encuentra recursos de desarrollo para tu hijo o hija");
  });

  it("keeps both the screening hub and moved PHQ-9 reachable", () => {
    const { rerender } = render(<MenuGrid language="en" />);
    expect(document.querySelector('a[href="/checkin"]')).toHaveTextContent("Check-ins & screenings");
    expect(document.querySelector('a[href="/checkin/phq9"]')).toHaveTextContent("Mood Check-in");

    rerender(<MenuGrid language="es" />);
    expect(document.querySelector('a[href="/checkin"]')).toHaveTextContent("Chequeos y evaluaciones");
    expect(document.querySelector('a[href="/checkin/phq9"]')).toHaveTextContent("Chequeo de Ánimo");
  });
});
