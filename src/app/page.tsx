"use client";

import { ChartColumn, Play, Settings, Users, Wifi } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AccountButton, GuestPrompt } from "@/components/ui/AccountPrompts";
import { PreferenceToggles } from "@/components/ui/Preferences";
import { replay } from "@/lib/darts/game";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useLocalGame } from "@/lib/store/local-game";
import { useSettings } from "@/lib/store/settings";

export default function Home() {
  const hydrated = useHydrated();
  const t = useT();
  const match = useLocalGame((s) => s.match);
  const name = useSettings((s) => s.name);
  const ongoing = hydrated && match && !replay(match.config, match.players, match.visits).winnerId ? match : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-safe pb-safe">
      <div className="flex items-center justify-between">
        <AccountButton />
        <PreferenceToggles />
      </div>
      <div className="mt-2 flex flex-col items-center gap-3 text-center">
        <Image src="/brand/logo-256.png" alt="" width={112} height={112} className="size-28 drop-shadow-xl" priority />
        <h1 className="text-4xl font-black tracking-tight">Checkout</h1>
        <p className="text-base-content/60">
          {hydrated && name ? t.greeting(name) : t.tagline}
        </p>
      </div>

      <GuestPrompt />

      {ongoing && (
        <Link href="/play/game" className="card bg-accent text-accent-content">
          <div className="card-body flex-row items-center gap-3 p-4">
            <Play className="size-8 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold">{t.resume}</div>
              <div className="truncate text-sm opacity-80">
                {ongoing.config.startScore} · {ongoing.players.map((p) => p.name).join(` ${t.vs} `)}
              </div>
            </div>
          </div>
        </Link>
      )}

      <nav className="grid gap-3">
        <Link href="/play" className="btn btn-primary btn-lg h-20 justify-start gap-4 text-lg">
          <Users className="size-7" />
          <span className="text-left leading-tight">
            {t.newGame}
            <span className="block text-xs font-normal opacity-80">{t.newGameHint}</span>
          </span>
        </Link>
        <Link href="/online" className="btn btn-lg h-20 justify-start gap-4 text-lg btn-soft">
          <Wifi className="size-7" />
          <span className="text-left leading-tight">
            {t.onlineRoom}
            <span className="block text-xs font-normal opacity-70">{t.onlineRoomHint}</span>
          </span>
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/stats" className="btn btn-soft h-16 gap-2">
            <ChartColumn className="size-5" /> {t.stats}
          </Link>
          <Link href="/settings" className="btn btn-soft h-16 gap-2">
            <Settings className="size-5" /> {t.settings}
          </Link>
        </div>
      </nav>
    </div>
  );
}
