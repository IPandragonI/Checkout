"use client";

import { ChevronDown, ChevronRight, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { formatDuration, MatchStats, StatsTable } from "@/components/game/MatchStats";
import { DartBoard } from "@/components/stats/DartBoard";
import { PageShell } from "@/components/ui/PageShell";
import { useAuth } from "@/lib/auth/store";
import { dartLabel } from "@/lib/darts/dart";
import { replay } from "@/lib/darts/game";
import {
  groupSessions,
  isFinished,
  PlayerSessionStats,
  Session,
  sessionStats,
  topRegions,
} from "@/lib/darts/session";
import { useHydrated } from "@/lib/hooks";
import { Dict, useT } from "@/lib/i18n";
import { MatchRecord, useHistory, visibleMatches } from "@/lib/store/history";

const PAGE_SIZE = 10;

export default function StatsPage() {
  return (
    <Suspense fallback={<span className="loading loading-dots m-auto" />}>
      <StatsRoot />
    </Suspense>
  );
}

function StatsRoot() {
  const hydrated = useHydrated();
  const t = useT();
  const sessionId = useSearchParams().get("s");
  return (
    <PageShell title={t.stats} back={sessionId ? "/stats" : "/"}>
      {hydrated ? <Sessions sessionId={sessionId} /> : <span className="loading loading-dots mx-auto" />}
    </PageShell>
  );
}

function Sessions({ sessionId }: { sessionId: string | null }) {
  const t = useT();
  const allMatches = useHistory((s) => s.matches);
  const userId = useAuth((s) => s.user?.id ?? null);
  const sessions = useMemo(() => groupSessions(visibleMatches(allMatches, userId)), [allMatches, userId]);
  const selected = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;

  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-base-content/60">{t.noGamesYet}</p>
        <Link href="/play" className="btn btn-primary">
          {t.startAGame}
        </Link>
      </div>
    );
  }
  if (selected) return <SessionDetail session={selected} />;
  return <SessionList sessions={sessions} />;
}

// ---------------------------------------------------------------------------
// List of sessions
// ---------------------------------------------------------------------------

function SessionList({ sessions }: { sessions: Session<MatchRecord>[] }) {
  const t = useT();
  const [shown, setShown] = useState(PAGE_SIZE);
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg tracking-wide">{t.sessions}</h2>
      <p className="text-xs text-base-content/50">{t.sessionsHint}</p>
      <ul className="space-y-2">
        {sessions.slice(0, shown).map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </ul>
      {sessions.length > shown && (
        <button type="button" className="btn btn-soft btn-sm w-full" onClick={() => setShown(shown + PAGE_SIZE)}>
          {t.showMore}
        </button>
      )}
    </section>
  );
}

function SessionRow({ session }: { session: Session<MatchRecord> }) {
  const t = useT();
  const stats = useMemo(() => sessionStats(session), [session]);
  const solo = session.players.length === 1;
  const tally = stats.players.map((p) => p.wins).join("–");
  return (
    <li>
      <Link href={`/stats?s=${encodeURIComponent(session.id)}`} className="tile flex items-center gap-3 px-3 py-2.5">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${solo ? "bg-base-300" : "bg-success text-success-content"}`}>
          {solo ? "·" : <Trophy className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{session.players.map((p) => p.label).join(` ${t.vs} `)}</div>
          <div className="truncate text-xs text-base-content/60">
            {fmtDate(session.endedAt, t)} · {t.nMatches(stats.matchCount)}
            {!solo && ` · ${tally}`}
            {stats.activeMs > 0 && ` · ${formatDuration(stats.activeMs)}`}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-base-content/40" />
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// One session
// ---------------------------------------------------------------------------

function SessionDetail({ session }: { session: Session<MatchRecord> }) {
  const t = useT();
  const remove = useHistory((s) => s.remove);
  const stats = useMemo(() => sessionStats(session), [session]);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const player = stats.players.find((p) => p.key === pickedKey) ?? stats.players[0];
  const topWins = Math.max(...stats.players.map((p) => p.wins));

  return (
    <>
      <section className="panel space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl tracking-wide">{t.sessionOn(fmtDate(session.endedAt, t))}</h2>
          <span className="text-xs text-base-content/60">
            {t.nMatches(stats.matchCount)}
            {stats.activeMs > 0 && ` · ${formatDuration(stats.activeMs)}`}
          </span>
        </div>
        <div className={`grid gap-2 ${stats.players.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {stats.players.map((p) => (
            <div key={p.key} className="tile px-3 py-2 text-center">
              <div className="truncate text-sm text-base-content/70">{p.label}</div>
              <div className={`text-4xl font-bold leading-none ${stats.players.length > 1 && p.wins === topWins && topWins > 0 ? "text-highlight" : ""}`}>
                {p.wins}
              </div>
              <div className="text-xs text-base-content/50">{t.matchesWon}</div>
            </div>
          ))}
        </div>
        <StatsTable
          cols={stats.players.map((p) => ({
            id: p.key,
            name: p.label,
            stats: p.stats,
            highlight: stats.players.length > 1 && p.wins === topWins && topWins > 0,
          }))}
        />
      </section>

      {stats.players.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1" role="tablist" aria-label={t.player}>
          {stats.players.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={p.key === player.key}
              onClick={() => setPickedKey(p.key)}
              className={`btn btn-sm shrink-0 rounded-full ${p.key === player.key ? "btn-primary" : "btn-soft"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <PlayerInsights p={player} />

      <section className="space-y-2">
        <h2 className="font-display text-lg tracking-wide">{t.matchesInSession}</h2>
        <ul className="space-y-2">
          {session.matches.map((m, i) => (
            <MatchItem key={m.id} match={m} index={i + 1} />
          ))}
        </ul>
      </section>

      <button
        type="button"
        className="btn btn-ghost btn-sm self-start text-error"
        onClick={() => {
          if (window.confirm(t.deleteSessionConfirm)) session.matches.forEach((m) => remove(m.id));
        }}
      >
        <Trash2 className="size-4" /> {t.deleteSession}
      </button>
    </>
  );
}

function PlayerInsights({ p }: { p: PlayerSessionStats }) {
  const t = useT();
  const top = topRegions(p.heat);
  const misses = p.heat["0x1"] ?? 0;
  const maxAvg = Math.max(1, ...p.averages);

  return (
    <>
      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-lg tracking-wide">{t.heatmapTitle}</h2>
        {p.trackedDarts === 0 ? (
          <p className="text-sm text-base-content/60">{t.heatmapEmpty}</p>
        ) : (
          <>
            <DartBoard heat={p.heat} label={t.heatmapLabel(p.label)} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">{t.mostHit}</span>
              {top.map((r) => (
                <span key={r.label} className="badge badge-soft">
                  {r.label} · {r.count}
                </span>
              ))}
              {misses > 0 && <span className="text-xs text-base-content/60">{t.missesN(misses)}</span>}
            </div>
            <p className="text-xs text-base-content/50">{t.heatmapNote(p.trackedDarts)}</p>
          </>
        )}
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-lg tracking-wide">{t.bestVolleys}</h2>
        {p.bestVolleys.length === 0 ? (
          <p className="text-sm text-base-content/60">–</p>
        ) : (
          <ol className="space-y-2">
            {p.bestVolleys.map((v, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-14 text-3xl font-bold leading-none tabular">{v.score}</span>
                <span className="flex flex-1 flex-wrap gap-1">
                  {v.darts ? (
                    v.darts.map((d, j) => (
                      <span key={j} className="badge badge-neutral font-semibold">
                        {dartLabel(d)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-base-content/50">{t.totalOnly}</span>
                  )}
                </span>
                {v.checkout && <span className="badge badge-success">✓</span>}
              </li>
            ))}
          </ol>
        )}
        {p.favouriteDouble && (
          <p className="text-sm text-base-content/70">
            {t.favDouble}: <span className="font-semibold text-base-content">{p.favouriteDouble.label}</span> ({t.timesN(p.favouriteDouble.count)})
          </p>
        )}
      </section>

      {p.averages.length >= 2 && (
        <section className="panel space-y-2 p-4">
          <h2 className="font-display text-lg tracking-wide">{t.averageTrend}</h2>
          <div className="flex h-24 items-end gap-1.5" role="img" aria-label={p.averages.map((a) => a.toFixed(1)).join(", ")}>
            {p.averages.map((a, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-base-content/60 tabular">{a.toFixed(0)}</span>
                <div className="w-full rounded-t-[4px] bg-[var(--chart-series)]" style={{ height: `${(a / maxAvg) * 70}%`, minHeight: 2 }} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// A match inside a session
// ---------------------------------------------------------------------------

function MatchItem({ match: m, index }: { match: MatchRecord; index: number }) {
  const t = useT();
  const remove = useHistory((s) => s.remove);
  const [open, setOpen] = useState(false);
  const state = useMemo(() => replay(m.config, m.players, m.visits), [m]);
  const winner = m.players.find((p) => p.id === state.winnerId);
  const finished = isFinished(m);
  const legs = m.players.map((p) => state.legsWon[p.id] ?? 0).join("–");

  return (
    <li className="tile">
      <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-base-300 font-display text-lg">{index}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {finished ? (m.players.length > 1 ? t.wins(winner?.name ?? "") : t.practice) : t.unfinished}
          </div>
          <div className="truncate text-xs text-base-content/60">
            {m.config.startScore} · {legs}
            {m.activeMs ? ` · ${formatDuration(m.activeMs)}` : ""}
          </div>
        </div>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-base-300 px-3 py-3">
          <MatchStats match={m} durationMs={m.activeMs} />
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
