import { Dart, dartLabel, dartValue, isDouble } from "./dart";
import { replay } from "./game";
import { computeStats, MatchLike, PlayerStats } from "./stats";

/** Everything the session maths needs from a stored match. */
export interface SessionMatch extends MatchLike {
  id: string;
  playedAt: number;
  startedAt?: number;
  /** Time actually spent playing (idle gaps are capped), in ms. */
  activeMs?: number;
  sessionId?: string;
}

/** A gap longer than this between two visits isn't counted as playing time. */
export const IDLE_CAP_MS = 3 * 60_000;

/** Adds the time since the last activity to the running total, ignoring long pauses. */
export function addActiveTime(totalMs: number, lastActiveAt: number, now: number): number {
  return totalMs + Math.min(IDLE_CAP_MS, Math.max(0, now - lastActiveAt));
}

export const normName = (s: string) => s.trim().toLowerCase();

const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export interface Session<M extends SessionMatch = SessionMatch> {
  id: string;
  /** Oldest first. */
  matches: M[];
  /** Everyone who played, by normalised name. */
  players: { key: string; label: string }[];
  startedAt: number;
  endedAt: number;
}

/**
 * Groups matches into sessions, newest session first. Matches carry a `sessionId`;
 * older ones without it are grouped by calendar day and set of players.
 */
export function groupSessions<M extends SessionMatch>(matches: M[]): Session<M>[] {
  const groups = new Map<string, M[]>();
  for (const m of matches) {
    const key =
      m.sessionId ?? `legacy:${localDay(m.playedAt)}:${m.players.map((p) => normName(p.name)).sort().join("|")}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }
  const sessions = [...groups.entries()].map(([id, list]): Session<M> => {
    const sorted = [...list].sort((a, b) => (a.startedAt ?? a.playedAt) - (b.startedAt ?? b.playedAt));
    const seen = new Map<string, string>();
    for (const m of sorted) for (const p of m.players) if (!seen.has(normName(p.name))) seen.set(normName(p.name), p.name);
    return {
      id,
      matches: sorted,
      players: [...seen.entries()].map(([key, label]) => ({ key, label })),
      startedAt: Math.min(...sorted.map((m) => m.startedAt ?? m.playedAt)),
      endedAt: Math.max(...sorted.map((m) => m.playedAt)),
    };
  });
  return sessions.sort((a, b) => b.endedAt - a.endedAt);
}

export const isFinished = (m: MatchLike) => replay(m.config, m.players, m.visits).winnerId !== null;

// ---------------------------------------------------------------------------
// Dart-level statistics
// ---------------------------------------------------------------------------

/** Key of a board region in a heat map: segment and multiplier, e.g. "20x3" for T20, "0x1" for a miss. */
export const heatKey = (d: Dart) => `${d.n}x${d.m}`;

export interface Volley {
  score: number;
  /** The darts thrown, or null when the visit was entered as a total. */
  darts: Dart[] | null;
  matchId: string;
  checkout: boolean;
}

export interface PlayerSessionStats {
  key: string;
  label: string;
  stats: PlayerStats;
  matches: number;
  /** Matches won (finished matches only). */
  wins: number;
  /** Per-match 3-dart average, oldest first. */
  averages: number[];
  /** Hits per board region from darts entered one by one. */
  heat: Record<string, number>;
  /** Darts whose landing spot is known (dart-by-dart entry). */
  trackedDarts: number;
  /** Best visits, highest first. */
  bestVolleys: Volley[];
  /** Most used finishing double, if any visit was entered dart by dart. */
  favouriteDouble: { label: string; count: number } | null;
}

export interface SessionStats {
  players: PlayerSessionStats[];
  matchCount: number;
  finishedCount: number;
  /** Playing time summed over matches that recorded it, in ms. */
  activeMs: number;
}

const TOP_VOLLEYS = 3;

export function sessionStats(session: Session): SessionStats {
  const players = session.players.map(({ key, label }): PlayerSessionStats => {
    const belongs = (p: { name: string }) => normName(p.name) === key;
    const mine = session.matches.filter((m) => m.players.some(belongs));
    const heat: Record<string, number> = {};
    let trackedDarts = 0;
    const volleys: Volley[] = [];
    const doubles = new Map<number, number>();
    let wins = 0;

    for (const m of mine) {
      const ids = new Set(m.players.filter(belongs).map((p) => p.id));
      const state = replay(m.config, m.players, m.visits);
      if (state.winnerId && ids.has(state.winnerId)) wins++;
      for (const { visit } of state.played) {
        if (!ids.has(visit.playerId)) continue;
        if (visit.score > 0) volleys.push({ score: visit.score, darts: visit.darts, matchId: m.id, checkout: visit.checkout });
        if (!visit.darts) continue;
        for (const d of visit.darts) {
          heat[heatKey(d)] = (heat[heatKey(d)] ?? 0) + 1;
          trackedDarts++;
        }
        const last = visit.darts.at(-1);
        if (visit.checkout && last && isDouble(last)) doubles.set(last.n, (doubles.get(last.n) ?? 0) + 1);
      }
    }

    volleys.sort((a, b) => b.score - a.score || Number(!!b.darts) - Number(!!a.darts));
    const fav = [...doubles.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      key,
      label,
      stats: computeStats(mine, belongs),
      matches: mine.length,
      wins,
      averages: mine.map((m) => computeStats([m], belongs).average),
      heat,
      trackedDarts,
      bestVolleys: volleys.slice(0, TOP_VOLLEYS),
      favouriteDouble: fav ? { label: dartLabel({ n: fav[0], m: 2 }), count: fav[1] } : null,
    };
  });

  return {
    players,
    matchCount: session.matches.length,
    finishedCount: session.matches.filter(isFinished).length,
    activeMs: session.matches.reduce((sum, m) => sum + (m.activeMs ?? 0), 0),
  };
}

/** Regions sorted by hit count, ignoring misses. */
export function topRegions(heat: Record<string, number>, limit = 5): { label: string; count: number }[] {
  return Object.entries(heat)
    .filter(([k]) => !k.startsWith("0x"))
    .map(([k, count]) => {
      const [n, m] = k.split("x").map(Number);
      return { label: dartLabel({ n, m: m as Dart["m"] }), count, value: dartValue({ n, m: m as Dart["m"] }) };
    })
    .sort((a, b) => b.count - a.count || b.value - a.value)
    .slice(0, limit)
    .map(({ label, count }) => ({ label, count }));
}
