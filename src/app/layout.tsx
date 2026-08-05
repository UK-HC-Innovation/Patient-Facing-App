import "@/styles/globals.css";
import { AccessibilityShell } from "@/components/accessibility-shell";
import { SwRegister } from "@/components/sw-register";
import { HealthStateProvider } from "@/state/store";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Home Health Ownership",
  description: "Patient-owned home care support for blood pressure, medicines, and visits.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/app-icon.svg" }
};

export const viewport: Viewport = {
  themeColor: "#0033a0"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SwRegister />
        <HealthStateProvider>
          <AccessibilityShell>{children}</AccessibilityShell>
        </HealthStateProvider>
      </body>
    </html>
  );
}
