import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/lib/auth/store";
import { BackupError, buildBackup, parseBackup } from "./backup";
import { MatchRecord, useHistory } from "./history";

const match = (id: string, playedAt = 1): MatchRecord => ({
  id,
  playedAt,
  startedAt: 0,
  activeMs: 5000,
  sessionId: "s",
  config: { startScore: 301, doubleOut: true, legsToWin: 1 },
  players: [{ id: "p", name: "Ann" }],
  visits: [
    { id: "v", playerId: "p", score: 60, darts: [{ n: 20, m: 3 }], dartsThrown: 3, bust: false, checkout: false },
  ],
});

describe("backup file", () => {
  it("round-trips matches and leaves the account owner out", () => {
    const backup = buildBackup([{ ...match("a"), owner: "user-1" }], 123);
    expect(backup).toMatchObject({ format: "checkout-backup", version: 1, exportedAt: 123 });
    expect(backup.matches[0]).not.toHaveProperty("owner");

    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.invalid).toBe(0);
    expect(parsed.matches).toEqual([match("a")]);
  });

  it("rejects files that aren't backups", () => {
    expect(() => parseBackup("nope")).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ format: "checkout-backup", version: 2, matches: [] }))).toThrow(BackupError);
  });

  it("skips malformed matches instead of importing them", () => {
    const bad = [
      { ...match("no-config"), config: null },
      { ...match("bad-dart"), visits: [{ ...match("x").visits[0], darts: [{ n: 21, m: 1 }] }] },
      { ...match("stranger"), visits: [{ ...match("x").visits[0], playerId: "ghost" }] },
      { ...match("score"), visits: [{ ...match("x").visits[0], score: 999 }] },
      "text",
    ];
    const parsed = parseBackup(JSON.stringify({ format: "checkout-backup", version: 1, matches: [match("ok"), ...bad] }));
    expect(parsed.matches.map((m) => m.id)).toEqual(["ok"]);
    expect(parsed.invalid).toBe(5);
  });
});

describe("importing into history", () => {
  beforeEach(() => {
    useAuth.setState({ user: null, status: "guest" });
    useHistory.setState({ matches: [], dirty: [], deleted: [], lastSyncedAt: null });
  });

  it("adds new matches and keeps existing ones that are as recent", () => {
    useHistory.getState().save(match("a", 10));
    const result = useHistory.getState().importMatches([match("a", 10), match("b", 5)]);
    expect(result).toEqual({ added: 1, skipped: 1 });
    expect(useHistory.getState().matches.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  it("replaces a match with a more recent copy", () => {
    useHistory.getState().save(match("a", 10));
    const newer = { ...match("a", 20), activeMs: 9999 };
    expect(useHistory.getState().importMatches([newer])).toEqual({ added: 1, skipped: 0 });
    expect(useHistory.getState().matches).toHaveLength(1);
    expect(useHistory.getState().matches[0].activeMs).toBe(9999);
  });

  it("queues imported matches for sync", () => {
    useHistory.getState().importMatches([match("a")]);
    expect(useHistory.getState().dirty).toEqual(["a"]);
  });
});
