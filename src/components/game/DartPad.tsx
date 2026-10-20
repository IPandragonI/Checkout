import { Delete } from "lucide-react";
import { Dart, Multiplier } from "@/lib/darts/dart";
import { useT } from "@/lib/i18n";

interface Props {
  multiplier: Multiplier;
  onMultiplier: (m: Multiplier) => void;
  onDart: (d: Dart) => void;
  onBackspace: () => void;
  disabled: boolean;
}

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

const MULTIPLIERS: { m: Multiplier; label: "single" | "double" | "treble"; active: string }[] = [
  { m: 1, label: "single", active: "bg-base-content text-base-100" },
  { m: 2, label: "double", active: "btn-primary" },
  { m: 3, label: "treble", active: "btn-secondary" },
];

/** Dart-by-dart keypad: multiplier toggles, 1–20, bulls, miss and backspace. */
export function DartPad({ multiplier, onMultiplier, onDart, onBackspace, disabled }: Props) {
  const t = useT();
  const tint =
    multiplier === 3 ? "bg-secondary/20 text-secondary" : multiplier === 2 ? "bg-primary/20 text-primary" : "bg-base-100";
  const prefix = multiplier === 3 ? "T" : multiplier === 2 ? "D" : "";

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <div className="grid grid-cols-3 gap-1.5">
        {MULTIPLIERS.map(({ m, label, active }) => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onPointerDown={(e) => {
              e.preventDefault();
              onMultiplier(multiplier === m ? 1 : m);
            }}
            className={`btn h-11 text-base ${multiplier === m ? active : "btn-soft"}`}
          >
            {t[label]}
          </button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-5 grid-rows-4 gap-1.5 min-h-0">
        {NUMBERS.map((n) => (
          <PadKey key={n} disabled={disabled} className={tint} onPress={() => onDart({ n, m: multiplier })}>
            {prefix && <span className="text-xs opacity-70 mr-px">{prefix}</span>}
            {n}
          </PadKey>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1.5 h-14">
        <PadKey disabled={disabled} className="bg-base-100" onPress={() => onDart({ n: 25, m: 1 })}>
          25
        </PadKey>
        <PadKey disabled={disabled} className="bg-primary/20 text-primary" onPress={() => onDart({ n: 25, m: 2 })}>
          {t.bull}
        </PadKey>
        <PadKey disabled={disabled} className="bg-base-100 text-base-content/70" onPress={() => onDart({ n: 0, m: 1 })}>
          {t.miss}
        </PadKey>
        <PadKey disabled={false} className="bg-warning/20 text-warning" onPress={onBackspace} label={t.undo}>
          <Delete className="size-6" />
        </PadKey>
      </div>
    </div>
  );
}

/** Fires on pointer-down rather than click: shaves the tap latency off every dart. */
export function PadKey({
  children,
  onPress,
  disabled,
  className = "",
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        onPress();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress();
        }
      }}
      className={`rounded-field flex items-center justify-center font-mono text-2xl font-semibold tabular select-none active:scale-95 active:brightness-150 transition-transform duration-75 disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}
