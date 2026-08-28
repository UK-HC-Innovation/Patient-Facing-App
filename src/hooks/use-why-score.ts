"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The domain-breakdown panel's open state, and the focus round trip that makes it usable.
 *
 * Opening from the chart marker moves focus into the panel (the panel itself scrolls into
 * view, clear of both pinned bars); closing hands focus back to the marker that opened it,
 * or a keyboard user is dropped at the top of the document with no idea where they were.
 *
 * `foodKey` closes the panel whenever the food changes: the breakdown explains one score,
 * and re-labelling the domains under a reader mid-read is worse than closing.
 */
export function useWhyScore(foodKey: string | null): {
  whyOpen: boolean;
  open: () => void;
  close: () => void;
  markerRef: React.RefObject<HTMLButtonElement | null>;
} {
  const [whyOpen, setWhyOpen] = useState(false);
  const markerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setWhyOpen(false);
  }, [foodKey]);

  const open = useCallback(() => setWhyOpen(true), []);
  const close = useCallback(() => {
    setWhyOpen(false);
    markerRef.current?.focus();
  }, []);

  return { whyOpen, open, close, markerRef };
}
