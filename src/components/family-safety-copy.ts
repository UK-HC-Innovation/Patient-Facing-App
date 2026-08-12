import type { FamilySafetyEvent } from "@/domain/types";
import type { FamilyStringKey } from "@/i18n/family-strings";

export function familySafetyCopyKeys(event: FamilySafetyEvent): FamilyStringKey[] {
  if (event.tier === "blocked") return ["safetyMedicationChange"];
  const keys = new Set<FamilyStringKey>();
  if (event.guidance === "missing_child") keys.add("safetyMissingChild");
  if (event.guidance === "basic_needs_and_medication_access") {
    keys.add("safetySocial");
    keys.add("safetyMedicationAccess");
  }
  if (event.guidance === "medication_access") keys.add("safetyMedicationAccess");
  if (event.guidance === "basic_needs") keys.add("safetySocial");
  if (event.domain === "abuse") keys.add("safetyAbuse");
  if (event.domain === "harm_to_others") keys.add("safetyHarmToOthers");
  if (event.domain === "social" && event.guidance === undefined) keys.add("safetySocial");
  if (event.domain === "self_harm" || event.domain === "caregiver_collapse") {
    keys.add("safetyCrisis");
  }
  if (keys.size === 0) {
    keys.add(event.tier === "emergency" ? "safetyEmergency" : "safetyCrisis");
  }
  return [...keys];
}
