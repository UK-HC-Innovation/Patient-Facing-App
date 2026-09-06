import "@/styles/globals.css";
import { AppSurfaceBoundary } from "@/components/app-surface-boundary";
import { SwRegister } from "@/components/sw-register";
import { UsageBoundary } from "@/telemetry/usage-boundary";
import { APP_SURFACE } from "@/config/app-surface";
import { REALTIME_NONCE_META_NAME, issueRealtimeNonce } from "@/server/realtime-nonce";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: APP_SURFACE === "foodlens" ? "1 good choice" : "Home Health Ownership",
  description:
    APP_SURFACE === "foodlens"
      ? "See a food's Food Compass score and explore better alternatives."
      : "Patient-owned home care support for blood pressure, medicines, and visits.",
  manifest: APP_SURFACE === "foodlens" ? "/food-lens.webmanifest" : "/manifest.webmanifest",
  icons: { icon: APP_SURFACE === "foodlens" ? "/food-lens-icon.svg" : "/app-icon.svg" }
};

export const viewport: Viewport = {
  themeColor: "#0033a0"
};

/**
 * The realtime token route only mints a live session for a caller that loaded this HTML, so
 * the nonce below has to be minted per request. A prerendered page would serve one nonce
 * from build time forever, which is the same as no nonce at all.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <meta name={REALTIME_NONCE_META_NAME} content={issueRealtimeNonce()} />
        {APP_SURFACE === "foodlens" ? null : <SwRegister />}
        <UsageBoundary />
        <AppSurfaceBoundary>{children}</AppSurfaceBoundary>
      </body>
    </html>
  );
}
