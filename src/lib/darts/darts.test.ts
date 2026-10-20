import { describe, expect, it } from "vitest";
import { minDartsToFinish, suggestCheckout } from "./checkout";
import { Dart, dartLabel } from "./dart";
import { evaluateDarts, evaluateTotal, replay, Visit, visitFromDarts, visitFromTotal } from "./game";
import { computeStats } from "./stats";

const T = (n: number): Dart => ({ n, m: 3 });
const D = (n: number): Dart => ({ n, m: 2 });
const S = (n: number): Dart => ({ n, m: 1 });
const labels = (r: Dart[] | null) => r?.map(dartLabel).join(" ") ?? null;

describe("checkout suggestions", () => {
  it("finds the classic finishes", () => {
    expect(labels(suggestCheckout(170, 3, true))).toBe("T20 T20 Bull");
    expect(labels(suggestCheckout(167, 3, true))).toBe("T20 T19 Bull");
    expect(labels(suggestCheckout(160, 3, true))).toBe("T20 T20 D20");
    expect(labels(suggestCheckout(100, 3, true))).toBe("T20 D20");
    expect(labels(suggestCheckout(80, 3, true))).toBe("T20 D10");
    expect(labels(suggestCheckout(60, 3, true))).toBe("20 D20");
    expect(labels(suggestCheckout(40, 3, true))).toBe("D20");
    expect(labels(suggestCheckout(32, 3, true))).toBe("D16");
  });

  it("returns null for bogey numbers and impossible scores", () => {
    for (const s of [169, 168, 166, 165, 163, 162, 159, 171, 1]) {
      expect(suggestCheckout(s, 3, true)).toBeNull();
    }
  });

  it("adapts to the darts left", () => {
    expect(labels(suggestCheckout(60, 1, true))).toBeNull();
    expect(labels(suggestCheckout(50, 1, true))).toBe("Bull");
    expect(suggestCheckout(101, 2, true)?.length).toBe(2);
    expect(suggestCheckout(120, 2, true)).toBeNull();
  });

  it("allows any finishing dart with single-out", () => {
    expect(labels(suggestCheckout(60, 1, false))).toBe("T20");
    expect(labels(suggestCheckout(1, 1, false))).toBe("1");
    expect(labels(suggestCheckout(180, 3, false))).toBe("T20 T20 T20");
  });

  it("knows the minimum darts", () => {
    expect(minDartsToFinish(40, true)).toBe(1);
    expect(minDartsToFinish(41, true)).toBe(2);
    expect(minDartsToFinish(170, true)).toBe(3);
    expect(minDartsToFinish(169, true)).toBeNull();
  });
});

describe("bust logic", () => {
  it("busts below zero, on one, and on a non-double finish", () => {
    expect(evaluateDarts(32, [T(20)], true).status).toBe("bust");
    expect(evaluateDarts(32, [S(15), S(16)], true).status).toBe("bust");
    expect(evaluateDarts(32, [S(16), S(16)], true).status).toBe("bust");
    expect(evaluateDarts(32, [S(16), S(16)], false).status).toBe("checkout");
    expect(evaluateDarts(32, [D(16)], true).status).toBe("checkout");
    expect(evaluateDarts(50, [D(25)], true).status).toBe("checkout");
  });

  it("resets to the turn start and counts 3 darts on a bust", () => {
    const v = visitFromDarts(32, [S(20), S(13)], true);
    expect(v).toMatchObject({ bust: true, score: 0, dartsThrown: 3 });
    expect(v.darts).toHaveLength(2);
  });

  it("records only the darts needed for a checkout", () => {
    const v = visitFromDarts(80, [T(20), D(10), S(5)], true);
    expect(v).toMatchObject({ checkout: true, score: 80, dartsThrown: 2 });
  });

  it("validates quick totals", () => {
    expect(evaluateTotal(501, 179, true).kind).toBe("invalid");
    expect(evaluateTotal(501, 181, true).kind).toBe("invalid");
    expect(evaluateTotal(40, 39, true).kind).toBe("bust");
    expect(evaluateTotal(40, 41, true).kind).toBe("bust");
    expect(evaluateTotal(159, 159, true).kind).toBe("bust");
    expect(evaluateTotal(40, 40, true)).toEqual({ kind: "checkout", minDarts: 1 });
    expect(visitFromTotal(100, 100, true, 1)?.dartsThrown).toBe(2);
  });
});

describe("replay", () => {
  const config = { startScore: 101, doubleOut: true, legsToWin: 2 };
  const players = [{ id: "a", name: "Ann" }, { id: "b", name: "Bob" }];
  let i = 0;
  const v = (playerId: string, score: number, extra: Partial<Visit> = {}): Visit => ({
    id: String(i++), playerId, score, darts: null, dartsThrown: 3, bust: false, checkout: false, ...extra,
  });

  it("rotates turns, legs and starters, and stops at the winner", () => {
    const visits = [
      v("a", 60), v("b", 0, { bust: true }), v("a", 41, { checkout: true, dartsThrown: 2 }),
      // Leg 2: Bob throws first.
      v("b", 100), v("a", 20), v("b", 1, { bust: true, score: 0 }), v("a", 81, { checkout: true }),
      v("b", 50), // ignored, match is over
    ];
    const first = replay(config, players, visits.slice(0, 3));
    expect(first.legsWon).toEqual({ a: 1, b: 0 });
    expect(first.currentPlayerId).toBe("b");
    expect(first.remaining).toEqual({ a: 101, b: 101 });

    const done = replay(config, players, visits);
    expect(done.winnerId).toBe("a");
    expect(done.currentPlayerId).toBeNull();
    expect(done.played).toHaveLength(7);
    expect(done.legWinners).toEqual(["a", "a"]);
  });

  it("computes stats", () => {
    const visits = [v("a", 60), v("b", 0, { bust: true }), v("a", 41, { checkout: true, dartsThrown: 2 })];
    const s = computeStats([{ config, players, visits }], (p) => p.name === "Ann");
    expect(s.average).toBeCloseTo((101 / 5) * 3);
    expect(s.checkouts).toBe(1);
    expect(s.checkoutAttempts).toBe(2);
    expect(s.highestCheckout).toBe(41);
    expect(s.bestLeg).toBe(5);
    expect(s.tons.s60).toBe(1);
  });
});
