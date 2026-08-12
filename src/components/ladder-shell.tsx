"use client";

import { CalendarDays, FileText, Home, LayoutGrid, type LucideIcon } from "lucide-react";
import Link from "next/link";
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { CONTROL_FOCUS } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";
import {
  LADDER_SURFACE_ORDER,
  ladderPanelId,
  ladderSurfaceDefinition,
  ladderSurfaceForAnchor,
  ladderTabId,
  type LadderIconKey,
  type LadderSurface
} from "@/components/ladder/ladder-surface-registry";
import { useLadderSurfaceScrollRestoration } from "@/components/ladder/use-ladder-surface-scroll-restoration";

export {
  ladderPanelId,
  ladderSurfaceForAnchor,
  ladderTabId,
  type LadderSurface
} from "@/components/ladder/ladder-surface-registry";

/**
 * Four reflow-safe surfaces behind a wrapping tab bar.
 *
 * For a caregiver at 11pm, four always-visible labelled destinations beat both
 * memory (a hub back-stack) and scroll-hunting (one twelve-viewport page). The
 * bar is sticky rather than fixed and lays out with a wrapping grid, so at 200%
 * zoom it reflows 2×2 instead of clipping and forcing horizontal scroll — which
 * is exactly what the current fixed two-link bar does.
 */
const SURFACE_ICONS: Record<LadderIconKey, LucideIcon> = {
  home: Home,
  programs: LayoutGrid,
  notes: FileText,
  visit: CalendarDays
};

/**
 * Whether the bottom navigation is on the page at all. A named panel region is
 * only created once the control that labels it exists.
 */
const LadderTabsRendered = createContext(false);

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
  /**
   * F2c. The way back to 988/911 after the banner has been acknowledged. Once a
   * caregiver has disclosed once, this rides in the header on every surface —
   * acknowledging used to take every urgent route off the page with nothing
   * saying they could be got back. Absent until there is something to reopen, so
   * a family who has never disclosed is not followed around by a crisis control.
   */
  urgentHelp?: ReactNode;
  /** Which tabs exist. Visit only appears when a referral fits this child. */
  surfaces: readonly LadderSurface[];
  surface: LadderSurface;
  onSurfaceChange: (surface: LadderSurface) => void;
  /** A registered fragment whose destination is being mounted and settled. */
  pendingAnchor?: string | null;
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
  urgentHelp,
  surfaces,
  surface,
  onSurfaceChange,
  pendingAnchor = null,
  showTabs,
  children
}: LadderShellProps) {
  const tabRefs = useRef(new Map<LadderSurface, HTMLButtonElement>());
  const previousSurfaceRef = useRef(surface);
  const lastPanelFocusRef = useRef<LadderSurface | null>(null);
  const visible = LADDER_SURFACE_ORDER.filter((candidate) => surfaces.includes(candidate));
  useLadderSurfaceScrollRestoration(surface, pendingAnchor);

  useEffect(() => {
    const rememberPanelFocus = (event: FocusEvent): void => {
      const node = event.target;
      if (!(node instanceof Element)) return;
      const panel = node.closest<HTMLElement>("[data-ladder-panel]");
      const owner = panel?.dataset.ladderPanel;
      lastPanelFocusRef.current = owner && surfaces.includes(owner as LadderSurface)
        ? (owner as LadderSurface)
        : null;
    };
    document.addEventListener("focusin", rememberPanelFocus);
    return () => document.removeEventListener("focusin", rememberPanelFocus);
  }, [surfaces]);

  useLayoutEffect(() => {
    const previous = previousSurfaceRef.current;
    if (previous === surface) return;
    previousSurfaceRef.current = surface;
    if (pendingAnchor) return;

    const activeElement = document.activeElement;
    const previousPanel = document.getElementById(ladderPanelId(previous));
    const focusWasStranded =
      (activeElement instanceof Node && previousPanel?.contains(activeElement)) ||
      (activeElement === document.body && lastPanelFocusRef.current === previous);
    if (focusWasStranded) tabRefs.current.get(surface)?.focus({ preventScroll: true });
  }, [pendingAnchor, surface]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Layer 0: safety words lead the surface, above its own header. */}
      {crisis ? (
        <div data-testid="ladder-crisis-layer" className="px-4 pt-4">
          {crisis}
        </div>
      ) : null}

      <header className="border-b border-care/15 bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-[8rem] flex-1">
            <h1 className="text-lg font-bold text-care">Ladder</h1>
            <p className="min-w-0 break-words text-xs text-ink/65">{subtitle}</p>
          </div>
          {/* P4: the language control is chrome, not a setting. It is in the
              header of every surface, including first run and the crisis state.
              F2c puts the urgent-help route beside it for the same reason. */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {urgentHelp}
            <LanguageToggle language={language} onChange={onLanguageChange} variant="segmented" />
          </div>
        </div>
        {/* F6d. The draft-translation caveat used to live in one branch of the
            composer, so a returning Spanish reader — whose composer is collapsed
            — never saw it. It belongs next to the control that turns Spanish on,
            on every surface, on entry. The segmented variant has no room to
            carry it itself; the header does. */}
        {language === "es" ? (
          <p
            data-testid="ladder-spanish-review-notice"
            lang="es"
            className="mx-auto max-w-2xl px-4 pb-3 text-sm leading-6 text-ink/70"
          >
            {tFamily(language, "spanishReviewNotice")}
          </p>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <LadderTabsRendered.Provider value={showTabs}>{children}</LadderTabsRendered.Provider>
      </main>

      {showTabs ? (
        <nav
          aria-label={tFamily(language, "tabsLabel")}
          data-testid="ladder-tabs"
          // Sticky, not fixed, and a wrapping grid: at 200% zoom this reflows
          // to two rows instead of clipping or forcing a horizontal scroll.
          // F8.8: pb-3 plus the home-indicator inset, so the last row of
          // targets is not sitting under the iPhone gesture bar.
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          className="sticky bottom-0 grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-1 border-t border-care/15 bg-white px-2 pt-1.5"
        >
          {visible.map((candidate) => {
            const definition = ladderSurfaceDefinition(candidate);
            const Icon = SURFACE_ICONS[definition.icon];
            const selected = candidate === surface;
            return (
              <button
                key={candidate}
                ref={(node) => {
                  if (node) tabRefs.current.set(candidate, node);
                  else tabRefs.current.delete(candidate);
                }}
                type="button"
                id={ladderTabId(candidate)}
                aria-current={selected ? "page" : undefined}
                aria-controls={ladderPanelId(candidate)}
                onClick={() => onSurfaceChange(candidate)}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-control px-1 text-xs ${
                  selected ? "bg-calm font-bold text-care" : "font-semibold text-ink/75"
                } ${CONTROL_FOCUS}`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                {tFamily(language, definition.labelKey)}
              </button>
            );
          })}
        </nav>
      ) : null}

      {/* The way back to the rest of the app. The four tabs are Ladder's own
          nav, so this is a quiet exit rather than a fifth destination. */}
      {/* The bar is sticky, so it overlays the end of the scroll: this link
          would otherwise sit exactly underneath it (F8.8). */}
      <p
        style={{ paddingBottom: showTabs ? "calc(5rem + env(safe-area-inset-bottom))" : undefined }}
        className="ladder-shell__exit mx-auto w-full max-w-2xl px-4 pb-6 pt-3"
      >
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
/**
 * An in-page link whose target sits on another surface has to change the tab
 * before the browser settles, or it lands on a hidden panel and does nothing —
 * the "escape hatch that isn't" the audit flagged, in a new costume.
 */
export type LadderAnchorSurfaceOptions = {
  activeSurface: LadderSurface;
  pendingAnchor: string | null;
  selectAnchor: (hash: string) => void;
  settleAnchor: () => void;
  /** Opens disclosure ancestors, then focuses and scrolls the real target. */
  openAnchor: (hash: string) => boolean;
};

export function useLadderAnchorSurface({
  activeSurface,
  pendingAnchor,
  selectAnchor,
  settleAnchor,
  openAnchor
}: LadderAnchorSurfaceOptions): void {
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const node = event.target;
      if (!(node instanceof Element)) return;
      const anchor = node.closest('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const hash = anchor.getAttribute("href") ?? "";
      if (!ladderSurfaceForAnchor(hash)) return;
      event.preventDefault();
      selectAnchor(hash);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [selectAnchor]);

  useEffect(() => {
    if (!pendingAnchor) return;
    const anchor = pendingAnchor;
    const owner = ladderSurfaceForAnchor(anchor);
    if (!owner || owner !== activeSurface) return;

    let frame: number | undefined;
    let timeout: number | undefined;
    let finished = false;
    const observer = new MutationObserver(() => {
      if (frame === undefined && !finished) {
        frame = window.requestAnimationFrame(settle);
      }
    });
    const stopWatching = (): void => {
      observer.disconnect();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
      frame = undefined;
      timeout = undefined;
    };
    function settle(): void {
      frame = undefined;
      if (finished) return;
      if (openAnchor(anchor)) {
        finished = true;
        stopWatching();
        settleAnchor();
      }
    }

    const panel = document.getElementById(ladderPanelId(owner)) ?? document.body;
    observer.observe(panel, { childList: true, subtree: true });
    frame = window.requestAnimationFrame(settle);
    // Conditional flow targets may not exist on this visit. Bound the observer
    // and clear the intent so an impossible deep link cannot leave navigation
    // permanently stuck in an anchor-restoration state.
    timeout = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      stopWatching();
      settleAnchor();
    }, 5_000);
    return () => {
      finished = true;
      stopWatching();
    };
  }, [activeSurface, openAnchor, pendingAnchor, settleAnchor]);
}

export type LadderPanelProps = {
  surface: LadderSurface;
  active: boolean;
  children: ReactNode;
};

/**
 * A panel mounts on first activation, then stays mounted and `hidden`. A
 * caregiver who taps away mid-sentence and back finds their draft and expanded
 * cards and scroll position where they left them without paying every panel's
 * effects up front.
 */
export function LadderPanel({ surface, active, children }: LadderPanelProps) {
  const labelled = useContext(LadderTabsRendered);
  const [visited, setVisited] = useState(active);
  useEffect(() => {
    if (active) setVisited(true);
  }, [active]);
  return (
    <div
      // The sticky controls are bottom navigation, not an ARIA tablist: their
      // panels precede them in DOM order. Name the current places as regions
      // without promising tab keyboard behavior the layout cannot provide.
      role={labelled ? "region" : undefined}
      id={ladderPanelId(surface)}
      data-testid={`ladder-panel-${surface}`}
      data-ladder-panel={surface}
      aria-labelledby={labelled ? ladderTabId(surface) : undefined}
      hidden={!active}
      // The display class has to go with the state: an author `display: grid`
      // beats the UA stylesheet's `[hidden] { display: none }`, so a panel
      // marked hidden would still be painted.
      className={active ? "grid min-w-0 gap-4" : "hidden"}
    >
      {active || visited ? children : null}
    </div>
  );
}
