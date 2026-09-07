"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The domain-breakdown panel's open state, and the focus round trip that makes it usable.
 *
 * Opening moves focus into the panel (the panel itself scrolls into view, clear of both
 * pinned bars); closing hands focus back to whichever control opened it, or a keyboard user
 * is dropped at the top of the document with no idea where they were.
 *
 * Two controls open it since spec 30 R11: the chart marker, and the "Why this score?" button
 * beside the number. Whichever one was used is the one focus returns to.
 *
 * `foodKey` closes the panel whenever the food changes: the breakdown explains one score,
 * and re-labelling the domains under a reader mid-read is worse than closing.
 */
export function useWhyScore(foodKey: string | null): {
  whyOpen: boolean;
  open: () => void;
  openFromButton: () => void;
  close: () => void;
  markerRef: React.RefObject<HTMLButtonElement | null>;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
} {
  const [whyOpen, setWhyOpen] = useState(false);
  const markerRef = useRef<HTMLButtonElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<React.RefObject<HTMLButtonElement | null>>(markerRef);

  useEffect(() => {
    setWhyOpen(false);
  }, [foodKey]);

  const open = useCallback(() => {
    triggerRef.current = markerRef;
    setWhyOpen(true);
  }, []);
  const openFromButton = useCallback(() => {
    triggerRef.current = buttonRef;
    setWhyOpen(true);
  }, []);
  const close = useCallback(() => {
    setWhyOpen(false);
    triggerRef.current.current?.focus();
  }, []);

  return { whyOpen, open, openFromButton, close, markerRef, buttonRef };
}
