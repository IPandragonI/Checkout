"use client";

import { Smartphone } from "lucide-react";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";

type LockableOrientation = ScreenOrientation & { lock?: (o: "portrait") => Promise<void> };

/**
 * Keeps the app in portrait. Where the browser allows it (installed PWAs on Android)
 * the orientation is locked; everywhere else phones held sideways get an overlay
 * (see .orientation-guard in globals.css) instead of a broken layout.
 */
export function OrientationGuard() {
  const t = useT();

  useEffect(() => {
    const orientation = screen.orientation as LockableOrientation | undefined;
    // Rejects outside fullscreen/standalone (and on iOS): the overlay covers those cases.
    orientation?.lock?.("portrait").catch(() => {});
  }, []);

  return (
    <div className="orientation-guard fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-3 bg-base-200 p-6 text-center" role="alert">
      <Smartphone className="size-14 animate-bounce text-primary" />
      <p className="font-display text-2xl tracking-wide">{t.rotateTitle}</p>
      <p className="text-sm text-base-content/70">{t.rotateBody}</p>
    </div>
  );
}
