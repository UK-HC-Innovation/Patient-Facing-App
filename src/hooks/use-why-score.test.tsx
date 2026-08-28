import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useWhyScore } from "./use-why-score";

function Probe({ foodKey }: { foodKey: string | null }) {
  const { whyOpen, open, close, markerRef } = useWhyScore(foodKey);
  return (
    <>
      <button onClick={open} ref={markerRef} type="button">
        marker
      </button>
      {whyOpen ? (
        <button onClick={close} type="button">
          close
        </button>
      ) : null}
    </>
  );
}

describe("useWhyScore", () => {
  it("opens from the marker and hands focus back to it on close", async () => {
    const user = userEvent.setup();
    render(<Probe foodKey="banana" />);

    await user.click(screen.getByRole("button", { name: "marker" }));
    await user.click(screen.getByRole("button", { name: "close" }));

    // Without the handback a keyboard user is dropped at the top of the document with no
    // idea where the panel they just closed used to be.
    expect(screen.getByRole("button", { name: "marker" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "close" })).not.toBeInTheDocument();
  });

  it("closes itself when the lens moves to a different food", async () => {
    const user = userEvent.setup();
    const view = render(<Probe foodKey="banana" />);
    await user.click(screen.getByRole("button", { name: "marker" }));
    expect(screen.getByRole("button", { name: "close" })).toBeInTheDocument();

    // The breakdown explains one score; re-labelling the domains under a reader mid-read
    // is worse than closing.
    act(() => {
      view.rerender(<Probe foodKey="plantain" />);
    });

    expect(screen.queryByRole("button", { name: "close" })).not.toBeInTheDocument();
  });

  it("stays open while the same food is still on screen", async () => {
    const user = userEvent.setup();
    const view = render(<Probe foodKey="banana" />);
    await user.click(screen.getByRole("button", { name: "marker" }));

    act(() => {
      view.rerender(<Probe foodKey="banana" />);
    });

    expect(screen.getByRole("button", { name: "close" })).toBeInTheDocument();
  });
});
