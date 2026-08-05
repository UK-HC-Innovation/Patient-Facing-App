"use client";

import { CalendarDays, FileText, Home, LayoutGrid, type LucideIcon } from "lucide-react";
import Link from "next/link";
import React, { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { CONTROL_FOCUS } from "@/components/family-theme";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

/**
 * Four reflow-safe surfaces behind a wrapping tab bar.
 *
 * For a caregiver at 11pm, four always-visible labelled destinations beat both
 * memory (a hub back-stack) and scroll-hunting (one twelve-viewport page). The
 * bar is sticky rather than fixed and lays out with a wrapping grid, so at 200%
 * zoom it reflows 2×2 instead of clipping and forcing horizontal scroll — which
 * is exactly what the current fixed two-link bar does.
 */
export type LadderSurface = "home" | "programs" | "notes" | "visit";

const SURFACE_ORDER: readonly LadderSurface[] = ["home", "programs", "notes", "visit"];

const SURFACE_LABELS: Record<LadderSurface, FamilyStringKey> = {
  home: "tabHome",
  programs: "tabPrograms",
  notes: "tabNotes",
  visit: "tabVisit"
};

const SURFACE_ICONS: Record<LadderSurface, LucideIcon> = {
  home: Home,
  programs: LayoutGrid,
  notes: FileText,
  visit: CalendarDays
};

export function ladderTabId(surface: LadderSurface): string {
  return `ladder-tab-${surface}`;
}

/**
 * Whether the tab bar is on the page at all. A panel is only a `tabpanel` once
 * the tab that labels it exists — through the first session there is no bar, and
 * a `tabpanel` pointing `aria-labelledby` at an id nothing rendered is a broken
 * reference a screen reader reads as an unlabelled region.
 */
const LadderTabsRendered = createContext(false);

export function ladderPanelId(surface: LadderSurface): string {
  return `ladder-panel-${surface}`;
}

export type LadderShellProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  /** "Mateo · Pike County" once we know; the invitation line before that. */
  subtitle: string;
  /**
   * Layer 0. Rendered above the header of whatever surface is open, never
   * folded and never below other content.
   */
  crisis?: ReactNode;
  /** Which tabs exist. Visit only appears when a referral fits this child. */
  surfaces: readonly LadderSurface[];
  surface: LadderSurface;
  onSurfaceChange: (surface: LadderSurface) => void;
  /**
   * False through the first session, which stays a single thread: the tabs
   * appear once the first answer has landed and there is somewhere to go.
   */
  showTabs: boolean;
  children: ReactNode;
};

export function LadderShell({
  language,
  onLanguageChange,
  subtitle,
  crisis,
  surfaces,
  surface,
  onSurfaceChange,
  showTabs,
  children
}: LadderShellProps) {
  const tabRefs = useRef(new Map<LadderSurface, HTMLButtonElement>());
  const visible = SURFACE_ORDER.filter((candidate) => surfaces.includes(candidate));

  function moveFocus(from: LadderSurface, delta: number): void {
    const index = visible.indexOf(from);
    if (index < 0) return;
    const next = visible[(index + delta + visible.length) % visible.length];
    onSurfaceChange(next);
    tabRefs.current.get(next)?.focus();
  }

  function onTabKeyDown(event: React.KeyboardEvent, tab: LadderSurface): void {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(tab, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(tab, -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? visible[0] : visible[visible.length - 1];
      onSurfaceChange(next);
      tabRefs.current.get(next)?.focus();
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Layer 0: safety words lead the surface, above its own header. */}
      {crisis ? (
        <div data-testid="ladder-crisis-layer" className="px-4 pt-4">
          {crisis}
        </div>
      ) : null}

      <header className="border-b border-care/15 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-care">Ladder</h1>
            <p className="min-w-0 break-words text-xs text-ink/65">{subtitle}</p>
          </div>
          {/* P4: the language control is chrome, not a setting. It is in the
              header of every surface, including first run and the crisis state. */}
          <LanguageToggle language={language} onChange={onLanguageChange} variant="segmented" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <LadderTabsRendered.Provider value={showTabs}>{children}</LadderTabsRendered.Provider>
      </main>

      {showTabs ? (
        <nav
          role="tablist"
          aria-label={tFamily(language, "tabsLabel")}
          data-testid="ladder-tabs"
          // Sticky, not fixed, and a wrapping grid: at 200% zoom this reflows
          // to two rows instead of clipping or forcing a horizontal scroll.
          className="sticky bottom-0 grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-1 border-t border-care/15 bg-white px-2 pb-3 pt-1.5"
        >
          {visible.map((candidate) => {
            const Icon = SURFACE_ICONS[candidate];
            const selected = candidate === surface;
            return (
              <button
                key={candidate}
                ref={(node) => {
                  if (node) tabRefs.current.set(candidate, node);
                  else tabRefs.current.delete(candidate);
                }}
                type="button"
                role="tab"
                id={ladderTabId(candidate)}
                aria-selected={selected}
                aria-controls={ladderPanelId(candidate)}
                tabIndex={selected ? 0 : -1}
                onKeyDown={(event) => onTabKeyDown(event, candidate)}
                onClick={() => onSurfaceChange(candidate)}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-control px-1 text-xs ${
                  selected ? "bg-calm font-bold text-care" : "font-semibold text-ink/75"
                } ${CONTROL_FOCUS}`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                {tFamily(language, SURFACE_LABELS[candidate])}
              </button>
            );
          })}
        </nav>
      ) : null}

      {/* The way back to the rest of the app. The four tabs are Ladder's own
          nav, so this is a quiet exit rather than a fifth destination. */}
      <p className="ladder-shell__exit mx-auto w-full max-w-2xl px-4 pb-6 pt-3">
        <Link
          href="/menu"
          className={`inline-flex min-h-12 items-center text-sm font-semibold text-ink/70 underline underline-offset-4 ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "shellExit")}
        </Link>
      </p>
    </div>
  );
}

/**
 * Which surface owns each in-page anchor. Only the ids that are actually linked
 * to are listed; anything else stays on the surface the caregiver is already on.
 */
const ANCHOR_SURFACES: Readonly<Record<string, LadderSurface>> = {
  "family-experience": "home",
  "family-interview-title": "home",
  "family-checkin": "home",
  "family-remind": "home",
  "family-followup": "home",
  "family-clinic-now": "home",
  "family-timeline": "home",
  "family-resources": "programs",
  "family-resources-title": "programs",
  "family-guides": "programs",
  "family-journal": "notes",
  "family-visit-packet": "notes",
  "family-appt-title": "visit"
};

export function ladderSurfaceForAnchor(hash: string): LadderSurface | undefined {
  if (hash.length <= 1) return undefined;
  try {
    return ANCHOR_SURFACES[decodeURIComponent(hash.slice(1))];
  } catch {
    return undefined;
  }
}

/**
 * An in-page link whose target sits on another surface has to change the tab
 * before the browser settles, or it lands on a hidden panel and does nothing —
 * the "escape hatch that isn't" the audit flagged, in a new costume.
 */
export function useLadderAnchorSurface(onSurface: (surface: LadderSurface) => void): void {
  useEffect(() => {
    const settle = (hash: string): void => {
      const target = ladderSurfaceForAnchor(hash);
      if (target) onSurface(target);
    };
    const onHashChange = (): void => settle(window.location.hash);
    const onClick = (event: MouseEvent): void => {
      const node = event.target;
      if (!(node instanceof Element)) return;
      const anchor = node.closest('a[href^="#"]');
      if (anchor instanceof HTMLAnchorElement) settle(anchor.getAttribute("href") ?? "");
    };

    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onClick);
    if (window.location.hash) settle(window.location.hash);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, [onSurface]);
}

export type LadderPanelProps = {
  surface: LadderSurface;
  active: boolean;
  children: ReactNode;
};

/**
 * Inactive panels stay mounted and `hidden`. A caregiver who taps away
 * mid-sentence and back finds their draft, their expanded card, and their
 * scroll position where they left them — and print, find-in-page, and the
 * anchor links keep resolving across the whole surface.
 */
export function LadderPanel({ surface, active, children }: LadderPanelProps) {
  const labelled = useContext(LadderTabsRendered);
  return (
    <div
      // Only a tabpanel while its tab is on the page: through the first session
      // the bar is not rendered at all, and the role without the label is worse
      // than no role.
      role={labelled ? "tabpanel" : undefined}
      id={ladderPanelId(surface)}
      data-testid={`ladder-panel-${surface}`}
      data-ladder-panel={surface}
      aria-labelledby={labelled ? ladderTabId(surface) : undefined}
      hidden={!active}
      // The panel is a focus stop because it is a tabpanel; without the bar it
      // is just the page, and a bare focusable div is a tab stop that does nothing.
      tabIndex={labelled ? (active ? 0 : -1) : undefined}
      // The display class has to go with the state: an author `display: grid`
      // beats the UA stylesheet's `[hidden] { display: none }`, so a panel
      // marked hidden would still be painted.
      className={active ? "grid min-w-0 gap-4" : "hidden"}
    >
      {children}
    </div>
  );
}
