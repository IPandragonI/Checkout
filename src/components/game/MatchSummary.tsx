import { Trophy, Undo2 } from "lucide-react";
import type { GameConfig, Player, Visit } from "@/lib/darts/game";
import { statsForPlayer } from "@/lib/darts/stats";
import { useT } from "@/lib/i18n";
import { SaveStatsLink } from "@/components/ui/AccountPrompts";

interface Props {
  config: GameConfig;
  players: Player[];
  visits: Visit[];
  winnerId: string;
  onUndo: () => void;
  actions: React.ReactNode;
}

export function MatchSummary({ config, players, visits, winnerId, onUndo, actions }: Props) {
  const t = useT();
  const winner = players.find((p) => p.id === winnerId);
  const rows = players.map((p) => ({ p, s: statsForPlayer({ config, players, visits }, p.id) }));

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-base-300/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-box sm:rounded-box bg-base-100 p-5 pb-safe space-y-4 shadow-2xl">
        <div className="text-center">
          <Trophy className="mx-auto size-12 text-accent" />
          <h2 className="mt-1 text-3xl font-black">{t.wins(winner?.name ?? "")}</h2>
          <p className="text-sm text-base-content/60">
            {config.startScore} · {config.doubleOut ? t.doubleOutLower : t.singleOutLower}
            {config.legsToWin > 1 && ` · ${t.firstToLower(config.legsToWin)}`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-sm tabular">
            <thead>
              <tr>
                <th />
                <th className="text-right">Ø</th>
                <th className="text-right">{t.first9}</th>
                <th className="text-right">{t.coPct}</th>
                <th className="text-right">{t.hiCo}</th>
                <th className="text-right">100+</th>
                <th className="text-right">180</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, s }) => (
                <tr key={p.id} className={p.id === winnerId ? "text-accent" : ""}>
                  <td className="font-semibold max-w-24 truncate">{p.name}</td>
                  <td className="text-right">{s.average.toFixed(1)}</td>
                  <td className="text-right">{s.first9.toFixed(1)}</td>
                  <td className="text-right">{s.checkoutAttempts ? `${s.checkoutPct.toFixed(0)}%` : "–"}</td>
                  <td className="text-right">{s.highestCheckout || "–"}</td>
                  <td className="text-right">{s.tons.s100 + s.tons.s140 + s.tons.s180}</td>
                  <td className="text-right">{s.tons.s180}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2">{actions}</div>
        <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onUndo}>
          <Undo2 className="size-4" /> {t.undoLastVisit}
        </button>
        <SaveStatsLink />
      </div>
    </div>
  );
}
