import { describe, expect, it } from "vitest";
import { Dart } from "./dart";
import { pickFirstIndex, rotateToFirst } from "./draw";
import { GameConfig, Player, replay, Visit, visitFromDarts } from "./game";
import { addActiveTime, groupSessions, IDLE_CAP_MS, SessionMatch, sessionStats, topRegions } from "./session";

const T = (n: number): Dart => ({ n, m: 3 });
const D = (n: number): Dart => ({ n, m: 2 });
const S = (n: number): Dart => ({ n, m: 1 });
const BULL: Dart = { n: 25, m: 2 };

const visit = (id: string, playerId: string, start: number, darts: Dart[], doubleOut = true): Visit => ({
  id,
  playerId,
  ...visitFromDarts(start, darts, doubleOut),
});

const cfg = (startScore: number): GameConfig => ({ startScore, doubleOut: true, legsToWin: 1 });
const players = (suffix: string): Player[] => [
  { id: `A${suffix}`, name: "Ann" },
  { id: `B${suffix}`, name: "bob " },
];

/** Ann checks out 170 with T20 T20 Bull on her first visit. */
const match1: SessionMatch = {
  id: "m1",
  playedAt: 2_000,
  startedAt: 1_000,
  sessionId: "s1",
  config: cfg(170),
  players: players("1"),
  visits: [visit("v1", "A1", 170, [T(20), T(20), BULL])],
};

/** Ann throws 1-1-1, then Bob checks out 40 with D20. */
const match2: SessionMatch = {
  id: "m2",
  playedAt: 4_000,
  startedAt: 3_000,
  sessionId: "s1",
  config: cfg(40),
  players: players("2"),
  visits: [visit("v2", "A2", 40, [S(1), S(1), S(1)]), visit("v3", "B2", 40, [D(20)])],
};

describe("active time", () => {
  it("adds the gap since the last activity", () => {
    expect(addActiveTime(1000, 10_000, 40_000)).toBe(31_000);
  });

  it("ignores long pauses and clock jumps backwards", () => {
    expect(addActiveTime(0, 0, 3_600_000)).toBe(IDLE_CAP_MS);
    expect(addActiveTime(500, 10_000, 5_000)).toBe(500);
  });
});

describe("first player draw", () => {
  it("rotates the order so the drawn player throws first in the replay", () => {
    const base: Player[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ];
    for (let winner = 0; winner < base.length; winner++) {
      const order = rotateToFirst(base, winner);
      expect(order[0]).toBe(base[winner]);
      // Everyone else keeps their relative order after the winner.
      expect(order.map((p) => p.id)).toEqual([...base.slice(winner), ...base.slice(0, winner)].map((p) => p.id));
      expect(replay(cfg(301), order, []).currentPlayerId).toBe(base[winner].id);
    }
  });

  it("picks every index in range", () => {
    expect(pickFirstIndex(3, () => 0)).toBe(0);
    expect(pickFirstIndex(3, () => 0.5)).toBe(1);
    expect(pickFirstIndex(3, () => 0.999999)).toBe(2);
    expect(pickFirstIndex(3, () => 1)).toBe(2);
  });
});

describe("groupSessions", () => {
  it("groups by session id, oldest match first, newest session first", () => {
    const other: SessionMatch = { ...match1, id: "m9", sessionId: "s2", playedAt: 9_000, startedAt: 8_000 };
    const sessions = groupSessions([match2, other, match1]);
    expect(sessions.map((s) => s.id)).toEqual(["s2", "s1"]);
    expect(sessions[1].matches.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(sessions[1].players.map((p) => p.key)).toEqual(["ann", "bob"]);
  });

  it("groups matches without a session id by day and set of players", () => {
    const a = { ...match1, id: "a", sessionId: undefined };
    const b = { ...match2, id: "b", sessionId: undefined };
    const otherPlayers = { ...match1, id: "c", sessionId: undefined, players: [{ id: "X", name: "Zed" }], visits: [] };
    expect(groupSessions([a, b, otherPlayers])).toHaveLength(2);
  });
});

describe("sessionStats", () => {
  const [session] = groupSessions([match1, match2]);
  const stats = sessionStats(session);
  const ann = stats.players.find((p) => p.key === "ann")!;
  const bob = stats.players.find((p) => p.key === "bob")!;

  it("counts matches and wins per player across matches, matching names loosely", () => {
    expect(stats.matchCount).toBe(2);
    expect(stats.finishedCount).toBe(2);
    expect(ann.wins).toBe(1);
    expect(bob.wins).toBe(1);
    expect(ann.matches).toBe(2);
    expect(ann.stats.darts).toBe(6);
  });

  it("builds a heat map from darts entered one by one", () => {
    expect(ann.heat).toEqual({ "20x3": 2, "25x2": 1, "1x1": 3 });
    expect(ann.trackedDarts).toBe(6);
    expect(bob.heat).toEqual({ "20x2": 1 });
    expect(topRegions(ann.heat, 2)).toEqual([
      { label: "1", count: 3 },
      { label: "T20", count: 2 },
    ]);
  });

  it("keeps the best volleys, highest first, with the darts that made them", () => {
    expect(ann.bestVolleys.map((v) => v.score)).toEqual([170, 3]);
    expect(ann.bestVolleys[0]).toMatchObject({ checkout: true, darts: [T(20), T(20), BULL] });
  });

  it("finds the favourite finishing double", () => {
    expect(ann.favouriteDouble).toEqual({ label: "Bull", count: 1 });
    expect(bob.favouriteDouble).toEqual({ label: "D20", count: 1 });
  });

  it("leaves quick-total visits out of the heat map but keeps them as volleys", () => {
    const totals: SessionMatch = {
      ...match1,
      id: "t",
      visits: [{ id: "q", playerId: "A1", score: 100, darts: null, dartsThrown: 3, bust: false, checkout: false }],
    };
    const s = sessionStats(groupSessions([totals])[0]).players[0];
    expect(s.trackedDarts).toBe(0);
    expect(s.heat).toEqual({});
    expect(s.bestVolleys).toEqual([{ score: 100, darts: null, matchId: "t", checkout: false }]);
  });

  it("does not count an unfinished match as a win", () => {
    const unfinished: SessionMatch = { ...match2, id: "u", visits: [match2.visits[0]] };
    const s = sessionStats(groupSessions([unfinished])[0]);
    expect(s.finishedCount).toBe(0);
    expect(s.players.every((p) => p.wins === 0)).toBe(true);
  });
});
