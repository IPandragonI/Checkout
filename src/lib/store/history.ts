import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameConfig, Player, Visit } from "@/lib/darts/game";

export interface MatchRecord {
  id: string;
  playedAt: number;
  mode: "local" | "online";
  roomCode?: string;
  config: GameConfig;
  players: Player[];
  visits: Visit[];
}

interface HistoryState {
  matches: MatchRecord[];
  /** Insert or replace by id (online matches may be saved more than once). */
  save: (m: MatchRecord) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      matches: [],
      save: (m) => set((s) => ({ matches: [m, ...s.matches.filter((x) => x.id !== m.id)] })),
      remove: (id) => set((s) => ({ matches: s.matches.filter((x) => x.id !== id) })),
      clear: () => set({ matches: [] }),
    }),
    { name: "checkout-history", version: 1 },
  ),
);
