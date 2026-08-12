import type { Metadata } from "next";
import React from "react";
import { FamilyImpactDashboardDemo } from "@/components/family-impact-dashboard-demo";

export const metadata: Metadata = {
  title: "Ladder clinic impact dashboard — demo",
  description: "Synthetic, on-device UKHCI Ladder impact measures for stakeholder review."
};

export default function LadderImpactPage() {
  return <FamilyImpactDashboardDemo />;
}
