import { replay } from "@/lib/darts/game";
import { MatchLike, statsForPlayer } from "@/lib/darts/stats";
import { useT } from "@/lib/i18n";

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h${String(m).padStart(2, "0")}`;
  return m ? `${m}:${String(s).padStart(2, "0")} min` : `${s}s`;
}

/** Per-player breakdown of one finished match: one column per player, one row per metric. */
export function MatchStats({ match, durationMs }: { match: MatchLike; durationMs?: number }) {
  const t = useT();
  const state = replay(match.config, match.players, match.visits);
  const cols = match.players.map((p) => ({ p, s: statsForPlayer(match, p.id) }));
  const dash = (v: number | null | undefined) => (v ? String(v) : "–");

  const rows: [string, (c: (typeof cols)[number]) => string][] = [
    [t.avg3, ({ s }) => s.average.toFixed(1)],
    [t.first9Avg, ({ s }) => s.first9.toFixed(1)],
    [t.legsWonShort, ({ p }) => String(state.legsWon[p.id] ?? 0)],
    [t.dartsCount, ({ s }) => String(s.darts)],
    [t.checkoutPct, ({ s }) => (s.checkoutAttempts ? `${s.checkoutPct.toFixed(0)}% (${s.checkouts}/${s.checkoutAttempts})` : "–")],
    [t.highestOut, ({ s }) => dash(s.highestCheckout)],
    [t.bestLeg, ({ s }) => dash(s.bestLeg)],
    [t.topVisit, ({ s }) => dash(s.highestScore)],
    ["60+", ({ s }) => String(s.tons.s60)],
    ["100+", ({ s }) => String(s.tons.s100)],
    ["140+", ({ s }) => String(s.tons.s140)],
    ["180", ({ s }) => String(s.tons.s180)],
  ];

  return (
    <div className="space-y-2">
      {durationMs !== undefined && durationMs > 0 && (
        <div className="text-xs text-base-content/60">
          {t.duration}: <span className="font-semibold text-base-content">{formatDuration(durationMs)}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table table-sm tabular">
          <thead>
            <tr>
              <th />
              {cols.map(({ p }) => (
                <th key={p.id} className={`text-right max-w-24 truncate ${p.id === state.winnerId ? "text-highlight" : ""}`}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, cell]) => (
              <tr key={label}>
                <td className="text-base-content/60 whitespace-nowrap">{label}</td>
                {cols.map((c) => (
                  <td key={c.p.id} className="text-right whitespace-nowrap">
                    {cell(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
