"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

interface Props {
  names: string[];
  /** Index (in `names`) of the player the highlight lands on. */
  winnerIndex: number;
  onDone: () => void;
}

const SPINS = 3;
const REVEAL_MS = 1100;

/**
 * Full-screen "who throws first?" draw: a highlight runs over the player chips,
 * slows down like a roulette and lands on `winnerIndex`.
 */
export function FirstPlayerDraw({ names, winnerIndex, onDone }: Props) {
  const t = useT();
  const [active, setActive] = useState(0);
  const [landed, setLanded] = useState(false);
  // Latest callback without restarting the animation when the parent re-renders.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = (reduced ? 0 : SPINS) * names.length + winnerIndex;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      setActive(step % names.length);
      if (step >= total) {
        setLanded(true);
        timer = setTimeout(() => done.current(), REVEAL_MS);
        return;
      }
      // Ease-out: quick at first, slowing to ~420ms per step on the last ones.
      const delay = 60 + Math.pow(step / Math.max(1, total), 3) * 360;
      step++;
      timer = setTimeout(tick, delay);
    };
    tick();
    return () => clearTimeout(timer);
  }, [names.length, winnerIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-base-300/95 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label={t.whoStarts}
    >
      <h2 className="text-center font-display text-4xl tracking-wide">{landed ? t.startsFirst(names[winnerIndex]) : t.whoStarts}</h2>
      <ul className="flex w-full max-w-sm flex-col gap-2">
        {names.map((name, i) => {
          const on = i === active;
          return (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-box border-2 px-4 py-3 transition-all duration-100 ${
                on
                  ? `border-primary bg-primary text-primary-content ${landed ? "scale-105 shadow-xl" : "scale-[1.02]"}`
                  : `border-transparent bg-base-100 ${landed ? "opacity-40" : "opacity-80"}`
              }`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black/15 font-bold">
                {name.trim().charAt(0).toUpperCase() || i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-lg font-semibold">{name}</span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
        {t.skip}
      </button>
    </div>
  );
}
