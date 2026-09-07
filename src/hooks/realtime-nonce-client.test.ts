import { describe, expect, it } from "vitest";
import { REALTIME_NONCE_META_NAME as SERVER_META_NAME } from "@/server/realtime-nonce";
import { REALTIME_NONCE_META_NAME, readRealtimeNonce } from "./realtime-nonce-client";

describe("realtime nonce, client side", () => {
  /**
   * The name is duplicated on purpose: importing the server module into a client hook
   * would drag node:crypto into the browser bundle. A drift between the two would not
   * throw anywhere. It would just make every voice session fall back to mock, quietly.
   */
  it("uses the same meta name the layout stamps", () => {
    expect(REALTIME_NONCE_META_NAME).toBe(SERVER_META_NAME);
  });

  it("reads the nonce out of the document", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", REALTIME_NONCE_META_NAME);
    meta.setAttribute("content", "rt1.123.abc.def");
    document.head.append(meta);

    expect(readRealtimeNonce()).toBe("rt1.123.abc.def");
    meta.remove();
  });

  it("returns an empty string rather than throwing when the tag is absent", () => {
    expect(readRealtimeNonce()).toBe("");
  });
});
