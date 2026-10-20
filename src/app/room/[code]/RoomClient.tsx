"use client";

import { Share2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GameScreen } from "@/components/game/GameScreen";
import { PageShell } from "@/components/ui/PageShell";
import { replay } from "@/lib/darts/game";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { addPlayer, orderForMatch, rematch, removePlayer, Room, RoomPlayer, startRoom } from "@/lib/online/rooms";
import { onlineEnabled } from "@/lib/online/supabase";
import { RoomNotice, useRoom } from "@/lib/online/useRoom";
import { useHistory } from "@/lib/store/history";
import { getDeviceId, useSettings } from "@/lib/store/settings";

const NOTICE_TEXT: Record<RoomNotice, "noticeConflict" | "noticeSaveFailed" | "noticeUndoFailed"> = {
  conflict: "noticeConflict",
  saveFailed: "noticeSaveFailed",
  undoFailed: "noticeUndoFailed",
};

export function RoomClient({ code }: { code: string }) {
  const hydrated = useHydrated();
  const t = useT();
  if (!onlineEnabled) {
    return (
      <PageShell title={t.roomN(code)} back="/online">
        <p>{t.notConfiguredShort}</p>
      </PageShell>
    );
  }
  if (!hydrated) return <span className="loading loading-dots m-auto" />;
  return <LiveRoom code={code} />;
}

function LiveRoom({ code }: { code: string }) {
  const router = useRouter();
  const t = useT();
  const { status, error, room, players, visits, notice, submit, undo } = useRoom(code);
  const deviceId = useSettings((s) => s.deviceId);
  const mine = useMemo(() => new Set(players.filter((p) => p.deviceId === deviceId).map((p) => p.id)), [players, deviceId]);
  const ordered = useMemo(() => (room ? orderForMatch(players, room.matchNo) : []), [players, room]);

  // Mirror finished matches into local history so they count towards personal stats.
  const winnerId = room && ordered.length ? replay(room.config, ordered, visits).winnerId : null;
  useEffect(() => {
    if (!room || room.status !== "playing") return;
    const id = `${room.id}:${room.matchNo}`;
    const history = useHistory.getState();
    if (winnerId) {
      history.save({
        id,
        playedAt: Date.now(),
        mode: "online",
        roomCode: room.code,
        config: room.config,
        players: ordered.map(({ id, name }) => ({ id, name })),
        visits,
      });
    } else {
      history.remove(id);
    }
  }, [winnerId, room, ordered, visits]);

  if (status === "loading") return <span className="loading loading-dots m-auto" />;
  if (status === "missing" || status === "error" || !room) {
    return (
      <PageShell title={t.roomN(code)} back="/online">
        <div role="alert" className="alert alert-error alert-soft">
          {status === "missing" ? t.roomMissing(code) : t.connectionProblem(error ?? "")}
        </div>
        <Link href="/online" className="btn btn-primary">
          {t.back}
        </Link>
      </PageShell>
    );
  }

  if (room.status === "lobby") return <Lobby room={room} players={players} mine={mine} />;

  return (
    <GameScreen
      config={room.config}
      players={ordered}
      visits={visits}
      onSubmit={submit}
      onUndo={undo}
      onExit={() => router.push("/")}
      title={t.roomN(room.code)}
      myPlayerIds={mine}
      banner={
        notice && (
          <div role="status" className="alert alert-warning alert-soft mx-3 py-2 text-sm">
            {t[NOTICE_TEXT[notice]]}
          </div>
        )
      }
      matchOverActions={
        <>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => rematch(room)}>
            {t.rematch}
          </button>
          <Link href="/" className="btn btn-soft">
            {t.leaveRoom}
          </Link>
        </>
      }
    />
  );
}

function Lobby({ room, players, mine }: { room: Room; players: RoomPlayer[]; mine: Set<string> }) {
  const t = useT();
  const name = useSettings((s) => s.name);
  const [newName, setNewName] = useState(mine.size === 0 ? name : "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const join = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await addPlayer(room.id, newName, getDeviceId());
      setNewName("");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = `${location.origin}/room/${room.code}`;
    const text = t.shareText(room.code);
    if (navigator.share) {
      await navigator.share({ title: "Checkout", text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    }
  };

  return (
    <PageShell title={t.lobby} back="/online">
      <div className="card panel">
        <div className="card-body items-center gap-1 p-5 text-center">
          <div className="text-sm text-base-content/60">{t.roomCode}</div>
          <div className="font-mono text-6xl font-black tracking-[0.2em] text-highlight">{room.code}</div>
          <div className="text-sm text-base-content/60">
            {room.config.startScore} · {room.config.doubleOut ? t.doubleOutLower : t.singleOutLower}
            {room.config.legsToWin > 1 && ` · ${t.firstToLower(room.config.legsToWin)}`}
          </div>
          <button type="button" className="btn btn-soft btn-sm mt-2" onClick={share}>
            <Share2 className="size-4" /> {copied ? t.linkCopied : t.invite}
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <div className="text-sm font-medium text-base-content/70">{t.playersCount(players.length)}</div>
        <ul className="space-y-1.5">
          {players.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 tile px-4 py-2.5">
              <span className="font-mono text-base-content/40">{i + 1}</span>
              <span className="flex-1 font-semibold">{p.name}</span>
              {mine.has(p.id) && (
                <>
                  <span className="badge badge-ghost badge-sm">{t.thisPhone}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    aria-label={t.removeN(p.name)}
                    onClick={() => removePlayer(p.id)}
                  >
                    <X className="size-4" />
                  </button>
                </>
              )}
            </li>
          ))}
          {players.length === 0 && <li className="text-base-content/50">{t.nobodyYet}</li>}
        </ul>
        <div className="join w-full">
          <input
            className="input join-item flex-1"
            placeholder={mine.size ? t.addAnotherPlayer : t.yourName}
            value={newName}
            maxLength={24}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <button type="button" className="btn btn-primary join-item" disabled={busy || !newName.trim()} onClick={join}>
            <UserPlus className="size-4" /> {t.join}
          </button>
        </div>
      </section>

      <div className="mt-auto pt-2">
        <button
          type="button"
          className="btn btn-accent btn-lg w-full"
          disabled={players.length === 0}
          onClick={() => startRoom(room.id)}
        >
          {t.startGame}
        </button>
        <p className="mt-2 text-center text-xs text-base-content/50">{t.anyoneCanStart}</p>
      </div>
    </PageShell>
  );
}
