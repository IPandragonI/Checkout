"use client";

import { ArrowUp, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfigFields } from "@/components/ui/ConfigFields";
import { PageShell } from "@/components/ui/PageShell";
import type { GameConfig } from "@/lib/darts/game";
import { useHydrated } from "@/lib/hooks";
import { getT, useT } from "@/lib/i18n";
import { useLocalGame } from "@/lib/store/local-game";
import { useSettings } from "@/lib/store/settings";

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

  const onStart = () => {
    const cleaned = names.map((n, i) => n.trim() || t.playerN(i + 1));
    settings.set({ lastConfig: config, lastPlayers: cleaned });
    start(config, cleaned);
    router.push("/play/game");
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

      <div className="mt-auto pt-2">
        <button type="button" className="btn btn-primary btn-lg w-full" onClick={onStart}>
          {t.gameOn}
        </button>
      </div>
    </>
  );
}
