"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during the server pass and the hydrating pass, true afterwards.
 *
 * Dates in this section are rendered in the admin's own timezone, which the
 * server cannot know; gating on this keeps the two passes identical instead of
 * patching the DOM from an effect.
 */
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/* --------------------------------------------------------------- the clock */

// The current minute, as an external store. Read this rather than calling
// Date.now() while rendering: the value is stable within a render pass, shared
// between components, and a "starts in an hour" badge flips to "showing" on its
// own without a reload.
let currentMinute = 0;

function subscribeToClock(onChange: () => void) {
  currentMinute = Date.now();
  const id = setInterval(() => {
    currentMinute = Date.now();
    onChange();
  }, 30_000);
  return () => clearInterval(id);
}

function readClock() {
  if (currentMinute === 0) currentMinute = Date.now();
  return currentMinute;
}

/** Milliseconds since the epoch, or 0 before hydration. */
export function useNow() {
  return useSyncExternalStore(subscribeToClock, readClock, () => 0);
}
