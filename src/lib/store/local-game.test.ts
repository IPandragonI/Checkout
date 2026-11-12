import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/lib/auth/store";
import { IDLE_CAP_MS } from "@/lib/darts/session";
import { useHistory } from "./history";
import { useLocalGame } from "./local-game";

const config = { startScore: 301, doubleOut: false, legsToWin: 1 };
const score = (total: number) => ({ score: total, darts: null, dartsThrown: 3, bust: false, checkout: false });

const game = () => useLocalGame.getState();
const firstPlayer = () => game().match!.players[0].id;

describe("local match lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    useAuth.setState({ user: null, status: "guest" });
    useHistory.setState({ matches: [], dirty: [], deleted: [], lastSyncedAt: null });
    useLocalGame.setState({ match: null });
  });
  afterEach(() => vi.useRealTimers());

  it("starts a new session unless asked to continue one", () => {
    game().start(config, ["Ann", "Bob"]);
    const first = game().match!.sessionId;
    expect(first).toBeTruthy();
    game().start(config, ["Ann", "Bob"]);
    expect(game().match!.sessionId).not.toBe(first);
    game().start(config, ["Ann", "Bob"], first);
    expect(game().match!.sessionId).toBe(first);
  });

  it("keeps an unfinished match in history, and drops it again when every visit is undone", () => {
    game().start(config, ["Ann", "Bob"]);
    expect(useHistory.getState().matches).toHaveLength(0);

    game().submit(firstPlayer(), score(60));
    const [saved] = useHistory.getState().matches;
    expect(saved).toMatchObject({ id: game().match!.id, sessionId: game().match!.sessionId });
    expect(saved.visits).toHaveLength(1);

    game().undo();
    expect(useHistory.getState().matches).toHaveLength(0);
  });

  it("keeps a match in history after it is abandoned mid-game", () => {
    game().start(config, ["Ann", "Bob"]);
    game().submit(firstPlayer(), score(100));
    game().quit();
    expect(game().match).toBeNull();
    expect(useHistory.getState().matches).toHaveLength(1);
  });

  it("counts playing time, capping long pauses", () => {
    game().start(config, ["Ann", "Bob"]);
    vi.setSystemTime(1_000_000 + 60_000);
    game().submit(firstPlayer(), score(60));
    expect(game().match!.activeMs).toBe(60_000);

    vi.setSystemTime(1_000_000 + 60_000 + 3_600_000);
    game().submit(game().match!.players[1].id, score(45));
    expect(game().match!.activeMs).toBe(60_000 + IDLE_CAP_MS);
    expect(useHistory.getState().matches[0].activeMs).toBe(60_000 + IDLE_CAP_MS);
  });

  it("keeps the session on rematch, with a fresh match and clock", () => {
    game().start(config, ["Ann", "Bob"]);
    game().submit(firstPlayer(), score(60));
    const before = game().match!;
    game().rematch();
    const after = game().match!;
    expect(after.id).not.toBe(before.id);
    expect(after.sessionId).toBe(before.sessionId);
    expect(after.activeMs).toBe(0);
    expect(after.visits).toEqual([]);
    expect(after.players.map((p) => p.name)).toEqual(["Bob", "Ann"]);
  });
});
