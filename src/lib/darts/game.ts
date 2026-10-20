import { canCheckout, minDartsToFinish } from "./checkout";
import { Dart, dartValue, isDouble, isPossibleVisitTotal } from "./dart";

export interface GameConfig {
  startScore: number;
  doubleOut: boolean;
  /** Legs needed to win the match (1 = single leg). */
  legsToWin: number;
}

export interface Player {
  id: string;
  name: string;
}

/** A completed visit (turn) as it is stored locally or in Supabase. */
export interface Visit {
  id: string;
  playerId: string;
  /** Points that count. Always 0 for a bust. */
  score: number;
  /** Individual darts when entered dart-by-dart, null for quick-total entry. */
  darts: Dart[] | null;
  dartsThrown: number;
  bust: boolean;
  checkout: boolean;
}

export type VisitInput = Omit<Visit, "id" | "playerId">;

// ---------------------------------------------------------------------------
// Evaluating a visit in progress
// ---------------------------------------------------------------------------

export type VisitStatus = "open" | "bust" | "checkout";

export interface VisitEval {
  status: VisitStatus;
  /** Remaining score after the darts entered so far (start score on bust). */
  remaining: number;
  /** Raw points of the darts entered so far, ignoring bust. */
  thrown: number;
}

function wouldBust(after: number, lastWasDouble: boolean, doubleOut: boolean): boolean {
  if (after < 0) return true;
  if (doubleOut && after === 1) return true;
  return after === 0 && doubleOut && !lastWasDouble;
}

/** Dart-by-dart evaluation. Darts after a bust or checkout are ignored. */
export function evaluateDarts(start: number, darts: Dart[], doubleOut: boolean): VisitEval {
  let remaining = start;
  let thrown = 0;
  for (const d of darts) {
    const v = dartValue(d);
    thrown += v;
    const after = remaining - v;
    if (wouldBust(after, isDouble(d), doubleOut)) return { status: "bust", remaining: start, thrown };
    remaining = after;
    if (remaining === 0) return { status: "checkout", remaining: 0, thrown };
  }
  return { status: "open", remaining, thrown };
}

export function visitFromDarts(start: number, darts: Dart[], doubleOut: boolean): VisitInput {
  const ev = evaluateDarts(start, darts, doubleOut);
  // Count only darts up to the one that ended the visit.
  let used = darts.length;
  if (ev.status !== "open") {
    let r = start;
    for (let i = 0; i < darts.length; i++) {
      const after = r - dartValue(darts[i]);
      if (wouldBust(after, isDouble(darts[i]), doubleOut) || after === 0) {
        used = i + 1;
        break;
      }
      r = after;
    }
  }
  const kept = darts.slice(0, used);
  return {
    score: ev.status === "bust" ? 0 : start - ev.remaining,
    darts: kept,
    // A bust or an unfinished visit always costs the full three darts.
    dartsThrown: ev.status === "checkout" ? kept.length : 3,
    bust: ev.status === "bust",
    checkout: ev.status === "checkout",
  };
}

export type TotalEval =
  | { kind: "invalid"; reason: string }
  | { kind: "bust" }
  | { kind: "checkout"; minDarts: number }
  | { kind: "score"; remaining: number };

/** Evaluation for quick-total entry, where only the visit total is known. */
export function evaluateTotal(start: number, total: number, doubleOut: boolean): TotalEval {
  if (!isPossibleVisitTotal(total)) return { kind: "invalid", reason: `${total} can't be scored with 3 darts` };
  const after = start - total;
  if (after < 0 || (doubleOut && after === 1)) return { kind: "bust" };
  if (after === 0) {
    const minDarts = minDartsToFinish(start, doubleOut);
    // E.g. 159 left and 159 scored: possible total, but not finishable on a double.
    if (minDarts === null) return { kind: "bust" };
    return { kind: "checkout", minDarts };
  }
  return { kind: "score", remaining: after };
}

export function visitFromTotal(start: number, total: number, doubleOut: boolean, checkoutDarts = 3): VisitInput | null {
  const ev = evaluateTotal(start, total, doubleOut);
  switch (ev.kind) {
    case "invalid":
      return null;
    case "bust":
      return { score: 0, darts: null, dartsThrown: 3, bust: true, checkout: false };
    case "checkout":
      return {
        score: total,
        darts: null,
        dartsThrown: Math.max(ev.minDarts, Math.min(3, checkoutDarts)),
        bust: false,
        checkout: true,
      };
    case "score":
      return { score: total, darts: null, dartsThrown: 3, bust: false, checkout: false };
  }
}

// ---------------------------------------------------------------------------
// Replaying a match from its visit log
// ---------------------------------------------------------------------------

export interface PlayedVisit {
  visit: Visit;
  leg: number;
  /** Remaining score before this visit. */
  before: number;
  after: number;
}

export interface MatchState {
  played: PlayedVisit[];
  /** Index of the leg in progress (or the last leg once the match is over). */
  leg: number;
  remaining: Record<string, number>;
  legsWon: Record<string, number>;
  /** Player whose turn it is; null once the match is won. */
  currentPlayerId: string | null;
  winnerId: string | null;
  /** Winner of each finished leg, by leg index. */
  legWinners: string[];
}

/**
 * Derives the full match state from config, players and the ordered visit log.
 * This is the single source of truth for local and online games alike.
 */
export function replay(config: GameConfig, players: Player[], visits: Visit[]): MatchState {
  const n = players.length;
  const freshRemaining = () => Object.fromEntries(players.map((p) => [p.id, config.startScore]));
  const legsWon: Record<string, number> = Object.fromEntries(players.map((p) => [p.id, 0]));
  const played: PlayedVisit[] = [];
  const legWinners: string[] = [];
  let remaining = freshRemaining();
  let leg = 0;
  let turnInLeg = 0;
  let winnerId: string | null = null;

  for (const visit of visits) {
    if (winnerId || n === 0) break;
    const before = remaining[visit.playerId] ?? config.startScore;
    const after = visit.bust ? before : Math.max(0, before - visit.score);
    played.push({ visit, leg, before, after });
    remaining[visit.playerId] = after;
    turnInLeg++;

    if (after === 0) {
      legWinners.push(visit.playerId);
      legsWon[visit.playerId] = (legsWon[visit.playerId] ?? 0) + 1;
      if (legsWon[visit.playerId] >= config.legsToWin) {
        winnerId = visit.playerId;
      } else {
        leg++;
        turnInLeg = 0;
        remaining = freshRemaining();
      }
    }
  }

  const currentPlayerId = winnerId || n === 0 ? null : players[(leg + turnInLeg) % n].id;
  return { played, leg, remaining, legsWon, currentPlayerId, winnerId, legWinners };
}

/** Whether a player standing on `remaining` has a shot at the finish this visit. */
export function isCheckoutOpportunity(remaining: number, doubleOut: boolean): boolean {
  return canCheckout(remaining, 3, doubleOut);
}
