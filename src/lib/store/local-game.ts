import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GameConfig, Player, replay, Visit, VisitInput } from "@/lib/darts/game";
import { uid } from "@/lib/id";
import { useHistory } from "./history";

export interface LocalMatch {
  id: string;
  startedAt: number;
  config: GameConfig;
  players: Player[];
  visits: Visit[];
}

interface LocalGameState {
  match: LocalMatch | null;
  start: (config: GameConfig, names: string[]) => void;
  submit: (playerId: string, input: VisitInput) => void;
  /** Removes and returns the last visit. */
  undo: () => Visit | null;
  rematch: () => void;
  quit: () => void;
}

function syncHistory(match: LocalMatch) {
  const done = replay(match.config, match.players, match.visits).winnerId !== null;
  const history = useHistory.getState();
  if (done) {
    history.save({ ...match, playedAt: Date.now(), mode: "local" });
  } else {
    history.remove(match.id);
  }
}

export const useLocalGame = create<LocalGameState>()(
  persist(
    (set, get) => ({
      match: null,
      start: (config, names) =>
        set({
          match: {
            id: uid(),
            startedAt: Date.now(),
            config,
            players: names.map((name) => ({ id: uid(), name })),
            visits: [],
          },
        }),
      submit: (playerId, input) => {
        const m = get().match;
        if (!m) return;
        const match = { ...m, visits: [...m.visits, { ...input, id: uid(), playerId }] };
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
        set({ match: { id: uid(), startedAt: Date.now(), config: m.config, players, visits: [] } });
      },
      quit: () => set({ match: null }),
    }),
    { name: "checkout-game", version: 1 },
  ),
);
