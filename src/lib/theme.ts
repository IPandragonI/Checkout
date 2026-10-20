import type { Theme } from "@/lib/store/settings";

export const THEME_NAMES: Record<Theme, string> = { light: "checkout-light", dark: "checkout-dark" };

/** Browser chrome colours, matching each theme's base-200. */
export const THEME_COLORS: Record<Theme, string> = { light: "#f2f4f8", dark: "#0e1a35" };

/**
 * Inline script for <head>: applies the saved theme and language before first
 * paint so there is no flash of the wrong theme.
 */
export const PREFERENCES_SCRIPT = `try{var s=(JSON.parse(localStorage.getItem("checkout-settings")||"{}").state)||{};var d=document.documentElement;d.dataset.theme=s.theme==="dark"?"${THEME_NAMES.dark}":"${THEME_NAMES.light}";d.lang=s.lang==="en"?"en":"fr";}catch(e){}`;
