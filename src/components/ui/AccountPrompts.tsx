"use client";

import { Cloud, CloudOff, CloudUpload, LogOut, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/lib/auth/actions";
import { useAuth } from "@/lib/auth/store";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useHistory } from "@/lib/store/history";
import { useSettings } from "@/lib/store/settings";
import { requestSync } from "@/lib/sync/cloud";

/** Header button: the account initial when signed in, a person icon otherwise. Hidden when accounts are off. */
export function AccountButton({ className = "btn btn-ghost btn-sm btn-circle" }: { className?: string }) {
  const t = useT();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  if (status === "disabled") return null;
  const initial = (user?.name || user?.email || "").trim().charAt(0).toUpperCase();
  return (
    <Link href="/account" className={className} aria-label={t.account}>
      {status === "user" && initial ? (
        <span className="grid size-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-content">
          {initial}
        </span>
      ) : (
        <UserRound className="size-5" />
      )}
    </Link>
  );
}

/** Home-screen card nudging guests with finished matches to back them up. */
export function GuestPrompt() {
  const t = useT();
  const hydrated = useHydrated();
  const status = useAuth((s) => s.status);
  const hasMatches = useHistory((s) => s.matches.length > 0);
  const dismissed = useSettings((s) => s.authPromptDismissed);
  const set = useSettings((s) => s.set);
  if (!hydrated || status !== "guest" || !hasMatches || dismissed) return null;

  return (
    <div className="card border border-primary/30 bg-primary/10">
      <div className="card-body gap-2 p-4">
        <div className="flex items-center gap-2 font-bold">
          <CloudUpload className="size-5 text-primary" /> {t.guestPromptTitle}
        </div>
        <p className="text-sm text-base-content/70">{t.guestPromptBody}</p>
        <div className="mt-1 flex gap-2">
          <Link href="/account" className="btn btn-primary btn-sm flex-1">
            {t.signUp}
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ authPromptDismissed: true })}>
            {t.later}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One-line link for guests, e.g. under the end-of-match summary. */
export function SaveStatsLink() {
  const t = useT();
  const status = useAuth((s) => s.status);
  if (status !== "guest") return null;
  return (
    <Link href="/account" className="btn btn-link btn-sm w-full no-underline">
      <CloudUpload className="size-4" /> {t.saveStatsLink}
    </Link>
  );
}

/**
 * Who is using the device (guest vs. signed in), sync state, and the matching actions.
 * Shared by the account and settings pages. Hidden when accounts are off.
 */
export function AccountStatusCard() {
  const t = useT();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const syncing = useAuth((s) => s.syncing);
  const syncError = useAuth((s) => s.syncError);
  const lastSyncedAt = useHistory((s) => s.lastSyncedAt);
  const [busy, setBusy] = useState(false);
  if (status === "disabled" || status === "loading") return null;

  if (status === "guest" || !user) {
    return (
      <div className="panel flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-base-300">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold">{t.guestStatus}</div>
            <div className="text-xs text-base-content/60">{t.guestStatusHint}</div>
          </div>
        </div>
        <Link href="/account" className="btn btn-primary btn-sm">
          {t.signInOrUp}
        </Link>
      </div>
    );
  }

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  const syncText = syncing
    ? t.syncing
    : syncError
      ? t.syncFailed
      : lastSyncedAt
        ? t.syncedAt(new Date(lastSyncedAt).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" }))
        : t.syncing;

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-display text-xl text-primary-content">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="font-semibold">{t.signedInStatus}</div>
          <div className="truncate text-xs text-base-content/60">{user.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {syncError ? <CloudOff className="size-4 text-warning" /> : <Cloud className="size-4 text-success" />}
        <span>{syncText}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-soft btn-sm" disabled={syncing} onClick={() => void requestSync()}>
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> {t.syncNow}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm text-error"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut();
            setBusy(false);
          }}
        >
          <LogOut className="size-4" /> {t.signOut}
        </button>
      </div>
    </div>
  );
}
