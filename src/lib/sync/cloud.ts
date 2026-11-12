import { useAuth } from "@/lib/auth/store";
import { supabase } from "@/lib/supabase";
import { MatchRecord, useHistory } from "@/lib/store/history";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come untyped from PostgREST */
const toRow = (m: MatchRecord, userId: string) => ({
  user_id: userId,
  id: m.id,
  played_at: new Date(m.playedAt).toISOString(),
  started_at: m.startedAt ? new Date(m.startedAt).toISOString() : null,
  active_ms: m.activeMs ?? null,
  session_id: m.sessionId ?? null,
  config: m.config,
  players: m.players,
  visits: m.visits,
});

const fromRow = (r: any): MatchRecord => ({
  id: r.id,
  owner: r.user_id,
  playedAt: Date.parse(r.played_at),
  startedAt: r.started_at ? Date.parse(r.started_at) : undefined,
  activeMs: r.active_ms ?? undefined,
  sessionId: r.session_id ?? undefined,
  config: r.config,
  players: r.players,
  visits: r.visits,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const PULL_LIMIT = 1000;

async function syncOnce(userId: string) {
  const history = useHistory.getState();
  history.claimGuestMatches(userId);

  const { matches, dirty, deleted } = useHistory.getState();
  const uploads = matches.filter((m) => m.owner === userId && dirty.includes(m.id));
  if (uploads.length) {
    const { error } = await supabase()
      .from("matches")
      .upsert(uploads.map((m) => toRow(m, userId)), { onConflict: "user_id,id" });
    if (error) throw error;
    history.markUploaded(uploads.map((m) => m.id));
  }

  const removals = deleted.filter((d) => d.owner === userId).map((d) => d.id);
  if (removals.length) {
    const { error } = await supabase().from("matches").delete().eq("user_id", userId).in("id", removals);
    if (error) throw error;
    history.markDeleted(removals);
  }

  const { data, error } = await supabase()
    .from("matches")
    .select("id, user_id, played_at, started_at, active_ms, session_id, config, players, visits")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(PULL_LIMIT);
  if (error) throw error;
  history.applyRemote(userId, data.map(fromRow));
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Two-way sync of match history for the signed-in user: claims guest matches,
 * pushes local changes, then pulls the account's history. Calls made while a
 * sync is running are coalesced into one more pass. No-op for guests.
 */
export function requestSync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const auth = useAuth.getState();
    do {
      again = false;
      const userId = useAuth.getState().user?.id;
      if (!userId) return;
      auth.set({ syncing: true });
      try {
        await syncOnce(userId);
        auth.set({ syncError: false });
      } catch {
        // Offline or transient failure: dirty items stay queued for the next attempt.
        auth.set({ syncError: true });
        return;
      } finally {
        auth.set({ syncing: false });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}
