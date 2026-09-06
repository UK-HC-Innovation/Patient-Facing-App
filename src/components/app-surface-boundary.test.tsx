import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSurfaceBoundary } from "./app-surface-boundary";

let pathname = "/food/demo";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname
}));

vi.mock("@/state/store", () => ({
  HealthStateProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="health-state-provider">{children}</div>
  )
}));

vi.mock("@/components/accessibility-shell", () => ({
  AccessibilityShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="accessibility-shell">{children}</div>
  )
}));

describe("AppSurfaceBoundary", () => {
  beforeEach(() => {
    pathname = "/food/demo";
  });

  it("does not mount patient state on the public door", () => {
    render(<AppSurfaceBoundary>Public</AppSurfaceBoundary>);

    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.queryByTestId("health-state-provider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accessibility-shell")).not.toBeInTheDocument();
  });

  it("keeps patient state on the personal door", () => {
    pathname = "/food";
    render(<AppSurfaceBoundary>Personal</AppSurfaceBoundary>);

    expect(screen.getByTestId("health-state-provider")).toBeInTheDocument();
    expect(screen.getByTestId("accessibility-shell")).toBeInTheDocument();
  });

  // Local and production wrote a stranger's browser a full patient record on a page
  // that never showed it. Only Azure got this right (critique N9).
  it("keeps the public door store-free on every build", () => {
    render(<AppSurfaceBoundary>Public</AppSurfaceBoundary>);

    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.queryByTestId("health-state-provider")).not.toBeInTheDocument();
  });

  it("preserves the provider on every other route", () => {
    pathname = "/today";
    render(<AppSurfaceBoundary>Home</AppSurfaceBoundary>);

    expect(screen.getByTestId("health-state-provider")).toBeInTheDocument();
    expect(screen.getByTestId("accessibility-shell")).toBeInTheDocument();
  });
});
