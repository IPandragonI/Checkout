import type { AuthError, Provider } from "@supabase/supabase-js";
import { supabase } from "@/lib/online/supabase";
import { useHistory } from "@/lib/store/history";
import { useSettings } from "@/lib/store/settings";
import { requestSync } from "@/lib/sync/cloud";
import { useAuth } from "./store";

/** Error codes the UI knows how to translate; anything else is "generic". */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_already_exists"
  | "weak_password"
  | "rate_limited"
  | "generic";

function code(error: AuthError): AuthErrorCode {
  switch (error.code) {
    case "invalid_credentials":
    case "email_not_confirmed":
    case "user_already_exists":
    case "weak_password":
      return error.code as AuthErrorCode;
    case "email_exists":
      return "user_already_exists";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate_limited";
    default:
      return "generic";
  }
}

const callbackUrl = (next?: string) => `${location.origin}/auth/callback${next ? `?next=${next}` : ""}`;

export async function signInWithPassword(email: string, password: string): Promise<AuthErrorCode | null> {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  return error ? code(error) : null;
}

/** Returns "confirm" when the project requires email confirmation before the first sign-in. */
export async function signUp(email: string, password: string, name: string): Promise<AuthErrorCode | "confirm" | null> {
  const { data, error } = await supabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: callbackUrl(), data: { display_name: name.trim() || null } },
  });
  if (error) return code(error);
  return data.session ? null : "confirm";
}

export async function signInWithProvider(provider: Provider): Promise<AuthErrorCode | null> {
  const { error } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl() } });
  return error ? code(error) : null;
}

export async function sendPasswordReset(email: string): Promise<AuthErrorCode | null> {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: callbackUrl("reset") });
  return error ? code(error) : null;
}

export async function updatePassword(password: string): Promise<AuthErrorCode | null> {
  const { error } = await supabase().auth.updateUser({ password });
  if (!error) useAuth.getState().set({ recovering: false });
  return error ? code(error) : null;
}

export async function updateDisplayName(name: string): Promise<AuthErrorCode | null> {
  useSettings.getState().set({ name });
  const { error } = await supabase().auth.updateUser({ data: { display_name: name.trim() || null } });
  return error ? code(error) : null;
}

/** Flushes pending changes, signs out and returns the device to guest mode. */
export async function signOut(): Promise<void> {
  const userId = useAuth.getState().user?.id;
  await requestSync().catch(() => {});
  await supabase().auth.signOut();
  if (userId) useHistory.getState().forgetOwner(userId);
}
