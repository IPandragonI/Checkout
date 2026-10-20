import { Dart, dartLabel } from "@/lib/darts/dart";
import type { VisitStatus } from "@/lib/darts/game";
import { Dict, useT } from "@/lib/i18n";

interface Props {
  darts: Dart[];
  thrown: number;
  status: VisitStatus;
  /** Suggested finish for the darts left, null when none is possible. */
  route: Dart[] | null;
  remaining: number;
  dartsLeft: number;
  notice?: string | null;
  /** Single-out only: a double finish shown as a compact alternative. */
  alt?: Dart[] | null;
}

/**
 * One colour convention for darts everywhere, matching the keypad toggles and the
 * board: trebles red, doubles (bull included) green, singles neutral.
 */
export function dartTone(d: Dart): { badge: string; text: string } {
  if (d.m === 3) return { badge: "badge-secondary", text: "text-secondary" };
  if (d.m === 2 && d.n > 0) return { badge: "badge-primary", text: "text-primary" };
  return { badge: "badge-ghost", text: "" };
}

/** The three dart slots of the visit in progress plus the live checkout hint. */
export function VisitStrip({ darts, thrown, status, route, remaining, dartsLeft, notice, alt }: Props) {
  const t = useT();
  return (
    <div className="px-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => {
          const d = darts[i];
          const next = i === darts.length && status === "open";
          return (
            <div
              key={i}
              className={`flex-1 h-10 rounded-field grid place-items-center font-mono text-lg font-semibold tabular ${
                d ? "bg-base-300" : next ? "border-2 border-dashed border-primary/60" : "bg-base-100/40"
              } ${d ? dartTone(d).text : ""}`}
            >
              {d ? dartName(d, t) : ""}
            </div>
          );
        })}
        <div
          className={`w-16 h-10 rounded-field grid place-items-center font-mono text-xl font-bold tabular ${
            status === "bust" ? "bg-error text-error-content" : status === "checkout" ? "bg-success text-success-content" : "bg-neutral text-neutral-content"
          }`}
        >
          {status === "bust" ? t.bust.toUpperCase() : thrown}
        </div>
      </div>
      <CheckoutHint route={route} alt={alt} remaining={remaining} dartsLeft={dartsLeft} status={status} notice={notice} />
    </div>
  );
}

export function CheckoutHint({
  route,
  alt,
  remaining,
  dartsLeft,
  status,
  notice,
}: {
  route: Dart[] | null;
  alt?: Dart[] | null;
  remaining: number;
  dartsLeft: number;
  status: VisitStatus;
  notice?: string | null;
}) {
  const t = useT();
  let content: React.ReactNode = null;
  if (status === "checkout") {
    content = <span className="font-semibold text-success">{t.gameShotHint}</span>;
  } else if (status === "bust") {
    content = <span className="text-error">{t.bustHint}</span>;
  } else if (route) {
    content = (
      <>
        <span className="text-xs uppercase tracking-wide text-base-content/50 mr-1">{t.out}</span>
        {route.map((d, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-base-content/30">→</span>}
            <span
              className={`badge font-mono font-bold ${dartTone(d).badge} ${
                // The dart to throw next gets a lime outline, whatever its colour.
                i === 0 ? "outline-2 outline-offset-1 outline-accent" : ""
              }`}
            >
              {dartName(d, t)}
            </span>
          </span>
        ))}
        {alt && (
          <span className="ml-1.5 min-w-0 truncate text-xs text-base-content/60">
            {t.doubleAlt}{" "}
            {alt.map((d, i) => (
              <span key={i} className={`font-mono font-bold ${dartTone(d).text}`}>
                {i > 0 && " "}
                {dartName(d, t)}
              </span>
            ))}
          </span>
        )}
      </>
    );
  } else if (remaining > 0 && remaining <= 170 && dartsLeft > 0) {
    content = <span className="text-base-content/50">{t.noFinish(dartsLeft)}</span>;
  } else if (notice) {
    content = <span className="text-base-content/60">{notice}</span>;
  }
  return <div className="h-7 flex items-center gap-1 text-sm overflow-hidden">{content}</div>;
}

/** Dart label with the miss translated (T20, D16, Bull stay universal). */
function dartName(d: Dart, t: Dict): string {
  return d.n === 0 ? t.miss : dartLabel(d);
}
