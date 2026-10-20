import { ALL_TARGETS, Dart, dartValue, isDouble } from "./dart";

/**
 * Checkout suggestions are found by brute force over every 1–3 dart route,
 * ranked by darts used and then by how comfortable each dart is to hit.
 * Tables are built lazily once per rule set and memoised.
 */

// Preferred finishing doubles: lower is better.
const FINISH_COST: Record<number, number> = {
  20: 0, 16: 0.2, 8: 0.5, 10: 0.5, 12: 0.6, 18: 0.7, 4: 0.9, 6: 1, 14: 1, 2: 1.2,
};
const BULL_FINISH_COST = 7;
const DART_WEIGHT = 10;

function setupCost(d: Dart): number {
  if (d.n === 25) return d.m === 2 ? 6 : 3;
  if (d.m === 1) return 0;
  if (d.m === 3) return 2 + (20 - d.n) * 0.1;
  return 5; // doubles are poor setup shots
}

function finishCost(d: Dart, doubleOut: boolean): number {
  if (!doubleOut) return setupCost(d);
  if (d.n === 25) return BULL_FINISH_COST;
  return FINISH_COST[d.n] ?? (d.n % 2 === 0 ? 1.4 : 1.8);
}

function routeCost(route: Dart[], doubleOut: boolean): number {
  let cost = route.length * DART_WEIGHT;
  for (let i = 0; i < route.length - 1; i++) cost += setupCost(route[i]);
  return cost + finishCost(route[route.length - 1], doubleOut);
}

type Table = Map<number, Dart[]>;
const tables = new Map<string, Table>();

function buildTable(maxDarts: number, doubleOut: boolean): Table {
  const finishers = doubleOut ? ALL_TARGETS.filter(isDouble) : ALL_TARGETS;
  const best = new Map<number, { route: Dart[]; cost: number }>();

  const consider = (route: Dart[]) => {
    const total = route.reduce((s, d) => s + dartValue(d), 0);
    const cost = routeCost(route, doubleOut);
    const prev = best.get(total);
    if (!prev || cost < prev.cost) best.set(total, { route, cost });
  };

  for (const f of finishers) {
    consider([f]);
    if (maxDarts < 2) continue;
    for (const a of ALL_TARGETS) {
      consider([a, f]);
      if (maxDarts < 3) continue;
      for (const b of ALL_TARGETS) consider([a, b, f]);
    }
  }

  const table: Table = new Map();
  for (const [total, { route }] of best) {
    // Throw the bigger setup dart first: same total, reads like a checkout chart.
    const setup = route.slice(0, -1).sort((a, b) => dartValue(b) - dartValue(a));
    table.set(total, [...setup, route[route.length - 1]]);
  }
  return table;
}

/**
 * Best route to finish `remaining` with at most `dartsLeft` darts, or null
 * when no checkout exists (too high, bogey number, or not enough darts).
 */
export function suggestCheckout(remaining: number, dartsLeft: number, doubleOut: boolean): Dart[] | null {
  if (dartsLeft < 1 || remaining < 1) return null;
  const darts = Math.min(3, dartsLeft);
  const key = `${darts}:${doubleOut}`;
  let table = tables.get(key);
  if (!table) {
    table = buildTable(darts, doubleOut);
    tables.set(key, table);
  }
  return table.get(remaining) ?? null;
}

export function canCheckout(remaining: number, dartsLeft: number, doubleOut: boolean): boolean {
  return suggestCheckout(remaining, dartsLeft, doubleOut) !== null;
}

/** Fewest darts needed to finish `remaining` (1–3), or null if impossible in one visit. */
export function minDartsToFinish(remaining: number, doubleOut: boolean): number | null {
  for (let d = 1; d <= 3; d++) if (canCheckout(remaining, d, doubleOut)) return d;
  return null;
}
