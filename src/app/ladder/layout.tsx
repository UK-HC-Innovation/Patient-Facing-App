import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * F4b. Ladder's own installed identity.
 *
 * Installing from /ladder used to produce a "My Health" icon that opened the
 * blood-pressure app's Today page — the root manifest's name and start_url, on
 * a route that shares nothing with it. This route serves its own manifest, so
 * the icon on a caregiver's home screen says Ladder and opens Ladder. Scope
 * stays "/" so the shell's way back to /menu still runs inside the installed
 * window; the root manifest is untouched, and a user who installs from / keeps
 * the identity they already had.
 */
export const metadata: Metadata = {
  title: "Ladder — your child's development",
  description:
    "Kentucky family navigator: what to do while you wait for a developmental evaluation.",
  manifest: "/ladder.webmanifest",
  icons: { icon: "/ladder-icon.svg" }
};

export default function LadderLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
