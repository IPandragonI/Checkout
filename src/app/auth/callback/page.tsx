"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { useAuth } from "@/lib/auth/store";
import { useT } from "@/lib/i18n";

const noop = () => () => {};

/**
 * Landing page for email confirmations, OAuth and password-reset links.
 * The Supabase client exchanges the ?code= itself (PKCE, detectSessionInUrl);
 * this page only waits for the outcome and moves on.
 */
export default function AuthCallbackPage() {
  const t = useT();
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const params = useSyncExternalStore(noop, () => location.search, () => "");
  const query = new URLSearchParams(params);
  const providerError = query.get("error_description") ?? query.get("error");
  const next = query.get("next");

  useEffect(() => {
    if (status !== "user") return;
    if (next === "reset") {
      useAuth.getState().set({ recovering: true });
      router.replace("/account#reset");
    } else {
      router.replace("/account");
    }
  }, [status, next, router]);

  // Once the client has initialised, still being a guest means the code exchange failed.
  const failed = providerError || status === "guest" || status === "disabled";

  return (
    <PageShell title={t.account} back={null}>
      {failed ? (
        <>
          <div role="alert" className="alert alert-error alert-soft text-sm">
            {t.callbackFailed}
          </div>
          <Link href="/account" className="btn btn-primary">
            {t.signIn}
          </Link>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-base-content/70">
          <span className="loading loading-spinner loading-lg" />
          <p>{t.signingIn}</p>
        </div>
      )}
    </PageShell>
  );
}
