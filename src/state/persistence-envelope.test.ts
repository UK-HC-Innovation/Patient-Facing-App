import { describe, expect, it } from "vitest";
import {
  APP_STATE_SCHEMA_VERSION,
  decodeAppStateRecord,
  encodeAppStateRecord
} from "./persistence-envelope";

describe("AppState persistence envelope", () => {
  it("tags a root-compatible record and decodes it without metadata", () => {
    const encoded = encodeAppStateRecord(
      { patient: { id: "patient-1" }, family: null },
      new Date("2026-08-08T12:00:00.000Z")
    );

    expect(encoded.patient).toEqual({ id: "patient-1" });
    expect(encoded.__storage).toEqual({
      format: "home-health-ai-ownership-state",
      schemaVersion: APP_STATE_SCHEMA_VERSION,
      savedAt: "2026-08-08T12:00:00.000Z"
    });
    expect(decodeAppStateRecord(encoded)).toEqual({
      status: "current",
      state: { patient: { id: "patient-1" }, family: null },
      savedAt: "2026-08-08T12:00:00.000Z"
    });
  });

  it("recognizes today's raw state as legacy v0", () => {
    const state = { patient: { id: "patient-1" } };
    expect(decodeAppStateRecord(state)).toEqual({ status: "legacy", state });
  });

  it("refuses unknown versions without guessing at their state", () => {
    expect(
      decodeAppStateRecord({
        patient: { id: "future" },
        __storage: {
          format: "home-health-ai-ownership-state",
          schemaVersion: 2,
          savedAt: "2026-08-08T12:00:00.000Z"
        }
      })
    ).toEqual({ status: "future_version", schemaVersion: 2 });
  });
});
