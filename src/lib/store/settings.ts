import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameConfig } from "@/lib/darts/game";
import { uid } from "@/lib/id";

export type InputMode = "darts" | "total";
export type Lang = "fr" | "en";
export type Theme = "light" | "dark";

interface SettingsState {
  lang: Lang;
  theme: Theme;
  /** The name used for personal stats and when joining rooms. */
  name: string;
  /** Anonymous id identifying this phone's players in online rooms. */
  deviceId: string;
  inputMode: InputMode;
  /** Submit automatically once a visit is complete (3rd dart, bust or checkout). */
  autoSubmit: boolean;
  /** Announce scores out loud like a referee. */
  caller: boolean;
  haptics: boolean;
  lastConfig: GameConfig;
  lastPlayers: string[];
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "fr",
      theme: "light",
      name: "",
      deviceId: uid(),
      inputMode: "darts",
      autoSubmit: true,
      caller: false,
      haptics: true,
      lastConfig: { startScore: 301, doubleOut: true, legsToWin: 1 },
      lastPlayers: [],
      set: (patch) => set(patch),
    }),
    { name: "checkout-settings", version: 1 },
  ),
);

/** Returns this device's id, persisting it on first use so it stays stable. */
export function getDeviceId(): string {
  const s = useSettings.getState();
  s.set({ deviceId: s.deviceId });
  return s.deviceId;
}
