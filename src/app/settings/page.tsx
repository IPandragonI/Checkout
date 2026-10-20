"use client";

import { Database, Gamepad2, Moon, SlidersHorizontal, Sun, Target, Trash2 } from "lucide-react";
import { AccountStatusCard } from "@/components/ui/AccountPrompts";
import { ConfigFields } from "@/components/ui/ConfigFields";
import { PageShell, Segmented } from "@/components/ui/PageShell";
import { useAuth } from "@/lib/auth/store";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { onlineEnabled } from "@/lib/online/supabase";
import { useHistory, visibleMatches } from "@/lib/store/history";
import { InputMode, Lang, Theme, useSettings } from "@/lib/store/settings";

export default function SettingsPage() {
  const hydrated = useHydrated();
  const t = useT();
  return <PageShell title={t.settings}>{hydrated ? <SettingsForm /> : <span className="loading loading-dots mx-auto" />}</PageShell>;
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl tracking-wide">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        {hint && <p className="text-xs text-base-content/60">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="tile flex items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-base-content/60">{hint}</span>
      </span>
      <input type="checkbox" className="toggle toggle-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-base-content/70">{label}</div>
      {children}
    </div>
  );
}

function SettingsForm() {
  const s = useSettings();
  const t = useT();
  const userId = useAuth((a) => a.user?.id ?? null);
  const localCount = useHistory((h) => visibleMatches(h.matches, userId).length);
  const clear = useHistory((h) => h.clear);

  return (
    <div className="space-y-7 pb-4">
      <Section icon={<SlidersHorizontal className="size-5" />} title={t.sectionPreferences}>
        <Field label={t.language}>
          <Segmented<Lang>
            label={t.language}
            value={s.lang}
            options={[
              { value: "fr", label: "Français" },
              { value: "en", label: "English" },
            ]}
            onChange={(lang) => s.set({ lang })}
          />
        </Field>
        <Field label={t.theme}>
          <div className="join w-full" role="radiogroup" aria-label={t.theme}>
            {(
              [
                ["light", t.light, <Sun key="sun" className="size-4" />],
                ["dark", t.dark, <Moon key="moon" className="size-4" />],
              ] as [Theme, string, React.ReactNode][]
            ).map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={s.theme === value}
                className={`btn join-item flex-1 gap-2 ${s.theme === value ? "btn-primary" : "btn-soft"}`}
                onClick={() => s.set({ theme: value })}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </Field>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-base-content/70">{t.yourName}</span>
          <input
            className="input w-full"
            value={s.name}
            maxLength={24}
            placeholder={t.statsNamePlaceholder}
            onChange={(e) => s.set({ name: e.target.value })}
          />
        </label>
      </Section>

      <Section icon={<Target className="size-5" />} title={t.sectionGameDefaults} hint={t.sectionGameDefaultsHint}>
        <ConfigFields value={s.lastConfig} onChange={(lastConfig) => s.set({ lastConfig })} />
      </Section>

      <Section icon={<Gamepad2 className="size-5" />} title={t.sectionScoring}>
        <Field label={t.scoringInput}>
          <Segmented<InputMode>
            label={t.scoringInput}
            value={s.inputMode}
            options={[
              { value: "darts", label: t.dartByDart },
              { value: "total", label: t.quickTotal },
            ]}
            onChange={(inputMode) => s.set({ inputMode })}
          />
        </Field>
        <Toggle label={t.autoSubmit} hint={t.autoSubmitHint} checked={s.autoSubmit} onChange={(autoSubmit) => s.set({ autoSubmit })} />
        <Toggle label={t.caller} hint={t.callerHint} checked={s.caller} onChange={(caller) => s.set({ caller })} />
        <Toggle label={t.haptics} hint={t.hapticsHint} checked={s.haptics} onChange={(haptics) => s.set({ haptics })} />
      </Section>

      <Section icon={<Database className="size-5" />} title={t.sectionAccount}>
        {onlineEnabled && <AccountStatusCard />}
        <div className="tile flex flex-col items-start gap-1 px-4 py-3">
          <span className="text-sm">{t.localMatches(localCount)}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm -ml-3 text-error"
            disabled={localCount === 0}
            onClick={() => confirm(userId ? t.clearHistoryConfirmCloud : t.clearHistoryConfirm) && clear()}
          >
            <Trash2 className="size-4" /> {t.clearLocalHistory}
          </button>
        </div>
        <div className="panel space-y-1 p-4 text-sm text-base-content/70">
          <p className="font-medium text-base-content">{t.installTitle}</p>
          <p>{t.installHow}</p>
          <p>{t.installOffline}</p>
        </div>
      </Section>
    </div>
  );
}
