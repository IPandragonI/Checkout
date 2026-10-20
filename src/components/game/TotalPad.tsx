import { Check, Delete } from "lucide-react";
import { useT } from "@/lib/i18n";
import { PadKey } from "./DartPad";

const PRESETS = [26, 41, 45, 60, 85, 100, 140, 180];
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (total: number) => void;
  onBackspace: () => void;
  disabled: boolean;
  /** Remaining after the typed total, for the live preview. */
  preview: string | null;
  error: string | null;
}

/** Calculator-style entry of the visit total, with one-tap presets. */
export function TotalPad({ value, onChange, onSubmit, onBackspace, disabled, preview, error }: Props) {
  const t = useT();
  const push = (digit: number) => {
    const next = value === "0" ? String(digit) : value + digit;
    if (Number(next) <= 180) onChange(next);
  };

  return (
    <div className="flex flex-1 flex-col gap-1.5 min-h-0">
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((p) => (
          <PadKey key={p} disabled={disabled} className="h-11 bg-base-300 text-lg" onPress={() => onSubmit(p)}>
            {p}
          </PadKey>
        ))}
      </div>

      <div className="flex h-14 items-center justify-between rounded-field bg-base-100 px-4">
        <span className={`font-mono text-4xl font-bold tabular ${value ? "" : "text-base-content/30"}`}>
          {value || "0"}
        </span>
        <span className={`text-sm text-right ${error ? "text-error" : "text-base-content/60"}`}>{error ?? preview}</span>
      </div>

      <div className="grid flex-1 grid-cols-3 grid-rows-4 gap-1.5 min-h-0">
        {DIGITS.map((d) => (
          <PadKey key={d} disabled={disabled} className="bg-base-100 text-3xl" onPress={() => push(d)}>
            {d}
          </PadKey>
        ))}
        <PadKey className="bg-warning/20 text-warning" onPress={onBackspace} label={t.delete}>
          <Delete className="size-7" />
        </PadKey>
        <PadKey disabled={disabled} className="bg-base-100 text-3xl" onPress={() => push(0)}>
          0
        </PadKey>
        <PadKey
          disabled={disabled || value === ""}
          className="bg-primary text-primary-content"
          onPress={() => onSubmit(Number(value))}
          label={t.submit}
        >
          <Check className="size-8" strokeWidth={3} />
        </PadKey>
      </div>
    </div>
  );
}
