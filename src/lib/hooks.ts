"use client";

import { useEffect, useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during SSR and hydration, true afterwards. Gate anything that reads
 * persisted (localStorage) state on this to avoid hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Keeps the screen awake while a game is on (re-acquired when the tab returns). */
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) l.release();
        else lock = l;
      } catch {
        // Denied (battery saver, not visible): non-critical.
      }
    };
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release();
    };
  }, [active]);
}
