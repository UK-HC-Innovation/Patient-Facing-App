import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import DemoPage from "./page";

describe("DemoPage", () => {
  it("links stakeholder walkthroughs to the Ladder clinic impact demo", () => {
    render(<DemoPage />);

    expect(screen.getByRole("link", { name: "Open Ladder clinic impact demo" })).toHaveAttribute(
      "href",
      "/ladder/impact"
    );
  });
});
