import { create } from "zustand";
import { persist } from "zustand/middleware";
import { currentUserId } from "@/lib/auth/store";
import type { GameConfig, Player, Visit } from "@/lib/darts/game";

export interface MatchRecord {
  id: string;
  playedAt: number;
  mode: "local" | "online";
  roomCode?: string;
  config: GameConfig;
  players: Player[];
  visits: Visit[];
  /** Account the match is synced to; undefined for guest matches (claimed at sign-in). */
  owner?: string;
}

interface Tombstone {
  id: string;
  owner: string;
}

interface HistoryState {
  matches: MatchRecord[];
  /** Ids saved or changed locally and not yet uploaded. */
  dirty: string[];
  /** Synced matches deleted locally, to delete in the cloud. */
  deleted: Tombstone[];
  lastSyncedAt: number | null;
  /** Insert or replace by id (online matches may be saved more than once). */
  save: (m: MatchRecord) => void;
  remove: (id: string) => void;
  clear: () => void;
  // Sync bookkeeping, used by lib/sync/cloud.ts
  claimGuestMatches: (owner: string) => void;
  markUploaded: (ids: string[]) => void;
  markDeleted: (ids: string[]) => void;
  applyRemote: (owner: string, remote: MatchRecord[]) => void;
  forgetOwner: (owner: string) => void;
}

const addId = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      matches: [],
      dirty: [],
      deleted: [],
      lastSyncedAt: null,

      save: (m) => {
        const owner = m.owner ?? currentUserId() ?? undefined;
        set((s) => ({
          matches: [{ ...m, owner }, ...s.matches.filter((x) => x.id !== m.id)],
          dirty: addId(s.dirty, m.id),
          deleted: s.deleted.filter((d) => d.id !== m.id),
        }));
      },
      remove: (id) =>
        set((s) => {
          const m = s.matches.find((x) => x.id === id);
          return {
            matches: s.matches.filter((x) => x.id !== id),
            dirty: s.dirty.filter((d) => d !== id),
            deleted: m?.owner ? [...s.deleted, { id, owner: m.owner }] : s.deleted,
          };
        }),
      clear: () => {
        const owner = currentUserId();
        set((s) => ({
          // Only the visible matches (guest + current account) are cleared.
          matches: s.matches.filter((m) => m.owner && m.owner !== owner),
          dirty: [],
          deleted: [
            ...s.deleted,
            ...s.matches.filter((m) => m.owner && m.owner === owner).map((m) => ({ id: m.id, owner: m.owner! })),
          ],
        }));
      },

      claimGuestMatches: (owner) =>
        set((s) => {
          const guests = s.matches.filter((m) => !m.owner).map((m) => m.id);
          if (guests.length === 0) return s;
          return {
            matches: s.matches.map((m) => (m.owner ? m : { ...m, owner })),
            dirty: guests.reduce(addId, s.dirty),
          };
        }),
      markUploaded: (ids) => set((s) => ({ dirty: s.dirty.filter((d) => !ids.includes(d)) })),
      markDeleted: (ids) => set((s) => ({ deleted: s.deleted.filter((d) => !ids.includes(d.id)) })),
      applyRemote: (owner, remote) =>
        set((s) => {
          const remoteIds = new Set(remote.map((m) => m.id));
          const tombstones = new Set(s.deleted.map((d) => d.id));
          // Keep local changes not yet uploaded; drop synced matches deleted on another device.
          const kept = s.matches.filter((m) => m.owner !== owner || s.dirty.includes(m.id) || remoteIds.has(m.id));
          const keptIds = new Set(kept.map((m) => m.id));
          const incoming = remote.filter((m) => !tombstones.has(m.id));
          const merged = kept.map((m) =>
            m.owner === owner && !s.dirty.includes(m.id) ? (incoming.find((r) => r.id === m.id) ?? m) : m,
          );
          for (const r of incoming) if (!keptIds.has(r.id)) merged.push(r);
          merged.sort((a, b) => b.playedAt - a.playedAt);
          return { matches: merged, lastSyncedAt: Date.now() };
        }),
      forgetOwner: (owner) =>
        set((s) => ({
          // After sign-out the device goes back to guest mode; unsynced changes are kept for next time.
          matches: s.matches.filter((m) => m.owner !== owner || s.dirty.includes(m.id)),
          lastSyncedAt: null,
        })),
    }),
    { name: "checkout-history", version: 1 },
  ),
);

/** Matches visible to whoever uses the device now: guest matches plus the signed-in account's. */
export function visibleMatches(matches: MatchRecord[], userId: string | null): MatchRecord[] {
  return matches.filter((m) => !m.owner || m.owner === userId);
}
