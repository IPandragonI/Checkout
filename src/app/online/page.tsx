"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfigFields } from "@/components/ui/ConfigFields";
import { PageShell } from "@/components/ui/PageShell";
import type { GameConfig } from "@/lib/darts/game";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { addPlayer, createRoom, findRoom, normalizeCode } from "@/lib/online/rooms";
import { onlineEnabled } from "@/lib/online/supabase";
import { getDeviceId, useSettings } from "@/lib/store/settings";

export default function OnlinePage() {
  const hydrated = useHydrated();
  const t = useT();
  return (
    <PageShell title={t.onlineRoom}>
      {!onlineEnabled ? <NotConfigured /> : hydrated ? <OnlineForms /> : <span className="loading loading-dots mx-auto" />}
    </PageShell>
  );
}

function NotConfigured() {
  const t = useT();
  return (
    <div role="alert" className="alert alert-warning alert-soft flex-col items-start">
      <p className="font-semibold">{t.notConfiguredTitle}</p>
      <p className="text-sm break-words">{t.notConfiguredBody}</p>
    </div>
  );
}

function OnlineForms() {
  const router = useRouter();
  const t = useT();
  const { name, lastConfig, set } = useSettings();
  const [config, setConfig] = useState<GameConfig>(lastConfig);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"join" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const join = async (value: string) => {
    if (value.length !== 4) return;
    setBusy("join");
    setError(null);
    try {
      const room = await findRoom(value);
      if (!room) {
        setError(t.noRoomWithCode(value));
        return;
      }
      router.push(`/room/${room.code}`);
    } catch {
      setError(t.serverUnreachable);
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    setBusy("create");
    setError(null);
    try {
      set({ lastConfig: config });
      const room = await createRoom(config);
      await addPlayer(room.id, name.trim() || t.host, getDeviceId());
      router.push(`/room/${room.code}`);
    } catch {
      setError(t.createFailed);
      setBusy(null);
    }
  };

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-base-content/70">{t.yourName}</span>
        <input
          className="input w-full"
          value={name}
          maxLength={24}
          placeholder={t.yourNamePlaceholder}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>

      <section className="card panel">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title font-display text-xl tracking-wide font-normal">{t.joinWithCode}</h2>
          <input
            className="input input-lg w-full text-center font-mono text-4xl tracking-[0.5em] uppercase"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="A7X9"
            value={code}
            onChange={(e) => {
              const v = normalizeCode(e.target.value);
              setCode(v);
              if (v.length === 4) join(v);
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={code.length !== 4 || busy !== null}
            onClick={() => join(code)}
          >
            {busy === "join" ? <span className="loading loading-spinner" /> : t.joinRoom}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="alert alert-error alert-soft">
          {error}
        </div>
      )}

      <section className="card panel">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title font-display text-xl tracking-wide font-normal">{t.hostRoom}</h2>
          <ConfigFields value={config} onChange={setConfig} />
          <button type="button" className="btn btn-accent" disabled={busy !== null} onClick={create}>
            {busy === "create" ? <span className="loading loading-spinner" /> : t.createRoom}
          </button>
        </div>
      </section>
    </>
  );
}
