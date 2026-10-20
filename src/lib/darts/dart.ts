/** A single dart. `n` is the segment (0 = miss, 1–20, 25 = bull); `m` the multiplier. */
export type Multiplier = 1 | 2 | 3;

export interface Dart {
  n: number;
  m: Multiplier;
}

export const MISS: Dart = { n: 0, m: 1 };

export function dartValue(d: Dart): number {
  return d.n * d.m;
}

/** True for darts that count as a finishing double (D1–D20 and the inner bull). */
export function isDouble(d: Dart): boolean {
  return d.m === 2 && d.n > 0;
}

export function isValidDart(d: Dart): boolean {
  if (d.n === 0) return d.m === 1;
  if (d.n === 25) return d.m === 1 || d.m === 2;
  return Number.isInteger(d.n) && d.n >= 1 && d.n <= 20;
}

export function dartLabel(d: Dart): string {
  if (d.n === 0) return "Miss";
  if (d.n === 25) return d.m === 2 ? "Bull" : "25";
  if (d.m === 3) return `T${d.n}`;
  if (d.m === 2) return `D${d.n}`;
  return String(d.n);
}

/** Every dart a player can aim at, excluding the miss. */
export const ALL_TARGETS: Dart[] = (() => {
  const out: Dart[] = [];
  for (let n = 1; n <= 20; n++) {
    out.push({ n, m: 1 }, { n, m: 2 }, { n, m: 3 });
  }
  out.push({ n: 25, m: 1 }, { n: 25, m: 2 });
  return out;
})();

/** Visit totals that cannot be scored with three darts. */
const IMPOSSIBLE_TOTALS = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

export function isPossibleVisitTotal(total: number): boolean {
  return Number.isInteger(total) && total >= 0 && total <= 180 && !IMPOSSIBLE_TOTALS.has(total);
}
