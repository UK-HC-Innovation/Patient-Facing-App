import React from "react";
import Link from "next/link";
import { PhoneFrame } from "@/components/phone-frame";

// Not in the app nav — a standalone bezel for stakeholder walkthroughs. The
// iframe is same-origin, so it shares this browser's localStorage and shows the
// default retinopathy-due demo state. It opens
// on the DR-screening SMS nudge so the golden path starts one tap in.
export default function DemoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-paper p-6 text-ink">
      <h1 className="text-xl font-semibold">Patient Centered — phone demo</h1>
      <PhoneFrame>
        <iframe className="h-full w-full border-0" src="/screening?entry=sms" title="Patient Centered demo" />
      </PhoneFrame>
      <p className="max-w-md text-center text-sm text-ink/70">
        Golden path: nudge → See times near me → Book it → ride question → (Home shows the appointment) → “I had my
        screening” → demo picker → report-moderate-npdr → “That&apos;s right” → referral sent → simulate silence → pick a
        slot → teachable moment. Restore the default walkthrough from the Privacy page and rerun with report-pdr-dme (urgent) or report-no-dr
        (recall). This frame shares the saved data in this browser.
      </p>
      <Link
        href="/ladder/impact"
        className="inline-flex min-h-12 items-center rounded-control bg-care px-4 py-2 text-sm font-semibold text-white"
      >
        Open Ladder clinic impact demo
      </Link>
    </main>
  );
}
