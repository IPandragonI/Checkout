"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { replay } from "@/lib/darts/game";
import { computeStats, PlayerStats } from "@/lib/darts/stats";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { MatchRecord, useHistory } from "@/lib/store/history";
import { useSettings } from "@/lib/store/settings";

const norm = (s: string) => s.trim().toLowerCase();

export default function StatsPage() {
  const hydrated = useHydrated();
  const t = useT();
  return <PageShell title={t.stats}>{hydrated ? <Dashboard /> : <span className="loading loading-dots mx-auto" />}</PageShell>;
}

function Dashboard() {
  const t = useT();
  const matches = useHistory((s) => s.matches);
  const clear = useHistory((s) => s.clear);
  const myName = useSettings((s) => s.name);

  // Every name that appears in history, most frequent first.
  const names = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const m of matches)
      for (const p of m.players) {
        const k = norm(p.name);
        const e = counts.get(k) ?? { label: p.name, n: 0 };
        e.n++;
        counts.set(k, e);
      }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n).map(([key, { label }]) => ({ key, label }));
  }, [matches]);

  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? (names.some((n) => n.key === norm(myName)) ? norm(myName) : names[0]?.key ?? "");

  const { mine, stats } = useMemo(() => {
    const belongs = (p: { name: string }) => norm(p.name) === selected;
    const mine = matches.filter((m) => m.players.some(belongs));
    return { mine, stats: computeStats(mine, belongs) };
  }, [matches, selected]);

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
    <>
      {names.length > 1 && (
        <select className="select w-full" value={selected} onChange={(e) => setPicked(e.target.value)} aria-label={t.player}>
          {names.map((n) => (
            <option key={n.key} value={n.key}>
              {n.label}
            </option>
          ))}
        </select>
      )}

      <StatGrid stats={stats} matches={mine.length} />
      <Distribution stats={stats} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-base-content/70">{t.matches}</h2>
        <ul className="space-y-1.5">
          {mine.map((m) => (
            <MatchRow key={m.id} match={m} nameKey={selected} />
          ))}
        </ul>
      </section>

      <button
        type="button"
        className="btn btn-ghost btn-sm text-error"
        onClick={() => confirm(t.clearHistoryConfirm) && clear()}
      >
        <Trash2 className="size-4" /> {t.clearHistory}
      </button>
    </>
  );
}

function StatGrid({ stats: s, matches }: { stats: PlayerStats; matches: number }) {
  const t = useT();
  const tiles: [string, string][] = [
    [t.avg3, s.average.toFixed(1)],
    [t.first9Avg, s.first9.toFixed(1)],
    [t.checkoutPct, s.checkoutAttempts ? `${s.checkoutPct.toFixed(1)}%` : "–"],
    [t.highestOut, s.highestCheckout ? String(s.highestCheckout) : "–"],
    [t.bestLeg, s.bestLeg ? t.dartsN(s.bestLeg) : "–"],
    [t.topVisit, s.highestScore ? String(s.highestScore) : "–"],
    [t.legsWon, String(s.legsWon)],
    [t.matches, String(matches)],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map(([label, value], i) => (
        <div key={label} className={`rounded-box bg-base-100 p-3 ${i === 0 ? "col-span-2" : ""}`}>
          <div className="text-xs text-base-content/60">{label}</div>
          <div className={`font-mono font-bold tabular ${i === 0 ? "text-5xl text-accent" : "text-2xl"}`}>{value}</div>
        </div>
      ))}
      <div className="col-span-2 text-xs text-base-content/50">
        {t.coNote(s.checkouts, s.checkoutAttempts)}
      </div>
    </div>
  );
}

function Distribution({ stats: s }: { stats: PlayerStats }) {
  const t = useT();
  const rows: [string, number][] = [
    ["60+", s.tons.s60],
    ["100+", s.tons.s100],
    ["140+", s.tons.s140],
    ["180", s.tons.s180],
  ];
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section className="rounded-box bg-base-100 p-4 space-y-2">
      <h2 className="text-sm font-medium text-base-content/70">{t.scoreDistribution}</h2>
      {rows.map(([label, n]) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <span className="w-10 font-mono">{label}</span>
          <div className="h-3 flex-1 rounded-full bg-base-300">
            <div className="h-3 rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right font-mono tabular">{n}</span>
        </div>
      ))}
    </section>
  );
}

function MatchRow({ match: m, nameKey }: { match: MatchRecord; nameKey: string }) {
  const t = useT();
  const me = m.players.find((p) => norm(p.name) === nameKey)!;
  const s = computeStats([m], (p) => p.id === me.id);
  const winnerId = replay(m.config, m.players, m.visits).winnerId;
  const others = m.players.filter((p) => p.id !== me.id).map((p) => p.name);
  const won = winnerId === me.id;
  return (
    <li className="flex items-center gap-3 rounded-field bg-base-100 px-3 py-2">
      {others.length > 0 ? (
        <span className={`badge badge-sm w-7 ${won ? "badge-success" : "badge-ghost"}`}>{won ? t.win : t.loss}</span>
      ) : (
        <span className="badge badge-sm badge-ghost w-7">–</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{others.length ? t.vsList(others.join(", ")) : t.solo}</div>
        <div className="text-xs text-base-content/50">
          {new Date(m.playedAt).toLocaleDateString(t.locale, { day: "numeric", month: "short" })} · {m.config.startScore}
          {m.mode === "online" && ` · ${t.roomLower(m.roomCode ?? "")}`}
        </div>
      </div>
      <div className="text-right font-mono tabular">
        <div className="font-bold">{s.average.toFixed(1)}</div>
        <div className="text-xs text-base-content/50">{t.avgShort}</div>
      </div>
    </li>
  );
}
