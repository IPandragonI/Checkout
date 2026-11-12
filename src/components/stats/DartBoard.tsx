import { dartLabel } from "@/lib/darts/dart";

/** Segment numbers clockwise from the top of a standard board. */
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** Real board radii in mm. */
const R = { bull: 6.35, outerBull: 15.9, tripleIn: 99, tripleOut: 107, doubleIn: 162, doubleOut: 170 };

const pt = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
};

/** Ring sector between two radii and two angles (degrees clockwise from the top). */
const sector = (r1: number, r2: number, a1: number, a2: number) =>
  `M${pt(r2, a1)}A${r2},${r2} 0 0 1 ${pt(r2, a2)}L${pt(r1, a2)}A${r1},${r1} 0 0 0 ${pt(r1, a1)}Z`;

const RINGS: { m: 1 | 2 | 3; from: number; to: number }[] = [
  { m: 1, from: R.outerBull, to: R.tripleIn },
  { m: 3, from: R.tripleIn, to: R.tripleOut },
  { m: 1, from: R.tripleOut, to: R.doubleIn },
  { m: 2, from: R.doubleIn, to: R.doubleOut },
];

/**
 * A dartboard coloured by how often each region was hit. `heat` maps "<segment>x<multiplier>"
 * (e.g. "20x3") to a hit count; the inner and outer single areas of a segment are counted together.
 */
export function DartBoard({ heat, label }: { heat: Record<string, number>; label: string }) {
  const max = Math.max(1, ...Object.entries(heat).filter(([k]) => !k.startsWith("0x")).map(([, v]) => v));
  // Square root keeps rarely hit regions visible next to a favourite one.
  const opacity = (count: number) => (count ? 0.2 + 0.8 * Math.sqrt(count / max) : 0);

  const regions: { key: string; d: string; base: boolean; title: string; count: number }[] = [];
  ORDER.forEach((n, i) => {
    const a1 = i * 18 - 9;
    const a2 = i * 18 + 9;
    RINGS.forEach(({ m, from, to }, ring) => {
      const count = heat[`${n}x${m}`] ?? 0;
      // Real boards alternate light/dark per segment; doubles and triples take the opposite shade.
      const dark = (i % 2 === 0) !== (m !== 1);
      regions.push({
        key: `${n}-${ring}`,
        d: sector(from, to, a1, a2),
        base: dark,
        title: `${dartLabel({ n, m })}: ${count}`,
        count,
      });
    });
  });

  const outer = heat["25x1"] ?? 0;
  const bull = heat["25x2"] ?? 0;

  return (
    <svg viewBox="-200 -200 400 400" role="img" aria-label={label} className="mx-auto w-full max-w-72">
      <circle r={R.doubleOut + 8} className="fill-base-300" />
      {regions.map((r) => (
        <g key={r.key}>
          <path d={r.d} className={r.base ? "fill-base-content/20" : "fill-base-content/8"} stroke="var(--color-base-100)" strokeWidth={0.8}>
            <title>{r.title}</title>
          </path>
          {r.count > 0 && (
            <path d={r.d} fill="var(--chart-series)" fillOpacity={opacity(r.count)} stroke="var(--color-base-100)" strokeWidth={0.8} pointerEvents="none" />
          )}
        </g>
      ))}
      <circle r={R.outerBull} className="fill-base-content/20" stroke="var(--color-base-100)" strokeWidth={0.8}>
        <title>{`25: ${outer}`}</title>
      </circle>
      {outer > 0 && <circle r={R.outerBull} fill="var(--chart-series)" fillOpacity={opacity(outer)} pointerEvents="none" />}
      <circle r={R.bull} className="fill-base-content/30" stroke="var(--color-base-100)" strokeWidth={0.8}>
        <title>{`Bull: ${bull}`}</title>
      </circle>
      {bull > 0 && <circle r={R.bull} fill="var(--chart-series)" fillOpacity={opacity(bull)} pointerEvents="none" />}
      {ORDER.map((n, i) => {
        const [x, y] = pt(R.doubleOut + 17, i * 18).split(",");
        return (
          <text key={n} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-base-content/70 text-[13px] font-semibold">
            {n}
          </text>
        );
      })}
    </svg>
  );
}
