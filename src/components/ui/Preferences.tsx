"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";
import { useHydrated } from "@/lib/hooks";
import { Lang, useSettings } from "@/lib/store/settings";
import { THEME_COLORS, THEME_NAMES } from "@/lib/theme";

/** Keeps <html data-theme / lang> and the theme-color meta in sync with settings. */
export function PreferencesSync() {
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.dataset.theme = THEME_NAMES[theme];
    root.lang = lang;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  }, [hydrated, theme, lang]);

  return null;
}

/** Compact FR/EN switch plus a light/dark button, for headers. */
export function PreferenceToggles() {
  const t = useT();
  const hydrated = useHydrated();
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const shownLang: Lang = hydrated ? lang : "fr";
  const dark = hydrated && theme === "dark";

  return (
    <div className="flex items-center gap-1">
      <div className="join" role="radiogroup" aria-label={t.language}>
        {(["fr", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={shownLang === l}
            className={`btn btn-xs join-item uppercase ${shownLang === l ? "btn-neutral" : "btn-ghost"}`}
            onClick={() => set({ lang: l })}
          >
            {l}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        aria-label={t.toggleTheme}
        aria-pressed={dark}
        onClick={() => set({ theme: dark ? "light" : "dark" })}
      >
        {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>
    </div>
  );
}
