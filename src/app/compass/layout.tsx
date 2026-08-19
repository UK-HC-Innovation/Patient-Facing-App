import type { Metadata } from "next";
import type { ReactNode } from "react";

// A "use client" page cannot export metadata, and without this the browser tab would read
// "Home Health Ownership" with the patient PWA's manifest — wrong on a shareable food demo.
import { COMPASS_PAGE_TITLE } from "./title";

export const metadata: Metadata = {
  title: COMPASS_PAGE_TITLE,
  description: "Functional demo: scan or describe a food, review its Food Compass score, and ask a question."
};

export default function CompassLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
