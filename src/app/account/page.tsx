"use client";

import type { Provider } from "@supabase/supabase-js";
import { KeyRound, Mail, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AccountStatusCard } from "@/components/ui/AccountPrompts";
import { GitHubIcon, GoogleIcon } from "@/components/ui/BrandIcons";
import { PageShell, Segmented } from "@/components/ui/PageShell";
import {
  AuthErrorCode,
  sendPasswordReset,
  signInWithPassword,
  signInWithProvider,
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

  const oauth = authProviders.length > 0 && mode !== "reset";

  return (
    <div className="panel relative mt-10 space-y-4 px-4 pt-12 pb-5">
      <Image
        src="/brand/logo-256.png"
        alt=""
        width={80}
        height={80}
        className="absolute -top-10 left-1/2 size-20 -translate-x-1/2 rotate-[-6deg] drop-shadow-lg"
      />
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-wide">{t.authTitle}</h2>
        <p className="mt-1 text-sm text-base-content/65">{t.authSubtitle}</p>
      </div>

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

      {oauth && (
        <div className="space-y-2">
          {authProviders.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn h-12 w-full gap-3 text-base ${p === "google" ? "btn-google" : "btn-github"}`}
              disabled={busy}
              onClick={() => run(() => signInWithProvider(p))}
            >
              {p === "google" ? <GoogleIcon /> : <GitHubIcon />}
              {t.continueWith(PROVIDER_LABELS[p] ?? p)}
            </button>
          ))}
          <div className="divider my-1 text-xs text-base-content/50">{t.orUseEmail}</div>
        </div>
      )}

      <form className="space-y-3" onSubmit={submit}>
        {mode === "signup" && (
          <label className="input w-full">
            <UserRound className="size-4 opacity-60" />
            <input
              value={name}
              maxLength={24}
              autoComplete="nickname"
              aria-label={t.displayName}
              placeholder={t.displayName}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label className="input w-full">
          <Mail className="size-4 opacity-60" />
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            aria-label={t.email}
            placeholder={t.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== "reset" && (
          <label className="input w-full">
            <KeyRound className="size-4 opacity-60" />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              aria-label={t.password}
              placeholder={mode === "signup" ? `${t.password} · ${t.passwordMin.toLowerCase()}` : t.password}
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

        <button type="submit" className="btn btn-primary h-12 w-full font-display text-lg tracking-wide" disabled={busy}>
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
    </div>
  );
}

function AccountPanel() {
  const t = useT();
  const user = useAuth((s) => s.user)!;
  const count = useHistory((s) => visibleMatches(s.matches, user.id).length);
  const settingsName = useSettings((s) => s.name);
  const [name, setName] = useState(user.name ?? settingsName);
  const [savedName, setSavedName] = useState(false);

  return (
    <>
      <AccountStatusCard />

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

      <Link href="/stats" className="btn btn-soft">
        {t.stats} · {t.cloudMatches(count)}
      </Link>
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
