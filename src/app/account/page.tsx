"use client";

import type { Provider } from "@supabase/supabase-js";
import { Cloud, CloudOff, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { PageShell, Segmented } from "@/components/ui/PageShell";
import {
  AuthErrorCode,
  sendPasswordReset,
  signInWithPassword,
  signInWithProvider,
  signOut,
  signUp,
  updateDisplayName,
  updatePassword,
} from "@/lib/auth/actions";
import { useAuth } from "@/lib/auth/store";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { authProviders } from "@/lib/online/supabase";
import { useHistory, visibleMatches } from "@/lib/store/history";
import { useSettings } from "@/lib/store/settings";
import { requestSync } from "@/lib/sync/cloud";

const PROVIDER_LABELS: Partial<Record<Provider, string>> = { google: "Google", github: "GitHub" };

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export default function AccountPage() {
  const t = useT();
  const hydrated = useHydrated();
  const status = useAuth((s) => s.status);
  const recovering = useAuth((s) => s.recovering);
  const resetHash = useSyncExternalStore(subscribeHash, () => location.hash === "#reset", () => false);

  let content: React.ReactNode;
  if (!hydrated || status === "loading") content = <span className="loading loading-dots mx-auto" />;
  else if (status === "disabled") content = <p className="text-base-content/70">{t.authUnavailable}</p>;
  else if (status === "user" && (recovering || resetHash)) content = <NewPasswordForm />;
  else if (status === "user") content = <AccountPanel />;
  else content = <AuthForms />;

  return <PageShell title={t.account}>{content}</PageShell>;
}

function ErrorAlert({ code }: { code: AuthErrorCode | null }) {
  const t = useT();
  if (!code) return null;
  return (
    <div role="alert" className="alert alert-error alert-soft text-sm">
      {t.authErrors[code]}
    </div>
  );
}

function AuthForms() {
  const t = useT();
  const savedName = useSettings((s) => s.name);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (fn: () => Promise<AuthErrorCode | "confirm" | null>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const result = await fn();
    setBusy(false);
    if (result === "confirm") setInfo(t.confirmEmail(email.trim()));
    else if (result) setError(result);
    else if (mode === "reset") setInfo(t.resetSent);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") run(() => signInWithPassword(email, password));
    else if (mode === "signup") run(() => signUp(email, password, name));
    else run(() => sendPasswordReset(email));
  };

  return (
    <>
      <p className="text-sm text-base-content/70">{t.accountBenefits}</p>

      {mode !== "reset" && (
        <Segmented
          label={t.account}
          value={mode}
          options={[
            { value: "signin", label: t.signIn },
            { value: "signup", label: t.signUp },
          ]}
          onChange={(m) => {
            setMode(m);
            setError(null);
            setInfo(null);
          }}
        />
      )}

      <form className="space-y-3" onSubmit={submit}>
        {mode === "signup" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-base-content/70">{t.displayName}</span>
            <input
              className="input w-full"
              value={name}
              maxLength={24}
              autoComplete="nickname"
              placeholder={t.displayNamePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-base-content/70">{t.email}</span>
          <input
            className="input w-full"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== "reset" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-base-content/70">{t.password}</span>
            <input
              className="input w-full"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? t.passwordMin : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}

        <ErrorAlert code={error} />
        {info && (
          <div role="status" className="alert alert-success alert-soft text-sm">
            {info}
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? (
            <span className="loading loading-spinner" />
          ) : mode === "signin" ? (
            t.signIn
          ) : mode === "signup" ? (
            t.signUp
          ) : (
            t.sendResetLink
          )}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm w-full"
          onClick={() => {
            setMode(mode === "reset" ? "signin" : "reset");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "reset" ? t.back : t.forgotPassword}
        </button>
      </form>

      {authProviders.length > 0 && mode !== "reset" && (
        <div className="space-y-2">
          <div className="divider text-xs text-base-content/50">{t.orContinueWith}</div>
          {authProviders.map((p) => (
            <button
              key={p}
              type="button"
              className="btn btn-soft w-full"
              disabled={busy}
              onClick={() => run(() => signInWithProvider(p))}
            >
              {t.continueWith(PROVIDER_LABELS[p] ?? p)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function AccountPanel() {
  const t = useT();
  const user = useAuth((s) => s.user)!;
  const syncing = useAuth((s) => s.syncing);
  const syncError = useAuth((s) => s.syncError);
  const lastSyncedAt = useHistory((s) => s.lastSyncedAt);
  const count = useHistory((s) => visibleMatches(s.matches, user.id).length);
  const settingsName = useSettings((s) => s.name);
  const [name, setName] = useState(user.name ?? settingsName);
  const [savedName, setSavedName] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <div className="rounded-box bg-base-100 p-4 space-y-1">
        <p className="text-sm text-base-content/60">{t.signedInAs(user.email ?? "")}</p>
        <div className="flex items-center gap-2 text-sm">
          {syncError ? <CloudOff className="size-4 text-warning" /> : <Cloud className="size-4 text-success" />}
          <span>
            {syncing
              ? t.syncing
              : syncError
                ? t.syncFailed
                : lastSyncedAt
                  ? t.syncedAt(new Date(lastSyncedAt).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" }))
                  : t.syncing}
          </span>
        </div>
        <p className="text-sm text-base-content/60">{t.cloudMatches(count)}</p>
      </div>

      <form
        className="space-y-1"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(await updateDisplayName(name))) setSavedName(true);
        }}
      >
        <span className="block text-sm font-medium text-base-content/70">{t.displayName}</span>
        <div className="join w-full">
          <input
            className="input join-item flex-1"
            value={name}
            maxLength={24}
            placeholder={t.displayNamePlaceholder}
            onChange={(e) => {
              setName(e.target.value);
              setSavedName(false);
            }}
          />
          <button type="submit" className="btn btn-primary join-item">
            {savedName ? t.saved : t.save}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-soft" disabled={syncing} onClick={() => void requestSync()}>
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> {t.syncNow}
        </button>
        <Link href="/stats" className="btn btn-soft">
          {t.stats}
        </Link>
      </div>

      <button
        type="button"
        className="btn btn-ghost text-error mt-auto"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
        }}
      >
        <LogOut className="size-4" /> {t.signOut}
      </button>
    </>
  );
}

function NewPasswordForm() {
  const t = useT();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <>
        <div role="status" className="alert alert-success alert-soft">
          {t.passwordUpdated}
        </div>
        <Link href="/" className="btn btn-primary">
          {t.backHome}
        </Link>
      </>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const err = await updatePassword(password);
        setBusy(false);
        if (err) setError(err);
        else {
          window.history.replaceState(null, "", "/account");
          setDone(true);
        }
      }}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-base-content/70">{t.newPassword}</span>
        <input
          className="input w-full"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder={t.passwordMin}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <ErrorAlert code={error} />
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? <span className="loading loading-spinner" /> : t.setNewPassword}
      </button>
    </form>
  );
}
