import { getT } from "@/lib/i18n";
import { useSettings } from "@/lib/store/settings";

export function haptic(pattern: number | number[] = 8) {
  if (!useSettings.getState().haptics) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

/** Referee-style call of a visit ("One hundred and eighty!"), in the app language. */
export function announce(text: string) {
  if (!useSettings.getState().caller || typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = getT().speechLang;
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

export function callForVisit(score: number, bust: boolean, checkout: boolean): string {
  const t = getT();
  if (bust) return t.callBust;
  if (checkout) return t.callGameShot;
  if (score === 0) return t.callNoScore;
  if (score === 180) return t.call180;
  return String(score);
}
