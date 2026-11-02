import { Trophy, Undo2 } from "lucide-react";
import { useState } from "react";
import type { GameConfig, Player, Visit } from "@/lib/darts/game";
import { useT } from "@/lib/i18n";
import { SaveStatsLink } from "@/components/ui/AccountPrompts";
import { MatchStats } from "./MatchStats";

interface Props {
  config: GameConfig;
  players: Player[];
  visits: Visit[];
  winnerId: string;
  startedAt?: number;
  onUndo: () => void;
  actions: React.ReactNode;
}

export function MatchSummary({ config, players, visits, winnerId, startedAt, onUndo, actions }: Props) {
  const t = useT();
  const winner = players.find((p) => p.id === winnerId);
  // Frozen when the summary opens, so the duration doesn't keep growing.
  const [finishedAt] = useState(() => Date.now());

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-base-300/80 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-dvh overflow-y-auto rounded-t-box sm:rounded-box bg-base-100 p-5 pb-safe space-y-4 shadow-2xl">
        <div className="text-center">
          <Trophy className="mx-auto size-12 text-highlight" />
          <h2 className="mt-1 font-display text-4xl tracking-wide">{t.wins(winner?.name ?? "")}</h2>
          <p className="text-sm text-base-content/60">
            {config.startScore} · {config.doubleOut ? t.doubleOutLower : t.singleOutLower}
            {config.legsToWin > 1 && ` · ${t.firstToLower(config.legsToWin)}`}
          </p>
        </div>

        <MatchStats match={{ config, players, visits }} durationMs={startedAt ? finishedAt - startedAt : undefined} />

        <div className="grid gap-2">{actions}</div>
        <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onUndo}>
          <Undo2 className="size-4" /> {t.undoLastVisit}
        </button>
        <SaveStatsLink />
      </div>
    </div>
  );
}
