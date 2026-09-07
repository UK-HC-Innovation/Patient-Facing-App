"use client";

import { Home, LayoutGrid } from "lucide-react";
import Link from "next/link";
import React, { type ReactNode } from "react";
import { APP_SURFACE } from "@/config/app-surface";
import { tHome } from "@/i18n/home-strings";
import { useHealthState } from "@/state/store";
import { OneGoodChoiceBrand } from "@/components/one-good-choice-brand";

// The tab bar collapsed from 11 flat peers to a chat-first Home plus a single
// "All my health" browse menu. Every former destination stays reachable through
// /menu (see menu-grid.tsx).
const fullNavItems = [
  { href: "/today", labelKey: "navHome" as const, icon: Home },
  { href: "/menu", labelKey: "navMenu" as const, icon: LayoutGrid }
];

const foodLensNavItems = [
  { href: "/food", label: "1 good choice", icon: Home },
  { href: "/food/demo", label: "Share", icon: LayoutGrid }
];

export function AppShell({
  title,
  children,
  navigationMode = APP_SURFACE,
  brand,
  headerAction
}: {
  title: string;
  children: ReactNode;
  navigationMode?: "full" | "foodlens";
  brand?: "one-good-choice";
  /** Rendered at the end of the branded header row. The food doors put EN | ES here. */
  headerAction?: ReactNode;
}) {
  const { state } = useHealthState();
  const navItems = navigationMode === "foodlens" ? foodLensNavItems : fullNavItems;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header
        className={
          brand === "one-good-choice"
            ? "border-b-4 border-care bg-white"
            : "border-b border-ink/10 bg-white"
        }
      >
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-3 px-4 py-4">
          {brand === "one-good-choice" ? (
            <OneGoodChoiceBrand action={headerAction} title={title} />
          ) : (
            <div>
              <p className="text-sm font-medium text-care">
                {navigationMode === "foodlens" ? "1 good choice" : "Home Health Ownership"}
              </p>
              <h1 className="text-2xl font-semibold">{title}</h1>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 pb-28 sm:pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                className="flex min-h-14 flex-col items-center justify-center rounded-control px-2 text-center text-sm font-medium text-ink hover:bg-calm"
                href={item.href}
              >
                <Icon aria-hidden="true" className="mb-1 h-5 w-5" />
                {"label" in item ? item.label : tHome(state.patient.language, item.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
