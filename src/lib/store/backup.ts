import { isValidDart } from "@/lib/darts/dart";
import type { MatchRecord } from "./history";

export const BACKUP_FORMAT = "checkout-backup";
const MAX_MATCHES = 5000;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: number;
  matches: MatchRecord[];
}

/** Serialises matches for download. The account owner is left out: a backup belongs to whoever imports it. */
export function buildBackup(matches: MatchRecord[], now = Date.now()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now,
    matches: matches.map((m) => {
      const copy = { ...m };
      delete copy.owner;
      return copy;
    }),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 80;

function validVisit(v: unknown): boolean {
  if (!isObj(v)) return false;
  const darts = v.darts;
  return (
    isStr(v.id) &&
    isStr(v.playerId) &&
    isNum(v.score) &&
    v.score >= 0 &&
    v.score <= 180 &&
    isNum(v.dartsThrown) &&
    typeof v.bust === "boolean" &&
    typeof v.checkout === "boolean" &&
    (darts === null || (Array.isArray(darts) && darts.length <= 3 && darts.every((d) => isObj(d) && isValidDart(d as never))))
  );
}

/** Returns a clean MatchRecord, or null if the value isn't a well-formed match. */
export function validateMatch(v: unknown): MatchRecord | null {
  if (!isObj(v) || !isStr(v.id) || !isNum(v.playedAt)) return null;
  const { config, players, visits } = v;
  if (!isObj(config) || !isNum(config.startScore) || typeof config.doubleOut !== "boolean" || !isNum(config.legsToWin)) return null;
  if (!Array.isArray(players) || players.length === 0 || players.length > 8) return null;
  if (!players.every((p) => isObj(p) && isStr(p.id) && typeof p.name === "string" && p.name.length <= 24)) return null;
  if (!Array.isArray(visits) || !visits.every(validVisit)) return null;
  const ids = new Set((players as { id: string }[]).map((p) => p.id));
  if (!(visits as { playerId: string }[]).every((x) => ids.has(x.playerId))) return null;

  return {
    id: v.id,
    playedAt: v.playedAt,
    startedAt: isNum(v.startedAt) ? v.startedAt : undefined,
    activeMs: isNum(v.activeMs) ? v.activeMs : undefined,
    sessionId: typeof v.sessionId === "string" && v.sessionId.length <= 80 ? v.sessionId : undefined,
    config: { startScore: config.startScore, doubleOut: config.doubleOut, legsToWin: config.legsToWin },
    players: players as MatchRecord["players"],
    visits: visits as MatchRecord["visits"],
  };
}

export class BackupError extends Error {}

/** Parses a backup file. Throws BackupError if it isn't one; malformed matches inside are counted, not imported. */
export function parseBackup(text: string): { matches: MatchRecord[]; invalid: number } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("not json");
  }
  if (!isObj(data) || data.format !== BACKUP_FORMAT || data.version !== 1 || !Array.isArray(data.matches)) {
    throw new BackupError("not a checkout backup");
  }
  if (data.matches.length > MAX_MATCHES) throw new BackupError("too many matches");
  const matches: MatchRecord[] = [];
  let invalid = 0;
  for (const raw of data.matches) {
    const m = validateMatch(raw);
    if (m) matches.push(m);
    else invalid++;
  }
  return { matches, invalid };
}
