"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/store";
import { onlineEnabled, supabase } from "@/lib/online/supabase";
import { useHistory } from "@/lib/store/history";
import { useSettings } from "@/lib/store/settings";
import { requestSync } from "@/lib/sync/cloud";

const SYNC_DEBOUNCE_MS = 1500;

/** Mirrors the Supabase session into useAuth and keeps match history synced while signed in. */
export function AuthProvider() {
  useEffect(() => {
    const auth = useAuth.getState();
    if (!onlineEnabled) {
      auth.set({ status: "disabled" });
      return;
    }

    const { data } = supabase().auth.onAuthStateChange((event, session) => {
      const u = session?.user;
      const name = (u?.user_metadata?.display_name as string | undefined) ?? null;
      auth.set({
        status: u ? "user" : "guest",
        user: u ? { id: u.id, email: u.email ?? null, name } : null,
        ...(event === "PASSWORD_RECOVERY" ? { recovering: true } : {}),
        ...(event === "SIGNED_OUT" ? { recovering: false, syncError: false } : {}),
      });
      if (u && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) {
        const settings = useSettings.getState();
        if (!settings.name.trim() && name) settings.set({ name });
        // Supabase advises against awaiting its own calls inside this callback.
        setTimeout(() => void requestSync(), 0);
      }
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribeHistory = useHistory.subscribe((s, prev) => {
      if (s.dirty === prev.dirty && s.deleted === prev.deleted) return;
      if (s.dirty.length === 0 && s.deleted.length === 0) return;
      clearTimeout(timer);
      timer = setTimeout(() => void requestSync(), SYNC_DEBOUNCE_MS);
    });
    const resync = () => document.visibilityState === "visible" && void requestSync();
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resync);

    return () => {
      data.subscription.unsubscribe();
      unsubscribeHistory();
      clearTimeout(timer);
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, []);

  return null;
}
