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

  it("does not mount patient state on the FoodLens public door", () => {
    render(<AppSurfaceBoundary surface="foodlens">Public</AppSurfaceBoundary>);

    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.queryByTestId("health-state-provider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accessibility-shell")).not.toBeInTheDocument();
  });

  it("keeps patient state on the personal FoodLens door", () => {
    pathname = "/food";
    render(<AppSurfaceBoundary surface="foodlens">Personal</AppSurfaceBoundary>);

    expect(screen.getByTestId("health-state-provider")).toBeInTheDocument();
    expect(screen.getByTestId("accessibility-shell")).toBeInTheDocument();
  });

  it("preserves the provider in the full application", () => {
    render(<AppSurfaceBoundary surface="full">Public</AppSurfaceBoundary>);

    expect(screen.getByTestId("health-state-provider")).toBeInTheDocument();
  });
});
