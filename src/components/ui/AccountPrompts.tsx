"use client";

import { CloudUpload, UserRound } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/store";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useHistory } from "@/lib/store/history";
import { useSettings } from "@/lib/store/settings";

/** Header button: the account initial when signed in, a person icon otherwise. Hidden when accounts are off. */
export function AccountButton() {
  const t = useT();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  if (status === "disabled") return null;
  const initial = (user?.name || user?.email || "").trim().charAt(0).toUpperCase();
  return (
    <Link href="/account" className="btn btn-ghost btn-sm btn-circle" aria-label={t.account}>
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
