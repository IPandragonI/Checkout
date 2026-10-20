import { useCallback, useEffect, useRef, useState } from "react";
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

/** After a manual swipe, the carousel drifts back to the player on the oche. */
const RECENTER_AFTER_MS = 2500;

export function Scoreboard({ lines, legsToWin }: { lines: PlayerLine[]; legsToWin: number }) {
  if (lines.length >= 3) return <Carousel lines={lines} legsToWin={legsToWin} />;
  return (
    <div className={`grid gap-2 px-3 ${lines.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {lines.map((l) => (
        <PlayerCard key={l.player.id} line={l} legsToWin={legsToWin} />
      ))}
    </div>
  );
}

/**
 * 3+ players: one full-size card per player in a swipeable, snapping track.
 * Cards keep the 2-player card height, so the keypad below never shrinks.
 */
function Carousel({ lines, legsToWin }: { lines: PlayerLine[]; legsToWin: number }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentIndex = Math.max(0, lines.findIndex((l) => l.isCurrent));
  const [centered, setCentered] = useState(currentIndex);

  const scrollToCard = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const el = track.current;
    const card = cards.current[index];
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior });
  }, []);

  // Centre the active player on every turn change (instantly on first render).
  const first = useRef(true);
  useEffect(() => {
    scrollToCard(currentIndex, first.current ? "instant" : "smooth");
    first.current = false;
  }, [currentIndex, scrollToCard]);

  useEffect(() => () => clearTimeout(idle.current), []);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let nearest = 0;
    cards.current.forEach((c, i) => {
      const best = cards.current[nearest];
      if (c && best && Math.abs(c.offsetLeft + c.clientWidth / 2 - mid) < Math.abs(best.offsetLeft + best.clientWidth / 2 - mid)) {
        nearest = i;
      }
    });
    setCentered(nearest);
    clearTimeout(idle.current);
    if (nearest !== currentIndex) idle.current = setTimeout(() => scrollToCard(currentIndex), RECENTER_AFTER_MS);
  };

  return (
    <div className="relative">
      <div
        ref={track}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-[14%] py-1"
      >
        {lines.map((l, i) => (
          <div
            key={l.player.id}
            ref={(el) => {
              cards.current[i] = el;
            }}
            className={`w-[72%] shrink-0 snap-center transition-transform duration-300 ${l.isCurrent ? "" : "scale-[0.94]"}`}
          >
            <PlayerCard line={l} legsToWin={legsToWin} />
          </div>
        ))}
      </div>
      {/* Position dots live in the gap under the cards, so they cost no height. */}
      <div className="absolute inset-x-0 -bottom-2 flex justify-center gap-1.5" role="tablist" aria-label={t.playersOrder}>
        {lines.map((l, i) => (
          <button
            key={l.player.id}
            type="button"
            role="tab"
            aria-selected={i === centered}
            aria-label={l.player.name}
            onClick={() => scrollToCard(i)}
            className={`h-1.5 rounded-full transition-all ${i === centered ? "w-5" : "w-1.5"} ${
              l.isCurrent ? "bg-primary" : "bg-base-content/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ line: l, legsToWin }: { line: PlayerLine; legsToWin: number }) {
  const t = useT();
  const shown = l.live ?? l.remaining;
  return (
    <div
      className={`relative rounded-box px-3 py-2 transition-colors ${
        // Inset ring: the carousel track clips anything drawn outside the card.
        l.isCurrent ? "bg-base-100 ring-2 ring-inset ring-primary" : "bg-base-100/50 opacity-70"
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
        className={`font-mono text-6xl font-bold tabular leading-none ${
          l.bust ? "text-error line-through" : l.live !== null && l.live !== l.remaining ? "text-highlight" : ""
        }`}
      >
        {shown}
      </div>
      <div className="mt-1 flex gap-2 overflow-hidden whitespace-nowrap text-xs text-base-content/60 tabular">
        <span>Ø {l.average.toFixed(1)}</span>
        {l.lastScore !== null && <span>{t.last(l.lastScore)}</span>}
        <span className="ml-auto">{t.dartsShort(l.dartsInLeg)}</span>
      </div>
    </div>
  );
}
