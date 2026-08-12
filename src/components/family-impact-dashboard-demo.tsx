"use client";

import { useMemo } from "react";
import {
  LADDER_IMPACT_DEMO_AS_OF,
  LADDER_IMPACT_DEMO_COHORT
} from "@/domain/family-impact-fixtures";
import { buildFamilyImpactSnapshot } from "@/domain/family-impact";
import { FamilyImpactDashboard } from "./family-impact-dashboard";

/** Browser-only composition: the frozen cohort and its selectors ship together. */
export function FamilyImpactDashboardDemo() {
  const snapshot = useMemo(
    () =>
      buildFamilyImpactSnapshot(
        LADDER_IMPACT_DEMO_COHORT,
        new Date(LADDER_IMPACT_DEMO_AS_OF)
      ),
    []
  );
  return <FamilyImpactDashboard snapshot={snapshot} />;
}
