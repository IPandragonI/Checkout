"use client";

import { ChevronDown, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDuration, MatchStats } from "@/components/game/MatchStats";
import { PageShell } from "@/components/ui/PageShell";
import { useAuth } from "@/lib/auth/store";
import { replay } from "@/lib/darts/game";
import { statsForPlayer } from "@/lib/darts/stats";
import { useHydrated } from "@/lib/hooks";
import { Dict, useT } from "@/lib/i18n";
import { MatchRecord, useHistory, visibleMatches } from "@/lib/store/history";

const PAGE_SIZE = 10;

export default function StatsPage() {
  const hydrated = useHydrated();
  const t = useT();
  return <PageShell title={t.stats}>{hydrated ? <MatchList /> : <span className="loading loading-dots mx-auto" />}</PageShell>;
}

/** Stats live with each finished match, stored on this device: there is no lifetime aggregate. */
function MatchList() {
  const t = useT();
  const allMatches = useHistory((s) => s.matches);
  const userId = useAuth((s) => s.user?.id ?? null);
  const matches = useMemo(
    () => visibleMatches(allMatches, userId).sort((a, b) => b.playedAt - a.playedAt),
    [allMatches, userId],
  );
  const [shown, setShown] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<string | null>(null);

  if (matches.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-base-content/60">{t.noGamesYet}</p>
        <Link href="/play" className="btn btn-primary">
          {t.startAGame}
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg tracking-wide">{t.recentMatches}</h2>
      <p className="text-xs text-base-content/50">{t.statsHint}</p>
      <ul className="space-y-2">
        {matches.slice(0, shown).map((m) => (
          <MatchItem key={m.id} match={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
        ))}
      </ul>
      {matches.length > shown && (
        <button type="button" className="btn btn-soft btn-sm w-full" onClick={() => setShown(shown + PAGE_SIZE)}>
          {t.showMore}
        </button>
      )}
    </section>
  );
}

function MatchItem({ match: m, open, onToggle }: { match: MatchRecord; open: boolean; onToggle: () => void }) {
  const t = useT();
  const remove = useHistory((s) => s.remove);
  const state = useMemo(() => replay(m.config, m.players, m.visits), [m]);
  const winner = m.players.find((p) => p.id === state.winnerId);
  const solo = m.players.length === 1;
  const bestAvg = Math.max(...m.players.map((p) => statsForPlayer(m, p.id).average));
  const names = m.players.map((p) => p.name).join(` ${t.vs} `);
  const legs = m.players.map((p) => state.legsWon[p.id] ?? 0).join("–");
  const durationMs = m.startedAt ? m.playedAt - m.startedAt : undefined;

  return (
    <li className="tile">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${solo ? "bg-base-300" : "bg-success text-success-content"}`}
        >
          {solo ? "·" : <Trophy className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{solo ? t.practice : names}</div>
          <div className="truncate text-xs text-base-content/60">
            {fmtDate(m.playedAt, t)} · {m.config.startScore}
            {!solo && ` · ${t.wins(winner?.name ?? "")} ${legs}`}
            {durationMs ? ` · ${formatDuration(durationMs)}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold leading-none tabular">{bestAvg.toFixed(1)}</div>
          <div className="text-xs text-base-content/50">{t.avgShort}</div>
        </div>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-base-300 px-3 py-3">
          <MatchStats match={m} durationMs={durationMs} />
          <button
            type="button"
            className="btn btn-ghost btn-sm text-error"
            onClick={() => {
              if (window.confirm(t.deleteMatch + " ?")) remove(m.id);
            }}
          >
            <Trash2 className="size-4" /> {t.deleteMatch}
          </button>
        </div>
      )}
    </li>
  );
}

function fmtDate(ms: number, t: Dict) {
  return new Date(ms).toLocaleDateString(t.locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
