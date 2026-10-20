import type { GameConfig } from "@/lib/darts/game";
import { useT } from "@/lib/i18n";
import { Segmented } from "./PageShell";

export function ConfigFields({ value, onChange }: { value: GameConfig; onChange: (c: GameConfig) => void }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-sm font-medium text-base-content/70">{t.game}</div>
        <Segmented
          label={t.startScore}
          value={value.startScore}
          options={[101, 301, 501, 701].map((s) => ({ value: s, label: String(s) }))}
          onChange={(startScore) => onChange({ ...value, startScore })}
        />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-base-content/70">{t.legsFirstTo}</div>
        <Segmented
          label={t.legsToWin}
          value={value.legsToWin}
          options={[1, 2, 3, 5].map((n) => ({ value: n, label: String(n) }))}
          onChange={(legsToWin) => onChange({ ...value, legsToWin })}
        />
      </div>
      <label className="flex items-center justify-between rounded-field bg-base-100 px-4 py-3">
        <span>
          <span className="font-medium">{t.doubleOut}</span>
          <span className="block text-xs text-base-content/60">{t.doubleOutHint}</span>
        </span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={value.doubleOut}
          onChange={(e) => onChange({ ...value, doubleOut: e.target.checked })}
        />
      </label>
    </div>
  );
}
