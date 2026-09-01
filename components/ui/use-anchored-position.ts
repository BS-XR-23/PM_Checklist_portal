"use client";

import { useEffect, useState, type RefObject } from "react";

export type AnchoredCoords = { top: number; left: number; openUp: boolean };

/**
 * Computes fixed-position coordinates for a floating panel anchored to an
 * element, flipping upward when there isn't room below — same mechanism
 * RowActionsMenu uses so its "•••" dropdown can't be clipped by a
 * scrollable/overflow-hidden table ancestor. Shared here so the checklist's
 * expand-to-edit text fields and the Notes popup don't each reimplement it.
 * Closes (via onClose) on scroll/resize rather than re-tracking position,
 * since these are short-lived editors, not persistent overlays.
 */
export function useAnchoredPosition<T extends HTMLElement>(
  open: boolean,
  anchorRef: RefObject<T>,
  onClose: () => void,
  opts: { width: number; estHeight?: number }
): AnchoredCoords | null {
  const [coords, setCoords] = useState<AnchoredCoords | null>(null);
  const { width, estHeight = 200 } = opts;

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const openUp = rect.bottom + 8 + estHeight > window.innerHeight;
    setCoords({
      top: openUp ? rect.top : rect.bottom,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      openUp,
    });

    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return coords;
}
