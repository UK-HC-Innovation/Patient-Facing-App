"use client";

import { BookOpen, Camera, ClipboardList, Droplet, Eye, HandHeart, HeartPulse, LockKeyhole, MessageCircle, NotebookPen, Pill, Stethoscope, Upload, type LucideIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { tHome, type HomeStringKey } from "@/i18n/home-strings";
import type { Language } from "@/i18n/strings";

type MenuItem = { href: string; labelKey: HomeStringKey; descKey: HomeStringKey; icon: LucideIcon };
type MenuGroup = { titleKey: HomeStringKey; items: MenuItem[] };

// The browse surface that replaces the flat 11-tab bar. Every destination the
// old bottom bar reached lives here (except the home itself, which is the Home
// nav item), so collapsing the bar orphans no route. menu-grid.test.tsx asserts
// that reachability invariant against the hrefs.
export const MENU_GROUPS: MenuGroup[] = [
  {
    titleKey: "menuGroupTrack",
    items: [
      { href: "/numbers", labelKey: "menuNumbersLabel", descKey: "menuNumbersDesc", icon: HeartPulse },
      { href: "/glucose", labelKey: "menuGlucoseLabel", descKey: "menuGlucoseDesc", icon: Droplet },
      { href: "/medicines", labelKey: "menuMedicinesLabel", descKey: "menuMedicinesDesc", icon: Pill },
      { href: "/food", labelKey: "menuFoodLabel", descKey: "menuFoodDesc", icon: Camera },
      { href: "/screening", labelKey: "menuScreeningLabel", descKey: "menuScreeningDesc", icon: Eye }
    ]
  },
  {
    titleKey: "menuGroupUnderstand",
    items: [
      { href: "/learn/retinopathy", labelKey: "menuRetinopathyLearnLabel", descKey: "menuRetinopathyLearnDesc", icon: BookOpen },
      { href: "/plan", labelKey: "menuPlanLabel", descKey: "menuPlanDesc", icon: ClipboardList },
      { href: "/visits", labelKey: "menuVisitsLabel", descKey: "menuVisitsDesc", icon: Stethoscope },
      { href: "/chat", labelKey: "menuCoachLabel", descKey: "menuCoachDesc", icon: MessageCircle }
    ]
  },
  {
    titleKey: "menuGroupSupport",
    items: [
      { href: "/checkin", labelKey: "menuCheckinLabel", descKey: "menuCheckinDesc", icon: ClipboardList },
      { href: "/checkin/phq9", labelKey: "menuMoodLabel", descKey: "menuMoodDesc", icon: NotebookPen },
      { href: "/support", labelKey: "menuSupportLabel", descKey: "menuSupportDesc", icon: HandHeart },
      { href: "/ladder", labelKey: "menuFamilyLabel", descKey: "menuFamilyDesc", icon: HandHeart }
    ]
  },
  {
    titleKey: "menuGroupManage",
    items: [
      { href: "/intake", labelKey: "menuIntakeLabel", descKey: "menuIntakeDesc", icon: Upload },
      { href: "/privacy", labelKey: "menuPrivacyLabel", descKey: "menuPrivacyDesc", icon: LockKeyhole }
    ]
  }
];

export function MenuGrid({ language = "en" }: { language?: Language }) {
  return (
    <div className="space-y-6">
      {MENU_GROUPS.map((group) => (
        <section key={group.titleKey} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">{tHome(language, group.titleKey)}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex min-h-16 items-start gap-3 rounded-control border border-ink/10 bg-white p-4 hover:border-care">
                  <Icon aria-hidden="true" className="mt-0.5 h-6 w-6 flex-none text-care" />
                  <span>
                    <span className="block font-semibold">{tHome(language, item.labelKey)}</span>
                    <span className="mt-1 block text-sm text-ink/70">{tHome(language, item.descKey)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
