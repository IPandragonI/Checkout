"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GameScreen } from "@/components/game/GameScreen";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useLocalGame } from "@/lib/store/local-game";

export default function LocalGamePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const t = useT();
  const { match, submit, undo, rematch, quit } = useLocalGame();

  useEffect(() => {
    if (hydrated && !match) router.replace("/play");
  }, [hydrated, match, router]);

  if (!hydrated || !match) {
    return <span className="loading loading-dots m-auto" />;
  }

  return (
    <GameScreen
      config={match.config}
      players={match.players}
      visits={match.visits}
      onSubmit={submit}
      onUndo={() => {
        undo();
      }}
      onExit={() => router.push("/")}
      title={match.players.length === 1 ? t.soloPractice : match.players.map((p) => p.name).join(` ${t.vs} `)}
      matchOverActions={
        <>
          <button type="button" className="btn btn-primary btn-lg" onClick={rematch}>
            {t.rematch}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/play" className="btn btn-soft" onClick={quit}>
              {t.newGame}
            </Link>
            <Link href="/" className="btn btn-soft">
              {t.menu}
            </Link>
          </div>
        </>
      }
    />
  );
}
