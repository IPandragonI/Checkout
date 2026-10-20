"use client";

import { ChartColumn, Play, Settings, Users, Wifi } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AccountButton, GuestPrompt } from "@/components/ui/AccountPrompts";
import { replay } from "@/lib/darts/game";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useLocalGame } from "@/lib/store/local-game";

/** Round translucent button that reads on top of the busy hero artwork. */
const HERO_ICON =
  "btn btn-ghost btn-circle border-2 border-white/25 bg-black/40 text-white backdrop-blur-sm hover:bg-black/55";

export default function Home() {
  const hydrated = useHydrated();
  const t = useT();
  const match = useLocalGame((s) => s.match);
  const ongoing = hydrated && match && !replay(match.config, match.players, match.visits).winnerId ? match : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      {/* Top half: full-bleed logo artwork with the app name. */}
      <header className="relative h-[50dvh] min-h-80 max-h-[32rem] w-full overflow-hidden">
        <Image
          src="/brand/hero.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 448px) 100vw, 448px"
          className="object-cover object-[50%_35%]"
        />
        <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/80 via-black/35 to-transparent" />

        <nav className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-safe">
          <AccountButton className={HERO_ICON} />
          <div className="ml-auto flex gap-2">
            <Link href="/stats" className={HERO_ICON} aria-label={t.stats}>
              <ChartColumn className="size-5" />
            </Link>
            <Link href="/settings" className={HERO_ICON} aria-label={t.settings}>
              <Settings className="size-5" />
            </Link>
          </div>
        </nav>

        <h1 className="hero-title absolute inset-x-0 bottom-10 -rotate-3 text-center font-display text-7xl tracking-wide">
          Checkout
        </h1>
      </header>

      {/* Bottom half: the action center. */}
      <main className="relative z-10 -mt-6 flex flex-1 flex-col gap-4 rounded-t-[2rem] bg-base-200 px-4 pt-6 pb-safe">
        {ongoing && (
          <ActionButton href="/play/game" className="btn-accent" icon={<Play className="size-8 fill-current" />} pulse>
            {t.resume}
            <Hint>
              {ongoing.config.startScore} · {ongoing.players.map((p) => p.name).join(` ${t.vs} `)}
            </Hint>
          </ActionButton>
        )}
        <ActionButton href="/play" className="btn-primary" icon={<Users className="size-8" />}>
          {t.newGame}
          <Hint>{t.newGameHint}</Hint>
        </ActionButton>
        <ActionButton href="/online" className="btn-secondary" icon={<Wifi className="size-8" />}>
          {t.onlineRoom}
          <Hint>{t.onlineRoomHint}</Hint>
        </ActionButton>

        <GuestPrompt />
      </main>
    </div>
  );
}

function ActionButton({
  href,
  className,
  icon,
  pulse,
  children,
}: {
  href: string;
  className: string;
  icon: React.ReactNode;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`btn h-22 justify-start gap-4 rounded-box px-4 text-left ${className}`}>
      <span className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-black/15 ${pulse ? "animate-pulse" : ""}`}>
        {icon}
      </span>
      <span className="min-w-0 font-display text-2xl leading-tight tracking-wide">{children}</span>
    </Link>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="block truncate font-sans text-sm font-medium tracking-normal opacity-80">{children}</span>;
}
