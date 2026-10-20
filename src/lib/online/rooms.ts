import type { Dart } from "@/lib/darts/dart";
import type { GameConfig, Player, Visit, VisitInput } from "@/lib/darts/game";
import { supabase } from "./supabase";

export interface Room {
  id: string;
  code: string;
  config: GameConfig;
  status: "lobby" | "playing";
  matchNo: number;
  version: number;
}

export interface RoomPlayer extends Player {
  deviceId: string;
  position: number;
}

export interface RoomVisit extends Visit {
  seq: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come untyped from PostgREST */
export const mapRoom = (r: any): Room => ({
  id: r.id,
  code: r.code,
  config: { startScore: r.start_score, doubleOut: r.double_out, legsToWin: r.legs_to_win },
  status: r.status,
  matchNo: r.match_no,
  version: r.version,
});

const mapPlayer = (r: any): RoomPlayer => ({ id: r.id, name: r.name, deviceId: r.device_id, position: r.position });

export const mapVisit = (r: any): RoomVisit => ({
  id: r.id,
  seq: r.seq,
  playerId: r.player_id,
  score: r.score,
  darts: (r.darts as Dart[] | null) ?? null,
  dartsThrown: r.darts_thrown,
  bust: r.bust,
  checkout: r.checkout,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const UNIQUE_VIOLATION = "23505";

export class TurnConflictError extends Error {
  constructor() {
    super("That turn was already scored on another device.");
  }
}

// No 0/O or 1/I: codes are read out loud across the room.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export async function createRoom(config: GameConfig): Promise<Room> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase()
      .from("rooms")
      .insert({
        code: randomCode(),
        start_score: config.startScore,
        double_out: config.doubleOut,
        legs_to_win: config.legsToWin,
      })
      .select()
      .single();
    if (!error) return mapRoom(data);
    if (error.code !== UNIQUE_VIOLATION) throw error;
  }
  throw new Error("Could not allocate a room code, please retry.");
}

export async function findRoom(code: string): Promise<Room | null> {
  const { data, error } = await supabase().from("rooms").select().eq("code", normalizeCode(code)).maybeSingle();
  if (error) throw error;
  return data ? mapRoom(data) : null;
}

export async function fetchRoom(id: string): Promise<Room> {
  const { data, error } = await supabase().from("rooms").select().eq("id", id).single();
  if (error) throw error;
  return mapRoom(data);
}

export async function fetchPlayers(roomId: string): Promise<RoomPlayer[]> {
  const { data, error } = await supabase().from("players").select().eq("room_id", roomId).order("position");
  if (error) throw error;
  return data.map(mapPlayer);
}

export async function fetchVisits(roomId: string, matchNo: number): Promise<RoomVisit[]> {
  const { data, error } = await supabase()
    .from("visits")
    .select()
    .eq("room_id", roomId)
    .eq("match_no", matchNo)
    .order("seq");
  if (error) throw error;
  return data.map(mapVisit);
}

export async function addPlayer(roomId: string, name: string, deviceId: string): Promise<RoomPlayer> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const players = await fetchPlayers(roomId);
    const position = players.reduce((max, p) => Math.max(max, p.position + 1), 0);
    const { data, error } = await supabase()
      .from("players")
      .insert({ room_id: roomId, name: name.trim().slice(0, 24), device_id: deviceId, position })
      .select()
      .single();
    if (!error) return mapPlayer(data);
    if (error.code !== UNIQUE_VIOLATION) throw error;
  }
  throw new Error("Could not join the room, please retry.");
}

export async function removePlayer(id: string): Promise<void> {
  const { error } = await supabase().from("players").delete().eq("id", id);
  if (error) throw error;
}

export async function startRoom(roomId: string): Promise<void> {
  const { error } = await supabase().from("rooms").update({ status: "playing" }).eq("id", roomId);
  if (error) throw error;
}

export async function insertVisit(
  room: Room,
  seq: number,
  playerId: string,
  input: VisitInput,
): Promise<RoomVisit> {
  const { data, error } = await supabase()
    .from("visits")
    .insert({
      room_id: room.id,
      match_no: room.matchNo,
      seq,
      player_id: playerId,
      score: input.score,
      darts: input.darts,
      darts_thrown: input.dartsThrown,
      bust: input.bust,
      checkout: input.checkout,
    })
    .select()
    .single();
  if (error?.code === UNIQUE_VIOLATION) throw new TurnConflictError();
  if (error) throw error;
  return mapVisit(data);
}

export async function deleteVisit(id: string): Promise<void> {
  const { error } = await supabase().from("visits").delete().eq("id", id);
  if (error) throw error;
}

/** Starts the next match. Conditional on match_no so two phones tapping "rematch" only advance once. */
export async function rematch(room: Room): Promise<void> {
  const { error } = await supabase()
    .from("rooms")
    .update({ match_no: room.matchNo + 1 })
    .eq("id", room.id)
    .eq("match_no", room.matchNo);
  if (error) throw error;
}

/** Turn order for a match: players by join order, rotated so starters alternate between matches. */
export function orderForMatch(players: RoomPlayer[], matchNo: number): RoomPlayer[] {
  if (players.length === 0) return players;
  const sorted = [...players].sort((a, b) => a.position - b.position);
  const k = (matchNo - 1) % sorted.length;
  return [...sorted.slice(k), ...sorted.slice(0, k)];
}
