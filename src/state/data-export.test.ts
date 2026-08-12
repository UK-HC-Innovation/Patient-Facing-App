import { describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import { createFamilyAppointmentOffer } from "@/domain/family-appointments";
import { recordAuditEvent } from "@/domain/audit";
import { buildDataExport, downloadDataExportFile } from "./data-export";

describe("buildDataExport", () => {
  it("describes source provenance and excludes every session simulation artifact", () => {
    const simulatedAudit = recordAuditEvent(
      demoState.patient.id,
      "updated",
      "Earlier visit replaced the prior booking"
    );
    const state = {
      ...demoState,
      auditEvents: [...demoState.auditEvents, simulatedAudit],
      family: {
        ...schoolAgeFamilyState,
        profileProvenance: "extracted" as const,
        referral: {
          clinic: "UK Developmental Pediatrics",
          referredAt: "2026-08-01T12:00:00.000Z"
        },
        appointments: [createFamilyAppointmentOffer(new Date("2026-08-01T12:00:00.000Z"))],
        soonerList: {
          optedInAt: "2026-08-01T12:00:00.000Z",
          constraints: ["any_weekday" as const]
        }
      }
    };

    const exported = buildDataExport(state, new Date("2026-08-08T12:00:00.000Z"));

    expect(exported).toMatchObject({
      format: "home-health-data-export",
      exportVersion: 2,
      stateSchemaVersion: 1,
      exportedAt: "2026-08-08T12:00:00.000Z",
      provenance: {
        source: "browser_local",
        simulation: "excluded",
        family: { profile: { provenance: "extracted" } }
      }
    });
    expect(exported.state.family).toMatchObject({
      referral: null,
      appointments: [],
      soonerList: null
    });
    expect(exported.state.auditEvents).not.toContainEqual(simulatedAudit);
    expect(state.family.referral).not.toBeNull();
  });

  it("keeps compact interview provenance without duplicating caregiver words", () => {
    const exported = buildDataExport(
      { ...demoState, family: schoolAgeFamilyState },
      new Date("2026-08-08T12:00:00.000Z")
    );

    expect(exported.provenance.family?.interviews).toEqual(
      schoolAgeFamilyState.interviews.map(({ id, source, extraction, createdAt }) => ({
        id,
        source,
        extraction,
        createdAt
      }))
    );
    expect(exported.provenance.family?.facts).toHaveLength(schoolAgeFamilyState.facts.length);
    expect(exported.provenance.family?.facts.every(({ factId }) => factId.length > 0)).toBe(true);
    expect(JSON.stringify(exported.provenance)).not.toContain("rawText");
    expect(exported.provenance.sessionOnlyData).toEqual([
      "ai_consent",
      "voice_consent",
      "ladder_simulation"
    ]);
  });

  it("uses the production browser download flow and revokes its object URL", () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = vi.fn().mockReturnValue("blob:data-export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const exported = buildDataExport(demoState, new Date("2026-08-08T12:00:00.000Z"));

    downloadDataExportFile(exported, "family-data.json");

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.instances[0]).toHaveProperty("download", "family-data.json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:data-export");

    click.mockRestore();
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });
});
