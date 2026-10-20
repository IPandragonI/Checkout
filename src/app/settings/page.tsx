"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageShell, Segmented } from "@/components/ui/PageShell";
import { onlineEnabled } from "@/lib/online/supabase";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { InputMode, Lang, Theme, useSettings } from "@/lib/store/settings";

export default function SettingsPage() {
  const hydrated = useHydrated();
  const t = useT();
  return <PageShell title={t.settings}>{hydrated ? <SettingsForm /> : <span className="loading loading-dots mx-auto" />}</PageShell>;
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-field bg-base-100 px-4 py-3">
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
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
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
          <Segmented<Theme>
            label={t.theme}
            value={s.theme}
            options={[
              { value: "light", label: t.light },
              { value: "dark", label: t.dark },
            ]}
            onChange={(theme) => s.set({ theme })}
          />
        </Field>
      </div>

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

      {onlineEnabled && (
        <Link href="/account" className="flex items-center justify-between rounded-field bg-base-100 px-4 py-3">
          <span>
            <span className="font-medium">{t.account}</span>
            <span className="block text-xs text-base-content/60">{t.saveStatsLink}</span>
          </span>
          <ChevronRight className="size-5 text-base-content/40" />
        </Link>
      )}

      <div className="rounded-box bg-base-100 p-4 text-sm text-base-content/70 space-y-1">
        <p className="font-medium text-base-content">{t.installTitle}</p>
        <p>{t.installHow}</p>
        <p>{t.installOffline}</p>
      </div>
    </>
  );
}
