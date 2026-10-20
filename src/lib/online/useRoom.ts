"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VisitInput } from "@/lib/darts/game";
import { uid } from "@/lib/id";
import {
  deleteVisit,
  fetchPlayers,
  fetchRoom,
  fetchVisits,
  findRoom,
  insertVisit,
  mapRoom,
  mapVisit,
  Room,
  RoomPlayer,
  RoomVisit,
  TurnConflictError,
} from "./rooms";
import { supabase } from "./supabase";

export type RoomStatus = "loading" | "missing" | "ready" | "error";
/** Transient problems shown to the user; translated by the UI. */
export type RoomNotice = "conflict" | "saveFailed" | "undoFailed";

const bySeq = (a: RoomVisit, b: RoomVisit) => a.seq - b.seq;

/**
 * Live view of a room: initial fetch, then Supabase Realtime changes on
 * rooms / players / visits. Writes are optimistic and reconciled by refetch.
 */
export function useRoom(code: string) {
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [visits, setVisits] = useState<RoomVisit[]>([]);
  const [notice, setNotice] = useState<RoomNotice | null>(null);
  const roomRef = useRef<Room | null>(null);
  const visitsRef = useRef<RoomVisit[]>([]);

  const applyRoom = useCallback((r: Room) => {
    roomRef.current = r;
    setRoom(r);
  }, []);
  const applyVisits = useCallback((v: RoomVisit[]) => {
    visitsRef.current = v;
    setVisits(v);
  }, []);

  const refetch = useCallback(async () => {
    const current = roomRef.current;
    if (!current) return;
    try {
      const r = await fetchRoom(current.id);
      const [p, v] = await Promise.all([fetchPlayers(r.id), fetchVisits(r.id, r.matchNo)]);
      applyRoom(r);
      setPlayers(p);
      applyVisits(v);
    } catch {
      // Transient network issue: the next event or focus will retry.
    }
  }, [applyRoom, applyVisits]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof supabase>["channel"]> | null = null;

    (async () => {
      try {
        const r = await findRoom(code);
        if (cancelled) return;
        if (!r) {
          setStatus("missing");
          return;
        }
        applyRoom(r);
        await refetch();
        if (cancelled) return;
        setStatus("ready");

        const filter = `room_id=eq.${r.id}`;
        channel = supabase()
          .channel(`room:${r.id}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "visits", filter }, (payload) => {
            const v = mapVisit(payload.new);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((payload.new as any).match_no !== roomRef.current?.matchNo) return;
            const rest = visitsRef.current.filter((x) => x.id !== v.id && x.seq !== v.seq);
            applyVisits([...rest, v].sort(bySeq));
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "players", filter }, () => {
            fetchPlayers(r.id).then(setPlayers, () => {});
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${r.id}` }, (payload) => {
            applyRoom(mapRoom(payload.new));
            refetch();
          })
          .subscribe((s) => {
            // Catch up on anything missed while (re)connecting.
            if (s === "SUBSCRIBED") refetch();
          });
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    // Phones drop websockets when the screen sleeps: resync on return.
    const onVisible = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase().removeChannel(channel);
    };
  }, [code, refetch, applyRoom, applyVisits]);

  const flash = useCallback((msg: RoomNotice) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3000);
  }, []);

  const submit = useCallback(
    async (playerId: string, input: VisitInput) => {
      const r = roomRef.current;
      if (!r) return;
      const seq = visitsRef.current.length;
      const optimistic: RoomVisit = { ...input, id: `tmp-${uid()}`, playerId, seq };
      applyVisits([...visitsRef.current, optimistic]);
      try {
        const saved = await insertVisit(r, seq, playerId, input);
        applyVisits(visitsRef.current.map((v) => (v.id === optimistic.id ? saved : v)).sort(bySeq));
      } catch (e) {
        flash(e instanceof TurnConflictError ? "conflict" : "saveFailed");
        await refetch();
      }
    },
    [applyVisits, flash, refetch],
  );

  const undo = useCallback(async () => {
    const last = visitsRef.current.at(-1);
    if (!last) return;
    applyVisits(visitsRef.current.slice(0, -1));
    try {
      if (!last.id.startsWith("tmp-")) await deleteVisit(last.id);
    } catch (e) {
      flash("undoFailed");
      await refetch();
      throw e;
    }
  }, [applyVisits, flash, refetch]);

  return { status, error, room, players, visits, notice, submit, undo, refetch };
}
