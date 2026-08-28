import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FoodLabelFallback } from "./food-label-fallback";

describe("FoodLabelFallback", () => {
  it("offers one label-photo action", async () => {
    const onRead = vi.fn();
    render(<FoodLabelFallback language="en" onRead={onRead} state="idle" />);

    await userEvent.click(screen.getByRole("button", { name: "Read the Nutrition Facts label" }));
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("shows a fixed Spanish failure with no retry control", () => {
    render(<FoodLabelFallback language="es" onRead={() => {}} state="error" />);

    expect(screen.getByRole("alert")).toHaveTextContent("No pude leer la etiqueta");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
