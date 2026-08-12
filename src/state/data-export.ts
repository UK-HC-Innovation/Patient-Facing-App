import { stripLadderSimulationState } from "@/domain/ladder-sim";
import {
  traceFamilyEvidence,
  type FamilyEvidenceTrace
} from "@/domain/family-evidence-provenance";
import type { AppState } from "@/domain/types";
import { APP_STATE_SCHEMA_VERSION } from "@/state/persistence-envelope";

export const DATA_EXPORT_FORMAT = "home-health-data-export";
export const DATA_EXPORT_VERSION = 2;

export type DataExportEnvelopeV2 = {
  format: typeof DATA_EXPORT_FORMAT;
  exportVersion: typeof DATA_EXPORT_VERSION;
  stateSchemaVersion: typeof APP_STATE_SCHEMA_VERSION;
  exportedAt: string;
  provenance: {
    source: "browser_local";
    simulation: "excluded";
    sessionOnlyData: readonly ["ai_consent", "voice_consent", "ladder_simulation"];
    family: null | {
      profile: { provenance: "stated" | "extracted" };
      interviews: Array<{
        id: string;
        source: "typed" | "voice" | "mixed";
        extraction: "live" | "mock";
        createdAt: string;
      }>;
      /** Record links and offsets only; caregiver narrative stays canonical in state. */
      facts: FamilyEvidenceTrace[];
      recommendation: null | {
        interviewId: string;
        extraction: "live" | "mock";
        createdAt: string;
      };
    };
  };
  state: AppState;
};

/**
 * Builds a portable, self-describing export without copying narrative text
 * into the provenance header. Record-level source fields remain in `state`.
 */
export function buildDataExport(
  state: AppState,
  now = new Date()
): DataExportEnvelopeV2 {
  const durable = stripLadderSimulationState(state);
  const family = durable.family;
  return {
    format: DATA_EXPORT_FORMAT,
    exportVersion: DATA_EXPORT_VERSION,
    stateSchemaVersion: APP_STATE_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    provenance: {
      source: "browser_local",
      simulation: "excluded",
      sessionOnlyData: ["ai_consent", "voice_consent", "ladder_simulation"],
      family: family
        ? {
            profile: { provenance: family.profileProvenance },
            interviews: family.interviews.map(({ id, source, extraction, createdAt }) => ({
              id,
              source,
              extraction,
              createdAt
            })),
            facts: traceFamilyEvidence(family),
            recommendation: family.recommendations
              ? {
                  interviewId: family.recommendations.interviewId,
                  extraction: family.recommendations.extraction,
                  createdAt: family.recommendations.createdAt
                }
              : null
          }
        : null
    },
    state: durable
  };
}

export function downloadDataExportFile(
  envelope: DataExportEnvelopeV2,
  fileName: string
): void {
  if (typeof document === "undefined") return;
  const payload = JSON.stringify(envelope, null, 2);
  const file = new Blob([payload], { type: "application/json" });
  const canCreateObjectURL = typeof URL.createObjectURL === "function";
  const href = canCreateObjectURL
    ? URL.createObjectURL(file)
    : `data:application/json;charset=utf-8,${encodeURIComponent(payload)}`;
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (canCreateObjectURL) URL.revokeObjectURL(href);
}
