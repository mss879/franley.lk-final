"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * The behaviour `role="dialog" aria-modal="true"` promises: focus moves into
 * the overlay, Tab stays inside it, Escape closes it, and focus returns to
 * whatever opened it.
 *
 * Without this a keyboard user tabs straight out of an open overlay into the
 * page behind the backdrop — controls they cannot see — and on close is
 * dropped at the top of the document rather than back at the trigger.
 *
 * Visibility is tested with getClientRects() rather than offsetParent, which is
 * null for position:fixed elements and would drop real controls from the cycle.
 */
export function useFocusTrap({
  active,
  containerRef,
  onClose,
  initialFocusRef,
}: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    const restoreTo = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.getClientRects().length > 0,
      );

    (initialFocusRef?.current ?? focusable()[0])?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !container) return;

      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const outside = !container.contains(current);

      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Only take focus back if it is still inside the overlay we are closing.
      if (!container || container.contains(document.activeElement)) restoreTo?.focus?.();
    };
  }, [active, containerRef, onClose, initialFocusRef]);
}
