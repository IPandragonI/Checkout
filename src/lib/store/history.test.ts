import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/lib/auth/store";
import { MatchRecord, useHistory, visibleMatches } from "./history";

const match = (id: string, playedAt = 1, owner?: string): MatchRecord => ({
  id,
  playedAt,
  owner,
  mode: "local",
  config: { startScore: 301, doubleOut: true, legsToWin: 1 },
  players: [{ id: "p", name: "Ann" }],
  visits: [],
});

const ids = () => useHistory.getState().matches.map((m) => m.id).sort();

describe("history sync bookkeeping", () => {
  beforeEach(() => {
    useAuth.setState({ user: null, status: "guest" });
    useHistory.setState({ matches: [], dirty: [], deleted: [], lastSyncedAt: null });
  });

  it("keeps guest matches unowned, then claims them for the account at sign-in", () => {
    useHistory.getState().save(match("g1"));
    expect(useHistory.getState().matches[0].owner).toBeUndefined();

    useHistory.getState().claimGuestMatches("u1");
    const s = useHistory.getState();
    expect(s.matches[0].owner).toBe("u1");
    expect(s.dirty).toContain("g1");
  });

  it("tags matches saved while signed in with the account", () => {
    useAuth.setState({ user: { id: "u1", email: null, name: null }, status: "user" });
    useHistory.getState().save(match("m1"));
    expect(useHistory.getState().matches[0].owner).toBe("u1");
  });

  it("merges remote matches, keeps unsynced local ones, and drops ones deleted elsewhere", () => {
    useHistory.setState({
      matches: [match("synced-gone", 1, "u1"), match("synced-kept", 2, "u1"), match("pending", 3, "u1")],
      dirty: ["pending"],
    });
    useHistory.getState().applyRemote("u1", [match("synced-kept", 2, "u1"), match("from-other-device", 4, "u1")]);
    expect(ids()).toEqual(["from-other-device", "pending", "synced-kept"]);
    expect(useHistory.getState().lastSyncedAt).not.toBeNull();
  });

  it("does not resurrect a match deleted locally before the delete reached the cloud", () => {
    useHistory.setState({ matches: [match("m1", 1, "u1")] });
    useHistory.getState().remove("m1");
    expect(useHistory.getState().deleted).toEqual([{ id: "m1", owner: "u1" }]);

    useHistory.getState().applyRemote("u1", [match("m1", 1, "u1")]);
    expect(ids()).toEqual([]);
  });

  it("returns the device to guest mode on sign-out, keeping unsynced changes", () => {
    useHistory.setState({ matches: [match("synced", 1, "u1"), match("pending", 2, "u1"), match("guest", 3)], dirty: ["pending"] });
    useHistory.getState().forgetOwner("u1");
    expect(ids()).toEqual(["guest", "pending"]);
  });

  it("only shows guest matches and the current account's", () => {
    const all = [match("guest"), match("mine", 1, "u1"), match("theirs", 1, "u2")];
    expect(visibleMatches(all, "u1").map((m) => m.id)).toEqual(["guest", "mine"]);
    expect(visibleMatches(all, null).map((m) => m.id)).toEqual(["guest"]);
  });
});
