import React from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SwRegister } from "./sw-register";

describe("SwRegister", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the notification service worker", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register }
    });

    render(<SwRegister />);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith("/sw.js", { updateViaCache: "none" })
    );
  });
});
