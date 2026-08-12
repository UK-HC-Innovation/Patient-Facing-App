import type { LadderSessionState } from "@/components/ladder/ladder-session-types";
import type {
  FamilyAppointmentWorkflowState
} from "@/domain/family-appointment-workflow";
import type { FamilyNavigatorState } from "@/domain/types";
import { stripLadderSimulationFamily } from "@/domain/ladder-sim";

export function familyAppointmentWorkflowState(
  family: FamilyNavigatorState
): FamilyAppointmentWorkflowState {
  return {
    referral: family.referral,
    appointments: family.appointments,
    soonerList: family.soonerList
  };
}

export function applyLadderSimulation(
  family: FamilyNavigatorState,
  simulation: LadderSessionState["simulation"]
): FamilyNavigatorState {
  const visit = simulation.visit ?? familyAppointmentWorkflowState(family);
  const profile = family.profile
    ? {
        ...family.profile,
        diagnoses: family.profile.diagnoses.map((diagnosis) => ({
          ...diagnosis,
          diagnosedAt: simulation.diagnosisDates[diagnosis.id] ?? diagnosis.diagnosedAt
        }))
      }
    : null;
  return {
    ...family,
    profile,
    referral: visit.referral,
    appointments: visit.appointments,
    soonerList: visit.soonerList
  };
}

export function withoutLadderSimulation(
  family: FamilyNavigatorState
): FamilyNavigatorState {
  return stripLadderSimulationFamily(family);
}
