"use client";

import { ArrowUp, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FirstPlayerDraw } from "@/components/game/FirstPlayerDraw";
import { ConfigFields } from "@/components/ui/ConfigFields";
import { PageShell } from "@/components/ui/PageShell";
import { pickFirstIndex, rotateToFirst } from "@/lib/darts/draw";
import type { GameConfig } from "@/lib/darts/game";
import { normName } from "@/lib/darts/session";
import { useHydrated } from "@/lib/hooks";
import { getT, useT } from "@/lib/i18n";
import { useHistory } from "@/lib/store/history";
import { useLocalGame } from "@/lib/store/local-game";
import { useSettings } from "@/lib/store/settings";

/** A previous match counts as the same sitting if it was played within this window. */
const SESSION_WINDOW_MS = 6 * 3_600_000;

export default function NewGamePage() {
  const hydrated = useHydrated();
  const t = useT();
  return <PageShell title={t.newGame}>{hydrated ? <SetupForm /> : <span className="loading loading-dots mx-auto" />}</PageShell>;
}

function SetupForm() {
  const router = useRouter();
  const t = useT();
  const settings = useSettings();
  const start = useLocalGame((s) => s.start);
  const lastMatch = useLocalGame((s) => s.match);
  const [config, setConfig] = useState<GameConfig>(settings.lastConfig);
  const [names, setNames] = useState<string[]>(() =>
    settings.lastPlayers.length ? settings.lastPlayers : [settings.name || getT().playerN(1)],
  );

  const update = (i: number, v: string) => setNames(names.map((n, j) => (j === i ? v : n)));
  const move = (i: number) => {
    const next = [...names];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setNames(next);
  };

  /** Players in throwing order plus who the draw picked; set while the draw animation plays. */
  const [draw, setDraw] = useState<{ order: string[]; winnerIndex: number } | null>(null);

  // Same players as the previous match, shortly after: offer to keep playing in the same session.
  const [openedAt] = useState(() => Date.now());
  const sameSession =
    !!lastMatch?.sessionId &&
    openedAt - (lastMatch.lastActiveAt ?? lastMatch.startedAt) < SESSION_WINDOW_MS &&
    [...lastMatch.players.map((p) => normName(p.name))].sort().join("|") === names.map(normName).sort().join("|");
  const sessionMatches = useHistory((s) => s.matches.filter((m) => m.sessionId === lastMatch?.sessionId).length);
  const [keepSession, setKeepSession] = useState(true);

  const begin = (order: string[]) => {
    start(config, order, sameSession && keepSession ? lastMatch?.sessionId : undefined);
    router.push("/play/game");
  };

  const onStart = () => {
    const cleaned = names.map((n, i) => n.trim() || t.playerN(i + 1));
    settings.set({ lastConfig: config, lastPlayers: cleaned });
    if (cleaned.length < 2) return begin(cleaned);
    setDraw({ order: cleaned, winnerIndex: pickFirstIndex(cleaned.length) });
  };

  // The drawn player throws first: rotate the order so they lead, keeping everyone else in sequence.
  const finishDraw = () => {
    if (!draw) return;
    const { order, winnerIndex } = draw;
    setDraw(null);
    begin(rotateToFirst(order, winnerIndex));
  };

  return (
    <>
      <ConfigFields value={config} onChange={setConfig} />

      <section className="space-y-2">
        <div className="text-sm font-medium text-base-content/70">{t.playersOrder}</div>
        {names.map((n, i) => (
          <div key={i} className="join w-full">
            <input
              className="input join-item flex-1"
              value={n}
              maxLength={24}
              placeholder={t.playerN(i + 1)}
              onChange={(e) => update(i, e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            {i > 0 && (
              <button type="button" className="btn btn-soft join-item" onClick={() => move(i)} aria-label={t.moveUp}>
                <ArrowUp className="size-4" />
              </button>
            )}
            {names.length > 1 && (
              <button
                type="button"
                className="btn btn-soft join-item"
                onClick={() => setNames(names.filter((_, j) => j !== i))}
                aria-label={t.removePlayer}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        {names.length < 8 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setNames([...names, t.playerN(names.length + 1)])}
          >
            <Plus className="size-4" /> {t.addPlayer}
          </button>
        )}
      </section>

      {sameSession && (
        <label className="tile flex cursor-pointer items-center gap-3 px-4 py-3">
          <input type="checkbox" className="toggle toggle-primary" checked={keepSession} onChange={(e) => setKeepSession(e.target.checked)} />
          <span className="text-sm">{t.keepSession(sessionMatches)}</span>
        </label>
      )}

      {draw && <FirstPlayerDraw names={draw.order} winnerIndex={draw.winnerIndex} onDone={finishDraw} />}

      <div className="mt-auto pt-2">
        <button type="button" className="btn btn-primary btn-lg w-full" onClick={onStart}>
          {t.gameOn}
        </button>
      </div>
    </>
  );
}
