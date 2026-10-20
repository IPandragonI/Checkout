import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
}

export type AuthStatus = "loading" | "guest" | "user" | "disabled";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Set when the user arrived through a password-reset link. */
  recovering: boolean;
  syncing: boolean;
  syncError: boolean;
  set: (patch: Partial<Omit<AuthState, "set">>) => void;
}

/** Session state, mirrored from Supabase Auth by <AuthProvider>. Not persisted: Supabase keeps the session. */
export const useAuth = create<AuthState>()((set) => ({
  status: "loading",
  user: null,
  recovering: false,
  syncing: false,
  syncError: false,
  set: (patch) => set(patch),
}));

export function currentUserId(): string | null {
  return useAuth.getState().user?.id ?? null;
}
