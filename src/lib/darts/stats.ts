import { GameConfig, isCheckoutOpportunity, Player, replay, Visit } from "./game";

export interface PlayerStats {
  points: number;
  darts: number;
  visits: number;
  /** 3-dart average. */
  average: number;
  /** Average of the first three visits of each leg. */
  first9: number;
  checkoutAttempts: number;
  checkouts: number;
  checkoutPct: number;
  highestCheckout: number;
  highestScore: number;
  /** Fewest darts used to win a leg. */
  bestLeg: number | null;
  legsWon: number;
  tons: { s60: number; s100: number; s140: number; s180: number };
}

export function emptyStats(): PlayerStats {
  return {
    points: 0, darts: 0, visits: 0, average: 0, first9: 0,
    checkoutAttempts: 0, checkouts: 0, checkoutPct: 0,
    highestCheckout: 0, highestScore: 0, bestLeg: null, legsWon: 0,
    tons: { s60: 0, s100: 0, s140: 0, s180: 0 },
  };
}

interface Accumulator extends PlayerStats {
  f9Points: number;
  f9Darts: number;
}

function finalize(acc: Accumulator): PlayerStats {
  const { f9Points, f9Darts, ...s } = acc;
  return {
    ...s,
    average: s.darts ? (s.points / s.darts) * 3 : 0,
    first9: f9Darts ? (f9Points / f9Darts) * 3 : 0,
    checkoutPct: s.checkoutAttempts ? (s.checkouts / s.checkoutAttempts) * 100 : 0,
  };
}

export interface MatchLike {
  config: GameConfig;
  players: Player[];
  visits: Visit[];
}

/** Stats for every player matching `belongs` across a set of matches. */
export function computeStats(matches: MatchLike[], belongs: (p: Player) => boolean): PlayerStats {
  const acc: Accumulator = { ...emptyStats(), f9Points: 0, f9Darts: 0 };

  for (const m of matches) {
    const ids = new Set(m.players.filter(belongs).map((p) => p.id));
    if (ids.size === 0) continue;
    const state = replay(m.config, m.players, m.visits);
    const visitsInLeg = new Map<string, number>();
    const dartsInLeg = new Map<string, number>();

    for (const { visit, leg, before } of state.played) {
      if (!ids.has(visit.playerId)) continue;
      const key = `${leg}:${visit.playerId}`;
      const nth = (visitsInLeg.get(key) ?? 0) + 1;
      visitsInLeg.set(key, nth);
      dartsInLeg.set(key, (dartsInLeg.get(key) ?? 0) + visit.dartsThrown);

      acc.visits++;
      acc.points += visit.score;
      acc.darts += visit.dartsThrown;
      if (nth <= 3) {
        acc.f9Points += visit.score;
        acc.f9Darts += visit.dartsThrown;
      }
      acc.highestScore = Math.max(acc.highestScore, visit.score);
      if (visit.score === 180) acc.tons.s180++;
      else if (visit.score >= 140) acc.tons.s140++;
      else if (visit.score >= 100) acc.tons.s100++;
      else if (visit.score >= 60) acc.tons.s60++;

      if (isCheckoutOpportunity(before, m.config.doubleOut)) acc.checkoutAttempts++;
      if (visit.checkout) {
        acc.checkouts++;
        acc.legsWon++;
        acc.highestCheckout = Math.max(acc.highestCheckout, before);
        const legDarts = dartsInLeg.get(key)!;
        acc.bestLeg = acc.bestLeg === null ? legDarts : Math.min(acc.bestLeg, legDarts);
      }
    }
  }
  return finalize(acc);
}

export function statsForPlayer(match: MatchLike, playerId: string): PlayerStats {
  return computeStats([match], (p) => p.id === playerId);
}
