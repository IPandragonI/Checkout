import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GameConfig, Player, Visit, VisitInput } from "@/lib/darts/game";
import { addActiveTime } from "@/lib/darts/session";
import { uid } from "@/lib/id";
import { useHistory } from "./history";

export interface LocalMatch {
  id: string;
  startedAt: number;
  /** Matches of one sitting share a session; rematches keep it. */
  sessionId?: string;
  /** Playing time so far, idle gaps capped (ms). */
  activeMs?: number;
  lastActiveAt?: number;
  config: GameConfig;
  players: Player[];
  visits: Visit[];
}

interface LocalGameState {
  match: LocalMatch | null;
  /** Starts a match; pass `sessionId` to continue the session of the previous one. */
  start: (config: GameConfig, names: string[], sessionId?: string) => void;
  submit: (playerId: string, input: VisitInput) => void;
  /** Removes and returns the last visit. */
  undo: () => Visit | null;
  rematch: () => void;
  quit: () => void;
}

/** Every match with at least one visit is kept, finished or not; an empty one leaves no trace. */
function syncHistory(match: LocalMatch) {
  const history = useHistory.getState();
  if (match.visits.length === 0) {
    history.remove(match.id);
    return;
  }
  const { id, startedAt, sessionId, activeMs, config, players, visits } = match;
  history.save({ id, startedAt, sessionId, activeMs, config, players, visits, playedAt: Date.now() });
}

export const useLocalGame = create<LocalGameState>()(
  persist(
    (set, get) => ({
      match: null,
      start: (config, names, sessionId) =>
        set({
          match: {
            id: uid(),
            startedAt: Date.now(),
            lastActiveAt: Date.now(),
            activeMs: 0,
            sessionId: sessionId ?? uid(),
            config,
            players: names.map((name) => ({ id: uid(), name })),
            visits: [],
          },
        }),
      submit: (playerId, input) => {
        const m = get().match;
        if (!m) return;
        const now = Date.now();
        const match = {
          ...m,
          visits: [...m.visits, { ...input, id: uid(), playerId }],
          activeMs: addActiveTime(m.activeMs ?? 0, m.lastActiveAt ?? m.startedAt, now),
          lastActiveAt: now,
        };
        set({ match });
        syncHistory(match);
      },
      undo: () => {
        const m = get().match;
        if (!m || m.visits.length === 0) return null;
        const last = m.visits[m.visits.length - 1];
        const match = { ...m, visits: m.visits.slice(0, -1) };
        set({ match });
        syncHistory(match);
        return last;
      },
      rematch: () => {
        const m = get().match;
        if (!m) return;
        // Loser of the last match throws first: rotate the order by one.
        const players = [...m.players.slice(1), m.players[0]].map((p) => ({ ...p, id: uid() }));
        const now = Date.now();
        set({
          match: { id: uid(), startedAt: now, lastActiveAt: now, activeMs: 0, sessionId: m.sessionId ?? uid(), config: m.config, players, visits: [] },
        });
      },
      quit: () => set({ match: null }),
    }),
    { name: "checkout-game", version: 1 },
  ),
);
