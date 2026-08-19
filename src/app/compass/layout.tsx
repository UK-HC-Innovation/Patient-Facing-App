import type { Metadata } from "next";
import type { ReactNode } from "react";

// A "use client" page cannot export metadata, and without this the browser tab would read
// "Home Health Ownership" with the patient PWA's manifest — wrong on a shareable food demo.
import { COMPASS_PAGE_TITLE } from "./title";

export const metadata: Metadata = {
  title: COMPASS_PAGE_TITLE,
  description: "Score a food 1-100 with Food Compass 2.0 and see better options in the same food group."
};

export default function CompassLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
