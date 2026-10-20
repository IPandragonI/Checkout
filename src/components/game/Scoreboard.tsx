import type { Player } from "@/lib/darts/game";
import { useT } from "@/lib/i18n";

export interface PlayerLine {
  player: Player;
  remaining: number;
  /** Remaining while the current visit is being entered; null if no live preview. */
  live: number | null;
  bust: boolean;
  legsWon: number;
  average: number;
  lastScore: number | null;
  dartsInLeg: number;
  isCurrent: boolean;
  isMine: boolean;
}

export function Scoreboard({ lines, legsToWin }: { lines: PlayerLine[]; legsToWin: number }) {
  const many = lines.length > 4;
  return (
    <div
      className={
        many
          ? "flex gap-2 overflow-x-auto px-3 pb-1 snap-x"
          : `grid gap-2 px-3 ${lines.length === 1 ? "grid-cols-1" : "grid-cols-2"}`
      }
    >
      {lines.map((l) => (
        <PlayerCard key={l.player.id} line={l} legsToWin={legsToWin} compact={lines.length > 2} wide={many} />
      ))}
    </div>
  );
}

function PlayerCard({
  line: l,
  legsToWin,
  compact,
  wide,
}: {
  line: PlayerLine;
  legsToWin: number;
  compact: boolean;
  wide: boolean;
}) {
  const t = useT();
  const shown = l.live ?? l.remaining;
  return (
    <div
      className={`relative rounded-box px-3 py-2 transition-colors snap-start ${wide ? "min-w-[42%]" : ""} ${
        l.isCurrent ? "bg-base-100 ring-2 ring-primary" : "bg-base-100/50 opacity-70"
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        {l.isCurrent && <span className="size-2 shrink-0 rounded-full bg-primary animate-pulse" />}
        <span className="truncate">{l.player.name}</span>
        {l.isMine && <span className="badge badge-xs badge-ghost">{t.you}</span>}
        {legsToWin > 1 && (
          <span className="ml-auto flex gap-0.5" aria-label={t.legsWonAria(l.legsWon)}>
            {Array.from({ length: legsToWin }, (_, i) => (
              <span key={i} className={`size-2 rounded-full ${i < l.legsWon ? "bg-accent" : "bg-base-300"}`} />
            ))}
          </span>
        )}
      </div>
      <div
        className={`font-mono font-bold tabular leading-none ${compact ? "text-4xl" : "text-6xl"} ${
          l.bust ? "text-error line-through" : l.live !== null && l.live !== l.remaining ? "text-accent" : ""
        }`}
      >
        {shown}
      </div>
      <div className="mt-1 flex gap-2 text-xs text-base-content/60 tabular">
        <span>Ø {l.average.toFixed(1)}</span>
        {l.lastScore !== null && <span>{t.last(l.lastScore)}</span>}
        {!compact && <span className="ml-auto">{t.dartsN(l.dartsInLeg)}</span>}
      </div>
    </div>
  );
}
