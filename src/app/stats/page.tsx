"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { useAuth } from "@/lib/auth/store";
import { replay } from "@/lib/darts/game";
import { computeStats, PlayerStats } from "@/lib/darts/stats";
import { useHydrated } from "@/lib/hooks";
import { Dict, useT } from "@/lib/i18n";
import { MatchRecord, useHistory, visibleMatches } from "@/lib/store/history";
import { useSettings } from "@/lib/store/settings";

const norm = (s: string) => s.trim().toLowerCase();
const TREND_POINTS = 20;
const PAGE_SIZE = 10;

export default function StatsPage() {
  const hydrated = useHydrated();
  const t = useT();
  return <PageShell title={t.stats}>{hydrated ? <Dashboard /> : <span className="loading loading-dots mx-auto" />}</PageShell>;
}

interface MatchRow {
  match: MatchRecord;
  stats: PlayerStats;
  others: string[];
  won: boolean;
  legsMe: number;
  legsThem: number;
}

function Dashboard() {
  const t = useT();
  const allMatches = useHistory((s) => s.matches);
  const userId = useAuth((s) => s.user?.id ?? null);
  const matches = useMemo(() => visibleMatches(allMatches, userId), [allMatches, userId]);
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

  const { stats, rows } = useMemo(() => {
    const belongs = (p: { name: string }) => norm(p.name) === selected;
    const mine = matches.filter((m) => m.players.some(belongs)).sort((a, b) => b.playedAt - a.playedAt);
    const rows: MatchRow[] = mine.map((match) => {
      const me = match.players.find(belongs)!;
      const state = replay(match.config, match.players, match.visits);
      const opponents = match.players.filter((p) => p.id !== me.id);
      return {
        match,
        stats: computeStats([match], (p) => p.id === me.id),
        others: opponents.map((p) => p.name),
        won: state.winnerId === me.id,
        legsMe: state.legsWon[me.id] ?? 0,
        legsThem: Math.max(0, ...opponents.map((p) => state.legsWon[p.id] ?? 0)),
      };
    });
    return { stats: computeStats(mine, belongs), rows };
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
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1" role="tablist" aria-label={t.player}>
          {names.map((n) => (
            <button
              key={n.key}
              type="button"
              role="tab"
              aria-selected={n.key === selected}
              onClick={() => setPicked(n.key)}
              className={`btn btn-sm shrink-0 gap-2 rounded-full ${n.key === selected ? "btn-primary" : "btn-soft"}`}
            >
              <span className="grid size-5 place-items-center rounded-full bg-black/15 text-xs font-bold">
                {n.label.trim().charAt(0).toUpperCase()}
              </span>
              {n.label}
            </button>
          ))}
        </div>
      )}

      <HeroAverage stats={stats} rows={rows} />
      <KeyMetrics stats={stats} rows={rows} />
      <Distribution stats={stats} />
      <MatchHistory rows={rows} />
    </>
  );
}

function HeroAverage({ stats, rows }: { stats: PlayerStats; rows: MatchRow[] }) {
  const t = useT();
  const points = rows
    .slice(0, TREND_POINTS)
    .reverse()
    .map((r) => ({
      value: r.stats.average,
      label: t.chartTooltip(fmtDate(r.match.playedAt, t), r.stats.average.toFixed(1)),
    }));
  return (
    <section className="panel space-y-2 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-base-content/60">{t.avg3}</div>
          <div className="text-6xl font-bold leading-none">{stats.average.toFixed(1)}</div>
        </div>
        {rows[0] && <div className="pb-1 text-right text-sm text-base-content/60">{t.lastMatchAvg(rows[0].stats.average.toFixed(1))}</div>}
      </div>
      {points.length >= 2 && (
        <figure>
          <figcaption className="mb-1 text-xs font-medium text-base-content/60">{t.avgTrend}</figcaption>
          <TrendChart points={points} />
        </figure>
      )}
    </section>
  );
}

/** Single-series line (2px) with a 10% area wash, end label, and crosshair + tooltip on hover/touch. */
function TrendChart({ points }: { points: { value: number; label: string }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 112;
  // Right padding fits the end label ("100.2") beside the last point.
  const pad = { l: 26, r: 46, t: 8, b: 8 };
  const values = points.map((p) => p.value);
  let lo = Math.floor(Math.min(...values) / 10) * 10;
  let hi = Math.ceil(Math.max(...values) / 10) * 10;
  if (hi === lo) {
    lo = Math.max(0, lo - 10);
    hi += 10;
  }
  const step = (width - pad.l - pad.r) / (points.length - 1);
  const x = (i: number) => pad.l + i * step;
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join("");
  const area = `${line}L${x(points.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z`;
  const last = points.length - 1;
  const active = hover ?? null;

  const pick = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect();
    setHover(Math.min(last, Math.max(0, Math.round((clientX - rect.left - pad.l) / step))));
  };

  return (
    <div ref={box} className="relative h-28 touch-pan-y">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={points.map((p) => p.label).join(", ")}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          {[lo, hi].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="fill-base-content/50 text-[10px]">
                {v}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--chart-series)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--chart-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={pad.t} y2={H - pad.b} stroke="var(--chart-grid)" strokeWidth={1} />
          )}
          <circle
            cx={x(active ?? last)}
            cy={y(points[active ?? last].value)}
            r={4.5}
            fill="var(--chart-series)"
            stroke="var(--color-base-100)"
            strokeWidth={2}
          />
          {active === null && (
            <text x={x(last) + 8} y={y(points[last].value) + 4} className="fill-base-content text-[11px] font-semibold">
              {points[last].value.toFixed(1)}
            </text>
          )}
        </svg>
      )}
      {active !== null && (
        <div
          className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 whitespace-nowrap rounded-field bg-neutral px-2 py-1 text-xs font-medium text-neutral-content shadow"
          style={{ left: Math.min(width - 60, Math.max(60, x(active))) }}
        >
          {points[active].label}
        </div>
      )}
    </div>
  );
}

function KeyMetrics({ stats: s, rows }: { stats: PlayerStats; rows: MatchRow[] }) {
  const t = useT();
  const contested = rows.filter((r) => r.others.length > 0);
  const wins = contested.filter((r) => r.won).length;
  const coPct = s.checkoutAttempts ? s.checkoutPct : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile label={t.first9Avg} value={s.first9.toFixed(1)} />
      <Tile label={t.highestOut} value={s.highestCheckout ? String(s.highestCheckout) : "–"} />
      <Tile
        label={t.checkoutPct}
        value={coPct === null ? "–" : `${coPct.toFixed(1)}%`}
        caption={t.checkoutHits(s.checkouts, s.checkoutAttempts)}
      >
        <Meter pct={coPct ?? 0} />
      </Tile>
      <Tile
        label={t.matchesWins}
        value={`${rows.length} · ${wins}`}
        caption={contested.length ? t.winRate(Math.round((wins / contested.length) * 100)) : undefined}
      >
        {contested.length > 0 && <Meter pct={(wins / contested.length) * 100} />}
      </Tile>
      <div className="col-span-2 grid grid-cols-3 gap-3">
        <Tile small label={t.bestLeg} value={s.bestLeg ? String(s.bestLeg) : "–"} />
        <Tile small label={t.topVisit} value={s.highestScore ? String(s.highestScore) : "–"} />
        <Tile small label={t.legsWon} value={String(s.legsWon)} />
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  caption,
  small,
  children,
}: {
  label: string;
  value: string;
  caption?: string;
  small?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`panel flex flex-col gap-1 ${small ? "p-3" : "p-4"}`}>
      <div className="text-xs text-base-content/60">{label}</div>
      <div className={`font-semibold leading-none ${small ? "text-xl" : "text-3xl"}`}>{value}</div>
      {children}
      {caption && <div className="text-xs text-base-content/50">{caption}</div>}
    </div>
  );
}

/** Ratio against 100%: fill in the series colour on a lighter same-ramp track. */
function Meter({ pct }: { pct: number }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--chart-track)]">
      <div className="h-full rounded-full bg-[var(--chart-series)]" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function Distribution({ stats: s }: { stats: PlayerStats }) {
  const t = useT();
  const rows: [string, number][] = [
    ["180", s.tons.s180],
    ["140+", s.tons.s140],
    ["100+", s.tons.s100],
    ["60+", s.tons.s60],
  ];
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section className="panel space-y-3 p-4">
      <h2 className="font-display text-lg tracking-wide">{t.scoreDistribution}</h2>
      {rows.map(([label, n]) => {
        const pct = s.visits ? ((n / s.visits) * 100).toFixed(1) : "0";
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-11 shrink-0 text-sm font-semibold">{label}</span>
            <div className="tooltip tooltip-top flex h-5 flex-1 items-center" data-tip={`${label} : ${n} · ${t.ofVisits(pct)}`}>
              <div className="flex h-full w-full items-center gap-2 border-l border-[var(--chart-grid)]">
                <div
                  className="h-3 rounded-r-[4px] bg-[var(--chart-series)] transition-[width] duration-500"
                  style={{ width: `${(n / max) * 82}%`, minWidth: n ? 4 : 0 }}
                />
                <span className="shrink-0 text-sm font-semibold tabular">{n}</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function MatchHistory({ rows }: { rows: MatchRow[] }) {
  const t = useT();
  const [shown, setShown] = useState(PAGE_SIZE);
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg tracking-wide">{t.recentMatches}</h2>
      <ul className="space-y-2">
        {rows.slice(0, shown).map((r) => (
          <MatchItem key={r.match.id} row={r} />
        ))}
      </ul>
      {rows.length > shown && (
        <button type="button" className="btn btn-soft btn-sm w-full" onClick={() => setShown(shown + PAGE_SIZE)}>
          {t.showMore}
        </button>
      )}
    </section>
  );
}

function MatchItem({ row: r }: { row: MatchRow }) {
  const t = useT();
  const m = r.match;
  const solo = r.others.length === 0;
  return (
    <li className="tile flex items-center gap-3 px-3 py-2.5">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-lg ${
          solo ? "bg-base-300" : r.won ? "bg-success text-success-content" : "bg-base-300 text-base-content/70"
        }`}
        aria-label={solo ? t.practice : r.won ? t.win : t.loss}
      >
        {solo ? "·" : r.won ? <Trophy className="size-5" /> : t.loss}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{solo ? t.practice : t.vsList(r.others.join(", "))}</div>
        <div className="truncate text-xs text-base-content/60">
          {fmtDate(m.playedAt, t)} · {m.config.startScore}
          {!solo && ` · ${t.legsScore(r.legsMe, r.legsThem)}`}
          {m.mode === "online" && ` · ${t.roomLower(m.roomCode ?? "")}`}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold leading-none tabular">{r.stats.average.toFixed(1)}</div>
        <div className="text-xs text-base-content/50">{t.avgShort}</div>
      </div>
    </li>
  );
}

function fmtDate(ms: number, t: Dict) {
  return new Date(ms).toLocaleDateString(t.locale, { day: "numeric", month: "short" });
}
