import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The public door's own installed identity.
 *
 * A "use client" page cannot export metadata, so the tab title comes from here. The manifest
 * and icon have to be named here too: Next merges metadata field by field, so a field this
 * layout does not declare keeps the root layout's value. Declaring only the title used to
 * leave the shareable food link advertising "My Health" with the patient app icon, and
 * installing it opened /today — the blood-pressure app. Ladder hit this exact bug first
 * (src/app/ladder/layout.tsx) and fixed it the same way.
 *
 * Scope stays "/" so the /compass redirect still resolves inside the installed window rather
 * than kicking the visitor out to a browser tab. The root manifest is untouched, so anyone
 * who installed from / keeps the identity they already had.
 */
import { COMPASS_PAGE_TITLE } from "./title";

export const metadata: Metadata = {
  title: COMPASS_PAGE_TITLE,
  description: "Point the camera at a food, see its Food Compass score, and ask a question about it.",
  manifest: "/food-lens.webmanifest",
  icons: { icon: "/food-lens-icon.svg" }
};

export default function CompassLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
