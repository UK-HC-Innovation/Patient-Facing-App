"use client";

import React from "react";
import { FamilyAppointmentCard } from "@/components/family-appointment-card";
import {
  createFamilyAppointmentOffer,
  createSoonerAppointmentOffer,
  type FamilyAppointmentCountdownDays
} from "@/domain/family-appointments";
import type { FamilyAppointmentWorkflowEvent } from "@/domain/family-appointment-workflow";
import type {
  FamilyAppointmentBarrier,
  FamilyNavigatorState,
  FamilyReminderOffset,
  FamilySoonerConstraint
} from "@/domain/types";
import type { Language } from "@/i18n/strings";

const DAY_MS = 24 * 60 * 60 * 1000;

export type LadderVisitSurfaceProps = {
  family: FamilyNavigatorState;
  language: Language;
  now: Date;
  simulationEnabled: boolean;
  locked: boolean;
  onSeedReferral: () => void;
  onTransition: (event: FamilyAppointmentWorkflowEvent) => void;
  onPositionSimulationClock: (offsetMs: number) => void;
};

/**
 * Adapter between the appointment card's intent callbacks and the single
 * appointment workflow event language. Keeping this here lets the Visit surface
 * load independently and prevents the parent experience from re-implementing
 * the workflow wiring one callback at a time.
 */
export function LadderVisitSurface({
  family,
  language,
  now,
  simulationEnabled,
  locked,
  onSeedReferral,
  onTransition,
  onPositionSimulationClock
}: LadderVisitSurfaceProps) {
  const at = now.toISOString();

  return (
    <FamilyAppointmentCard
      family={family}
      language={language}
      now={now}
      simulationEnabled={simulationEnabled}
      locked={locked}
      onSeedReferral={onSeedReferral}
      onBook={(appointmentId, slot) =>
        onTransition({ type: "booked", appointmentId, slot, at })
      }
      onBarriers={(appointmentId, barriers: FamilyAppointmentBarrier[]) =>
        onTransition({ type: "barriersRecorded", appointmentId, barriers, at })
      }
      onAckReminder={(appointmentId, offset: FamilyReminderOffset) =>
        onTransition({ type: "reminderAcknowledged", appointmentId, offset, at })
      }
      onReschedule={(appointmentId) =>
        onTransition({ type: "rescheduleRequested", appointmentId, at })
      }
      onComplete={(appointmentId) => onTransition({ type: "completed", appointmentId, at })}
      onMiss={(appointmentId) => onTransition({ type: "missed", appointmentId, at })}
      onRebook={() =>
        onTransition({ type: "offered", appointment: createFamilyAppointmentOffer(now) })
      }
      onCountdown={(appointmentId, daysUntil: FamilyAppointmentCountdownDays) => {
        const scheduledFor = family.appointments.find(({ id }) => id === appointmentId)
          ?.scheduledFor;
        if (!scheduledFor) return;
        const targetNow = new Date(scheduledFor).valueOf() - daysUntil * DAY_MS;
        onPositionSimulationClock(targetNow - Date.now());
      }}
      onJoinSoonerList={(constraints: FamilySoonerConstraint[]) =>
        onTransition({ type: "soonerListJoined", constraints, at })
      }
      onLeaveSoonerList={() => onTransition({ type: "soonerListLeft" })}
      onSoonerOffer={(supersedesId) => {
        if (family.soonerList === null) return;
        onTransition({
          type: "offered",
          appointment: createSoonerAppointmentOffer(
            now,
            family.soonerList.constraints,
            supersedesId
          )
        });
      }}
      onDeclineSoonerOffer={(appointmentId) =>
        onTransition({ type: "withdrawn", appointmentId, at })
      }
    />
  );
}
