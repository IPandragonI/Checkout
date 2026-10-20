"use client";

import { ArrowLeft, Calculator, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { suggestCheckout } from "@/lib/darts/checkout";
import { Dart, Multiplier } from "@/lib/darts/dart";
import {
  evaluateDarts,
  evaluateTotal,
  GameConfig,
  Player,
  replay,
  Visit,
  VisitInput,
  visitFromDarts,
  visitFromTotal,
} from "@/lib/darts/game";
import { announce, callForVisit, haptic } from "@/lib/feedback";
import { useWakeLock } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/store/settings";
import { DartPad } from "./DartPad";
import { MatchSummary } from "./MatchSummary";
import { PlayerLine, Scoreboard } from "./Scoreboard";
import { TotalPad } from "./TotalPad";
import { CheckoutHint, VisitStrip } from "./VisitStrip";

interface Props {
  config: GameConfig;
  players: Player[];
  visits: Visit[];
  onSubmit: (playerId: string, input: VisitInput) => void;
  /** Removes the last visit. Should throw if that fails. */
  onUndo: () => Promise<void> | void;
  onExit: () => void;
  title: string;
  /** Players this device controls. Undefined means every player (pass-and-play). */
  myPlayerIds?: Set<string>;
  /** Buttons shown in the match-over sheet (rematch, home…). */
  matchOverActions: React.ReactNode;
  banner?: React.ReactNode;
}

const DOUBLE_TAP_GUARD_MS = 350;

export function GameScreen({
  config,
  players,
  visits,
  onSubmit,
  onUndo,
  onExit,
  title,
  myPlayerIds,
  matchOverActions,
  banner,
}: Props) {
  useWakeLock();
  const t = useT();
  const inputMode = useSettings((s) => s.inputMode);
  const autoSubmit = useSettings((s) => s.autoSubmit);
  const setSettings = useSettings((s) => s.set);

  const [pending, setPending] = useState<Dart[]>([]);
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [total, setTotal] = useState("");
  const [totalError, setTotalError] = useState<string | null>(null);
  const [askCheckoutDarts, setAskCheckoutDarts] = useState<{ total: number; min: number } | null>(null);
  const [unlockedFor, setUnlockedFor] = useState<string | null>(null);
  /** Visit to reopen for editing once an undo lands (local or remote). */
  const [restore, setRestore] = useState<{ darts: Dart[]; total: string } | null>(null);
  const lastSubmitAt = useRef(0);

  const state = useMemo(() => replay(config, players, visits), [config, players, visits]);
  const currentId = state.currentPlayerId;
  const start = currentId ? state.remaining[currentId] : 0;
  const live = evaluateDarts(start, pending, config.doubleOut);
  const dartsLeft = 3 - pending.length;
  const visitOver = live.status !== "open" || dartsLeft === 0;
  const route =
    inputMode === "darts" && live.status === "open"
      ? suggestCheckout(live.remaining, dartsLeft, config.doubleOut)
      : inputMode === "total"
        ? suggestCheckout(start, 3, config.doubleOut)
        : null;

  const mine = (id: string) => !myPlayerIds || myPlayerIds.has(id);
  const canScore = currentId !== null && (mine(currentId) || unlockedFor === currentId);
  const currentPlayer = players.find((p) => p.id === currentId);

  // Reset the visit in progress whenever the turn moves (including remote updates).
  const turnKey = `${currentId}:${state.played.length}`;
  const [seenTurn, setSeenTurn] = useState(turnKey);
  if (seenTurn !== turnKey) {
    setSeenTurn(turnKey);
    setPending(restore?.darts ?? []);
    setTotal(restore?.total ?? "");
    setRestore(null);
    setMultiplier(1);
    setTotalError(null);
  }

  const submit = useCallback(
    (input: VisitInput) => {
      if (!currentId) return;
      const now = Date.now();
      if (now - lastSubmitAt.current < DOUBLE_TAP_GUARD_MS) return;
      lastSubmitAt.current = now;
      haptic(input.checkout ? [30, 40, 60] : 20);
      announce(callForVisit(input.score, input.bust, input.checkout));
      setPending([]);
      setMultiplier(1);
      setTotal("");
      setTotalError(null);
      onSubmit(currentId, input);
    },
    [currentId, onSubmit],
  );

  const submitDarts = (darts: Dart[]) => submit(visitFromDarts(start, darts, config.doubleOut));

  const addDart = (d: Dart) => {
    if (!canScore || visitOver) return;
    haptic();
    const next = [...pending, d];
    setPending(next);
    setMultiplier(1);
    const ev = evaluateDarts(start, next, config.doubleOut);
    if (autoSubmit && (ev.status !== "open" || next.length === 3)) submitDarts(next);
  };

  /** Backspace: remove the last dart, or reopen the previous visit for editing. */
  const backspace = async () => {
    haptic();
    if (inputMode === "darts" && pending.length > 0) {
      setPending(pending.slice(0, -1));
      return;
    }
    if (inputMode === "total" && total !== "") {
      setTotal(total.slice(0, -1));
      setTotalError(null);
      return;
    }
    const last = visits.at(-1);
    if (!last) return;
    setUnlockedFor(last.playerId);
    setRestore({
      darts: last.darts?.slice(0, -1) ?? [],
      total: last.bust || last.darts ? "" : String(last.score).slice(0, -1),
    });
    try {
      await onUndo();
    } catch {
      setRestore(null);
    }
  };

  const submitTotal = (value: number) => {
    if (!canScore) return;
    const ev = evaluateTotal(start, value, config.doubleOut);
    if (ev.kind === "invalid") {
      haptic(60);
      setTotalError(t.impossibleTotal(value));
      return;
    }
    if (ev.kind === "checkout" && ev.minDarts < 3) {
      setAskCheckoutDarts({ total: value, min: ev.minDarts });
      return;
    }
    const input = visitFromTotal(start, value, config.doubleOut);
    if (input) submit(input);
  };

  // Hardware keyboard support for the total pad (desktop / tablets).
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (inputMode === "total" && /^\d$/.test(e.key)) {
        const next = total === "0" ? e.key : total + e.key;
        if (Number(next) <= 180) setTotal(next);
      } else if (e.key === "Enter") {
        if (inputMode === "total" && total !== "") submitTotal(Number(total));
        else if (inputMode === "darts") submitDarts(pending);
      }
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const lines: PlayerLine[] = useMemo(() => {
    return players.map((p) => {
      let points = 0;
      let darts = 0;
      let lastScore: number | null = null;
      let dartsInLeg = 0;
      for (const pv of state.played) {
        if (pv.visit.playerId !== p.id) continue;
        points += pv.visit.score;
        darts += pv.visit.dartsThrown;
        lastScore = pv.visit.score;
        if (pv.leg === state.leg) dartsInLeg += pv.visit.dartsThrown;
      }
      const isCurrent = p.id === currentId;
      return {
        player: p,
        remaining: state.remaining[p.id],
        live: isCurrent && inputMode === "darts" && pending.length ? live.remaining : null,
        bust: isCurrent && live.status === "bust",
        legsWon: state.legsWon[p.id] ?? 0,
        average: darts ? (points / darts) * 3 : 0,
        lastScore,
        dartsInLeg,
        isCurrent,
        isMine: !!myPlayerIds?.has(p.id),
      };
    });
  }, [players, state, currentId, inputMode, pending.length, live.remaining, live.status, myPlayerIds]);

  const legNotice = (() => {
    const inLeg = state.played.filter((p) => p.leg === state.leg).length;
    if (state.leg === 0 || inLeg > 0) return null;
    const w = players.find((p) => p.id === state.legWinners[state.leg - 1]);
    return t.legNotice(w?.name ?? "", state.leg, currentPlayer?.name ?? "");
  })();

  const totalPreview = (() => {
    if (total === "") return currentPlayer ? t.playerOn(currentPlayer.name, start) : null;
    const ev = evaluateTotal(start, Number(total), config.doubleOut);
    if (ev.kind === "bust") return t.bust;
    if (ev.kind === "checkout") return t.checkoutExcl;
    if (ev.kind === "score") return t.leaves(ev.remaining);
    return null;
  })();

  const submitLabel =
    live.status === "bust"
      ? t.bustNext
      : live.status === "checkout"
        ? t.gameShotBtn
        : pending.length === 0
          ? t.noScore
          : t.submitN(live.thrown);

  return (
    <div className="flex h-dvh flex-col gap-2 pt-safe pb-safe overflow-hidden">
      <header className="flex items-center gap-2 px-2">
        <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onExit} aria-label={t.back}>
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-bold">{title}</div>
          <div className="text-xs text-base-content/60">
            {config.startScore} · {config.doubleOut ? t.dOut : t.sOut}
            {config.legsToWin > 1 && ` · ${t.legN(state.leg + 1)} · ${t.firstTo(config.legsToWin)}`}
          </div>
        </div>
        <div className="join" role="group" aria-label={t.inputModeLabel}>
          <button
            type="button"
            className={`btn btn-sm join-item ${inputMode === "darts" ? "btn-active btn-neutral" : "btn-ghost"}`}
            onClick={() => setSettings({ inputMode: "darts" })}
            aria-label={t.dartByDart}
          >
            <Target className="size-4" />
          </button>
          <button
            type="button"
            className={`btn btn-sm join-item ${inputMode === "total" ? "btn-active btn-neutral" : "btn-ghost"}`}
            onClick={() => setSettings({ inputMode: "total" })}
            aria-label={t.quickTotal}
          >
            <Calculator className="size-4" />
          </button>
        </div>
      </header>

      {banner}
      <Scoreboard lines={lines} legsToWin={config.legsToWin} />

      {inputMode === "darts" ? (
        <VisitStrip
          darts={pending}
          thrown={live.thrown}
          status={live.status}
          route={route}
          remaining={live.remaining}
          dartsLeft={dartsLeft}
          notice={legNotice}
        />
      ) : (
        <div className="px-3">
          <CheckoutHint route={route} remaining={start} dartsLeft={3} status="open" notice={legNotice} />
        </div>
      )}

      <div className="relative flex flex-1 flex-col gap-1.5 px-3 min-h-0">
        {inputMode === "darts" ? (
          <>
            <DartPad
              multiplier={multiplier}
              onMultiplier={(m) => {
                haptic();
                setMultiplier(m);
              }}
              onDart={addDart}
              onBackspace={backspace}
              disabled={!canScore || visitOver}
            />
            <button
              type="button"
              disabled={!canScore}
              onClick={() => submitDarts(pending)}
              className={`btn h-14 text-lg font-bold ${
                live.status === "bust" ? "btn-error" : live.status === "checkout" || visitOver ? "btn-success animate-pulse" : "btn-primary"
              }`}
            >
              {submitLabel}
            </button>
          </>
        ) : (
          <TotalPad
            value={total}
            onChange={(v) => {
              haptic();
              setTotal(v);
              setTotalError(null);
            }}
            onSubmit={submitTotal}
            onBackspace={backspace}
            disabled={!canScore}
            preview={totalPreview}
            error={totalError}
          />
        )}

        {!canScore && currentPlayer && !state.winnerId && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-box bg-base-200/85 backdrop-blur-[2px] text-center">
            <p className="text-lg font-semibold">{t.waitingFor(currentPlayer.name)}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setUnlockedFor(currentPlayer.id)}>
              {t.scoreFor(currentPlayer.name)}
            </button>
          </div>
        )}
      </div>

      {askCheckoutDarts && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-base-300/70" onClick={() => setAskCheckoutDarts(null)}>
          <div className="w-full max-w-md rounded-t-box bg-base-100 p-5 pb-safe space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-lg font-semibold">{t.whichDart(askCheckoutDarts.total)}</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={n < askCheckoutDarts.min}
                  className="btn btn-lg btn-success"
                  onClick={() => {
                    const input = visitFromTotal(start, askCheckoutDarts.total, config.doubleOut, n);
                    setAskCheckoutDarts(null);
                    if (input) submit(input);
                  }}
                >
                  {t.ordinals[n - 1]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.winnerId && (
        <MatchSummary
          config={config}
          players={players}
          visits={visits}
          winnerId={state.winnerId}
          onUndo={() => void onUndo()}
          actions={matchOverActions}
        />
      )}
    </div>
  );
}
