"use client";

import React, { useEffect, useRef, useState } from "react";
import { CONTROL_FOCUS, H2_SECTION } from "@/components/family-theme";

/**
 * Reference sections fold; care surfaces never do. A folded section keeps its
 * `id`, its landmark, and its heading exactly where they were — only the body
 * moves inside a native `<details>` — so every anchor on the page still resolves
 * and every child stays mounted (no state is lost by closing one).
 *
 * Opening is also reachable from outside: `openFamilyFoldsFor` dispatches
 * FOLD_OPEN_EVENT at the target and its ancestors, which is how a nav chip, the
 * wait-header rung link, or a deep load with a hash arrives at an open section
 * instead of a closed summary row.
 */
const FOLD_OPEN_EVENT = "family-fold-open";

export type FamilyFoldSectionProps = {
  id: string;
  testId?: string;
  /** Rendered as the section's heading inside the summary row; also its label. */
  title: string;
  titleId: string;
  /** One line naming what is inside, so the closed row still says something true. */
  summaryLine: string;
  /**
   * The page's own reason to fold. Changing it re-folds (or re-opens) the
   * section — the library folds exactly when the thread starts carrying the
   * answer — and it is the only thing that overrides a manual toggle.
   */
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function FamilyFoldSection({
  id,
  testId,
  title,
  titleId,
  summaryLine,
  defaultOpen = false,
  className,
  children
}: FamilyFoldSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const openFold = (): void => setOpen(true);
    node.addEventListener(FOLD_OPEN_EVENT, openFold);
    return () => node.removeEventListener(FOLD_OPEN_EVENT, openFold);
  }, []);

  return (
    <section
      ref={sectionRef}
      id={id}
      data-testid={testId}
      data-family-fold=""
      aria-labelledby={titleId}
      className={className}
    >
      <details
        open={open}
        // Keeps React's state and the browser's disclosure in step whichever one
        // moved first — a caregiver's tap, or an anchor arriving from elsewhere.
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary
          data-testid={testId ? `${testId}-summary` : undefined}
          className={`flex min-h-12 min-w-0 cursor-pointer list-item flex-wrap items-baseline gap-x-2 gap-y-1 rounded-control py-2 ${CONTROL_FOCUS}`}
        >
          <h2 id={titleId} className={H2_SECTION}>
            {title}
          </h2>
          <span className="min-w-0 break-words text-sm text-ink/70">{summaryLine}</span>
        </summary>
        <div className="pt-2">{children}</div>
      </details>
    </section>
  );
}

/**
 * Opens the folded section an in-page link is pointing at, plus any folded
 * ancestor it sits inside, before the browser settles on it. Native `<details>`
 * ancestors (a resource card's own "Details and source") are opened directly —
 * they own no React state.
 */
export function openFamilyFoldsFor(hash: string): boolean {
  if (typeof document === "undefined" || hash.length <= 1) return false;
  let target: HTMLElement | null = null;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    // A malformed hash is not worth throwing over; nothing to open.
    return false;
  }
  if (!target) return false;

  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node.dataset.familyFold !== undefined) {
      // Open the native disclosure synchronously so focus and scroll measure
      // the destination's final layout. The event keeps React state in step.
      const disclosure = node.querySelector(":scope > details");
      if (disclosure instanceof HTMLDetailsElement) disclosure.open = true;
      node.dispatchEvent(new CustomEvent(FOLD_OPEN_EVENT));
    } else if (node instanceof HTMLDetailsElement) {
      node.open = true;
    }
  }

  const labelledBy = target.getAttribute("aria-labelledby");
  const heading = labelledBy ? document.getElementById(labelledBy) : null;
  const focusTarget = heading ?? target;
  if (focusTarget.tabIndex < 0) {
    focusTarget.tabIndex = -1;
  }
  focusTarget.focus({ preventScroll: true });
  // The browser already scrolled to where the target was while it was closed, so
  // re-settle on it now that it has its full height.
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "start" });
  }
  return true;
}

/**
 * One listener for the whole page: in-page anchor clicks, hash changes, and a
 * deep load that arrives with a hash already set.
 */
export function useFamilyFoldAnchors(): void {
  useEffect(() => {
    const onHashChange = (): void => {
      openFamilyFoldsFor(window.location.hash);
    };
    const onClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const hash = anchor.getAttribute("href") ?? "";
      // After the browser has handled the navigation, so an already-current hash
      // (which fires no hashchange) still opens what it points at.
      window.setTimeout(() => openFamilyFoldsFor(hash), 0);
    };

    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onClick);
    if (window.location.hash) {
      window.setTimeout(() => openFamilyFoldsFor(window.location.hash), 0);
    }
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, []);
}
